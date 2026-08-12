import type { GridQueryState } from "@smsystem/contracts/grid";
import type {
  CountdownCreateRequest,
  CountdownDetail,
  CountdownImportResult,
  CountdownRevisionDecision,
  CountdownRevisionRequest,
  CountdownTemplateRow,
  CountdownUpdateRequest,
} from "@smsystem/contracts/countdown";
import { permissionCodes } from "@smsystem/permissions";
import ExcelJS from "exceljs";
import type { WebSession } from "@/services/auth/session.service";
import { buildGridMeta } from "@/services/grid/paginate";
import {
  CountdownRepository,
  type CountdownDownloadQuery,
  type CountdownRevisionResult,
} from "@/repositories/countdown.repo";
import { sanitizeCountdownGridQuery } from "@/services/countdown/query";
import { applyDefaultDivisionIdFilter } from "@/services/grid/division-default";
import { TtlCache } from "@/lib/ttl-cache";
import {
  notifyMobileEmployees,
  resolveEmployeeIdsByPermission,
} from "@/services/mobile-notification.service";
import {
  addRowsWorksheet,
  readFirstWorksheetRows,
  writeWorkbookBuffer,
} from "@/services/excel";

interface ImportRowInput extends CountdownTemplateRow {
  rowNumber: number;
}

interface TemplateColumn {
  field: keyof CountdownTemplateRow;
  header: string;
  width: number;
}

function normalizeOptionalString(value: string | null | undefined): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const text = value.trim();
  return text.length > 0 ? text : null;
}

export interface CountdownListResult {
  data: Awaited<ReturnType<CountdownRepository["findCountdownBoard"]>>["rows"];
  references: Awaited<ReturnType<CountdownRepository["listFilterReferences"]>>;
  canManage: boolean;
  meta: ReturnType<typeof buildGridMeta>;
  query: ReturnType<typeof sanitizeCountdownGridQuery>;
}

export type CountdownDetailWithFlags = CountdownDetail & {
  canRequestRevision: boolean;
  canApproveRevision: boolean;
  canApproveMoRevision: boolean;
};

export interface CountdownService {
  list(session: WebSession, query: GridQueryState): Promise<CountdownListResult>;
  detail(session: WebSession, countdownId: string): Promise<CountdownDetailWithFlags | null>;
  create(session: WebSession, input: CountdownCreateRequest): Promise<CountdownDetail>;
  update(
    session: WebSession,
    countdownId: string,
    input: CountdownUpdateRequest,
  ): Promise<CountdownDetail | null>;
  remove(session: WebSession, countdownId: string): Promise<boolean>;
  requestRevision(session: WebSession, countdownId: string, input: CountdownRevisionRequest): Promise<CountdownRevisionResult>;
  decideRevision(session: WebSession, countdownId: string, input: CountdownRevisionDecision): Promise<CountdownRevisionResult>;
  download(session: WebSession, query: CountdownDownloadQuery): Promise<Uint8Array>;
  buildTemplateWorkbook(): Promise<Uint8Array>;
  importWorkbook(
    session: WebSession,
    fileName: string,
    buffer: Uint8Array,
    expectedUnitId: string,
  ): Promise<CountdownImportResult>;
}

const COUNTDOWN_REFERENCE_CACHE_TTL_MS = 60_000;

const downloadColumns = [
  ["unitName", "Nama Unit"],
  ["customerName", "Nama Customer"],
  ["divisionName", "Divisi"],
  ["panelName", "Panel"],
  ["sectionName", "Section"],
  ["taskCategory", "Kategori Pekerjaan"],
  ["jobTypeName", "Job Type"],
  ["targetHoursInitial", "Target Jam Awal"],
  ["targetHoursRevised", "Target Jam Revisi"],
  ["totalActualHours", "Jam Aktual"],
  ["remainingHours", "Sisa Jam"],
  ["actualProgressPercent", "Progress (%)"],
  ["status", "Status"],
  ["startDate", "Tanggal Mulai"],
  ["deadlineDate", "Deadline"],
  ["temuanAwal", "Temuan Awal"],
  ["keterangan", "Keterangan"],
] as const;
const countdownReferenceCache = new TtlCache<
  Awaited<ReturnType<CountdownRepository["listFilterReferences"]>>
>(COUNTDOWN_REFERENCE_CACHE_TTL_MS);

function countdownScopeCacheKey(session: WebSession): string {
  return JSON.stringify({
    employeeId: session.user.employeeId,
    scope: session.user.scope,
  });
}

function canManageCountdown(session: WebSession): boolean {
  return (
    session.user.scope.canViewAllUnits &&
    session.user.permissions.includes(permissionCodes.updatePlan)
  );
}

function canRequestRevision(session: WebSession): boolean {
  return session.user.permissions.includes(permissionCodes.countdownRequestRevision);
}

function canApproveRevision(session: WebSession, isAssignedKp: boolean): boolean {
  return session.user.permissions.includes(permissionCodes.countdownSubmitApproval) &&
    (session.user.scope.canViewAllUnits || isAssignedKp);
}

function canApproveMoRevision(session: WebSession): boolean {
  return session.user.scope.canViewAllUnits &&
    session.user.permissions.includes(permissionCodes.countdownSubmitApproval);
}

async function notifyCountdownPlanners(
  detail: Pick<CountdownDetail, "countdownId" | "carId" | "divisionId" | "unitName" | "panelName" | "sectionName"> & { status: string },
  title: string,
  body: string,
): Promise<void> {
  await notifyCountdownBestEffort(detail.countdownId, async () => {
    const recipients = await resolveEmployeeIdsByPermission(
      permissionCodes.updatePlan,
      detail.divisionId ?? undefined,
    );
    await notifyMobileEmployees(recipients, {
      title,
      body,
      data: {
        module: "countdown",
        countdownId: detail.countdownId,
        carId: detail.carId,
        status: detail.status,
      },
    }, "sm_countdown");
  });
}

async function notifyCountdownBestEffort(
  context: string,
  send: () => Promise<void>,
): Promise<void> {
  try {
    await send();
  } catch (error) {
    console.error("Countdown notification failed", { context, error });
  }
}

function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "");
}

const templateColumns: TemplateColumn[] = [
  { field: "carId", header: "Kode Unit/Mobil", width: 22 },
  { field: "unitName", header: "Nama Unit", width: 20 },
  { field: "divisionId", header: "Kode Divisi", width: 14 },
  { field: "divisionName", header: "Nama Divisi", width: 20 },
  { field: "panelId", header: "Kode Panel", width: 14 },
  { field: "panelName", header: "Nama Panel", width: 28 },
  { field: "taskCategory", header: "Kategori Pekerjaan", width: 20 },
  { field: "sectionName", header: "Nama Section", width: 28 },
  { field: "jobTypeId", header: "Kode Job Type", width: 28 },
  { field: "jobTypeName", header: "Nama Job Type", width: 28 },
  { field: "targetHoursInitial", header: "Target Jam Awal", width: 16 },
  { field: "startDate", header: "Tanggal Mulai", width: 14 },
  { field: "deadlineDate", header: "Tanggal Deadline", width: 16 },
  { field: "prerequisiteCoreId", header: "Kode Prasyarat Core", width: 22 },
  { field: "refWoId", header: "Referensi WO", width: 18 },
  { field: "note", header: "Catatan", width: 26 },
  { field: "temuanAwal", header: "Temuan Awal", width: 32 },
  { field: "keterangan", header: "Keterangan", width: 32 },
];

const templateHeaderAliases: Record<keyof CountdownTemplateRow, string[]> = {
  carId: ["Kode Unit", "Kode Mobil", "Kode Unit/Mobil", "Car ID", "ID Unit"],
  unitName: ["Nama Unit", "Nama Mobil"],
  divisionId: ["Kode Divisi", "ID Divisi"],
  divisionName: ["Nama Divisi"],
  panelId: ["Kode Panel", "ID Panel"],
  panelName: ["Nama Panel"],
  taskCategory: ["Kategori Pekerjaan", "Jenis Pekerjaan"],
  sectionName: ["Nama Section", "Section", "Nama Bagian"],
  jobTypeId: ["Kode Job Type", "Kode Job", "ID Job Type"],
  jobTypeName: ["Nama Job Type", "Nama Job"],
  targetHoursInitial: ["Target Jam Awal", "Target Jam", "Jam Target Awal"],
  startDate: ["Tanggal Mulai", "Start Date"],
  deadlineDate: ["Tanggal Deadline", "Deadline"],
  prerequisiteCoreId: ["Kode Prasyarat Core", "Kode Prasyarat", "Prerequisite"],
  refWoId: ["Referensi WO", "No WO", "Ref WO"],
  note: ["Catatan", "Keterangan"],
  temuanAwal: ["Temuan Awal", "Initial Finding"],
  keterangan: ["Keterangan", "Catatan Baru", "Remarks"],
};

const templateHeaderLookup = new Map<string, keyof CountdownTemplateRow>();

for (const column of templateColumns) {
  templateHeaderLookup.set(normalizeHeader(column.field), column.field);
  templateHeaderLookup.set(normalizeHeader(column.header), column.field);

  for (const alias of templateHeaderAliases[column.field]) {
    templateHeaderLookup.set(normalizeHeader(alias), column.field);
  }
}

function toStringValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).trim();
}

function toNumberValue(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const text = toStringValue(value).replace(",", ".");
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function toTaskCategory(value: unknown): CountdownTemplateRow["taskCategory"] {
  const taskCategory = toStringValue(value).toUpperCase();

  if (taskCategory === "ADDITIONAL") {
    return "ADDITIONAL";
  }

  if (taskCategory === "WO") {
    return "WO";
  }

  if (taskCategory === "WOV") {
    return "WOV";
  }

  return "MAIN";
}

function normalizeWorkbookRows(rows: Record<string, unknown>[]): ImportRowInput[] {
  return rows
    .map((sourceRow, index) => {
      const normalized: Record<string, unknown> = {};

      for (const [key, value] of Object.entries(sourceRow)) {
        const mappedKey = templateHeaderLookup.get(normalizeHeader(key));
        if (!mappedKey) {
          continue;
        }
        normalized[mappedKey] = value;
      }

      return {
        rowNumber: index + 2,
        carId: toStringValue(normalized.carId),
        unitName: toStringValue(normalized.unitName) || undefined,
        divisionId: toStringValue(normalized.divisionId),
        divisionName: toStringValue(normalized.divisionName) || undefined,
        panelId: toStringValue(normalized.panelId) || undefined,
        panelName: toStringValue(normalized.panelName) || undefined,
        taskCategory: toTaskCategory(normalized.taskCategory),
        sectionName: toStringValue(normalized.sectionName),
        jobTypeId: toStringValue(normalized.jobTypeId) || undefined,
        jobTypeName: toStringValue(normalized.jobTypeName) || undefined,
        targetHoursInitial: toNumberValue(normalized.targetHoursInitial),
        startDate: toStringValue(normalized.startDate) || undefined,
        deadlineDate: toStringValue(normalized.deadlineDate) || undefined,
        prerequisiteCoreId: toStringValue(normalized.prerequisiteCoreId) || undefined,
        refWoId: toStringValue(normalized.refWoId) || undefined,
        note: toStringValue(normalized.note) || undefined,
        temuanAwal: toStringValue(normalized.temuanAwal) || undefined,
        keterangan: toStringValue(normalized.keterangan) || undefined,
      } satisfies ImportRowInput;
    })
    .filter((row) => {
      return (
        row.carId ||
        row.divisionId ||
        row.sectionName ||
        Number.isFinite(row.targetHoursInitial)
      );
    });
}

function buildTemplateRows(): CountdownTemplateRow[] {
  return [
    {
      carId: "MB500SEL_MRSILMY",
      unitName: "MB 500 SEL",
      divisionId: "12",
      divisionName: "INTERIOR",
      panelId: "457",
      panelName: "KARPET COVER BAWAH DASHBOARD",
      taskCategory: "MAIN",
      sectionName: "KARPET COVER BAWAH DASHBOARD",
      jobTypeId: "6294bc6d-4845-11f1-bec2-5a91b00d579f",
      jobTypeName: "PASANG KE UNIT",
      targetHoursInitial: 8,
      startDate: "2026-05-15",
      deadlineDate: "2026-05-18",
      prerequisiteCoreId: "",
      refWoId: "",
      note: "Template MAIN",
      temuanAwal: "",
      keterangan: "Contoh keterangan MAIN",
    },
    {
      carId: "MB500SEL_MRSILMY",
      unitName: "MB 500 SEL",
      divisionId: "12",
      divisionName: "INTERIOR",
      panelId: "507",
      panelName: "Peredam",
      taskCategory: "ADDITIONAL",
      sectionName: "Peredam Tambahan",
      jobTypeId: "629e3b77-4845-11f1-bec2-5a91b00d579f",
      jobTypeName: "POLA DAN PEMASANGAN PEREDAM",
      targetHoursInitial: 5,
      startDate: "2026-05-16",
      deadlineDate: "2026-05-20",
      prerequisiteCoreId: "",
      refWoId: "",
      note: "Template ADDITIONAL",
      temuanAwal: "Cek tambahan peredam",
      keterangan: "Contoh keterangan ADDITIONAL",
    },
  ];
}

function buildTemplateSheetRows(rows: CountdownTemplateRow[]): Array<Array<string | number>> {
  return [
    templateColumns.map((column) => column.header),
    ...rows.map((row) =>
      templateColumns.map((column) => row[column.field] ?? ""),
    ),
  ];
}

function buildTemplateReferenceRows(): Array<Array<string | number>> {
  return [
    ["Kolom", "Contoh Isi", "Wajib", "Keterangan"],
    ["Kode Unit/Mobil", "MB500SEL_MRSILMY", "Ya", "Harus ada di master unit."],
    ["Kode Divisi", "12", "Ya", "Harus valid di master divisi."],
    ["Nama Section", "KARPET COVER BAWAH DASHBOARD", "Ya", "Nama pekerjaan atau section."],
    ["Kategori Pekerjaan", "MAIN", "Ya", "MAIN, ADDITIONAL, WO, atau WOV."],
    ["Target Jam Awal", "8", "Ya", "Angka tanpa satuan."],
    ["Tanggal Deadline", "2026-05-18", "Ya", "Format YYYY-MM-DD."],
    ["Kode Panel", "457", "Tidak", "Opsional jika belum ada panel."],
    ["Kode Job Type", "6294bc6d-4845-11f1-bec2-5a91b00d579f", "Tidak", "Opsional jika belum ada job type."],
    ["Tanggal Mulai", "2026-05-15", "Tidak", "Opsional."],
    ["Referensi WO", "WO-123", "Tidak", "Opsional."],
    ["Kode Prasyarat Core", "CORE-001", "Tidak", "Opsional."],
    ["Catatan", "Template MAIN", "Tidak", "Opsional."],
    ["Temuan Awal", "Cek tambahan peredam", "Tidak", "Opsional."],
    ["Keterangan", "Instruksi bebas", "Tidak", "Opsional."],
  ];
}

export class DefaultCountdownService implements CountdownService {
  constructor(
    private readonly repository: CountdownRepository = new CountdownRepository(),
  ) {}

  async list(session: WebSession, query: GridQueryState): Promise<CountdownListResult> {
    const normalizedQuery = applyDefaultDivisionIdFilter(
      session,
      sanitizeCountdownGridQuery(query),
    );
    const [payload, references] = await Promise.all([
      this.repository.findCountdownBoard({
        employeeId: session.user.employeeId,
        scope: session.user.scope,
        query: normalizedQuery,
      }),
      countdownReferenceCache.getOrCreate(countdownScopeCacheKey(session), () =>
        this.repository.listFilterReferences({
          employeeId: session.user.employeeId,
          scope: session.user.scope,
        }),
      ),
    ]);

    return {
      data: payload.rows,
      references,
      canManage: canManageCountdown(session),
      meta: buildGridMeta(payload.total, normalizedQuery.page, normalizedQuery.limit),
      query: normalizedQuery,
    };
  }

  async detail(session: WebSession, countdownId: string): Promise<CountdownDetailWithFlags | null> {
    const detail = await this.repository.findCountdownDetail({
      employeeId: session.user.employeeId,
      scope: session.user.scope,
      countdownId,
    });
    if (!detail) return null;
    const isAssignedKp = session.user.scope.canViewAllUnits ||
      await this.repository.isCountdownKp(countdownId, session.user.employeeId);
    return {
      ...detail,
      canRequestRevision: canRequestRevision(session) &&
        (detail.status === "PLAN" || detail.status === "PROSES") &&
        detail.extensionRequestStatus !== "REQUESTED" &&
        detail.extensionRequestStatus !== "MO_REVIEW",
      canApproveRevision: canApproveRevision(session, isAssignedKp) && detail.extensionRequestStatus === "REQUESTED",
      canApproveMoRevision: canApproveMoRevision(session) && detail.extensionRequestStatus === "MO_REVIEW",
    };
  }

  async requestRevision(
    session: WebSession,
    countdownId: string,
    input: CountdownRevisionRequest,
  ): Promise<CountdownRevisionResult> {
    if (!canRequestRevision(session)) throw new Error("COUNTDOWN_REVISION_FORBIDDEN");
    const result = await this.repository.requestCountdownRevision({
      employeeId: session.user.employeeId,
      scope: session.user.scope,
      countdownId,
      input,
    });
    await notifyCountdownBestEffort(`revision-request:${countdownId}`, async () =>
      notifyMobileEmployees(
        await resolveEmployeeIdsByPermission(permissionCodes.countdownSubmitApproval, result.divisionId),
        {
          title: "Pengajuan Revisi Countdown",
          body: `Countdown ${countdownId} mengajukan perubahan jam kerja atau deadline.`,
          data: { module: "countdown", countdownId, carId: result.carId, status: result.status },
        },
        "sm_countdown",
      ),
    );
    return result;
  }

  async decideRevision(
    session: WebSession,
    countdownId: string,
    input: CountdownRevisionDecision,
  ): Promise<CountdownRevisionResult> {
    const existing = await this.repository.findCountdownDetail({
      employeeId: session.user.employeeId,
      scope: session.user.scope,
      countdownId,
    });
    if (!existing) throw new Error("COUNTDOWN_NOT_FOUND");
    const isMo = existing.extensionRequestStatus === "MO_REVIEW";
    const isAssignedKp = session.user.scope.canViewAllUnits ||
      await this.repository.isCountdownKp(countdownId, session.user.employeeId);
    if (isMo ? !canApproveMoRevision(session) : !canApproveRevision(session, isAssignedKp)) {
      throw new Error("COUNTDOWN_REVISION_FORBIDDEN");
    }
    const result = await this.repository.decideCountdownRevision({
      employeeId: session.user.employeeId,
      scope: session.user.scope,
      countdownId,
      input,
      isMo,
    });
    await notifyCountdownBestEffort(`revision-decision:${countdownId}:${result.status}`, async () =>
      notifyMobileEmployees(
        await resolveEmployeeIdsByPermission(
          result.status === "MO_REVIEW"
            ? permissionCodes.countdownSubmitApproval
            : permissionCodes.countdownRequestRevision,
          result.status === "MO_REVIEW" ? undefined : result.divisionId,
        ),
        {
          title: result.status === "MO_REVIEW" ? "Revisi Menunggu Persetujuan MO" : "Revisi Countdown Diproses",
          body: `Pengajuan revisi countdown ${countdownId} berstatus ${result.status}.`,
          data: { module: "countdown", countdownId, carId: result.carId, status: result.status },
        },
        "sm_countdown",
      ),
    );
    return result;
  }

  async create(session: WebSession, input: CountdownCreateRequest): Promise<CountdownDetail> {
    const detail = await this.repository.createCountdown(
      {
        employeeId: session.user.employeeId,
        scope: session.user.scope,
      },
      input,
    );
    countdownReferenceCache.delete(countdownScopeCacheKey(session));
    await notifyCountdownPlanners(
      detail,
      "Countdown Baru",
      `${detail.unitName} - ${detail.panelName ?? detail.sectionName ?? "pekerjaan"} dibuat oleh ${session.user.fullName}.`,
    );
    return detail;
  }

  async update(
    session: WebSession,
    countdownId: string,
    input: CountdownUpdateRequest,
  ): Promise<CountdownDetail | null> {
    const existing = await this.repository.findCountdownDetail({
      employeeId: session.user.employeeId,
      scope: session.user.scope,
      countdownId,
    });
    if (!existing) {
      return null;
    }

    const mergedInput: CountdownCreateRequest = {
      carId: input.carId ?? existing.carId,
      divisionId: input.divisionId ?? (existing.divisionId ?? 0),
      panelId: input.panelId !== undefined ? input.panelId : existing.panelId ?? null,
      taskCategory: input.taskCategory ?? (existing.taskCategory as CountdownCreateRequest["taskCategory"]),
      sectionName: input.sectionName ?? (existing.sectionName ?? ""),
      jobTypeId: normalizeOptionalString(input.jobTypeId) ?? existing.jobTypeId ?? null,
      targetHoursInitial: input.targetHoursInitial ?? existing.targetHoursInitial,
      startDate: normalizeOptionalString(input.startDate) ?? existing.startDate ?? null,
      deadlineDate: input.deadlineDate ?? (existing.deadlineDate ?? ""),
      prerequisiteCoreId:
        normalizeOptionalString(input.prerequisiteCoreId) ??
        existing.prerequisiteCoreId ??
        null,
      refWoId: normalizeOptionalString(input.refWoId) ?? existing.refWoId ?? null,
      note: normalizeOptionalString(input.note) ?? existing.note ?? null,
      temuanAwal:
        normalizeOptionalString(input.temuanAwal) ??
        existing.temuanAwal ??
        null,
      keterangan:
        normalizeOptionalString(input.keterangan) ??
        existing.keterangan ??
        null,
      status: input.status ?? (existing.status as CountdownCreateRequest["status"]),
    };

    const detail = await this.repository.updateCountdown(
      {
        employeeId: session.user.employeeId,
        scope: session.user.scope,
      },
      countdownId,
      mergedInput,
    );
    countdownReferenceCache.delete(countdownScopeCacheKey(session));
    if (detail) {
      await notifyCountdownPlanners(
        detail,
        "Countdown Diperbarui",
        `${detail.unitName} - ${detail.panelName ?? detail.sectionName ?? "pekerjaan"} diperbarui oleh ${session.user.fullName}.`,
      );
    }
    return detail;
  }

  async remove(session: WebSession, countdownId: string): Promise<boolean> {
    const existing = await this.repository.findCountdownDetail({
      employeeId: session.user.employeeId,
      scope: session.user.scope,
      countdownId,
    });
    const removed = await this.repository.deleteCountdown(
      {
        employeeId: session.user.employeeId,
        scope: session.user.scope,
      },
      countdownId,
    );
    if (removed) {
      countdownReferenceCache.delete(countdownScopeCacheKey(session));
      if (existing) {
        await notifyCountdownPlanners(
          { ...existing, status: "DELETED" },
          "Countdown Dihapus",
          `${existing.unitName} - ${existing.panelName ?? existing.sectionName ?? "pekerjaan"} dihapus oleh ${session.user.fullName}.`,
        );
      }
    }
    return removed;
  }

  async download(session: WebSession, query: CountdownDownloadQuery): Promise<Uint8Array> {
    const rows = await this.repository.findCountdownDownload({
      employeeId: session.user.employeeId,
      scope: session.user.scope,
      query,
    });
    const workbook = new ExcelJS.Workbook();
    addRowsWorksheet(
      workbook,
      "Countdown",
      [
        downloadColumns.map(([, header]) => header),
        ...rows.map((row) => downloadColumns.map(([field]) => row[field] ?? "")),
      ],
      downloadColumns.map(([, header]) => Math.max(14, header.length + 4)),
    );
    return writeWorkbookBuffer(workbook);
  }

  async buildTemplateWorkbook(): Promise<Uint8Array> {
    const templateRows = buildTemplateRows();
    const workbook = new ExcelJS.Workbook();
    const templateSheet = addRowsWorksheet(
      workbook,
      "countdown-template",
      buildTemplateSheetRows(templateRows),
      templateColumns.map((column) => Math.max(column.header.length + 2, column.width)),
    );
    templateSheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: templateRows.length + 1, column: templateColumns.length },
    };
    addRowsWorksheet(workbook, "panduan", buildTemplateReferenceRows(), [
      22,
      24,
      10,
      42,
    ]);

    return writeWorkbookBuffer(workbook);
  }

  async importWorkbook(
    session: WebSession,
    _fileName: string,
    buffer: Uint8Array,
    expectedUnitId: string,
  ): Promise<CountdownImportResult> {
    let sourceRows: Awaited<ReturnType<typeof readFirstWorksheetRows>>;
    try {
      sourceRows = await readFirstWorksheetRows(buffer);
    } catch {
      throw new Error("COUNTDOWN_IMPORT_FILE_INVALID");
    }
    if (!sourceRows) {
      return {
        inserted: 0,
        updated: 0,
        rejected: 1,
        issues: [
          {
            rowNumber: 0,
            field: "file",
            message: "File tidak memiliki sheet data.",
            value: null,
          },
        ],
      };
    }

    const rows = normalizeWorkbookRows(sourceRows);
    if (rows.length === 0) {
      return {
        inserted: 0,
        updated: 0,
        rejected: 1,
        issues: [
          {
            rowNumber: 0,
            field: "file",
            message: "Tidak ada baris data yang bisa diproses.",
            value: null,
          },
        ],
      };
    }

    const unitIssues = rows
      .filter((row) => row.carId !== expectedUnitId)
      .map((row) => ({
        rowNumber: row.rowNumber,
        field: "carId",
        message: "Unit pada file tidak sesuai; seluruh import dibatalkan.",
        value: row.carId,
      }));
    if (unitIssues.length > 0) {
      return {
        inserted: 0,
        updated: 0,
        rejected: rows.length,
        issues: unitIssues,
      };
    }

    const result = await this.repository.createCountdownImports(
      {
        employeeId: session.user.employeeId,
        scope: session.user.scope,
      },
      rows,
    );
    if (result.inserted + result.updated > 0) {
      await Promise.all(
        [...new Set(rows.map((row) => Number(row.divisionId)))].map((divisionId) =>
          notifyCountdownBestEffort(`import:${rows[0]?.carId ?? "unknown"}:${divisionId}`, async () =>
            notifyMobileEmployees(
              await resolveEmployeeIdsByPermission(permissionCodes.updatePlan, divisionId),
              {
                title: "Import Countdown",
                body: `${session.user.fullName} mengimport ${result.inserted} countdown baru dan memperbarui ${result.updated} countdown.`,
                data: { module: "countdown", carId: rows[0]?.carId ?? "", status: "IMPORTED" },
              },
              "sm_countdown",
            ),
          ),
        ),
      );
    }
    return result;
  }
}
