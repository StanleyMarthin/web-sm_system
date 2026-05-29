import {
  spkDraftDetailUpdateRequestSchema,
  spkGenerateRequestSchema,
  spkItemApprovalRequestSchema,
  spkRejectRequestSchema,
} from "@smsystem/contracts/spk";
import { permissionCodes } from "@smsystem/permissions";
import { parseJsonBody } from "@/http/request";
import { errorResponse, successResponse, withCors } from "@/http/response";
import { requireSession } from "@/middleware/auth.middleware";
import { requirePermission } from "@/middleware/permission.middleware";
import type { AuthService } from "@/services/auth/auth.service";
import type { SpkService } from "@/services/spk.service";
import { sanitizeSpkGridQuery } from "@/services/spk/query";

async function requireSpkReadSession(
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

async function requireSpkWriteSession(
  request: Request,
  authService: AuthService,
) {
  const sessionResult = await requireSpkReadSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult;
  }

  if (!sessionResult.session.user.scope.canViewAllUnits) {
    return {
      response: errorResponse(
        request,
        "Aksi SPK ini membutuhkan scope global.",
        403,
        "SCOPE_FORBIDDEN",
      ),
    };
  }

  return sessionResult;
}

async function requireSpkApprovalRankSession(
  request: Request,
  authService: AuthService,
  minimumRank: number,
) {
  const sessionResult = await requireSpkReadSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult;
  }

  const approvalRank = sessionResult.session.user.roleProfile?.approvalRank ?? 0;
  if (approvalRank < minimumRank) {
    return {
      response: errorResponse(
        request,
        minimumRank >= 3
          ? "Rincian mekanik hanya bisa diubah oleh KP, PM, atau MP."
          : "SPK ini hanya bisa diterima oleh level approval yang sesuai.",
        403,
        minimumRank >= 3 ? "SPK_BREAKDOWN_FORBIDDEN" : "SPK_START_FORBIDDEN",
      ),
    };
  }

  return sessionResult;
}

function mapSpkError(request: Request, error: unknown): Response {
  if (error instanceof Error) {
    if (error.message === "SPK_NOT_FOUND" || error.message === "SPK_DETAIL_NOT_FOUND") {
      return errorResponse(request, "Data SPK tidak ditemukan.", 404, error.message);
    }

    if (error.message === "SCOPE_FORBIDDEN") {
      return errorResponse(
        request,
        "Aksi SPK ini membutuhkan scope global.",
        403,
        "SCOPE_FORBIDDEN",
      );
    }

    if (error.message === "INVALID_STATUS_TRANSITION") {
      return errorResponse(
        request,
        "Transisi status SPK tidak valid.",
        400,
        "INVALID_STATUS_TRANSITION",
      );
    }

    if (error.message === "SPK_ALREADY_EXISTS") {
      return errorResponse(
        request,
        "SPK untuk tanggal ini sudah pernah dibuat.",
        409,
        "SPK_ALREADY_EXISTS",
      );
    }

    if (error.message === "SPK_STORAGE_NOT_READY") {
      return errorResponse(
        request,
        "Penyimpanan SPK belum siap.",
        503,
        "SPK_STORAGE_NOT_READY",
      );
    }

    if (error.message === "SPK_SOURCE_EMPTY") {
      return errorResponse(
        request,
        "Belum ada job plan yang siap digenerate.",
        400,
        "SPK_SOURCE_EMPTY",
      );
    }

    if (error.message === "SPK_PENDING_ITEMS") {
      return errorResponse(
        request,
        "Masih ada item SPK yang belum direview.",
        400,
        "SPK_PENDING_ITEMS",
      );
    }

    if (error.message === "NO_APPROVED_ITEMS") {
      return errorResponse(
        request,
        "Minimal satu item SPK harus approved.",
        400,
        "NO_APPROVED_ITEMS",
      );
    }

    if (error.message === "SPK_DRAFT_ONLY") {
      return errorResponse(
        request,
        "Rincian mekanik hanya bisa diubah saat SPK masih draft planner.",
        400,
        "SPK_DRAFT_ONLY",
      );
    }

    if (error.message === "SPK_OVER_BUDGET") {
      return errorResponse(
        request,
        "Total rincian mekanik melebihi rekomendasi jam kerja dari PM.",
        400,
        "SPK_OVER_BUDGET",
      );
    }

    if (error.message === "SPK_DETAIL_SCOPE_MISMATCH") {
      return errorResponse(
        request,
        "Rincian mekanik harus tetap berada di unit dan divisi target planner.",
        400,
        "SPK_DETAIL_SCOPE_MISMATCH",
      );
    }

    if (
      error.message === "SPK_START_FORBIDDEN" ||
      error.message === "SPK_BREAKDOWN_FORBIDDEN" ||
      error.message === "APPROVAL_RANK_FORBIDDEN"
    ) {
      return errorResponse(
        request,
        error.message === "SPK_START_FORBIDDEN"
          ? "SPK ini hanya bisa diterima oleh level approval yang sesuai."
          : "Rincian mekanik hanya bisa diubah oleh KP, PM, atau MP.",
        403,
        error.message,
      );
    }
  }

  return errorResponse(
    request,
    "Terjadi kesalahan internal pada SPK module.",
    500,
    "SPK_FAILED",
  );
}

export async function handleSpkListRoute(
  request: Request,
  authService: AuthService,
  spkService: SpkService,
): Promise<Response> {
  const sessionResult = await requireSpkReadSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const query = sanitizeSpkGridQuery(new URL(request.url).searchParams);
    const result = await spkService.list(sessionResult.session, query);

    return withCors(
      request,
      Response.json({
        success: true,
        message: "SPK grid ready",
        data: result.data,
        storageReady: result.storageReady,
        meta: result.meta,
        query: result.query,
        summary: result.summary,
      }),
    );
  } catch (error) {
    return mapSpkError(request, error);
  }
}

export async function handleSpkPreviewRoute(
  request: Request,
  authService: AuthService,
  spkService: SpkService,
): Promise<Response> {
  const sessionResult = await requireSpkReadSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const query = sanitizeSpkGridQuery(new URL(request.url).searchParams);
    const result = await spkService.preview(sessionResult.session, query.date);
    return successResponse(request, "Preview SPK siap", result);
  } catch (error) {
    return mapSpkError(request, error);
  }
}

export async function handleSpkGenerateRoute(
  request: Request,
  authService: AuthService,
  spkService: SpkService,
): Promise<Response> {
  const sessionResult = await requireSpkWriteSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  const parsedBody = await parseJsonBody(request, spkGenerateRequestSchema);
  if (!parsedBody.success) {
    return parsedBody.response;
  }

  try {
    const result = await spkService.generate(sessionResult.session, parsedBody.data);
    return successResponse(request, "SPK berhasil dibuat.", result, {
      status: 201,
    });
  } catch (error) {
    return mapSpkError(request, error);
  }
}

export async function handleSpkDetailRoute(
  request: Request,
  spkId: string,
  authService: AuthService,
  spkService: SpkService,
): Promise<Response> {
  const sessionResult = await requireSpkReadSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const result = await spkService.findDetail(sessionResult.session, spkId);
    if (!result) {
      return errorResponse(request, "Data SPK tidak ditemukan.", 404, "SPK_NOT_FOUND");
    }

    return successResponse(request, "Detail SPK ditemukan", {
      ...result,
    });
  } catch (error) {
    return mapSpkError(request, error);
  }
}

export async function handleSpkSubmitRoute(
  request: Request,
  spkId: string,
  authService: AuthService,
  spkService: SpkService,
): Promise<Response> {
  const sessionResult = await requireSpkWriteSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const result = await spkService.submit(sessionResult.session, spkId);
    return successResponse(request, "SPK berhasil disubmit.", {
      ...result,
    });
  } catch (error) {
    return mapSpkError(request, error);
  }
}

export async function handleSpkApproveRoute(
  request: Request,
  spkId: string,
  authService: AuthService,
  spkService: SpkService,
): Promise<Response> {
  const sessionResult = await requireSpkWriteSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const result = await spkService.approve(sessionResult.session, spkId);
    return successResponse(request, "SPK berhasil diapprove.", {
      ...result,
    });
  } catch (error) {
    return mapSpkError(request, error);
  }
}

export async function handleSpkRejectRoute(
  request: Request,
  spkId: string,
  authService: AuthService,
  spkService: SpkService,
): Promise<Response> {
  const sessionResult = await requireSpkWriteSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  const parsedBody = await parseJsonBody(request, spkRejectRequestSchema);
  if (!parsedBody.success) {
    return parsedBody.response;
  }

  try {
    const result = await spkService.reject(
      sessionResult.session,
      spkId,
      parsedBody.data.reason,
    );
    return successResponse(request, "SPK berhasil direject.", {
      ...result,
    });
  } catch (error) {
    return mapSpkError(request, error);
  }
}

export async function handleSpkActivateRoute(
  request: Request,
  spkId: string,
  authService: AuthService,
  spkService: SpkService,
): Promise<Response> {
  const sessionResult = await requireSpkApprovalRankSession(request, authService, 1);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const result = await spkService.activate(sessionResult.session, spkId);
    return successResponse(request, "SPK berhasil diaktifkan.", {
      ...result,
    });
  } catch (error) {
    return mapSpkError(request, error);
  }
}

export async function handleSpkDraftDetailsRoute(
  request: Request,
  spkId: string,
  authService: AuthService,
  spkService: SpkService,
): Promise<Response> {
  const sessionResult = await requireSpkApprovalRankSession(request, authService, 3);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  const parsedBody = await parseJsonBody(request, spkDraftDetailUpdateRequestSchema);
  if (!parsedBody.success) {
    return parsedBody.response;
  }

  try {
    const result = await spkService.updateDraftDetails(
      sessionResult.session,
      spkId,
      parsedBody.data,
    );
    return successResponse(request, "Rincian mekanik SPK berhasil disimpan.", {
      spkId: result.spkId,
      detailCount: result.detailCount,
    });
  } catch (error) {
    return mapSpkError(request, error);
  }
}

export async function handleSpkDoneRoute(
  request: Request,
  spkId: string,
  authService: AuthService,
  spkService: SpkService,
): Promise<Response> {
  const sessionResult = await requireSpkWriteSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const result = await spkService.markDone(sessionResult.session, spkId);
    return successResponse(request, "SPK ditutup untuk hari ini.", {
      ...result,
    });
  } catch (error) {
    return mapSpkError(request, error);
  }
}

export async function handleSpkItemApprovalRoute(
  request: Request,
  spkId: string,
  detailId: string,
  authService: AuthService,
  spkService: SpkService,
): Promise<Response> {
  const sessionResult = await requireSpkWriteSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  const parsedBody = await parseJsonBody(request, spkItemApprovalRequestSchema);
  if (!parsedBody.success) {
    return parsedBody.response;
  }

  try {
    const result = await spkService.approveItem(
      sessionResult.session,
      spkId,
      detailId,
      parsedBody.data,
    );
    return successResponse(request, "Approval item SPK tersimpan.", {
      ...result,
    });
  } catch (error) {
    return mapSpkError(request, error);
  }
}

export async function handleSpkTodayRoute(
  request: Request,
  authService: AuthService,
  spkService: SpkService,
): Promise<Response> {
  const sessionResult = await requireSpkReadSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const result = await spkService.today(sessionResult.session);
    return withCors(
      request,
      Response.json({
        success: true,
        message: "SPK aktif hari ini ditemukan",
        data: result,
      }),
    );
  } catch (error) {
    return mapSpkError(request, error);
  }
}

export async function handleSpkSummaryRoute(
  request: Request,
  authService: AuthService,
  spkService: SpkService,
): Promise<Response> {
  const sessionResult = await requireSpkReadSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const result = await spkService.summary(sessionResult.session);
    return successResponse(request, "Ringkasan SPK ditemukan", result);
  } catch (error) {
    return mapSpkError(request, error);
  }
}
