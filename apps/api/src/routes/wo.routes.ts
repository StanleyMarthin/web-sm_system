import { permissionCodes } from "@smsystem/permissions";
import {
  woApproveRequestSchema,
  woCreateRequestSchema,
  woRejectRequestSchema,
} from "@smsystem/contracts/wo";
import { parseJsonBody } from "@/http/request";
import { ZodError } from "zod";
import { errorResponse, successResponse, withCors } from "@/http/response";
import { requireSession } from "@/middleware/auth.middleware";
import {
  requireAnyPermission,
  requirePermission,
} from "@/middleware/permission.middleware";
import type { AuthService } from "@/services/auth/auth.service";
import type { WoService } from "@/services/wo.service";
import { sanitizeWoGridQuery } from "@/services/wo/query";
import { applyDefaultWoDivisionFilter } from "@/services/grid/division-default";
import { applyRequestsVisibilityScope } from "@/services/requests/scope";

async function requireWoViewSession(
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
    permissionCodes.woView,
  );
  if ("response" in permissionResult) {
    return permissionResult;
  }

  return {
    session: sessionResult.session,
  };
}

async function requireWoCreateSession(
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
    permissionCodes.woCreate,
  );
  if ("response" in permissionResult) {
    return permissionResult;
  }

  return {
    session: sessionResult.session,
  };
}

async function requireWoApproveSession(
  request: Request,
  authService: AuthService,
) {
  const sessionResult = await requireSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult;
  }

  const permissionResult = requireAnyPermission(
    request,
    sessionResult.session,
    [
      permissionCodes.woApprove,
      permissionCodes.woApproveAdvisor,
      permissionCodes.woApprovePm,
    ],
  );
  if ("response" in permissionResult) {
    return permissionResult;
  }

  return {
    session: sessionResult.session,
  };
}

async function requireWoRejectSession(
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
    permissionCodes.woReject,
  );
  if ("response" in permissionResult) {
    return permissionResult;
  }

  return {
    session: sessionResult.session,
  };
}

function mapWoError(request: Request, error: unknown): Response {
  if (error instanceof ZodError) {
    return errorResponse(request, "Query WO tidak valid.", 400, "INVALID_QUERY");
  }

  if (error instanceof Error) {
    if (error.message === "WO_NOT_FOUND") {
      return errorResponse(request, "WO tidak ditemukan.", 404, "WO_NOT_FOUND");
    }

    if (error.message === "INVALID_STATUS_TRANSITION") {
      return errorResponse(
        request,
        "Transisi status WO tidak valid.",
        400,
        "INVALID_STATUS_TRANSITION",
      );
    }

    if (error.message === "COUNTDOWN_NOT_DONE") {
      return errorResponse(
        request,
        "WO belum bisa ditutup karena countdown terkait belum selesai.",
        409,
        "COUNTDOWN_NOT_DONE",
      );
    }

    if (error.message === "MISSING_DIVISION") {
      return errorResponse(
        request,
        "User aktif tidak memiliki divisi asal untuk membuat WO.",
        400,
        "MISSING_DIVISION",
      );
    }

    if (error.message === "MISSING_KD_ASSIGNMENT") {
      return errorResponse(
        request,
        "KD penerima wajib menentukan PIC dan jam kerja WO.",
        400,
        "MISSING_KD_ASSIGNMENT",
      );
    }

    if (error.message === "WO_APPROVAL_FORBIDDEN") {
      return errorResponse(
        request,
        "User aktif tidak berwenang menyetujui tahap WO ini.",
        403,
        "WO_APPROVAL_FORBIDDEN",
      );
    }

    if (error.message === "WO_PANEL_REQUIRED") {
      return errorResponse(
        request,
        "WO wajib memilih panel/part dari master panel.",
        400,
        "WO_PANEL_REQUIRED",
      );
    }

    if (error.message === "WO_PANEL_NOT_FOUND") {
      return errorResponse(
        request,
        "Panel/part WO tidak ditemukan di master panel unit.",
        400,
        "WO_PANEL_NOT_FOUND",
      );
    }
  }

  return errorResponse(
    request,
    "Terjadi kesalahan internal pada WO module.",
    500,
    "WO_FAILED",
  );
}

export async function handleWoListRoute(
  request: Request,
  authService: AuthService,
  woService: WoService,
): Promise<Response> {
  const sessionResult = await requireWoViewSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const visibilitySession = applyRequestsVisibilityScope(sessionResult.session);
    const query = applyDefaultWoDivisionFilter(
      visibilitySession,
      sanitizeWoGridQuery(new URL(request.url).searchParams),
    );
    const result = await woService.list(visibilitySession, query);

    return withCors(
      request,
      Response.json({
        success: true,
        message: "WO grid ready",
        data: result.data,
        meta: result.meta,
        references: result.references,
        query: result.query,
        summary: result.summary,
      }),
    );
  } catch (error) {
    return mapWoError(request, error);
  }
}

export async function handleWoPendingApprovalRoute(
  request: Request,
  authService: AuthService,
  woService: WoService,
): Promise<Response> {
  const sessionResult = await requireWoViewSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const visibilitySession = applyRequestsVisibilityScope(sessionResult.session);
    const result = await woService.listPendingApproval(visibilitySession);
    return withCors(
      request,
      Response.json({
        success: true,
        message: "WO pending approval ready",
        data: result.data,
        meta: result.meta,
        references: result.references,
        query: result.query,
        summary: result.summary,
      }),
    );
  } catch (error) {
    return mapWoError(request, error);
  }
}

export async function handleWoMyDivisionRoute(
  request: Request,
  authService: AuthService,
  woService: WoService,
): Promise<Response> {
  const sessionResult = await requireWoViewSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const visibilitySession = applyRequestsVisibilityScope(sessionResult.session);
    const result = await woService.listMyDivision(visibilitySession);
    return withCors(
      request,
      Response.json({
        success: true,
        message: "WO divisi aktif ready",
        data: result.data,
        meta: result.meta,
        references: result.references,
        query: result.query,
        summary: result.summary,
      }),
    );
  } catch (error) {
    return mapWoError(request, error);
  }
}

export async function handleWoUrgentRoute(
  request: Request,
  authService: AuthService,
  woService: WoService,
): Promise<Response> {
  const sessionResult = await requireWoViewSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const visibilitySession = applyRequestsVisibilityScope(sessionResult.session);
    const result = await woService.listUrgent(visibilitySession);
    return withCors(
      request,
      Response.json({
        success: true,
        message: "Urgent WO ready",
        data: result,
      }),
    );
  } catch (error) {
    return mapWoError(request, error);
  }
}

export async function handleWoCreateRoute(
  request: Request,
  authService: AuthService,
  woService: WoService,
): Promise<Response> {
  const sessionResult = await requireWoCreateSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  const parsedBody = await parseJsonBody(request, woCreateRequestSchema);
  if (!parsedBody.success) {
    return parsedBody.response;
  }

  try {
    const result = await woService.create(sessionResult.session, parsedBody.data);
    return successResponse(request, "WO berhasil dibuat.", { ...result }, {
      status: 201,
    });
  } catch (error) {
    return mapWoError(request, error);
  }
}

export async function handleWoDetailRoute(
  request: Request,
  woId: string,
  authService: AuthService,
  woService: WoService,
): Promise<Response> {
  const sessionResult = await requireWoViewSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const visibilitySession = applyRequestsVisibilityScope(sessionResult.session);
    const result = await woService.findDetail(visibilitySession, woId);
    if (!result) {
      return errorResponse(request, "WO tidak ditemukan.", 404, "WO_NOT_FOUND");
    }

    return successResponse(request, "Detail WO ditemukan.", { ...result });
  } catch (error) {
    return mapWoError(request, error);
  }
}

export async function handleWoApproveRoute(
  request: Request,
  woId: string,
  authService: AuthService,
  woService: WoService,
): Promise<Response> {
  const sessionResult = await requireWoApproveSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  const parsedBody = request.headers.get("content-type")?.includes("application/json")
    ? await parseJsonBody(request, woApproveRequestSchema)
    : { success: true as const, data: woApproveRequestSchema.parse({}) };
  if (!parsedBody.success) {
    return parsedBody.response;
  }

  try {
    const visibilitySession = applyRequestsVisibilityScope(sessionResult.session);
    const result = await woService.approve(visibilitySession, woId, parsedBody.data);
    return successResponse(request, "WO berhasil diapprove.", { ...result });
  } catch (error) {
    return mapWoError(request, error);
  }
}

export async function handleWoRejectRoute(
  request: Request,
  woId: string,
  authService: AuthService,
  woService: WoService,
): Promise<Response> {
  const sessionResult = await requireWoRejectSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  const parsedBody = await parseJsonBody(request, woRejectRequestSchema);
  if (!parsedBody.success) {
    return parsedBody.response;
  }

  try {
    const visibilitySession = applyRequestsVisibilityScope(sessionResult.session);
    const result = await woService.reject(
      visibilitySession,
      woId,
      parsedBody.data.reason,
    );
    return successResponse(request, "WO berhasil direject.", { ...result });
  } catch (error) {
    return mapWoError(request, error);
  }
}

export async function handleWoDoneRoute(
  request: Request,
  woId: string,
  authService: AuthService,
  woService: WoService,
): Promise<Response> {
  const sessionResult = await requireWoApproveSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const visibilitySession = applyRequestsVisibilityScope(sessionResult.session);
    const result = await woService.markDone(visibilitySession, woId);
    return successResponse(request, "WO ditandai selesai.", { ...result });
  } catch (error) {
    return mapWoError(request, error);
  }
}

export async function handleWoLinkedCountdownsRoute(
  request: Request,
  woId: string,
  authService: AuthService,
  woService: WoService,
): Promise<Response> {
  const sessionResult = await requireWoViewSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const visibilitySession = applyRequestsVisibilityScope(sessionResult.session);
    const result = await woService.findLinkedCountdowns(visibilitySession, woId);
    return withCors(
      request,
      Response.json({
        success: true,
        message: "Linked countdowns ditemukan",
        data: result,
      }),
    );
  } catch (error) {
    return mapWoError(request, error);
  }
}
