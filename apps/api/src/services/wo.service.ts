import type {
  WoApproveRequest,
  WoCreateRequest,
  WoGridQuery,
  WoLinkedCountdown,
  WoRecord,
  WoStatus,
  WoSummary,
} from "@smsystem/contracts/wo";
import type { AuditService } from "@/services/audit/audit.service";
import { DefaultAuditService } from "@/services/audit/audit.service";
import { TtlCache } from "@/lib/ttl-cache";
import { MySqlAuditRepository } from "@/repositories/audit.repo";
import {
  MySqlWoRepository,
  type WoRepository,
} from "@/repositories/wo.repo";
import type { WebSession } from "@/services/auth/session.service";
import { buildGridMeta } from "@/services/grid/paginate";

interface WoListResult {
  data: WoRecord[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  references: Awaited<ReturnType<WoRepository["listReferences"]>>;
  query: WoGridQuery;
  summary: WoSummary;
}

interface WoDetailResult {
  ticket: WoRecord;
  linkedCountdowns: WoLinkedCountdown[];
}

interface WoMutationResult {
  woId: string;
  status: WoStatus;
  linkedCountdownId?: string | null;
}

const WO_QUERY_CACHE_TTL_MS = 5_000;
const WO_REFERENCE_CACHE_TTL_MS = 60_000;
const woListCache = new TtlCache<WoListResult>(WO_QUERY_CACHE_TTL_MS);
const woReferenceCache = new TtlCache<
  Awaited<ReturnType<WoRepository["listReferences"]>>
>(WO_REFERENCE_CACHE_TTL_MS);

function buildWoScopeCacheKey(session: WebSession): string {
  return JSON.stringify({
    employeeId: session.user.employeeId,
    scope: session.user.scope,
  });
}

function buildWoQueryCacheKey(
  session: WebSession,
  query: WoGridQuery | { preset: string },
): string {
  return JSON.stringify({
    employeeId: session.user.employeeId,
    scope: session.user.scope,
    query,
  });
}

export interface WoService {
  list(session: WebSession, query: WoGridQuery): Promise<WoListResult>;
  listPendingApproval(session: WebSession): Promise<WoListResult>;
  listMyDivision(session: WebSession): Promise<WoListResult>;
  listUrgent(session: WebSession): Promise<WoRecord[]>;
  create(session: WebSession, input: WoCreateRequest): Promise<{ woId: string }>;
  update(session: WebSession, woId: string, input: WoCreateRequest): Promise<{ woId: string }>;
  findDetail(session: WebSession, woId: string): Promise<WoDetailResult | null>;
  approve(session: WebSession, woId: string, input?: WoApproveRequest): Promise<WoMutationResult>;
  reject(session: WebSession, woId: string, reason: string): Promise<WoMutationResult>;
  markDone(session: WebSession, woId: string): Promise<WoMutationResult>;
  findLinkedCountdowns(session: WebSession, woId: string): Promise<WoLinkedCountdown[]>;
}

export class DefaultWoService implements WoService {
  constructor(
    private readonly repository: WoRepository = new MySqlWoRepository(),
    private readonly auditService: AuditService = new DefaultAuditService(
      new MySqlAuditRepository(),
    ),
  ) {}

  private getReferences(session: WebSession) {
    return woReferenceCache.getOrCreate(
      buildWoScopeCacheKey(session),
      () =>
        this.repository.listReferences({
          employeeId: session.user.employeeId,
          scope: session.user.scope,
        }),
    );
  }

  async list(session: WebSession, query: WoGridQuery): Promise<WoListResult> {
    return woListCache.getOrCreate(
      buildWoQueryCacheKey(session, query),
      async () => {
        const [listResult, references] = await Promise.all([
          this.repository.list({
            employeeId: session.user.employeeId,
            scope: session.user.scope,
            query,
          }),
          this.getReferences(session),
        ]);

        return {
          data: listResult.rows,
          meta: buildGridMeta(listResult.total, query.page, query.limit),
          references,
          query,
          summary: listResult.summary,
        };
      },
    );
  }

  async listPendingApproval(session: WebSession): Promise<WoListResult> {
    const query: WoGridQuery = {
      page: 1,
      limit: 25,
      search: "",
      sortBy: "requestDate",
      sortDirection: "desc",
      view: null,
      filters: [],
      viewMode: "active",
    };
    return woListCache.getOrCreate(
      buildWoQueryCacheKey(session, { preset: "pendingApproval" }),
      async () => {
        const [listResult, references] = await Promise.all([
          this.repository.listPendingApproval({
            employeeId: session.user.employeeId,
            scope: session.user.scope,
          }),
          this.getReferences(session),
        ]);

        return {
          data: listResult.rows,
          meta: buildGridMeta(listResult.total, query.page, query.limit),
          references,
          query,
          summary: listResult.summary,
        };
      },
    );
  }

  async listMyDivision(session: WebSession): Promise<WoListResult> {
    const query: WoGridQuery = {
      page: 1,
      limit: 25,
      search: "",
      sortBy: "requestDate",
      sortDirection: "desc",
      view: null,
      filters: [],
      viewMode: "active",
    };
    return woListCache.getOrCreate(
      buildWoQueryCacheKey(session, { preset: "myDivision" }),
      async () => {
        const [listResult, references] = await Promise.all([
          this.repository.listMyDivision({
            employeeId: session.user.employeeId,
            scope: session.user.scope,
          }),
          this.getReferences(session),
        ]);

        return {
          data: listResult.rows,
          meta: buildGridMeta(listResult.total, query.page, query.limit),
          references,
          query,
          summary: listResult.summary,
        };
      },
    );
  }

  async listUrgent(session: WebSession): Promise<WoRecord[]> {
    return this.repository.listUrgent({
      employeeId: session.user.employeeId,
      scope: session.user.scope,
    });
  }

  async create(session: WebSession, input: WoCreateRequest): Promise<{ woId: string }> {
    const fromDivisionId = session.user.divisionId;
    if (!fromDivisionId) {
      throw new Error("MISSING_DIVISION");
    }

    const result = await this.repository.create(
      {
        actorId: session.user.employeeId,
        fromDivisionId,
      },
      input,
    );
    woListCache.clear();

    await this.auditService.log({
      actorId: session.user.employeeId,
      actorName: session.user.fullName,
      action: "wo.create",
      module: "wo",
      recordId: result.woId,
      newValue: {
        ...input,
        fromDivisionId,
      },
    });

    return result;
  }

  async update(session: WebSession, woId: string, input: WoCreateRequest): Promise<{ woId: string }> {
    const detail = await this.findDetail(session, woId);
    if (!detail) throw new Error("WO_NOT_FOUND");
    const result = await this.repository.update(woId, input);
    woListCache.clear();
    await this.auditService.log({
      actorId: session.user.employeeId,
      actorName: session.user.fullName,
      action: "wo.update",
      module: "wo",
      recordId: woId,
      oldValue: detail.ticket,
      newValue: input,
    });
    return result;
  }

  async findDetail(session: WebSession, woId: string): Promise<WoDetailResult | null> {
    const ticket = await this.repository.findById({
      employeeId: session.user.employeeId,
      scope: session.user.scope,
      woId,
    });
    if (!ticket) {
      return null;
    }

    return {
      ticket,
      linkedCountdowns: await this.repository.findLinkedCountdowns(woId),
    };
  }

  async approve(
    session: WebSession,
    woId: string,
    input: WoApproveRequest = { picId: null, estimatedHours: null, notes: null },
  ): Promise<WoMutationResult> {
    const detail = await this.findDetail(session, woId);
    if (!detail) {
      throw new Error("WO_NOT_FOUND");
    }

    const result = await this.repository.approveStage(
      {
        employeeId: session.user.employeeId,
        scope: session.user.scope,
        woId,
      },
      {
        actorId: session.user.employeeId,
        actorDivisionId: session.user.divisionId,
        approvalRank: session.user.roleProfile?.approvalRank ?? null,
        permissions: session.user.permissions,
        input,
      },
    );
    if (!result) {
      throw new Error("INVALID_STATUS_TRANSITION");
    }
    woListCache.clear();

    await this.auditService.log({
      actorId: session.user.employeeId,
      actorName: session.user.fullName,
      action: "wo.approve",
      module: "wo",
      recordId: woId,
      oldValue: {
        status: detail.ticket.status,
      },
      newValue: {
        status: result.status,
        linkedCountdownId: result.linkedCountdownId ?? null,
      },
    });

    return {
      woId,
      status: result.status,
      linkedCountdownId: result.linkedCountdownId ?? null,
    };
  }

  async reject(
    session: WebSession,
    woId: string,
    reason: string,
  ): Promise<WoMutationResult> {
    const detail = await this.findDetail(session, woId);
    if (!detail) {
      throw new Error("WO_NOT_FOUND");
    }

    if (!["OPEN", "SUBMITTED"].includes(detail.ticket.status)) {
      throw new Error("INVALID_STATUS_TRANSITION");
    }

    await this.repository.updateStatus(woId, "REJECTED", {
      actorId: session.user.employeeId,
      reason,
    });
    woListCache.clear();

    await this.auditService.log({
      actorId: session.user.employeeId,
      actorName: session.user.fullName,
      action: "wo.reject",
      module: "wo",
      recordId: woId,
      oldValue: {
        status: detail.ticket.status,
      },
      newValue: {
        status: "REJECTED",
        reason,
      },
    });

    return {
      woId,
      status: "REJECTED",
    };
  }

  async markDone(session: WebSession, woId: string): Promise<WoMutationResult> {
    const detail = await this.findDetail(session, woId);
    if (!detail) {
      throw new Error("WO_NOT_FOUND");
    }

    if (detail.ticket.status !== "APPROVED") {
      throw new Error("INVALID_STATUS_TRANSITION");
    }

    if (
      detail.linkedCountdowns.length === 0 ||
      !detail.linkedCountdowns.some((row) => row.status === "DONE")
    ) {
      throw new Error("COUNTDOWN_NOT_DONE");
    }

    await this.repository.updateStatus(woId, "DONE", {
      actorId: session.user.employeeId,
    });
    woListCache.clear();

    await this.auditService.log({
      actorId: session.user.employeeId,
      actorName: session.user.fullName,
      action: "wo.close",
      module: "wo",
      recordId: woId,
      oldValue: {
        status: detail.ticket.status,
      },
      newValue: {
        status: "DONE",
      },
    });

    return {
      woId,
      status: "DONE",
    };
  }

  async findLinkedCountdowns(
    session: WebSession,
    woId: string,
  ): Promise<WoLinkedCountdown[]> {
    const detail = await this.findDetail(session, woId);
    if (!detail) {
      throw new Error("WO_NOT_FOUND");
    }

    return detail.linkedCountdowns;
  }
}
