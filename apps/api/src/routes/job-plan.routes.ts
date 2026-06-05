import {
  bulkCreateJobPlanRequestSchema,
  createJobPlanRequestSchema,
  createJobPlanWorkspaceRequestSchema,
  deleteJobPlanDraftRequestSchema,
  jobPlanExportFormatSchema,
  saveJobPlanDraftRequestSchema,
  submitJobPlanDraftRequestSchema,
  updateJobPlanRequestSchema,
  updateJobPlanStatusRequestSchema,
} from "@smsystem/contracts/job-plan";
import { permissionCodes } from "@smsystem/permissions";
import { parseJsonBody } from "@/http/request";
import { errorResponse, successResponse, withCors } from "@/http/response";
import { requireSession } from "@/middleware/auth.middleware";
import { requirePermission } from "@/middleware/permission.middleware";
import type { AuthService } from "@/services/auth/auth.service";
import type { JobPlanService } from "@/services/job-plan.service";
import { sanitizeJobPlanGridQuery } from "@/services/job-plan/query";
import { applyDefaultDivisionIdFilter } from "@/services/grid/division-default";

async function requireJobPlanSession(
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

function mapJobPlanError(request: Request, error: unknown): Response {
  console.error("[mapJobPlanError] Captured error:", error);
  if (error instanceof Error) {
    if (error.message === "PLAN_NOT_FOUND" || error.message === "COUNTDOWN_NOT_FOUND") {
      return errorResponse(request, "Data job plan tidak ditemukan.", 404, error.message);
    }

    if (error.message === "WORK_ORDER_COUNTDOWN_NOT_FOUND") {
      return errorResponse(
        request,
        "Countdown dari WO belum tersedia. Approve WO terlebih dahulu.",
        404,
        "WORK_ORDER_COUNTDOWN_NOT_FOUND",
      );
    }

    if (error.message === "CAPACITY_EXCEEDED") {
      return errorResponse(
        request,
        "Jam kerja PIC melebihi kapasitas tersisa.",
        400,
        "CAPACITY_EXCEEDED",
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

    if (error.message === "PANEL_LOCKED") {
      return errorResponse(
        request,
        "Panel sedang dikunci oleh divisi lain.",
        409,
        "PANEL_LOCKED",
      );
    }

    if (error.message === "INVALID_STATUS_TRANSITION") {
      return errorResponse(
        request,
        "Transisi status job plan tidak valid.",
        400,
        "INVALID_STATUS_TRANSITION",
      );
    }

    if (error.message === "PLAN_LOCKED") {
      return errorResponse(
        request,
        "Job plan sudah terkunci oleh SPK aktif dan tidak dapat diubah.",
        409,
        "PLAN_LOCKED",
      );
    }

    if (error.message === "PLAN_DELETE_FORBIDDEN") {
      return errorResponse(
        request,
        "Job plan yang sudah masuk approval tidak bisa dihapus dari layar ini.",
        400,
        "PLAN_DELETE_FORBIDDEN",
      );
    }

    if (error.message === "PLAN_EDIT_FORBIDDEN") {
      return errorResponse(
        request,
        "Job plan yang sudah masuk approval tidak bisa diubah dari layar ini.",
        400,
        "PLAN_EDIT_FORBIDDEN",
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

    if (error.message === "ADDITIONAL_REFERENCE_INCOMPLETE") {
      return errorResponse(
        request,
        "Data sumber tambahan belum lengkap. Pilih unit, panel, dan jobdesc tambahan.",
        400,
        "ADDITIONAL_REFERENCE_INCOMPLETE",
      );
    }

    if (error.message === "PROJECT_TARGET_INVALID") {
      return errorResponse(
        request,
        "Target project harus memakai format HHH:MM.",
        400,
        "PROJECT_TARGET_INVALID",
      );
    }

    if (error.message === "PROJECT_DEADLINE_INVALID") {
      return errorResponse(
        request,
        "Deadline project tidak boleh lebih awal dari tanggal kerja.",
        400,
        "PROJECT_DEADLINE_INVALID",
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
  const sessionResult = await requireJobPlanSession(request, authService);
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

export async function handleJobPlanTodayRoute(
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
  const sessionResult = await requireJobPlanSession(request, authService);
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
  const sessionResult = await requireJobPlanSession(request, authService);
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

export async function handleJobPlanCreateRoute(
  request: Request,
  authService: AuthService,
  jobPlanService: JobPlanService,
): Promise<Response> {
  const sessionResult = await requireJobPlanSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  const parsedBody = await parseJsonBody(request, createJobPlanRequestSchema);
  if (!parsedBody.success) {
    return parsedBody.response;
  }

  try {
    const result = await jobPlanService.create(sessionResult.session, parsedBody.data);
    return successResponse(request, "Job plan berhasil dibuat.", { ...result }, {
      status: 201,
    });
  } catch (error) {
    return mapJobPlanError(request, error);
  }
}

export async function handleJobPlanBulkCreateRoute(
  request: Request,
  authService: AuthService,
  jobPlanService: JobPlanService,
): Promise<Response> {
  const sessionResult = await requireJobPlanSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  const parsedBody = await parseJsonBody(request, bulkCreateJobPlanRequestSchema);
  if (!parsedBody.success) {
    return parsedBody.response;
  }

  try {
    const result = await jobPlanService.bulkCreate(
      sessionResult.session,
      parsedBody.data,
    );
    return successResponse(request, "Bulk job plan berhasil dibuat.", { ...result }, {
      status: 201,
    });
  } catch (error) {
    return mapJobPlanError(request, error);
  }
}

export async function handleJobPlanWorkspaceCreateRoute(
  request: Request,
  authService: AuthService,
  jobPlanService: JobPlanService,
): Promise<Response> {
  const sessionResult = await requireJobPlanSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  const parsedBody = await parseJsonBody(request, createJobPlanWorkspaceRequestSchema);
  if (!parsedBody.success) {
    return parsedBody.response;
  }

  try {
    const result = await jobPlanService.createWorkspace(
      sessionResult.session,
      parsedBody.data,
    );
    return withCors(
      request,
      Response.json({
        success: true,
        message: "Job plan workspace berhasil disimpan",
        data: result,
      }),
    );
  } catch (error) {
    return mapJobPlanError(request, error);
  }
}

export async function handleJobPlanDraftSaveRoute(
  request: Request,
  authService: AuthService,
  jobPlanService: JobPlanService,
): Promise<Response> {
  const sessionResult = await requireJobPlanSession(request, authService);
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

export async function handleJobPlanDraftSubmitRoute(
  request: Request,
  authService: AuthService,
  jobPlanService: JobPlanService,
): Promise<Response> {
  const sessionResult = await requireJobPlanSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  const parsedBody = await parseJsonBody(request, submitJobPlanDraftRequestSchema);
  if (!parsedBody.success) {
    return parsedBody.response;
  }

  try {
    const result = await jobPlanService.submitDrafts(
      sessionResult.session,
      parsedBody.data,
    );
    return successResponse(request, "Draft job plan berhasil dikirim ke approval.", { ...result });
  } catch (error) {
    return mapJobPlanError(request, error);
  }
}

export async function handleJobPlanDraftDeleteRoute(
  request: Request,
  authService: AuthService,
  jobPlanService: JobPlanService,
): Promise<Response> {
  const sessionResult = await requireJobPlanSession(request, authService);
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

export async function handleJobPlanUpdateRoute(
  request: Request,
  planId: string,
  authService: AuthService,
  jobPlanService: JobPlanService,
): Promise<Response> {
  const sessionResult = await requireJobPlanSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  const parsedBody = await parseJsonBody(request, updateJobPlanRequestSchema);
  if (!parsedBody.success) {
    return parsedBody.response;
  }

  try {
    const result = await jobPlanService.update(
      sessionResult.session,
      planId,
      parsedBody.data,
    );
    return successResponse(request, "Job plan berhasil diupdate.", { ...result });
  } catch (error) {
    return mapJobPlanError(request, error);
  }
}

export async function handleJobPlanStatusRoute(
  request: Request,
  planId: string,
  authService: AuthService,
  jobPlanService: JobPlanService,
): Promise<Response> {
  const sessionResult = await requireJobPlanSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  const parsedBody = await parseJsonBody(request, updateJobPlanStatusRequestSchema);
  if (!parsedBody.success) {
    return parsedBody.response;
  }

  try {
    const result = await jobPlanService.updateStatus(
      sessionResult.session,
      planId,
      parsedBody.data,
    );
    return successResponse(request, "Status job plan berhasil diupdate.", { ...result });
  } catch (error) {
    return mapJobPlanError(request, error);
  }
}

export async function handleJobPlanDeleteRoute(
  request: Request,
  planId: string,
  authService: AuthService,
  jobPlanService: JobPlanService,
): Promise<Response> {
  const sessionResult = await requireJobPlanSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const result = await jobPlanService.delete(sessionResult.session, planId);
    return successResponse(request, "Job plan berhasil dihapus.", { ...result });
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
