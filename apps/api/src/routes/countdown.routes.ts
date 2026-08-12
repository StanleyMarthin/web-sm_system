import { parseGridQueryParams } from "@smsystem/contracts/grid";
import {
  countdownCreateRequestSchema,
  countdownRevisionDecisionSchema,
  countdownRevisionRequestSchema,
  countdownStatusSchema,
  countdownUpdateRequestSchema,
} from "@smsystem/contracts/countdown";
import { permissionCodes } from "@smsystem/permissions";
import { errorResponse, successResponse, withCors } from "@/http/response";
import { parseJsonBody } from "@/http/request";
import { requireSession } from "@/middleware/auth.middleware";
import { requirePermission } from "@/middleware/permission.middleware";
import type { AuthService } from "@/services/auth/auth.service";
import type { CountdownService } from "@/services/countdown.service";
import type { WebSession } from "@/services/auth/session.service";

function canManageCountdown(session: WebSession): boolean {
  return (
    session.user.scope.canViewAllUnits &&
    session.user.permissions.includes(permissionCodes.updatePlan)
  );
}

async function requireViewCountdownSession(
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
    permissionCodes.viewCountdown,
  );
  if ("response" in permissionResult) {
    return permissionResult;
  }

  return { session: sessionResult.session };
}

async function requireManageCountdownSession(
  request: Request,
  authService: AuthService,
) {
  const sessionResult = await requireSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult;
  }

  if (!canManageCountdown(sessionResult.session)) {
    return {
      response: errorResponse(
        request,
        "Aksi pengelolaan countdown memerlukan akses perencanaan global.",
        403,
        "COUNTDOWN_MANAGE_FORBIDDEN",
      ),
    };
  }

  return { session: sessionResult.session };
}

function mapCountdownError(request: Request, error: unknown): Response {
  if (error instanceof Error) {
    if (error.message === "SCOPE_FORBIDDEN") {
      return errorResponse(
        request,
        "Akses countdown di luar scope user aktif.",
        403,
        "SCOPE_FORBIDDEN",
      );
    }

    if (error.message === "COUNTDOWN_REVISION_FORBIDDEN") {
      return errorResponse(request, "Akses proses revisi ditolak.", 403, "COUNTDOWN_REVISION_FORBIDDEN");
    }

    if (
      error.message === "COUNTDOWN_NOT_FOUND" ||
      error.message === "COUNTDOWN_CAR_NOT_FOUND" ||
      error.message === "COUNTDOWN_DIVISION_NOT_FOUND" ||
      error.message === "COUNTDOWN_PANEL_NOT_FOUND" ||
      error.message === "COUNTDOWN_JOB_TYPE_NOT_FOUND" ||
      error.message === "COUNTDOWN_PREREQUISITE_NOT_FOUND" ||
      error.message === "COUNTDOWN_REF_WO_NOT_FOUND"
    ) {
      return errorResponse(request, "Countdown tidak ditemukan.", 404, "COUNTDOWN_NOT_FOUND");
    }


    if (
      error.message === "COUNTDOWN_REVISION_STATUS_INVALID" ||
      error.message === "COUNTDOWN_REVISION_ALREADY_REQUESTED"
    ) {
      return errorResponse(request, "Status pengajuan revisi tidak valid.", 400, error.message);
    }

    if (error.message === "COUNTDOWN_UNIT_BUDGET_NOT_FOUND") {
      return errorResponse(
        request,
        "Anggaran unit belum tersedia. Atur anggaran sebelum persetujuan MO.",
        409,
        error.message,
      );
    }

    if (
      error.message === "COUNTDOWN_IMPORT_FILE_INVALID" ||
      error.message === "COUNTDOWN_CAR_REQUIRED" ||
      error.message === "COUNTDOWN_DIVISION_REQUIRED" ||
      error.message === "COUNTDOWN_SECTION_REQUIRED" ||
      error.message === "COUNTDOWN_TARGET_HOURS_INVALID" ||
      error.message === "COUNTDOWN_DEADLINE_INVALID" ||
      error.message === "COUNTDOWN_TASK_CATEGORY_INVALID" ||
      error.message === "COUNTDOWN_STATUS_INVALID" ||
      error.message === "COUNTDOWN_PANEL_INVALID"
    ) {
      return errorResponse(
        request,
        "Payload countdown tidak valid.",
        400,
        "COUNTDOWN_INVALID_PAYLOAD",
      );
    }
  }

  return errorResponse(
    request,
    "Terjadi kesalahan internal pada countdown module.",
    500,
    "COUNTDOWN_MODULE_FAILED",
  );
}

export async function handleCountdownListRoute(
  request: Request,
  authService: AuthService,
  countdownService: CountdownService,
): Promise<Response> {
  const sessionResult = await requireViewCountdownSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const query = parseGridQueryParams(new URL(request.url).searchParams);
    const result = await countdownService.list(sessionResult.session, query);

    return withCors(
      request,
      Response.json({
        success: true,
        message: "Countdown board ready",
        data: result.data,
        references: result.references,
        canManage: result.canManage,
        meta: result.meta,
        query: result.query,
      }),
    );
  } catch (error) {
    return mapCountdownError(request, error);
  }
}

export async function handleCountdownDetailRoute(
  request: Request,
  countdownId: string,
  authService: AuthService,
  countdownService: CountdownService,
): Promise<Response> {
  const sessionResult = await requireViewCountdownSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const countdown = await countdownService.detail(sessionResult.session, countdownId);
    if (!countdown) {
      return errorResponse(
        request,
        "Countdown tidak ditemukan.",
        404,
        "COUNTDOWN_NOT_FOUND",
      );
    }

    const { canRequestRevision, canApproveRevision, canApproveMoRevision, ...countdownData } = countdown;
    return withCors(
      request,
      Response.json({
        success: true,
        message: "Countdown detail ready",
        data: {
          countdown: countdownData,
        },
        canManage: canManageCountdown(sessionResult.session),
        canRequestRevision,
        canApproveRevision,
        canApproveMoRevision,
      }),
    );
  } catch (error) {
    return mapCountdownError(request, error);
  }
}

export async function handleCountdownRevisionRequestRoute(
  request: Request,
  countdownId: string,
  authService: AuthService,
  countdownService: CountdownService,
): Promise<Response> {
  const sessionResult = await requireViewCountdownSession(request, authService);
  if ("response" in sessionResult) return sessionResult.response;
  const permissionResult = requirePermission(request, sessionResult.session, permissionCodes.countdownRequestRevision);
  if ("response" in permissionResult) return permissionResult.response;
  const body = await parseJsonBody(request, countdownRevisionRequestSchema);
  if (!body.success) return body.response;
  try {
    const revision = await countdownService.requestRevision(sessionResult.session, countdownId, body.data);
    return successResponse(request, "Pengajuan revisi berhasil dikirim.", { revision });
  } catch (error) {
    return mapCountdownError(request, error);
  }
}

export async function handleCountdownRevisionApprovalRoute(
  request: Request,
  countdownId: string,
  authService: AuthService,
  countdownService: CountdownService,
): Promise<Response> {
  const sessionResult = await requireViewCountdownSession(request, authService);
  if ("response" in sessionResult) return sessionResult.response;
  const permissionResult = requirePermission(request, sessionResult.session, permissionCodes.countdownSubmitApproval);
  if ("response" in permissionResult) return permissionResult.response;
  const body = await parseJsonBody(request, countdownRevisionDecisionSchema);
  if (!body.success) return body.response;
  try {
    const revision = await countdownService.decideRevision(sessionResult.session, countdownId, body.data);
    return successResponse(request, "Keputusan revisi berhasil diproses.", { revision });
  } catch (error) {
    return mapCountdownError(request, error);
  }
}

export async function handleCountdownTemplateRoute(
  request: Request,
  authService: AuthService,
  countdownService: CountdownService,
): Promise<Response> {
  const sessionResult = await requireViewCountdownSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const workbook = await countdownService.buildTemplateWorkbook();

    return withCors(
      request,
      new Response(
        new Blob([Uint8Array.from(workbook)], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
        {
          status: 200,
          headers: {
            "Content-Type":
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Content-Disposition": 'attachment; filename="countdown-template.xlsx"',
          },
        },
      ),
    );
  } catch (error) {
    return mapCountdownError(request, error);
  }
}

export async function handleCountdownDownloadRoute(
  request: Request,
  authService: AuthService,
  countdownService: CountdownService,
): Promise<Response> {
  const sessionResult = await requireViewCountdownSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  const searchParams = new URL(request.url).searchParams;
  const unitId = searchParams.get("unitId")?.trim();
  if (!unitId) {
    return errorResponse(request, "unitId wajib diisi.", 400, "COUNTDOWN_UNIT_REQUIRED");
  }
  const divisionId = searchParams.get("divisionId")?.trim();
  if (
    divisionId &&
    (!/^\d+$/u.test(divisionId) || !Number.isSafeInteger(Number(divisionId)) || Number(divisionId) <= 0)
  ) {
    return errorResponse(request, "divisionId tidak valid.", 400, "COUNTDOWN_DIVISION_INVALID");
  }
  const statusValue = searchParams.get("status")?.trim();
  const status = statusValue ? countdownStatusSchema.safeParse(statusValue) : null;
  if (status && !status.success) {
    return errorResponse(request, "status tidak valid.", 400, "COUNTDOWN_STATUS_INVALID");
  }

  try {
    const workbook = await countdownService.download(sessionResult.session, {
      unitId,
      ...(divisionId ? { divisionId } : {}),
      ...(status?.success ? { status: status.data } : {}),
    });
    return withCors(
      request,
      new Response(new Uint8Array(workbook).buffer, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="countdown-${unitId.replace(/[^a-zA-Z0-9_-]/gu, "_")}.xlsx"`,
        },
      }),
    );
  } catch (error) {
    return mapCountdownError(request, error);
  }
}

export async function handleCountdownCreateRoute(
  request: Request,
  authService: AuthService,
  countdownService: CountdownService,
): Promise<Response> {
  const sessionResult = await requireManageCountdownSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  const parsedBody = await parseJsonBody(request, countdownCreateRequestSchema);
  if (!parsedBody.success) {
    return parsedBody.response;
  }

  try {
    const countdown = await countdownService.create(sessionResult.session, parsedBody.data);
    return withCors(
      request,
      Response.json(
        {
          success: true,
          message: "Countdown berhasil dibuat.",
          data: {
            countdown,
          },
          canManage: true,
        },
        { status: 201 },
      ),
    );
  } catch (error) {
    return mapCountdownError(request, error);
  }
}

export async function handleCountdownUpdateRoute(
  request: Request,
  countdownId: string,
  authService: AuthService,
  countdownService: CountdownService,
): Promise<Response> {
  const sessionResult = await requireManageCountdownSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  const parsedBody = await parseJsonBody(request, countdownUpdateRequestSchema);
  if (!parsedBody.success) {
    return parsedBody.response;
  }

  try {
    const countdown = await countdownService.update(
      sessionResult.session,
      countdownId,
      parsedBody.data,
    );
    if (!countdown) {
      return errorResponse(
        request,
        "Countdown tidak ditemukan.",
        404,
        "COUNTDOWN_NOT_FOUND",
      );
    }

    return withCors(
      request,
      Response.json({
        success: true,
        message: "Countdown berhasil diperbarui.",
        data: {
          countdown,
        },
        canManage: true,
      }),
    );
  } catch (error) {
    return mapCountdownError(request, error);
  }
}

export async function handleCountdownDeleteRoute(
  request: Request,
  countdownId: string,
  authService: AuthService,
  countdownService: CountdownService,
): Promise<Response> {
  const sessionResult = await requireManageCountdownSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const deleted = await countdownService.remove(sessionResult.session, countdownId);
    if (!deleted) {
      return errorResponse(
        request,
        "Countdown tidak ditemukan.",
        404,
        "COUNTDOWN_NOT_FOUND",
      );
    }

    return withCors(
      request,
      Response.json({
        success: true,
        message: "Countdown berhasil dihapus.",
        data: {
          countdownId,
        },
        canManage: true,
      }),
    );
  } catch (error) {
    return mapCountdownError(request, error);
  }
}

export async function handleCountdownImportRoute(
  request: Request,
  authService: AuthService,
  countdownService: CountdownService,
): Promise<Response> {
  const sessionResult = await requireManageCountdownSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  let file: File | null = null;
  let unitId = "";

  try {
    const formData = await request.formData();
    unitId = String(formData.get("unitId") ?? "").trim();
    const candidate = formData.get("file");
    if (candidate instanceof File) {
      file = candidate;
    }
  } catch {
    return errorResponse(
      request,
      "Payload upload tidak valid.",
      400,
      "INVALID_UPLOAD_PAYLOAD",
    );
  }

  if (!unitId) {
    return errorResponse(request, "unitId wajib diisi.", 400, "COUNTDOWN_UNIT_REQUIRED");
  }

  if (!file) {
    return errorResponse(
      request,
      "File upload wajib diisi pada field 'file'.",
      400,
      "FILE_REQUIRED",
    );
  }

  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    return errorResponse(
      request,
      "File import harus berformat .xlsx.",
      400,
      "COUNTDOWN_IMPORT_FILE_INVALID",
    );
  }

  if (file.size <= 0) {
    return errorResponse(
      request,
      "File upload kosong.",
      400,
      "FILE_EMPTY",
    );
  }

  if (file.size > 10 * 1024 * 1024) {
    return errorResponse(
      request,
      "Ukuran file maksimal 10MB.",
      413,
      "FILE_TOO_LARGE",
    );
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const result = await countdownService.importWorkbook(
      sessionResult.session,
      file.name,
      new Uint8Array(arrayBuffer),
      unitId,
    );

    return successResponse(
      request,
      "Import countdown selesai diproses.",
      result,
      { status: 201 },
    );
  } catch (error) {
    return mapCountdownError(request, error);
  }
}
