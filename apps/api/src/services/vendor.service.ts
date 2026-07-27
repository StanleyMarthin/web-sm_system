import type {
  ApproveVendorRequest,
  CancelVendorRequest,
  CreateVendorRequest,
  ReceiveVendorRequest,
  VendorGridQuery,
  VendorRecord,
  VendorStatusUpdateRequest,
  VendorSummary,
} from "@smsystem/contracts/vendor";
import type { AuditService } from "@/services/audit/audit.service";
import { DefaultAuditService } from "@/services/audit/audit.service";
import { TtlCache } from "@/lib/ttl-cache";
import { MySqlAuditRepository } from "@/repositories/audit.repo";
import { MySqlVendorRepository, type VendorRepository } from "@/repositories/vendor.repo";
import type { WebSession } from "@/services/auth/session.service";
import { buildGridMeta } from "@/services/grid/paginate";

interface VendorListResult {
  data: VendorRecord[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  references: Awaited<ReturnType<VendorRepository["listReferences"]>>;
  query: VendorGridQuery;
  summary: VendorSummary;
}

const VENDOR_STATUS_TRANSITIONS: Record<VendorRecord["status"], VendorRecord["status"][]> = {
  OPEN: ["SENT", "CANCELLED"],
  SENT: ["PROSES_VENDOR", "DONE_VENDOR", "REWORK_VENDOR", "CANCELLED"],
  PROSES_VENDOR: ["DONE_VENDOR", "REWORK_VENDOR", "CANCELLED"],
  DONE_VENDOR: ["RECEIVED", "REWORK_VENDOR"],
  RECEIVED: [],
  REWORK_VENDOR: ["SENT", "PROSES_VENDOR", "DONE_VENDOR", "CANCELLED"],
  REJECTED: [],
  CANCELLED: [],
};

const VENDOR_QUERY_CACHE_TTL_MS = 5_000;
const VENDOR_REFERENCE_CACHE_TTL_MS = 60_000;
const vendorListCache = new TtlCache<VendorListResult>(VENDOR_QUERY_CACHE_TTL_MS);
const vendorReferenceCache = new TtlCache<
  Awaited<ReturnType<VendorRepository["listReferences"]>>
>(VENDOR_REFERENCE_CACHE_TTL_MS);

function buildVendorScopeCacheKey(session: WebSession): string {
  return JSON.stringify({
    employeeId: session.user.employeeId,
    scope: session.user.scope,
  });
}

function buildVendorQueryCacheKey(
  session: WebSession,
  query: VendorGridQuery | { preset: string },
): string {
  return JSON.stringify({
    employeeId: session.user.employeeId,
    scope: session.user.scope,
    query,
  });
}

export interface VendorService {
  list(session: WebSession, query: VendorGridQuery): Promise<VendorListResult>;
  create(session: WebSession, input: CreateVendorRequest): Promise<{ wovId: string; accTracking: VendorRecord["accTracking"]; status: VendorRecord["status"] }>;
  update(session: WebSession, wovId: string, input: CreateVendorRequest): Promise<{ wovId: string; accTracking: VendorRecord["accTracking"]; status: VendorRecord["status"] }>;
  findDetail(session: WebSession, wovId: string): Promise<{ ticket: VendorRecord } | null>;
  approve(session: WebSession, wovId: string, input: ApproveVendorRequest): Promise<{ wovId: string; accTracking: VendorRecord["accTracking"]; status: VendorRecord["status"] }>;
  updateStatus(session: WebSession, wovId: string, input: VendorStatusUpdateRequest): Promise<{ wovId: string; accTracking: VendorRecord["accTracking"]; status: VendorRecord["status"] }>;
  receive(session: WebSession, wovId: string, input: ReceiveVendorRequest): Promise<{ wovId: string; accTracking: VendorRecord["accTracking"]; status: VendorRecord["status"] }>;
  cancel(session: WebSession, wovId: string, input: CancelVendorRequest): Promise<{ wovId: string; accTracking: VendorRecord["accTracking"]; status: VendorRecord["status"] }>;
}

export class DefaultVendorService implements VendorService {
  constructor(
    private readonly repository: VendorRepository = new MySqlVendorRepository(),
    private readonly auditService: AuditService = new DefaultAuditService(
      new MySqlAuditRepository(),
    ),
  ) {}

  private getReferences(session: WebSession) {
    return vendorReferenceCache.getOrCreate(
      buildVendorScopeCacheKey(session),
      () =>
        this.repository.listReferences({
          employeeId: session.user.employeeId,
          scope: session.user.scope,
        }),
    );
  }

  async list(session: WebSession, query: VendorGridQuery): Promise<VendorListResult> {
    return vendorListCache.getOrCreate(
      buildVendorQueryCacheKey(session, query),
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

  async create(
    session: WebSession,
    input: CreateVendorRequest,
  ): Promise<{ wovId: string; accTracking: VendorRecord["accTracking"]; status: VendorRecord["status"] }> {
    const divisionName = session.user.divisionName ?? "";
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
    vendorListCache.clear();

    await this.auditService.log({
      actorId: session.user.employeeId,
      actorName: session.user.fullName,
      action: "vendor.create",
      module: "vendor",
      recordId: result.wovId,
      newValue: input,
    });

    return result;
  }

  async update(
    session: WebSession,
    wovId: string,
    input: CreateVendorRequest,
  ): Promise<{ wovId: string; accTracking: VendorRecord["accTracking"]; status: VendorRecord["status"] }> {
    const detail = await this.findDetail(session, wovId);
    if (!detail) throw new Error("VENDOR_WO_NOT_FOUND");
    const result = await this.repository.update(wovId, input);
    vendorListCache.clear();
    await this.auditService.log({
      actorId: session.user.employeeId,
      actorName: session.user.fullName,
      action: "vendor.update",
      module: "vendor",
      recordId: wovId,
      oldValue: detail.ticket,
      newValue: input,
    });
    return result;
  }

  async findDetail(session: WebSession, wovId: string): Promise<{ ticket: VendorRecord } | null> {
    return this.repository.findById({
      employeeId: session.user.employeeId,
      scope: session.user.scope,
      wovId,
    });
  }

  async approve(
    session: WebSession,
    wovId: string,
    input: ApproveVendorRequest,
  ): Promise<{ wovId: string; accTracking: VendorRecord["accTracking"]; status: VendorRecord["status"] }> {
    const detail = await this.findDetail(session, wovId);
    if (!detail) {
      throw new Error("VENDOR_WO_NOT_FOUND");
    }

    if (detail.ticket.accTracking === "APPROVED" || ["RECEIVED", "REJECTED", "CANCELLED"].includes(detail.ticket.status)) {
      throw new Error("INVALID_APPROVAL_STATE");
    }

    const result = await this.repository.advanceApproval(wovId, input.notes ?? null);
    vendorListCache.clear();
    await this.auditService.log({
      actorId: session.user.employeeId,
      actorName: session.user.fullName,
      action: "vendor.approve",
      module: "vendor",
      recordId: wovId,
      oldValue: {
        accTracking: detail.ticket.accTracking,
        status: detail.ticket.status,
      },
      newValue: result,
    });
    return result;
  }

  async updateStatus(
    session: WebSession,
    wovId: string,
    input: VendorStatusUpdateRequest,
  ): Promise<{ wovId: string; accTracking: VendorRecord["accTracking"]; status: VendorRecord["status"] }> {
    const detail = await this.findDetail(session, wovId);
    if (!detail) {
      throw new Error("VENDOR_WO_NOT_FOUND");
    }

    if (detail.ticket.accTracking !== "APPROVED") {
      throw new Error("VENDOR_WO_NOT_APPROVED");
    }

    const allowedStatuses = VENDOR_STATUS_TRANSITIONS[detail.ticket.status] ?? [];
    if (!allowedStatuses.includes(input.status)) {
      throw new Error("INVALID_STATUS_TRANSITION");
    }

    const result = await this.repository.updateStatus(wovId, input);
    vendorListCache.clear();
    await this.auditService.log({
      actorId: session.user.employeeId,
      actorName: session.user.fullName,
      action: "vendor.update-status",
      module: "vendor",
      recordId: wovId,
      oldValue: {
        status: detail.ticket.status,
      },
      newValue: result,
    });
    return result;
  }

  async receive(
    session: WebSession,
    wovId: string,
    input: ReceiveVendorRequest,
  ): Promise<{ wovId: string; accTracking: VendorRecord["accTracking"]; status: VendorRecord["status"] }> {
    const detail = await this.findDetail(session, wovId);
    if (!detail) {
      throw new Error("VENDOR_WO_NOT_FOUND");
    }

    if (detail.ticket.accTracking !== "APPROVED") {
      throw new Error("VENDOR_WO_NOT_APPROVED");
    }

    if (!["SENT", "PROSES_VENDOR", "DONE_VENDOR"].includes(detail.ticket.status)) {
      throw new Error("INVALID_STATUS_TRANSITION");
    }

    const result = await this.repository.receive(wovId, input);
    vendorListCache.clear();
    await this.auditService.log({
      actorId: session.user.employeeId,
      actorName: session.user.fullName,
      action: "vendor.receive",
      module: "vendor",
      recordId: wovId,
      oldValue: {
        status: detail.ticket.status,
      },
      newValue: result,
    });
    return result;
  }

  async cancel(
    session: WebSession,
    wovId: string,
    input: CancelVendorRequest,
  ): Promise<{ wovId: string; accTracking: VendorRecord["accTracking"]; status: VendorRecord["status"] }> {
    const detail = await this.findDetail(session, wovId);
    if (!detail) {
      throw new Error("VENDOR_WO_NOT_FOUND");
    }

    if (detail.ticket.status === "RECEIVED") {
      throw new Error("INVALID_STATUS_TRANSITION");
    }

    const result = await this.repository.cancel(wovId, input.reason);
    vendorListCache.clear();
    await this.auditService.log({
      actorId: session.user.employeeId,
      actorName: session.user.fullName,
      action: "vendor.cancel",
      module: "vendor",
      recordId: wovId,
      oldValue: {
        status: detail.ticket.status,
      },
      newValue: result,
    });
    return result;
  }
}
