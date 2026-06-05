import {
  createTargetBodySchema,
  overtimeRecommendationBodySchema,
  releaseSpkBodySchema,
} from "@smsystem/contracts/planning-work-control";
import { permissionCodes } from "@smsystem/permissions";
import { parseJsonBody } from "@/http/request";
import { errorResponse, withCors } from "@/http/response";
import { requireSession } from "@/middleware/auth.middleware";
import { requireAnyPermission, requirePermission } from "@/middleware/permission.middleware";
import type { AuthService } from "@/services/auth/auth.service";
import type { PlanningWorkControlService } from "@/services/planning-work-control.service";

async function requirePlanningWorkControlReadSession(
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

async function requirePlanningWorkControlWriteSession(
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

function parseDivisionIds(value: string | null): number[] {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((item) => Number.parseInt(item.trim(), 10))
    .filter((item) => Number.isFinite(item) && item > 0);
}

function mapWorkControlError(request: Request, error: unknown): Response {
  if (error instanceof Error && error.message === "PLANNING_TARGET_NOT_FOUND") {
    return errorResponse(
      request,
      "Target planning tidak ditemukan.",
      404,
      "PLANNING_TARGET_NOT_FOUND",
    );
  }

  if (error instanceof Error && error.message === "PLANNING_TARGET_EMPTY") {
    return errorResponse(
      request,
      "Target planning belum memiliki unit untuk dirilis.",
      400,
      "PLANNING_TARGET_EMPTY",
    );
  }

  return errorResponse(
    request,
    "Work Control Planning belum bisa diproses saat ini.",
    500,
    "PLANNING_WORK_CONTROL_FAILED",
  );
}

export async function handleWorkControlUnitsRoute(
  request: Request,
  authService: AuthService,
  workControlService: PlanningWorkControlService,
): Promise<Response> {
  const sessionResult = await requirePlanningWorkControlReadSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const data = await workControlService.listUnits(sessionResult.session);
    return withCors(
      request,
      Response.json({
        success: true,
        message: "Unit Work Control siap.",
        data,
      }),
    );
  } catch (error) {
    return mapWorkControlError(request, error);
  }
}

export async function handleWorkControlUnitProgressRoute(
  request: Request,
  unitId: string,
  authService: AuthService,
  workControlService: PlanningWorkControlService,
): Promise<Response> {
  const sessionResult = await requirePlanningWorkControlReadSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const data = await workControlService.getUnitProgress(
      sessionResult.session,
      unitId,
    );
    if (!data) {
      return errorResponse(
        request,
        "Unit tidak ditemukan atau tidak bisa diakses.",
        404,
        "WORK_CONTROL_UNIT_NOT_FOUND",
      );
    }

    return withCors(
      request,
      Response.json({
        success: true,
        message: "Progress unit siap.",
        data,
      }),
    );
  } catch (error) {
    return mapWorkControlError(request, error);
  }
}

export async function handleWorkControlCapacityRoute(
  request: Request,
  authService: AuthService,
  workControlService: PlanningWorkControlService,
): Promise<Response> {
  const sessionResult = await requirePlanningWorkControlReadSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  const url = new URL(request.url);
  const periodStart = url.searchParams.get("periodStart")?.trim();
  const periodEnd = url.searchParams.get("periodEnd")?.trim();
  if (!periodStart || !periodEnd) {
    return errorResponse(
      request,
      "Periode kapasitas wajib diisi.",
      400,
      "WORK_CONTROL_PERIOD_REQUIRED",
    );
  }

  try {
    const data = await workControlService.getCapacity({
      periodStart,
      periodEnd,
      divisionIds: parseDivisionIds(url.searchParams.get("divisionIds")),
      employeeId: sessionResult.session.user.employeeId,
      scope: sessionResult.session.user.scope,
    });
    return withCors(
      request,
      Response.json({
        success: true,
        message: "Kapasitas divisi siap.",
        data,
      }),
    );
  } catch (error) {
    return mapWorkControlError(request, error);
  }
}

export async function handleWorkControlOvertimeRecommendationListRoute(
  request: Request,
  authService: AuthService,
  workControlService: PlanningWorkControlService,
): Promise<Response> {
  const sessionResult = await requirePlanningWorkControlReadSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  const url = new URL(request.url);
  const periodStart = url.searchParams.get("periodStart")?.trim();
  const periodEnd = url.searchParams.get("periodEnd")?.trim();
  if (!periodStart || !periodEnd) {
    return errorResponse(
      request,
      "Periode rekomendasi SPL wajib diisi.",
      400,
      "WORK_CONTROL_PERIOD_REQUIRED",
    );
  }

  try {
    const data = await workControlService.listOvertimeRecommendations(
      sessionResult.session,
      { periodStart, periodEnd },
    );
    return withCors(
      request,
      Response.json({
        success: true,
        message: "Rekomendasi SPL planning siap.",
        data,
      }),
    );
  } catch (error) {
    return mapWorkControlError(request, error);
  }
}

export async function handleWorkControlCreateTargetRoute(
  request: Request,
  authService: AuthService,
  workControlService: PlanningWorkControlService,
): Promise<Response> {
  const sessionResult = await requirePlanningWorkControlWriteSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  const bodyResult = await parseJsonBody(request, createTargetBodySchema);
  if (!bodyResult.success) {
    return withCors(request, bodyResult.response);
  }

  try {
    const data = await workControlService.createTarget(sessionResult.session, bodyResult.data);
    return withCors(
      request,
      Response.json({
        success: true,
        message: "Draft target Work Control berhasil disimpan.",
        data,
      }),
    );
  } catch (error) {
    return mapWorkControlError(request, error);
  }
}

export async function handleWorkControlReleaseSpkRoute(
  request: Request,
  authService: AuthService,
  workControlService: PlanningWorkControlService,
): Promise<Response> {
  const sessionResult = await requirePlanningWorkControlWriteSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  const bodyResult = await parseJsonBody(request, releaseSpkBodySchema);
  if (!bodyResult.success) {
    return withCors(request, bodyResult.response);
  }

  try {
    const data = await workControlService.releaseSpk(
      sessionResult.session,
      bodyResult.data.planningTargetId,
    );
    return withCors(
      request,
      Response.json({
        success: true,
        message: data.message,
        data,
      }),
    );
  } catch (error) {
    return mapWorkControlError(request, error);
  }
}

export async function handleWorkControlOvertimeRecommendationRoute(
  request: Request,
  authService: AuthService,
  workControlService: PlanningWorkControlService,
): Promise<Response> {
  const sessionResult = await requirePlanningWorkControlWriteSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  const bodyResult = await parseJsonBody(request, overtimeRecommendationBodySchema);
  if (!bodyResult.success) {
    return withCors(request, bodyResult.response);
  }

  try {
    const data = await workControlService.createOvertimeRecommendation(bodyResult.data);
    return withCors(
      request,
      Response.json({
        success: true,
        message: "Rekomendasi lembur berhasil dibuat.",
        data,
      }),
    );
  } catch (error) {
    return mapWorkControlError(request, error);
  }
}
