import { extname } from "node:path";
import type {
  CreateWarehouseStockAdjustment,
  CreateWarehouseStockOpname,
  CreateWarehouseStorageLocation,
  CreateWarehouseRequest,
  WarehouseApproveRequest,
  WarehouseDashboardDivisionUsageRecord,
  WarehouseDashboardLateUserRecord,
  WarehouseDashboardLowStockRecord,
  WarehouseDashboardMaterialOutRecord,
  WarehouseDashboardSummary,
  WarehouseItemCategory,
  WarehouseMutationResult,
  WarehouseRequestJobOption,
  WarehouseRequestStockCardOption,
  WarehouseReadyRequest,
  WarehouseRejectRequest,
  WarehouseIssueRequest,
  WarehouseReturnRequest,
  WarehouseStoreRequest,
  WarehouseStockAdjustmentMutationResult,
  WarehouseStockOpnameMutationResult,
  WarehouseStorageLocationRecord,
  WarehouseTransactionQuery,
  WarehouseTransactionRecord,
  WarehouseTransactionsSummary,
  UpdateWarehouseStorageLocation,
} from "@smsystem/contracts/warehouse";
import { getApiEnv } from "@/config/env";
import type { AuditService } from "@/services/audit/audit.service";
import { DefaultAuditService } from "@/services/audit/audit.service";
import { MySqlAuditRepository } from "@/repositories/audit.repo";
import {
  MySqlWarehouseRepository,
  type WarehouseRepository,
} from "@/repositories/warehouse.repo";
import { S3GalleryUploadTicketProvider } from "@/services/storage/r2-upload.service";
import type { WebSession } from "@/services/auth/session.service";
import { TtlCache } from "@/lib/ttl-cache";

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

function nextApprovalStage(
  itemCategory: WarehouseItemCategory,
  currentStage: WarehouseTransactionRecord["approvalStatus"],
): WarehouseTransactionRecord["approvalStatus"] {
  if (currentStage === "PENDING_KD") {
    if (itemCategory === "TOOLS" || itemCategory === "CONSUMABLE") {
      return "APPROVED";
    }

    return "PENDING_KEPALA_GUDANG";
  }

  if (currentStage === "PENDING_KEPALA_GUDANG") {
    if (itemCategory === "SPARE_PART" || itemCategory === "BAHAN") {
      return "PENDING_PPIC";
    }

    return "APPROVED";
  }

  if (currentStage === "PENDING_PPIC") {
    return "APPROVED";
  }

  return currentStage;
}

function sanitizePath(value: string): string {
  return value
    .replaceAll("/", "-")
    .replaceAll(/[^\w\- ]/gu, "_")
    .trim();
}

function inferFileExtension(filename: string, contentType: string): string {
  const byName = extname(filename).replace(".", "").trim().toLowerCase();
  if (byName) {
    return byName;
  }

  if (contentType.includes("png")) {
    return "png";
  }

  if (contentType.includes("webp")) {
    return "webp";
  }

  return "jpg";
}

interface WarehouseListResult<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  query: WarehouseTransactionQuery;
}

interface WarehouseTransactionsResult extends WarehouseListResult<WarehouseTransactionRecord> {
  references: Awaited<ReturnType<WarehouseRepository["listTransactionReferences"]>>;
  summary: WarehouseTransactionsSummary;
}

export interface WarehouseUploadTicketProvider {
  createTicket(input: {
    objectKey: string;
    contentType: string;
  }): Promise<{
    uploadUrl: string;
    publicUrl: string;
    objectKey: string;
  }>;
}

export interface WarehouseService {
  getDashboard(session: WebSession): Promise<{
    summary: WarehouseDashboardSummary;
    lateUsers: WarehouseDashboardLateUserRecord[];
    divisionsUsing: WarehouseDashboardDivisionUsageRecord[];
    materialsOut: WarehouseDashboardMaterialOutRecord[];
    lowStockAlerts: WarehouseDashboardLowStockRecord[];
  }>;
  listTransactions(
    session: WebSession,
    query: WarehouseTransactionQuery,
  ): Promise<WarehouseTransactionsResult>;
  listPendingApproval(session: WebSession): Promise<WarehouseTransactionRecord[]>;
  listRequestJobs(
    session: WebSession,
    query: { date: string; isOvertime: boolean; divisionId: number | null },
  ): Promise<WarehouseRequestJobOption[]>;
  listTransferStockCards(
    session: WebSession,
    query: { coreId: string; search: string },
  ): Promise<WarehouseRequestStockCardOption[]>;
  listRequestEmployees(
    session: WebSession,
    query: { divisionId: number | null },
  ): Promise<Array<{ value: string; label: string }>>;
  listRequestStockCards(
    session: WebSession,
    query: { coreId: string; search: string },
  ): Promise<WarehouseRequestStockCardOption[]>;
  listStockCard(
    session: WebSession,
    query: WarehouseTransactionQuery,
  ): Promise<WarehouseListResult<Awaited<ReturnType<WarehouseRepository["listStockCard"]>>["rows"][number]>>;
  listItems(
    session: WebSession,
    query: WarehouseTransactionQuery,
  ): Promise<WarehouseListResult<Awaited<ReturnType<WarehouseRepository["listItems"]>>["rows"][number]>>;
  listMaterialUsage(
    session: WebSession,
    query: WarehouseTransactionQuery,
  ): Promise<WarehouseListResult<Awaited<ReturnType<WarehouseRepository["listMaterialUsage"]>>["rows"][number]>>;
  listStorageLocations(
    session: WebSession,
    query: WarehouseTransactionQuery,
  ): Promise<WarehouseListResult<Awaited<ReturnType<WarehouseRepository["listStorageLocations"]>>["rows"][number]>>;
  listStockOpnames(
    session: WebSession,
    query: WarehouseTransactionQuery,
  ): Promise<WarehouseListResult<Awaited<ReturnType<WarehouseRepository["listStockOpnames"]>>["rows"][number]> & {
    references: Awaited<ReturnType<WarehouseRepository["listTransactionReferences"]>>;
  }>;
  listStockAdjustments(
    session: WebSession,
    query: WarehouseTransactionQuery,
  ): Promise<WarehouseListResult<Awaited<ReturnType<WarehouseRepository["listStockAdjustments"]>>["rows"][number]> & {
    references: Awaited<ReturnType<WarehouseRepository["listTransactionReferences"]>>;
  }>;
  createRequest(
    session: WebSession,
    input: CreateWarehouseRequest,
  ): Promise<WarehouseMutationResult>;
  createStockOpname(
    session: WebSession,
    input: CreateWarehouseStockOpname,
  ): Promise<WarehouseStockOpnameMutationResult>;
  createStockAdjustment(
    session: WebSession,
    input: CreateWarehouseStockAdjustment,
  ): Promise<WarehouseStockAdjustmentMutationResult>;
  approve(
    session: WebSession,
    input: WarehouseApproveRequest,
  ): Promise<WarehouseMutationResult>;
  ready(
    session: WebSession,
    input: WarehouseReadyRequest,
  ): Promise<WarehouseMutationResult>;
  reject(
    session: WebSession,
    input: WarehouseRejectRequest,
  ): Promise<WarehouseMutationResult>;
  issue(
    session: WebSession,
    input: WarehouseIssueRequest,
  ): Promise<WarehouseMutationResult>;
  returnItem(
    session: WebSession,
    input: WarehouseReturnRequest,
  ): Promise<WarehouseMutationResult>;
  storeItem(
    session: WebSession,
    input: WarehouseStoreRequest,
  ): Promise<WarehouseMutationResult>;
  createStockCardUploadTicket(
    session: WebSession,
    input: { stockCardId: string; filename: string; contentType: string },
  ): Promise<{ uploadUrl: string; publicUrl: string; objectKey: string }>;
  updateStockCardPhotos(
    session: WebSession,
    input: { stockCardId: string; photoUrls: string[] },
  ): Promise<{ stockCardId: string; photoUrls: string[] }>;
  createStorageLocation(
    session: WebSession,
    input: CreateWarehouseStorageLocation,
  ): Promise<WarehouseStorageLocationRecord>;
  updateStorageLocation(
    session: WebSession,
    input: UpdateWarehouseStorageLocation,
  ): Promise<WarehouseStorageLocationRecord>;
  deleteStorageLocation(
    session: WebSession,
    storageLocationId: number,
  ): Promise<WarehouseStorageLocationRecord>;
}

const WAREHOUSE_REFERENCE_CACHE_TTL_MS = 60_000;
const warehouseTransactionReferenceCache = new TtlCache<
  Awaited<ReturnType<WarehouseRepository["listTransactionReferences"]>>
>(WAREHOUSE_REFERENCE_CACHE_TTL_MS);

function warehouseScopeCacheKey(session: WebSession): string {
  return JSON.stringify({
    employeeId: session.user.employeeId,
    scope: session.user.scope,
  });
}

export class DefaultWarehouseService implements WarehouseService {
  constructor(
    private readonly repository: WarehouseRepository = new MySqlWarehouseRepository(),
    private readonly auditService: AuditService = new DefaultAuditService(
      new MySqlAuditRepository(),
    ),
    private readonly uploadTicketProvider: WarehouseUploadTicketProvider =
      new S3GalleryUploadTicketProvider(getApiEnv()),
  ) {}

  async getDashboard(session: WebSession) {
    return this.repository.getDashboard({
      employeeId: session.user.employeeId,
      scope: session.user.scope,
    });
  }

  private getTransactionReferences(session: WebSession) {
    return warehouseTransactionReferenceCache.getOrCreate(
      warehouseScopeCacheKey(session),
      () =>
        this.repository.listTransactionReferences({
          employeeId: session.user.employeeId,
          scope: session.user.scope,
        }),
    );
  }

  async listTransactions(
    session: WebSession,
    query: WarehouseTransactionQuery,
  ): Promise<WarehouseTransactionsResult> {
    const [listResult, references] = await Promise.all([
      this.repository.listTransactions({
        employeeId: session.user.employeeId,
        scope: session.user.scope,
        query,
      }),
      this.getTransactionReferences(session),
    ]);

    return {
      data: listResult.rows,
      meta: buildMeta(query.page, query.limit, listResult.total),
      query,
      references,
      summary: listResult.summary,
    };
  }

  async listPendingApproval(session: WebSession) {
    return this.repository.listPendingApproval({
      employeeId: session.user.employeeId,
      scope: session.user.scope,
    });
  }

  async listRequestJobs(
    session: WebSession,
    query: { date: string; isOvertime: boolean; divisionId: number | null },
  ) {
    return this.repository.listRequestJobs({
      employeeId: session.user.employeeId,
      scope: session.user.scope,
      ...query,
    });
  }

  async listRequestEmployees(
    session: WebSession,
    query: { divisionId: number | null },
  ) {
    return this.repository.listRequestEmployees({
      employeeId: session.user.employeeId,
      scope: session.user.scope,
      ...query,
    });
  }

  async listRequestStockCards(
    session: WebSession,
    query: { coreId: string; search: string },
  ) {
    return this.repository.listRequestStockCards({
      employeeId: session.user.employeeId,
      scope: session.user.scope,
      ...query,
    });
  }

  async listTransferStockCards(
    session: WebSession,
    query: { coreId: string; search: string },
  ) {
    const jobContext = await this.repository.findRequestJobByCoreId({
      employeeId: session.user.employeeId,
      scope: session.user.scope,
      coreId: query.coreId,
    });
    if (!jobContext) {
      return [];
    }

    return this.repository.listTransferStockCards({
      employeeId: session.user.employeeId,
      scope: session.user.scope,
      destinationCarId: jobContext.carId,
      search: query.search,
    });
  }

  async listStockCard(session: WebSession, query: WarehouseTransactionQuery) {
    const result = await this.repository.listStockCard({
      employeeId: session.user.employeeId,
      scope: session.user.scope,
      query,
    });

    return {
      data: result.rows,
      meta: buildMeta(query.page, query.limit, result.total),
      query,
    };
  }

  async listItems(session: WebSession, query: WarehouseTransactionQuery) {
    const result = await this.repository.listItems({
      employeeId: session.user.employeeId,
      scope: session.user.scope,
      query,
    });

    return {
      data: result.rows,
      meta: buildMeta(query.page, query.limit, result.total),
      query,
    };
  }

  async listMaterialUsage(session: WebSession, query: WarehouseTransactionQuery) {
    const result = await this.repository.listMaterialUsage({
      employeeId: session.user.employeeId,
      scope: session.user.scope,
      query,
    });

    return {
      data: result.rows,
      meta: buildMeta(query.page, query.limit, result.total),
      query,
    };
  }

  async listStorageLocations(session: WebSession, query: WarehouseTransactionQuery) {
    const result = await this.repository.listStorageLocations({
      employeeId: session.user.employeeId,
      scope: session.user.scope,
      query,
    });

    return {
      data: result.rows,
      meta: buildMeta(query.page, query.limit, result.total),
      query,
    };
  }

  async listStockOpnames(session: WebSession, query: WarehouseTransactionQuery) {
    const [result, references] = await Promise.all([
      this.repository.listStockOpnames({
        employeeId: session.user.employeeId,
        scope: session.user.scope,
        query,
      }),
      this.getTransactionReferences(session),
    ]);

    return {
      data: result.rows,
      meta: buildMeta(query.page, query.limit, result.total),
      query,
      references,
    };
  }

  async listStockAdjustments(session: WebSession, query: WarehouseTransactionQuery) {
    const [result, references] = await Promise.all([
      this.repository.listStockAdjustments({
        employeeId: session.user.employeeId,
        scope: session.user.scope,
        query,
      }),
      this.getTransactionReferences(session),
    ]);

    return {
      data: result.rows,
      meta: buildMeta(query.page, query.limit, result.total),
      query,
      references,
    };
  }

  async createRequest(
    session: WebSession,
    input: CreateWarehouseRequest,
  ): Promise<WarehouseMutationResult> {
    const isTransferPart = input.transactionType === "TRANSFER_PART";
    let transferSourceCarId: string | null = null;
    let transferSourceUnitName: string | null = null;
    const requestedEmployeeId = input.requesterEmployeeId?.trim() || session.user.employeeId;
    const requester = await this.repository.findRequestEmployeeById(requestedEmployeeId);
    if (!requester) {
      throw new Error("WAREHOUSE_REQUESTER_NOT_FOUND");
    }

    const requestedDivisionId = input.divisionId ?? session.user.divisionId;
    const effectiveDivisionId = requestedDivisionId ?? requester.divisionId;
    const requestedDivisionName = input.divisionName?.trim() || requester.divisionName || null;
    const canOverrideDivision =
      effectiveDivisionId === null ||
      effectiveDivisionId === session.user.divisionId ||
      session.user.scope.canViewAllUnits ||
      session.user.scope.managedDivisionIds.includes(effectiveDivisionId) ||
      session.user.scope.divisionIds.includes(effectiveDivisionId);

    if (!canOverrideDivision) {
      throw new Error("WAREHOUSE_DIVISION_SCOPE_DENIED");
    }

    if (effectiveDivisionId !== null && requester.divisionId !== null && requester.divisionId !== effectiveDivisionId) {
      throw new Error("WAREHOUSE_REQUESTER_DIVISION_MISMATCH");
    }

    const divisionId = effectiveDivisionId;
    if (divisionId === null) {
      throw new Error("MISSING_DIVISION");
    }

    const jobContext = input.coreId
      ? await this.repository.findRequestJobByCoreId({
          employeeId: session.user.employeeId,
          scope: session.user.scope,
          coreId: input.coreId,
        })
      : null;
    if (input.coreId && !jobContext) {
      throw new Error("WAREHOUSE_SCOPE_DENIED");
    }
    if (!input.coreId) {
      throw new Error("WAREHOUSE_JOB_REQUIRED");
    }

    if (
      effectiveDivisionId !== null &&
      jobContext?.divisionId !== null &&
      jobContext?.divisionId !== effectiveDivisionId
    ) {
      throw new Error("WAREHOUSE_JOB_DIVISION_MISMATCH");
    }

    if (isTransferPart) {
      if (input.itemCategory !== "SPARE_PART") {
        throw new Error("WAREHOUSE_TRANSFER_CATEGORY_INVALID");
      }
      if (!input.stockCardId) {
        throw new Error("WAREHOUSE_STOCK_CARD_REQUIRED");
      }
      const transferSource = await this.repository.findTransferStockCardById({
        employeeId: session.user.employeeId,
        scope: session.user.scope,
        stockCardId: input.stockCardId,
        destinationCarId: jobContext?.carId ?? "",
      });
      if (!transferSource) {
        throw new Error("WAREHOUSE_TRANSFER_SOURCE_NOT_FOUND");
      }
      transferSourceCarId = transferSource.carId;
      transferSourceUnitName = transferSource.unitName;
      input = {
        ...input,
        itemMasterId: transferSource.itemMasterId ?? input.itemMasterId,
        itemName: input.itemName?.trim() || transferSource.partName,
        uom: input.uom?.trim() || transferSource.uom,
      };
    }

    const resolvedInput: CreateWarehouseRequest = jobContext
      ? {
          ...input,
          carId: jobContext.carId,
          unitName: jobContext.unitName,
          panelName: jobContext.panelName,
          jobName: jobContext.jobName,
          targetSearchDate: input.targetSearchDate ?? jobContext.targetSearchDate,
          deadlineDate: input.deadlineDate ?? jobContext.deadlineDate,
        }
      : input;

    const canAccessCar = await this.repository.canAccessCar({
      employeeId: session.user.employeeId,
      scope: session.user.scope,
      carId: resolvedInput.carId,
    });
    if (!canAccessCar) {
      throw new Error("WAREHOUSE_SCOPE_DENIED");
    }

    if (input.stockCardId && !isTransferPart) {
      const canUseStockCard = await this.repository.canUseStockCardForCore({
        employeeId: session.user.employeeId,
        scope: session.user.scope,
        coreId: input.coreId ?? "",
        stockCardId: input.stockCardId,
      });
      if (!canUseStockCard) {
        throw new Error("WAREHOUSE_STOCK_CARD_SCOPE_DENIED");
      }
    }

    const resolvedDivisionName =
      requestedDivisionName ||
      (await this.repository.findDivisionNameById(divisionId)) ||
      session.user.divisionName ||
      "-";
    const resolvedRequesterName = requester.fullName;

    const result = await this.repository.createRequest(
      {
        actorId: session.user.employeeId,
        actorName: session.user.fullName,
        requesterEmployeeId: requester.employeeId,
        requesterName: resolvedRequesterName,
        divisionId,
        divisionName: resolvedDivisionName,
        sourceCarId: transferSourceCarId,
        sourceUnitName: transferSourceUnitName,
      },
      resolvedInput,
    );

    await this.auditService.log({
      actorId: session.user.employeeId,
      actorName: session.user.fullName,
      action: "warehouse.request.create",
      module: "warehouse",
      recordId: result.transactionId,
      newValue: resolvedInput,
    });

    return result;
  }

  async createStockOpname(
    session: WebSession,
    input: CreateWarehouseStockOpname,
  ): Promise<WarehouseStockOpnameMutationResult> {
    const divisionId = session.user.divisionId;
    if (divisionId === null) {
      throw new Error("MISSING_DIVISION");
    }

    if (input.carId) {
      const canAccessCar = await this.repository.canAccessCar({
        employeeId: session.user.employeeId,
        scope: session.user.scope,
        carId: input.carId,
      });
      if (!canAccessCar) {
        throw new Error("WAREHOUSE_SCOPE_DENIED");
      }
    }

    const result = await this.repository.createStockOpname(
      {
        actorId: session.user.employeeId,
        actorName: session.user.fullName,
        divisionId,
        divisionName: session.user.divisionName,
      },
      input,
    );

    await this.auditService.log({
      actorId: session.user.employeeId,
      actorName: session.user.fullName,
      action: "warehouse.stock-opname.create",
      module: "warehouse",
      recordId: result.opnameId,
      newValue: input,
    });

    return result;
  }

  async createStockAdjustment(
    session: WebSession,
    input: CreateWarehouseStockAdjustment,
  ): Promise<WarehouseStockAdjustmentMutationResult> {
    const divisionId = session.user.divisionId;
    if (divisionId === null) {
      throw new Error("MISSING_DIVISION");
    }

    if (input.carId) {
      const canAccessCar = await this.repository.canAccessCar({
        employeeId: session.user.employeeId,
        scope: session.user.scope,
        carId: input.carId,
      });
      if (!canAccessCar) {
        throw new Error("WAREHOUSE_SCOPE_DENIED");
      }
    }

    const result = await this.repository.createStockAdjustment(
      {
        actorId: session.user.employeeId,
        actorName: session.user.fullName,
        divisionId,
        divisionName: session.user.divisionName,
      },
      input,
    );

    await this.auditService.log({
      actorId: session.user.employeeId,
      actorName: session.user.fullName,
      action: "warehouse.stock-adjustment.create",
      module: "warehouse",
      recordId: result.adjustmentId,
      newValue: input,
    });

    return result;
  }

  async approve(
    session: WebSession,
    input: WarehouseApproveRequest,
  ): Promise<WarehouseMutationResult> {
    const detail = await this.repository.findTransactionById({
      employeeId: session.user.employeeId,
      scope: session.user.scope,
      transactionId: input.transactionId,
    });
    if (!detail) {
      throw new Error("WAREHOUSE_TRANSACTION_NOT_FOUND");
    }

    if (
      detail.approvalStatus === "APPROVED" ||
      detail.approvalStatus === "REJECTED"
    ) {
      throw new Error("WAREHOUSE_INVALID_APPROVAL_STATE");
    }

    const nextStage = nextApprovalStage(detail.itemCategory, detail.approvalStatus);
    const result = await this.repository.updateApprovalStatus(
      input.transactionId,
      nextStage,
      input.notes,
    );

    await this.auditService.log({
      actorId: session.user.employeeId,
      actorName: session.user.fullName,
      action: "warehouse.approve",
      module: "warehouse",
      recordId: input.transactionId,
      oldValue: {
        approvalStatus: detail.approvalStatus,
        itemStatus: detail.itemStatus,
      },
      newValue: result,
    });

    return result;
  }

  async reject(
    session: WebSession,
    input: WarehouseRejectRequest,
  ): Promise<WarehouseMutationResult> {
    const detail = await this.repository.findTransactionById({
      employeeId: session.user.employeeId,
      scope: session.user.scope,
      transactionId: input.transactionId,
    });
    if (!detail) {
      throw new Error("WAREHOUSE_TRANSACTION_NOT_FOUND");
    }

    if (
      detail.approvalStatus === "APPROVED" ||
      detail.approvalStatus === "REJECTED"
    ) {
      throw new Error("WAREHOUSE_INVALID_APPROVAL_STATE");
    }

    const result = await this.repository.reject(input.transactionId, input.notes);
    await this.auditService.log({
      actorId: session.user.employeeId,
      actorName: session.user.fullName,
      action: "warehouse.reject",
      module: "warehouse",
      recordId: input.transactionId,
      oldValue: {
        approvalStatus: detail.approvalStatus,
      },
      newValue: result,
    });

    return result;
  }

  async ready(
    session: WebSession,
    input: WarehouseReadyRequest,
  ): Promise<WarehouseMutationResult> {
    const detail = await this.repository.findTransactionById({
      employeeId: session.user.employeeId,
      scope: session.user.scope,
      transactionId: input.transactionId,
    });
    if (!detail) {
      throw new Error("WAREHOUSE_TRANSACTION_NOT_FOUND");
    }

    if (detail.approvalStatus !== "APPROVED" || detail.itemStatus !== "OPEN") {
      throw new Error("WAREHOUSE_INVALID_READY_STATE");
    }

    const result = await this.repository.markReady(input.transactionId, input.notes);
    await this.auditService.log({
      actorId: session.user.employeeId,
      actorName: session.user.fullName,
      action: "warehouse.ready",
      module: "warehouse",
      recordId: input.transactionId,
      oldValue: {
        itemStatus: detail.itemStatus,
        approvalStatus: detail.approvalStatus,
      },
      newValue: result,
    });

    return result;
  }

  async issue(
    session: WebSession,
    input: WarehouseIssueRequest,
  ): Promise<WarehouseMutationResult> {
    const detail = await this.repository.findTransactionById({
      employeeId: session.user.employeeId,
      scope: session.user.scope,
      transactionId: input.transactionId,
    });
    if (!detail) {
      throw new Error("WAREHOUSE_TRANSACTION_NOT_FOUND");
    }

    if (detail.approvalStatus !== "APPROVED") {
      throw new Error("WAREHOUSE_NOT_APPROVED");
    }

    if (detail.itemStatus !== "READY") {
      throw new Error("WAREHOUSE_INVALID_ISSUE_STATE");
    }

    const result = await this.repository.issue(input.transactionId, {
      ...input,
      actorId: session.user.employeeId,
      actorName: session.user.fullName,
    });
    await this.auditService.log({
      actorId: session.user.employeeId,
      actorName: session.user.fullName,
      action: "warehouse.issue",
      module: "warehouse",
      recordId: input.transactionId,
      oldValue: {
        itemStatus: detail.itemStatus,
      },
      newValue: result,
    });

    return result;
  }

  async returnItem(
    session: WebSession,
    input: WarehouseReturnRequest,
  ): Promise<WarehouseMutationResult> {
    const detail = await this.repository.findTransactionById({
      employeeId: session.user.employeeId,
      scope: session.user.scope,
      transactionId: input.transactionId,
    });
    if (!detail) {
      throw new Error("WAREHOUSE_TRANSACTION_NOT_FOUND");
    }

    if (detail.itemStatus !== "RELEASED") {
      throw new Error("WAREHOUSE_INVALID_RETURN_STATE");
    }

    const result = await this.repository.markReturned(input.transactionId, {
      notes: input.notes,
      actualReturnDate: input.actualReturnDate,
      qtyReturned: input.qtyReturned,
      itemCondition: input.itemCondition,
    });
    await this.auditService.log({
      actorId: session.user.employeeId,
      actorName: session.user.fullName,
      action: "warehouse.return",
      module: "warehouse",
      recordId: input.transactionId,
      oldValue: {
        itemStatus: detail.itemStatus,
        transactionType: detail.transactionType,
      },
      newValue: result,
    });

    return result;
  }

  async storeItem(
    session: WebSession,
    input: WarehouseStoreRequest,
  ): Promise<WarehouseMutationResult> {
    const detail = await this.repository.findTransactionById({
      employeeId: session.user.employeeId,
      scope: session.user.scope,
      transactionId: input.transactionId,
    });
    if (!detail) {
      throw new Error("WAREHOUSE_TRANSACTION_NOT_FOUND");
    }

    if (detail.itemStatus !== "RETURNED") {
      throw new Error("WAREHOUSE_INVALID_STORE_STATE");
    }

    const result = await this.repository.markStored(input.transactionId, {
      notes: input.notes,
      storageLocationId: input.storageLocationId,
      locationDetail: input.locationDetail,
    });
    await this.auditService.log({
      actorId: session.user.employeeId,
      actorName: session.user.fullName,
      action: "warehouse.store",
      module: "warehouse",
      recordId: input.transactionId,
      oldValue: {
        itemStatus: detail.itemStatus,
        storageLocationId: detail.storageLocationId,
      },
      newValue: result,
    });

    return result;
  }

  async createStockCardUploadTicket(
    session: WebSession,
    input: { stockCardId: string; filename: string; contentType: string },
  ) {
    const extension = inferFileExtension(input.filename, input.contentType);
    const safeStockCardId = sanitizePath(input.stockCardId);
    const objectKey = [
      "warehouse",
      "stock-card",
      safeStockCardId,
      `${Date.now()}_${sanitizePath(input.filename || "photo")}.${extension}`,
    ].join("/");

    return this.uploadTicketProvider.createTicket({
      objectKey,
      contentType: input.contentType,
    });
  }

  async updateStockCardPhotos(
    session: WebSession,
    input: { stockCardId: string; photoUrls: string[] },
  ) {
    const result = await this.repository.updateStockCardPhotos(
      input.stockCardId,
      input.photoUrls,
    );
    await this.auditService.log({
      actorId: session.user.employeeId,
      actorName: session.user.fullName,
      action: "warehouse.stock-card.photos",
      module: "warehouse",
      recordId: input.stockCardId,
      newValue: result,
    });
    return result;
  }

  async createStorageLocation(
    session: WebSession,
    input: CreateWarehouseStorageLocation,
  ) {
    const result = await this.repository.createStorageLocation(input);
    warehouseTransactionReferenceCache.clear();
    await this.auditService.log({
      actorId: session.user.employeeId,
      actorName: session.user.fullName,
      action: "warehouse.location.create",
      module: "warehouse",
      recordId: String(result.storageLocationId),
      newValue: result,
    });
    return result;
  }

  async updateStorageLocation(
    session: WebSession,
    input: UpdateWarehouseStorageLocation,
  ) {
    const result = await this.repository.updateStorageLocation(input);
    warehouseTransactionReferenceCache.clear();
    await this.auditService.log({
      actorId: session.user.employeeId,
      actorName: session.user.fullName,
      action: "warehouse.location.update",
      module: "warehouse",
      recordId: String(input.storageLocationId),
      newValue: result,
    });
    return result;
  }

  async deleteStorageLocation(
    session: WebSession,
    storageLocationId: number,
  ) {
    const result = await this.repository.deactivateStorageLocation(storageLocationId);
    warehouseTransactionReferenceCache.clear();
    await this.auditService.log({
      actorId: session.user.employeeId,
      actorName: session.user.fullName,
      action: "warehouse.location.delete",
      module: "warehouse",
      recordId: String(storageLocationId),
      newValue: result,
    });
    return result;
  }
}
