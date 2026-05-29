import { parseGridQueryParams } from "@smsystem/contracts/grid";
import { permissionCodes } from "@smsystem/permissions";
import { errorResponse, withCors } from "@/http/response";
import { requireSession } from "@/middleware/auth.middleware";
import { requireAnyPermission } from "@/middleware/permission.middleware";
import type { AuthService } from "@/services/auth/auth.service";
import type { PlanningWorkspaceService } from "@/services/planning-workspace.service";

function formatIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseIsoDate(date: string): Date {
  const [year, month, day] = date.split("-").map((value) => Number.parseInt(value, 10));
  return new Date(Date.UTC(year, (month || 1) - 1, day || 1));
}

function addDays(baseDate: string, amount: number): string {
  const date = parseIsoDate(baseDate);
  date.setUTCDate(date.getUTCDate() + amount);
  return formatIsoDate(date);
}

function resolveWeekStartDate(baseDate: string): string {
  const date = parseIsoDate(baseDate);
  const day = date.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + diff);
  return formatIsoDate(date);
}

function resolveToday(): string {
  return formatIsoDate(new Date());
}

async function requirePlanningWorkspaceSession(
  request: Request,
  authService: AuthService,
) {
  const sessionResult = await requireSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult;
  }

  const permissionResult = requireAnyPermission(request, sessionResult.session, [
    permissionCodes.updatePlan,
    permissionCodes.listCarProgress,
  ]);
  if ("response" in permissionResult) {
    return permissionResult;
  }

  return {
    session: sessionResult.session,
  };
}

export async function handlePlanningWorkspaceSummaryRoute(
  request: Request,
  authService: AuthService,
  planningWorkspaceService: PlanningWorkspaceService,
): Promise<Response> {
  const sessionResult = await requirePlanningWorkspaceSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const url = new URL(request.url);
    const asOfDate = url.searchParams.get("asOfDate")?.trim() || resolveToday();
    const startDate = url.searchParams.get("startDate")?.trim() || asOfDate;
    const endDate = url.searchParams.get("endDate")?.trim() || addDays(startDate, 6);
    const includeOvertime = url.searchParams.get("includeOvertime") === "true";
    const weekStartDate =
      url.searchParams.get("weekStart")?.trim() || resolveWeekStartDate(asOfDate);

    const data = await planningWorkspaceService.getSummary(sessionResult.session, {
      asOfDate,
      startDate,
      endDate,
      includeOvertime,
      weekStartDate,
      riskQuery: parseGridQueryParams(url.searchParams),
    });

    return withCors(
      request,
      Response.json({
        success: true,
        message: "Planning workspace ready",
        data,
      }),
    );
  } catch (error) {
    console.error("[planning-workspace] failed", error);
    return errorResponse(
      request,
      "Halaman planning belum bisa dihitung saat ini.",
      500,
      "PLANNING_WORKSPACE_FAILED",
    );
  }
}
