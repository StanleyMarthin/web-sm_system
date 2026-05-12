import { env } from "@/config/env";
import type {
  WhtApprovalStatus,
  WhtDashboard,
  WhtItemCategory,
  WhtItemStatus,
  WhtLocation,
  WhtMasterItem,
  WhtStockCard,
  WhtTransaction,
  WhtView,
} from "@/types";

const BASE = `${env.warehouseUrl}/sm/warehouse`;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

type WarehouseLogResponse = {
  data?: {
    logs?: unknown[];
    items?: unknown[];
  };
};

type WarehouseStockResponse = {
  data?: {
    items?: unknown[];
  };
};

type WarehouseUploadTicket = {
  upload_url: string;
  public_url: string;
};

export type WarehouseUpdateAction =
  | "approve"
  | "reject"
  | "ready"
  | "release"
  | "return"
  | "store"
  | "locate";

export type WarehouseTransactionFilters = {
  userId: string;
  view?: WhtView;
  itemStatus?: WhtItemStatus;
  approvalStatus?: WhtApprovalStatus | "ALL";
  itemCategory?: WhtItemCategory;
  transactionType?: WhtTransaction["transactionType"];
  divisionId?: number;
  search?: string;
  limit?: number;
  offset?: number;
};

export type WarehouseUpdatePayload = {
  action: WarehouseUpdateAction;
  userId: string;
  logId: string;
  approved?: boolean;
  notes?: string;
  qtyReturned?: number;
  itemCondition?: string;
  storageLocationId?: number;
  locationDetail?: string;
  photoUrls?: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.length > 0);
  }
  if (typeof value !== "string" || value.trim() === "") {
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

function toNumber(value: unknown): number | null {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function computeDaysOverdue(deadlineDate: string | null, itemStatus: WhtItemStatus): number | null {
  if (!deadlineDate || itemStatus !== "RELEASED") {
    return null;
  }
  const deadline = new Date(deadlineDate);
  if (Number.isNaN(deadline.getTime())) {
    return null;
  }
  const start = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate()).getTime();
  const today = new Date();
  const current = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const diff = Math.floor((current - start) / MS_PER_DAY);
  return diff > 0 ? diff : null;
}

function normalizeTransaction(row: unknown): WhtTransaction | null {
  if (!isRecord(row)) {
    return null;
  }

  const id = String(row.id ?? "");
  if (!id) {
    return null;
  }

  const itemStatus = String(row.itemStatus ?? row.item_status ?? "OPEN").toUpperCase() as WhtItemStatus;
  const approvalStatus = String(
    row.approvalStatus ?? row.approval_status ?? "PENDING_KD",
  ).toUpperCase() as WhtApprovalStatus;
  const deadlineDate = row.deadlineDate ? String(row.deadlineDate) : row.deadline_date ? String(row.deadline_date) : null;

  return {
    id,
    transactionType: String(
      row.transactionType ?? row.transaction_type ?? "PEMINJAMAN",
    ).toUpperCase() as WhtTransaction["transactionType"],
    itemCategory: String(
      row.itemCategory ?? row.item_category ?? "SPARE_PART",
    ).toUpperCase() as WhtItemCategory,
    itemName: String(row.itemName ?? row.item_name ?? "-"),
    itemMasterId: row.itemMasterId ? String(row.itemMasterId) : null,
    itemAliasUsed: row.itemAliasUsed ? String(row.itemAliasUsed) : null,
    itemCondition: row.itemCondition ? String(row.itemCondition) : null,
    qty: toNumber(row.qty) ?? 0,
    qtyReturned: toNumber(row.qtyReturned),
    uom: String(row.uom ?? "PCS"),
    carId: row.carId ? String(row.carId) : null,
    unitName: row.unitName ? String(row.unitName) : null,
    coreId: row.coreId ? String(row.coreId) : null,
    jobdesc: row.jobdesc ? String(row.jobdesc) : null,
    panelName: row.panelName ? String(row.panelName) : null,
    employeeId: String(row.employeeId ?? row.employee_id ?? ""),
    requester: String(row.requester ?? row.employee_name ?? "-"),
    divisionId: toNumber(row.divisionId ?? row.division_id) ?? 0,
    division: String(row.division ?? row.division_name ?? "-"),
    stockCardId: row.stockCardId ? String(row.stockCardId) : null,
    storageLocationId: toNumber(row.storageLocationId ?? row.storage_location_id),
    locationLabel: row.locationLabel ? String(row.locationLabel) : null,
    locationDetail: row.locationDetail ? String(row.locationDetail) : null,
    picWarehouseId: row.picWarehouseId ? String(row.picWarehouseId) : null,
    picWarehouseName: row.picWarehouseName ? String(row.picWarehouseName) : null,
    accKdName: row.accKdName ? String(row.accKdName) : null,
    requestDate: String(row.requestDate ?? row.request_date ?? ""),
    targetSearchDate: row.targetSearchDate ? String(row.targetSearchDate) : null,
    actualReleaseDate: row.actualReleaseDate ? String(row.actualReleaseDate) : null,
    deadlineDate,
    actualReturnDate: row.actualReturnDate ? String(row.actualReturnDate) : null,
    itemStatus,
    approvalStatus,
    photoUrls: parseJsonArray(row.photoUrls),
    notes: row.notes ? String(row.notes) : null,
    installToUnit: Boolean(row.installToUnit),
    daysOverdue: computeDaysOverdue(deadlineDate, itemStatus),
  };
}

function normalizeStockCard(row: unknown): WhtStockCard | null {
  if (!isRecord(row)) {
    return null;
  }
  const id = String(row.id ?? row.entry_no ?? "");
  if (!id) {
    return null;
  }
  return {
    id,
    entryNo: toNumber(row.entry_no ?? row.entryNo) ?? 0,
    carId: String(row.car_id ?? row.carId ?? ""),
    carName: String(row.car_name ?? row.carName ?? "Tanpa Unit"),
    sourceTransactionId: row.source_transaction_id ? String(row.source_transaction_id) : null,
    partCode: row.part_code ? String(row.part_code) : null,
    panelSection: row.panel_section ? String(row.panel_section) : null,
    partName: String(row.part_name ?? row.partName ?? "-"),
    conditionType: String(row.condition_type ?? row.conditionType ?? "BARU"),
    qty: toNumber(row.qty) ?? 0,
    uom: row.uom ? String(row.uom) : null,
    storageLocationId: toNumber(row.storage_location_id ?? row.storageLocationId),
    locationLabel: row.location_label ? String(row.location_label) : null,
    locationDetail: row.location_detail ? String(row.location_detail) : null,
    dateIn: String(row.date_in ?? row.dateIn ?? ""),
    dateOut: row.date_out ? String(row.date_out) : null,
    takenByName: row.taken_by_name ? String(row.taken_by_name) : null,
    status: String(row.status ?? "IN_STORAGE").toUpperCase() as WhtStockCard["status"],
    isLabeled: Boolean(row.is_labeled ?? row.isLabeled),
    photoUrls: parseJsonArray(row.photo_urls ?? row.photoUrls),
    notes: row.notes ? String(row.notes) : null,
    inputByName: row.input_by_name ? String(row.input_by_name) : null,
    createdAt: String(row.created_at ?? row.createdAt ?? ""),
  };
}

function normalizeMasterItem(row: unknown): WhtMasterItem | null {
  if (!isRecord(row)) {
    return null;
  }
  const id = String(row.id ?? "");
  if (!id) {
    return null;
  }
  return {
    id,
    itemCode: row.itemCode ? String(row.itemCode) : row.item_code ? String(row.item_code) : null,
    itemName: String(row.itemName ?? row.item_name ?? "-"),
    itemCategory: String(
      row.itemCategory ?? row.item_category ?? "SPARE_PART",
    ).toUpperCase() as WhtItemCategory,
    uom: row.uom ? String(row.uom) : null,
    description: row.description ? String(row.description) : null,
    isActive: row.isActive === undefined ? true : Boolean(row.isActive),
    aliasCount: toNumber(row.aliasCount ?? row.alias_count) ?? 0,
    aliases: [],
    lastUsed: row.lastUsed ? String(row.lastUsed) : null,
    usageCount: toNumber(row.usageCount ?? row.usage_count) ?? 0,
  };
}

function normalizeLocation(row: unknown): WhtLocation | null {
  if (!isRecord(row)) {
    return null;
  }
  const id = toNumber(row.id);
  if (id === null) {
    return null;
  }
  return {
    id,
    locationType: String(
      row.location_type ?? row.locationType ?? "GUDANG",
    ).toUpperCase() as WhtLocation["locationType"],
    zone: row.zone ? String(row.zone) : null,
    rack: row.rack ? String(row.rack) : null,
    shelf: row.shelf ? String(row.shelf) : null,
    label: String(row.label ?? "-"),
    isActive: row.is_active === undefined ? true : Boolean(row.is_active),
    stockCount: toNumber(row.stockCount ?? row.stock_count) ?? 0,
  };
}

function applyViewFilter(data: WhtTransaction[], view?: WhtView): WhtTransaction[] {
  switch (view) {
    case "PENDING":
      return data.filter((item) => item.approvalStatus.startsWith("PENDING_"));
    case "READY":
      return data.filter((item) => item.itemStatus === "READY");
    case "FIELD":
      return data.filter((item) => item.itemStatus === "RELEASED");
    case "OVERDUE":
      return data.filter((item) => (item.daysOverdue ?? 0) > 0);
    default:
      return data;
  }
}

async function safeJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export async function getTransactions(params: WarehouseTransactionFilters): Promise<WhtTransaction[]> {
  if (!params.userId) {
    return [];
  }

  try {
    const query = new URLSearchParams({ userId: params.userId });
    if (params.itemStatus) query.set("itemStatus", params.itemStatus);
    if (params.approvalStatus && params.approvalStatus !== "ALL") query.set("approvalStatus", params.approvalStatus);
    if (params.itemCategory) query.set("itemCategory", params.itemCategory);
    if (params.transactionType) query.set("transactionType", params.transactionType);
    if (params.divisionId !== undefined) query.set("divisionId", String(params.divisionId));
    query.set("limit", String(params.limit ?? 200));
    query.set("offset", String(params.offset ?? 0));

    const response = await fetch(`${BASE}/logs?${query.toString()}`, { cache: "no-store" });
    if (!response.ok) {
      return [];
    }

    const json = await safeJson<WarehouseLogResponse>(response);
    const rows = Array.isArray(json?.data?.logs) ? json.data.logs : [];
    let items = rows.map(normalizeTransaction).filter((item): item is WhtTransaction => item !== null);

    if (params.view) {
      items = applyViewFilter(items, params.view);
    }

    if (params.search?.trim()) {
      const keyword = params.search.trim().toLowerCase();
      items = items.filter((item) =>
        item.itemName.toLowerCase().includes(keyword) ||
        item.requester.toLowerCase().includes(keyword) ||
        item.division.toLowerCase().includes(keyword) ||
        item.id.toLowerCase().includes(keyword) ||
        (item.unitName ?? "").toLowerCase().includes(keyword) ||
        (item.jobdesc ?? "").toLowerCase().includes(keyword),
      );
    }

    return items;
  } catch (error) {
    console.warn("[warehouse-service] transactions fetch error:", error);
    return [];
  }
}

export async function getPendingApprovals(params: { userId: string }): Promise<WhtTransaction[]> {
  if (!params.userId) {
    return [];
  }

  try {
    const response = await fetch(
      `${BASE}/pending-approval?${new URLSearchParams({ userId: params.userId }).toString()}`,
      { cache: "no-store" },
    );
    if (!response.ok) {
      return [];
    }

    const json = await safeJson<WarehouseLogResponse>(response);
    const rows = Array.isArray(json?.data?.items) ? json.data.items : [];
    return rows.map(normalizeTransaction).filter((item): item is WhtTransaction => item !== null);
  } catch (error) {
    console.warn("[warehouse-service] pending approvals fetch error:", error);
    return [];
  }
}

export async function getWarehouseDashboard(params?: { userId: string }): Promise<WhtDashboard | null> {
  if (!params?.userId) {
    return null;
  }

  try {
    const logs = await getTransactions({ userId: params.userId, limit: 200 });

    const pendingLogs = logs.filter((item) => item.approvalStatus.startsWith("PENDING_"));
    const pendingSource = pendingLogs;
    const overdueLogs = logs.filter((item) => (item.daysOverdue ?? 0) > 0);

    const pendingByDivisionMap = new Map<number, { divisionId: number; divisionName: string; count: number }>();
    for (const item of pendingSource) {
      const current = pendingByDivisionMap.get(item.divisionId) ?? {
        divisionId: item.divisionId,
        divisionName: item.division,
        count: 0,
      };
      current.count += 1;
      pendingByDivisionMap.set(item.divisionId, current);
    }

    return {
      summary: {
        pendingApproval: pendingLogs.length,
        pendingKd: pendingLogs.filter((item) => item.approvalStatus === "PENDING_KD").length,
        pendingKepalaGudang: pendingLogs.filter((item) => item.approvalStatus === "PENDING_KEPALA_GUDANG").length,
        pendingPpic: pendingLogs.filter((item) => item.approvalStatus === "PENDING_PPIC").length,
        readyToPickup: logs.filter((item) => item.itemStatus === "READY").length,
        releasedInField: logs.filter((item) => item.itemStatus === "RELEASED").length,
        overdueReturn: overdueLogs.length,
        storedToday: logs.filter((item) => item.itemStatus === "STORED").length,
        totalActiveStock: logs.filter((item) => !["REJECTED"].includes(item.approvalStatus)).length,
      },
      recentTransactions: logs.slice(0, 10),
      overdueItems: overdueLogs.slice(0, 10).map((item) => ({
        id: item.id,
        itemName: item.itemName,
        requester: item.requester,
        division: item.division,
        unitName: item.unitName,
        deadlineDate: item.deadlineDate ?? "",
        daysOverdue: item.daysOverdue ?? 0,
      })),
      pendingByDivision: Array.from(pendingByDivisionMap.values()).sort((a, b) => b.count - a.count),
    };
  } catch (error) {
    console.warn("[warehouse-service] dashboard fetch error:", error);
    return null;
  }
}

export async function updateWarehouseTransaction(payload: WarehouseUpdatePayload): Promise<boolean> {
  try {
    const response = await fetch(BASE, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return response.ok;
  } catch (error) {
    console.warn("[warehouse-service] update transaction error:", error);
    return false;
  }
}

export async function getStockCards(params?: {
  userId?: string;
  carId?: string;
  search?: string;
  status?: WhtStockCard["status"];
}): Promise<WhtStockCard[]> {
  if (!params?.userId) {
    return [];
  }

  try {
    const query = new URLSearchParams({ userId: params.userId });
    if (params.carId) query.set("carId", params.carId);
    if (params.status) query.set("status", params.status);

    const response = await fetch(`${BASE}/stock-card?${query.toString()}`, { cache: "no-store" });
    if (!response.ok) {
      return [];
    }

    const json = await safeJson<WarehouseStockResponse>(response);
    let items = (Array.isArray(json?.data?.items) ? json.data.items : [])
      .map(normalizeStockCard)
      .filter((item): item is WhtStockCard => item !== null);

    if (params.search?.trim()) {
      const keyword = params.search.trim().toLowerCase();
      items = items.filter((item) =>
        item.partName.toLowerCase().includes(keyword) ||
        item.carName.toLowerCase().includes(keyword) ||
        (item.partCode ?? "").toLowerCase().includes(keyword) ||
        (item.locationLabel ?? "").toLowerCase().includes(keyword),
      );
    }

    return items;
  } catch (error) {
    console.warn("[warehouse-service] stock card fetch error:", error);
    return [];
  }
}

export async function getMasterItems(params?: {
  userId?: string;
  search?: string;
  category?: WhtItemCategory;
}): Promise<WhtMasterItem[]> {
  if (!params?.userId || !params.search?.trim()) {
    return [];
  }

  try {
    const query = new URLSearchParams({
      userId: params.userId,
      q: params.search.trim(),
    });
    if (params.category) query.set("category", params.category);

    const response = await fetch(`${BASE}/items/search?${query.toString()}`, { cache: "no-store" });
    if (!response.ok) {
      return [];
    }

    const json = await safeJson<WarehouseStockResponse>(response);
    return (Array.isArray(json?.data?.items) ? json.data.items : [])
      .map(normalizeMasterItem)
      .filter((item): item is WhtMasterItem => item !== null);
  } catch (error) {
    console.warn("[warehouse-service] master item fetch error:", error);
    return [];
  }
}

export async function getLocations(params?: {
  type?: WhtLocation["locationType"];
  isActive?: boolean;
}): Promise<WhtLocation[]> {
  try {
    const response = await fetch(`${BASE}/storage-locations`, { cache: "no-store" });
    if (!response.ok) {
      return [];
    }

    const json = await safeJson<WarehouseStockResponse>(response);
    let items = (Array.isArray(json?.data?.items) ? json.data.items : [])
      .map(normalizeLocation)
      .filter((item): item is WhtLocation => item !== null);

    if (params?.type) {
      items = items.filter((item) => item.locationType === params.type);
    }
    if (params?.isActive !== undefined) {
      items = items.filter((item) => item.isActive === params.isActive);
    }
    return items;
  } catch (error) {
    console.warn("[warehouse-service] locations fetch error:", error);
    return [];
  }
}

export async function getUploadTicket(filename: string): Promise<WarehouseUploadTicket | null> {
  try {
    const query = new URLSearchParams({ filename });
    const response = await fetch(`${BASE}/upload-ticket?${query.toString()}`);
    if (!response.ok) {
      return null;
    }
    const json = await safeJson<{ data?: WarehouseUploadTicket }>(response);
    return json?.data ?? null;
  } catch (error) {
    console.warn("[warehouse-service] upload ticket error:", error);
    return null;
  }
}

export async function uploadWarehousePhoto(file: File): Promise<string | null> {
  const safeName = file.name.replace(/\s+/g, "-").toLowerCase();
  const filename = `warehouse/web/${Date.now()}-${safeName}`;
  const ticket = await getUploadTicket(filename);
  if (!ticket) {
    return null;
  }

  const contentType = file.type || "image/jpeg";
  const upload = await fetch(ticket.upload_url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: file,
  });

  return upload.ok ? ticket.public_url : null;
}
