import {
  capacityPreviewRequestSchema,
  weeklyWorkConfigRequestSchema,
  workingDaysRequestSchema,
} from "@smsystem/contracts/calendar";
import { parseGridQueryParams } from "@smsystem/contracts/grid";
import { permissionCodes } from "@smsystem/permissions";
import { parseJsonBody } from "@/http/request";
import { errorResponse, withCors } from "@/http/response";
import { requireSession } from "@/middleware/auth.middleware";
import { requirePermission } from "@/middleware/permission.middleware";
import type { AuthService } from "@/services/auth/auth.service";
import type { CalendarService } from "@/services/calendar.service";

async function requirePlanningSession(
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
    permissionCodes.updatePlan,
  );
  if ("response" in permissionResult) {
    return permissionResult;
  }

  return {
    session: sessionResult.session,
  };
}

async function requireRiskSession(
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

export async function handleWeeklyConfigListRoute(
  request: Request,
  authService: AuthService,
  calendarService: CalendarService,
): Promise<Response> {
  const sessionResult = await requirePlanningSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const data = await calendarService.listWeeklyConfigs(sessionResult.session);
    return withCors(
      request,
      Response.json({
        success: true,
        message: "Weekly config ready",
        data,
      }),
    );
  } catch {
    return errorResponse(
      request,
      "Terjadi kesalahan internal pada calendar module.",
      500,
      "CALENDAR_FAILED",
    );
  }
}

export async function handleWeeklyConfigUpsertRoute(
  request: Request,
  authService: AuthService,
  calendarService: CalendarService,
): Promise<Response> {
  const sessionResult = await requirePlanningSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  const bodyResult = await parseJsonBody(request, weeklyWorkConfigRequestSchema);
  if (!bodyResult.success) {
    return withCors(request, bodyResult.response);
  }

  try {
    const data = await calendarService.upsertWeeklyConfig(
      sessionResult.session,
      bodyResult.data,
    );
    return withCors(
      request,
      Response.json({
        success: true,
        message: "Weekly config updated",
        data,
      }),
    );
  } catch {
    return errorResponse(
      request,
      "Terjadi kesalahan internal pada calendar module.",
      500,
      "CALENDAR_FAILED",
    );
  }
}

export async function handleWorkingDaysRoute(
  request: Request,
  authService: AuthService,
  calendarService: CalendarService,
): Promise<Response> {
  const sessionResult = await requirePlanningSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  const url = new URL(request.url);
  const payload = workingDaysRequestSchema.safeParse({
    startDate: url.searchParams.get("startDate") ?? "",
    endDate: url.searchParams.get("endDate") ?? "",
    includeOvertime: url.searchParams.get("includeOvertime") === "true",
  });
  if (!payload.success) {
    return errorResponse(request, "Query calendar tidak valid.", 400, "INVALID_QUERY");
  }

  try {
    const data = await calendarService.getWorkingDays(sessionResult.session, payload.data);
    return withCors(
      request,
      Response.json({
        success: true,
        message: "Working day list ready",
        data,
      }),
    );
  } catch {
    return errorResponse(
      request,
      "Terjadi kesalahan internal pada calendar module.",
      500,
      "CALENDAR_FAILED",
    );
  }
}

export async function handleCapacityPreviewRoute(
  request: Request,
  authService: AuthService,
  calendarService: CalendarService,
): Promise<Response> {
  const sessionResult = await requirePlanningSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  const bodyResult = await parseJsonBody(request, capacityPreviewRequestSchema);
  if (!bodyResult.success) {
    return withCors(request, bodyResult.response);
  }

  try {
    const data = await calendarService.simulateCapacity(
      sessionResult.session,
      bodyResult.data,
    );
    return withCors(
      request,
      Response.json({
        success: true,
        message: "Capacity preview ready",
        data,
      }),
    );
  } catch {
    return errorResponse(
      request,
      "Terjadi kesalahan internal pada calendar module.",
      500,
      "CALENDAR_FAILED",
    );
  }
}

export async function handleUnitEtaRoute(
  request: Request,
  carId: string,
  authService: AuthService,
  calendarService: CalendarService,
): Promise<Response> {
  const sessionResult = await requireRiskSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const asOfDate = new URL(request.url).searchParams.get("asOfDate") ?? undefined;
    const data = await calendarService.getUnitEta(sessionResult.session, carId, {
      asOfDate,
    });
    return withCors(
      request,
      Response.json({
        success: true,
        message: "Unit ETA ready",
        data,
      }),
    );
  } catch (error) {
    if (error instanceof Error && error.message === "UNIT_NOT_FOUND") {
      return errorResponse(request, "Unit tidak ditemukan.", 404, "UNIT_NOT_FOUND");
    }

    return errorResponse(
      request,
      "Terjadi kesalahan internal pada planning engine.",
      500,
      "PLANNING_FAILED",
    );
  }
}

export async function handleDeliveryRiskRoute(
  request: Request,
  authService: AuthService,
  calendarService: CalendarService,
): Promise<Response> {
  const sessionResult = await requireRiskSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const url = new URL(request.url);
    const result = await calendarService.listDeliveryRisk(
      sessionResult.session,
      parseGridQueryParams(url.searchParams),
      url.searchParams.get("asOfDate") ?? undefined,
    );

    return withCors(
      request,
      Response.json({
        success: true,
        message: "Delivery risk ready",
        data: result.data,
        meta: result.meta,
        query: result.query,
        summary: result.summary,
      }),
    );
  } catch {
    return errorResponse(
      request,
      "Terjadi kesalahan internal pada planning engine.",
      500,
      "PLANNING_FAILED",
    );
  }
}
