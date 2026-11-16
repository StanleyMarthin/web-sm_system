import {
  createJobPlanAdditionalCountdownRequestSchema,
  deleteJobPlanDraftRequestSchema,
  jobPlanExportFormatSchema,
  jobPlanOptionKindSchema,
  saveJobPlanDraftRequestSchema,
} from "@smsystem/contracts/job-plan";
import { permissionCodes } from "@smsystem/permissions";
import { parseJsonBody } from "@/http/request";
import { errorResponse, successResponse, withCors } from "@/http/response";
import { requireSession } from "@/middleware/auth.middleware";
import { requirePermission } from "@/middleware/permission.middleware";
import type { AuthService } from "@/services/auth/auth.service";
import type { JobPlanService } from "@/services/job-plan/job-plan.service";
import { sanitizeJobPlanGridQuery } from "@/services/job-plan/query";
import { applyDefaultDivisionIdFilter } from "@/services/grid/division-default";

async function requireJobPlanSession(
  request: Request,
  authService: AuthService,
  allowTaskAccess = false,
) {
  const sessionResult = await requireSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult;
  }

  if (allowTaskAccess && sessionResult.session.user.permissions.some((code) =>
    code === permissionCodes.createTask || code === permissionCodes.taskSubmit || code === permissionCodes.taskCheckpoint ||
    code === permissionCodes.taskExecute || code === permissionCodes.reviewTask
    || (request.method === "GET" && code === permissionCodes.taskView))) {
    return { session: sessionResult.session };
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

function mapJobPlanError(request: Request, error: unknown): Response {
  console.error("[mapJobPlanError] Captured error:", error);
  if (error instanceof Error) {
    if (error.message === "QC_REWORK_DRAFT_LINKED") {
      return errorResponse(request, "Batalkan draft operasional sebelum menghapus draft rework.", 409, error.message);
    }
    if (error.message === "UNIT_ON_HOLD") return errorResponse(request, "Unit sedang HOLD. Plan atau jobdesc baru tidak dapat dibuat.", 409, "UNIT_ON_HOLD");
    if (error.message === "COUNTDOWN_NOT_FOUND") {
      return errorResponse(request, "Data job plan tidak ditemukan.", 404, error.message);
    }

    if (error.message === "ADDITIONAL_REFERENCE_INCOMPLETE") {
      return errorResponse(
        request,
        "Referensi jobdesc tambahan tidak lengkap atau tidak sesuai divisi.",
        400,
        "ADDITIONAL_REFERENCE_INCOMPLETE",
      );
    }

    if (error.message === "JOB_TYPE_CLASSIFICATION_MISMATCH") {
      return errorResponse(
        request,
        "Jobdesc yang dipilih terdaftar sebagai teknis. Pilih jobdesc nonteknis atau gunakan nama aktivitas baru.",
        409,
        "JOB_TYPE_CLASSIFICATION_MISMATCH",
      );
    }

    if (error.message === "COUNTDOWN_CAPACITY_EXCEEDED") {
      return errorResponse(
        request,
        "Target jam melebihi kapasitas countdown yang tersedia.",
        400,
        "COUNTDOWN_CAPACITY_EXCEEDED",
      );
    }

    if (error.message === "SCOPE_FORBIDDEN") {
      return errorResponse(
        request,
        "Aksi di luar scope job plan user aktif.",
        403,
        "SCOPE_FORBIDDEN",
      );
    }

    if (error.message === "DRAFT_NOT_FOUND") {
      return errorResponse(
        request,
        "Draft job plan tidak ditemukan atau sudah berubah.",
        404,
        "DRAFT_NOT_FOUND",
      );
    }

  }

  return errorResponse(
    request,
    "Terjadi kesalahan internal pada job plan module.",
    500,
    "JOB_PLAN_FAILED",
  );
}

export async function handleJobPlanListRoute(
  request: Request,
  authService: AuthService,
  jobPlanService: JobPlanService,
): Promise<Response> {
  const sessionResult = await requireJobPlanSession(request, authService, true);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const query = applyDefaultDivisionIdFilter(
      sessionResult.session,
      sanitizeJobPlanGridQuery(new URL(request.url).searchParams),
    );
    const result = await jobPlanService.list(sessionResult.session, query);

    return withCors(
      request,
      Response.json({
        success: true,
        message: "Job plan grid ready",
        data: result.data,
        meta: result.meta,
        references: result.references,
        query: result.query,
        summary: result.summary,
      }),
    );
  } catch (error) {
    return mapJobPlanError(request, error);
  }
}

function parsePositiveIntParam(searchParams: URLSearchParams, key: string): number | null {
  const value = searchParams.get(key);
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function handleJobPlanOptionsRoute(
  request: Request,
  kindParam: string,
  authService: AuthService,
  jobPlanService: JobPlanService,
): Promise<Response> {
  const sessionResult = await requireJobPlanSession(request, authService, true);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  const kind = jobPlanOptionKindSchema.safeParse(kindParam);
  if (!kind.success) {
    return errorResponse(request, "Jenis opsi job plan tidak valid.", 400, "INVALID_JOB_PLAN_OPTION");
  }

  try {
    const searchParams = new URL(request.url).searchParams;
    const result = await jobPlanService.listOptions(sessionResult.session, {
      kind: kind.data,
      divisionId: parsePositiveIntParam(searchParams, "divisionId"),
      unitId: searchParams.get("unitId") || null,
      panelId: parsePositiveIntParam(searchParams, "panelId"),
      componentName: searchParams.get("componentName")?.trim() || null,
    });

    return withCors(
      request,
      Response.json({
        success: true,
        message: "Opsi job plan siap",
        data: result,
      }),
    );
  } catch (error) {
    return mapJobPlanError(request, error);
  }
}

export async function handleJobPlanTodayRoute(
  request: Request,
  authService: AuthService,
  jobPlanService: JobPlanService,
): Promise<Response> {
  const sessionResult = await requireJobPlanSession(request, authService, true);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const query = applyDefaultDivisionIdFilter(
      sessionResult.session,
      sanitizeJobPlanGridQuery(new URL(request.url).searchParams),
    );
    const result = await jobPlanService.listToday(sessionResult.session, query);

    return withCors(
      request,
      Response.json({
        success: true,
        message: "Job plan hari ini siap",
        data: result.data,
        meta: result.meta,
        references: result.references,
        query: result.query,
        summary: result.summary,
      }),
    );
  } catch (error) {
    return mapJobPlanError(request, error);
  }
}

export async function handleJobPlanMyDivisionRoute(
  request: Request,
  authService: AuthService,
  jobPlanService: JobPlanService,
): Promise<Response> {
  const sessionResult = await requireJobPlanSession(request, authService, true);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const query = applyDefaultDivisionIdFilter(
      sessionResult.session,
      sanitizeJobPlanGridQuery(new URL(request.url).searchParams),
    );
    const result = await jobPlanService.listMyDivision(sessionResult.session, query);

    return withCors(
      request,
      Response.json({
        success: true,
        message: "Job plan divisi aktif siap",
        data: result.data,
        meta: result.meta,
        references: result.references,
        query: result.query,
        summary: result.summary,
      }),
    );
  } catch (error) {
    return mapJobPlanError(request, error);
  }
}

export async function handleJobPlanPicLoadRoute(
  request: Request,
  authService: AuthService,
  jobPlanService: JobPlanService,
): Promise<Response> {
  const sessionResult = await requireJobPlanSession(request, authService, true);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  const url = new URL(request.url);
  const employeeId = url.searchParams.get("employeeId")?.trim() ?? "";
  const taskDate = url.searchParams.get("taskDate")?.trim() ?? "";
  if (!employeeId || !taskDate) {
    return errorResponse(
      request,
      "employeeId dan taskDate wajib diisi.",
      400,
      "INVALID_QUERY",
    );
  }

  try {
    const result = await jobPlanService.picLoad(
      sessionResult.session,
      employeeId,
      taskDate,
    );
    return successResponse(request, "PIC load ditemukan", result);
  } catch (error) {
    return mapJobPlanError(request, error);
  }
}

export async function handleJobPlanAdditionalCountdownCreateRoute(
  request: Request,
  authService: AuthService,
  jobPlanService: JobPlanService,
): Promise<Response> {
  const sessionResult = await requireJobPlanSession(request, authService, true);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  const parsedBody = await parseJsonBody(request, createJobPlanAdditionalCountdownRequestSchema);
  if (!parsedBody.success) {
    return parsedBody.response;
  }

  try {
    const result = await jobPlanService.createAdditionalCountdown(
      sessionResult.session,
      parsedBody.data,
    );
    return successResponse(request, "Countdown tambahan berhasil dibuat.", { ...result }, {
      status: 201,
    });
  } catch (error) {
    return mapJobPlanError(request, error);
  }
}

export async function handleJobPlanDraftSaveRoute(
  request: Request,
  authService: AuthService,
  jobPlanService: JobPlanService,
): Promise<Response> {
  const sessionResult = await requireJobPlanSession(request, authService, true);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  const parsedBody = await parseJsonBody(request, saveJobPlanDraftRequestSchema);
  if (!parsedBody.success) {
    return parsedBody.response;
  }

  try {
    const result = await jobPlanService.saveDraft(sessionResult.session, parsedBody.data);
    return successResponse(request, "Draft job plan berhasil disimpan.", { ...result }, {
      status: 201,
    });
  } catch (error) {
    return mapJobPlanError(request, error);
  }
}

export async function handleJobPlanDraftDeleteRoute(
  request: Request,
  authService: AuthService,
  jobPlanService: JobPlanService,
): Promise<Response> {
  const sessionResult = await requireJobPlanSession(request, authService, true);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  const parsedBody = await parseJsonBody(request, deleteJobPlanDraftRequestSchema);
  if (!parsedBody.success) {
    return parsedBody.response;
  }

  try {
    const result = await jobPlanService.deleteDrafts(
      sessionResult.session,
      parsedBody.data,
    );
    return successResponse(request, "Draft job plan berhasil dihapus.", { ...result });
  } catch (error) {
    return mapJobPlanError(request, error);
  }
}

export async function handleJobPlanExportRoute(
  request: Request,
  authService: AuthService,
  jobPlanService: JobPlanService,
): Promise<Response> {
  const sessionResult = await requireJobPlanSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const query = applyDefaultDivisionIdFilter(
      sessionResult.session,
      sanitizeJobPlanGridQuery(new URL(request.url).searchParams),
    );
    const format = jobPlanExportFormatSchema.parse(
      new URL(request.url).searchParams.get("format") ?? "csv",
    );
    const exportResult = await jobPlanService.exportFile(
      sessionResult.session,
      query,
      format,
    );
    const responseBody =
      typeof exportResult.body === "string"
        ? exportResult.body
        : new Uint8Array(exportResult.body).buffer;
    return withCors(
      request,
      new Response(responseBody, {
        status: 200,
        headers: {
          "Content-Type": exportResult.contentType,
          "Content-Disposition": `attachment; filename="${exportResult.fileName}"`,
        },
      }),
    );
  } catch (error) {
    return mapJobPlanError(request, error);
  }
}
