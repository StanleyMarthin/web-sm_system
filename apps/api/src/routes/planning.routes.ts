import { z } from "zod";
import {
  planDivisionInputSchema,
  planOvertimeSchema,
  planUnitSchema,
  weeklyPlanRequestSchema,
} from "@smsystem/contracts/calendar";
import { permissionCodes } from "@smsystem/permissions";
import { parseJsonBody } from "@/http/request";
import { errorResponse, withCors } from "@/http/response";
import { TtlCache } from "@/lib/ttl-cache";
import { requireSession } from "@/middleware/auth.middleware";
import { requireAnyPermission, requirePermission } from "@/middleware/permission.middleware";
import type { AuthService } from "@/services/auth/auth.service";
import type { WebSession } from "@/services/auth/session.service";
import type { WeeklyPlanningService } from "@/services/planning.service";

const planOvertimeRequestSchema = z.object({
  rows: z.array(planOvertimeSchema),
});

const planDivisionRequestSchema = z.object({
  rows: z.array(planDivisionInputSchema),
});

const planUnitRequestSchema = z.object({
  rows: z.array(planUnitSchema),
});

interface WeeklyPlanDetailPayload {
  message: string;
  data: {
    plan: Awaited<ReturnType<WeeklyPlanningService["getPlanByWeek"]>>;
    capacity: Awaited<ReturnType<WeeklyPlanningService["getCapacityCache"]>>;
    gap: Awaited<ReturnType<WeeklyPlanningService["computeGap"]>>;
    alerts: Awaited<ReturnType<WeeklyPlanningService["generateAlerts"]>>;
    recommendations: Awaited<ReturnType<WeeklyPlanningService["getRecommendations"]>> | null;
    overtime: Awaited<ReturnType<WeeklyPlanningService["listPlanOvertime"]>>;
    divisionInputs: Awaited<ReturnType<WeeklyPlanningService["listPlanDivisionInputs"]>>;
    units: Awaited<ReturnType<WeeklyPlanningService["listPlanUnits"]>>;
    planningUnits: Awaited<ReturnType<WeeklyPlanningService["listPlanningUnitsForWeek"]>>;
  };
}

const WEEKLY_PLAN_DETAIL_CACHE_TTL_MS = 5_000;
const weeklyPlanDetailCache = new TtlCache<WeeklyPlanDetailPayload>(
  WEEKLY_PLAN_DETAIL_CACHE_TTL_MS,
);

function buildWeeklyPlanDetailCacheKey(session: WebSession, weekStartDate: string): string {
  return JSON.stringify({
    employeeId: session.user.employeeId,
    scope: session.user.scope,
    weekStartDate,
  });
}

async function loadWeeklyPlanDetailPayload(
  session: WebSession,
  weekStartDate: string,
  planningService: WeeklyPlanningService,
): Promise<WeeklyPlanDetailPayload> {
  const plan = await planningService.getPlanByWeek(weekStartDate);
  if (!plan) {
    const planningUnits = await planningService.listPlanningUnitsForWeek(
      session,
      weekStartDate,
    );
    return {
      message: "Belum ada rencana mingguan pada tanggal ini.",
      data: {
        plan: null,
        capacity: [],
        gap: {
          targetHours: 0,
          totalNetCapacity: 0,
          deficit: 0,
          byDivision: [],
        },
        alerts: [],
        recommendations: null,
        overtime: [],
        divisionInputs: [],
        units: [],
        planningUnits,
      },
    };
  }

  let capacity = await planningService.getCapacityCache(plan.planId);
  if (capacity.length === 0) {
    capacity = await planningService.recomputeCapacity(plan.planId);
  }

  const [gap, alerts, recommendations, overtime, divisionInputs, units, planningUnits] = await Promise.all([
    planningService.computeGap(plan.planId),
    planningService.generateAlerts(session, plan.planId),
    planningService.getRecommendations(session, plan.planId),
    planningService.listPlanOvertime(plan.planId),
    planningService.listPlanDivisionInputs(plan.planId),
    planningService.listPlanUnits(plan.planId),
    planningService.listPlanningUnitsForWeek(session, plan.weekStartDate),
  ]);

  return {
    message: "Rencana mingguan siap.",
    data: {
      plan,
      capacity,
      gap,
      alerts,
      recommendations,
      overtime,
      divisionInputs,
      units,
      planningUnits,
    },
  };
}

async function requirePlanningWriteSession(request: Request, authService: AuthService) {
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

async function requirePlanningReadSession(request: Request, authService: AuthService) {
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

function mapPlanningError(request: Request, error: unknown): Response {
  if (error instanceof Error && error.message === "WEEK_START_MUST_BE_MONDAY") {
    return errorResponse(
      request,
      "Awal minggu harus hari Senin.",
      400,
      "WEEK_START_MUST_BE_MONDAY",
    );
  }

  if (error instanceof Error && error.message === "WEEKLY_PLAN_NOT_FOUND") {
    return errorResponse(
      request,
      "Rencana mingguan tidak ditemukan.",
      404,
      "WEEKLY_PLAN_NOT_FOUND",
    );
  }

  if (error instanceof Error && error.message === "PLANNING_UNITS_EMPTY") {
    return errorResponse(
      request,
      "Target unit minggu ini belum diisi, jadi draft SPK belum bisa dibuat.",
      400,
      "PLANNING_UNITS_EMPTY",
    );
  }

  return errorResponse(
    request,
    "Terjadi kesalahan internal pada weekly planning.",
    500,
    "PLANNING_FAILED",
  );
}

export async function handleWeeklyPlanUpsertRoute(
  request: Request,
  authService: AuthService,
  planningService: WeeklyPlanningService,
): Promise<Response> {
  const sessionResult = await requirePlanningWriteSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  const bodyResult = await parseJsonBody(request, weeklyPlanRequestSchema);
  if (!bodyResult.success) {
    return withCors(request, bodyResult.response);
  }

  try {
    const data = await planningService.upsertPlan(sessionResult.session, bodyResult.data);
    weeklyPlanDetailCache.clear();
    return withCors(
      request,
      Response.json({
        success: true,
        message: "Rencana mingguan berhasil disimpan.",
        data,
      }),
    );
  } catch (error) {
    return mapPlanningError(request, error);
  }
}

export async function handleWeeklyPlanDetailRoute(
  request: Request,
  weekStart: string,
  authService: AuthService,
  planningService: WeeklyPlanningService,
): Promise<Response> {
  const sessionResult = await requirePlanningReadSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const result = await weeklyPlanDetailCache.getOrCreate(
      buildWeeklyPlanDetailCacheKey(sessionResult.session, weekStart),
      () =>
        loadWeeklyPlanDetailPayload(
          sessionResult.session,
          weekStart,
          planningService,
        ),
    );

    return withCors(
      request,
      Response.json({
        success: true,
        message: result.message,
        data: result.data,
      }),
    );
  } catch (error) {
    return mapPlanningError(request, error);
  }
}

export async function handleWeeklyPlanOvertimeRoute(
  request: Request,
  planId: string,
  authService: AuthService,
  planningService: WeeklyPlanningService,
): Promise<Response> {
  const sessionResult = await requirePlanningWriteSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  const bodyResult = await parseJsonBody(request, planOvertimeRequestSchema);
  if (!bodyResult.success) {
    return withCors(request, bodyResult.response);
  }

  try {
    await planningService.setOvertime(sessionResult.session, planId, bodyResult.data.rows);
    const capacity = await planningService.recomputeCapacity(planId);
    weeklyPlanDetailCache.clear();
    return withCors(
      request,
      Response.json({
        success: true,
        message: "Rencana lembur berhasil disimpan.",
        data: capacity,
      }),
    );
  } catch (error) {
    return mapPlanningError(request, error);
  }
}

export async function handleWeeklyPlanDivisionRoute(
  request: Request,
  planId: string,
  authService: AuthService,
  planningService: WeeklyPlanningService,
): Promise<Response> {
  const sessionResult = await requirePlanningWriteSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  const bodyResult = await parseJsonBody(request, planDivisionRequestSchema);
  if (!bodyResult.success) {
    return withCors(request, bodyResult.response);
  }

  try {
    await planningService.setDivisionInputs(sessionResult.session, planId, bodyResult.data.rows);
    const capacity = await planningService.recomputeCapacity(planId);
    weeklyPlanDetailCache.clear();
    return withCors(
      request,
      Response.json({
        success: true,
        message: "Jumlah anggota per divisi berhasil disimpan.",
        data: capacity,
      }),
    );
  } catch (error) {
    return mapPlanningError(request, error);
  }
}

export async function handleWeeklyPlanUnitsRoute(
  request: Request,
  planId: string,
  authService: AuthService,
  planningService: WeeklyPlanningService,
): Promise<Response> {
  const sessionResult = await requirePlanningWriteSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  const bodyResult = await parseJsonBody(request, planUnitRequestSchema);
  if (!bodyResult.success) {
    return withCors(request, bodyResult.response);
  }

  try {
    await planningService.setUnitAllocations(sessionResult.session, planId, bodyResult.data.rows);
    const capacity = await planningService.recomputeCapacity(planId);
    weeklyPlanDetailCache.clear();
    return withCors(
      request,
      Response.json({
        success: true,
        message: "Alokasi unit berhasil disimpan.",
        data: capacity,
      }),
    );
  } catch (error) {
    return mapPlanningError(request, error);
  }
}

export async function handleWeeklyPlanSnapshotAbsenceRoute(
  request: Request,
  planId: string,
  authService: AuthService,
  planningService: WeeklyPlanningService,
): Promise<Response> {
  const sessionResult = await requirePlanningWriteSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const result = await planningService.snapshotAbsence(sessionResult.session, planId);
    weeklyPlanDetailCache.clear();
    return withCors(
      request,
      Response.json({
        success: true,
        message: "Snapshot absensi berhasil dibuat.",
        data: result,
      }),
    );
  } catch (error) {
    return mapPlanningError(request, error);
  }
}

export async function handleWeeklyPlanPublishRoute(
  request: Request,
  planId: string,
  authService: AuthService,
  planningService: WeeklyPlanningService,
): Promise<Response> {
  const sessionResult = await requirePlanningWriteSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const data = await planningService.publishPlan(sessionResult.session, planId);
    weeklyPlanDetailCache.clear();
    return withCors(
      request,
      Response.json({
        success: true,
        message: "Rencana mingguan berhasil dipublish dan draft SPK sudah dibuat.",
        data,
      }),
    );
  } catch (error) {
    return mapPlanningError(request, error);
  }
}

export async function handleWeeklyPlanGapRoute(
  request: Request,
  planId: string,
  authService: AuthService,
  planningService: WeeklyPlanningService,
): Promise<Response> {
  const sessionResult = await requirePlanningReadSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const data = await planningService.computeGap(planId);
    return withCors(
      request,
      Response.json({
        success: true,
        message: "Gap kapasitas mingguan siap.",
        data,
      }),
    );
  } catch (error) {
    return mapPlanningError(request, error);
  }
}

export async function handleWeeklyPlanAlertsRoute(
  request: Request,
  planId: string,
  authService: AuthService,
  planningService: WeeklyPlanningService,
): Promise<Response> {
  const sessionResult = await requirePlanningReadSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const data = await planningService.generateAlerts(sessionResult.session, planId);
    return withCors(
      request,
      Response.json({
        success: true,
        message: "Alert weekly planning siap.",
        data,
      }),
    );
  } catch (error) {
    return mapPlanningError(request, error);
  }
}
