import { permissionCodes } from "@smsystem/permissions";
import type {
  CreateJobPlanAdditionalCountdownRequest,
  DeleteJobPlanDraftRequest,
  JobPlanExportFormat,
  JobPlanDraftRecord,
  JobPlanGridQuery,
  JobPlanOptionKind,
  JobPlanPicLoad,
  JobPlanRecord,
  JobPlanStatus,
  SaveJobPlanDraftRequest,
} from "@smsystem/contracts/job-plan";
import { jobPlanDraftRecordSchema } from "@smsystem/contracts/job-plan";
import { findExceededJobPlanAllocation } from "@smsystem/contracts/job-plan-schedule";
import type { RedisClientType } from "redis";
import ExcelJS from "exceljs";
import type { AuditService } from "@/services/audit/audit.service";
import { DefaultAuditService } from "@/services/audit/audit.service";
import { MySqlAuditRepository } from "@/repositories/audit/audit.repo";
import {
  MySqlJobPlanRepository,
  type JobPlanRepository,
} from "@/repositories/job-plan/job-plan.repo";
import { getRedisClient } from "@/redis/client";
import type { WebSession } from "@/services/auth/session.service";

import { addRowsWorksheet, writeWorkbookBuffer } from "@/services/shared/excel";

interface JobPlanListResult {
  data: JobPlanRecord[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  references: Awaited<ReturnType<JobPlanRepository["listReferences"]>>;
  query: JobPlanGridQuery;
  summary: Awaited<ReturnType<JobPlanRepository["list"]>>["summary"];
}

interface JobPlanMutationResult {
  createdIds: string[];
  updatedPlanId: string | null;
  deletedPlanId: string | null;
  status: JobPlanStatus | null;
}

interface JobPlanAdditionalCountdownResult {
  coreId: string;
  jobTypeId: string;
  carId: string;
  unitName: string | null;
  divisionId: number | null;
  divisionName: string | null;
  panelId: number | null;
  isNewJobType: boolean;
  isNewCore: boolean;
}

interface JobPlanExportResult {
  fileName: string;
  contentType: string;
  body: string | Uint8Array;
}

interface JobPlanOptionsQuery {
  kind: JobPlanOptionKind;
  divisionId?: number | null;
  unitId?: string | null;
  panelId?: number | null;
  componentName?: string | null;
}

const JOB_PLAN_DRAFT_TTL_SECONDS = 60 * 60 * 24 * 30;
const JOB_PLAN_OPTION_TTL_SECONDS: Record<JobPlanOptionKind, number> = {
  divisions: 60 * 60 * 24,
  employees: 60 * 30,
  units: 60 * 60 * 12,
  panels: 60 * 60 * 12,
  jobdesc: 60 * 60,
};

type JobPlanReferences = Awaited<ReturnType<JobPlanRepository["listReferences"]>>;
type JobPlanDraftReferences = Awaited<ReturnType<NonNullable<JobPlanRepository["listDraftReferences"]>>>;

function buildOptionCacheKey(employeeId: string, query: JobPlanOptionsQuery): string {
  return [
    "jobplan",
    "options",
    employeeId,
    query.kind,
    query.divisionId ?? "",
    query.unitId ?? "",
    query.panelId ?? "",
    (query.componentName ?? "").trim().toUpperCase(),
  ].join(":");
}

function buildLegacyWebDraftKey(employeeId: string): string {
  return `jobplan:web:draft:${employeeId}`;
}

function buildLegacyMobileDraftKey(employeeId: string): string {
  return `jobplan:draft:${employeeId}`;
}

function buildDivisionDraftKey(divisionId: number): string {
  return `jobplan:draft:division:${divisionId}`;
}

function toNullableInt(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizeMobileDraftItem(item: unknown): JobPlanDraftRecord | null {
  if (!item || typeof item !== "object") return null;
  const source = item as Record<string, unknown>;
  const targetHours =
    typeof source.targetHours === "number"
      ? source.targetHours
      : Number.parseFloat(String(source.targetHours ?? source.target_hours ?? ""));
  try {
    return jobPlanDraftRecordSchema.parse({
      draftItemId: String(source.draftItemId ?? source.draft_item_id ?? source.coreId ?? source.core_id ?? ""),
      sourceType: String(source.sourceType ?? source.source_type ?? "COUNTDOWN").toUpperCase(),
      coreId: source.coreId ?? source.core_id ?? null,
      carId: source.carId ?? source.car_id ?? null,
      unitName: source.unitName ?? source.unit_name ?? null,
      divisionId: toNullableInt(source.divisionId ?? source.division_id),
      divisionName: source.divisionName ?? source.division_name ?? null,
      panelId: toNullableInt(source.panelId ?? source.panel_id),
      panelName: source.panelName ?? source.panel_name ?? source.panelCustomNote ?? source.panel_custom_note ?? null,
      jobTypeId: source.jobTypeId ?? source.job_type_id ?? null,
      jobName: source.jobName ?? source.job_name ?? null,
      assignedUserId: String(source.assignedUserId ?? source.assigned_user_id ?? source.employeeId ?? ""),
      assignedUserName: source.assignedUserName ?? source.assignedTo ?? source.assigned_user_name ?? null,
      taskDate: String(source.taskDate ?? source.task_date ?? ""),
      targetHours,
      startTime: source.startTime ?? source.start_time ?? null,
      finishTime: source.finishTime ?? source.finish_time ?? null,
      jobDescription: String(
        source.jobDescription ?? source.jobdescription ?? source.job_desc ?? source.panelName ?? source.panel_name ?? "",
      ),
      note: source.note ?? source.catatan ?? source.pok ?? null,
      isOvertime: Boolean(source.isOvertime ?? source.is_overtime),
      isPriority: Boolean(source.isPriority ?? source.is_priority),
      deadlineDate: source.deadlineDate ?? source.deadline_date ?? null,
      isRework: Boolean(source.isRework ?? source.is_rework),
      urgent: source.urgent === true || source.isUrgent === true || source.is_urgent === true,
      isNonTechnicalJob: Boolean(source.isNonTechnicalJob ?? source.is_non_technical_job),
      picPlan: source.picPlan ?? source.pic_plan ?? null,
      requiredGrade: source.requiredGrade ?? source.required_grade ?? null,
      linkedPlanId: source.linkedPlanId ?? source.operationalPlanId ?? null,
      linkedPlanVersion: source.linkedPlanVersion ?? source.version ?? null,
    });
  } catch {
    return null;
  }
}

function isSelfServiceRequest(session: WebSession): boolean {
  const permissions = session.user.permissions;
  return Boolean(permissions && !permissions.includes(permissionCodes.createTask));
}

function assertSupplementalRequest(session: WebSession, item: { draftItemId?: string; urgent?: boolean; assignedUserId?: string; picPlan?: string | null; divisionId?: number | null; note?: string | null }) {
  if (!isSelfServiceRequest(session)) return;
  if (!session.user.permissions.some(code => code === permissionCodes.taskExecute || code === permissionCodes.taskSubmit) || !item.urgent || item.draftItemId?.startsWith("qc-rework:")
    || (item.assignedUserId ?? item.picPlan) !== session.user.employeeId
    || item.divisionId !== session.user.divisionId || !item.note?.trim()) {
    throw new Error("SCOPE_FORBIDDEN");
  }
}

function mapDraftToRecord(draft: JobPlanDraftRecord): JobPlanRecord {
  return {
    planId: draft.draftItemId,
    coreId: draft.coreId ?? draft.draftItemId,
    taskDate: draft.taskDate,
    unitName: draft.unitName ?? "-",
    divisionId: draft.divisionId ?? null,
    divisionName: draft.divisionName ?? "-",
    panelName: draft.panelName ?? null,
    panelSectionName: draft.panelName ?? null,
    jobName: draft.jobName ?? null,
    masterJobName: draft.jobName ?? draft.jobDescription,
    assignedUserId: draft.assignedUserId,
    assignedUserName: draft.assignedUserName ?? draft.assignedUserId,
    targetHours: draft.targetHours,
    targetDailyHours: draft.targetHours,
    targetTotalHours: draft.targetHours,
    startTime: draft.startTime ?? null,
    finishTime: draft.finishTime ?? null,
    isOvertime: draft.isOvertime,
    isPriority: draft.isPriority,
    status: "DRAFT",
    jobDescription: draft.jobDescription,
    instructionText: draft.note ?? "",
    note: draft.note ?? null,
    draftSourceType: draft.sourceType,
    draftCarId: draft.carId ?? null,
    draftPanelId: draft.panelId ?? null,
    draftJobTypeId: draft.jobTypeId ?? null,
    draftDeadlineDate: draft.deadlineDate ?? null,
    draftIsRework: draft.isRework,
    draftUrgent: draft.urgent ?? false,
    draftIsNonTechnicalJob: draft.isNonTechnicalJob,
    draftLinkedPlanId: draft.linkedPlanId ?? null,
    draftLinkedPlanVersion: draft.linkedPlanVersion ?? null,
    availablePlanHours: null,
    remainingHours: null,
    progressPercent: null,
  };
}

function matchesDraftMode(draft: JobPlanDraftRecord, mode: JobPlanGridQuery["mode"]): boolean {
  if (mode === "all") {
    return true;
  }

  return mode === "overtime" ? draft.isOvertime : !draft.isOvertime;
}

function matchesDraftFilters(
  draft: JobPlanDraftRecord,
  query: JobPlanGridQuery,
): boolean {
  if (draft.taskDate < query.dateStart || draft.taskDate > query.dateEnd) {
    return false;
  }

  if (!matchesDraftMode(draft, query.mode)) {
    return false;
  }

  if (query.search) {
    const needle = query.search.toLowerCase();
    const haystack = [
      draft.draftItemId,
      draft.unitName,
      draft.divisionName,
      draft.panelName,
      draft.jobName,
      draft.assignedUserId,
      draft.assignedUserName,
      draft.jobDescription,
      draft.note,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    if (!haystack.includes(needle)) {
      return false;
    }
  }

  for (const filter of query.filters) {
    if (filter.field === "status" && String(filter.value).toUpperCase() !== "DRAFT") {
      return false;
    }

    if (filter.field === "divisionId" && String(draft.divisionId ?? "") !== String(filter.value)) {
      return false;
    }

    if (filter.field === "assignedUserId" && draft.assignedUserId !== String(filter.value)) {
      return false;
    }

    if (
      (filter.field === "unitId" || filter.field === "unitName") &&
      draft.carId !== String(filter.value)
    ) {
      return false;
    }
  }

  return true;
}

function countDraftSummary(drafts: JobPlanDraftRecord[]) {
  return drafts.reduce(
    (summary, draft) => ({
      totalHours: Number((summary.totalHours + draft.targetHours).toFixed(2)),
      pendingCount: summary.pendingCount,
      approvedCount: summary.approvedCount,
      overtimeCount: summary.overtimeCount + (draft.isOvertime ? 1 : 0),
    }),
    {
      totalHours: 0,
      pendingCount: 0,
      approvedCount: 0,
      overtimeCount: 0,
    },
  );
}

function resolveReferenceDivisionName(
  references: JobPlanReferences,
  divisionId: number | null,
): string | null {
  if (divisionId === null) {
    return null;
  }

  return references.divisions.find((division) => String(division.value) === String(divisionId))?.label ?? null;
}

function buildReferenceCountdownMap(references: JobPlanReferences) {
  return new Map(references.countdowns.map((countdown) => [countdown.value, countdown]));
}

function buildReferencePanelMap(references: JobPlanReferences) {
  return new Map<number, { panelName: string | null; componentName: string | null; partName: string | null }>(
    references.panels.map((panel) => [Number(panel.value), {
      panelName: panel.panelName,
      componentName: panel.componentName ?? null,
      partName: panel.partName ?? null,
    }]),
  );
}

function pushPositiveInt(target: Set<number>, value: unknown) {
  const parsed = toNullableInt(value);
  if (parsed !== null) target.add(parsed);
}

export interface JobPlanService {
  list(session: WebSession, query: JobPlanGridQuery): Promise<JobPlanListResult>;
  listOptions(
    session: WebSession,
    query: JobPlanOptionsQuery,
  ): Promise<Awaited<ReturnType<JobPlanRepository["listOptions"]>>>;
  listToday(session: WebSession, query: JobPlanGridQuery): Promise<JobPlanListResult>;
  listMyDivision(session: WebSession, query: JobPlanGridQuery): Promise<JobPlanListResult>;
  saveDraft(
    session: WebSession,
    input: SaveJobPlanDraftRequest,
  ): Promise<JobPlanMutationResult>;
  deleteDrafts(
    session: WebSession,
    input: DeleteJobPlanDraftRequest,
  ): Promise<JobPlanMutationResult>;
  createAdditionalCountdown(
    session: WebSession,
    input: CreateJobPlanAdditionalCountdownRequest,
  ): Promise<JobPlanAdditionalCountdownResult>;
  picLoad(
    session: WebSession,
    employeeId: string,
    taskDate: string,
  ): Promise<{ employeeId: string; taskDate: string; capacity: JobPlanPicLoad }>;
  exportFile(
    session: WebSession,
    query: JobPlanGridQuery,
    format: JobPlanExportFormat,
  ): Promise<JobPlanExportResult>;
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

function escapeCsv(value: string | number | null): string {
  if (value === null) {
    return "";
  }

  const text = String(value);
  if (!/[",\n]/u.test(text)) {
    return text;
  }

  return `"${text.replace(/"/gu, "\"\"")}"`;
}

function buildExportColumns() {
  return [
    { key: "taskDate", label: "Tanggal" },
    { key: "mode", label: "Jenis" },
    { key: "assignedUserName", label: "PIC" },
    { key: "unitName", label: "Unit" },
    { key: "divisionName", label: "Divisi" },
    { key: "panelName", label: "Panel" },
    { key: "jobName", label: "Jobdesc" },
    { key: "jobDescription", label: "Instruksi" },
    { key: "targetHours", label: "Total Jam" },
    { key: "remainingHours", label: "Sisa Jam" },
    { key: "startTime", label: "Jam Mulai" },
    { key: "finishTime", label: "Jam Selesai" },
    { key: "progressPercent", label: "Progress %" },
    { key: "status", label: "Status" },
    { key: "note", label: "Keterangan" },
  ] as const;
}

function mapExportRow(row: JobPlanRecord): Record<string, string | number> {
  return {
    taskDate: row.taskDate,
    mode: row.isOvertime ? "Lembur" : "Normal",
    assignedUserName: row.assignedUserName,
    unitName: row.unitName,
    divisionName: row.divisionName,
    panelName: row.panelName ?? "-",
    jobName: row.jobName ?? "-",
    jobDescription: row.jobDescription,
    targetHours: row.targetHours,
    remainingHours: row.remainingHours ?? 0,
    startTime: row.startTime ?? "-",
    finishTime: row.finishTime ?? "-",
    progressPercent: row.progressPercent ?? 0,
    status: row.status,
    note: row.note ?? "-",
  };
}

function buildCsv(rows: JobPlanRecord[]): string {
  const columns = buildExportColumns();
  const header = columns.map((column) => escapeCsv(column.label)).join(",");
  const body = rows.map((row) => {
    const exportRow = mapExportRow(row);
    return columns.map((column) => {
      const value = exportRow[column.key];
      return escapeCsv(value === undefined ? null : value);
    }).join(",");
  });

  return [header, ...body].join("\n");
}

async function buildWorkbook(rows: JobPlanRecord[]): Promise<Uint8Array> {
  const columns = buildExportColumns();
  const workbook = new ExcelJS.Workbook();
  const exportRows = rows.map(mapExportRow);
  const sheetRows = [
    columns.map((column) => column.label),
    ...exportRows.map((row) => columns.map((column) => row[column.key] ?? "")),
  ];
  addRowsWorksheet(
    workbook,
    "JobPlan",
    sheetRows,
    columns.map((column) => Math.max(12, column.label.length + 4)),
  );

  return writeWorkbookBuffer(workbook);
}

function clampText(value: string, limit: number): string {
  if (value.length <= limit) {
    return value;
  }

  return `${value.slice(0, Math.max(0, limit - 1))}…`;
}

function escapePdfText(value: string): string {
  return value.replace(/\\/gu, "\\\\").replace(/\(/gu, "\\(").replace(/\)/gu, "\\)");
}

function buildPdf(rows: JobPlanRecord[], query: JobPlanGridQuery): Uint8Array {
  const columns = buildExportColumns();
  const headerLine = columns
    .map((column) => clampText(column.label, 14).padEnd(14, " "))
    .join(" ");
  const bodyLines = rows.map((row) => {
    const exportRow = mapExportRow(row);
    return columns
      .map((column) => clampText(String(exportRow[column.key] ?? "-"), 14).padEnd(14, " "))
      .join(" ");
  });

  const lines = [
    "JOB PLAN",
    `Mode: ${query.mode.toUpperCase()} | Window: ${query.window.toUpperCase()} | Rentang: ${query.dateStart} s.d. ${query.dateEnd}`,
    "",
    headerLine,
    ...bodyLines,
  ];

  const linesPerPage = 42;
  const pages = Array.from({ length: Math.max(1, Math.ceil(lines.length / linesPerPage)) }, (_, index) =>
    lines.slice(index * linesPerPage, (index + 1) * linesPerPage),
  );

  const objects: string[] = [];
  const pageIds: number[] = [];
  let objectIndex = 1;

  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push("<< /Type /Pages /Kids [] /Count 0 >>");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  objectIndex = 4;

  for (const pageLines of pages) {
    const pageObjectId = objectIndex++;
    const contentObjectId = objectIndex++;
    pageIds.push(pageObjectId);

    const streamLines = pageLines
      .map((line) => `(${escapePdfText(line)}) Tj`)
      .join(" T* ");
    const stream = `BT /F1 9 Tf 40 800 Td 12 TL ${streamLines} ET`;
    objects[pageObjectId - 1] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Contents ${contentObjectId} 0 R /Resources << /Font << /F1 3 0 R >> >> >>`;
    objects[contentObjectId - 1] =
      `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  }

  objects[1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];

  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let index = 1; index < offsets.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new TextEncoder().encode(pdf);
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;");
}

function buildImage(rows: JobPlanRecord[], query: JobPlanGridQuery): Uint8Array {
  const columns = buildExportColumns().slice(0, 9);
  const exportRows = rows.map(mapExportRow);
  const rowHeight = 28;
  const columnWidths = [92, 74, 120, 110, 110, 110, 150, 170, 74];
  const totalWidth = columnWidths.reduce((sum, width) => sum + width, 0) + 40;
  const totalHeight = 110 + (exportRows.length + 1) * rowHeight;

  let offsetX = 20;
  const headerCells = columns.map((column, index) => {
    const cell = `
      <rect x="${offsetX}" y="64" width="${columnWidths[index]}" height="${rowHeight}" fill="#111111" stroke="rgba(255,255,255,0.08)" />
      <text x="${offsetX + 8}" y="82" fill="#f4f4f5" font-size="11" font-family="Arial, sans-serif">${xmlEscape(column.label)}</text>
    `;
    offsetX += columnWidths[index];
    return cell;
  }).join("");

  const body = exportRows.map((row, rowIndex) => {
    let currentX = 20;
    const currentY = 64 + (rowIndex + 1) * rowHeight;
    const rowCells = columns.map((column, columnIndex) => {
      const raw = String(row[column.key] ?? "-");
      const value = clampText(raw, Math.max(8, Math.floor(columnWidths[columnIndex] / 7)));
      const cell = `
        <rect x="${currentX}" y="${currentY}" width="${columnWidths[columnIndex]}" height="${rowHeight}" fill="#0a0a0a" stroke="rgba(255,255,255,0.05)" />
        <text x="${currentX + 8}" y="${currentY + 18}" fill="#d4d4d8" font-size="10" font-family="Arial, sans-serif">${xmlEscape(value)}</text>
      `;
      currentX += columnWidths[columnIndex];
      return cell;
    }).join("");

    return rowCells;
  }).join("");

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${totalHeight}" viewBox="0 0 ${totalWidth} ${totalHeight}">
      <rect width="100%" height="100%" fill="#050505" />
      <text x="20" y="28" fill="#f59e0b" font-size="12" font-family="Arial, sans-serif">JOB PLAN</text>
      <text x="20" y="46" fill="#f4f4f5" font-size="18" font-family="Arial, sans-serif">Ringkasan ${xmlEscape(query.mode.toUpperCase())}</text>
      <text x="320" y="46" fill="#a1a1aa" font-size="11" font-family="Arial, sans-serif">${xmlEscape(`${query.dateStart} s.d. ${query.dateEnd}`)}</text>
      ${headerCells}
      ${body}
    </svg>
  `;

  return new TextEncoder().encode(svg);
}

export class DefaultJobPlanService implements JobPlanService {
  constructor(
    private readonly repository: JobPlanRepository = new MySqlJobPlanRepository(),
    private readonly auditService: AuditService = new DefaultAuditService(
      new MySqlAuditRepository(),
    ),
    private readonly redisFactory: () => Promise<RedisClientType> = getRedisClient,
  ) {}

  private getDraftDivisionIds(
    session: WebSession,
    options: {
      query?: JobPlanGridQuery;
      references?: JobPlanReferences;
      drafts?: JobPlanDraftRecord[];
    } = {},
  ): number[] {
    const divisionIds = new Set<number>();
    const allowedDivisionIds = new Set([
      ...session.user.scope.divisionIds,
      ...session.user.scope.managedDivisionIds,
      session.user.divisionId,
    ].flatMap((divisionId) => {
      const parsed = toNullableInt(divisionId);
      return parsed === null ? [] : [parsed];
    }));
    const addScopedDivisionId = (value: unknown) => {
      const parsed = toNullableInt(value);
      if (parsed === null) return;
      if (session.user.scope.canViewAllUnits || allowedDivisionIds.has(parsed)) {
        divisionIds.add(parsed);
      }
    };

    pushPositiveInt(divisionIds, session.user.divisionId);
    session.user.scope.divisionIds.forEach((divisionId) => pushPositiveInt(divisionIds, divisionId));
    session.user.scope.managedDivisionIds.forEach((divisionId) => pushPositiveInt(divisionIds, divisionId));
    options.drafts?.forEach((draft) => addScopedDivisionId(this.resolveDraftDivisionId(session, draft)));
    options.query?.filters.forEach((filter) => {
      if (filter.field === "divisionId") addScopedDivisionId(filter.value);
    });

    if (session.user.scope.canViewAllUnits && options.references) {
      options.references.divisions.forEach((division) => pushPositiveInt(divisionIds, division.value));
    }

    return [...divisionIds].sort((left, right) => left - right);
  }

  private resolveDraftDivisionId(session: WebSession, draft: JobPlanDraftRecord): number | null {
    const draftDivisionId = toNullableInt(draft.divisionId);
    if (draftDivisionId === null) {
      return toNullableInt(session.user.divisionId);
    }

    if (session.user.scope.canViewAllUnits) {
      return draftDivisionId;
    }

    const allowedDivisionIds = new Set([
      ...session.user.scope.divisionIds,
      ...session.user.scope.managedDivisionIds,
      session.user.divisionId,
    ].flatMap((divisionId) => {
      const parsed = toNullableInt(divisionId);
      return parsed === null ? [] : [parsed];
    }));

    return allowedDivisionIds.has(draftDivisionId)
      ? draftDivisionId
      : toNullableInt(session.user.divisionId);
  }

  private parseDrafts(raw: string | null): JobPlanDraftRecord[] {
    if (!raw) {
      return [];
    }

    try {
      const payload = JSON.parse(raw) as unknown;
      const items = Array.isArray(payload) ? payload : (payload as { items?: unknown[] })?.items ?? [];
      return items
        .map((item) => normalizeMobileDraftItem(item))
        .filter((item): item is JobPlanDraftRecord => item !== null);
    } catch {
      return [];
    }
  }

  private async readDrafts(
    session: WebSession,
    divisionIds: number[],
  ): Promise<JobPlanDraftRecord[]> {
    if (isSelfServiceRequest(session)) {
      const redis = await this.redisFactory();
      return this.parseDrafts(await redis.get(buildLegacyMobileDraftKey(session.user.employeeId)))
        .filter((draft) => draft.urgent && draft.assignedUserId === session.user.employeeId);
    }
    const durableDrafts = (await this.repository.listQcReworkDrafts?.({
      employeeId: session.user.employeeId,
      scope: session.user.scope,
      divisionIds,
    }) ?? [])
      .map(normalizeMobileDraftItem)
      .filter((draft): draft is JobPlanDraftRecord => draft !== null);
    const durableById = new Map(durableDrafts.map((draft) => [draft.draftItemId, draft]));
    let rows: JobPlanDraftRecord[][] = [];
    try {
      const redis = await this.redisFactory();
      const keys = [
        ...divisionIds.map((divisionId) => buildDivisionDraftKey(divisionId)),
        buildLegacyMobileDraftKey(session.user.employeeId),
        buildLegacyWebDraftKey(session.user.employeeId),
      ];
      rows = await Promise.all(keys.map(async (key) => this.parseDrafts(await redis.get(key))));
    } catch (error) {
      console.warn("[job-plan] draft cache unavailable; using durable QC drafts", error);
    }

    const draftsById = new Map<string, JobPlanDraftRecord>();

    for (const drafts of rows) {
      for (const draft of drafts) {
        const durable = durableById.get(draft.draftItemId);
        if (this.repository.listQcReworkDrafts && draft.draftItemId.startsWith("qc-rework:") && !durable) continue;
        if (!draftsById.has(draft.draftItemId)) draftsById.set(draft.draftItemId, durable ?? draft);
      }
    }

    return [...new Map([
      ...durableDrafts.map((draft) => [draft.draftItemId, draft] as const),
      ...draftsById,
    ]).values()];
  }

  private async writeDrafts(
    session: WebSession,
    divisionIds: number[],
    drafts: JobPlanDraftRecord[],
  ) {
    const redis = await this.redisFactory();
    if (isSelfServiceRequest(session)) {
      for (const draft of drafts) assertSupplementalRequest(session, draft);
      const key = buildLegacyMobileDraftKey(session.user.employeeId);
      const preserved = this.parseDrafts(await redis.get(key))
        .filter((draft) => !draft.urgent || draft.assignedUserId !== session.user.employeeId);
      await redis.set(key, JSON.stringify({ action: "save_draft", userId: session.user.employeeId, divisionId: session.user.divisionId,
        sourceType: "COUNTDOWN", items: [...preserved, ...drafts] }), {
        EX: JOB_PLAN_DRAFT_TTL_SECONDS,
      });
      return;
    }
    const legacyKeys = [
      buildLegacyWebDraftKey(session.user.employeeId),
      buildLegacyMobileDraftKey(session.user.employeeId),
    ];
    const groups = new Map<number, JobPlanDraftRecord[]>();
    const unscopedDrafts: JobPlanDraftRecord[] = [];

    for (const draft of drafts) {
      const divisionId = this.resolveDraftDivisionId(session, draft);
      if (divisionId === null) {
        unscopedDrafts.push(draft);
        continue;
      }
      groups.set(divisionId, [
        ...(groups.get(divisionId) ?? []),
        { ...draft, divisionId },
      ]);
    }

    await Promise.all([
      ...divisionIds.map((divisionId) => redis.del(buildDivisionDraftKey(divisionId))),
      ...legacyKeys.map((key) => redis.del(key)),
    ]);

    await Promise.all([...groups].map(([divisionId, items]) =>
      redis.set(buildDivisionDraftKey(divisionId), JSON.stringify({
        action: "save_draft",
        divisionId,
        sourceType: new Set(items.map((draft) => draft.sourceType)).size === 1 ? items[0]!.sourceType : "MIXED",
        items,
      }), {
        EX: JOB_PLAN_DRAFT_TTL_SECONDS,
      }),
    ));

    if (unscopedDrafts.length > 0) {
      await redis.set(buildLegacyMobileDraftKey(session.user.employeeId), JSON.stringify({
        action: "save_draft",
        userId: session.user.employeeId,
        sourceType: new Set(unscopedDrafts.map((draft) => draft.sourceType)).size === 1 ? unscopedDrafts[0]!.sourceType : "MIXED",
        items: unscopedDrafts,
      }), {
        EX: JOB_PLAN_DRAFT_TTL_SECONDS,
      });
    }
  }

  private async writeDraftsWithRetry(
    session: WebSession,
    divisionIds: number[],
    drafts: JobPlanDraftRecord[],
  ): Promise<void> {
    try {
      await this.writeDrafts(session, divisionIds, drafts);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
      await this.writeDrafts(session, divisionIds, drafts);
    }
  }

  async listOptions(
    session: WebSession,
    query: JobPlanOptionsQuery,
  ): Promise<Awaited<ReturnType<JobPlanRepository["listOptions"]>>> {
    const cacheKey = buildOptionCacheKey(session.user.employeeId, query);

    try {
      const redis = await this.redisFactory();
      const cached = await redis.get(cacheKey);
      if (cached) return JSON.parse(cached) as Awaited<ReturnType<JobPlanRepository["listOptions"]>>;

      const options = await this.repository.listOptions({
        employeeId: session.user.employeeId,
        scope: session.user.scope,
        ...query,
      });
      await redis.set(cacheKey, JSON.stringify(options), {
        EX: JOB_PLAN_OPTION_TTL_SECONDS[query.kind],
      });
      return options;
    } catch (error) {
      console.warn("[job-plan] option cache unavailable; querying database", error);
      return this.repository.listOptions({
        employeeId: session.user.employeeId,
        scope: session.user.scope,
        ...query,
      });
    }
  }

  private async listMissingDraftReferences(
    session: WebSession,
    drafts: JobPlanDraftRecord[],
    references: JobPlanReferences,
  ): Promise<JobPlanDraftReferences> {
    const countdownMap = buildReferenceCountdownMap(references);
    const panelMap = buildReferencePanelMap(references);
    const countdownIds = [...new Set(drafts
      .map((draft) => draft.coreId)
      .filter((value): value is string => typeof value === "string" && value.length > 0 && !countdownMap.has(value)))];
    const panelIds = [...new Set(drafts
      .map((draft) => draft.panelId)
      .filter((value): value is number => value !== null && !panelMap.has(value)))];

    if (!this.repository.listDraftReferences || (countdownIds.length === 0 && panelIds.length === 0)) {
      return {
        countdowns: new Map(),
        panels: new Map(),
      };
    }

    return this.repository.listDraftReferences({
      employeeId: session.user.employeeId,
      scope: session.user.scope,
      countdownIds,
      panelIds,
    });
  }

  async list(session: WebSession, query: JobPlanGridQuery): Promise<JobPlanListResult> {
    const [listResult, references] = await Promise.all([
      this.repository.list({
        employeeId: session.user.employeeId,
        scope: session.user.scope,
        query,
      }),
      this.repository.listReferences({
        employeeId: session.user.employeeId,
        scope: session.user.scope,
        mode: query.mode,
      }),
    ]);
    const allDrafts = await this.readDrafts(
      session,
      this.getDraftDivisionIds(session, { query, references }),
    );

    const visibleDrafts = allDrafts.filter((draft) => matchesDraftFilters(draft, query));
    const draftReferences = await this.listMissingDraftReferences(session, visibleDrafts, references);
    const countdownMap = buildReferenceCountdownMap(references);
    const panelMap = buildReferencePanelMap(references);
    draftReferences.countdowns.forEach((countdown, key) => countdownMap.set(key, countdown));
    draftReferences.panels.forEach((panel, key) => panelMap.set(key, panel));
    const draftRows = visibleDrafts.map((draft) => {
      const record = mapDraftToRecord(draft);
      const countdown = draft.coreId ? countdownMap.get(draft.coreId) : null;
      const panel = draft.panelId ? panelMap.get(draft.panelId) : null;
      const panelName = countdown?.panelName
        ?? countdown?.panelSectionName
        ?? record.panelName
        ?? panel?.panelName
        ?? panel?.partName
        ?? null;
      const referenceDivisionName = resolveReferenceDivisionName(references, record.divisionId);

      if (!countdown) {
        return {
          ...record,
          divisionName: record.divisionName === "-" ? referenceDivisionName ?? record.divisionName : record.divisionName,
          panelName,
          panelSectionName: panelName ?? record.panelSectionName,
          remainingHours: record.remainingHours ?? record.availablePlanHours ?? record.targetHours,
          availablePlanHours: record.availablePlanHours ?? record.targetHours,
        };
      }

      return {
        ...record,
        unitName: countdown.unitName ?? record.unitName,
        divisionId: countdown.divisionId ?? record.divisionId,
        divisionName: countdown.divisionName ?? referenceDivisionName ?? record.divisionName,
        panelName,
        panelSectionName: countdown.panelSectionName ?? panelName ?? record.panelSectionName,
        jobName: countdown.jobName ?? record.jobName,
        availablePlanHours: countdown.availablePlanHours ?? null,
        remainingHours: countdown.remainingHours,
        progressPercent: countdown.progressPercent ?? null,
      };
    });
    const draftSummary = countDraftSummary(visibleDrafts);

    return {
      data:
        query.page === 1 && draftRows.length > 0
          ? [...draftRows, ...listResult.rows]
          : listResult.rows,
      meta: buildMeta(query.page, query.limit, listResult.total + draftRows.length),
      references,
      query,
      summary: {
        totalHours: Number((listResult.summary.totalHours + draftSummary.totalHours).toFixed(2)),
        pendingCount: listResult.summary.pendingCount,
        approvedCount: listResult.summary.approvedCount,
        overtimeCount: listResult.summary.overtimeCount + draftSummary.overtimeCount,
      },
    };
  }

  async listToday(
    session: WebSession,
    query: JobPlanGridQuery,
  ): Promise<JobPlanListResult> {
    return this.list(session, {
      ...query,
      window: "daily",
      dateStart: query.date,
      dateEnd: query.date,
    });
  }

  async listMyDivision(
    session: WebSession,
    query: JobPlanGridQuery,
  ): Promise<JobPlanListResult> {
    const currentDivisionId = session.user.divisionId;
    const filters = currentDivisionId
      ? [
          ...query.filters.filter((filter) => filter.field !== "divisionId"),
          {
            field: "divisionId",
            operator: "eq" as const,
            value: String(currentDivisionId),
          },
        ]
      : query.filters;

    return this.list(session, {
      ...query,
      filters,
    });
  }

  async saveDraft(
    session: WebSession,
    input: SaveJobPlanDraftRequest,
  ): Promise<JobPlanMutationResult> {
    for (const item of input.items) assertSupplementalRequest(session, item);
    const draftDivisionIds = this.getDraftDivisionIds(session, { drafts: input.items });
    const currentDrafts = input.replaceItems
      ? []
      : await this.readDrafts(session, draftDivisionIds);
    const draftMap = new Map(currentDrafts.map((draft) => [draft.draftItemId, draft]));

    for (const draft of input.items) {
      draftMap.set(draft.draftItemId, draft);
    }

    const nextDrafts = Array.from(draftMap.values()).sort((left, right) =>
      left.taskDate.localeCompare(right.taskDate) || left.draftItemId.localeCompare(right.draftItemId),
    );
    const countdownIds = Array.from(new Set(nextDrafts.flatMap((draft) =>
      draft.sourceType === "COUNTDOWN" && draft.coreId ? [draft.coreId] : [],
    )));
    const references = await this.repository.listReferences({
      employeeId: session.user.employeeId,
      scope: session.user.scope,
      mode: "all",
      countdownIds,
    });
    const availableHoursByReference = new Map(references.countdowns.map((countdown) => [
      countdown.value,
      countdown.availablePlanHours ?? countdown.remainingHours,
    ]));
    const countdownDrafts = nextDrafts.flatMap((draft) =>
        draft.sourceType === "COUNTDOWN" && draft.coreId
          ? [{ referenceId: draft.coreId, targetHours: draft.targetHours }]
          : [],
      );
    if (countdownDrafts.some((draft) => !availableHoursByReference.has(draft.referenceId))) {
      throw new Error("COUNTDOWN_NOT_FOUND");
    }
    const exceededAllocation = findExceededJobPlanAllocation(
      countdownDrafts,
      availableHoursByReference,
    );
    if (exceededAllocation) {
      throw new Error("COUNTDOWN_CAPACITY_EXCEEDED");
    }
    const persistedQcDrafts = isSelfServiceRequest(session) ? [] : await this.repository.saveQcReworkDrafts?.({
      employeeId: session.user.employeeId, scope: session.user.scope, items: input.items,
    }) ?? [];
    const persistedById = new Map(persistedQcDrafts.map(normalizeMobileDraftItem)
      .filter((draft): draft is JobPlanDraftRecord => draft !== null)
      .map((draft) => [draft.draftItemId, draft]));
    await this.writeDrafts(session, draftDivisionIds,
      nextDrafts.map((draft) => persistedById.get(draft.draftItemId) ?? draft));

    await this.auditService.log({
      actorId: session.user.employeeId,
      actorName: session.user.fullName,
      action: "jobplan.draft_save",
      module: "jobplan",
      recordId: input.items[0]?.draftItemId ?? null,
      newValue: {
        count: input.items.length,
        replaceItems: input.replaceItems,
        draftItemIds: input.items.map((item) => item.draftItemId),
      },
    });

    return {
      createdIds: input.items.map((item) => item.draftItemId),
      updatedPlanId: null,
      deletedPlanId: null,
      status: "DRAFT",
    };
  }

  async deleteDrafts(
    session: WebSession,
    input: DeleteJobPlanDraftRequest,
  ): Promise<JobPlanMutationResult> {
    const references = session.user.scope.canViewAllUnits
      ? await this.repository.listReferences({
          employeeId: session.user.employeeId,
          scope: session.user.scope,
          mode: "all",
        })
      : undefined;
    const draftDivisionIds = this.getDraftDivisionIds(session, { references });
    const drafts = await this.readDrafts(session, draftDivisionIds);
    const remainingDrafts = drafts.filter(
      (draft) => !input.draftItemIds.includes(draft.draftItemId),
    );

    const consumedQcDraftIds = isSelfServiceRequest(session) ? [] : await this.repository.dismissQcReworkDrafts?.({
      employeeId: session.user.employeeId,
      scope: session.user.scope,
      draftItemIds: input.draftItemIds,
    }) ?? [];
    if (remainingDrafts.length === drafts.length && consumedQcDraftIds.length === 0) {
      throw new Error("DRAFT_NOT_FOUND");
    }

    await this.writeDrafts(session, draftDivisionIds, remainingDrafts);

    await this.auditService.log({
      actorId: session.user.employeeId,
      actorName: session.user.fullName,
      action: "jobplan.draft_delete",
      module: "jobplan",
      recordId: input.draftItemIds[0] ?? null,
      newValue: {
        draftItemIds: input.draftItemIds,
      },
    });

    return {
      createdIds: [],
      updatedPlanId: null,
      deletedPlanId: input.draftItemIds[0] ?? null,
      status: "DRAFT",
    };
  }

  async createAdditionalCountdown(
    session: WebSession,
    input: CreateJobPlanAdditionalCountdownRequest,
  ): Promise<JobPlanAdditionalCountdownResult> {
    assertSupplementalRequest(session, input);
    const result = await this.repository.createAdditionalCountdown(
      {
        employeeId: session.user.employeeId,
        scope: session.user.scope,
      },
      input,
    );

    await this.auditService.log({
      actorId: session.user.employeeId,
      actorName: session.user.fullName,
      action: "jobplan.additional_countdown_create",
      module: "jobplan",
      recordId: result.coreId,
      newValue: {
        coreId: result.coreId,
        carId: result.carId,
        divisionId: result.divisionId,
        panelId: result.panelId,
      },
    });

    return {
      coreId: result.coreId,
      jobTypeId: result.jobTypeId,
      carId: result.carId ?? input.carId,
      unitName: result.unitName,
      divisionId: result.divisionId,
      divisionName: result.divisionName,
      panelId: result.panelId,
      isNewJobType: result.isNewJobType,
      isNewCore: result.isNewCore,
    };
  }

  async picLoad(
    _session: WebSession,
    employeeId: string,
    taskDate: string,
  ): Promise<{ employeeId: string; taskDate: string; capacity: JobPlanPicLoad }> {
    return {
      employeeId,
      taskDate,
      capacity: await this.repository.getPicLoad(employeeId, taskDate),
    };
  }

  async exportFile(
    session: WebSession,
    query: JobPlanGridQuery,
    format: JobPlanExportFormat,
  ): Promise<JobPlanExportResult> {
    const result = await this.list(session, {
      ...query,
      page: 1,
      limit: 1000,
    });

    const dateSuffix = `${query.dateStart}_${query.dateEnd}`;
    if (format === "xlsx") {
      return {
        fileName: `job-plan-${dateSuffix}.xlsx`,
        contentType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        body: await buildWorkbook(result.data),
      };
    }

    if (format === "pdf") {
      return {
        fileName: `job-plan-${dateSuffix}.pdf`,
        contentType: "application/pdf",
        body: buildPdf(result.data, query),
      };
    }

    if (format === "image") {
      return {
        fileName: `job-plan-${dateSuffix}.svg`,
        contentType: "image/svg+xml; charset=utf-8",
        body: buildImage(result.data, query),
      };
    }

    return {
      fileName: `job-plan-${dateSuffix}.csv`,
      contentType: "text/csv; charset=utf-8",
      body: buildCsv(result.data),
    };
  }
}
