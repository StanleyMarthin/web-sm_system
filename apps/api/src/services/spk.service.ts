import type {
  SpkApprovalState,
  SpkDraftDetailUpdateRequest,
  SpkDetailRecord,
  SpkGenerateRequest,
  SpkGridQuery,
  SpkHeaderRecord,
  SpkPreviewRecord,
  SpkStatus,
  SpkSummary,
} from "@smsystem/contracts/spk";
import type { AuditService } from "@/services/audit/audit.service";
import { DefaultAuditService } from "@/services/audit/audit.service";
import { MySqlAuditRepository } from "@/repositories/audit.repo";
import {
  MySqlSpkRepository,
  type SpkRepository,
} from "@/repositories/spk.repo";
import type { WebSession } from "@/services/auth/session.service";

interface SpkListResult {
  data: SpkHeaderRecord[];
  storageReady?: boolean;
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  query: SpkGridQuery;
  summary: SpkSummary;
}

interface SpkDetailResult {
  header: SpkHeaderRecord;
  details: SpkDetailRecord[];
}

interface SpkMutationResult {
  spkId: string;
  status: SpkStatus;
}

interface SpkItemApprovalResult {
  spkId: string;
  detailId: string;
  approvalState: SpkApprovalState;
}

interface SpkDraftDetailUpdateResult {
  spkId: string;
  detailCount: number;
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

function requireGlobalScope(session: WebSession) {
  if (!session.user.scope.canViewAllUnits) {
    throw new Error("SCOPE_FORBIDDEN");
  }
}

function getApprovalRank(session: WebSession): number {
  return session.user.roleProfile?.approvalRank ?? 0;
}

function requireMinimumApprovalRank(
  session: WebSession,
  minimumRank: number,
  errorCode = "APPROVAL_RANK_FORBIDDEN",
) {
  if (getApprovalRank(session) < minimumRank) {
    throw new Error(errorCode);
  }
}

function buildPlannerAllocationKey(unitName: string, divisionName: string): string {
  return `${unitName.trim()}::${divisionName.trim()}`;
}

export interface SpkService {
  list(session: WebSession, query: SpkGridQuery): Promise<SpkListResult>;
  preview(
    session: WebSession,
    date: string,
  ): Promise<{ rows: SpkPreviewRecord[]; totalUnits: number; totalHours: number }>;
  generate(session: WebSession, input: SpkGenerateRequest): Promise<{ spkId: string }>;
  findDetail(session: WebSession, spkId: string): Promise<SpkDetailResult | null>;
  submit(session: WebSession, spkId: string): Promise<SpkMutationResult>;
  approve(session: WebSession, spkId: string): Promise<SpkMutationResult>;
  reject(session: WebSession, spkId: string, reason: string): Promise<SpkMutationResult>;
  activate(session: WebSession, spkId: string): Promise<SpkMutationResult>;
  markDone(session: WebSession, spkId: string): Promise<SpkMutationResult>;
  approveItem(
    session: WebSession,
    spkId: string,
    detailId: string,
    input: { isApproved: boolean; note: string | null },
  ): Promise<SpkItemApprovalResult>;
  updateDraftDetails(
    session: WebSession,
    spkId: string,
    input: SpkDraftDetailUpdateRequest,
  ): Promise<SpkDraftDetailUpdateResult>;
  today(session: WebSession): Promise<SpkHeaderRecord[]>;
  summary(session: WebSession): Promise<SpkSummary>;
}

export class DefaultSpkService implements SpkService {
  constructor(
    private readonly repository: SpkRepository = new MySqlSpkRepository(),
    private readonly auditService: AuditService = new DefaultAuditService(
      new MySqlAuditRepository(),
    ),
  ) {}

  async list(session: WebSession, query: SpkGridQuery): Promise<SpkListResult> {
    const [listResult, summary] = await Promise.all([
      this.repository.list({
        employeeId: session.user.employeeId,
        scope: session.user.scope,
        query,
      }),
      this.repository.summary({
        employeeId: session.user.employeeId,
        scope: session.user.scope,
      }),
    ]);

    return {
      data: listResult.rows,
      storageReady: listResult.storageReady,
      meta: buildMeta(query.page, query.limit, listResult.total),
      query,
      summary,
    };
  }

  async preview(
    session: WebSession,
    date: string,
  ): Promise<{ rows: SpkPreviewRecord[]; totalUnits: number; totalHours: number }> {
    return this.repository.preview({
      employeeId: session.user.employeeId,
      scope: session.user.scope,
      date,
    });
  }

  async generate(
    session: WebSession,
    input: SpkGenerateRequest,
  ): Promise<{ spkId: string }> {
    requireGlobalScope(session);

    const existing = await this.repository.findExistingByDate(input.spkDate);
    if (existing) {
      throw new Error("SPK_ALREADY_EXISTS");
    }

    const result = await this.repository.generate(
      {
        actorId: session.user.employeeId,
        actorName: session.user.fullName,
      },
      input,
    );

    await this.auditService.log({
      actorId: session.user.employeeId,
      actorName: session.user.fullName,
      action: "spk.create",
      module: "spk",
      recordId: result.spkId,
      newValue: input,
    });

    return result;
  }

  async findDetail(
    session: WebSession,
    spkId: string,
  ): Promise<SpkDetailResult | null> {
    return this.repository.findDetail({
      employeeId: session.user.employeeId,
      scope: session.user.scope,
      spkId,
    });
  }

  async submit(session: WebSession, spkId: string): Promise<SpkMutationResult> {
    requireGlobalScope(session);
    const detail = await this.findDetail(session, spkId);
    if (!detail) {
      throw new Error("SPK_NOT_FOUND");
    }

    if (detail.header.status !== "DRAFT") {
      throw new Error("INVALID_STATUS_TRANSITION");
    }

    await this.repository.updateHeaderStatus(spkId, "SUBMITTED", {
      actorId: session.user.employeeId,
      actorName: session.user.fullName,
    });

    await this.auditService.log({
      actorId: session.user.employeeId,
      actorName: session.user.fullName,
      action: "spk.submit",
      module: "spk",
      recordId: spkId,
      oldValue: {
        status: detail.header.status,
      },
      newValue: {
        status: "SUBMITTED",
      },
    });

    return { spkId, status: "SUBMITTED" };
  }

  async approve(session: WebSession, spkId: string): Promise<SpkMutationResult> {
    requireGlobalScope(session);
    const detail = await this.findDetail(session, spkId);
    if (!detail) {
      throw new Error("SPK_NOT_FOUND");
    }

    if (detail.header.status !== "SUBMITTED") {
      throw new Error("INVALID_STATUS_TRANSITION");
    }

    if (detail.details.some((item) => item.approvalState === "PENDING")) {
      throw new Error("SPK_PENDING_ITEMS");
    }

    if (!detail.details.some((item) => item.approvalState === "APPROVED")) {
      throw new Error("NO_APPROVED_ITEMS");
    }

    await this.repository.updateHeaderStatus(spkId, "APPROVED", {
      actorId: session.user.employeeId,
      actorName: session.user.fullName,
    });

    await this.auditService.log({
      actorId: session.user.employeeId,
      actorName: session.user.fullName,
      action: "spk.approve",
      module: "spk",
      recordId: spkId,
      oldValue: {
        status: detail.header.status,
      },
      newValue: {
        status: "APPROVED",
      },
    });

    return { spkId, status: "APPROVED" };
  }

  async reject(
    session: WebSession,
    spkId: string,
    reason: string,
  ): Promise<SpkMutationResult> {
    requireGlobalScope(session);
    const detail = await this.findDetail(session, spkId);
    if (!detail) {
      throw new Error("SPK_NOT_FOUND");
    }

    if (detail.header.status !== "SUBMITTED") {
      throw new Error("INVALID_STATUS_TRANSITION");
    }

    await this.repository.updateHeaderStatus(spkId, "REJECTED", {
      actorId: session.user.employeeId,
      actorName: session.user.fullName,
      reason,
    });

    await this.auditService.log({
      actorId: session.user.employeeId,
      actorName: session.user.fullName,
      action: "spk.reject",
      module: "spk",
      recordId: spkId,
      oldValue: {
        status: detail.header.status,
      },
      newValue: {
        status: "REJECTED",
        reason,
      },
    });

    return { spkId, status: "REJECTED" };
  }

  async activate(session: WebSession, spkId: string): Promise<SpkMutationResult> {
    requireMinimumApprovalRank(session, 1, "SPK_START_FORBIDDEN");
    const detail = await this.findDetail(session, spkId);
    if (!detail) {
      throw new Error("SPK_NOT_FOUND");
    }

    const isPlannerDraft =
      detail.header.status === "DRAFT" &&
      detail.header.plannerMeta?.source === "WEEKLY_PLANNER";

    if (!isPlannerDraft && detail.header.status !== "APPROVED") {
      throw new Error("INVALID_STATUS_TRANSITION");
    }

    let lockedPlanIds: string[] = [];
    if (!isPlannerDraft) {
      const fallbackLockedPlanIds = detail.details
        .filter((item) => item.approvalState === "APPROVED")
        .map((item) => item.planId)
        .filter((planId): planId is string => Boolean(planId));
      lockedPlanIds =
        (await this.repository.lockPlansForActivation(spkId)) ?? fallbackLockedPlanIds;
      if (lockedPlanIds.length === 0) {
        throw new Error("NO_APPROVED_ITEMS");
      }
    }

    await this.repository.updateHeaderStatus(spkId, "ACTIVE", {
      actorId: session.user.employeeId,
      actorName: session.user.fullName,
    });

    await this.auditService.log({
      actorId: session.user.employeeId,
      actorName: session.user.fullName,
      action: "spk.activate",
      module: "spk",
      recordId: spkId,
      oldValue: {
        status: detail.header.status,
      },
      newValue: {
        status: "ACTIVE",
        activationMode: isPlannerDraft ? "planner_direct_start" : "approved_lock",
        lockedPlanIds,
      },
    });

    return { spkId, status: "ACTIVE" };
  }

  async markDone(session: WebSession, spkId: string): Promise<SpkMutationResult> {
    requireGlobalScope(session);
    const detail = await this.findDetail(session, spkId);
    if (!detail) {
      throw new Error("SPK_NOT_FOUND");
    }

    if (detail.header.status !== "ACTIVE") {
      throw new Error("INVALID_STATUS_TRANSITION");
    }

    await this.repository.updateHeaderStatus(spkId, "DONE", {
      actorId: session.user.employeeId,
      actorName: session.user.fullName,
    });

    await this.auditService.log({
      actorId: session.user.employeeId,
      actorName: session.user.fullName,
      action: "spk.done",
      module: "spk",
      recordId: spkId,
      oldValue: {
        status: detail.header.status,
      },
      newValue: {
        status: "DONE",
      },
    });

    return { spkId, status: "DONE" };
  }

  async approveItem(
    session: WebSession,
    spkId: string,
    detailId: string,
    input: { isApproved: boolean; note: string | null },
  ): Promise<SpkItemApprovalResult> {
    requireGlobalScope(session);
    const detail = await this.findDetail(session, spkId);
    if (!detail) {
      throw new Error("SPK_NOT_FOUND");
    }

    if (detail.header.status !== "SUBMITTED") {
      throw new Error("INVALID_STATUS_TRANSITION");
    }

    const currentItem = detail.details.find((item) => item.detailId === detailId);
    if (!currentItem) {
      throw new Error("SPK_DETAIL_NOT_FOUND");
    }

    await this.repository.updateItemApproval(spkId, detailId, {
      ...input,
      actorId: session.user.employeeId,
      actorName: session.user.fullName,
    });

    const approvalState: SpkApprovalState = input.isApproved ? "APPROVED" : "REJECTED";
    await this.auditService.log({
      actorId: session.user.employeeId,
      actorName: session.user.fullName,
      action: "spk.item_approval",
      module: "spk",
      recordId: detailId,
      oldValue: {
        approvalState: currentItem.approvalState,
      },
      newValue: {
        approvalState,
        note: input.note,
      },
    });

    return {
      spkId,
      detailId,
      approvalState,
    };
  }

  async updateDraftDetails(
    session: WebSession,
    spkId: string,
    input: SpkDraftDetailUpdateRequest,
  ): Promise<SpkDraftDetailUpdateResult> {
    requireMinimumApprovalRank(session, 3, "SPK_BREAKDOWN_FORBIDDEN");
    const detail = await this.findDetail(session, spkId);
    if (!detail) {
      throw new Error("SPK_NOT_FOUND");
    }

    if (detail.header.status !== "DRAFT") {
      throw new Error("SPK_DRAFT_ONLY");
    }

    const plannerMeta = detail.header.plannerMeta;
    if (!plannerMeta || plannerMeta.source !== "WEEKLY_PLANNER") {
      throw new Error("SPK_DRAFT_ONLY");
    }

    const budgetByAllocation = new Map(
      plannerMeta.allocations.map((allocation) => [
        buildPlannerAllocationKey(allocation.unitName, allocation.divisionName),
        allocation.targetHours,
      ]),
    );
    const usageByAllocation = new Map<string, number>();

    for (const row of input.rows) {
      const allocationKey = buildPlannerAllocationKey(
        row.unitNameSnapshot,
        row.divisionNameSnapshot,
      );
      const budget = budgetByAllocation.get(allocationKey);
      if (budget === undefined) {
        throw new Error("SPK_DETAIL_SCOPE_MISMATCH");
      }

      usageByAllocation.set(
        allocationKey,
        Number(
          (
            (usageByAllocation.get(allocationKey) ?? 0) + row.targetHoursSnapshot
          ).toFixed(2),
        ),
      );
    }

    for (const [allocationKey, usedHours] of usageByAllocation.entries()) {
      const budget = budgetByAllocation.get(allocationKey);
      if (budget === undefined) {
        throw new Error("SPK_DETAIL_SCOPE_MISMATCH");
      }

      if (usedHours > budget + 0.001) {
        throw new Error("SPK_OVER_BUDGET");
      }
    }

    await this.repository.replaceDraftDetails(spkId, input.rows);

    await this.auditService.log({
      actorId: session.user.employeeId,
      actorName: session.user.fullName,
      action: "spk.update_draft_details",
      module: "spk",
      recordId: spkId,
      oldValue: {
        detailCount: detail.details.length,
      },
      newValue: {
        detailCount: input.rows.length,
      },
    });

    return {
      spkId,
      detailCount: input.rows.length,
    };
  }

  async today(session: WebSession): Promise<SpkHeaderRecord[]> {
    return this.repository.today({
      employeeId: session.user.employeeId,
      scope: session.user.scope,
    });
  }

  async summary(session: WebSession): Promise<SpkSummary> {
    return this.repository.summary({
      employeeId: session.user.employeeId,
      scope: session.user.scope,
    });
  }
}
