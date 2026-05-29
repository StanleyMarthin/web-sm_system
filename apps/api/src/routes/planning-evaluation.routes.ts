import { permissionCodes } from "@smsystem/permissions";
import { errorResponse, withCors } from "@/http/response";
import { requireSession } from "@/middleware/auth.middleware";
import { requireAnyPermission } from "@/middleware/permission.middleware";
import type { AuthService } from "@/services/auth/auth.service";
import type { PlanningEvaluationService } from "@/services/planning-evaluation.service";

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

function differenceInDaysInclusive(start: string, end: string): number {
  const startDate = new Date(`${start}T00:00:00`).getTime();
  const endDate = new Date(`${end}T00:00:00`).getTime();
  return Math.floor((endDate - startDate) / 86_400_000) + 1;
}

function resolveToday(): string {
  return formatIsoDate(new Date());
}

function resolveMode(searchParams: URLSearchParams): "all" | "normal" | "overtime" {
  const mode = searchParams.get("mode");
  if (mode === "all") {
    return "all";
  }

  return mode === "overtime" ? "overtime" : "normal";
}

function resolveSpan(searchParams: URLSearchParams): "daily" | "weekly" {
  return searchParams.get("span") === "weekly" ? "weekly" : "daily";
}

function resolveRange(searchParams: URLSearchParams) {
  const date = searchParams.get("date")?.trim() || resolveToday();
  const span = resolveSpan(searchParams);
  if (span === "daily") {
    return {
      date,
      dateTo: date,
      span,
    };
  }

  let dateTo = searchParams.get("dateTo")?.trim() || addDays(date, 6);
  if (dateTo < date) {
    dateTo = date;
  }

  if (differenceInDaysInclusive(date, dateTo) > 7) {
    dateTo = addDays(date, 6);
  }

  return {
    date,
    dateTo,
    span,
  };
}

async function requirePlanningEvaluationSession(
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

export async function handlePlanningEvaluationRoute(
  request: Request,
  authService: AuthService,
  planningEvaluationService: PlanningEvaluationService,
): Promise<Response> {
  const sessionResult = await requirePlanningEvaluationSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const url = new URL(request.url);
    const { date, dateTo, span } = resolveRange(url.searchParams);
    const mode = resolveMode(url.searchParams);
    const result = await planningEvaluationService.getEvaluation(sessionResult.session, {
      date,
      dateTo,
      span,
      mode,
    });

    return withCors(
      request,
      Response.json({
        success: true,
        message: "Evaluasi planning siap.",
        data: result,
      }),
    );
  } catch (error) {
    console.error("[planning-evaluation] failed", error);
    return errorResponse(
      request,
      "Data evaluasi planning belum bisa dihitung saat ini.",
      500,
      "PLANNING_EVALUATION_FAILED",
    );
  }
}
