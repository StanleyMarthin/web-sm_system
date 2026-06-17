import { randomUUID } from "node:crypto";
import type { AuthScope } from "@smsystem/contracts/auth";
import type {
  CreateUnitRequest,
  UnitBoardRow,
  UnitWorkspace,
  UpdateUnitRequest,
} from "@smsystem/contracts/unit";
import type {
  UnitBomDocument,
  UnitBomLogisticStatus,
  UnitBomNode,
  UnitBomPartDetail,
  UnitBomPhotoSlot,
  UnitBomPhotoSlotSummary,
  UnitBomPhysicalStatus,
  UnitBomTimelineItem,
  UnitBomWorkspace,
} from "@smsystem/contracts/unit-bom";
import type {
  CreateUnitPanelRequest,
  UnitPanelCollection,
  UnitPanelRecord,
  UpdateUnitPanelRequest,
} from "@smsystem/contracts/unit-panel";
import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getApiEnv, type ApiEnv } from "@/config/env";
import { qualifyTable } from "@/db/identifier";
import { getMySqlPool } from "@/db/mysql";
import type { UnitGridQuery } from "@/services/units/query";
import { _build_workday_alias } from "@/services/workday-alias";

interface UnitBoardRowPacket extends RowDataPacket {
  unitId: string;
  unitName: string;
  plateNumber: string | null;
  customerName: string | null;
  restorationType: string | null;
  isMargin: number | boolean | null;
  incomingDate: string | null;
  revisionContract: string | null;
  kpName: string;
  advisorName: string;
  targetDeliveryDate: string | null;
  etaDate: string | null;
  riskLevel: "GREEN" | "YELLOW" | "ORANGE" | "RED" | "UNKNOWN";
  progressPercent: number;
  remainingHours: number;
  woOpenCount: number;
  prOpenCount: number;
  qcIssueOpenCount: number;
  issueOpenCount: number;
  status: string;
}

interface AggregateCountPacket extends RowDataPacket {
  total: number;
}

interface UnitDependencyCountPacket extends RowDataPacket {
  total: number;
}

interface WorkspaceCountdownPacket extends RowDataPacket {
  total: number;
  plan: number;
  proses: number;
  qcReady: number;
  done: number;
  remainingHours: number;
  progressPercent: number;
}

interface WorkspaceWoPacket extends RowDataPacket {
  submitted: number;
  approved: number;
  rejected: number;
  open: number;
}

interface WorkspaceIssuePacket extends RowDataPacket {
  open: number;
  resolved: number;
  highSeverityOpen: number;
}

interface WorkspaceDivisionProgressPacket extends RowDataPacket {
  divisionId: number | null;
  divisionName: string | null;
  total: number;
  done: number;
  remainingHours: number;
  progressPercent: number;
}

interface WorkspaceCountdownItemPacket extends RowDataPacket {
  countdownId: string;
  carId: string;
  unitName: string;
  divisionId: number | null;
  divisionName: string | null;
  panelId: number | null;
  panelName: string | null;
  sectionName: string | null;
  taskCategory: string;
  jobTypeId: string | null;
  jobTypeName: string | null;
  targetHoursRevised: number;
  totalActualHours: number;
  remainingHours: number;
  actualProgressPercent: number;
  status: string;
  deadlineDate: string | null;
  isOverdue: number | boolean;
}

interface BomPanelRow extends RowDataPacket {
  panelId: number;
  category: string | null;
  section: string | null;
  partName: string | null;
  divisionId: number | null;
  divisionName: string | null;
  isLocked: number | null;
  lockUpdatedAt: string | null;
  hasInstalled: number | null;
  progressPercent: number | null;
  remainingHours: number | null;
  stockStatus: "IN_STORAGE" | "RETRIEVED" | "INSTALLED" | "LOST" | null;
  conditionType: "BARU" | "RESTORE" | "BEKAS" | null;
  locationName: string | null;
  locationDetail: string | null;
  takenByName: string | null;
  dateOut: string | null;
  jobStatus: "PLAN" | "PROSES" | "QC_READY" | "DONE" | null;
  qcLastStatus: "LOLOS" | "TIDAK_LOLOS" | null;
  deadlineDate: string | null;
  countRevisi: number | null;
  currentDivisionName: string | null;
}

interface BomActualRow extends RowDataPacket {
  panelId: number;
  actualId: string;
}

interface BomReadyStockRow extends RowDataPacket {
  stockCardId: string;
  partName: string;
  locationLabel: string | null;
  entryNo: number | null;
}

interface BomTransferRow extends RowDataPacket {
  transactionId: string;
  itemName: string;
  sourceUnitName: string | null;
}

interface BomPrRow extends RowDataPacket {
  prId: string;
  prNumber: string;
  itemName: string;
  itemStatus: string | null;
}

interface BomVendorRow extends RowDataPacket {
  wovId: string;
  wovNumber: string;
  itemName: string;
  status: string | null;
}

interface BomTimelineRow extends RowDataPacket {
  panelId: number;
  occurredAt: string | null;
  jobName: string | null;
  jobDescription: string | null;
  employeeName: string | null;
  targetHours: number | null;
  statusLabel: string | null;
  progressPercent: number | null;
}

interface BomPhotoSlotRow extends RowDataPacket {
  panelId: number;
  slot: UnitBomPhotoSlot;
  photoCount: number | null;
  latestPhotoUrl: string | null;
  latestPhotoAt: string | null;
}

interface UnitPanelRow extends RowDataPacket {
  id: number;
  carId: string;
  parentId: number | null;
  section: string;
  name: string;
  category: string | null;
  isActive: number | boolean | null;
  sortOrder: number | null;
  qty: number | string | null;
  defaultLocationType: "GUDANG" | "WORKSHOP" | "UNIT" | null;
  defaultStockStatus: "IN_STORAGE" | "RETRIEVED" | "INSTALLED" | "LOST" | null;
  defaultConditionType: "BARU" | "RESTORE" | "BEKAS" | null;
  countdownUsageCount: number | null;
  statusUsageCount: number | null;
  childCount: number | null;
  createdAt: string | null;
  updatedAt: string | null;
}

interface MasterPanelInventorySchemaRow extends RowDataPacket {
  columnName: string;
}

interface MasterPanelInventorySchema {
  hasQty: boolean;
  hasDefaultLocationType: boolean;
  hasDefaultStockStatus: boolean;
  hasDefaultConditionType: boolean;
}

function mapTinyIntBoolean(value: unknown): boolean {
  return value === true || value === 1 || value === "1";
}

export interface UnitBoardListPayload {
  rows: UnitBoardRow[];
  total: number;
}

interface ScopeParams {
  employeeId: string;
  scope: AuthScope;
}

interface FindUnitsParams extends ScopeParams {
  query: UnitGridQuery;
}

interface CreateUnitParams {
  actorId: string;
  input: CreateUnitRequest;
}

interface UpdateUnitParams {
  actorId: string;
  unitId: string;
  input: UpdateUnitRequest;
}

interface DeleteUnitParams {
  actorId: string;
  unitId: string;
}

interface UnitDependencySummary {
  tableName: string;
  total: number;
}

interface BomFlatPart {
  panelId: number;
  category: string;
  section: string;
  label: string;
  physicalStatus: UnitBomPhysicalStatus;
  divisionId: number | null;
  divisionName: string | null;
  progressPercent: number;
  remainingHours: number;
  actualId: string | null;
  logisticStatus: UnitBomLogisticStatus | null;
  logisticReference: string | null;
  logisticPath: string | null;
  stockStatus: "IN_STORAGE" | "RETRIEVED" | "INSTALLED" | "LOST" | null;
  conditionType: "BARU" | "RESTORE" | "BEKAS" | null;
  locationName: string | null;
  locationDetail: string | null;
  takenByName: string | null;
  dateOut: string | null;
  jobStatus: "PLAN" | "PROSES" | "QC_READY" | "DONE" | null;
  qcLastStatus: "LOLOS" | "TIDAK_LOLOS" | null;
  deadlineDate: string | null;
  countRevisi: number | null;
  isLocked: boolean;
  currentDivisionName: string | null;
  detail: UnitBomPartDetail;
}

function buildScopeWhereClause(
  scope: AuthScope,
  employeeId: string,
  params: unknown[],
): string {
  if (scope.canViewAllUnits) {
    return "";
  }

  const clauses: string[] = [];

  if (scope.canViewAssignedUnits) {
    clauses.push(
      `EXISTS (
        SELECT 1
        FROM car_project_assignment cpa_scope
        WHERE cpa_scope.car_id = ub.unitId
          AND cpa_scope.ended_at IS NULL
          AND (
            cpa_scope.kp_id = ?
            OR cpa_scope.advisor_id = ?
            OR cpa_scope.kd_id = ?
          )
      )`,
    );
    params.push(employeeId, employeeId, employeeId);
  }

  if (scope.divisionIds.length > 0) {
    params.push(...scope.divisionIds);
    clauses.push(
      `EXISTS (
        SELECT 1
        FROM sm_jobdesc_countdown cd_scope
        WHERE cd_scope.car_id = ub.unitId
          AND cd_scope.division_id IN (${scope.divisionIds.map(() => "?").join(", ")})
      )`,
    );
  }

  if (clauses.length === 0) {
    return "1 = 0";
  }

  return `(${clauses.join(" OR ")})`;
}

function buildFilterClauses(query: UnitGridQuery, params: unknown[]): string[] {
  const clauses: string[] = [];

  if (query.search) {
    const value = `%${query.search}%`;
    clauses.push(
      `(
        ub.unitId LIKE ?
        OR ub.unitName LIKE ?
        OR COALESCE(ub.customerName, '') LIKE ?
        OR COALESCE(ub.kpName, '') LIKE ?
        OR COALESCE(ub.advisorName, '') LIKE ?
      )`,
    );
    params.push(value, value, value, value, value);
  }

  for (const filter of query.filters) {
    if (filter.field === "riskLevel") {
      clauses.push("ub.riskLevel = ?");
      params.push(filter.value);
      continue;
    }

    if (filter.field === "status") {
      clauses.push("ub.status = ?");
      params.push(filter.value);
    }
  }

  return clauses;
}

function buildOrderBy(sortBy: UnitGridQuery["sortBy"], direction: "asc" | "desc"): string {
  const columnMap: Record<UnitGridQuery["sortBy"], string> = {
    targetDeliveryDate: "ub.targetDeliveryDate",
    unitName: "ub.unitName",
    customerName: "ub.customerName",
    etaDate: "ub.etaDate",
    riskLevel:
      "CASE ub.riskLevel WHEN 'RED' THEN 4 WHEN 'ORANGE' THEN 3 WHEN 'YELLOW' THEN 2 WHEN 'GREEN' THEN 1 ELSE 0 END",
    progressPercent: "ub.progressPercent",
    remainingHours: "ub.remainingHours",
    woOpenCount: "ub.woOpenCount",
    issueOpenCount: "ub.issueOpenCount",
    status: "ub.status",
  };

  return `${columnMap[sortBy]} ${direction.toUpperCase()}, ub.unitName ASC`;
}

function normalizePartKey(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .replace(/\s+/gu, " ")
    .toLowerCase();
}

function toNullableText(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeUnitPanelInventoryInput<T extends CreateUnitPanelRequest | UpdateUnitPanelRequest>(input: T): T {
  if (input.defaultLocationType !== "UNIT" || input.defaultStockStatus === "INSTALLED") {
    return input;
  }

  return {
    ...input,
    defaultStockStatus: "INSTALLED",
  };
}

function mapUnitPanelRecord(row: UnitPanelRow): UnitPanelRecord {
  return {
    id: Number(row.id),
    carId: row.carId,
    parentId: row.parentId === null ? null : Number(row.parentId),
    nodeType: row.parentId === null ? "PANEL" : "PART",
    section: row.section,
    name: row.name,
    category: toNullableText(row.category),
    isActive: row.isActive === 1 || row.isActive === true || String(row.isActive) === "1",
    sortOrder: Number(row.sortOrder ?? 0),
    qty: Number(row.qty ?? 1),
    defaultLocationType: row.defaultLocationType ?? "UNIT",
    defaultStockStatus: row.defaultStockStatus ?? "INSTALLED",
    defaultConditionType: row.defaultConditionType ?? "BEKAS",
    countdownUsageCount: Number(row.countdownUsageCount ?? 0),
    statusUsageCount: Number(row.statusUsageCount ?? 0),
    childCount: Number(row.childCount ?? 0),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    children: [],
  };
}

function buildUnitPanelTree(rows: UnitPanelRow[]): UnitPanelRecord[] {
  const recordMap = new Map<number, UnitPanelRecord>();

  for (const row of rows) {
    recordMap.set(Number(row.id), mapUnitPanelRecord(row));
  }

  const roots: UnitPanelRecord[] = [];
  for (const row of rows) {
    const record = recordMap.get(Number(row.id));
    if (!record) {
      continue;
    }

    if (row.parentId === null) {
      roots.push(record);
      continue;
    }

    const parent = recordMap.get(Number(row.parentId));
    if (parent) {
      parent.children.push(record);
      continue;
    }

    roots.push(record);
  }

  return roots;
}

function humanizePrStatus(status: string | null): string {
  switch ((status ?? "").toUpperCase()) {
    case "ORDERED":
      return "Dipesan";
    case "ARRIVED":
      return "Tiba";
    case "HUNTING":
      return "Dicari";
    default:
      return "PR Aktif";
  }
}

function humanizeVendorStatus(status: string | null): string {
  switch ((status ?? "").toUpperCase()) {
    case "SENT":
      return "Dikirim";
    case "PROSES_VENDOR":
      return "Diproses Vendor";
    case "DONE_VENDOR":
      return "Selesai Vendor";
    case "REWORK_VENDOR":
      return "Rework Vendor";
    default:
      return "Vendor";
  }
}

function humanizeWorkStatus(status: string | null, progressPercent: number | null): string {
  const normalized = (status ?? "").toUpperCase();
  if (normalized === "DONE" || normalized === "DONE_QC" || Number(progressPercent ?? 0) >= 100) {
    return "Lolos QC";
  }

  if (normalized === "ONPROGRESS" || normalized === "PROSES") {
    return "Sedang Dikerjakan";
  }

  if (normalized === "CANCEL") {
    return "Dibatalkan";
  }

  return "Terjadwal";
}

function workStatusLabel(status: UnitBomPhysicalStatus): string {
  switch (status) {
    case "INSTALLED":
      return "Siap Dipasang";
    case "IN_DIVISION":
      return "Sedang Dikerjakan";
    case "DISASSEMBLED":
      return "Menunggu Tindak Lanjut";
    default:
      return "Belum Dicek";
  }
}

function resolvePhysicalStatus(row: BomPanelRow): UnitBomPhysicalStatus {
  if (Number(row.isLocked ?? 0) > 0 && row.divisionId !== null) {
    return "IN_DIVISION";
  }

  if (Number(row.hasInstalled ?? 0) > 0) {
    return "INSTALLED";
  }

  return "DISASSEMBLED";
}

function defaultPhotoSlots(rows: BomPhotoSlotRow[]): UnitBomPhotoSlotSummary[] {
  const bySlot = new Map<UnitBomPhotoSlot, BomPhotoSlotRow>();
  for (const row of rows) {
    bySlot.set(row.slot, row);
  }

  return [
    { slot: "BEFORE" as const, label: "Before" },
    { slot: "EVIDENCE" as const, label: "Evidence" },
    { slot: "AFTER" as const, label: "After" },
  ].map((slot) => {
    const row = bySlot.get(slot.slot);
    return {
      slot: slot.slot,
      label: slot.label,
      photoCount: Math.max(0, Number(row?.photoCount ?? 0)),
      latestPhotoUrl: row?.latestPhotoUrl ?? null,
      latestPhotoAt: row?.latestPhotoAt ?? null,
    };
  });
}

function buildTimeline(row: BomPanelRow, jobRows: BomTimelineRow[]): UnitBomTimelineItem[] {
  const events: UnitBomTimelineItem[] = [];
  if (row.divisionName) {
    events.push({
      eventType: "HANDOVER",
      title: "Pendataan awal",
      description: `Didata untuk ${row.divisionName}`,
      occurredAt: row.lockUpdatedAt,
      actorName: null,
      statusLabel: Number(row.isLocked ?? 0) > 0 ? "Aktif" : null,
    });
  }

  for (const job of jobRows.slice(-6)) {
    const hours = Number(job.targetHours ?? 0);
    const hourText = hours > 0 ? ` (${hours.toFixed(hours % 1 === 0 ? 0 : 1)} jam)` : "";
    const actorName = job.employeeName?.trim() || null;
    const statusLabel = humanizeWorkStatus(job.statusLabel, job.progressPercent);
    events.push({
      eventType: "JOB_PLAN",
      title: job.jobName?.trim() || "Pekerjaan job plan",
      description: `${job.jobDescription?.trim() || "Pekerjaan panel"}${actorName ? ` oleh ${actorName}` : ""}${hourText} - ${statusLabel}`,
      occurredAt: job.occurredAt,
      actorName,
      statusLabel,
    });
  }

  if (Number(row.progressPercent ?? 0) >= 100) {
    events.push({
      eventType: "QC",
      title: "Pemeriksaan akhir",
      description: "Progress part sudah selesai",
      occurredAt: null,
      actorName: null,
      statusLabel: "Selesai",
    });
  }

  return events;
}

function buildBomDocuments(options: {
  logisticStatus: UnitBomLogisticStatus | null;
  logisticReference: string | null;
  logisticPath: string | null;
}): UnitBomDocument[] {
  switch (options.logisticStatus) {
    case "READY_GUDANG":
      return [{
        documentType: "STOCK",
        title: "Stok Gudang",
        description: options.logisticReference ?? "Barang tersedia di gudang",
        statusLabel: "Ready",
        path: options.logisticPath,
      }];
    case "ORDER_PR":
      return [{
        documentType: "PR",
        title: "PR Logistik",
        description: options.logisticReference ?? "Menunggu proses pembelian",
        statusLabel: "PR Aktif",
        path: options.logisticPath,
      }];
    case "AT_VENDOR":
      return [{
        documentType: "WOV",
        title: "WO Vendor",
        description: options.logisticReference ?? "Sedang diproses vendor",
        statusLabel: "Vendor",
        path: options.logisticPath,
      }];
    case "CANNIBALIZED":
      return [{
        documentType: "TRANSFER",
        title: "Pemakaian Sementara",
        description: options.logisticReference ?? "Part dipakai sementara dari unit lain",
        statusLabel: "Transfer",
        path: options.logisticPath,
      }];
    default:
      return [];
  }
}

function buildBomTree(parts: BomFlatPart[]): UnitBomWorkspace["tree"] {
  const categoryMap = new Map<string, BomFlatPart[]>();
  for (const part of parts) {
    const bucket = categoryMap.get(part.category) ?? [];
    bucket.push(part);
    categoryMap.set(part.category, bucket);
  }

  return [...categoryMap.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([category, categoryParts]) => {
      const sectionMap = new Map<string, BomFlatPart[]>();
      for (const part of categoryParts) {
        const bucket = sectionMap.get(part.section) ?? [];
        bucket.push(part);
        sectionMap.set(part.section, bucket);
      }

      const sectionNodes: UnitBomNode[] = [...sectionMap.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([section, sectionParts]) => {
          const sortedParts = [...sectionParts].sort((left, right) => left.label.localeCompare(right.label));
          const sectionProgress =
            sortedParts.length > 0
              ? sortedParts.reduce((total, row) => total + row.progressPercent, 0) / sortedParts.length
              : 0;
          const sectionRemaining = sortedParts.reduce((total, row) => total + row.remainingHours, 0);

          return {
            nodeId: `section:${category}:${section}`,
            nodeType: "SECTION",
            label: section,
            category,
            section,
            panelId: null,
            physicalStatus: null,
            divisionId: null,
            divisionName: null,
            progressPercent: Number(sectionProgress.toFixed(2)),
            remainingHours: Number(sectionRemaining.toFixed(2)),
            actualId: null,
            logisticStatus: null,
            logisticReference: null,
            logisticPath: null,
            children: sortedParts.map((part) => ({
              nodeId: `part:${part.panelId}`,
              nodeType: "PART",
              label: part.label,
              category: part.category,
              section: part.section,
              panelId: part.panelId,
              physicalStatus: part.physicalStatus,
              divisionId: part.divisionId,
              divisionName: part.divisionName,
              progressPercent: Number(part.progressPercent.toFixed(2)),
              remainingHours: Number(part.remainingHours.toFixed(2)),
              actualId: part.actualId,
              logisticStatus: part.logisticStatus,
              logisticReference: part.logisticReference,
              logisticPath: part.logisticPath,
              stockStatus: part.stockStatus,
              conditionType: part.conditionType,
              locationName: part.locationName,
              locationDetail: part.locationDetail,
              takenByName: part.takenByName,
              dateOut: part.dateOut,
              jobStatus: part.jobStatus,
              qcLastStatus: part.qcLastStatus,
              deadlineDate: part.deadlineDate,
              countRevisi: part.countRevisi,
              isLocked: part.isLocked,
              currentDivisionName: part.currentDivisionName,
              detail: part.detail,
              children: [],
            })),
          };
        });

      const categoryProgress =
        categoryParts.length > 0
          ? categoryParts.reduce((total, row) => total + row.progressPercent, 0) / categoryParts.length
          : 0;
      const categoryRemaining = categoryParts.reduce((total, row) => total + row.remainingHours, 0);

      return {
        nodeId: `category:${category}`,
        nodeType: "CATEGORY",
        label: category,
        category,
        section: null,
        panelId: null,
        physicalStatus: null,
        divisionId: null,
        divisionName: null,
        progressPercent: Number(categoryProgress.toFixed(2)),
        remainingHours: Number(categoryRemaining.toFixed(2)),
        actualId: null,
        logisticStatus: null,
        logisticReference: null,
        logisticPath: null,
        children: sectionNodes,
      } satisfies UnitBomNode;
    });
}

function unitBoardBaseSql(): string {
  return `
    SELECT
      c.id AS unitId,
      c.unit_name AS unitName,
      c.plate_number AS plateNumber,
      c.customer_name AS customerName,
      c.restoration_type AS restorationType,
      COALESCE(c.is_margin, 1) AS isMargin,
      DATE_FORMAT(c.incoming_date, '%Y-%m-%d') AS incomingDate,
      DATE_FORMAT(c.revision_contract, '%Y-%m-%d') AS revisionContract,
      COALESCE(kp.full_name, '-') AS kpName,
      COALESCE(advisor.full_name, '-') AS advisorName,
      DATE_FORMAT(c.contract_delivery_date, '%Y-%m-%d') AS targetDeliveryDate,
      CASE
        WHEN cd.remainingHours > 0
          THEN DATE_FORMAT(DATE_ADD(CURDATE(), INTERVAL CEIL(cd.remainingHours / 8) DAY), '%Y-%m-%d')
        ELSE DATE_FORMAT(CURDATE(), '%Y-%m-%d')
      END AS etaDate,
      CASE
        WHEN c.contract_delivery_date IS NULL THEN 'UNKNOWN'
        WHEN c.contract_delivery_date < CURDATE() THEN 'RED'
        WHEN DATEDIFF(c.contract_delivery_date, CURDATE()) <= 2 THEN 'ORANGE'
        WHEN COALESCE(cd.progressPercent, 0) >= 85 THEN 'GREEN'
        ELSE 'YELLOW'
      END AS riskLevel,
      ROUND(COALESCE(cd.progressPercent, 0), 2) AS progressPercent,
      ROUND(COALESCE(cd.remainingHours, 0), 2) AS remainingHours,
      COALESCE(wo.openCount, 0) AS woOpenCount,
      0 AS prOpenCount,
      COALESCE(qc.notPassCount, 0) AS qcIssueOpenCount,
      COALESCE(li.openCount, 0) AS issueOpenCount,
      COALESCE(c.status, 'In_Progress') AS status
    FROM cars c
    LEFT JOIN (
      SELECT
        car_id,
        MAX(kp_id) AS kp_id,
        MAX(advisor_id) AS advisor_id
      FROM car_project_assignment
      WHERE ended_at IS NULL
      GROUP BY car_id
    ) cpa ON cpa.car_id = c.id
    LEFT JOIN sm_employee kp ON kp.employee_id = cpa.kp_id
    LEFT JOIN sm_employee advisor ON advisor.employee_id = cpa.advisor_id
    LEFT JOIN (
      SELECT
        car_id,
        AVG(actual_progress_percent) AS progressPercent,
        SUM(COALESCE(remaining_hours, 0)) AS remainingHours
      FROM sm_jobdesc_countdown
      GROUP BY car_id
    ) cd ON cd.car_id = c.id
    LEFT JOIN (
      SELECT
        car_id,
        SUM(CASE WHEN status IN ('SUBMITTED', 'APPROVED') THEN 1 ELSE 0 END) AS openCount
      FROM sm_jobdesc_wo
      GROUP BY car_id
    ) wo ON wo.car_id = c.id
    LEFT JOIN (
      SELECT
        cd.car_id,
        SUM(CASE WHEN qc.result_status = 'TIDAK_LOLOS' THEN 1 ELSE 0 END) AS notPassCount
      FROM sm_qc_inspections qc
      JOIN sm_jobdesc_countdown cd ON cd.id = qc.core_id
      GROUP BY cd.car_id
    ) qc ON qc.car_id = c.id
    LEFT JOIN (
      SELECT
        wl.car_id,
        SUM(CASE WHEN wli.is_resolved = 0 THEN 1 ELSE 0 END) AS openCount
      FROM sm_work_ledger_issues wli
      JOIN sm_work_ledger wl ON wl.id = wli.ledger_id
      GROUP BY wl.car_id
    ) li ON li.car_id = c.id
  `;
}

function mapUnitBoardRow(row: UnitBoardRowPacket): UnitBoardRow {
  return {
    unitId: row.unitId,
    unitName: row.unitName,
    plateNumber: row.plateNumber,
    customerName: row.customerName,
    restorationType: row.restorationType,
    isMargin: mapTinyIntBoolean(row.isMargin),
    incomingDate: row.incomingDate,
    revisionContract: row.revisionContract,
    kpName: row.kpName,
    advisorName: row.advisorName,
    targetDeliveryDate: row.targetDeliveryDate,
    etaDate: row.etaDate,
    riskLevel: row.riskLevel,
    progressPercent: Number(row.progressPercent ?? 0),
    remainingHours: Number(row.remainingHours ?? 0),
    woOpenCount: Number(row.woOpenCount ?? 0),
    prOpenCount: Number(row.prOpenCount ?? 0),
    qcIssueOpenCount: Number(row.qcIssueOpenCount ?? 0),
    issueOpenCount: Number(row.issueOpenCount ?? 0),
    status: row.status,
  };
}

function getUnitDeleteDependencyTables(env: ApiEnv): readonly string[] {
  return [
  "car_project_assignment",
  "master_panels",
  "planning_target_divisions",
  "sm_bubut_invoice",
  "sm_car_panel_status",
  "sm_issue_log",
  "sm_jobdesc_countdown",
  "sm_jobdesc_countdown_detail",
  "sm_jobdesc_wo",
  "sm_qc_final_approvals",
  "sm_unit_budgets",
  "sm_weekly_plan_units",
  "sm_wo_vendor",
  "sm_work_ledger",
  "summary_division_monitoring",
  `${env.PURCHASE_DB_NAME}.pur_pr_header`,
  `${env.PURCHASE_DB_NAME}.vnd_wo_vendor`,
  `${env.WAREHOUSE_DB_NAME}.wh_material_usage`,
  `${env.WAREHOUSE_DB_NAME}.wh_stock_card`,
  `${env.WAREHOUSE_DB_NAME}.wh_transactions`,
] as const;
}

export class UnitsRepository {
  private readonly env: ApiEnv;
  private readonly purchaseDb: string;
  private readonly warehouseDb: string;
  private masterPanelInventorySchemaPromise: Promise<MasterPanelInventorySchema> | null = null;

  constructor(
    private readonly poolFactory: () => Pool = getMySqlPool,
  ) {
    this.env = getApiEnv();
    this.purchaseDb = this.env.PURCHASE_DB_NAME;
    this.warehouseDb = this.env.WAREHOUSE_DB_NAME;
  }

  private async getMasterPanelInventorySchema(pool: Pick<Pool, "query">): Promise<MasterPanelInventorySchema> {
    if (!this.masterPanelInventorySchemaPromise) {
      this.masterPanelInventorySchemaPromise = pool
        .query<MasterPanelInventorySchemaRow[]>(
          `
            SELECT column_name AS columnName
            FROM information_schema.columns
            WHERE table_schema = DATABASE()
              AND table_name = 'master_panels'
              AND column_name IN (
                'qty',
                'default_location_type',
                'default_stock_status',
                'default_condition_type'
              )
          `,
        )
        .then(([rows]) => {
          const columns = new Set(rows.map((row) => row.columnName));
          return {
            hasQty: columns.has("qty"),
            hasDefaultLocationType: columns.has("default_location_type"),
            hasDefaultStockStatus: columns.has("default_stock_status"),
            hasDefaultConditionType: columns.has("default_condition_type"),
          };
        });
    }

    return this.masterPanelInventorySchemaPromise;
  }

  private async findUnitBoardRowById(unitId: string): Promise<UnitBoardRow | null> {
    const pool = this.poolFactory();
    const [rows] = (await pool.query(
      `
        SELECT *
        FROM (${unitBoardBaseSql()}) ub
        WHERE ub.unitId = ?
        LIMIT 1
      `,
      [unitId],
    )) as [UnitBoardRowPacket[], unknown];

    return rows[0] ? mapUnitBoardRow(rows[0]) : null;
  }

  async createUnit(params: {
    actorId: string;
    input: CreateUnitRequest;
  }): Promise<UnitBoardRow> {
    const pool = this.poolFactory();
    const existing = await this.findUnitBoardRowById(params.input.unitId);
    if (existing) {
      throw new Error("UNIT_ALREADY_EXISTS");
    }

    await pool.execute<ResultSetHeader>(
      `
        INSERT INTO cars (
          id,
          unit_name,
          plate_number,
          customer_name,
          restoration_type,
          is_margin,
          contract_delivery_date,
          incoming_date,
          revision_contract,
          status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        params.input.unitId,
        params.input.unitName,
        params.input.plateNumber,
        params.input.customerName,
        params.input.restorationType,
        params.input.isMargin ? 1 : 0,
        params.input.contractDeliveryDate,
        params.input.incomingDate,
        params.input.revisionContract,
        params.input.status,
      ],
    );

    const unit = await this.findUnitBoardRowById(params.input.unitId);
    if (!unit) {
      throw new Error("UNIT_NOT_FOUND");
    }

    return unit;
  }

  async updateUnit(params: {
    actorId: string;
    unitId: string;
    input: UpdateUnitRequest;
  }): Promise<{ before: UnitBoardRow; after: UnitBoardRow }> {
    const before = await this.findUnitBoardRowById(params.unitId);
    if (!before) {
      throw new Error("UNIT_NOT_FOUND");
    }

    const pool = this.poolFactory();
    await pool.execute<ResultSetHeader>(
      `
        UPDATE cars
        SET
          unit_name = ?,
          plate_number = ?,
          customer_name = ?,
          restoration_type = ?,
          is_margin = ?,
          contract_delivery_date = ?,
          incoming_date = ?,
          revision_contract = ?,
          status = ?
        WHERE id = ?
        LIMIT 1
      `,
      [
        params.input.unitName,
        params.input.plateNumber,
        params.input.customerName,
        params.input.restorationType,
        params.input.isMargin ? 1 : 0,
        params.input.contractDeliveryDate,
        params.input.incomingDate,
        params.input.revisionContract,
        params.input.status,
        params.unitId,
      ],
    );

    const after = await this.findUnitBoardRowById(params.unitId);
    if (!after) {
      throw new Error("UNIT_NOT_FOUND");
    }

    return { before, after };
  }

  async deleteUnit(params: {
    actorId: string;
    unitId: string;
  }): Promise<UnitBoardRow> {
    const current = await this.findUnitBoardRowById(params.unitId);
    if (!current) {
      throw new Error("UNIT_NOT_FOUND");
    }

    const pool = this.poolFactory();
    for (const tableName of getUnitDeleteDependencyTables(this.env)) {
      const [rows] = (await pool.query(
        `
          SELECT COUNT(*) AS total
          FROM ${tableName}
          WHERE car_id = ?
        `,
        [params.unitId],
      )) as [UnitDependencyCountPacket[], unknown];

      if (Number(rows[0]?.total ?? 0) > 0) {
        throw new Error("UNIT_IN_USE");
      }
    }

    await pool.execute<ResultSetHeader>(
      `
        DELETE FROM cars
        WHERE id = ?
        LIMIT 1
      `,
      [params.unitId],
    );

    return current;
  }

  async findUnitBoard(params: FindUnitsParams): Promise<UnitBoardListPayload> {
    const pool = this.poolFactory();
    const whereParams: unknown[] = [];
    const whereClauses: string[] = [];

    const scopeClause = buildScopeWhereClause(
      params.scope,
      params.employeeId,
      whereParams,
    );
    if (scopeClause) {
      whereClauses.push(scopeClause);
    }

    whereClauses.push(...buildFilterClauses(params.query, whereParams));
    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    const [countRows] = (await pool.query(
      `
        SELECT COUNT(*) AS total
        FROM (${unitBoardBaseSql()}) ub
        ${whereSql}
      `,
      whereParams,
    )) as [AggregateCountPacket[], unknown];

    const limit = params.query.limit;
    const offset = (params.query.page - 1) * params.query.limit;
    const dataParams = [...whereParams, limit, offset];
    const [rows] = (await pool.query(
      `
        SELECT *
        FROM (${unitBoardBaseSql()}) ub
        ${whereSql}
        ORDER BY ${buildOrderBy(params.query.sortBy, params.query.sortDirection)}
        LIMIT ? OFFSET ?
      `,
      dataParams,
    )) as [UnitBoardRowPacket[], unknown];

    return {
      rows: rows.map(mapUnitBoardRow),
      total: countRows[0]?.total ?? 0,
    };
  }

  async findUnitSummary(params: ScopeParams & { unitId: string }): Promise<UnitBoardRow | null> {
    const pool = this.poolFactory();
    const whereParams: unknown[] = [];
    const whereClauses: string[] = [];

    const scopeClause = buildScopeWhereClause(
      params.scope,
      params.employeeId,
      whereParams,
    );
    if (scopeClause) {
      whereClauses.push(scopeClause);
    }
    whereClauses.push("ub.unitId = ?");
    whereParams.push(params.unitId);

    const [rows] = (await pool.query(
      `
        SELECT *
        FROM (${unitBoardBaseSql()}) ub
        WHERE ${whereClauses.join(" AND ")}
        LIMIT 1
      `,
      whereParams,
    )) as [UnitBoardRowPacket[], unknown];

    const row = rows[0];
    return row ? mapUnitBoardRow(row) : null;
  }

  async findUnitWorkspace(params: ScopeParams & { unitId: string }): Promise<UnitWorkspace | null> {
    const unitSummary = await this.findUnitSummary(params);
    if (!unitSummary) {
      return null;
    }

    const pool = this.poolFactory();
    const [countdownRows, woRows, issueRows, divisionRows, countdownItemRows] = await Promise.all([
      pool.query<WorkspaceCountdownPacket[]>(
        `
          SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN status = 'PLAN' THEN 1 ELSE 0 END) AS plan,
            SUM(CASE WHEN status = 'PROSES' THEN 1 ELSE 0 END) AS proses,
            SUM(CASE WHEN status = 'QC_READY' THEN 1 ELSE 0 END) AS qcReady,
            SUM(CASE WHEN status = 'DONE' THEN 1 ELSE 0 END) AS done,
            ROUND(SUM(COALESCE(remaining_hours, 0)), 2) AS remainingHours,
            ROUND(AVG(actual_progress_percent), 2) AS progressPercent
          FROM sm_jobdesc_countdown
          WHERE car_id = ?
        `,
        [params.unitId],
      ),
      pool.query<WorkspaceWoPacket[]>(
        `
          SELECT
            SUM(CASE WHEN status = 'SUBMITTED' THEN 1 ELSE 0 END) AS submitted,
            SUM(CASE WHEN status = 'APPROVED' THEN 1 ELSE 0 END) AS approved,
            SUM(CASE WHEN status = 'REJECTED' THEN 1 ELSE 0 END) AS rejected,
            SUM(CASE WHEN status IN ('SUBMITTED', 'APPROVED') THEN 1 ELSE 0 END) AS open
          FROM sm_jobdesc_wo
          WHERE car_id = ?
        `,
        [params.unitId],
      ),
      pool.query<WorkspaceIssuePacket[]>(
        `
          SELECT
            SUM(CASE WHEN wli.is_resolved = 0 THEN 1 ELSE 0 END) AS open,
            SUM(CASE WHEN wli.is_resolved = 1 THEN 1 ELSE 0 END) AS resolved,
            SUM(
              CASE
                WHEN wli.is_resolved = 0 AND wli.severity = 'HIGH' THEN 1
                ELSE 0
              END
            ) AS highSeverityOpen
          FROM sm_work_ledger_issues wli
          JOIN sm_work_ledger wl ON wl.id = wli.ledger_id
          WHERE wl.car_id = ?
        `,
        [params.unitId],
      ),
      pool.query<WorkspaceDivisionProgressPacket[]>(
        `
          SELECT
            cd.division_id AS divisionId,
            COALESCE(d.name, 'Tanpa Divisi') AS divisionName,
            COUNT(*) AS total,
            SUM(CASE WHEN COALESCE(cd.status, 'PLAN') = 'DONE' THEN 1 ELSE 0 END) AS done,
            ROUND(SUM(COALESCE(cd.remaining_hours, 0)), 2) AS remainingHours,
            ROUND(AVG(COALESCE(cd.actual_progress_percent, 0)), 2) AS progressPercent
          FROM sm_jobdesc_countdown cd
          LEFT JOIN sm_divisi d ON d.id = cd.division_id
          WHERE cd.car_id = ?
          GROUP BY cd.division_id, COALESCE(d.name, 'Tanpa Divisi')
          ORDER BY progressPercent ASC, remainingHours DESC, divisionName ASC
        `,
        [params.unitId],
      ),
      pool.query<WorkspaceCountdownItemPacket[]>(
        `
          SELECT
            cd.id AS countdownId,
            cd.car_id AS carId,
            c.unit_name AS unitName,
            cd.division_id AS divisionId,
            COALESCE(d.name, 'Tanpa Divisi') AS divisionName,
            cd.panel_id AS panelId,
            mp.name AS panelName,
            cd.section_name AS sectionName,
            cd.task_category AS taskCategory,
            cd.job_type_id AS jobTypeId,
            jt.job_name AS jobTypeName,
            ROUND(COALESCE(cd.target_hours_revised, cd.target_hours_initial + cd.time_extension_hours, cd.target_hours_initial), 2) AS targetHoursRevised,
            ROUND(COALESCE(cd.total_actual_hours, 0), 2) AS totalActualHours,
            ROUND(COALESCE(cd.remaining_hours, 0), 2) AS remainingHours,
            ROUND(COALESCE(cd.actual_progress_percent, 0), 2) AS actualProgressPercent,
            COALESCE(cd.status, 'PLAN') AS status,
            DATE_FORMAT(cd.deadline_date, '%Y-%m-%d') AS deadlineDate,
            CASE
              WHEN cd.deadline_date IS NOT NULL AND cd.deadline_date < CURDATE() AND COALESCE(cd.status, 'PLAN') <> 'DONE' THEN 1
              ELSE 0
            END AS isOverdue
          FROM sm_jobdesc_countdown cd
          JOIN cars c ON c.id = cd.car_id
          LEFT JOIN sm_divisi d ON d.id = cd.division_id
          LEFT JOIN master_panels mp ON mp.id = cd.panel_id
          LEFT JOIN master_job_types jt ON jt.id = cd.job_type_id
          WHERE cd.car_id = ?
          ORDER BY d.name ASC, COALESCE(mp.section, cd.section_name, mp.name, '') ASC, cd.deadline_date ASC, cd.updated_at DESC
        `,
        [params.unitId],
      ),
    ]);

    const countdown = countdownRows[0][0];
    const wo = woRows[0][0];
    const issue = issueRows[0][0];
    const riskReasonByLevel: Record<UnitBoardRow["riskLevel"], string> = {
      GREEN: "Progress aman terhadap target delivery.",
      YELLOW: "ETA mendekati target delivery.",
      ORANGE: "Target delivery sudah kritis dan butuh akselerasi.",
      RED: "Target delivery sudah terlewati.",
      UNKNOWN: "Belum ada target delivery kontrak.",
    };

    return {
      unitId: params.unitId,
      countdownSummary: {
        total: Number(countdown?.total ?? 0),
        plan: Number(countdown?.plan ?? 0),
        proses: Number(countdown?.proses ?? 0),
        qcReady: Number(countdown?.qcReady ?? 0),
        done: Number(countdown?.done ?? 0),
        remainingHours: Number(countdown?.remainingHours ?? 0),
        progressPercent: Number(countdown?.progressPercent ?? 0),
      },
      divisionProgress: divisionRows[0].map((row) => ({
        divisionId: row.divisionId,
        divisionName: row.divisionName ?? "Tanpa Divisi",
        total: Number(row.total ?? 0),
        done: Number(row.done ?? 0),
        remainingHours: Number(row.remainingHours ?? 0),
        progressPercent: Number(row.progressPercent ?? 0),
      })),
      countdownItems: countdownItemRows[0].map((row) => {
        const remainingHours = Number(row.remainingHours ?? 0);
        const targetHours = Number(row.targetHoursRevised ?? 0);
        return {
          countdownId: row.countdownId,
          carId: row.carId,
          unitName: row.unitName,
          divisionId: row.divisionId,
          divisionName: row.divisionName ?? "Tanpa Divisi",
          panelId: row.panelId,
          panelName: row.panelName,
          sectionName: row.sectionName,
          taskCategory: row.taskCategory,
          jobTypeId: row.jobTypeId,
          jobTypeName: row.jobTypeName,
          targetHoursRevised: targetHours,
          totalActualHours: Number(row.totalActualHours ?? 0),
          remainingHours,
          recommendationHours: remainingHours > 0 ? remainingHours : targetHours,
          workdayAlias: _build_workday_alias(remainingHours > 0 ? remainingHours : targetHours),
          actualProgressPercent: Number(row.actualProgressPercent ?? 0),
          status: row.status,
          deadlineDate: row.deadlineDate,
          isOverdue: row.isOverdue === 1 || row.isOverdue === true || String(row.isOverdue) === "1",
        };
      }),
      woSummary: {
        submitted: Number(wo?.submitted ?? 0),
        approved: Number(wo?.approved ?? 0),
        rejected: Number(wo?.rejected ?? 0),
        open: Number(wo?.open ?? 0),
      },
      issueSummary: {
        open: Number(issue?.open ?? 0),
        resolved: Number(issue?.resolved ?? 0),
        highSeverityOpen: Number(issue?.highSeverityOpen ?? 0),
      },
      deliveryRisk: {
        level: unitSummary.riskLevel,
        reason: riskReasonByLevel[unitSummary.riskLevel],
      },
    };
  }

  async findUnitBom(params: ScopeParams & { unitId: string }): Promise<UnitBomWorkspace | null> {
    const unitSummary = await this.findUnitSummary(params);
    if (!unitSummary) {
      return null;
    }

    const pool = this.poolFactory();
    const purchasePrHeader = qualifyTable(this.purchaseDb, "pur_pr_header");
    const purchasePrItems = qualifyTable(this.purchaseDb, "pur_pr_items");
    const vendorTable = qualifyTable(this.purchaseDb, "vnd_wo_vendor");
    const warehouseStockCard = qualifyTable(this.warehouseDb, "wh_stock_card");
    const warehouseTransactions = qualifyTable(this.warehouseDb, "wh_transactions");
    const warehouseLocations = qualifyTable(this.warehouseDb, "wh_storage_locations");

    const [
      panelRowsResult,
      actualRowsResult,
      readyStockRowsResult,
      transferRowsResult,
      prRowsResult,
      vendorRowsResult,
      timelineRowsResult,
      photoSlotRowsResult,
    ] =
      await Promise.all([
        pool.query<BomPanelRow[]>(
          `
            SELECT
              mp.id AS panelId,
              mp.category AS category,
              mp.section AS section,
              mp.name AS partName,
              panel_lock.currentDivisionId AS divisionId,
              d.name AS divisionName,
              panel_lock.isLocked AS isLocked,
              d.name AS currentDivisionName,
              panel_lock.lockUpdatedAt AS lockUpdatedAt,
              stock_latest.status AS stockStatus,
              stock_latest.conditionType AS conditionType,
              stock_latest.locationName AS locationName,
              stock_latest.locationDetail AS locationDetail,
              stock_latest.takenByName AS takenByName,
              stock_latest.dateOut AS dateOut,
              SUBSTRING_INDEX(
                GROUP_CONCAT(COALESCE(cd.status, 'PLAN') ORDER BY cd.updated_at DESC SEPARATOR ','),
                ',',
                1
              ) AS jobStatus,
              SUBSTRING_INDEX(
                GROUP_CONCAT(cd.qc_last_status ORDER BY cd.updated_at DESC SEPARATOR ','),
                ',',
                1
              ) AS qcLastStatus,
              DATE_FORMAT(MIN(cd.deadline_date), '%Y-%m-%d') AS deadlineDate,
              MAX(cd.count_revisi) AS countRevisi,
              MAX(
                CASE
                  WHEN COALESCE(cd.status, 'PLAN') = 'DONE' OR COALESCE(cd.actual_progress_percent, 0) >= 100
                    THEN 1
                  ELSE 0
                END
              ) AS hasInstalled,
              ROUND(MAX(COALESCE(cd.actual_progress_percent, 0)), 2) AS progressPercent,
              ROUND(SUM(COALESCE(cd.remaining_hours, 0)), 2) AS remainingHours
            FROM master_panels mp
            LEFT JOIN (
              SELECT
                cps.car_id,
                cps.panel_id,
                MAX(CASE WHEN cps.is_locked = 1 THEN 1 ELSE 0 END) AS isLocked,
                CAST(
                  SUBSTRING_INDEX(
                    GROUP_CONCAT(cps.current_division_id ORDER BY cps.is_locked DESC, cps.last_updated_at DESC SEPARATOR ','),
                    ',',
                    1
                  ) AS SIGNED
                ) AS currentDivisionId,
                DATE_FORMAT(MAX(cps.last_updated_at), '%Y-%m-%d %H:%i:%s') AS lockUpdatedAt
              FROM sm_car_panel_status cps
              WHERE cps.car_id = ?
              GROUP BY cps.car_id, cps.panel_id
            ) panel_lock
              ON panel_lock.car_id = mp.car_id
             AND panel_lock.panel_id = mp.id
            LEFT JOIN sm_divisi d ON d.id = panel_lock.currentDivisionId
            LEFT JOIN (
              SELECT
                ranked.partName,
                ranked.status,
                ranked.conditionType,
                ranked.locationName,
                ranked.locationDetail,
                ranked.takenByName,
                ranked.dateOut
              FROM (
                SELECT
                  sc.part_name AS partName,
                  sc.status AS status,
                  sc.condition_type AS conditionType,
                  sl.label AS locationName,
                  sc.location_detail AS locationDetail,
                  sc.taken_by_name AS takenByName,
                  DATE_FORMAT(sc.date_out, '%Y-%m-%d') AS dateOut,
                  ROW_NUMBER() OVER (
                    PARTITION BY sc.part_name
                    ORDER BY COALESCE(sc.updated_at, sc.created_at) DESC
                  ) AS rowNo
                FROM ${warehouseStockCard} sc
                LEFT JOIN ${warehouseLocations} sl ON sl.id = sc.storage_location_id
                WHERE sc.car_id = ?
              ) ranked
              WHERE ranked.rowNo = 1
            ) stock_latest
              ON stock_latest.partName = mp.name
            LEFT JOIN sm_jobdesc_countdown cd
              ON cd.car_id = mp.car_id
             AND cd.panel_id = mp.id
            WHERE mp.car_id = ?
              AND COALESCE(mp.is_active, 1) = 1
            GROUP BY
              mp.id,
              mp.category,
              mp.section,
              mp.name,
              panel_lock.currentDivisionId,
              d.name,
              panel_lock.isLocked,
              stock_latest.status,
              stock_latest.conditionType,
              stock_latest.locationName,
              stock_latest.locationDetail,
              stock_latest.takenByName,
              stock_latest.dateOut,
              panel_lock.lockUpdatedAt
            ORDER BY mp.category ASC, mp.section ASC, mp.name ASC
          `,
          [params.unitId, params.unitId, params.unitId],
        ),
        pool.query<BomActualRow[]>(
          `
            SELECT
              cd.panel_id AS panelId,
              SUBSTRING_INDEX(
                GROUP_CONCAT(a.id ORDER BY COALESCE(a.finish_time, a.start_time, a.created_at) DESC SEPARATOR ','),
                ',',
                1
              ) AS actualId
            FROM sm_jobdesc_actual a
            JOIN sm_jobdesc_plan p ON p.id = a.plandaily_id
            JOIN sm_jobdesc_countdown cd ON cd.id = p.core_id
            WHERE cd.car_id = ?
              AND cd.panel_id IS NOT NULL
            GROUP BY cd.panel_id
          `,
          [params.unitId],
        ),
        pool.query<BomReadyStockRow[]>(
          `
            SELECT
              sc.id AS stockCardId,
              sc.part_name AS partName,
              sl.label AS locationLabel,
              sc.entry_no AS entryNo
            FROM ${warehouseStockCard} sc
            LEFT JOIN ${warehouseLocations} sl ON sl.id = sc.storage_location_id
            WHERE sc.car_id = ?
              AND sc.status = 'IN_STORAGE'
            ORDER BY COALESCE(sc.updated_at, sc.created_at) DESC
          `,
          [params.unitId],
        ),
        pool.query<BomTransferRow[]>(
          `
            SELECT
              t.id AS transactionId,
              t.item_name AS itemName,
              COALESCE(source_sc.car_name, source_sc.car_id) AS sourceUnitName
            FROM ${warehouseTransactions} t
            LEFT JOIN ${warehouseStockCard} source_sc ON source_sc.id = t.stock_card_id
            WHERE t.car_id = ?
              AND t.transaction_type = 'TRANSFER_PART'
              AND COALESCE(t.approval_status, 'PENDING_KD') <> 'REJECTED'
            ORDER BY COALESCE(t.updated_at, t.created_at) DESC
          `,
          [params.unitId],
        ),
        pool.query<BomPrRow[]>(
          `
            SELECT
              h.id AS prId,
              h.pr_number AS prNumber,
              i.item_name AS itemName,
              COALESCE(i.status, h.status, 'HUNTING') AS itemStatus
            FROM ${purchasePrHeader} h
            JOIN ${purchasePrItems} i ON i.pr_id = h.id
            WHERE h.car_id = ?
              AND (
                COALESCE(i.status, 'HUNTING') IN ('HUNTING', 'ORDERED', 'ARRIVED')
                OR h.acc_tracking <> 'APPROVED'
              )
            ORDER BY h.created_at DESC, i.created_at DESC
          `,
          [params.unitId],
        ),
        pool.query<BomVendorRow[]>(
          `
            SELECT
              w.id AS wovId,
              w.wov_number AS wovNumber,
              w.item_name AS itemName,
              COALESCE(w.status, 'OPEN') AS status
            FROM ${vendorTable} w
            WHERE w.car_id = ?
              AND COALESCE(w.status, 'OPEN') IN ('SENT', 'PROSES_VENDOR', 'DONE_VENDOR', 'REWORK_VENDOR')
            ORDER BY w.created_at DESC
          `,
          [params.unitId],
        ),
        pool.query<BomTimelineRow[]>(
          `
            SELECT
              cd.panel_id AS panelId,
              DATE_FORMAT(COALESCE(a.finish_time, a.start_time, a.created_at, p.task_date, cd.updated_at, cd.start_date, cd.deadline_date), '%Y-%m-%d %H:%i:%s') AS occurredAt,
              COALESCE(mjt.job_name, cd.section_name, 'Job Plan') AS jobName,
              COALESCE(NULLIF(TRIM(p.jobdescription), ''), cd.section_name, mjt.job_name, '-') AS jobDescription,
              COALESCE(e.full_name, p.assigned_user_id) AS employeeName,
              ROUND(COALESCE(TIME_TO_SEC(p.dailyTargetHours) / 3600, cd.target_hours_revised, cd.target_hours_initial + cd.time_extension_hours, cd.target_hours_initial, 0), 2) AS targetHours,
              COALESCE(a.status, p.status, cd.status, 'PLAN') AS statusLabel,
              ROUND(COALESCE(a.progres, cd.actual_progress_percent, 0), 2) AS progressPercent
            FROM sm_jobdesc_countdown cd
            LEFT JOIN sm_jobdesc_plan p ON p.core_id = cd.id
            LEFT JOIN (
              SELECT latest_actual.*
              FROM sm_jobdesc_actual latest_actual
              JOIN (
                SELECT plandaily_id, MAX(created_at) AS latestCreatedAt
                FROM sm_jobdesc_actual
                GROUP BY plandaily_id
              ) latest
                ON latest.plandaily_id = latest_actual.plandaily_id
               AND latest.latestCreatedAt = latest_actual.created_at
            ) a ON a.plandaily_id = p.id
            LEFT JOIN master_job_types mjt ON mjt.id = cd.job_type_id
            LEFT JOIN sm_employee e ON e.employee_id = p.assigned_user_id
            WHERE cd.car_id = ?
              AND cd.panel_id IS NOT NULL
            ORDER BY cd.panel_id ASC, COALESCE(a.finish_time, a.start_time, a.created_at, p.task_date, cd.updated_at, cd.start_date, cd.deadline_date) ASC
          `,
          [params.unitId],
        ),
        pool.query<BomPhotoSlotRow[]>(
          `
            SELECT
              photo_source.panelId AS panelId,
              photo_source.slot AS slot,
              COUNT(*) AS photoCount,
              SUBSTRING_INDEX(
                GROUP_CONCAT(photo_source.photoUrl ORDER BY photo_source.photoAt DESC SEPARATOR '\n'),
                '\n',
                1
              ) AS latestPhotoUrl,
              DATE_FORMAT(MAX(photo_source.photoAt), '%Y-%m-%d %H:%i:%s') AS latestPhotoAt
            FROM (
              SELECT
                cd.panel_id AS panelId,
                CASE
                  WHEN tp.photo_type = 'BEFORE' THEN 'BEFORE'
                  WHEN tp.photo_type = 'AFTER' THEN 'AFTER'
                  ELSE 'EVIDENCE'
                END AS slot,
                tp.photo_url AS photoUrl,
                COALESCE(tp.uploaded_at, CURRENT_TIMESTAMP) AS photoAt
              FROM sm_work_photos_temp tp
              JOIN sm_jobdesc_actual a ON a.id = tp.actual_id
              JOIN sm_jobdesc_plan p ON p.id = a.plandaily_id
              JOIN sm_jobdesc_countdown cd ON cd.id = p.core_id
              WHERE cd.car_id = ?
                AND cd.panel_id IS NOT NULL
              UNION ALL
              SELECT
                cd.panel_id AS panelId,
                CASE
                  WHEN lp.photo_type = 'BEFORE' THEN 'BEFORE'
                  WHEN lp.photo_type = 'AFTER' THEN 'AFTER'
                  ELSE 'EVIDENCE'
                END AS slot,
                lp.photo_url AS photoUrl,
                COALESCE(lp.taken_at, lp.created_at) AS photoAt
              FROM sm_work_ledger_photos lp
              JOIN sm_work_ledger wl ON wl.id = lp.ledger_id
              JOIN sm_jobdesc_actual a ON a.id = wl.actual_id
              JOIN sm_jobdesc_plan p ON p.id = a.plandaily_id
              JOIN sm_jobdesc_countdown cd ON cd.id = p.core_id
              WHERE cd.car_id = ?
                AND cd.panel_id IS NOT NULL
            ) photo_source
            GROUP BY photo_source.panelId, photo_source.slot
          `,
          [params.unitId, params.unitId],
        ),
      ]);

    const panelRows = panelRowsResult[0];
    const actualRows = actualRowsResult[0];
    const readyStockRows = readyStockRowsResult[0];
    const transferRows = transferRowsResult[0];
    const prRows = prRowsResult[0];
    const vendorRows = vendorRowsResult[0];
    const timelineRows = timelineRowsResult[0];
    const photoSlotRows = photoSlotRowsResult[0];

    const actualByPanel = new Map<number, string>();
    for (const row of actualRows) {
      if (!actualByPanel.has(row.panelId)) {
        actualByPanel.set(row.panelId, row.actualId);
      }
    }

    const readyStockByPart = new Map<string, BomReadyStockRow>();
    for (const row of readyStockRows) {
      const key = normalizePartKey(row.partName);
      if (key && !readyStockByPart.has(key)) {
        readyStockByPart.set(key, row);
      }
    }

    const transferByPart = new Map<string, BomTransferRow>();
    for (const row of transferRows) {
      const key = normalizePartKey(row.itemName);
      if (key && !transferByPart.has(key)) {
        transferByPart.set(key, row);
      }
    }

    const prByPart = new Map<string, BomPrRow>();
    for (const row of prRows) {
      const key = normalizePartKey(row.itemName);
      if (key && !prByPart.has(key)) {
        prByPart.set(key, row);
      }
    }

    const vendorByPart = new Map<string, BomVendorRow>();
    for (const row of vendorRows) {
      const key = normalizePartKey(row.itemName);
      if (key && !vendorByPart.has(key)) {
        vendorByPart.set(key, row);
      }
    }

    const timelineByPanel = new Map<number, BomTimelineRow[]>();
    for (const row of timelineRows) {
      const bucket = timelineByPanel.get(row.panelId) ?? [];
      bucket.push(row);
      timelineByPanel.set(row.panelId, bucket);
    }

    const photosByPanel = new Map<number, BomPhotoSlotRow[]>();
    for (const row of photoSlotRows) {
      const bucket = photosByPanel.get(row.panelId) ?? [];
      bucket.push(row);
      photosByPanel.set(row.panelId, bucket);
    }

    const parts: BomFlatPart[] = panelRows.map((row) => {
      const category = row.category?.trim() || "Lainnya";
      const section = row.section?.trim() || "Tanpa Section";
      const label = row.partName?.trim() || "-";
      const partKey = normalizePartKey(label);
      const physicalStatus = resolvePhysicalStatus(row);
      const actualId = actualByPanel.get(row.panelId) ?? null;

      let logisticStatus: UnitBomLogisticStatus | null = null;
      let logisticReference: string | null = null;
      let logisticPath: string | null = null;

      if (physicalStatus === "DISASSEMBLED") {
        const transfer = transferByPart.get(partKey);
        const readyStock = readyStockByPart.get(partKey);
        const vendor = vendorByPart.get(partKey);
        const pr = prByPart.get(partKey);

        if (transfer) {
          logisticStatus = "CANNIBALIZED";
          logisticReference = transfer.sourceUnitName
            ? `Kanibal dari ${transfer.sourceUnitName}`
            : "Transfer donor";
          logisticPath = `/warehouse?section=stock-movements&tab=transactions&search=${encodeURIComponent(label)}`;
        } else if (readyStock) {
          logisticStatus = "READY_GUDANG";
          logisticReference = readyStock.locationLabel
            ? `Ready Gudang · ${readyStock.locationLabel}`
            : `Ready Gudang · SC/${readyStock.entryNo ?? "-"}`;
          logisticPath = `/warehouse?section=stock-card&tab=stock-card&search=${encodeURIComponent(label)}`;
        } else if (vendor) {
          logisticStatus = "AT_VENDOR";
          logisticReference = `${vendor.wovNumber} · ${humanizeVendorStatus(vendor.status)}`;
          logisticPath = `/vendor/${vendor.wovId}`;
        } else if (pr) {
          logisticStatus = "ORDER_PR";
          logisticReference = `${pr.prNumber} · ${humanizePrStatus(pr.itemStatus)}`;
          logisticPath = `/pr/${pr.prId}`;
        }
      }

      return {
        panelId: row.panelId,
        category,
        section,
        label,
        physicalStatus,
        divisionId: row.divisionId,
        divisionName: row.divisionName,
        progressPercent: Number(row.progressPercent ?? 0),
        remainingHours: Number(row.remainingHours ?? 0),
        actualId,
        logisticStatus,
        logisticReference,
        logisticPath,
        stockStatus: row.stockStatus,
        conditionType: row.conditionType,
        locationName: row.locationName,
        locationDetail: row.locationDetail,
        takenByName: row.takenByName,
        dateOut: row.dateOut,
        jobStatus: row.jobStatus,
        qcLastStatus: row.qcLastStatus,
        deadlineDate: row.deadlineDate,
        countRevisi: row.countRevisi === null ? null : Number(row.countRevisi),
        isLocked: Number(row.isLocked ?? 0) > 0,
        currentDivisionName: row.currentDivisionName,
        detail: {
          workStatusLabel: workStatusLabel(physicalStatus),
          isLocked: Number(row.isLocked ?? 0) > 0,
          timeline: buildTimeline(row, timelineByPanel.get(row.panelId) ?? []),
          photos: defaultPhotoSlots(photosByPanel.get(row.panelId) ?? []),
          documents: buildBomDocuments({
            logisticStatus,
            logisticReference,
            logisticPath,
          }),
        },
      };
    });

    return {
      unitId: params.unitId,
      summary: {
        totalParts: parts.length,
        installedParts: parts.filter((part) => part.physicalStatus === "INSTALLED").length,
        inDivisionParts: parts.filter((part) => part.physicalStatus === "IN_DIVISION").length,
        disassembledParts: parts.filter((part) => part.physicalStatus === "DISASSEMBLED").length,
      },
      tree: buildBomTree(parts),
    };
  }

  private async findUnitPanelRow(pool: Pick<Pool, "query">, unitId: string, panelId: number) {
    const schema = await this.getMasterPanelInventorySchema(pool);
    const qtySelect = schema.hasQty ? "COALESCE(mp.qty, 1)" : "1";
    const locationSelect = schema.hasDefaultLocationType ? "COALESCE(mp.default_location_type, 'UNIT')" : "'UNIT'";
    const stockStatusSelect = schema.hasDefaultStockStatus ? "COALESCE(mp.default_stock_status, 'INSTALLED')" : "'INSTALLED'";
    const conditionSelect = schema.hasDefaultConditionType ? "COALESCE(mp.default_condition_type, 'BEKAS')" : "'BEKAS'";
    const inventoryGroupBy = [
      schema.hasQty ? "mp.qty" : null,
      schema.hasDefaultLocationType ? "mp.default_location_type" : null,
      schema.hasDefaultStockStatus ? "mp.default_stock_status" : null,
      schema.hasDefaultConditionType ? "mp.default_condition_type" : null,
    ].filter(Boolean);

    const [rows] = await pool.query<UnitPanelRow[]>(
      `
        SELECT
          mp.id,
          mp.car_id AS carId,
          mp.parent_id AS parentId,
          mp.section,
          mp.name,
          mp.category,
          COALESCE(mp.is_active, 1) AS isActive,
          COALESCE(mp.sort_order, 0) AS sortOrder,
          ${qtySelect} AS qty,
          ${locationSelect} AS defaultLocationType,
          ${stockStatusSelect} AS defaultStockStatus,
          ${conditionSelect} AS defaultConditionType,
          COUNT(DISTINCT cd.id) AS countdownUsageCount,
          COUNT(DISTINCT cps.id) AS statusUsageCount,
          COUNT(DISTINCT child.id) AS childCount,
          DATE_FORMAT(mp.created_at, '%Y-%m-%d %H:%i:%s') AS createdAt,
          DATE_FORMAT(mp.updated_at, '%Y-%m-%d %H:%i:%s') AS updatedAt
        FROM master_panels mp
        LEFT JOIN sm_jobdesc_countdown cd ON cd.panel_id = mp.id
        LEFT JOIN sm_car_panel_status cps
          ON cps.panel_id = mp.id
         AND cps.car_id = mp.car_id
        LEFT JOIN master_panels child ON child.parent_id = mp.id
        WHERE mp.car_id = ?
          AND mp.id = ?
        GROUP BY
          mp.id,
          mp.car_id,
          mp.parent_id,
          mp.section,
          mp.name,
          mp.category,
          mp.is_active,
          mp.sort_order,
          ${inventoryGroupBy.length ? `${inventoryGroupBy.join(",\n          ")},` : ""}
          mp.created_at,
          mp.updated_at
        LIMIT 1
      `,
      [unitId, panelId],
    );

    return rows[0] ?? null;
  }

  async findUnitPanels(params: ScopeParams & { unitId: string }): Promise<UnitPanelCollection | null> {
    const unitSummary = await this.findUnitSummary(params);
    if (!unitSummary) {
      return null;
    }

    const pool = this.poolFactory();
    const schema = await this.getMasterPanelInventorySchema(pool);
    const qtySelect = schema.hasQty ? "COALESCE(mp.qty, 1)" : "1";
    const locationSelect = schema.hasDefaultLocationType ? "COALESCE(mp.default_location_type, 'UNIT')" : "'UNIT'";
    const stockStatusSelect = schema.hasDefaultStockStatus ? "COALESCE(mp.default_stock_status, 'INSTALLED')" : "'INSTALLED'";
    const conditionSelect = schema.hasDefaultConditionType ? "COALESCE(mp.default_condition_type, 'BEKAS')" : "'BEKAS'";
    const inventoryGroupBy = [
      schema.hasQty ? "mp.qty" : null,
      schema.hasDefaultLocationType ? "mp.default_location_type" : null,
      schema.hasDefaultStockStatus ? "mp.default_stock_status" : null,
      schema.hasDefaultConditionType ? "mp.default_condition_type" : null,
    ].filter(Boolean);

    const [rows] = await pool.query<UnitPanelRow[]>(
      `
        SELECT
          mp.id,
          mp.car_id AS carId,
          mp.parent_id AS parentId,
          mp.section,
          mp.name,
          mp.category,
          COALESCE(mp.is_active, 1) AS isActive,
          COALESCE(mp.sort_order, 0) AS sortOrder,
          ${qtySelect} AS qty,
          ${locationSelect} AS defaultLocationType,
          ${stockStatusSelect} AS defaultStockStatus,
          ${conditionSelect} AS defaultConditionType,
          COUNT(DISTINCT cd.id) AS countdownUsageCount,
          COUNT(DISTINCT cps.id) AS statusUsageCount,
          COUNT(DISTINCT child.id) AS childCount,
          DATE_FORMAT(mp.created_at, '%Y-%m-%d %H:%i:%s') AS createdAt,
          DATE_FORMAT(mp.updated_at, '%Y-%m-%d %H:%i:%s') AS updatedAt
        FROM master_panels mp
        LEFT JOIN sm_jobdesc_countdown cd ON cd.panel_id = mp.id
        LEFT JOIN sm_car_panel_status cps
          ON cps.panel_id = mp.id
         AND cps.car_id = mp.car_id
        LEFT JOIN master_panels child ON child.parent_id = mp.id
        WHERE mp.car_id = ?
        GROUP BY
          mp.id,
          mp.car_id,
          mp.parent_id,
          mp.section,
          mp.name,
          mp.category,
          mp.is_active,
          mp.sort_order,
          ${inventoryGroupBy.length ? `${inventoryGroupBy.join(",\n          ")},` : ""}
          mp.created_at,
          mp.updated_at
        ORDER BY
          COALESCE(mp.parent_id, mp.id) ASC,
          CASE WHEN mp.parent_id IS NULL THEN 0 ELSE 1 END ASC,
          COALESCE(mp.sort_order, 0) ASC,
          mp.section ASC,
          mp.name ASC
      `,
      [params.unitId],
    );

    return {
      unitId: params.unitId,
      tree: buildUnitPanelTree(rows),
    };
  }

  private async assertUnitPanelNotDuplicate(
    pool: Pick<Pool, "query">,
    input: {
      unitId: string;
      parentId: number | null;
      section: string;
      name: string;
      category: string | null | undefined;
      excludePanelId?: number;
    },
  ) {
    const params: unknown[] = [
      input.unitId,
      input.parentId,
      input.parentId,
      input.section.trim(),
      input.name.trim(),
      toNullableText(input.category) ?? "Lainnya",
    ];
    const excludeClause = input.excludePanelId ? "AND id <> ?" : "";
    if (input.excludePanelId) {
      params.push(input.excludePanelId);
    }

    const [rows] = await pool.query<AggregateCountPacket[]>(
      `
        SELECT COUNT(*) AS total
        FROM master_panels
        WHERE car_id = ?
          AND (
            (? IS NULL AND parent_id IS NULL)
            OR parent_id = ?
          )
          AND TRIM(section) = ?
          AND TRIM(name) = ?
          AND COALESCE(NULLIF(TRIM(category), ''), 'Lainnya') = ?
          AND COALESCE(is_active, 1) = 1
          ${excludeClause}
      `,
      params,
    );

    if (Number(rows[0]?.total ?? 0) > 0) {
      throw new Error("UNIT_PANEL_DUPLICATE");
    }
  }

  async createUnitPanel(
    params: ScopeParams & {
      unitId: string;
      actorId: string;
      input: CreateUnitPanelRequest;
    },
  ): Promise<UnitPanelRecord> {
    const unitSummary = await this.findUnitSummary(params);
    if (!unitSummary) {
      throw new Error("UNIT_NOT_FOUND");
    }

    const pool = this.poolFactory();
    const schema = await this.getMasterPanelInventorySchema(pool);
    const input = normalizeUnitPanelInventoryInput(params.input);

    if (input.parentId !== null) {
      const parentRow = await this.findUnitPanelRow(pool, params.unitId, input.parentId);
      if (!parentRow) {
        throw new Error("UNIT_PANEL_PARENT_NOT_FOUND");
      }
      if (parentRow.parentId !== null) {
        throw new Error("UNIT_PANEL_PARENT_INVALID");
      }
    }

    await this.assertUnitPanelNotDuplicate(pool, {
      unitId: params.unitId,
      parentId: input.parentId ?? null,
      section: input.section,
      name: input.name,
      category: input.category,
    });

    const inventoryColumns = [
      schema.hasQty ? "qty" : null,
      schema.hasDefaultLocationType ? "default_location_type" : null,
      schema.hasDefaultStockStatus ? "default_stock_status" : null,
      schema.hasDefaultConditionType ? "default_condition_type" : null,
    ].filter(Boolean);
    const inventoryValues = [
      schema.hasQty ? input.qty : undefined,
      schema.hasDefaultLocationType ? input.defaultLocationType : undefined,
      schema.hasDefaultStockStatus ? input.defaultStockStatus : undefined,
      schema.hasDefaultConditionType ? input.defaultConditionType : undefined,
    ].filter((value) => value !== undefined);

    const [result] = await pool.execute<ResultSetHeader>(
      `
        INSERT INTO master_panels (
          car_id,
          section,
          name,
          category,
          is_active,
          parent_id,
          sort_order,
          ${inventoryColumns.length ? `${inventoryColumns.join(",\n          ")},` : ""}
          default_division_id,
          created_by,
          updated_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ${inventoryColumns.map(() => "?").join(", ")}${inventoryColumns.length ? ", " : ""}NULL, ?, ?)
      `,
      [
        params.unitId,
        input.section.trim(),
        input.name.trim(),
        toNullableText(input.category),
        input.isActive ? 1 : 0,
        input.parentId,
        input.sortOrder,
        ...inventoryValues,
        params.actorId,
        params.actorId,
      ],
    );

    const row = await this.findUnitPanelRow(pool, params.unitId, Number(result.insertId));
    if (!row) {
      throw new Error("UNIT_PANEL_NOT_FOUND");
    }

    return mapUnitPanelRecord(row);
  }

  async updateUnitPanel(
    params: ScopeParams & {
      unitId: string;
      panelId: number;
      actorId: string;
      input: UpdateUnitPanelRequest;
    },
  ): Promise<{ before: UnitPanelRecord; after: UnitPanelRecord }> {
    const unitSummary = await this.findUnitSummary(params);
    if (!unitSummary) {
      throw new Error("UNIT_NOT_FOUND");
    }

    const pool = this.poolFactory();
    const schema = await this.getMasterPanelInventorySchema(pool);
    const input = normalizeUnitPanelInventoryInput(params.input);
    const currentRow = await this.findUnitPanelRow(pool, params.unitId, params.panelId);
    if (!currentRow) {
      throw new Error("UNIT_PANEL_NOT_FOUND");
    }

    const before = mapUnitPanelRecord(currentRow);

    let parentIdAssignment = "";
    const parentIdValues: (number | null)[] = [];

    if (input.parentId !== undefined) {
      if (input.parentId !== null) {
        const parentRow = await this.findUnitPanelRow(pool, params.unitId, input.parentId);
        if (!parentRow) {
          throw new Error("UNIT_PANEL_NOT_FOUND");
        }
        if (parentRow.parentId !== null) {
          throw new Error("UNIT_PANEL_PARENT_INVALID");
        }
      }
      
      // If we are making it a panel, make sure it has no children
      if (input.parentId === null && currentRow.parentId !== null) {
        const [children] = await pool.query<UnitPanelRow[]>(
          "SELECT id FROM master_panels WHERE parent_id = ? AND car_id = ? LIMIT 1",
          [params.panelId, params.unitId]
        );
        if (children.length > 0) {
          throw new Error("UNIT_PANEL_HAS_CHILDREN");
        }
      }

      parentIdAssignment = "parent_id = ?,";
      parentIdValues.push(input.parentId);
    }

    await this.assertUnitPanelNotDuplicate(pool, {
      unitId: params.unitId,
      parentId: input.parentId === undefined ? currentRow.parentId : input.parentId,
      section: input.section,
      name: input.name,
      category: input.category,
      excludePanelId: params.panelId,
    });
    const inventoryAssignments = [
      schema.hasQty ? "qty = ?" : null,
      schema.hasDefaultLocationType ? "default_location_type = ?" : null,
      schema.hasDefaultStockStatus ? "default_stock_status = ?" : null,
      schema.hasDefaultConditionType ? "default_condition_type = ?" : null,
    ].filter(Boolean);
    const inventoryValues = [
      schema.hasQty ? input.qty : undefined,
      schema.hasDefaultLocationType ? input.defaultLocationType : undefined,
      schema.hasDefaultStockStatus ? input.defaultStockStatus : undefined,
      schema.hasDefaultConditionType ? input.defaultConditionType : undefined,
    ].filter((value) => value !== undefined);

    await pool.execute(
      `
        UPDATE master_panels
        SET
          ${parentIdAssignment}
          section = ?,
          name = ?,
          category = ?,
          is_active = ?,
          sort_order = ?,
          ${inventoryAssignments.length ? `${inventoryAssignments.join(",\n          ")},` : ""}
          updated_by = ?
        WHERE id = ?
          AND car_id = ?
        LIMIT 1
      `,
      [
        ...parentIdValues,
        input.section.trim(),
        input.name.trim(),
        toNullableText(input.category),
        input.isActive ? 1 : 0,
        input.sortOrder,
        ...inventoryValues,
        params.actorId,
        params.panelId,
        params.unitId,
      ],
    );

    const updatedRow = await this.findUnitPanelRow(pool, params.unitId, params.panelId);
    if (!updatedRow) {
      throw new Error("UNIT_PANEL_NOT_FOUND");
    }

    return {
      before,
      after: mapUnitPanelRecord(updatedRow),
    };
  }

  async renameUnitPanelCategory(
    params: ScopeParams & {
      unitId: string;
      actorId: string;
      fromCategory: string;
      toCategory: string;
    },
  ): Promise<{ updatedCount: number }> {
    const unitSummary = await this.findUnitSummary(params);
    if (!unitSummary) {
      throw new Error("UNIT_NOT_FOUND");
    }

    const pool = this.poolFactory();
    const [result] = await pool.execute<ResultSetHeader>(
      `
        UPDATE master_panels
        SET
          category = ?,
          updated_by = ?
        WHERE car_id = ?
          AND COALESCE(NULLIF(TRIM(category), ''), 'Lainnya') = ?
      `,
      [
        toNullableText(params.toCategory),
        params.actorId,
        params.unitId,
        params.fromCategory.trim(),
      ],
    );

    return { updatedCount: Number(result.affectedRows ?? 0) };
  }

  async deleteUnitPanel(
    params: ScopeParams & {
      unitId: string;
      panelId: number;
    },
  ): Promise<UnitPanelRecord> {
    const unitSummary = await this.findUnitSummary(params);
    if (!unitSummary) {
      throw new Error("UNIT_NOT_FOUND");
    }

    const pool = this.poolFactory();
    const currentRow = await this.findUnitPanelRow(pool, params.unitId, params.panelId);
    if (!currentRow) {
      throw new Error("UNIT_PANEL_NOT_FOUND");
    }

    const current = mapUnitPanelRecord(currentRow);

    if (current.childCount > 0) {
      throw new Error("UNIT_PANEL_HAS_CHILDREN");
    }

    if (current.countdownUsageCount > 0 || current.statusUsageCount > 0) {
      throw new Error("UNIT_PANEL_IN_USE");
    }

    await pool.execute(
      `
        DELETE FROM master_panels
        WHERE id = ?
          AND car_id = ?
        LIMIT 1
      `,
      [params.panelId, params.unitId],
    );

    return current;
  }

  async upsertWarehouseStockCardFromPanel(
    params: ScopeParams & {
      unitId: string;
      record: UnitPanelRecord;
    },
  ): Promise<void> {
    const unitSummary = await this.findUnitSummary(params);
    if (!unitSummary) {
      throw new Error("UNIT_NOT_FOUND");
    }

    const pool = this.poolFactory();
    const stockCardTable = qualifyTable(this.warehouseDb, "wh_stock_card");
    const partCode = `MP-${params.record.id}`;
    const uom = "pcs";

    const [existingRows] = await pool.query<Array<RowDataPacket & { id: string }>>(
      `SELECT id FROM ${stockCardTable} WHERE car_id = ? AND part_code = ? LIMIT 1`,
      [params.unitId, partCode],
    );

    if (existingRows.length > 0) {
      await pool.execute(
        `
          UPDATE ${stockCardTable}
          SET
            car_name = ?,
            panel_section = ?,
            part_name = ?,
            condition_type = ?,
            qty = ?,
            uom = ?,
            status = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE car_id = ?
            AND part_code = ?
        `,
        [
          unitSummary.unitName,
          params.record.section,
          params.record.name,
          params.record.defaultConditionType,
          params.record.qty,
          uom,
          params.record.defaultStockStatus,
          params.unitId,
          partCode,
        ],
      );
      return;
    }

    await pool.execute(
      `
        INSERT INTO ${stockCardTable} (
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
          status,
          is_labeled,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, CURRENT_DATE, ?, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `,
      [
        randomUUID(),
        partCode,
        params.unitId,
        unitSummary.unitName,
        partCode,
        params.record.section,
        params.record.name,
        params.record.defaultConditionType,
        params.record.qty,
        uom,
        params.record.defaultStockStatus,
      ],
    );
  }

  async markWarehouseStockCardLostForPanel(
    params: ScopeParams & {
      unitId: string;
      panelId: number;
    },
  ): Promise<void> {
    const pool = this.poolFactory();
    const stockCardTable = qualifyTable(this.warehouseDb, "wh_stock_card");
    await pool.execute(
      `
        UPDATE ${stockCardTable}
        SET
          status = 'LOST',
          updated_at = CURRENT_TIMESTAMP
        WHERE car_id = ?
          AND part_code = ?
        LIMIT 1
      `,
      [params.unitId, `MP-${params.panelId}`],
    );
  }

}
