import {
  reportExportFormatSchema,
  type ReportType,
} from "@smsystem/contracts/reports";
import { permissionCodes } from "@smsystem/permissions";
import { errorResponse, withCors } from "@/http/response";
import { requirePermission } from "@/middleware/permission.middleware";
import { requireSession } from "@/middleware/auth.middleware";
import type { AuthService } from "@/services/auth/auth.service";
import { sanitizeReportQuery } from "@/services/reports/query";
import type { ReportsService } from "@/services/reports.service";
import type { WebSession } from "@/services/auth/session.service";
import {
  applyDefaultDivisionIdFilter,
  applyDefaultDivisionNameFilter,
} from "@/services/grid/division-default";
import { getReportConfig } from "@/services/reports/definitions";

async function requireReportsSession(
  request: Request,
  authService: AuthService,
  permission: string,
) {
  const sessionResult = await requireSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult;
  }

  const permissionResult = requirePermission(
    request,
    sessionResult.session,
    permission,
  );
  if ("response" in permissionResult) {
    return permissionResult;
  }

  return {
    session: sessionResult.session,
  };
}

function mapReportsError(request: Request, error: unknown): Response {
  if (error instanceof Error && error.message === "REPORT_EXPORT_FORMAT_INVALID") {
    return errorResponse(
      request,
      "Format export report tidak didukung.",
      400,
      "REPORT_EXPORT_FORMAT_INVALID",
    );
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "ER_NO_SUCH_TABLE"
  ) {
    return errorResponse(
      request,
      "Sumber data report belum siap di environment ini.",
      503,
      "REPORT_STORAGE_NOT_READY",
    );
  }

  return errorResponse(
    request,
    "Terjadi kesalahan internal pada modul reports.",
    500,
    "REPORTS_FAILED",
  );
}

function applyDefaultReportDivisionFilter(
  session: WebSession,
  reportType: ReportType,
  query: ReturnType<typeof sanitizeReportQuery>,
) {
  const filterFields = new Set(
    getReportConfig(reportType).filterConfigs.map((filter) => filter.field),
  );

  if (filterFields.has("divisionId")) {
    return applyDefaultDivisionIdFilter(session, query);
  }

  if (filterFields.has("divisionName")) {
    return applyDefaultDivisionNameFilter(session, query);
  }

  return query;
}

export async function handleReportsGridRoute(
  request: Request,
  reportType: ReportType,
  authService: AuthService,
  reportsService: ReportsService,
): Promise<Response> {
  const sessionResult = await requireReportsSession(
    request,
    authService,
    permissionCodes.reportView,
  );
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const query = applyDefaultReportDivisionFilter(
      sessionResult.session,
      reportType,
      sanitizeReportQuery(reportType, new URL(request.url).searchParams),
    );
    const result = await reportsService.getReport(sessionResult.session, reportType, query);
    return withCors(
      request,
      Response.json({
        success: true,
        message: "Report grid ready",
        data: result.data,
        meta: result.meta,
        query: result.query,
        definition: result.definition,
        summary: result.summary,
      }),
    );
  } catch (error) {
    return mapReportsError(request, error);
  }
}

export async function handleReportsExportRoute(
  request: Request,
  reportType: ReportType,
  authService: AuthService,
  reportsService: ReportsService,
): Promise<Response> {
  const sessionResult = await requireReportsSession(
    request,
    authService,
    permissionCodes.reportExport,
  );
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const url = new URL(request.url);
    const format = reportExportFormatSchema.safeParse(url.searchParams.get("format") ?? "xlsx");
    if (!format.success) {
      throw new Error("REPORT_EXPORT_FORMAT_INVALID");
    }

    const query = applyDefaultReportDivisionFilter(
      sessionResult.session,
      reportType,
      sanitizeReportQuery(reportType, url.searchParams),
    );
    const result = await reportsService.exportReport(
      sessionResult.session,
      reportType,
      query,
      format.data,
    );

    return withCors(
      request,
      new Response(
        result.body instanceof Uint8Array
          ? new Blob([
              new Uint8Array(
                result.body.buffer as ArrayBuffer,
                result.body.byteOffset,
                result.body.byteLength,
              ),
            ])
          : result.body,
        {
        status: 200,
        headers: {
          "Content-Type": result.contentType,
          "Content-Disposition": `attachment; filename="${result.fileName}"`,
        },
      }),
    );
  } catch (error) {
    return mapReportsError(request, error);
  }
}
