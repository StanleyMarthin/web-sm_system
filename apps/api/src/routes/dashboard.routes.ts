import { permissionCodes } from "@smsystem/permissions";
import type { AuthService } from "@/services/auth/auth.service";
import type { DashboardService } from "@/services/dashboard.service";
import { requireSession } from "@/middleware/auth.middleware";
import { requirePermission } from "@/middleware/permission.middleware";
import { errorResponse, successResponse } from "@/http/response";

export async function handleDashboardBootstrapRoute(
  request: Request,
  authService: AuthService,
): Promise<Response> {
  const sessionResult = await requireSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  return successResponse(request, "Dashboard bootstrap ready", {
    welcome: `Selamat datang, ${sessionResult.session.user.fullName}`,
    employeeId: sessionResult.session.user.employeeId,
    permissionCount: sessionResult.session.user.permissions.length,
    scope: sessionResult.session.user.scope,
  });
}

function resolveAsOfDate(searchParams: URLSearchParams): string | undefined {
  const value = searchParams.get("date")?.trim();
  return value || undefined;
}

export async function handleDashboardSummaryRoute(
  request: Request,
  authService: AuthService,
  dashboardService: DashboardService,
): Promise<Response> {
  const sessionResult = await requireSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const url = new URL(request.url);
    const summary = await dashboardService.getSummary(sessionResult.session, {
      date: url.searchParams.get("date")?.trim() || undefined,
      dateFrom: url.searchParams.get("dateFrom")?.trim() || undefined,
      dateTo: url.searchParams.get("dateTo")?.trim() || undefined,
      divisionId: url.searchParams.get("divisionId")?.trim() || undefined,
      unitId: url.searchParams.get("unitId")?.trim() || undefined,
    });

    return successResponse(request, "Ringkasan dashboard siap digunakan", summary);
  } catch {
    return errorResponse(
      request,
      "Ringkasan dashboard belum bisa dimuat saat ini.",
      500,
      "DASHBOARD_SUMMARY_FAILED",
    );
  }
}
