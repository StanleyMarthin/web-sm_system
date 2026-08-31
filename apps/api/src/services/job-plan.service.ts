import type {
  BulkCreateJobPlanRequest,
  CreateJobPlanRequest,
  CreateJobPlanWorkspaceRequest,
  DeleteJobPlanDraftRequest,
  JobPlanExportFormat,
  JobPlanDraftRecord,
  JobPlanGridQuery,
  JobPlanPicLoad,
  JobPlanRecord,
  JobPlanStatus,
  SaveJobPlanDraftRequest,
  SubmitJobPlanDraftRequest,
  UpdateJobPlanRequest,
  UpdateJobPlanStatusRequest,
} from "@smsystem/contracts/job-plan";
import { jobPlanDraftRecordSchema } from "@smsystem/contracts/job-plan";
import {
  buildJobPlanScheduleSegments,
  findExceededJobPlanAllocation,
} from "@smsystem/contracts/job-plan-schedule";
import type { RedisClientType } from "redis";
import ExcelJS from "exceljs";
import type { AuditService } from "@/services/audit/audit.service";
import { DefaultAuditService } from "@/services/audit/audit.service";
import { MySqlAuditRepository } from "@/repositories/audit.repo";
import {
  MySqlJobPlanRepository,
  type JobPlanRepository,
} from "@/repositories/job-plan.repo";
import { getRedisClient } from "@/redis/client";
import type { WebSession } from "@/services/auth/session.service";
import { notifyMobileEmployees } from "@/services/mobile-notification.service";
import { addRowsWorksheet, writeWorkbookBuffer } from "@/services/excel";

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

interface JobPlanExportResult {
  fileName: string;
  contentType: string;
  body: string | Uint8Array;
}

function expandPlanDraftForSchedule(plan: CreateJobPlanRequest) {
  const scheduleSegments = buildJobPlanScheduleSegments({
    taskDate: plan.taskDate,
    requestedMode: plan.isOvertime ? "overtime" : "normal",
    targetHours: plan.targetHours,
  });

  if (scheduleSegments.length === 0) {
    return [plan];
  }

  if (scheduleSegments.length === 1) {
    return [
      {
        ...plan,
        targetHours: scheduleSegments[0].targetHours,
        startTime: plan.startTime ?? scheduleSegments[0].startTime,
        finishTime: plan.finishTime ?? scheduleSegments[0].finishTime,
        isOvertime: scheduleSegments[0].mode === "overtime",
      },
    ];
  }

  return scheduleSegments.map((segment) => ({
    ...plan,
    targetHours: segment.targetHours,
    startTime: segment.startTime,
    finishTime: segment.finishTime,
    isOvertime: segment.mode === "overtime",
  }));
}

const JOB_PLAN_DRAFT_TTL_SECONDS = 60 * 60 * 24 * 30;

function buildJobPlanDraftKey(employeeId: string): string {
  return `jobplan:web:draft:${employeeId}`;
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
      coreId: String(source.coreId ?? source.draftItemId ?? source.core_id ?? ""),
      assignedUserId: String(source.assignedUserId ?? source.assigned_user_id ?? source.employeeId ?? ""),
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
    });
  } catch {
    return null;
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
    instructionText: draft.note ?? draft.jobDescription,
    note: draft.note ?? null,
    draftSourceType: draft.sourceType,
    draftCarId: draft.carId ?? null,
    draftPanelId: draft.panelId ?? null,
    draftJobTypeId: draft.jobTypeId ?? null,
    draftDeadlineDate: draft.deadlineDate ?? null,
    draftIsRework: draft.isRework,
    draftIsNonTechnicalJob: draft.isNonTechnicalJob,
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

function resolveApprovedStatus(currentStatus: JobPlanStatus): JobPlanStatus {
  if (currentStatus === "PENDING_ADV") {
    return "PENDING_KP";
  }

  if (currentStatus === "PENDING_KP") {
    return "PENDING_MP";
  }

  if (currentStatus === "PENDING_MP" || currentStatus === "PENDING") {
    return "PLAN";
  }

  throw new Error("INVALID_STATUS_TRANSITION");
}

export interface JobPlanService {
  list(session: WebSession, query: JobPlanGridQuery): Promise<JobPlanListResult>;
  listToday(session: WebSession, query: JobPlanGridQuery): Promise<JobPlanListResult>;
  listMyDivision(session: WebSession, query: JobPlanGridQuery): Promise<JobPlanListResult>;
  saveDraft(
    session: WebSession,
    input: SaveJobPlanDraftRequest,
  ): Promise<JobPlanMutationResult>;
  submitDrafts(
    session: WebSession,
    input: SubmitJobPlanDraftRequest,
  ): Promise<JobPlanMutationResult>;
  deleteDrafts(
    session: WebSession,
    input: DeleteJobPlanDraftRequest,
  ): Promise<JobPlanMutationResult>;
  create(session: WebSession, input: CreateJobPlanRequest): Promise<JobPlanMutationResult>;
  createWorkspace(
    session: WebSession,
    input: CreateJobPlanWorkspaceRequest,
  ): Promise<JobPlanMutationResult>;
  bulkCreate(
    session: WebSession,
    input: BulkCreateJobPlanRequest,
  ): Promise<JobPlanMutationResult>;
  update(
    session: WebSession,
    planId: string,
    input: UpdateJobPlanRequest,
  ): Promise<JobPlanMutationResult>;
  updateStatus(
    session: WebSession,
    planId: string,
    input: UpdateJobPlanStatusRequest,
  ): Promise<JobPlanMutationResult>;
  delete(session: WebSession, planId: string): Promise<JobPlanMutationResult>;
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

function canUpdateStatus(currentStatus: JobPlanStatus, nextStatus: JobPlanStatus): boolean {
  if (nextStatus === "PLAN") {
    return ["PENDING", "PENDING_ADV", "PENDING_KP", "PENDING_MP"].includes(currentStatus);
  }

  if (nextStatus === "REJECTED") {
    return ["PENDING", "PENDING_ADV", "PENDING_KP", "PENDING_MP", "PLAN"].includes(
      currentStatus,
    );
  }

  return false;
}

export class DefaultJobPlanService implements JobPlanService {
  constructor(
    private readonly repository: JobPlanRepository = new MySqlJobPlanRepository(),
    private readonly auditService: AuditService = new DefaultAuditService(
      new MySqlAuditRepository(),
    ),
    private readonly redisFactory: () => Promise<RedisClientType> = getRedisClient,
  ) {}

  private async readDrafts(employeeId: string): Promise<JobPlanDraftRecord[]> {
    const redis = await this.redisFactory();
    const raw = await redis.get(buildJobPlanDraftKey(employeeId)) ?? await redis.get(`jobplan:draft:${employeeId}`);
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

  private async writeDrafts(employeeId: string, drafts: JobPlanDraftRecord[]) {
    const redis = await this.redisFactory();
    const webKey = buildJobPlanDraftKey(employeeId);
    const mobileKey = `jobplan:draft:${employeeId}`;

    if (drafts.length === 0) {
      await redis.del(webKey);
      await redis.del(mobileKey);
      return;
    }

    await redis.set(webKey, JSON.stringify(drafts), {
      EX: JOB_PLAN_DRAFT_TTL_SECONDS,
    });
    // Mirror ke key mobile (sm_job_plan) agar draft web muncul di aplikasi mobile.
    await redis.set(mobileKey, JSON.stringify({ items: drafts }), {
      EX: JOB_PLAN_DRAFT_TTL_SECONDS,
    });
  }

  async list(session: WebSession, query: JobPlanGridQuery): Promise<JobPlanListResult> {
    const [listResult, references, allDrafts] = await Promise.all([
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
      this.readDrafts(session.user.employeeId),
    ]);

    const visibleDrafts = allDrafts.filter((draft) => matchesDraftFilters(draft, query));
    const countdownMap = new Map(references.countdowns.map((countdown) => [countdown.value, countdown]));
    const draftRows = visibleDrafts.map((draft) => {
      const record = mapDraftToRecord(draft);
      const countdown = draft.coreId ? countdownMap.get(draft.coreId) : null;

      if (!countdown) {
        return record;
      }

      return {
        ...record,
        unitName: countdown.unitName ?? record.unitName,
        divisionId: countdown.divisionId ?? record.divisionId,
        divisionName: countdown.divisionName ?? record.divisionName,
        panelName: countdown.panelName ?? countdown.panelSectionName ?? record.panelName,
        panelSectionName: countdown.panelSectionName ?? record.panelSectionName,
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

  async create(
    session: WebSession,
    input: CreateJobPlanRequest,
  ): Promise<JobPlanMutationResult> {
    return this.bulkCreate(session, { plans: [input] });
  }

  async saveDraft(
    session: WebSession,
    input: SaveJobPlanDraftRequest,
  ): Promise<JobPlanMutationResult> {
    const currentDrafts = input.replaceItems ? [] : await this.readDrafts(session.user.employeeId);
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
    await this.writeDrafts(session.user.employeeId, nextDrafts);

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

  async submitDrafts(
    session: WebSession,
    input: SubmitJobPlanDraftRequest,
  ): Promise<JobPlanMutationResult> {
    const drafts = await this.readDrafts(session.user.employeeId);
    const selectedDrafts = input.draftItemIds.map((draftItemId) =>
      drafts.find((draft) => draft.draftItemId === draftItemId) ?? null,
    );

    if (selectedDrafts.some((draft) => draft === null)) {
      throw new Error("DRAFT_NOT_FOUND");
    }

    const draftRows = selectedDrafts.filter(Boolean) as JobPlanDraftRecord[];
    const groupedHours = new Map<string, number>();

    for (const draft of draftRows) {
      const scheduleSegments = buildJobPlanScheduleSegments({
        taskDate: draft.taskDate,
        requestedMode: draft.isOvertime ? "overtime" : "normal",
        targetHours: draft.targetHours,
      });

      for (const segment of scheduleSegments) {
        const key = `${draft.assignedUserId}|${draft.taskDate}|${segment.mode === "overtime" ? "1" : "0"}`;
        groupedHours.set(key, (groupedHours.get(key) ?? 0) + segment.targetHours);
      }
    }

    for (const [key, requestedHours] of groupedHours) {
      const [employeeId, taskDate, overtimeFlag] = key.split("|");
      const capacity = await this.repository.getPicLoad(employeeId!, taskDate!);
      const remaining =
        overtimeFlag === "1"
          ? capacity.overtime.remaining
          : capacity.normal.remaining;

      if (requestedHours > remaining + 0.0001) {
        throw new Error("CAPACITY_EXCEEDED");
      }
    }

    const result = await this.repository.submitDrafts(
      {
        employeeId: session.user.employeeId,
        scope: session.user.scope,
        actorId: session.user.employeeId,
        actorName: session.user.fullName,
      },
      draftRows,
    );

    await this.writeDrafts(
      session.user.employeeId,
      drafts.filter((draft) => !input.draftItemIds.includes(draft.draftItemId)),
    );

    await this.auditService.log({
      actorId: session.user.employeeId,
      actorName: session.user.fullName,
      action: "jobplan.draft_submit",
      module: "jobplan",
      recordId: result.createdIds[0] ?? null,
      newValue: {
        count: result.createdIds.length,
        draftItemIds: input.draftItemIds,
        createdIds: result.createdIds,
      },
    });

    await this.notifySubmittedPlans(
      draftRows.map((draft) => draft.carId).filter((id): id is string => Boolean(id)),
      result.createdIds,
      session.user.fullName,
    );

    return {
      createdIds: result.createdIds,
      updatedPlanId: null,
      deletedPlanId: null,
      status: null,
    };
  }

  private async notifySubmittedPlans(
    carIds: string[],
    planIds: string[],
    actorName: string,
  ): Promise<void> {
    try {
      const approvers = await this.repository.getApproversForCars([...new Set(carIds)]);
      const recipients = approvers.flatMap(({ kpId, advisorId, kdId }) =>
        [kpId, advisorId, kdId].filter((id): id is string => Boolean(id)),
      );
      await notifyMobileEmployees(recipients, {
        title: "Job Plan Baru Menunggu Persetujuan",
        body: `${actorName} mengajukan ${planIds.length} rencana kerja yang perlu disetujui.`,
        data: {
          planId: planIds[0] ?? "",
          status: "PENDING",
          module: "job_plan",
        },
      }, "sm_job_plan");
    } catch (err) {
      console.error("[job-plan] notification error:", err);
    }
  }

  private async notifySubmittedCorePlans(
    session: WebSession,
    coreIds: string[],
    planIds: string[],
  ): Promise<void> {
    try {
      const references = await this.repository.listReferences({
        employeeId: session.user.employeeId,
        scope: session.user.scope,
        mode: "all",
        countdownIds: [...new Set(coreIds)],
      });
      await this.notifySubmittedPlans(
        references.countdowns.map((countdown) => countdown.carId),
        planIds,
        session.user.fullName,
      );
    } catch (error) {
      console.error("[job-plan] notification recipient lookup error:", error);
    }
  }

  private async notifyPlanStatus(plan: JobPlanRecord, recipient = plan.assignedUserId): Promise<void> {
    const waitingFor = plan.status === "PENDING_ADV" ? "QA" : "KP";
    await notifyMobileEmployees([recipient], {
      title: plan.status === "PLAN"
        ? "Job Plan Disetujui"
        : plan.status === "REJECTED"
          ? "Job Plan Ditolak"
          : `Job Plan Menunggu Persetujuan ${waitingFor}`,
      body: plan.status === "PLAN"
        ? `Job plan ${plan.unitName} - ${plan.panelName ?? plan.jobName ?? "pekerjaan"} sudah disetujui dan siap dijalankan.`
        : plan.status === "REJECTED"
          ? `Job plan ${plan.unitName} - ${plan.panelName ?? plan.jobName ?? "pekerjaan"} ditolak. Silakan cek catatan penolakan.`
          : `Job plan ${plan.unitName} - ${plan.panelName ?? plan.jobName ?? "pekerjaan"} untuk ${plan.assignedUserName} sedang menunggu persetujuan Anda.`,
      data: { planId: plan.planId, coreId: plan.coreId, status: plan.status, module: "job_plan" },
    }, "sm_job_plan");
  }

  private async notifyUpdatedPlan(session: WebSession, plan: JobPlanRecord): Promise<void> {
    if (plan.status === "PLAN" || plan.status === "REJECTED") {
      return this.notifyPlanStatus(plan);
    }
    if (plan.status !== "PENDING_ADV" && plan.status !== "PENDING_KP") return;

    try {
      const references = await this.repository.listReferences({
        employeeId: session.user.employeeId,
        scope: session.user.scope,
        mode: "all",
        countdownIds: [plan.coreId],
      });
      const carId = references.countdowns.find(({ value }) => value === plan.coreId)?.carId;
      if (!carId) return;
      const approver = (await this.repository.getApproversForCars([carId]))[0];
      const recipient = plan.status === "PENDING_ADV" ? approver?.advisorId : approver?.kpId;
      if (recipient) await this.notifyPlanStatus(plan, recipient);
    } catch (error) {
      console.error("[job-plan] status notification error:", error);
    }
  }

  async deleteDrafts(
    session: WebSession,
    input: DeleteJobPlanDraftRequest,
  ): Promise<JobPlanMutationResult> {
    const drafts = await this.readDrafts(session.user.employeeId);
    const remainingDrafts = drafts.filter(
      (draft) => !input.draftItemIds.includes(draft.draftItemId),
    );

    if (remainingDrafts.length === drafts.length) {
      throw new Error("DRAFT_NOT_FOUND");
    }

    await this.writeDrafts(session.user.employeeId, remainingDrafts);

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

  async bulkCreate(
    session: WebSession,
    input: BulkCreateJobPlanRequest,
  ): Promise<JobPlanMutationResult> {
    const expandedPlans = input.plans.flatMap((plan) => expandPlanDraftForSchedule(plan));
    const groupedHours = new Map<string, number>();

    for (const plan of expandedPlans) {
      const key = `${plan.assignedUserId}|${plan.taskDate}|${plan.isOvertime ? "1" : "0"}`;
      groupedHours.set(key, (groupedHours.get(key) ?? 0) + plan.targetHours);
    }

    for (const [key, requestedHours] of groupedHours) {
      const [employeeId, taskDate, overtimeFlag] = key.split("|");
      const capacity = await this.repository.getPicLoad(employeeId, taskDate);
      const remaining =
        overtimeFlag === "1"
          ? capacity.overtime.remaining
          : capacity.normal.remaining;

      if (requestedHours > remaining + 0.0001) {
        throw new Error("CAPACITY_EXCEEDED");
      }
    }

    const result = await this.repository.createMany(
      {
        employeeId: session.user.employeeId,
        scope: session.user.scope,
        actorId: session.user.employeeId,
        actorName: session.user.fullName,
      },
      expandedPlans,
    );

    await this.auditService.log({
      actorId: session.user.employeeId,
      actorName: session.user.fullName,
      action: "jobplan.bulk_create",
      module: "jobplan",
      recordId: result.createdIds[0] ?? null,
      newValue: {
        createdIds: result.createdIds,
        count: result.createdIds.length,
      },
    });

    await this.notifySubmittedCorePlans(
      session,
      expandedPlans.map((plan) => plan.coreId),
      result.createdIds,
    );

    return {
      createdIds: result.createdIds,
      updatedPlanId: null,
      deletedPlanId: null,
      status: null,
    };
  }

  async createWorkspace(
    session: WebSession,
    input: CreateJobPlanWorkspaceRequest,
  ): Promise<JobPlanMutationResult> {
    const groupedHours = new Map<string, number>();

    for (const row of input.rows) {
      const scheduleSegments = buildJobPlanScheduleSegments({
        taskDate: input.taskDate,
        requestedMode: input.mode,
        targetHours: row.targetHours,
      });

      for (const segment of scheduleSegments) {
        const key = `${row.assignedUserId}|${input.taskDate}|${segment.mode === "overtime" ? "1" : "0"}`;
        groupedHours.set(key, (groupedHours.get(key) ?? 0) + segment.targetHours);
      }
    }

    for (const [key, requestedHours] of groupedHours) {
      const [employeeId, taskDate, overtimeFlag] = key.split("|");
      const capacity = await this.repository.getPicLoad(employeeId, taskDate);
      const remaining =
        overtimeFlag === "1"
          ? capacity.overtime.remaining
          : capacity.normal.remaining;

      if (requestedHours > remaining + 0.0001) {
        throw new Error("CAPACITY_EXCEEDED");
      }
    }

    const result = await this.repository.createWorkspace(
      {
        employeeId: session.user.employeeId,
        scope: session.user.scope,
        actorId: session.user.employeeId,
        actorName: session.user.fullName,
      },
      input,
    );

    await this.auditService.log({
      actorId: session.user.employeeId,
      actorName: session.user.fullName,
      action: "jobplan.workspace_create",
      module: "jobplan",
      recordId: result.createdIds[0] ?? null,
      newValue: {
        createdIds: result.createdIds,
        count: result.createdIds.length,
        taskDate: input.taskDate,
        mode: input.mode,
        isRework: input.isRework,
      },
    });

    await this.notifySubmittedPlans(
      input.rows.map((row) => row.carId).filter((id): id is string => Boolean(id)),
      result.createdIds,
      session.user.fullName,
    );

    return {
      createdIds: result.createdIds,
      updatedPlanId: null,
      deletedPlanId: null,
      status: null,
    };
  }

  async update(
    session: WebSession,
    planId: string,
    _input: UpdateJobPlanRequest,
  ): Promise<JobPlanMutationResult> {
    const existing = await this.repository.findById({
      employeeId: session.user.employeeId,
      scope: session.user.scope,
      planId,
    });
    if (!existing) {
      throw new Error("PLAN_NOT_FOUND");
    }

    throw new Error("PLAN_EDIT_FORBIDDEN");
  }

  async updateStatus(
    session: WebSession,
    planId: string,
    input: UpdateJobPlanStatusRequest,
  ): Promise<JobPlanMutationResult> {
    const existing = await this.repository.findById({
      employeeId: session.user.employeeId,
      scope: session.user.scope,
      planId,
    });
    if (!existing) {
      throw new Error("PLAN_NOT_FOUND");
    }

    if (!canUpdateStatus(existing.status, input.status)) {
      throw new Error("INVALID_STATUS_TRANSITION");
    }

    const nextStatus =
      input.status === "PLAN" && existing.status !== "PLAN"
        ? resolveApprovedStatus(existing.status)
        : input.status;

    const result = await this.repository.updateStatus(
      {
        employeeId: session.user.employeeId,
        scope: session.user.scope,
        planId,
      },
      {
        ...input,
        status: nextStatus,
      },
    );

    await this.auditService.log({
      actorId: session.user.employeeId,
      actorName: session.user.fullName,
      action: "jobplan.status_update",
      module: "jobplan",
      recordId: planId,
      oldValue: {
        status: existing.status,
      },
      newValue: {
        status: result.status,
        note: input.note,
      },
    });

    await this.notifyUpdatedPlan(session, { ...existing, status: result.status });

    return {
      createdIds: [],
      updatedPlanId: planId,
      deletedPlanId: null,
      status: result.status,
    };
  }

  async delete(session: WebSession, planId: string): Promise<JobPlanMutationResult> {
    const existing = await this.repository.findById({
      employeeId: session.user.employeeId,
      scope: session.user.scope,
      planId,
    });
    if (!existing) {
      throw new Error("PLAN_NOT_FOUND");
    }

    throw new Error("PLAN_DELETE_FORBIDDEN");
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
