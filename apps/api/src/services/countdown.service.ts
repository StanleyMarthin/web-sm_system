import type { GridQueryState } from "@smsystem/contracts/grid";
import type {
  CountdownCreateRequest,
  CountdownDetail,
  CountdownImportResult,
  CountdownTemplateRow,
  CountdownUpdateRequest,
} from "@smsystem/contracts/countdown";
import { permissionCodes } from "@smsystem/permissions";
import * as XLSX from "xlsx";
import type { WebSession } from "@/services/auth/session.service";
import { buildGridMeta } from "@/services/grid/paginate";
import { CountdownRepository } from "@/repositories/countdown.repo";
import { sanitizeCountdownGridQuery } from "@/services/countdown/query";
import { applyDefaultDivisionIdFilter } from "@/services/grid/division-default";
import { TtlCache } from "@/lib/ttl-cache";

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

export interface CountdownService {
  list(session: WebSession, query: GridQueryState): Promise<CountdownListResult>;
  detail(session: WebSession, countdownId: string): Promise<CountdownDetail | null>;
  create(session: WebSession, input: CountdownCreateRequest): Promise<CountdownDetail>;
  update(
    session: WebSession,
    countdownId: string,
    input: CountdownUpdateRequest,
  ): Promise<CountdownDetail | null>;
  remove(session: WebSession, countdownId: string): Promise<boolean>;
  buildTemplateWorkbook(): Uint8Array;
  importWorkbook(session: WebSession, fileName: string, buffer: Uint8Array): Promise<CountdownImportResult>;
}

const COUNTDOWN_REFERENCE_CACHE_TTL_MS = 60_000;
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

  async detail(session: WebSession, countdownId: string): Promise<CountdownDetail | null> {
    return this.repository.findCountdownDetail({
      employeeId: session.user.employeeId,
      scope: session.user.scope,
      countdownId,
    });
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
    return detail;
  }

  async remove(session: WebSession, countdownId: string): Promise<boolean> {
    const removed = await this.repository.deleteCountdown(
      {
        employeeId: session.user.employeeId,
        scope: session.user.scope,
      },
      countdownId,
    );
    if (removed) {
      countdownReferenceCache.delete(countdownScopeCacheKey(session));
    }
    return removed;
  }

  buildTemplateWorkbook(): Uint8Array {
    const templateRows = buildTemplateRows();
    const workbook = XLSX.utils.book_new();
    const templateSheet = XLSX.utils.aoa_to_sheet(buildTemplateSheetRows(templateRows));
    const referenceSheet = XLSX.utils.aoa_to_sheet(buildTemplateReferenceRows());

    templateSheet["!cols"] = templateColumns.map((column) => ({
      wch: Math.max(column.header.length + 2, column.width),
    }));
    templateSheet["!autofilter"] = {
      ref: XLSX.utils.encode_range({
        s: { c: 0, r: 0 },
        e: { c: templateColumns.length - 1, r: templateRows.length },
      }),
    };
    referenceSheet["!cols"] = [
      { wch: 22 },
      { wch: 24 },
      { wch: 10 },
      { wch: 42 },
    ];

    XLSX.utils.book_append_sheet(workbook, templateSheet, "countdown-template");
    XLSX.utils.book_append_sheet(workbook, referenceSheet, "panduan");

    return XLSX.write(workbook, {
      type: "buffer",
      bookType: "xlsx",
    }) as Uint8Array;
  }

  async importWorkbook(
    session: WebSession,
    _fileName: string,
    buffer: Uint8Array,
  ): Promise<CountdownImportResult> {
    const workbook = XLSX.read(buffer, {
      type: "buffer",
      cellDates: true,
    });

    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
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

    const sheet = workbook.Sheets[firstSheetName];
    const sourceRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: "",
      raw: true,
      blankrows: false,
    });

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

    return this.repository.createCountdownImports(
      {
        employeeId: session.user.employeeId,
        scope: session.user.scope,
      },
      rows,
    );
  }
}
