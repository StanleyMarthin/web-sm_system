import type {
  ReportDefinition,
  ReportExportFormat,
  ReportQuery,
  ReportRow,
  ReportSummaryItem,
  ReportType,
} from "@smsystem/contracts/reports";
import ExcelJS from "exceljs";
import {
  MySqlReportsRepository,
  type ReportsRepository,
} from "@/repositories/reports.repo";
import type { WebSession } from "@/services/auth/session.service";
import { buildReportDefinition } from "@/services/reports/definitions";
import type { AuditService } from "@/services/audit/audit.service";
import { DefaultAuditService } from "@/services/audit/audit.service";
import { MySqlAuditRepository } from "@/repositories/audit.repo";
import { addRowsWorksheet, writeWorkbookBuffer } from "@/services/excel";

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

function toCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  const text = String(value).replace(/"/gu, "\"\"");
  return `"${text}"`;
}

function buildCsv(columns: ReportDefinition["columns"], rows: ReportRow[]): string {
  const header = columns.map((column) => toCsvCell(column.label)).join(",");
  const body = rows
    .map((row) =>
      columns.map((column) => toCsvCell(row[column.key] ?? "")).join(","),
    )
    .join("\n");

  return `${header}\n${body}`;
}

async function buildWorkbook(
  definition: ReportDefinition,
  summary: ReportSummaryItem[],
  rows: ReportRow[],
): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  const gridRows = [
    definition.columns.map((column) => column.label),
    ...rows.map((row) => definition.columns.map((column) => row[column.key] ?? "")),
  ];
  addRowsWorksheet(
    workbook,
    "Report",
    gridRows,
    definition.columns.map((column) => Math.max(12, column.label.length + 2)),
  );

  addRowsWorksheet(
    workbook,
    "Summary",
    [
      ["Label", "Value", "Helper"],
      ...summary.map((item) => [item.label, item.value, item.helper]),
    ],
    [24, 18, 40],
  );

  return writeWorkbookBuffer(workbook);
}

export interface ReportsListResult {
  data: ReportRow[];
  meta: ReturnType<typeof buildMeta>;
  query: ReportQuery;
  definition: ReportDefinition;
  summary: ReportSummaryItem[];
}

export interface ReportsExportResult {
  fileName: string;
  contentType: string;
  body: string | Uint8Array;
}

export interface ReportsService {
  getReport(
    session: WebSession,
    type: ReportType,
    query: ReportQuery,
  ): Promise<ReportsListResult>;
  exportReport(
    session: WebSession,
    type: ReportType,
    query: ReportQuery,
    format: ReportExportFormat,
  ): Promise<ReportsExportResult>;
}

export class DefaultReportsService implements ReportsService {
  constructor(
    private readonly repository: ReportsRepository = new MySqlReportsRepository(),
    private readonly auditService: AuditService = new DefaultAuditService(
      new MySqlAuditRepository(),
    ),
  ) {}

  async getReport(
    session: WebSession,
    type: ReportType,
    query: ReportQuery,
  ): Promise<ReportsListResult> {
    const dataset = await this.repository.getReportData({
      type,
      employeeId: session.user.employeeId,
      scope: session.user.scope,
      query,
      exportAll: false,
    });
    const definition = buildReportDefinition(type, dataset.filterOptions);

    return {
      data: dataset.rows,
      meta: buildMeta(query.page, query.limit, dataset.total),
      query,
      definition,
      summary: dataset.summary,
    };
  }

  async exportReport(
    session: WebSession,
    type: ReportType,
    query: ReportQuery,
    format: ReportExportFormat,
  ): Promise<ReportsExportResult> {
    const dataset = await this.repository.getReportData({
      type,
      employeeId: session.user.employeeId,
      scope: session.user.scope,
      query,
      exportAll: true,
    });
    const definition = buildReportDefinition(type, dataset.filterOptions);
    const dateSuffix = new Date().toISOString().slice(0, 10);
    await this.auditService.log({
      actorId: session.user.employeeId,
      actorName: session.user.fullName,
      action: "report.export",
      module: "report",
      recordId: type,
      newValue: {
        type,
        format,
        query,
        rowCount: dataset.rows.length,
      },
    });

    if (format === "csv") {
      return {
        fileName: `${type}-${dateSuffix}.csv`,
        contentType: "text/csv; charset=utf-8",
        body: buildCsv(definition.columns, dataset.rows),
      };
    }

    return {
      fileName: `${type}-${dateSuffix}.xlsx`,
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      body: await buildWorkbook(definition, dataset.summary, dataset.rows),
    };
  }
}
