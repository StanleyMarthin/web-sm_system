import type {
  ApprovePrRequest,
  CancelPrRequest,
  CreatePrRequest,
  OrderPrRequest,
  PrGridQuery,
  PrItemRecord,
  PrRecord,
  PrSummary,
  ReceivePrRequest,
} from "@smsystem/contracts/pr";
import type { AuditService } from "@/services/audit/audit.service";
import { DefaultAuditService } from "@/services/audit/audit.service";
import { TtlCache } from "@/lib/ttl-cache";
import { MySqlAuditRepository } from "@/repositories/audit.repo";
import { MySqlPrRepository, type PrRepository } from "@/repositories/pr.repo";
import type { WebSession } from "@/services/auth/session.service";
import { buildGridMeta } from "@/services/grid/paginate";
import { permissionCodes } from "@smsystem/permissions";
import {
  notifyMobileEmployees,
  resolveEmployeeIdsByPermission,
} from "@/services/mobile-notification.service";

interface PrListResult {
  data: PrRecord[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  references: Awaited<ReturnType<PrRepository["listReferences"]>>;
  query: PrGridQuery;
  summary: PrSummary;
}

const PR_QUERY_CACHE_TTL_MS = 5_000;
const PR_REFERENCE_CACHE_TTL_MS = 60_000;
const prListCache = new TtlCache<PrListResult>(PR_QUERY_CACHE_TTL_MS);
const prReferenceCache = new TtlCache<
  Awaited<ReturnType<PrRepository["listReferences"]>>
>(PR_REFERENCE_CACHE_TTL_MS);
const prCriticalCache = new TtlCache<PrRecord[]>(PR_QUERY_CACHE_TTL_MS);

function buildPrScopeCacheKey(session: WebSession): string {
  return JSON.stringify({
    employeeId: session.user.employeeId,
    scope: session.user.scope,
  });
}

function buildPrQueryCacheKey(
  session: WebSession,
  query: PrGridQuery | { preset: string },
): string {
  return JSON.stringify({
    employeeId: session.user.employeeId,
    scope: session.user.scope,
    query,
  });
}

async function notifyPr(
  employeeIds: string[],
  prId: string,
  title: string,
  body: string,
  status: string,
): Promise<void> {
  await notifyMobileEmployees(employeeIds, {
    title,
    body,
    data: { module: "pr", reqId: prId, status },
  }, "sm_pr");
}

async function notifyPrApprovers(prId: string, body: string, status: string): Promise<void> {
  await notifyPr(
    await resolveEmployeeIdsByPermission(permissionCodes.prApprove),
    prId,
    "Approval Purchase Request",
    body,
    status,
  );
}

export interface PrService {
  list(session: WebSession, query: PrGridQuery): Promise<PrListResult>;
  listCritical(session: WebSession): Promise<PrRecord[]>;
  create(session: WebSession, input: CreatePrRequest): Promise<{ prId: string; accTracking: PrRecord["accTracking"]; status: PrRecord["status"] }>;
  update(session: WebSession, prId: string, input: CreatePrRequest): Promise<{ prId: string; accTracking: PrRecord["accTracking"]; status: PrRecord["status"] }>;
  findDetail(session: WebSession, prId: string): Promise<{ header: PrRecord; items: PrItemRecord[] } | null>;
  approve(session: WebSession, prId: string, input: ApprovePrRequest): Promise<{ prId: string; accTracking: PrRecord["accTracking"]; status: PrRecord["status"] }>;
  order(session: WebSession, prId: string, input: OrderPrRequest): Promise<{ prId: string; accTracking: PrRecord["accTracking"]; status: PrRecord["status"] }>;
  receive(session: WebSession, prId: string, input: ReceivePrRequest): Promise<{ prId: string; accTracking: PrRecord["accTracking"]; status: PrRecord["status"] }>;
  cancel(session: WebSession, prId: string, input: CancelPrRequest): Promise<{ prId: string; accTracking: PrRecord["accTracking"]; status: PrRecord["status"] }>;
}

export class DefaultPrService implements PrService {
  constructor(
    private readonly repository: PrRepository = new MySqlPrRepository(),
    private readonly auditService: AuditService = new DefaultAuditService(
      new MySqlAuditRepository(),
    ),
  ) {}

  private getReferences(session: WebSession) {
    return prReferenceCache.getOrCreate(
      buildPrScopeCacheKey(session),
      () =>
        this.repository.listReferences({
          employeeId: session.user.employeeId,
          scope: session.user.scope,
        }),
    );
  }

  async list(session: WebSession, query: PrGridQuery): Promise<PrListResult> {
    return prListCache.getOrCreate(
      buildPrQueryCacheKey(session, query),
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

  async listCritical(session: WebSession): Promise<PrRecord[]> {
    return prCriticalCache.getOrCreate(
      buildPrQueryCacheKey(session, { preset: "critical" }),
      () =>
        this.repository.listCritical({
          employeeId: session.user.employeeId,
          scope: session.user.scope,
        }),
    );
  }

  async create(
    session: WebSession,
    input: CreatePrRequest,
  ): Promise<{ prId: string; accTracking: PrRecord["accTracking"]; status: PrRecord["status"] }> {
    const divisionName = input.divisionName ?? session.user.divisionName ?? "";
    if (!divisionName) {
      throw new Error("MISSING_DIVISION");
    }

    const result = await this.repository.create(
      {
        actorId: session.user.employeeId,
        actorName: session.user.fullName,
        divisionName,
      },
      input,
    );
    prListCache.clear();
    prCriticalCache.clear();

    await this.auditService.log({
      actorId: session.user.employeeId,
      actorName: session.user.fullName,
      action: "pr.create",
      module: "pr",
      recordId: result.prId,
      newValue: input,
    });

    await notifyPrApprovers(
      result.prId,
      `PR baru ${result.prId} menunggu persetujuan Anda.`,
      result.accTracking,
    );

    return result;
  }

  async update(
    session: WebSession,
    prId: string,
    input: CreatePrRequest,
  ): Promise<{ prId: string; accTracking: PrRecord["accTracking"]; status: PrRecord["status"] }> {
    const detail = await this.findDetail(session, prId);
    if (!detail) throw new Error("PR_NOT_FOUND");
    const result = await this.repository.update(prId, input);
    prListCache.clear();
    prCriticalCache.clear();
    await this.auditService.log({
      actorId: session.user.employeeId,
      actorName: session.user.fullName,
      action: "pr.update",
      module: "pr",
      recordId: prId,
      oldValue: detail,
      newValue: input,
    });
    if (result.accTracking === "APPROVED") {
      await notifyPr(
        [detail.header.requestedBy], prId, "Update Purchase Request",
        `PR ${detail.header.prNumber} telah diperbarui.`, result.status,
      );
    } else {
      await notifyPrApprovers(
        prId,
        `PR ${detail.header.prNumber} diperbarui dan menunggu persetujuan.`,
        result.accTracking,
      );
    }
    return result;
  }

  async findDetail(
    session: WebSession,
    prId: string,
  ): Promise<{ header: PrRecord; items: PrItemRecord[] } | null> {
    return this.repository.findById({
      employeeId: session.user.employeeId,
      scope: session.user.scope,
      prId,
    });
  }

  async approve(
    session: WebSession,
    prId: string,
    input: ApprovePrRequest,
  ): Promise<{ prId: string; accTracking: PrRecord["accTracking"]; status: PrRecord["status"] }> {
    const detail = await this.findDetail(session, prId);
    if (!detail) {
      throw new Error("PR_NOT_FOUND");
    }

    if (detail.header.accTracking === "APPROVED" || ["ARRIVED", "REJECTED", "CANCELLED"].includes(detail.header.status)) {
      throw new Error("INVALID_APPROVAL_STATE");
    }

    const result = await this.repository.advanceApproval(prId, input.notes ?? null);
    prListCache.clear();
    prCriticalCache.clear();
    await this.auditService.log({
      actorId: session.user.employeeId,
      actorName: session.user.fullName,
      action: "pr.approve",
      module: "pr",
      recordId: prId,
      oldValue: {
        accTracking: detail.header.accTracking,
        status: detail.header.status,
      },
      newValue: result,
    });
    if (result.accTracking === "APPROVED") {
      await notifyPr(
        [detail.header.requestedBy],
        prId,
        "Purchase Request Disetujui",
        `PR ${detail.header.prNumber} telah disetujui.`,
        result.status,
      );
    } else {
      await notifyPrApprovers(
        prId,
        `PR ${detail.header.prNumber} menunggu persetujuan tahap berikutnya.`,
        result.accTracking,
      );
    }
    return result;
  }

  async order(
    session: WebSession,
    prId: string,
    input: OrderPrRequest,
  ): Promise<{ prId: string; accTracking: PrRecord["accTracking"]; status: PrRecord["status"] }> {
    const detail = await this.findDetail(session, prId);
    if (!detail) {
      throw new Error("PR_NOT_FOUND");
    }

    if (detail.header.accTracking !== "APPROVED") {
      throw new Error("PR_NOT_APPROVED");
    }

    if (!["OPEN", "HUNTING", "ORDERED"].includes(detail.header.status)) {
      throw new Error("INVALID_STATUS_TRANSITION");
    }

    const result = await this.repository.markOrdered(prId, input);
    prListCache.clear();
    prCriticalCache.clear();
    await this.auditService.log({
      actorId: session.user.employeeId,
      actorName: session.user.fullName,
      action: "pr.order",
      module: "pr",
      recordId: prId,
      oldValue: {
        status: detail.header.status,
      },
      newValue: result,
    });
    await notifyPr(
      [detail.header.requestedBy], prId, "Update Purchase Request",
      `PR ${detail.header.prNumber} telah dipesan.`, result.status,
    );
    return result;
  }

  async receive(
    session: WebSession,
    prId: string,
    input: ReceivePrRequest,
  ): Promise<{ prId: string; accTracking: PrRecord["accTracking"]; status: PrRecord["status"] }> {
    const detail = await this.findDetail(session, prId);
    if (!detail) {
      throw new Error("PR_NOT_FOUND");
    }

    if (detail.header.accTracking !== "APPROVED") {
      throw new Error("PR_NOT_APPROVED");
    }

    if (!["HUNTING", "ORDERED"].includes(detail.header.status)) {
      throw new Error("INVALID_STATUS_TRANSITION");
    }

    const result = await this.repository.markReceived(prId, input);
    prListCache.clear();
    prCriticalCache.clear();
    await this.auditService.log({
      actorId: session.user.employeeId,
      actorName: session.user.fullName,
      action: "pr.receive",
      module: "pr",
      recordId: prId,
      oldValue: {
        status: detail.header.status,
      },
      newValue: result,
    });
    await notifyPr(
      [detail.header.requestedBy], prId, "Purchase Request Tiba",
      `Barang PR ${detail.header.prNumber} telah diterima.`, result.status,
    );
    return result;
  }

  async cancel(
    session: WebSession,
    prId: string,
    input: CancelPrRequest,
  ): Promise<{ prId: string; accTracking: PrRecord["accTracking"]; status: PrRecord["status"] }> {
    const detail = await this.findDetail(session, prId);
    if (!detail) {
      throw new Error("PR_NOT_FOUND");
    }

    if (detail.header.status === "ARRIVED") {
      throw new Error("INVALID_STATUS_TRANSITION");
    }

    const result = await this.repository.cancel(prId, input.reason);
    prListCache.clear();
    prCriticalCache.clear();
    await this.auditService.log({
      actorId: session.user.employeeId,
      actorName: session.user.fullName,
      action: "pr.cancel",
      module: "pr",
      recordId: prId,
      oldValue: {
        status: detail.header.status,
      },
      newValue: result,
    });
    await notifyPr(
      [detail.header.requestedBy], prId, "Purchase Request Dibatalkan",
      `PR ${detail.header.prNumber} dibatalkan: ${input.reason}`, result.status,
    );
    return result;
  }
}
