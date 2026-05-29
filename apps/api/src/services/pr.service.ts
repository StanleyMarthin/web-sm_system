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

function buildMeta(page: number, limit: number, total: number) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
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

export interface PrService {
  list(session: WebSession, query: PrGridQuery): Promise<PrListResult>;
  listCritical(session: WebSession): Promise<PrRecord[]>;
  create(session: WebSession, input: CreatePrRequest): Promise<{ prId: string; accTracking: PrRecord["accTracking"]; status: PrRecord["status"] }>;
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
          meta: buildMeta(query.page, query.limit, listResult.total),
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
    return result;
  }
}
