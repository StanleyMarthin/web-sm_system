import { randomUUID } from "node:crypto";
import type { AuthScope } from "@smsystem/contracts/auth";
import type {
  CreateWarehouseItem,
  CreateWarehouseStockCard,
  CreateWarehouseStockAdjustment,
  CreateWarehouseStockOpname,
  CreateWarehouseStorageLocation,
  CreateWarehouseRequest,
  WarehouseApprovalStatus,
  WarehouseAdjustmentReason,
  WarehouseDashboardDivisionUsageRecord,
  WarehouseDashboardLateUserRecord,
  WarehouseDashboardLowStockRecord,
  WarehouseDashboardMaterialOutRecord,
  WarehouseDashboardSummary,
  WarehouseItemRecord,
  WarehouseMaterialUsageRecord,
  WarehouseMutationResult,
  WarehouseOpnameFindingStatus,
  WarehouseRequestTransactionType,
  WarehouseStockAdjustmentMutationResult,
  WarehouseStockAdjustmentRecord,
  WarehouseStockCardPanelReference,
  WarehouseStockCardRecord,
  WarehouseStockCardUnitReference,
  WarehouseRequestJobOption,
  WarehouseRequestEmployeeOption,
  WarehouseRequestStockCardOption,
  WarehouseStockOpnameMutationResult,
  WarehouseStockOpnameRecord,
  WarehouseStorageLocationRecord,
  UpdateWarehouseItem,
  UpdateWarehouseStorageLocation,
  WarehouseTransactionQuery,
  WarehouseTransactionRecord,
  WarehouseTransactionsSummary,
  UpdateWarehouseStockCard,
} from "@smsystem/contracts/warehouse";
import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getApiEnv } from "@/config/env";
import { qualifyTable } from "@/db/identifier";
import { getMySqlPool } from "@/db/mysql";

interface ScopeParams {
  employeeId: string;
  scope: AuthScope;
}

interface TransactionListParams extends ScopeParams {
  query: WarehouseTransactionQuery;
}

interface GridListParams extends ScopeParams {
  query: WarehouseTransactionQuery;
}

interface CountRow extends RowDataPacket {
  total: number;
}

interface SummaryRow extends RowDataPacket {
  pendingApproval: number | null;
  readyCount: number | null;
  releasedCount: number | null;
  overdueCount: number | null;
  storedCount: number | null;
}

interface OptionRow extends RowDataPacket {
  value: string | number | null;
  label: string | null;
}

interface StockCardPanelReferenceRow extends RowDataPacket {
  panelId: number;
  parentPanelId?: number | null;
  partCode: string;
  section: string;
  name: string;
  category: string | null;
}

interface UnitSummaryRow extends RowDataPacket {
  value: string;
  label: string | null;
}

interface TransactionRow extends RowDataPacket {
  transactionId: string;
  transactionType: WarehouseTransactionRecord["transactionType"];
  itemCategory: WarehouseTransactionRecord["itemCategory"];
  itemName: string;
  itemMasterId: string | null;
  itemAliasUsed: string | null;
  qty: number | null;
  qtyReturned: number | null;
  uom: string | null;
  carId: string | null;
  unitName: string | null;
  employeeId: string;
  requesterName: string | null;
  divisionId: number | null;
  divisionName: string | null;
  stockCardId: string | null;
  sourceCarId: string | null;
  sourceUnitName: string | null;
  storageLocationId: number | null;
  locationLabel: string | null;
  locationDetail: string | null;
  requestDate: string;
  targetSearchDate: string | null;
  actualReleaseDate: string | null;
  deadlineDate: string | null;
  actualReturnDate: string | null;
  itemStatus: WarehouseTransactionRecord["itemStatus"] | null;
  approvalStatus: WarehouseTransactionRecord["approvalStatus"] | null;
  itemCondition: WarehouseTransactionRecord["itemCondition"];
  notes: string | null;
  picWarehouseName: string | null;
  accKdName: string | null;
  photoCount: number | null;
  daysOverdue: number | null;
}

interface StockCardRow extends RowDataPacket {
  stockCardId: string | number;
  entryNo: string | number | null;
  carId: string | null;
  unitName: string | null;
  masterPanelId?: number | null;
  parentPanelId?: number | null;
  panelName?: string | null;
  partCode: string | null;
  panelSection: string | null;
  panelCategory: string | null;
  partName: string | null;
  conditionType: string | null;
  qty: number | null;
  uom: string | null;
  storageLocationId: number | null;
  locationLabel: string | null;
  locationDetail: string | null;
  dateIn: string | null;
  dateOut: string | null;
  takenByName: string | null;
  status: string | null;
  isLabeled: number | boolean | null;
  itemCategory: string | null;
  photoUrls: string | null;
}

interface ItemRow extends RowDataPacket {
  itemId: string;
  itemCode: string | null;
  itemName: string;
  itemCategory: WarehouseItemRecord["itemCategory"];
  uom: string | null;
  description: string | null;
  isActive: number | boolean | null;
  aliasCount: number | null;
  latestPrice: number | null;
  latestVendorName: string | null;
  usageCount: number | null;
  lastUsedAt: string | null;
  updatedAt: string | null;
}

interface MaterialUsageRow extends RowDataPacket {
  usageId: string;
  countdownId: string | null;
  carId: string | null;
  unitName: string | null;
  divisionId: number | null;
  divisionName: string | null;
  employeeId: string | null;
  employeeName: string | null;
  warehouseTransactionId: string | null;
  itemName: string;
  itemCategory: WarehouseMaterialUsageRecord["itemCategory"];
  qty: number | null;
  uom: string | null;
  pricePerUnit: number | null;
  totalPrice: number | null;
  usageDate: string;
  notes: string | null;
}

interface StorageLocationRow extends RowDataPacket {
  storageLocationId: number;
  locationType: WarehouseStorageLocationRecord["locationType"];
  zone: string | null;
  rack: string | null;
  shelf: string | null;
  label: string;
  isActive: number | boolean | null;
  itemCount: number | null;
}

interface StockOpnameRow extends RowDataPacket {
  opnameId: string;
  opnameNo: string;
  stockCardId: string | null;
  carId: string | null;
  unitName: string | null;
  itemName: string;
  partCode: string | null;
  uom: string | null;
  storageLocationId: number | null;
  locationLabel: string | null;
  expectedQty: number | null;
  actualQty: number | null;
  varianceQty: number | null;
  findingStatus: WarehouseOpnameFindingStatus;
  itemCondition: WarehouseStockOpnameRecord["itemCondition"];
  countedAt: string;
  countedByName: string | null;
  notes: string | null;
}

interface StockAdjustmentRow extends RowDataPacket {
  adjustmentId: string;
  adjustmentNo: string;
  opnameId: string | null;
  stockCardId: string | null;
  carId: string | null;
  unitName: string | null;
  itemName: string;
  partCode: string | null;
  uom: string | null;
  qtyBefore: number | null;
  qtyAfter: number | null;
  adjustmentQty: number | null;
  adjustmentReason: WarehouseAdjustmentReason;
  itemCondition: WarehouseStockAdjustmentRecord["itemCondition"];
  createdAt: string;
  createdByName: string | null;
  notes: string | null;
}

interface DashboardSummaryRow extends RowDataPacket {
  pendingApproval: number | null;
  notPrepared: number | null;
  notPickedUp: number | null;
  inUse: number | null;
  overdueNotReturned: number | null;
}

interface DashboardLateUserRow extends RowDataPacket {
  transactionId: string;
  requesterName: string | null;
  divisionName: string | null;
  itemName: string | null;
  unitName: string | null;
  daysOverdue: number | null;
}

interface DashboardDivisionUsageRow extends RowDataPacket {
  divisionId: number | null;
  divisionName: string | null;
  itemCount: number | null;
  totalQty: number | null;
}

interface DashboardMaterialOutRow extends RowDataPacket {
  usageId: string;
  divisionName: string | null;
  itemName: string | null;
  qty: number | null;
  uom: string | null;
  usageDate: string;
}

interface DashboardLowStockRow extends RowDataPacket {
  itemName: string | null;
  itemCategory: WarehouseStockCardRecord["itemCategory"];
  qtyAvailable: number | null;
  uom: string | null;
}

interface CreateRequestContext {
  actorId: string;
  actorName: string;
  requesterEmployeeId?: string;
  requesterName?: string;
  divisionId: number;
  divisionName: string;
  sourceCarId?: string | null;
  sourceUnitName?: string | null;
}

interface WarehouseRequestJobRow extends RowDataPacket {
  coreId: string;
  carId: string;
  unitName: string | null;
  divisionId: number | null;
  divisionName: string | null;
  panelName: string | null;
  jobName: string | null;
  taskDate: string;
  isOvertime: number | boolean | null;
}

interface WarehouseRequestStockCardRow extends StockCardRow {
  itemMasterId: string | null;
}

interface WarehouseRequestEmployeeRow extends RowDataPacket {
  value: string;
  label: string | null;
  divisionId: number | null;
  divisionName: string | null;
}

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toInteger(value: unknown, fallback = 0): number {
  return Math.trunc(toNumber(value, fallback));
}

function toBoolean(value: unknown): boolean {
  return value === true || value === 1 || value === "1";
}

function parseJsonStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.length > 0);
  }

  if (typeof value !== "string" || value.trim().length === 0) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string" && item.length > 0)
      : [];
  } catch {
    return [];
  }
}

function mapTransactionRow(row: TransactionRow): WarehouseTransactionRecord {
  const itemStatus = row.itemStatus ?? "OPEN";
  const approvalStatus = row.approvalStatus ?? "PENDING_KD";
  const daysOverdue =
    row.daysOverdue === null || row.daysOverdue === undefined
      ? null
      : Math.max(0, toInteger(row.daysOverdue));

  return {
    transactionId: row.transactionId,
    transactionType: row.transactionType,
    itemCategory: row.itemCategory,
    itemName: row.itemName,
    itemMasterId: row.itemMasterId,
    itemAliasUsed: row.itemAliasUsed,
    qty: toNumber(row.qty),
    qtyReturned: row.qtyReturned === null ? null : toNumber(row.qtyReturned),
    uom: row.uom ?? "-",
    carId: row.carId,
    unitName: row.unitName ?? row.carId ?? "-",
    employeeId: row.employeeId,
    requesterName: row.requesterName ?? row.employeeId,
    divisionId: row.divisionId,
    divisionName: row.divisionName ?? "-",
    stockCardId: row.stockCardId,
    sourceCarId: row.sourceCarId,
    sourceUnitName: row.sourceUnitName,
    storageLocationId: row.storageLocationId,
    locationLabel: row.locationLabel,
    locationDetail: row.locationDetail,
    requestDate: row.requestDate,
    targetSearchDate: row.targetSearchDate,
    actualReleaseDate: row.actualReleaseDate,
    deadlineDate: row.deadlineDate,
    actualReturnDate: row.actualReturnDate,
    itemStatus,
    approvalStatus,
    itemCondition: row.itemCondition ?? null,
    notes: row.notes,
    picWarehouseName: row.picWarehouseName,
    accKdName: row.accKdName,
    photoCount: toInteger(row.photoCount),
    daysOverdue,
    isOverdue: daysOverdue !== null && daysOverdue > 0,
  };
}

function normalizeStockCardCondition(
  conditionType: string | null,
): WarehouseStockCardRecord["conditionType"] {
  switch (conditionType) {
    case "BARU":
    case "RESTORE":
    case "BEKAS":
      return conditionType;
    default:
      return "BEKAS";
  }
}

function normalizeStockCardStatus(status: string | null): WarehouseStockCardRecord["status"] {
  switch (status) {
    case "IN_STORAGE":
    case "RETRIEVED":
    case "INSTALLED":
    case "LOST":
      return status;
    default:
      return "IN_STORAGE";
  }
}

function normalizeStockCardItemCategory(
  itemCategory: string | null,
  partCode: string | null,
): WarehouseStockCardRecord["itemCategory"] {
  switch (itemCategory) {
    case "SPARE_PART":
    case "BAHAN":
    case "TOOLS":
      return itemCategory;
    default:
      return partCode?.startsWith("MP-") ? "SPARE_PART" : null;
  }
}

function mapStockCardRow(row: StockCardRow): WarehouseStockCardRecord {
  const stockCardId = String(row.stockCardId);
  const entryNo = String(row.entryNo ?? stockCardId);

  return {
    stockCardId,
    entryNo,
    carId: row.carId,
    unitName: row.unitName ?? row.carId ?? "-",
    masterPanelId: row.masterPanelId == null ? null : Number(row.masterPanelId),
    parentPanelId: row.parentPanelId == null ? null : Number(row.parentPanelId),
    panelName: row.panelName ?? null,
    partCode: row.partCode,
    panelSection: row.panelSection,
    panelCategory: row.panelCategory ?? null,
    partName: row.partName ?? row.partCode ?? entryNo,
    conditionType: normalizeStockCardCondition(row.conditionType),
    qty: toNumber(row.qty),
    uom: row.uom ?? "-",
    storageLocationId: row.storageLocationId,
    locationLabel: row.locationLabel,
    locationDetail: row.locationDetail,
    dateIn: row.dateIn,
    dateOut: row.dateOut,
    takenByName: row.takenByName,
    status: normalizeStockCardStatus(row.status),
    isLabeled: toBoolean(row.isLabeled),
    itemCategory: normalizeStockCardItemCategory(row.itemCategory, row.partCode),
    photoUrls: parseJsonStringArray(row.photoUrls),
  };
}

function mapWarehouseRequestJobRow(row: WarehouseRequestJobRow): WarehouseRequestJobOption {
  return {
    coreId: row.coreId,
    carId: row.carId,
    unitName: row.unitName ?? row.carId,
    divisionId: row.divisionId ?? null,
    divisionName: row.divisionName ?? null,
    panelName: row.panelName,
    jobName: row.jobName,
    taskDate: row.taskDate,
    targetSearchDate: row.taskDate,
    deadlineDate: row.taskDate,
    isOvertime: toBoolean(row.isOvertime),
  };
}

function mapWarehouseRequestStockCardRow(
  row: WarehouseRequestStockCardRow,
): WarehouseRequestStockCardOption {
  return {
    ...mapStockCardRow(row),
    itemMasterId: row.itemMasterId,
  };
}

function mapItemRow(row: ItemRow): WarehouseItemRecord {
  return {
    itemId: row.itemId,
    itemCode: row.itemCode,
    itemName: row.itemName,
    itemCategory: row.itemCategory,
    uom: row.uom,
    description: row.description,
    isActive: toBoolean(row.isActive),
    aliasCount: toInteger(row.aliasCount),
    latestPrice: row.latestPrice === null ? null : Number(row.latestPrice),
    latestVendorName: row.latestVendorName,
    usageCount: toInteger(row.usageCount),
    lastUsedAt: row.lastUsedAt,
    updatedAt: row.updatedAt,
  };
}

function mapMaterialUsageRow(row: MaterialUsageRow): WarehouseMaterialUsageRecord {
  return {
    usageId: row.usageId,
    countdownId: row.countdownId,
    carId: row.carId,
    unitName: row.unitName ?? row.carId ?? "-",
    divisionId: row.divisionId,
    divisionName: row.divisionName ?? "-",
    employeeId: row.employeeId,
    employeeName: row.employeeName ?? row.employeeId ?? "-",
    warehouseTransactionId: row.warehouseTransactionId,
    itemName: row.itemName,
    itemCategory: row.itemCategory,
    qty: toNumber(row.qty),
    uom: row.uom ?? "-",
    pricePerUnit: row.pricePerUnit === null ? null : Number(row.pricePerUnit),
    totalPrice: row.totalPrice === null ? null : Number(row.totalPrice),
    usageDate: row.usageDate,
    notes: row.notes,
  };
}

function mapStorageLocationRow(row: StorageLocationRow): WarehouseStorageLocationRecord {
  return {
    storageLocationId: row.storageLocationId,
    locationType: row.locationType,
    zone: row.zone,
    rack: row.rack,
    shelf: row.shelf,
    label: row.label,
    isActive: toBoolean(row.isActive),
    itemCount: toInteger(row.itemCount),
  };
}

function mapDashboardLateUserRow(
  row: DashboardLateUserRow,
): WarehouseDashboardLateUserRecord {
  return {
    transactionId: row.transactionId,
    requesterName: row.requesterName ?? "-",
    divisionName: row.divisionName ?? "-",
    itemName: row.itemName ?? "-",
    unitName: row.unitName ?? "-",
    daysOverdue: Math.max(0, toInteger(row.daysOverdue)),
  };
}

function mapDashboardDivisionUsageRow(
  row: DashboardDivisionUsageRow,
): WarehouseDashboardDivisionUsageRecord {
  return {
    divisionId: row.divisionId,
    divisionName: row.divisionName ?? "-",
    itemCount: Math.max(0, toInteger(row.itemCount)),
    totalQty: toNumber(row.totalQty),
  };
}

function mapDashboardMaterialOutRow(
  row: DashboardMaterialOutRow,
): WarehouseDashboardMaterialOutRecord {
  return {
    usageId: row.usageId,
    divisionName: row.divisionName ?? "-",
    itemName: row.itemName ?? "-",
    qty: toNumber(row.qty),
    uom: row.uom ?? "-",
    usageDate: row.usageDate,
  };
}

function mapDashboardLowStockRow(
  row: DashboardLowStockRow,
): WarehouseDashboardLowStockRecord {
  const qtyAvailable = toNumber(row.qtyAvailable);
  return {
    itemName: row.itemName ?? "-",
    itemCategory: row.itemCategory ?? null,
    qtyAvailable,
    uom: row.uom ?? "-",
    alertLevel: qtyAvailable <= 3 ? "CRITICAL" : "LOW",
  };
}

function mapStockOpnameRow(row: StockOpnameRow): WarehouseStockOpnameRecord {
  return {
    opnameId: row.opnameId,
    opnameNo: row.opnameNo,
    stockCardId: row.stockCardId,
    carId: row.carId,
    unitName: row.unitName ?? row.carId ?? "-",
    itemName: row.itemName,
    partCode: row.partCode,
    uom: row.uom ?? "-",
    storageLocationId: row.storageLocationId,
    locationLabel: row.locationLabel,
    expectedQty: toNumber(row.expectedQty),
    actualQty: toNumber(row.actualQty),
    varianceQty: toNumber(row.varianceQty),
    findingStatus: row.findingStatus,
    itemCondition: row.itemCondition ?? null,
    countedAt: row.countedAt,
    countedByName: row.countedByName ?? "-",
    notes: row.notes,
  };
}

function mapStockAdjustmentRow(
  row: StockAdjustmentRow,
): WarehouseStockAdjustmentRecord {
  return {
    adjustmentId: row.adjustmentId,
    adjustmentNo: row.adjustmentNo,
    opnameId: row.opnameId,
    stockCardId: row.stockCardId,
    carId: row.carId,
    unitName: row.unitName ?? row.carId ?? "-",
    itemName: row.itemName,
    partCode: row.partCode,
    uom: row.uom ?? "-",
    qtyBefore: toNumber(row.qtyBefore),
    qtyAfter: toNumber(row.qtyAfter),
    adjustmentQty: toNumber(row.adjustmentQty),
    adjustmentReason: row.adjustmentReason,
    itemCondition: row.itemCondition ?? null,
    createdAt: row.createdAt,
    createdByName: row.createdByName ?? "-",
    notes: row.notes,
  };
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

const ITEM_CATEGORIES = ["TOOLS", "BAHAN", "SPARE_PART", "CONSUMABLE"] as const;
const ITEM_STATUSES = ["OPEN", "READY", "RELEASED", "RETURNED", "STORED", "LOST"] as const;
const APPROVAL_STATUSES = [
  "PENDING_KD",
  "PENDING_KEPALA_GUDANG",
  "PENDING_PPIC",
  "APPROVED",
  "REJECTED",
] as const;
const TRANSACTION_TYPES = [
  "PEMINJAMAN",
  "PENGAMBILAN",
  "TRANSFER_PART",
  "PENGEMBALIAN",
  "PENYIMPANAN",
] as const;

function buildOptionRows(values: readonly string[]) {
  return values.map((value) => ({
    value,
    label: value,
  }));
}

export interface WarehouseRepository {
  getDashboard(params: ScopeParams): Promise<{
    summary: WarehouseDashboardSummary;
    lateUsers: WarehouseDashboardLateUserRecord[];
    divisionsUsing: WarehouseDashboardDivisionUsageRecord[];
    materialsOut: WarehouseDashboardMaterialOutRecord[];
    lowStockAlerts: WarehouseDashboardLowStockRecord[];
  }>;
  listTransactions(params: TransactionListParams): Promise<{
    rows: WarehouseTransactionRecord[];
    total: number;
    summary: WarehouseTransactionsSummary;
  }>;
  listTransactionReferences(params: ScopeParams): Promise<{
    units: Array<{ value: string; label: string }>;
    divisions: Array<{ value: string; label: string }>;
    itemCategories: Array<{ value: string; label: string }>;
    itemStatuses: Array<{ value: string; label: string }>;
    approvalStatuses: Array<{ value: string; label: string }>;
    transactionTypes: Array<{ value: string; label: string }>;
  }>;
  listRequestJobs(
    params: ScopeParams & { date: string; isOvertime: boolean; divisionId: number | null },
  ): Promise<WarehouseRequestJobOption[]>;
  listRequestEmployees(
    params: ScopeParams & { divisionId: number | null },
  ): Promise<WarehouseRequestEmployeeOption[]>;
  findRequestJobByCoreId(
    params: ScopeParams & { coreId: string },
  ): Promise<WarehouseRequestJobOption | null>;
  findDivisionNameById(divisionId: number): Promise<string | null>;
  findRequestEmployeeById(
    employeeId: string,
  ): Promise<{ employeeId: string; fullName: string; divisionId: number | null; divisionName: string | null } | null>;
  canUseStockCardForCore(
    params: ScopeParams & { coreId: string; stockCardId: string },
  ): Promise<boolean>;
  findTransferStockCardById(
    params: ScopeParams & { stockCardId: string; destinationCarId: string },
  ): Promise<WarehouseRequestStockCardOption | null>;
  listTransferStockCards(
    params: ScopeParams & { destinationCarId: string; search: string },
  ): Promise<WarehouseRequestStockCardOption[]>;
  listRequestStockCards(
    params: ScopeParams & { coreId: string; search: string },
  ): Promise<WarehouseRequestStockCardOption[]>;
  listPendingApproval(params: ScopeParams): Promise<WarehouseTransactionRecord[]>;
  listStockCard(params: GridListParams): Promise<{
    rows: WarehouseStockCardRecord[];
    total: number;
  }>;
  listStockCardReferences(
    params: ScopeParams & { unitId: string | null; search: string },
  ): Promise<{
    units: WarehouseStockCardUnitReference[];
    panels: WarehouseStockCardPanelReference[];
  }>;
  findStockCardUnitById(carId: string): Promise<WarehouseStockCardUnitReference | null>;
  findStockCardById(
    params: ScopeParams & { stockCardId: string },
  ): Promise<WarehouseStockCardRecord | null>;
  createStockCard(input: CreateWarehouseStockCard): Promise<WarehouseStockCardRecord>;
  updateStockCard(input: UpdateWarehouseStockCard): Promise<WarehouseStockCardRecord>;
  deleteStockCard(stockCardId: string): Promise<WarehouseStockCardRecord>;
  listItems(params: GridListParams): Promise<{
    rows: WarehouseItemRecord[];
    total: number;
  }>;
  createItem(input: CreateWarehouseItem): Promise<WarehouseItemRecord>;
  updateItem(input: UpdateWarehouseItem): Promise<WarehouseItemRecord>;
  deactivateItem(itemId: string): Promise<WarehouseItemRecord>;
  listMaterialUsage(params: GridListParams): Promise<{
    rows: WarehouseMaterialUsageRecord[];
    total: number;
  }>;
  listStorageLocations(params: GridListParams): Promise<{
    rows: WarehouseStorageLocationRecord[];
    total: number;
  }>;
  listStockOpnames(params: GridListParams): Promise<{
    rows: WarehouseStockOpnameRecord[];
    total: number;
  }>;
  listStockAdjustments(params: GridListParams): Promise<{
    rows: WarehouseStockAdjustmentRecord[];
    total: number;
  }>;
  findTransactionById(params: {
    employeeId: string;
    scope: AuthScope;
    transactionId: string;
  }): Promise<WarehouseTransactionRecord | null>;
  canAccessCar(params: { employeeId: string; scope: AuthScope; carId: string }): Promise<boolean>;
  createRequest(
    context: CreateRequestContext,
    input: CreateWarehouseRequest,
  ): Promise<WarehouseMutationResult>;
  createStockOpname(
    context: CreateRequestContext,
    input: CreateWarehouseStockOpname,
  ): Promise<WarehouseStockOpnameMutationResult>;
  createStockAdjustment(
    context: CreateRequestContext,
    input: CreateWarehouseStockAdjustment,
  ): Promise<WarehouseStockAdjustmentMutationResult>;
  updateApprovalStatus(
    transactionId: string,
    approvalStatus: WarehouseApprovalStatus,
    notes?: string | null,
  ): Promise<WarehouseMutationResult>;
  reject(
    transactionId: string,
    notes?: string | null,
  ): Promise<WarehouseMutationResult>;
  markReady(
    transactionId: string,
    notes?: string | null,
  ): Promise<WarehouseMutationResult>;
  issue(
    transactionId: string,
    input: {
      notes?: string | null;
      actualReleaseDate?: string | null;
      actorId: string;
      actorName: string;
    },
  ): Promise<WarehouseMutationResult>;
  markReturned(
    transactionId: string,
    input: {
      notes?: string | null;
      actualReturnDate?: string | null;
      qtyReturned: number | null;
      itemCondition: WarehouseTransactionRecord["itemCondition"];
    },
  ): Promise<WarehouseMutationResult>;
  markStored(
    transactionId: string,
    input: {
      notes?: string | null;
      storageLocationId: number | null;
      locationDetail?: string | null;
    },
  ): Promise<WarehouseMutationResult>;
  createStorageLocation(
    input: CreateWarehouseStorageLocation,
  ): Promise<WarehouseStorageLocationRecord>;
  updateStorageLocation(
    input: UpdateWarehouseStorageLocation,
  ): Promise<WarehouseStorageLocationRecord>;
  deactivateStorageLocation(storageLocationId: number): Promise<WarehouseStorageLocationRecord>;
  updateStockCardPhotos(
    stockCardId: string,
    photoUrls: string[],
  ): Promise<{ stockCardId: string; photoUrls: string[] }>;
}

export class MySqlWarehouseRepository implements WarehouseRepository {
  private readonly pool: Pool;
  private readonly warehouseDb: string;
  private readonly coreDb: string;

  constructor() {
    const env = getApiEnv();
    this.pool = getMySqlPool(env);
    this.warehouseDb = env.WAREHOUSE_DB_NAME;
    this.coreDb = env.CORE_DB_NAME;
  }

  private get tables() {
    return {
      transactions: qualifyTable(this.warehouseDb, "wh_transactions"),
      stockCard: qualifyTable(this.warehouseDb, "wh_stock_card"),
      itemMaster: qualifyTable(this.warehouseDb, "wh_item_master"),
      itemAliases: qualifyTable(this.warehouseDb, "wh_item_aliases"),
      materialPrices: qualifyTable(this.warehouseDb, "wh_material_prices"),
      materialUsage: qualifyTable(this.warehouseDb, "wh_material_usage"),
      storageLocations: qualifyTable(this.warehouseDb, "wh_storage_locations"),
      stockOpnames: qualifyTable(this.warehouseDb, "wh_stock_opname"),
      stockAdjustments: qualifyTable(this.warehouseDb, "wh_stock_adjustments"),
      cars: qualifyTable(this.coreDb, "cars"),
      assignments: qualifyTable(this.coreDb, "car_project_assignment"),
      countdown: qualifyTable(this.coreDb, "sm_jobdesc_countdown"),
      divisions: qualifyTable(this.coreDb, "sm_divisi"),
      masterPanels: qualifyTable(this.coreDb, "master_panels"),
    };
  }

  async getDashboard(params: ScopeParams) {
    const summaryParams: unknown[] = [];
    const summaryScope = this.buildTransactionScopeClause(
      params.scope,
      params.employeeId,
      summaryParams,
    );
    const summaryWhere = summaryScope ? `WHERE ${summaryScope}` : "";
    const lateUserParams: unknown[] = [];
    const lateScope = this.buildTransactionScopeClause(
      params.scope,
      params.employeeId,
      lateUserParams,
    );
    const lateConditions = [
      "t.deadline_date IS NOT NULL",
      "DATE(t.deadline_date) < CURRENT_DATE",
      "COALESCE(t.item_status, 'OPEN') NOT IN ('RETURNED', 'STORED')",
    ];
    if (lateScope) {
      lateConditions.push(lateScope);
    }
    const divisionParams: unknown[] = [];
    const divisionScope = this.buildTransactionScopeClause(
      params.scope,
      params.employeeId,
      divisionParams,
    );
    const divisionConditions = ["COALESCE(t.item_status, 'OPEN') = 'RELEASED'"];
    if (divisionScope) {
      divisionConditions.push(divisionScope);
    }
    const usageParams: unknown[] = [];
    const usageScope = this.buildTransactionScopeClause(
      params.scope,
      params.employeeId,
      usageParams,
      "mu",
    );
    const usageWhere = usageScope ? `WHERE ${usageScope}` : "";
    const stockParams: unknown[] = [];
    const stockScope = this.buildCarScopeClause(
      params.scope,
      params.employeeId,
      stockParams,
      "c",
    );
    const stockConditions = ["sc.status = 'IN_STORAGE'"];
    if (stockScope) {
      stockConditions.push(stockScope);
    }
    const [
      [summaryRows],
      [lateRows],
      [divisionRows],
      [usageRows],
      [stockRows],
    ] = await Promise.all([
      this.pool.query<DashboardSummaryRow[]>(
        `
          SELECT
            SUM(CASE WHEN COALESCE(t.approval_status, 'PENDING_KD') IN ('PENDING_KD', 'PENDING_KEPALA_GUDANG', 'PENDING_PPIC') THEN 1 ELSE 0 END) AS pendingApproval,
            SUM(CASE WHEN COALESCE(t.approval_status, 'PENDING_KD') = 'APPROVED' AND COALESCE(t.item_status, 'OPEN') = 'OPEN' THEN 1 ELSE 0 END) AS notPrepared,
            SUM(CASE WHEN COALESCE(t.item_status, 'OPEN') = 'READY' THEN 1 ELSE 0 END) AS notPickedUp,
            SUM(CASE WHEN COALESCE(t.item_status, 'OPEN') = 'RELEASED' THEN 1 ELSE 0 END) AS inUse,
            SUM(CASE WHEN t.deadline_date IS NOT NULL AND DATE(t.deadline_date) < CURRENT_DATE AND COALESCE(t.item_status, 'OPEN') NOT IN ('RETURNED', 'STORED') THEN 1 ELSE 0 END) AS overdueNotReturned
          FROM ${this.tables.transactions} t
          ${summaryWhere}
        `,
        summaryParams,
      ),
      this.pool.query<DashboardLateUserRow[]>(
        `
          SELECT
            t.id AS transactionId,
            COALESCE(t.employee_name, t.employee_id) AS requesterName,
            COALESCE(t.division_name, '-') AS divisionName,
            COALESCE(t.item_name, '-') AS itemName,
            COALESCE(c.unit_name, t.car_name, t.car_id, '-') AS unitName,
            GREATEST(DATEDIFF(CURRENT_DATE, DATE(t.deadline_date)), 0) AS daysOverdue
          FROM ${this.tables.transactions} t
          LEFT JOIN ${this.tables.cars} c ON c.id = t.car_id
          WHERE ${lateConditions.join(" AND ")}
          ORDER BY daysOverdue DESC, t.deadline_date ASC
          LIMIT 8
        `,
        lateUserParams,
      ),
      this.pool.query<DashboardDivisionUsageRow[]>(
        `
          SELECT
            t.division_id AS divisionId,
            COALESCE(t.division_name, '-') AS divisionName,
            COUNT(*) AS itemCount,
            COALESCE(SUM(t.qty), 0) AS totalQty
          FROM ${this.tables.transactions} t
          WHERE ${divisionConditions.join(" AND ")}
          GROUP BY t.division_id, t.division_name
          ORDER BY itemCount DESC, totalQty DESC, divisionName ASC
          LIMIT 8
        `,
        divisionParams,
      ),
      this.pool.query<DashboardMaterialOutRow[]>(
        `
          SELECT
            mu.id AS usageId,
            COALESCE(mu.division_name, '-') AS divisionName,
            COALESCE(mu.item_name, '-') AS itemName,
            mu.qty AS qty,
            mu.uom AS uom,
            DATE_FORMAT(mu.usage_date, '%Y-%m-%d') AS usageDate
          FROM ${this.tables.materialUsage} mu
          ${usageWhere}
          ORDER BY mu.usage_date DESC, mu.created_at DESC
          LIMIT 8
        `,
        usageParams,
      ),
      this.pool.query<DashboardLowStockRow[]>(
        `
          SELECT
            stock.partName AS itemName,
            (
              SELECT m.item_category
              FROM ${this.tables.itemMaster} m
              WHERE (m.item_code IS NOT NULL AND m.item_code = stock.partCode)
                 OR m.item_name = stock.partName
              ORDER BY m.updated_at DESC
              LIMIT 1
            ) AS itemCategory,
            stock.qtyAvailable AS qtyAvailable,
            stock.uom AS uom
          FROM (
            SELECT
              sc.part_name AS partName,
              MAX(sc.part_code) AS partCode,
              COALESCE(SUM(sc.qty), 0) AS qtyAvailable,
              COALESCE(MAX(sc.uom), 'pcs') AS uom
            FROM ${this.tables.stockCard} sc
            LEFT JOIN ${this.tables.cars} c ON c.id = sc.car_id
            WHERE ${stockConditions.join(" AND ")}
            GROUP BY sc.part_name
            HAVING COALESCE(SUM(sc.qty), 0) <= 10
          ) stock
          ORDER BY stock.qtyAvailable ASC, stock.partName ASC
          LIMIT 8
        `,
        stockParams,
      ),
    ]);

    return {
      summary: {
        pendingApproval: toInteger(summaryRows[0]?.pendingApproval),
        notPrepared: toInteger(summaryRows[0]?.notPrepared),
        notPickedUp: toInteger(summaryRows[0]?.notPickedUp),
        inUse: toInteger(summaryRows[0]?.inUse),
        overdueNotReturned: toInteger(summaryRows[0]?.overdueNotReturned),
      },
      lateUsers: lateRows.map(mapDashboardLateUserRow),
      divisionsUsing: divisionRows.map(mapDashboardDivisionUsageRow),
      materialsOut: usageRows.map(mapDashboardMaterialOutRow),
      lowStockAlerts: stockRows.map(mapDashboardLowStockRow),
    };
  }

  private buildTransactionScopeClause(
    scope: AuthScope,
    employeeId: string,
    params: unknown[],
    alias = "t",
  ): string {
    if (scope.canViewAllUnits) {
      return "";
    }

    const { assignments } = this.tables;
    const clauses: string[] = [`${alias}.employee_id = ?`];
    params.push(employeeId);

    if (scope.divisionIds.length > 0) {
      clauses.push(`${alias}.division_id IN (${scope.divisionIds.map(() => "?").join(", ")})`);
      params.push(...scope.divisionIds);
    }

    if (scope.unitIds.length > 0) {
      clauses.push(`${alias}.car_id IN (${scope.unitIds.map(() => "?").join(", ")})`);
      params.push(...scope.unitIds);
    }

    if (scope.canViewAssignedUnits) {
      clauses.push(
        `EXISTS (
          SELECT 1
          FROM ${assignments} assignment_scope
          WHERE assignment_scope.car_id = ${alias}.car_id
            AND assignment_scope.ended_at IS NULL
            AND (
              assignment_scope.kp_id = ?
              OR assignment_scope.advisor_id = ?
              OR assignment_scope.kd_id = ?
            )
        )`,
      );
      params.push(employeeId, employeeId, employeeId);
    }

    if (clauses.length === 0) {
      return "1 = 0";
    }

    return `(${clauses.join(" OR ")})`;
  }

  private buildCarScopeClause(
    scope: AuthScope,
    employeeId: string,
    params: unknown[],
    alias = "c",
  ): string {
    if (scope.canViewAllUnits) {
      return "";
    }

    const { assignments, countdown } = this.tables;
    const clauses: string[] = [];

    if (scope.unitIds.length > 0) {
      clauses.push(`${alias}.id IN (${scope.unitIds.map(() => "?").join(", ")})`);
      params.push(...scope.unitIds);
    }

    if (scope.divisionIds.length > 0) {
      clauses.push(
        `EXISTS (
          SELECT 1
          FROM ${countdown} cd_scope
          WHERE cd_scope.car_id = ${alias}.id
            AND cd_scope.division_id IN (${scope.divisionIds.map(() => "?").join(", ")})
        )`,
      );
      params.push(...scope.divisionIds);
    }

    if (scope.canViewAssignedUnits) {
      clauses.push(
        `EXISTS (
          SELECT 1
          FROM ${assignments} assignment_scope
          WHERE assignment_scope.car_id = ${alias}.id
            AND assignment_scope.ended_at IS NULL
            AND (
              assignment_scope.kp_id = ?
              OR assignment_scope.advisor_id = ?
              OR assignment_scope.kd_id = ?
            )
        )`,
      );
      params.push(employeeId, employeeId, employeeId);
    }

    if (clauses.length === 0) {
      return "1 = 0";
    }

    return `(${clauses.join(" OR ")})`;
  }

  private buildJobPlanScopeClause(
    scope: AuthScope,
    employeeId: string,
    params: unknown[],
    countdownAlias = "jc",
    planAlias = "p",
  ): string {
    if (scope.canViewAllUnits) {
      return "";
    }

    const { assignments } = this.tables;
    const clauses: string[] = [`${planAlias}.assigned_user_id = ?`];
    params.push(employeeId);

    if (scope.canViewAssignedUnits) {
      clauses.push(
        `EXISTS (
          SELECT 1
          FROM ${assignments} assignment_scope
          WHERE assignment_scope.car_id = ${countdownAlias}.car_id
            AND assignment_scope.ended_at IS NULL
            AND (
              assignment_scope.kp_id = ?
              OR assignment_scope.advisor_id = ?
              OR assignment_scope.kd_id = ?
            )
        )`,
      );
      params.push(employeeId, employeeId, employeeId);
    }

    if (scope.divisionIds.length > 0) {
      clauses.push(
        `${countdownAlias}.division_id IN (${scope.divisionIds.map(() => "?").join(", ")})`,
      );
      params.push(...scope.divisionIds);
    }

    if (scope.unitIds.length > 0) {
      clauses.push(
        `${countdownAlias}.car_id IN (${scope.unitIds.map(() => "?").join(", ")})`,
      );
      params.push(...scope.unitIds);
    }

    return clauses.length > 0 ? `(${clauses.join(" OR ")})` : "1 = 0";
  }

  private buildTransactionWhere(
    params: TransactionListParams,
    extraParams: unknown[],
  ): string {
    const conditions: string[] = [];
    const scopeClause = this.buildTransactionScopeClause(
      params.scope,
      params.employeeId,
      extraParams,
    );
    if (scopeClause) {
      conditions.push(scopeClause);
    }

    const view = params.query.view ?? "active";
    if (view === "active") {
      conditions.push(
        "(COALESCE(t.item_status, 'OPEN') NOT IN ('RETURNED', 'STORED') AND COALESCE(t.approval_status, 'PENDING_KD') <> 'REJECTED')",
      );
    } else if (view === "pending") {
      conditions.push("COALESCE(t.approval_status, 'PENDING_KD') IN ('PENDING_KD', 'PENDING_KEPALA_GUDANG', 'PENDING_PPIC')");
    } else if (view === "prepare") {
      conditions.push(
        "COALESCE(t.approval_status, 'PENDING_KD') = 'APPROVED' AND COALESCE(t.item_status, 'OPEN') = 'OPEN'",
      );
    } else if (view === "ready") {
      conditions.push("COALESCE(t.item_status, 'OPEN') = 'READY'");
    } else if (view === "field") {
      conditions.push("COALESCE(t.item_status, 'OPEN') = 'RELEASED'");
    } else if (view === "returned") {
      conditions.push("COALESCE(t.item_status, 'OPEN') = 'RETURNED'");
    } else if (view === "overdue") {
      conditions.push(
        "(t.deadline_date IS NOT NULL AND DATE(t.deadline_date) < CURRENT_DATE AND COALESCE(t.item_status, 'OPEN') NOT IN ('RETURNED', 'STORED'))",
      );
    }

    if (params.query.dateFrom) {
      conditions.push("DATE(t.request_date) >= ?");
      extraParams.push(params.query.dateFrom);
    }

    if (params.query.dateTo) {
      conditions.push("DATE(t.request_date) <= ?");
      extraParams.push(params.query.dateTo);
    }

    if (params.query.search) {
      const searchValue = `%${params.query.search}%`;
      conditions.push(
        `(t.item_name LIKE ? OR COALESCE(t.employee_name, '') LIKE ? OR COALESCE(t.car_name, '') LIKE ? OR COALESCE(c.unit_name, '') LIKE ?)`,
      );
      extraParams.push(searchValue, searchValue, searchValue, searchValue);
    }

    for (const filter of params.query.filters) {
      if (filter.field === "itemCategory") {
        conditions.push("t.item_category = ?");
        extraParams.push(filter.value);
      } else if (filter.field === "itemStatus") {
        conditions.push("COALESCE(t.item_status, 'OPEN') = ?");
        extraParams.push(filter.value);
      } else if (filter.field === "approvalStatus") {
        conditions.push("COALESCE(t.approval_status, 'PENDING_KD') = ?");
        extraParams.push(filter.value);
      } else if (filter.field === "transactionType") {
        conditions.push("t.transaction_type = ?");
        extraParams.push(filter.value);
      } else if (filter.field === "divisionId") {
        conditions.push("CAST(t.division_id AS CHAR) = ?");
        extraParams.push(filter.value);
      }
    }

    return conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  }

  private buildTransactionSelectSql(): string {
    const { transactions, cars, storageLocations } = this.tables;
    return `
      SELECT
        t.id AS transactionId,
        t.transaction_type AS transactionType,
        t.item_category AS itemCategory,
        COALESCE(t.item_name, '-') AS itemName,
        t.item_master_id AS itemMasterId,
        t.item_alias_used AS itemAliasUsed,
        t.qty AS qty,
        t.qty_returned AS qtyReturned,
        t.uom AS uom,
        t.car_id AS carId,
        COALESCE(c.unit_name, t.car_name, t.car_id) AS unitName,
        t.employee_id AS employeeId,
        COALESCE(t.employee_name, t.employee_id) AS requesterName,
        t.division_id AS divisionId,
        COALESCE(t.division_name, '-') AS divisionName,
        t.stock_card_id AS stockCardId,
        t.source_car_id AS sourceCarId,
        COALESCE(t.source_car_name, source_car.unit_name, t.source_car_name, source_stock.car_name, source_stock.car_id) AS sourceUnitName,
        t.storage_location_id AS storageLocationId,
        sl.label AS locationLabel,
        t.location_detail AS locationDetail,
        DATE_FORMAT(t.request_date, '%Y-%m-%d %H:%i:%s') AS requestDate,
        DATE_FORMAT(t.target_search_date, '%Y-%m-%d') AS targetSearchDate,
        DATE_FORMAT(t.actual_release_date, '%Y-%m-%d %H:%i:%s') AS actualReleaseDate,
        DATE_FORMAT(t.deadline_date, '%Y-%m-%d') AS deadlineDate,
        DATE_FORMAT(t.actual_return_date, '%Y-%m-%d %H:%i:%s') AS actualReturnDate,
        COALESCE(t.item_status, 'OPEN') AS itemStatus,
        COALESCE(t.approval_status, 'PENDING_KD') AS approvalStatus,
        t.item_condition AS itemCondition,
        t.notes AS notes,
        t.pic_warehouse_name AS picWarehouseName,
        t.acc_kd_name AS accKdName,
        COALESCE(JSON_LENGTH(t.photo_urls), 0) AS photoCount,
        CASE
          WHEN t.deadline_date IS NULL OR COALESCE(t.item_status, 'OPEN') IN ('RETURNED', 'STORED')
            THEN NULL
          ELSE GREATEST(DATEDIFF(CURRENT_DATE, DATE(t.deadline_date)), 0)
        END AS daysOverdue
      FROM ${transactions} t
      LEFT JOIN ${cars} c ON c.id = t.car_id
      LEFT JOIN ${this.tables.stockCard} source_stock ON source_stock.id = t.stock_card_id
      LEFT JOIN ${cars} source_car ON source_car.id = t.source_car_id
      LEFT JOIN ${storageLocations} sl ON sl.id = t.storage_location_id
    `;
  }

  private buildTransactionFromSql(): string {
    const { transactions, cars, storageLocations } = this.tables;
    return `
      FROM ${transactions} t
      LEFT JOIN ${cars} c ON c.id = t.car_id
      LEFT JOIN ${this.tables.stockCard} source_stock ON source_stock.id = t.stock_card_id
      LEFT JOIN ${cars} source_car ON source_car.id = t.source_car_id
      LEFT JOIN ${storageLocations} sl ON sl.id = t.storage_location_id
    `;
  }

  private buildTransactionOrder(sortBy: string, sortDirection: "asc" | "desc"): string {
    const direction = sortDirection === "asc" ? "ASC" : "DESC";
    const sortMap: Record<string, string> = {
      requestDate: "t.request_date",
      deadlineDate: "t.deadline_date",
      actualReleaseDate: "t.actual_release_date",
      unitName: "unitName",
      requesterName: "requesterName",
      itemName: "t.item_name",
      itemStatus: "itemStatus",
      approvalStatus: "approvalStatus",
      itemCategory: "t.item_category",
      transactionType: "t.transaction_type",
      qty: "t.qty",
    };

    const resolved = sortMap[sortBy] ?? "t.request_date";
    return `ORDER BY ${resolved} ${direction}, t.request_date DESC`;
  }

  async listTransactions(params: TransactionListParams) {
    const selectSql = this.buildTransactionSelectSql();
    const fromSql = this.buildTransactionFromSql();
    const whereParams: unknown[] = [];
    const whereClause = this.buildTransactionWhere(params, whereParams);
    const orderBy = this.buildTransactionOrder(
      params.query.sortBy,
      params.query.sortDirection,
    );
    const offset = (params.query.page - 1) * params.query.limit;
    const listSql = `
      ${selectSql}
      ${whereClause}
      ${orderBy}
      LIMIT ? OFFSET ?
    `;
    const listParams = [...whereParams, params.query.limit, offset];
    const countSql = `
      SELECT COUNT(*) AS total
      ${fromSql}
      ${whereClause}
    `;
    const summaryParams: unknown[] = [];
    const summaryScope = this.buildTransactionScopeClause(
      params.scope,
      params.employeeId,
      summaryParams,
    );
    const summaryWhere = summaryScope ? `WHERE ${summaryScope}` : "";
    const [[rows], [countRows], [summaryRows]] = await Promise.all([
      this.pool.query<TransactionRow[]>(listSql, listParams),
      this.pool.query<CountRow[]>(countSql, whereParams),
      this.pool.query<SummaryRow[]>(
        `
          SELECT
            SUM(CASE WHEN COALESCE(t.approval_status, 'PENDING_KD') IN ('PENDING_KD', 'PENDING_KEPALA_GUDANG', 'PENDING_PPIC') THEN 1 ELSE 0 END) AS pendingApproval,
            SUM(CASE WHEN COALESCE(t.item_status, 'OPEN') = 'READY' THEN 1 ELSE 0 END) AS readyCount,
            SUM(CASE WHEN COALESCE(t.item_status, 'OPEN') = 'RELEASED' THEN 1 ELSE 0 END) AS releasedCount,
            SUM(CASE WHEN t.deadline_date IS NOT NULL AND DATE(t.deadline_date) < CURRENT_DATE AND COALESCE(t.item_status, 'OPEN') NOT IN ('RETURNED', 'STORED') THEN 1 ELSE 0 END) AS overdueCount,
            SUM(CASE WHEN COALESCE(t.item_status, 'OPEN') = 'STORED' THEN 1 ELSE 0 END) AS storedCount
          FROM ${this.tables.transactions} t
          ${summaryWhere}
        `,
        summaryParams,
      ),
    ]);

    return {
      rows: rows.map(mapTransactionRow),
      total: toInteger(countRows[0]?.total),
      summary: {
        pendingApproval: toInteger(summaryRows[0]?.pendingApproval),
        readyCount: toInteger(summaryRows[0]?.readyCount),
        releasedCount: toInteger(summaryRows[0]?.releasedCount),
        overdueCount: toInteger(summaryRows[0]?.overdueCount),
        storedCount: toInteger(summaryRows[0]?.storedCount),
      },
    };
  }

  async listTransactionReferences(params: ScopeParams) {
    const unitParams: unknown[] = [];
    const unitScope = this.buildCarScopeClause(
      params.scope,
      params.employeeId,
      unitParams,
    );
    const unitsWhere = unitScope ? `WHERE ${unitScope}` : "";
    const divisionQuery = params.scope.canViewAllUnits
      ? this.pool.query<OptionRow[]>(
          `
            SELECT CAST(d.id AS CHAR) AS value, d.name AS label
            FROM ${this.tables.divisions} d
            ORDER BY d.name ASC
          `,
        )
      : params.scope.divisionIds.length > 0
        ? this.pool.query<OptionRow[]>(
            `
              SELECT CAST(d.id AS CHAR) AS value, d.name AS label
              FROM ${this.tables.divisions} d
              WHERE d.id IN (${params.scope.divisionIds.map(() => "?").join(", ")})
              ORDER BY d.name ASC
            `,
            params.scope.divisionIds,
          )
        : Promise.resolve<[OptionRow[], unknown]>([[], undefined]);
    const [[unitRows], [divisionRows]] = await Promise.all([
      this.pool.query<OptionRow[]>(
        `
          SELECT c.id AS value, COALESCE(c.unit_name, c.id) AS label
          FROM ${this.tables.cars} c
          ${unitsWhere}
          ORDER BY label ASC
          LIMIT 100
        `,
        unitParams,
      ),
      divisionQuery,
    ]);

    return {
      units: unitRows
        .filter((row) => row.value && row.label)
        .map((row) => ({ value: String(row.value), label: row.label ?? String(row.value) })),
      divisions: divisionRows
        .filter((row) => row.value && row.label)
        .map((row) => ({ value: String(row.value), label: row.label ?? String(row.value) })),
      itemCategories: buildOptionRows([...ITEM_CATEGORIES]),
      itemStatuses: buildOptionRows([...ITEM_STATUSES]),
      approvalStatuses: buildOptionRows([...APPROVAL_STATUSES]),
      transactionTypes: buildOptionRows([...TRANSACTION_TYPES]),
    };
  }

  async listStockCardReferences(params: ScopeParams & { unitId: string | null; search: string }) {
    const unitParams: unknown[] = [];
    const unitScope = this.buildCarScopeClause(
      params.scope,
      params.employeeId,
      unitParams,
    );
    const unitsWhere = unitScope ? `WHERE ${unitScope}` : "";
    const [unitRows] = await this.pool.query<UnitSummaryRow[]>(
      `
        SELECT c.id AS value, COALESCE(c.unit_name, c.id) AS label
        FROM ${this.tables.cars} c
        ${unitsWhere}
        ORDER BY label ASC
        LIMIT 200
      `,
      unitParams,
    );

    const units = unitRows
      .filter((row) => row.value)
      .map((row) => ({
        value: String(row.value),
        label: row.label ?? String(row.value),
      }));

    const selectedUnitId =
      params.unitId && units.some((unit) => unit.value === params.unitId)
        ? params.unitId
        : null;
    const panelParams: unknown[] = [];
    const panelConditions = [
      "mp.car_id = ?",
      "COALESCE(mp.is_active, 1) = 1",
    ];
    if (selectedUnitId) {
      panelParams.push(selectedUnitId);
    }

    if (params.search) {
      const value = `%${params.search}%`;
      panelConditions.push(
        "(CAST(mp.id AS CHAR) LIKE ? OR COALESCE(mp.section, '') LIKE ? OR COALESCE(mp.name, '') LIKE ? OR COALESCE(mp.category, '') LIKE ?)",
      );
      panelParams.push(value, value, value, value);
    }

    const [panelRows] = selectedUnitId
      ? await this.pool.query<StockCardPanelReferenceRow[]>(
          `
            SELECT
              mp.id AS panelId,
              mp.parent_id AS parentPanelId,
              CONCAT('MP-', mp.id) AS partCode,
              mp.section AS section,
              mp.name AS name,
              mp.category AS category
            FROM ${this.tables.masterPanels} mp
            WHERE ${panelConditions.join(" AND ")}
            ORDER BY COALESCE(mp.sort_order, 0) ASC, mp.section ASC, mp.name ASC
            LIMIT 200
          `,
          panelParams,
        )
      : [[] as StockCardPanelReferenceRow[], undefined];

    return {
      units,
      panels: panelRows.map((row) => ({
        panelId: Number(row.panelId),
        parentPanelId: row.parentPanelId == null ? null : Number(row.parentPanelId),
        partCode: row.partCode,
        section: row.section,
        name: row.name,
        category: row.category ?? null,
      })),
    };
  }

  async findStockCardUnitById(carId: string) {
    const [rows] = await this.pool.query<UnitSummaryRow[]>(
      `
        SELECT c.id AS value, COALESCE(c.unit_name, c.id) AS label
        FROM ${this.tables.cars} c
        WHERE c.id = ?
        LIMIT 1
      `,
      [carId],
    );
    const row = rows[0];
    return row
      ? {
          value: String(row.value),
          label: row.label ?? String(row.value),
        }
      : null;
  }

  async listPendingApproval(params: ScopeParams) {
    const query: WarehouseTransactionQuery = {
      page: 1,
      limit: 8,
      search: "",
      sortBy: "requestDate",
      sortDirection: "asc",
      view: "pending",
      filters: [],
      dateFrom: null,
      dateTo: null,
    };
    const result = await this.listTransactions({
      ...params,
      query,
    });
    return result.rows;
  }

  async listRequestJobs(
    params: ScopeParams & { date: string; isOvertime: boolean; divisionId: number | null },
  ) {
    const queryParams: unknown[] = [params.date, params.isOvertime ? 1 : 0];
    const conditions = [
      "p.task_date = ?",
      "COALESCE(p.is_overtime, 0) = ?",
      "COALESCE(p.status, 'PLAN') NOT IN ('DONE', 'REJECTED', 'CANCEL')",
    ];
    if (params.divisionId !== null) {
      conditions.push("jc.division_id = ?");
      queryParams.push(params.divisionId);
    }
    const scopeClause = this.buildJobPlanScopeClause(
      params.scope,
      params.employeeId,
      queryParams,
      "jc",
      "p",
    );
    if (scopeClause) {
      conditions.push(scopeClause);
    }

    const [rows] = await this.pool.query<WarehouseRequestJobRow[]>(
      `
        SELECT
          p.core_id AS coreId,
          jc.car_id AS carId,
          COALESCE(c.unit_name, jc.car_id) AS unitName,
          jc.division_id AS divisionId,
          d.name AS divisionName,
          COALESCE(mp.name, jc.section_name) AS panelName,
          COALESCE(mjt.job_name, p.jobdescription, jc.section_name) AS jobName,
          DATE_FORMAT(p.task_date, '%Y-%m-%d') AS taskDate,
          p.is_overtime AS isOvertime
        FROM sm_jobdesc_plan p
        JOIN sm_jobdesc_countdown jc ON jc.id = p.core_id
        LEFT JOIN cars c ON c.id = jc.car_id
        LEFT JOIN sm_divisi d ON d.id = jc.division_id
        LEFT JOIN master_panels mp ON mp.id = jc.panel_id
        LEFT JOIN master_job_types mjt ON mjt.id = jc.job_type_id
        WHERE ${conditions.join(" AND ")}
        ORDER BY COALESCE(c.unit_name, jc.car_id) ASC, COALESCE(mp.name, jc.section_name) ASC, COALESCE(mjt.job_name, p.jobdescription, jc.section_name) ASC
        LIMIT 200
      `,
      queryParams,
    );

    return rows.map(mapWarehouseRequestJobRow);
  }

  async listRequestEmployees(params: ScopeParams & { divisionId: number | null }) {
    const queryParams: unknown[] = [];
    const conditions = ["e.is_active = 1", "e.division_id IS NOT NULL"];

    if (params.divisionId !== null) {
      conditions.push("e.division_id = ?");
      queryParams.push(params.divisionId);
    }

    if (!params.scope.canViewAllUnits) {
      const allowedDivisionIds = Array.from(
        new Set([...params.scope.divisionIds, ...params.scope.managedDivisionIds]),
      );
      if (allowedDivisionIds.length > 0) {
        conditions.push(`e.division_id IN (${allowedDivisionIds.map(() => "?").join(", ")})`);
        queryParams.push(...allowedDivisionIds);
      } else {
        conditions.push("1 = 0");
      }
    }

    const [rows] = await this.pool.query<WarehouseRequestEmployeeRow[]>(
      `
        SELECT
          e.employee_id AS value,
          CONCAT(e.full_name, ' · ', e.employee_id) AS label,
          e.division_id AS divisionId,
          d.name AS divisionName
        FROM sm_employee e
        LEFT JOIN sm_divisi d ON d.id = e.division_id
        WHERE ${conditions.join(" AND ")}
        ORDER BY e.full_name ASC
        LIMIT 100
      `,
      queryParams,
    );

    return rows
      .filter((row) => row.value && row.label)
      .map((row) => ({ value: row.value, label: row.label ?? row.value }));
  }

  async findRequestJobByCoreId(params: ScopeParams & { coreId: string }) {
    const queryParams: unknown[] = [params.coreId];
    const conditions = [
      "p.core_id = ?",
      "COALESCE(p.status, 'PLAN') NOT IN ('DONE', 'REJECTED', 'CANCEL')",
    ];
    const scopeClause = this.buildJobPlanScopeClause(
      params.scope,
      params.employeeId,
      queryParams,
      "jc",
      "p",
    );
    if (scopeClause) {
      conditions.push(scopeClause);
    }

    const [rows] = await this.pool.query<WarehouseRequestJobRow[]>(
      `
        SELECT
          p.core_id AS coreId,
          jc.car_id AS carId,
          COALESCE(c.unit_name, jc.car_id) AS unitName,
          jc.division_id AS divisionId,
          d.name AS divisionName,
          COALESCE(mp.name, jc.section_name) AS panelName,
          COALESCE(mjt.job_name, p.jobdescription, jc.section_name) AS jobName,
          DATE_FORMAT(p.task_date, '%Y-%m-%d') AS taskDate,
          p.is_overtime AS isOvertime
        FROM sm_jobdesc_plan p
        JOIN sm_jobdesc_countdown jc ON jc.id = p.core_id
        LEFT JOIN cars c ON c.id = jc.car_id
        LEFT JOIN sm_divisi d ON d.id = jc.division_id
        LEFT JOIN master_panels mp ON mp.id = jc.panel_id
        LEFT JOIN master_job_types mjt ON mjt.id = jc.job_type_id
        WHERE ${conditions.join(" AND ")}
        ORDER BY p.task_date DESC, p.created_at DESC
        LIMIT 1
      `,
      queryParams,
    );

    return rows[0] ? mapWarehouseRequestJobRow(rows[0]) : null;
  }

  async findDivisionNameById(divisionId: number) {
    const [rows] = await this.pool.query<OptionRow[]>(
      `
        SELECT d.name AS label
        FROM ${this.tables.divisions} d
        WHERE d.id = ?
        LIMIT 1
      `,
      [divisionId],
    );

    return rows[0]?.label ?? null;
  }

  async findRequestEmployeeById(employeeId: string) {
    const [rows] = await this.pool.query<WarehouseRequestEmployeeRow[]>(
      `
        SELECT
          e.employee_id AS value,
          e.full_name AS label,
          e.division_id AS divisionId,
          d.name AS divisionName
        FROM sm_employee e
        LEFT JOIN sm_divisi d ON d.id = e.division_id
        WHERE e.employee_id = ?
        LIMIT 1
      `,
      [employeeId],
    );

    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      employeeId: row.value,
      fullName: row.label ?? row.value,
      divisionId: row.divisionId ?? null,
      divisionName: row.divisionName ?? null,
    };
  }

  async canUseStockCardForCore(
    params: ScopeParams & { coreId: string; stockCardId: string },
  ) {
    const queryParams: unknown[] = [params.coreId, params.stockCardId];
    const scopeClause = this.buildCarScopeClause(
      params.scope,
      params.employeeId,
      queryParams,
      "c_scope",
    );
    const conditions = [
      "jc.id = ?",
      "sc.id = ?",
      "sc.car_id = jc.car_id",
      "sc.status = 'IN_STORAGE'",
    ];
    if (scopeClause) {
      conditions.push(scopeClause);
    }

    const [rows] = await this.pool.query<CountRow[]>(
      `
        SELECT COUNT(*) AS total
        FROM ${this.tables.countdown} jc
        JOIN ${this.tables.stockCard} sc ON sc.car_id = jc.car_id
        LEFT JOIN ${this.tables.cars} c_scope ON c_scope.id = jc.car_id
        WHERE ${conditions.join(" AND ")}
      `,
      queryParams,
    );

    return toInteger(rows[0]?.total) > 0;
  }

  async findTransferStockCardById(
    params: ScopeParams & { stockCardId: string; destinationCarId: string },
  ) {
    const rows = await this.listTransferStockCards({
      employeeId: params.employeeId,
      scope: params.scope,
      destinationCarId: params.destinationCarId,
      search: "",
    });

    return rows.find((row) => row.stockCardId === params.stockCardId) ?? null;
  }

  async listTransferStockCards(
    params: ScopeParams & { destinationCarId: string; search: string },
  ) {
    const queryParams: unknown[] = [params.destinationCarId];
    const scopeClause = this.buildCarScopeClause(
      params.scope,
      params.employeeId,
      queryParams,
      "c_scope",
    );
    const conditions = ["sc.status = 'IN_STORAGE'", "sc.car_id <> ?"];
    if (scopeClause) {
      conditions.push(scopeClause);
    }
    if (params.search) {
      const value = `%${params.search}%`;
      conditions.push(
        "(COALESCE(sc.entry_no, '') LIKE ? OR COALESCE(sc.part_code, '') LIKE ? OR COALESCE(sc.part_name, '') LIKE ? OR COALESCE(c.unit_name, '') LIKE ?)",
      );
      queryParams.push(value, value, value, value);
    }

    const [rows] = await this.pool.query<WarehouseRequestStockCardRow[]>(
      `
        SELECT
          sc.id AS stockCardId,
          sc.entry_no AS entryNo,
          sc.car_id AS carId,
          COALESCE(c.unit_name, sc.car_name, sc.car_id) AS unitName,
          mp.id AS masterPanelId,
          mp.parent_id AS parentPanelId,
          COALESCE(parent_mp.name, CASE WHEN mp.parent_id IS NULL THEN mp.name ELSE NULL END) AS panelName,
          sc.part_code AS partCode,
          sc.panel_section AS panelSection,
          mp.category AS panelCategory,
          sc.part_name AS partName,
          sc.condition_type AS conditionType,
          sc.qty AS qty,
          sc.uom AS uom,
          sc.storage_location_id AS storageLocationId,
          sl.label AS locationLabel,
          sc.location_detail AS locationDetail,
          DATE_FORMAT(sc.date_in, '%Y-%m-%d') AS dateIn,
          DATE_FORMAT(sc.date_out, '%Y-%m-%d') AS dateOut,
          sc.taken_by_name AS takenByName,
          sc.status AS status,
          sc.is_labeled AS isLabeled,
          (
            SELECT m.item_category
            FROM ${this.tables.itemMaster} m
            WHERE (m.item_code IS NOT NULL AND m.item_code = sc.part_code)
               OR m.item_name = sc.part_name
            ORDER BY m.updated_at DESC
            LIMIT 1
          ) AS itemCategory,
          sc.photo_urls AS photoUrls,
          (
            SELECT m.id
            FROM ${this.tables.itemMaster} m
            WHERE (m.item_code IS NOT NULL AND m.item_code = sc.part_code)
               OR m.item_name = sc.part_name
            ORDER BY m.updated_at DESC
            LIMIT 1
          ) AS itemMasterId
        FROM ${this.tables.stockCard} sc
        LEFT JOIN ${this.tables.storageLocations} sl ON sl.id = sc.storage_location_id
        LEFT JOIN ${this.tables.cars} c ON c.id = sc.car_id
        LEFT JOIN ${this.tables.masterPanels} mp ON mp.car_id = sc.car_id AND sc.part_code = CONCAT('MP-', mp.id)
        LEFT JOIN ${this.tables.masterPanels} parent_mp ON parent_mp.id = mp.parent_id
        LEFT JOIN ${this.tables.cars} c_scope ON c_scope.id = sc.car_id
        WHERE ${conditions.join(" AND ")}
        ORDER BY COALESCE(c.unit_name, sc.car_name, sc.car_id) ASC, sc.part_name ASC, sc.created_at DESC
        LIMIT 200
      `,
      queryParams,
    );

    return rows
      .map(mapWarehouseRequestStockCardRow)
      .filter((row) => row.itemCategory === "SPARE_PART");
  }

  async listRequestStockCards(
    params: ScopeParams & { coreId: string; search: string },
  ) {
    const queryParams: unknown[] = [params.coreId];
    const scopeClause = this.buildCarScopeClause(
      params.scope,
      params.employeeId,
      queryParams,
      "c_scope",
    );
    const conditions = [
      "jc.id = ?",
      "sc.status = 'IN_STORAGE'",
    ];
    if (scopeClause) {
      conditions.push(scopeClause);
    }
    if (params.search) {
      const value = `%${params.search}%`;
      conditions.push(
        "(COALESCE(sc.entry_no, '') LIKE ? OR COALESCE(sc.part_code, '') LIKE ? OR COALESCE(sc.part_name, '') LIKE ?)",
      );
      queryParams.push(value, value, value);
    }

    const [rows] = await this.pool.query<WarehouseRequestStockCardRow[]>(
      `
        SELECT
          sc.id AS stockCardId,
          sc.entry_no AS entryNo,
          sc.car_id AS carId,
          COALESCE(c.unit_name, sc.car_name, sc.car_id) AS unitName,
          sc.part_code AS partCode,
          sc.panel_section AS panelSection,
          mp.category AS panelCategory,
          sc.part_name AS partName,
          sc.condition_type AS conditionType,
          sc.qty AS qty,
          sc.uom AS uom,
          sc.storage_location_id AS storageLocationId,
          sl.label AS locationLabel,
          sc.location_detail AS locationDetail,
          DATE_FORMAT(sc.date_in, '%Y-%m-%d') AS dateIn,
          DATE_FORMAT(sc.date_out, '%Y-%m-%d') AS dateOut,
          sc.taken_by_name AS takenByName,
          sc.status AS status,
          sc.is_labeled AS isLabeled,
          (
            SELECT m.id
            FROM ${this.tables.itemMaster} m
            WHERE (m.item_code IS NOT NULL AND m.item_code = sc.part_code)
               OR m.item_name = sc.part_name
            ORDER BY m.updated_at DESC
            LIMIT 1
          ) AS itemMasterId
        FROM ${this.tables.stockCard} sc
        JOIN ${this.tables.countdown} jc ON jc.car_id = sc.car_id
        LEFT JOIN ${this.tables.storageLocations} sl ON sl.id = sc.storage_location_id
        LEFT JOIN ${this.tables.cars} c ON c.id = sc.car_id
        LEFT JOIN ${this.tables.masterPanels} mp ON mp.car_id = sc.car_id AND sc.part_code = CONCAT('MP-', mp.id)
        LEFT JOIN ${this.tables.cars} c_scope ON c_scope.id = jc.car_id
        WHERE ${conditions.join(" AND ")}
        ORDER BY sc.part_name ASC, sc.created_at DESC
        LIMIT 200
      `,
      queryParams,
    );

    return rows.map(mapWarehouseRequestStockCardRow);
  }

  async listStockCard(params: GridListParams) {
    const scopeParams: unknown[] = [];
    const scopeClause = this.buildCarScopeClause(
      params.scope,
      params.employeeId,
      scopeParams,
      "c",
    );
    const conditions: string[] = [];
    if (scopeClause) {
      conditions.push(scopeClause);
    }

    if (params.query.search) {
      const value = `%${params.query.search}%`;
      conditions.push(
        "(COALESCE(sc.entry_no, '') LIKE ? OR COALESCE(sc.part_code, '') LIKE ? OR COALESCE(sc.part_name, '') LIKE ? OR COALESCE(c.unit_name, '') LIKE ?)",
      );
      scopeParams.push(value, value, value, value);
    }

    for (const filter of params.query.filters) {
      if (filter.field === "itemCategory") {
        conditions.push(
          filter.value === "SPARE_PART"
            ? `(
              (
                SELECT m.item_category
                FROM ${this.tables.itemMaster} m
                WHERE (m.item_code IS NOT NULL AND m.item_code = sc.part_code)
                   OR m.item_name = sc.part_name
                ORDER BY m.updated_at DESC
                LIMIT 1
              ) = ?
              OR sc.part_code LIKE 'MP-%'
            )`
            : `(
              SELECT m.item_category
              FROM ${this.tables.itemMaster} m
              WHERE (m.item_code IS NOT NULL AND m.item_code = sc.part_code)
                 OR m.item_name = sc.part_name
              ORDER BY m.updated_at DESC
              LIMIT 1
            ) = ?`,
        );
        scopeParams.push(filter.value);
      } else if (filter.field === "status") {
        conditions.push("sc.status = ?");
        scopeParams.push(filter.value);
      } else if (filter.field === "storageLocationId") {
        conditions.push("sc.storage_location_id = ?");
        scopeParams.push(Number.parseInt(filter.value, 10));
      } else if (filter.field === "unitId") {
        conditions.push("sc.car_id = ?");
        scopeParams.push(filter.value);
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const sortMap: Record<string, string> = {
      dateIn: "sc.date_in",
      entryNo: "sc.entry_no",
      unitName: "unitName",
      partName: "sc.part_name",
      status: "sc.status",
    };
    const sortColumn = sortMap[params.query.sortBy] ?? "sc.date_in";
    const direction = params.query.sortDirection === "asc" ? "ASC" : "DESC";
    const offset = (params.query.page - 1) * params.query.limit;

    const sql = `
      SELECT
        sc.id AS stockCardId,
        sc.entry_no AS entryNo,
        sc.car_id AS carId,
        COALESCE(c.unit_name, sc.car_name, sc.car_id) AS unitName,
        mp.id AS masterPanelId,
        mp.parent_id AS parentPanelId,
        COALESCE(parent_mp.name, CASE WHEN mp.parent_id IS NULL THEN mp.name ELSE NULL END) AS panelName,
        sc.part_code AS partCode,
        sc.panel_section AS panelSection,
        mp.category AS panelCategory,
        sc.part_name AS partName,
        sc.condition_type AS conditionType,
        sc.qty AS qty,
        sc.uom AS uom,
        sc.storage_location_id AS storageLocationId,
        sl.label AS locationLabel,
        sc.location_detail AS locationDetail,
        DATE_FORMAT(sc.date_in, '%Y-%m-%d') AS dateIn,
        DATE_FORMAT(sc.date_out, '%Y-%m-%d') AS dateOut,
        sc.taken_by_name AS takenByName,
        sc.status AS status,
        sc.is_labeled AS isLabeled,
        (
          SELECT m.item_category
          FROM ${this.tables.itemMaster} m
          WHERE (m.item_code IS NOT NULL AND m.item_code = sc.part_code)
             OR m.item_name = sc.part_name
          ORDER BY m.updated_at DESC
          LIMIT 1
        ) AS itemCategory,
        sc.photo_urls AS photoUrls
      FROM ${this.tables.stockCard} sc
      LEFT JOIN ${this.tables.storageLocations} sl ON sl.id = sc.storage_location_id
      LEFT JOIN ${this.tables.cars} c ON c.id = sc.car_id
      LEFT JOIN ${this.tables.masterPanels} mp ON mp.car_id = sc.car_id AND sc.part_code = CONCAT('MP-', mp.id)
      LEFT JOIN ${this.tables.masterPanels} parent_mp ON parent_mp.id = mp.parent_id
      ${whereClause}
      ORDER BY ${sortColumn} ${direction}, sc.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const [rows] = await this.pool.query<StockCardRow[]>(sql, [
      ...scopeParams,
      params.query.limit,
      offset,
    ]);

    const [countRows] = await this.pool.query<CountRow[]>(
      `
        SELECT COUNT(*) AS total
        FROM ${this.tables.stockCard} sc
        LEFT JOIN ${this.tables.cars} c ON c.id = sc.car_id
        ${whereClause}
      `,
      scopeParams,
    );

    return {
      rows: rows.map(mapStockCardRow),
      total: toInteger(countRows[0]?.total),
    };
  }

  async findStockCardById(params: ScopeParams & { stockCardId: string }) {
    const queryParams: unknown[] = [params.stockCardId];
    const scopeClause = this.buildCarScopeClause(
      params.scope,
      params.employeeId,
      queryParams,
      "c",
    );
    const conditions = ["sc.id = ?"];
    if (scopeClause) {
      conditions.push(scopeClause);
    }

    const [rows] = await this.pool.query<StockCardRow[]>(
      `
        SELECT
          sc.id AS stockCardId,
          sc.entry_no AS entryNo,
          sc.car_id AS carId,
          COALESCE(c.unit_name, sc.car_name, sc.car_id) AS unitName,
          sc.part_code AS partCode,
          sc.panel_section AS panelSection,
          mp.category AS panelCategory,
          sc.part_name AS partName,
          sc.condition_type AS conditionType,
          sc.qty AS qty,
          sc.uom AS uom,
          sc.storage_location_id AS storageLocationId,
          sl.label AS locationLabel,
          sc.location_detail AS locationDetail,
          DATE_FORMAT(sc.date_in, '%Y-%m-%d') AS dateIn,
          DATE_FORMAT(sc.date_out, '%Y-%m-%d') AS dateOut,
          sc.taken_by_name AS takenByName,
          sc.status AS status,
          sc.is_labeled AS isLabeled,
          (
            SELECT m.item_category
            FROM ${this.tables.itemMaster} m
            WHERE (m.item_code IS NOT NULL AND m.item_code = sc.part_code)
               OR m.item_name = sc.part_name
            ORDER BY m.updated_at DESC
            LIMIT 1
          ) AS itemCategory,
          sc.photo_urls AS photoUrls
        FROM ${this.tables.stockCard} sc
        LEFT JOIN ${this.tables.storageLocations} sl ON sl.id = sc.storage_location_id
        LEFT JOIN ${this.tables.cars} c ON c.id = sc.car_id
        LEFT JOIN ${this.tables.masterPanels} mp ON mp.car_id = sc.car_id AND sc.part_code = CONCAT('MP-', mp.id)
        WHERE ${conditions.join(" AND ")}
        LIMIT 1
      `,
      queryParams,
    );

    return rows[0] ? mapStockCardRow(rows[0]) : null;
  }

  async createStockCard(input: CreateWarehouseStockCard) {
    const stockCardId = randomUUID();
    const unit = await this.findStockCardUnitById(input.carId);
    if (!unit) {
      throw new Error("UNIT_NOT_FOUND");
    }
    const panel = await this.resolveStockCardMasterPanel(input);
    const [entryRows] = await this.pool.query<Array<RowDataPacket & { nextEntryNo: number }>>(
      `
        SELECT COALESCE(MAX(entry_no), 0) + 1 AS nextEntryNo
        FROM ${this.tables.stockCard}
        WHERE car_id <=> ?
      `,
      [input.carId],
    );

    await this.pool.execute(
      `
        INSERT INTO ${this.tables.stockCard} (
          id,
          entry_no,
          car_id,
          car_name,
          part_code,
          panel_section,
          part_name,
          condition_type,
          qty,
          uom,
          storage_location_id,
          location_detail,
          date_in,
          date_out,
          taken_by_name,
          status,
          is_labeled,
          photo_urls,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_DATE), ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `,
      [
        stockCardId,
        Number(entryRows[0]?.nextEntryNo ?? 1),
        input.carId,
        unit.label,
        panel.partCode,
        panel.section,
        panel.name,
        input.conditionType,
        input.qty,
        input.uom,
        input.storageLocationId,
        input.locationDetail,
        input.dateIn,
        input.dateOut,
        input.takenByName,
        input.status,
        input.isLabeled ? 1 : 0,
        JSON.stringify(input.photoUrls),
      ],
    );

    return this.readStockCard(stockCardId);
  }

  async updateStockCard(input: UpdateWarehouseStockCard) {
    const unit = await this.findStockCardUnitById(input.carId);
    if (!unit) {
      throw new Error("UNIT_NOT_FOUND");
    }
    const panel = await this.resolveStockCardMasterPanel(input);
    await this.pool.execute(
      `
        UPDATE ${this.tables.stockCard}
        SET
          car_id = ?,
          car_name = ?,
          part_code = ?,
          panel_section = ?,
          part_name = ?,
          condition_type = ?,
          qty = ?,
          uom = ?,
          storage_location_id = ?,
          location_detail = ?,
          date_in = ?,
          date_out = ?,
          taken_by_name = ?,
          status = ?,
          is_labeled = ?,
          photo_urls = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [
        input.carId,
        unit.label,
        panel.partCode,
        panel.section,
        panel.name,
        input.conditionType,
        input.qty,
        input.uom,
        input.storageLocationId,
        input.locationDetail,
        input.dateIn,
        input.dateOut,
        input.takenByName,
        input.status,
        input.isLabeled ? 1 : 0,
        JSON.stringify(input.photoUrls),
        input.stockCardId,
      ],
    );

    return this.readStockCard(input.stockCardId);
  }

  async deleteStockCard(stockCardId: string) {
    const current = await this.readStockCard(stockCardId);
    const [usageRows] = await this.pool.query<CountRow[]>(
      `
        SELECT (
          (SELECT COUNT(*) FROM ${this.tables.transactions} WHERE stock_card_id = ?)
          + (SELECT COUNT(*) FROM ${this.tables.stockOpnames} WHERE stock_card_id = ?)
          + (SELECT COUNT(*) FROM ${this.tables.stockAdjustments} WHERE stock_card_id = ?)
        ) AS total
      `,
      [stockCardId, stockCardId, stockCardId],
    );

    if (toInteger(usageRows[0]?.total) > 0) {
      throw new Error("WAREHOUSE_STOCK_CARD_IN_USE");
    }

    await this.pool.execute(
      `
        DELETE FROM ${this.tables.stockCard}
        WHERE id = ?
        LIMIT 1
      `,
      [stockCardId],
    );

    return current;
  }

  async listItems(params: GridListParams) {
    const conditions: string[] = [];
    const queryParams: unknown[] = [];

    if (params.query.search) {
      const value = `%${params.query.search}%`;
      conditions.push(
        `(
          m.item_name LIKE ?
          OR COALESCE(m.item_code, '') LIKE ?
          OR EXISTS (
            SELECT 1
            FROM ${this.tables.itemAliases} alias_scope
            WHERE alias_scope.item_id = m.id
              AND alias_scope.alias LIKE ?
          )
        )`,
      );
      queryParams.push(value, value, value);
    }

    for (const filter of params.query.filters) {
      if (filter.field === "itemCategory") {
        conditions.push("m.item_category = ?");
        queryParams.push(filter.value);
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const sortMap: Record<string, string> = {
      itemName: "m.item_name",
      itemCode: "m.item_code",
      itemCategory: "m.item_category",
      latestPrice: "latestPrice",
      usageCount: "usageCount",
      updatedAt: "m.updated_at",
    };
    const sortColumn = sortMap[params.query.sortBy] ?? "m.item_name";
    const direction = params.query.sortDirection === "asc" ? "ASC" : "DESC";
    const offset = (params.query.page - 1) * params.query.limit;

    const sql = `
      SELECT
        m.id AS itemId,
        m.item_code AS itemCode,
        m.item_name AS itemName,
        m.item_category AS itemCategory,
        m.uom AS uom,
        m.description AS description,
        m.is_active AS isActive,
        (
          SELECT COUNT(*)
          FROM ${this.tables.itemAliases} alias_count
          WHERE alias_count.item_id = m.id
        ) AS aliasCount,
        (
          SELECT mp.price_per_unit
          FROM ${this.tables.materialPrices} mp
          WHERE (mp.item_code = m.item_code OR mp.item_name = m.item_name)
          ORDER BY mp.effective_date DESC, mp.created_at DESC
          LIMIT 1
        ) AS latestPrice,
        (
          SELECT mp.vendor_name
          FROM ${this.tables.materialPrices} mp
          WHERE (mp.item_code = m.item_code OR mp.item_name = m.item_name)
          ORDER BY mp.effective_date DESC, mp.created_at DESC
          LIMIT 1
        ) AS latestVendorName,
        (
          SELECT COUNT(*)
          FROM ${this.tables.materialUsage} mu
          WHERE mu.item_name = m.item_name
        ) AS usageCount,
        (
          SELECT DATE_FORMAT(MAX(mu.usage_date), '%Y-%m-%d')
          FROM ${this.tables.materialUsage} mu
          WHERE mu.item_name = m.item_name
        ) AS lastUsedAt,
        DATE_FORMAT(m.updated_at, '%Y-%m-%d %H:%i:%s') AS updatedAt
      FROM ${this.tables.itemMaster} m
      ${whereClause}
      ORDER BY ${sortColumn} ${direction}, m.item_name ASC
      LIMIT ? OFFSET ?
    `;

    const [rows] = await this.pool.query<ItemRow[]>(sql, [
      ...queryParams,
      params.query.limit,
      offset,
    ]);

    const [countRows] = await this.pool.query<CountRow[]>(
      `
        SELECT COUNT(*) AS total
        FROM ${this.tables.itemMaster} m
        ${whereClause}
      `,
      queryParams,
    );

    return {
      rows: rows.map(mapItemRow),
      total: toInteger(countRows[0]?.total),
    };
  }

  async createItem(input: CreateWarehouseItem) {
    const itemId = randomUUID();
    await this.pool.execute(
      `
        INSERT INTO ${this.tables.itemMaster} (
          id,
          item_code,
          item_name,
          item_category,
          uom,
          description,
          is_active,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `,
      [
        itemId,
        input.itemCode ?? null,
        input.itemName,
        input.itemCategory,
        input.uom ?? null,
        input.description ?? null,
        input.isActive ? 1 : 0,
      ],
    );

    return this.readItem(itemId);
  }

  async updateItem(input: UpdateWarehouseItem) {
    await this.pool.execute(
      `
        UPDATE ${this.tables.itemMaster}
        SET
          item_code = ?,
          item_name = ?,
          item_category = ?,
          uom = ?,
          description = ?,
          is_active = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [
        input.itemCode ?? null,
        input.itemName,
        input.itemCategory,
        input.uom ?? null,
        input.description ?? null,
        input.isActive ? 1 : 0,
        input.itemId,
      ],
    );

    return this.readItem(input.itemId);
  }

  async deactivateItem(itemId: string) {
    await this.pool.execute(
      `
        UPDATE ${this.tables.itemMaster}
        SET is_active = 0,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [itemId],
    );

    return this.readItem(itemId);
  }

  async listMaterialUsage(params: GridListParams) {
    const queryParams: unknown[] = [];
    const conditions: string[] = [];
    const scopeClause = this.buildTransactionScopeClause(
      params.scope,
      params.employeeId,
      queryParams,
      "mu",
    );
    if (scopeClause) {
      conditions.push(scopeClause);
    }

    if (params.query.search) {
      const value = `%${params.query.search}%`;
      conditions.push(
        "(mu.item_name LIKE ? OR COALESCE(mu.employee_name, '') LIKE ? OR COALESCE(c.unit_name, '') LIKE ?)",
      );
      queryParams.push(value, value, value);
    }

    for (const filter of params.query.filters) {
      if (filter.field === "itemCategory") {
        conditions.push("mu.item_category = ?");
        queryParams.push(filter.value);
      } else if (filter.field === "divisionId") {
        conditions.push("CAST(mu.division_id AS CHAR) = ?");
        queryParams.push(filter.value);
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const sortMap: Record<string, string> = {
      usageDate: "mu.usage_date",
      unitName: "unitName",
      divisionName: "mu.division_name",
      employeeName: "mu.employee_name",
      itemName: "mu.item_name",
      totalPrice: "mu.total_price",
    };
    const sortColumn = sortMap[params.query.sortBy] ?? "mu.usage_date";
    const direction = params.query.sortDirection === "asc" ? "ASC" : "DESC";
    const offset = (params.query.page - 1) * params.query.limit;

    const sql = `
      SELECT
        mu.id AS usageId,
        mu.countdown_id AS countdownId,
        mu.car_id AS carId,
        COALESCE(c.unit_name, mu.car_name, mu.car_id) AS unitName,
        mu.division_id AS divisionId,
        COALESCE(mu.division_name, '-') AS divisionName,
        mu.employee_id AS employeeId,
        mu.employee_name AS employeeName,
        mu.warehouse_trx_id AS warehouseTransactionId,
        mu.item_name AS itemName,
        mu.item_category AS itemCategory,
        mu.qty AS qty,
        mu.uom AS uom,
        mu.price_per_unit AS pricePerUnit,
        mu.total_price AS totalPrice,
        DATE_FORMAT(mu.usage_date, '%Y-%m-%d') AS usageDate,
        mu.notes AS notes
      FROM ${this.tables.materialUsage} mu
      LEFT JOIN ${this.tables.cars} c ON c.id = mu.car_id
      ${whereClause}
      ORDER BY ${sortColumn} ${direction}, mu.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const [rows] = await this.pool.query<MaterialUsageRow[]>(sql, [
      ...queryParams,
      params.query.limit,
      offset,
    ]);

    const [countRows] = await this.pool.query<CountRow[]>(
      `
        SELECT COUNT(*) AS total
        FROM ${this.tables.materialUsage} mu
        LEFT JOIN ${this.tables.cars} c ON c.id = mu.car_id
        ${whereClause}
      `,
      queryParams,
    );

    return {
      rows: rows.map(mapMaterialUsageRow),
      total: toInteger(countRows[0]?.total),
    };
  }

  async listStorageLocations(params: GridListParams) {
    const queryParams: unknown[] = [];
    const conditions: string[] = [];

    if (params.query.search) {
      const value = `%${params.query.search}%`;
      conditions.push(
        "(sl.label LIKE ? OR COALESCE(sl.zone, '') LIKE ? OR COALESCE(sl.rack, '') LIKE ? OR COALESCE(sl.shelf, '') LIKE ?)",
      );
      queryParams.push(value, value, value, value);
    }

    for (const filter of params.query.filters) {
      if (filter.field === "locationType") {
        conditions.push("sl.location_type = ?");
        queryParams.push(filter.value);
      } else if (filter.field === "isActive") {
        conditions.push("sl.is_active = ?");
        queryParams.push(filter.value === "1" ? 1 : 0);
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const sortMap: Record<string, string> = {
      label: "sl.label",
      locationType: "sl.location_type",
      zone: "sl.zone",
      rack: "sl.rack",
      itemCount: "itemCount",
    };
    const sortColumn = sortMap[params.query.sortBy] ?? "sl.label";
    const direction = params.query.sortDirection === "asc" ? "ASC" : "DESC";
    const offset = (params.query.page - 1) * params.query.limit;

    const sql = `
      SELECT
        sl.id AS storageLocationId,
        sl.location_type AS locationType,
        sl.zone AS zone,
        sl.rack AS rack,
        sl.shelf AS shelf,
        sl.label AS label,
        sl.is_active AS isActive,
        (
          SELECT COUNT(*)
          FROM ${this.tables.stockCard} sc
          WHERE sc.storage_location_id = sl.id
            AND sc.status = 'IN_STORAGE'
        ) AS itemCount
      FROM ${this.tables.storageLocations} sl
      ${whereClause}
      ORDER BY ${sortColumn} ${direction}, sl.label ASC
      LIMIT ? OFFSET ?
    `;

    const [rows] = await this.pool.query<StorageLocationRow[]>(sql, [
      ...queryParams,
      params.query.limit,
      offset,
    ]);

    const [countRows] = await this.pool.query<CountRow[]>(
      `
        SELECT COUNT(*) AS total
        FROM ${this.tables.storageLocations} sl
        ${whereClause}
      `,
      queryParams,
    );

    return {
      rows: rows.map(mapStorageLocationRow),
      total: toInteger(countRows[0]?.total),
    };
  }

  async listStockOpnames(params: GridListParams) {
    const queryParams: unknown[] = [];
    const conditions: string[] = [];
    const scopeClause = this.buildCarScopeClause(
      params.scope,
      params.employeeId,
      queryParams,
      "c",
    );
    if (scopeClause) {
      conditions.push("(o.car_id IS NULL OR " + scopeClause + ")");
    }

    if (params.query.search) {
      const value = `%${params.query.search}%`;
      conditions.push(
        "(o.opname_no LIKE ? OR o.item_name LIKE ? OR COALESCE(o.part_code, '') LIKE ? OR COALESCE(c.unit_name, '') LIKE ?)",
      );
      queryParams.push(value, value, value, value);
    }

    for (const filter of params.query.filters) {
      if (filter.field === "divisionId") {
        conditions.push("CAST(o.division_id AS CHAR) = ?");
        queryParams.push(filter.value);
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const sortMap: Record<string, string> = {
      countedAt: "o.counted_at",
      unitName: "unitName",
      itemName: "o.item_name",
      expectedQty: "o.expected_qty",
      actualQty: "o.actual_qty",
      varianceQty: "o.variance_qty",
      findingStatus: "o.finding_status",
    };
    const sortColumn = sortMap[params.query.sortBy] ?? "o.counted_at";
    const direction = params.query.sortDirection === "asc" ? "ASC" : "DESC";
    const offset = (params.query.page - 1) * params.query.limit;

    const sql = `
      SELECT
        o.id AS opnameId,
        o.opname_no AS opnameNo,
        o.stock_card_id AS stockCardId,
        o.car_id AS carId,
        COALESCE(c.unit_name, o.unit_name, o.car_id) AS unitName,
        o.item_name AS itemName,
        o.part_code AS partCode,
        o.uom AS uom,
        o.storage_location_id AS storageLocationId,
        sl.label AS locationLabel,
        o.expected_qty AS expectedQty,
        o.actual_qty AS actualQty,
        o.variance_qty AS varianceQty,
        o.finding_status AS findingStatus,
        o.item_condition AS itemCondition,
        DATE_FORMAT(o.counted_at, '%Y-%m-%d') AS countedAt,
        o.counted_by_name AS countedByName,
        o.notes AS notes
      FROM ${this.tables.stockOpnames} o
      LEFT JOIN ${this.tables.cars} c ON c.id = o.car_id
      LEFT JOIN ${this.tables.storageLocations} sl ON sl.id = o.storage_location_id
      ${whereClause}
      ORDER BY ${sortColumn} ${direction}, o.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const [rows] = await this.pool.query<StockOpnameRow[]>(sql, [
      ...queryParams,
      params.query.limit,
      offset,
    ]);

    const [countRows] = await this.pool.query<CountRow[]>(
      `
        SELECT COUNT(*) AS total
        FROM ${this.tables.stockOpnames} o
        LEFT JOIN ${this.tables.cars} c ON c.id = o.car_id
        ${whereClause}
      `,
      queryParams,
    );

    return {
      rows: rows.map(mapStockOpnameRow),
      total: toInteger(countRows[0]?.total),
    };
  }

  async listStockAdjustments(params: GridListParams) {
    const queryParams: unknown[] = [];
    const conditions: string[] = [];
    const scopeClause = this.buildCarScopeClause(
      params.scope,
      params.employeeId,
      queryParams,
      "c",
    );
    if (scopeClause) {
      conditions.push("(a.car_id IS NULL OR " + scopeClause + ")");
    }

    if (params.query.search) {
      const value = `%${params.query.search}%`;
      conditions.push(
        "(a.adjustment_no LIKE ? OR a.item_name LIKE ? OR COALESCE(a.part_code, '') LIKE ? OR COALESCE(c.unit_name, '') LIKE ?)",
      );
      queryParams.push(value, value, value, value);
    }

    for (const filter of params.query.filters) {
      if (filter.field === "divisionId") {
        conditions.push("CAST(a.division_id AS CHAR) = ?");
        queryParams.push(filter.value);
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const sortMap: Record<string, string> = {
      createdAt: "a.created_at",
      unitName: "unitName",
      itemName: "a.item_name",
      qtyBefore: "a.qty_before",
      qtyAfter: "a.qty_after",
      adjustmentQty: "a.adjustment_qty",
      adjustmentReason: "a.adjustment_reason",
    };
    const sortColumn = sortMap[params.query.sortBy] ?? "a.created_at";
    const direction = params.query.sortDirection === "asc" ? "ASC" : "DESC";
    const offset = (params.query.page - 1) * params.query.limit;

    const sql = `
      SELECT
        a.id AS adjustmentId,
        a.adjustment_no AS adjustmentNo,
        a.opname_id AS opnameId,
        a.stock_card_id AS stockCardId,
        a.car_id AS carId,
        COALESCE(c.unit_name, a.unit_name, a.car_id) AS unitName,
        a.item_name AS itemName,
        a.part_code AS partCode,
        a.uom AS uom,
        a.qty_before AS qtyBefore,
        a.qty_after AS qtyAfter,
        a.adjustment_qty AS adjustmentQty,
        a.adjustment_reason AS adjustmentReason,
        a.item_condition AS itemCondition,
        DATE_FORMAT(a.created_at, '%Y-%m-%d') AS createdAt,
        a.created_by_name AS createdByName,
        a.notes AS notes
      FROM ${this.tables.stockAdjustments} a
      LEFT JOIN ${this.tables.cars} c ON c.id = a.car_id
      ${whereClause}
      ORDER BY ${sortColumn} ${direction}, a.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const [rows] = await this.pool.query<StockAdjustmentRow[]>(sql, [
      ...queryParams,
      params.query.limit,
      offset,
    ]);

    const [countRows] = await this.pool.query<CountRow[]>(
      `
        SELECT COUNT(*) AS total
        FROM ${this.tables.stockAdjustments} a
        LEFT JOIN ${this.tables.cars} c ON c.id = a.car_id
        ${whereClause}
      `,
      queryParams,
    );

    return {
      rows: rows.map(mapStockAdjustmentRow),
      total: toInteger(countRows[0]?.total),
    };
  }

  async findTransactionById(params: {
    employeeId: string;
    scope: AuthScope;
    transactionId: string;
  }) {
    const queryParams: unknown[] = [];
    const scopeClause = this.buildTransactionScopeClause(
      params.scope,
      params.employeeId,
      queryParams,
    );
    const whereConditions = ["t.id = ?"];
    queryParams.unshift(params.transactionId);
    if (scopeClause) {
      whereConditions.push(scopeClause);
    }

    const [rows] = await this.pool.query<TransactionRow[]>(
      `
        ${this.buildTransactionSelectSql()}
        WHERE ${whereConditions.join(" AND ")}
        LIMIT 1
      `,
      queryParams,
    );

    const row = rows[0];
    return row ? mapTransactionRow(row) : null;
  }

  async canAccessCar(params: { employeeId: string; scope: AuthScope; carId: string }) {
    if (params.scope.canViewAllUnits) {
      return true;
    }

    const queryParams: unknown[] = [params.carId];
    const scopeClause = this.buildCarScopeClause(
      params.scope,
      params.employeeId,
      queryParams,
    );
    if (!scopeClause) {
      return false;
    }

    const [rows] = await this.pool.query<CountRow[]>(
      `
        SELECT COUNT(*) AS total
        FROM ${this.tables.cars} c
        WHERE c.id = ? AND ${scopeClause}
      `,
      queryParams,
    );

    return toInteger(rows[0]?.total) > 0;
  }

  async createRequest(context: CreateRequestContext, input: CreateWarehouseRequest) {
    const connection = await this.pool.getConnection();

    try {
      await connection.beginTransaction();
      const carId = input.carId;
      const [unitRows] = await connection.query<OptionRow[]>(
        `
          SELECT id AS value, COALESCE(unit_name, id) AS label
          FROM ${this.tables.cars}
          WHERE id = ?
          LIMIT 1
        `,
        [carId],
      );
      const unitName = input.unitName?.trim() || unitRows[0]?.label || carId;
      const transactionId = randomUUID();
      const approvalStatus: WarehouseApprovalStatus =
        input.itemCategory === "TOOLS" ? "APPROVED" : "PENDING_KD";
      const now = new Date();
      const requestDate = now.toISOString().slice(0, 19).replace("T", " ");

      await connection.execute(
        `
          INSERT INTO ${this.tables.transactions} (
            id,
            transaction_type,
            item_category,
            car_id,
            car_name,
            employee_id,
            employee_name,
            division_id,
            division_name,
            item_name,
            item_master_id,
            item_alias_used,
            stock_card_id,
            source_car_id,
            source_car_name,
            qty,
            uom,
            request_date,
            target_search_date,
            deadline_date,
            approval_status,
            item_status,
            notes,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'OPEN', ?, ?, ?)
        `,
        [
          transactionId,
          input.transactionType,
          input.itemCategory,
          input.carId,
          unitName,
          context.requesterEmployeeId ?? context.actorId,
          context.requesterName ?? context.actorName,
          context.divisionId,
          context.divisionName,
          input.itemName,
          input.itemMasterId,
          input.itemAliasUsed,
          input.stockCardId,
          context.sourceCarId ?? null,
          context.sourceUnitName ?? null,
          input.qty,
          input.uom,
          requestDate,
          input.targetSearchDate,
          input.deadlineDate,
          approvalStatus,
          input.notes,
          requestDate,
          requestDate,
        ],
      );

      await connection.commit();
      return {
        transactionId,
        approvalStatus,
        itemStatus: "OPEN",
        transactionType: input.transactionType,
      } satisfies WarehouseMutationResult;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async createStockOpname(
    context: CreateRequestContext,
    input: CreateWarehouseStockOpname,
  ) {
    const connection = await this.pool.getConnection();

    try {
      await connection.beginTransaction();
      const opnameId = randomUUID();
      const [unitRows] = input.carId
        ? await connection.query<OptionRow[]>(
            `
              SELECT id AS value, COALESCE(unit_name, id) AS label
              FROM ${this.tables.cars}
              WHERE id = ?
              LIMIT 1
            `,
            [input.carId],
          )
        : [[] as OptionRow[]];
      const unitName = input.carId ? unitRows[0]?.label ?? input.carId : null;
      const [serialRows] = await connection.query<Array<RowDataPacket & { total: number }>>(
        `SELECT COUNT(*) AS total FROM ${this.tables.stockOpnames} WHERE DATE(created_at) = CURRENT_DATE`,
      );
      const serial = toInteger(serialRows[0]?.total) + 1;
      const opnameNo = `OPN/${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, "0")}/${String(serial).padStart(4, "0")}`;
      const varianceQty = input.actualQty - input.expectedQty;
      const findingStatus: WarehouseOpnameFindingStatus =
        input.actualQty === 0 && input.expectedQty > 0
          ? "NOT_FOUND"
          : varianceQty === 0
            ? "MATCH"
            : varianceQty > 0
              ? "OVER"
              : "SHORT";
      const countedAt = input.countedAt ?? new Date().toISOString().slice(0, 10);

      await connection.execute(
        `
          INSERT INTO ${this.tables.stockOpnames} (
            id,
            opname_no,
            stock_card_id,
            car_id,
            unit_name,
            item_name,
            part_code,
            uom,
            storage_location_id,
            expected_qty,
            actual_qty,
            variance_qty,
            finding_status,
            item_condition,
            counted_at,
            counted_by,
            counted_by_name,
            division_id,
            division_name,
            notes,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `,
        [
          opnameId,
          opnameNo,
          input.stockCardId,
          input.carId,
          unitName,
          input.itemName,
          input.partCode,
          input.uom,
          input.storageLocationId,
          input.expectedQty,
          input.actualQty,
          varianceQty,
          findingStatus,
          input.itemCondition,
          countedAt,
          context.actorId,
          context.actorName,
          context.divisionId,
          context.divisionName,
          input.notes,
        ],
      );

      await connection.commit();
      return {
        opnameId,
        opnameNo,
        findingStatus,
        varianceQty,
      } satisfies WarehouseStockOpnameMutationResult;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async createStockAdjustment(
    context: CreateRequestContext,
    input: CreateWarehouseStockAdjustment,
  ) {
    const connection = await this.pool.getConnection();

    try {
      await connection.beginTransaction();
      const adjustmentId = randomUUID();
      const [unitRows] = input.carId
        ? await connection.query<OptionRow[]>(
            `
              SELECT id AS value, COALESCE(unit_name, id) AS label
              FROM ${this.tables.cars}
              WHERE id = ?
              LIMIT 1
            `,
            [input.carId],
          )
        : [[] as OptionRow[]];
      const unitName = input.carId ? unitRows[0]?.label ?? input.carId : null;
      const [serialRows] = await connection.query<Array<RowDataPacket & { total: number }>>(
        `SELECT COUNT(*) AS total FROM ${this.tables.stockAdjustments} WHERE DATE(created_at) = CURRENT_DATE`,
      );
      const serial = toInteger(serialRows[0]?.total) + 1;
      const adjustmentNo = `ADJ/${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, "0")}/${String(serial).padStart(4, "0")}`;
      const adjustmentQty = input.qtyAfter - input.qtyBefore;

      await connection.execute(
        `
          INSERT INTO ${this.tables.stockAdjustments} (
            id,
            adjustment_no,
            opname_id,
            stock_card_id,
            car_id,
            unit_name,
            item_name,
            part_code,
            uom,
            qty_before,
            qty_after,
            adjustment_qty,
            adjustment_reason,
            item_condition,
            created_by,
            created_by_name,
            division_id,
            division_name,
            notes,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `,
        [
          adjustmentId,
          adjustmentNo,
          input.opnameId,
          input.stockCardId,
          input.carId,
          unitName,
          input.itemName,
          input.partCode,
          input.uom,
          input.qtyBefore,
          input.qtyAfter,
          adjustmentQty,
          input.adjustmentReason,
          input.itemCondition,
          context.actorId,
          context.actorName,
          context.divisionId,
          context.divisionName,
          input.notes,
        ],
      );

      await connection.commit();
      return {
        adjustmentId,
        adjustmentNo,
        adjustmentQty,
        adjustmentReason: input.adjustmentReason,
      } satisfies WarehouseStockAdjustmentMutationResult;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async updateApprovalStatus(
    transactionId: string,
    approvalStatus: WarehouseApprovalStatus,
    notes?: string | null,
  ) {
    await this.pool.execute(
      `
        UPDATE ${this.tables.transactions}
        SET approval_status = ?, notes = COALESCE(?, notes), updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [approvalStatus, notes ?? null, transactionId],
    );
    return this.readMutationResult(transactionId);
  }

  async reject(transactionId: string, notes?: string | null) {
    await this.pool.execute(
      `
        UPDATE ${this.tables.transactions}
        SET approval_status = 'REJECTED',
            item_status = COALESCE(item_status, 'OPEN'),
            notes = COALESCE(?, notes),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [notes ?? null, transactionId],
    );
    return this.readMutationResult(transactionId);
  }

  async markReady(transactionId: string, notes?: string | null) {
    await this.pool.execute(
      `
        UPDATE ${this.tables.transactions}
        SET item_status = 'READY',
            notes = COALESCE(?, notes),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [notes ?? null, transactionId],
    );
    return this.readMutationResult(transactionId);
  }

  async issue(
    transactionId: string,
    input: {
      notes?: string | null;
      actualReleaseDate?: string | null;
      actorId: string;
      actorName: string;
    },
  ) {
    const actualReleaseDate = input.actualReleaseDate
      ? `${input.actualReleaseDate} 08:00:00`
      : new Date().toISOString().slice(0, 19).replace("T", " ");
    const actualReleaseDateOnly = actualReleaseDate.slice(0, 10);
    await this.pool.execute(
      `
        UPDATE ${this.tables.transactions}
        SET item_status = 'RELEASED',
            actual_release_date = ?,
            notes = COALESCE(?, notes),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [actualReleaseDate, input.notes ?? null, transactionId],
    );

    const [linkedRows] = await this.pool.query<
      Array<RowDataPacket & { stockCardId: string | null }>
    >(
      `
        SELECT stock_card_id AS stockCardId
        FROM ${this.tables.transactions}
        WHERE id = ?
        LIMIT 1
      `,
      [transactionId],
    );
    const stockCardId = linkedRows[0]?.stockCardId ?? null;
    if (stockCardId) {
      await this.pool.execute(
        `
          UPDATE ${this.tables.stockCard}
          SET status = 'RETRIEVED',
              date_out = ?,
              taken_by = ?,
              taken_by_name = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        [actualReleaseDateOnly, input.actorId, input.actorName, stockCardId],
      );
    }
    return this.readMutationResult(transactionId);
  }

  async markReturned(
    transactionId: string,
    input: {
      notes?: string | null;
      actualReturnDate?: string | null;
      qtyReturned: number | null;
      itemCondition: WarehouseTransactionRecord["itemCondition"];
    },
  ) {
    const actualReturnDate = input.actualReturnDate
      ? `${input.actualReturnDate} 08:00:00`
      : new Date().toISOString().slice(0, 19).replace("T", " ");
    await this.pool.execute(
      `
        UPDATE ${this.tables.transactions}
        SET transaction_type = 'PENGEMBALIAN',
            item_status = 'RETURNED',
            actual_return_date = ?,
            qty_returned = COALESCE(?, qty_returned, qty),
            item_condition = COALESCE(?, item_condition),
            notes = COALESCE(?, notes),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [
        actualReturnDate,
        input.qtyReturned,
        input.itemCondition,
        input.notes ?? null,
        transactionId,
      ],
    );
    return this.readMutationResult(transactionId);
  }

  async markStored(
    transactionId: string,
    input: {
      notes?: string | null;
      storageLocationId: number | null;
      locationDetail?: string | null;
    },
  ) {
    const [existingRows] = await this.pool.query<
      Array<RowDataPacket & { stockCardId: string | null }>
    >(
      `
        SELECT stock_card_id AS stockCardId
        FROM ${this.tables.transactions}
        WHERE id = ?
        LIMIT 1
      `,
      [transactionId],
    );
    const stockCardId = existingRows[0]?.stockCardId ?? null;

    await this.pool.execute(
      `
        UPDATE ${this.tables.transactions}
        SET item_status = 'STORED',
            storage_location_id = COALESCE(?, storage_location_id),
            location_detail = COALESCE(?, location_detail),
            notes = COALESCE(?, notes),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [
        input.storageLocationId,
        input.locationDetail ?? null,
        input.notes ?? null,
        transactionId,
      ],
    );

    if (stockCardId) {
      await this.pool.execute(
        `
          UPDATE ${this.tables.stockCard}
          SET status = 'IN_STORAGE',
              storage_location_id = COALESCE(?, storage_location_id),
              location_detail = COALESCE(?, location_detail),
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        [input.storageLocationId, input.locationDetail ?? null, stockCardId],
      );
    }

    return this.readMutationResult(transactionId);
  }

  async createStorageLocation(input: CreateWarehouseStorageLocation) {
    const label =
      input.label?.trim() ||
      [input.locationType, input.zone, input.rack, input.shelf]
        .filter((value) => value && value.trim().length > 0)
        .join("-");

    const [result] = await this.pool.execute<Array<RowDataPacket & { insertId: number }>>(
      `
        INSERT INTO ${this.tables.storageLocations} (
          location_type,
          zone,
          rack,
          shelf,
          label,
          is_active
        ) VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        input.locationType,
        input.zone ?? null,
        input.rack ?? null,
        input.shelf ?? null,
        label,
        input.isActive ? 1 : 0,
      ],
    );
    const insertId = Number((result as unknown as { insertId?: number }).insertId ?? 0);
    return this.readStorageLocation(insertId);
  }

  async updateStorageLocation(input: UpdateWarehouseStorageLocation) {
    await this.pool.execute(
      `
        UPDATE ${this.tables.storageLocations}
        SET
          location_type = COALESCE(?, location_type),
          zone = COALESCE(?, zone),
          rack = COALESCE(?, rack),
          shelf = COALESCE(?, shelf),
          label = COALESCE(?, label),
          is_active = COALESCE(?, is_active)
        WHERE id = ?
      `,
      [
        input.locationType ?? null,
        input.zone ?? null,
        input.rack ?? null,
        input.shelf ?? null,
        input.label ?? null,
        typeof input.isActive === "boolean" ? (input.isActive ? 1 : 0) : null,
        input.storageLocationId,
      ],
    );

    return this.readStorageLocation(input.storageLocationId);
  }

  async deactivateStorageLocation(storageLocationId: number) {
    await this.pool.execute(
      `
        UPDATE ${this.tables.storageLocations}
        SET is_active = 0
        WHERE id = ?
      `,
      [storageLocationId],
    );

    return this.readStorageLocation(storageLocationId);
  }

  async updateStockCardPhotos(stockCardId: string, photoUrls: string[]) {
    await this.pool.execute(
      `
        UPDATE ${this.tables.stockCard}
        SET photo_urls = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [JSON.stringify(photoUrls), stockCardId],
    );

    const [rows] = await this.pool.query<
      Array<RowDataPacket & { stockCardId: string; photoUrls: string | null }>
    >(
      `
        SELECT id AS stockCardId, photo_urls AS photoUrls
        FROM ${this.tables.stockCard}
        WHERE id = ?
        LIMIT 1
      `,
      [stockCardId],
    );
    const row = rows[0];
    if (!row) {
      throw new Error("WAREHOUSE_STOCK_CARD_NOT_FOUND");
    }

    return {
      stockCardId: row.stockCardId,
      photoUrls: parseJsonStringArray(row.photoUrls),
    };
  }

  private async resolveStockCardMasterPanel(input: CreateWarehouseStockCard | UpdateWarehouseStockCard) {
    const parsedPartCodeId =
      input.partCode?.match(/^MP-(\d+)$/u)?.[1] ??
      null;
    const requestedPanelId = input.panelId ?? (parsedPartCodeId ? Number(parsedPartCodeId) : null);

    if (requestedPanelId) {
      const [rows] = await this.pool.query<StockCardPanelReferenceRow[]>(
        `
          SELECT
            mp.id AS panelId,
            CONCAT('MP-', mp.id) AS partCode,
            mp.section AS section,
            mp.name AS name,
            mp.category AS category
          FROM ${this.tables.masterPanels} mp
          WHERE mp.id = ?
            AND mp.car_id = ?
            AND COALESCE(mp.is_active, 1) = 1
          LIMIT 1
        `,
        [requestedPanelId, input.carId],
      );
      const row = rows[0];
      if (!row) {
        throw new Error("WAREHOUSE_MASTER_PANEL_NOT_FOUND");
      }

      return {
        panelId: Number(row.panelId),
        partCode: row.partCode,
        section: row.section,
        name: row.name,
      };
    }

    const section = input.panelSection.trim();
    const name = input.partName.trim();
    const parentPanel = await this.resolveStockCardParentPanel(input, section, name);
    const parentPanelId = parentPanel ? Number(parentPanel.panelId) : null;
    const [existingRows] = await this.pool.query<StockCardPanelReferenceRow[]>(
      `
        SELECT
          mp.id AS panelId,
          mp.parent_id AS parentPanelId,
          CONCAT('MP-', mp.id) AS partCode,
          mp.section AS section,
          mp.name AS name,
          mp.category AS category
        FROM ${this.tables.masterPanels} mp
        WHERE mp.car_id = ?
          AND TRIM(mp.section) = ?
          AND TRIM(mp.name) = ?
          AND ((? IS NULL AND mp.parent_id IS NULL) OR mp.parent_id = ?)
          AND COALESCE(mp.is_active, 1) = 1
        ORDER BY mp.id ASC
        LIMIT 1
      `,
      [input.carId, section, name, parentPanelId, parentPanelId],
    );
    const existing = existingRows[0];
    if (existing) {
      return {
        panelId: Number(existing.panelId),
        partCode: existing.partCode,
        section: existing.section,
        name: existing.name,
      };
    }

    const [result] = await this.pool.execute<ResultSetHeader>(
      `
        INSERT INTO ${this.tables.masterPanels} (
          car_id,
          section,
          name,
          category,
          is_active,
          parent_id,
          sort_order,
          default_division_id,
          created_by,
          updated_by
        ) VALUES (?, ?, ?, ?, 1, ?, 0, NULL, NULL, NULL)
      `,
      [input.carId, section, name, parentPanel?.category ?? input.panelCategory ?? null, parentPanelId],
    );
    const panelId = Number(result.insertId);

    return {
      panelId,
      partCode: `MP-${panelId}`,
      section,
      name,
    };
  }

  private async resolveStockCardParentPanel(
    input: CreateWarehouseStockCard | UpdateWarehouseStockCard,
    section: string,
    partName: string,
  ): Promise<StockCardPanelReferenceRow | null> {
    if (input.parentPanelId) {
      const [rows] = await this.pool.query<StockCardPanelReferenceRow[]>(
        `
          SELECT
            mp.id AS panelId,
            mp.parent_id AS parentPanelId,
            CONCAT('MP-', mp.id) AS partCode,
            mp.section AS section,
            mp.name AS name,
            mp.category AS category
          FROM ${this.tables.masterPanels} mp
          WHERE mp.id = ?
            AND mp.car_id = ?
            AND mp.parent_id IS NULL
            AND COALESCE(mp.is_active, 1) = 1
          LIMIT 1
        `,
        [input.parentPanelId, input.carId],
      );
      const row = rows[0];
      if (!row) {
        throw new Error("WAREHOUSE_MASTER_PANEL_NOT_FOUND");
      }
      return row;
    }

    const panelName = input.panelName?.trim() ?? "";
    if (!panelName || panelName === partName) {
      return null;
    }

    const [existingRows] = await this.pool.query<StockCardPanelReferenceRow[]>(
      `
        SELECT
          mp.id AS panelId,
          mp.parent_id AS parentPanelId,
          CONCAT('MP-', mp.id) AS partCode,
          mp.section AS section,
          mp.name AS name,
          mp.category AS category
        FROM ${this.tables.masterPanels} mp
        WHERE mp.car_id = ?
          AND TRIM(mp.section) = ?
          AND TRIM(mp.name) = ?
          AND mp.parent_id IS NULL
          AND COALESCE(mp.is_active, 1) = 1
        ORDER BY mp.id ASC
        LIMIT 1
      `,
      [input.carId, section, panelName],
    );
    const existing = existingRows[0];
    if (existing) {
      return existing;
    }

    const [result] = await this.pool.execute<ResultSetHeader>(
      `
        INSERT INTO ${this.tables.masterPanels} (
          car_id,
          section,
          name,
          category,
          is_active,
          parent_id,
          sort_order,
          default_division_id,
          created_by,
          updated_by
        ) VALUES (?, ?, ?, ?, 1, NULL, 0, NULL, NULL, NULL)
      `,
      [input.carId, section, panelName, input.panelCategory ?? null],
    );
    const panelId = Number(result.insertId);

    return {
      panelId,
      parentPanelId: null,
      partCode: `MP-${panelId}`,
      section,
      name: panelName,
      category: input.panelCategory ?? null,
    } as StockCardPanelReferenceRow;
  }

  private async readStockCard(stockCardId: string) {
    const [rows] = await this.pool.query<StockCardRow[]>(
      `
        SELECT
          sc.id AS stockCardId,
          sc.entry_no AS entryNo,
          sc.car_id AS carId,
          COALESCE(c.unit_name, sc.car_name, sc.car_id) AS unitName,
          sc.part_code AS partCode,
          sc.panel_section AS panelSection,
          mp.category AS panelCategory,
          sc.part_name AS partName,
          sc.condition_type AS conditionType,
          sc.qty AS qty,
          sc.uom AS uom,
          sc.storage_location_id AS storageLocationId,
          sl.label AS locationLabel,
          sc.location_detail AS locationDetail,
          DATE_FORMAT(sc.date_in, '%Y-%m-%d') AS dateIn,
          DATE_FORMAT(sc.date_out, '%Y-%m-%d') AS dateOut,
          sc.taken_by_name AS takenByName,
          sc.status AS status,
          sc.is_labeled AS isLabeled,
          (
            SELECT m.item_category
            FROM ${this.tables.itemMaster} m
            WHERE (m.item_code IS NOT NULL AND m.item_code = sc.part_code)
               OR m.item_name = sc.part_name
            ORDER BY m.updated_at DESC
            LIMIT 1
          ) AS itemCategory,
          sc.photo_urls AS photoUrls
        FROM ${this.tables.stockCard} sc
        LEFT JOIN ${this.tables.storageLocations} sl ON sl.id = sc.storage_location_id
        LEFT JOIN ${this.tables.cars} c ON c.id = sc.car_id
        LEFT JOIN ${this.tables.masterPanels} mp ON mp.car_id = sc.car_id AND sc.part_code = CONCAT('MP-', mp.id)
        LEFT JOIN ${this.tables.masterPanels} parent_mp ON parent_mp.id = mp.parent_id
        WHERE sc.id = ?
        LIMIT 1
      `,
      [stockCardId],
    );

    if (!rows[0]) {
      throw new Error("WAREHOUSE_STOCK_CARD_NOT_FOUND");
    }

    return mapStockCardRow(rows[0]);
  }

  private async readItem(itemId: string) {
    const [rows] = await this.pool.query<ItemRow[]>(
      `
        SELECT
          m.id AS itemId,
          m.item_code AS itemCode,
          m.item_name AS itemName,
          m.item_category AS itemCategory,
          m.uom AS uom,
          m.description AS description,
          m.is_active AS isActive,
          (
            SELECT COUNT(*)
            FROM ${this.tables.itemAliases} alias_count
            WHERE alias_count.item_id = m.id
          ) AS aliasCount,
          (
            SELECT mp.price_per_unit
            FROM ${this.tables.materialPrices} mp
            WHERE (mp.item_code = m.item_code OR mp.item_name = m.item_name)
            ORDER BY mp.effective_date DESC, mp.created_at DESC
            LIMIT 1
          ) AS latestPrice,
          (
            SELECT mp.vendor_name
            FROM ${this.tables.materialPrices} mp
            WHERE (mp.item_code = m.item_code OR mp.item_name = m.item_name)
            ORDER BY mp.effective_date DESC, mp.created_at DESC
            LIMIT 1
          ) AS latestVendorName,
          (
            SELECT COUNT(*)
            FROM ${this.tables.materialUsage} mu
            WHERE mu.item_name = m.item_name
          ) AS usageCount,
          (
            SELECT DATE_FORMAT(MAX(mu.usage_date), '%Y-%m-%d')
            FROM ${this.tables.materialUsage} mu
            WHERE mu.item_name = m.item_name
          ) AS lastUsedAt,
          DATE_FORMAT(m.updated_at, '%Y-%m-%d %H:%i:%s') AS updatedAt
        FROM ${this.tables.itemMaster} m
        WHERE m.id = ?
        LIMIT 1
      `,
      [itemId],
    );
    const row = rows[0];
    if (!row) {
      throw new Error("WAREHOUSE_ITEM_NOT_FOUND");
    }
    return mapItemRow(row);
  }

  private async readStorageLocation(storageLocationId: number) {
    const [rows] = await this.pool.query<StorageLocationRow[]>(
      `
        SELECT
          sl.id AS storageLocationId,
          sl.location_type AS locationType,
          sl.zone AS zone,
          sl.rack AS rack,
          sl.shelf AS shelf,
          sl.label AS label,
          sl.is_active AS isActive,
          (
            SELECT COUNT(*)
            FROM ${this.tables.stockCard} sc
            WHERE sc.storage_location_id = sl.id
              AND sc.status = 'IN_STORAGE'
          ) AS itemCount
        FROM ${this.tables.storageLocations} sl
        WHERE sl.id = ?
        LIMIT 1
      `,
      [storageLocationId],
    );
    const row = rows[0];
    if (!row) {
      throw new Error("WAREHOUSE_LOCATION_NOT_FOUND");
    }
    return mapStorageLocationRow(row);
  }

  private async readMutationResult(transactionId: string): Promise<WarehouseMutationResult> {
    const [rows] = await this.pool.query<
      Array<
        RowDataPacket & {
          transactionId: string;
          approvalStatus: WarehouseApprovalStatus;
          itemStatus: WarehouseTransactionRecord["itemStatus"];
          transactionType: WarehouseRequestTransactionType | "PENGEMBALIAN" | "PENYIMPANAN";
        }
      >
    >(
      `
        SELECT
          id AS transactionId,
          COALESCE(approval_status, 'PENDING_KD') AS approvalStatus,
          COALESCE(item_status, 'OPEN') AS itemStatus,
          transaction_type AS transactionType
        FROM ${this.tables.transactions}
        WHERE id = ?
        LIMIT 1
      `,
      [transactionId],
    );

    const row = rows[0];
    if (!row) {
      throw new Error("WAREHOUSE_TRANSACTION_NOT_FOUND");
    }

    return {
      transactionId: row.transactionId,
      approvalStatus: row.approvalStatus,
      itemStatus: row.itemStatus,
      transactionType: row.transactionType,
    };
  }

  createMeta(page: number, limit: number, total: number) {
    return buildMeta(page, limit, total);
  }
}
