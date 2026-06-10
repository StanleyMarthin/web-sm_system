import { parseGridQueryParams } from "@smsystem/contracts/grid";
import { permissionCodes } from "@smsystem/permissions";
import { errorResponse, withCors } from "@/http/response";
import { requireSession } from "@/middleware/auth.middleware";
import { requirePermission } from "@/middleware/permission.middleware";
import type { AuthService } from "@/services/auth/auth.service";
import type { MonitoringService } from "@/services/monitoring.service";

async function requireMonitoringSession(
  request: Request,
  authService: AuthService,
) {
  const sessionResult = await requireSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult;
  }

  const permissionResult = requirePermission(
    request,
    sessionResult.session,
    permissionCodes.listCarProgress,
  );
  if ("response" in permissionResult) {
    return permissionResult;
  }

  return {
    session: sessionResult.session,
  };
}

function resolveDate(searchParams: URLSearchParams): string | undefined {
  const value = searchParams.get("date")?.trim();
  return value || undefined;
}

function resolveDateTo(searchParams: URLSearchParams): string | undefined {
  const value = searchParams.get("dateTo")?.trim();
  return value || undefined;
}

function resolveDivisionMode(searchParams: URLSearchParams): "all" | "normal" | "overtime" {
  const mode = searchParams.get("mode");
  if (mode === "all") {
    return "all";
  }

  return mode === "overtime" ? "overtime" : "normal";
}

function resolveDivisionSpan(searchParams: URLSearchParams): "daily" | "weekly" {
  return searchParams.get("span") === "weekly" ? "weekly" : "daily";
}

function resolveDivisionId(pathname: string): number | null {
  const match = pathname.match(/^\/api\/monitoring\/division\/(\d+)$/);
  if (!match) {
    return null;
  }

  const value = Number.parseInt(match[1] ?? "", 10);
  return Number.isFinite(value) ? value : null;
}

function addDaysIso(baseDate: string, days: number): string {
  const [year, month, day] = baseDate.split("-").map((value) => Number.parseInt(value, 10));
  const nextDate = new Date(Date.UTC(year, (month || 1) - 1, day || 1));
  nextDate.setUTCDate(nextDate.getUTCDate() + days);
  const nextYear = nextDate.getUTCFullYear();
  const nextMonth = String(nextDate.getUTCMonth() + 1).padStart(2, "0");
  const nextDay = String(nextDate.getUTCDate()).padStart(2, "0");
  return `${nextYear}-${nextMonth}-${nextDay}`;
}

function differenceInDaysInclusive(start: string, end: string): number {
  const startDate = new Date(`${start}T00:00:00`).getTime();
  const endDate = new Date(`${end}T00:00:00`).getTime();
  return Math.floor((endDate - startDate) / 86_400_000) + 1;
}

function resolveDivisionRange(
  date: string | undefined,
  dateTo: string | undefined,
  span: "daily" | "weekly",
): { date: string; dateTo: string } {
  const resolvedDate = date ?? new Date().toISOString().slice(0, 10);
  if (span === "daily") {
    return {
      date: resolvedDate,
      dateTo: resolvedDate,
    };
  }

  let resolvedDateTo = dateTo?.trim() || addDaysIso(resolvedDate, 6);
  if (resolvedDateTo < resolvedDate) {
    resolvedDateTo = resolvedDate;
  }

  const spanDays = differenceInDaysInclusive(resolvedDate, resolvedDateTo);
  if (spanDays > 7) {
    resolvedDateTo = addDaysIso(resolvedDate, 6);
  }

  return {
    date: resolvedDate,
    dateTo: resolvedDateTo,
  };
}

export async function handleMonitoringTodayRoute(
  request: Request,
  authService: AuthService,
  monitoringService: MonitoringService,
): Promise<Response> {
  const sessionResult = await requireMonitoringSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const url = new URL(request.url);
    const mode = resolveDivisionMode(url.searchParams);
    const date = resolveDate(url.searchParams);
    const dateTo = resolveDateTo(url.searchParams);
    const result = await monitoringService.listToday(
      sessionResult.session,
      parseGridQueryParams(url.searchParams),
      date,
      mode,
      dateTo,
    );

    return withCors(
      request,
      Response.json({
        success: true,
        message: "Today monitoring ready",
        data: result.data,
        meta: result.meta,
        query: result.query,
        references: result.references,
        summary: result.summary,
        mode,
        date: result.query.date,
        dateTo: result.query.dateTo,
      }),
    );
  } catch (error) {
    console.error("[monitoring] division load failed", error);
    return errorResponse(
      request,
      "Terjadi kesalahan internal pada monitoring module.",
      500,
      "MONITORING_FAILED",
    );
  }
}

export async function handleMonitoringDivisionRoute(
  request: Request,
  authService: AuthService,
  monitoringService: MonitoringService,
): Promise<Response> {
  const sessionResult = await requireMonitoringSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const url = new URL(request.url);
    const date = resolveDate(url.searchParams);
    const dateTo = resolveDateTo(url.searchParams);
    const mode = resolveDivisionMode(url.searchParams);
    const span = resolveDivisionSpan(url.searchParams);
    const range = resolveDivisionRange(date, dateTo, span);
    const result = await monitoringService.listDivisionLoad(
      sessionResult.session,
      range.date,
      mode,
      span,
      range.dateTo,
    );

    return withCors(
      request,
      Response.json({
        success: true,
        message: "Division monitoring ready",
        data: result,
        date: range.date,
        dateTo: range.dateTo,
        mode,
        span,
      }),
    );
  } catch {
    return errorResponse(
      request,
      "Terjadi kesalahan internal pada monitoring module.",
      500,
      "MONITORING_FAILED",
    );
  }
}

export async function handleMonitoringUnitRoute(
  request: Request,
  authService: AuthService,
  monitoringService: MonitoringService,
): Promise<Response> {
  const sessionResult = await requireMonitoringSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const url = new URL(request.url);
    const date = resolveDate(url.searchParams);
    const dateTo = resolveDateTo(url.searchParams);
    const mode = resolveDivisionMode(url.searchParams);
    const span = resolveDivisionSpan(url.searchParams);
    const range = resolveDivisionRange(date, dateTo, span);
    const result = await monitoringService.listUnitLoad(
      sessionResult.session,
      range.date,
      mode,
      span,
      range.dateTo,
    );

    return withCors(
      request,
      Response.json({
        success: true,
        message: "Unit monitoring ready",
        data: result,
        date: range.date,
        dateTo: range.dateTo,
        span,
      }),
    );
  } catch (error) {
    console.error("[monitoring] unit route error:", error);
    return errorResponse(
      request,
      "Terjadi kesalahan internal pada monitoring module.",
      500,
      "MONITORING_FAILED",
    );
  }
}


export async function handleMonitoringDivisionDetailRoute(
  request: Request,
  authService: AuthService,
  monitoringService: MonitoringService,
): Promise<Response> {
  const sessionResult = await requireMonitoringSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const url = new URL(request.url);
    const divisionId = resolveDivisionId(url.pathname);
    if (!divisionId) {
      return errorResponse(
        request,
        "Divisi yang diminta tidak valid.",
        400,
        "INVALID_DIVISION_ID",
      );
    }

    const date = resolveDate(url.searchParams);
    const dateTo = resolveDateTo(url.searchParams);
    const mode = resolveDivisionMode(url.searchParams);
    const span = resolveDivisionSpan(url.searchParams);
    const range = resolveDivisionRange(date, dateTo, span);
    const result = await monitoringService.getDivisionDetail(
      sessionResult.session,
      divisionId,
      range.date,
      mode,
      span,
      range.dateTo,
    );

    return withCors(
      request,
      Response.json({
        success: true,
        message: "Division monitoring detail ready",
        divisionId: result.divisionId,
        divisionName: result.divisionName,
        date: range.date,
        dateTo: range.dateTo,
        mode,
        span,
        summary: result.summary,
        units: result.units,
        members: result.members,
      }),
    );
  } catch {
    return errorResponse(
      request,
      "Terjadi kesalahan internal pada monitoring module.",
      500,
      "MONITORING_FAILED",
    );
  }
}

export async function handleMonitoringOvertimeRoute(
  request: Request,
  authService: AuthService,
  monitoringService: MonitoringService,
): Promise<Response> {
  const sessionResult = await requireMonitoringSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const url = new URL(request.url);
    const result = await monitoringService.listOvertime(
      sessionResult.session,
      parseGridQueryParams(url.searchParams),
      resolveDate(url.searchParams),
      resolveDateTo(url.searchParams),
    );

    return withCors(
      request,
      Response.json({
        success: true,
        message: "Overtime monitoring ready",
        data: result.data,
        meta: result.meta,
        query: result.query,
        references: result.references,
        summary: result.summary,
      }),
    );
  } catch {
    return errorResponse(
      request,
      "Terjadi kesalahan internal pada monitoring module.",
      500,
      "MONITORING_FAILED",
    );
  }
}

export async function handleMonitoringNoStartRoute(
  request: Request,
  authService: AuthService,
  monitoringService: MonitoringService,
): Promise<Response> {
  const sessionResult = await requireMonitoringSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const url = new URL(request.url);
    const date = resolveDate(url.searchParams);
    const dateTo = resolveDateTo(url.searchParams);
    const result = await monitoringService.listNoStart(sessionResult.session, date, dateTo);

    return withCors(
      request,
      Response.json({
        success: true,
        message: "No-start monitoring ready",
        data: result,
        date: date ?? new Date().toISOString().slice(0, 10),
        dateTo,
      }),
    );
  } catch {
    return errorResponse(
      request,
      "Terjadi kesalahan internal pada monitoring module.",
      500,
      "MONITORING_FAILED",
    );
  }
}

export async function handleMonitoringNoSubmitRoute(
  request: Request,
  authService: AuthService,
  monitoringService: MonitoringService,
): Promise<Response> {
  const sessionResult = await requireMonitoringSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const url = new URL(request.url);
    const date = resolveDate(url.searchParams);
    const dateTo = resolveDateTo(url.searchParams);
    const result = await monitoringService.listNoSubmit(sessionResult.session, date, dateTo);

    return withCors(
      request,
      Response.json({
        success: true,
        message: "No-submit monitoring ready",
        data: result,
        date: date ?? new Date().toISOString().slice(0, 10),
        dateTo,
      }),
    );
  } catch {
    return errorResponse(
      request,
      "Terjadi kesalahan internal pada monitoring module.",
      500,
      "MONITORING_FAILED",
    );
  }
}

export async function handleMonitoringEmployeeRoute(
  request: Request,
  authService: AuthService,
  monitoringService: MonitoringService,
): Promise<Response> {
  const sessionResult = await requireMonitoringSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const url = new URL(request.url);
    const date = resolveDate(url.searchParams);
    const dateTo = resolveDateTo(url.searchParams);
    const span = resolveDivisionSpan(url.searchParams);
    const range = resolveDivisionRange(date, dateTo, span);
    const result = await monitoringService.listEmployeeTimesheet(
      sessionResult.session,
      range.date,
      range.dateTo,
    );

    return withCors(
      request,
      Response.json({
        success: true,
        message: "Employee timesheet ready",
        data: result,
        date: range.date,
        dateTo: range.dateTo,
        span,
      }),
    );
  } catch (err) {
    console.error("[Employee Monitoring Route Error]", err);
    return errorResponse(
      request,
      "Terjadi kesalahan internal pada monitoring module.",
      500,
      "MONITORING_FAILED",
    );
  }
}
