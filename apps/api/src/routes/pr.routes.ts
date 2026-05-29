import {
  approvePrRequestSchema,
  cancelPrRequestSchema,
  createPrRequestSchema,
  orderPrRequestSchema,
  receivePrRequestSchema,
} from "@smsystem/contracts/pr";
import { permissionCodes } from "@smsystem/permissions";
import { ZodError } from "zod";
import { parseJsonBody } from "@/http/request";
import { errorResponse, successResponse, withCors } from "@/http/response";
import { getApiEnv } from "@/config/env";
import { requireSession } from "@/middleware/auth.middleware";
import { requirePermission } from "@/middleware/permission.middleware";
import type { AuthService } from "@/services/auth/auth.service";
import type { PrService } from "@/services/pr.service";
import { sanitizePrGridQuery } from "@/services/pr/query";
import { applyDefaultDivisionNameFilter } from "@/services/grid/division-default";
import { applyRequestsVisibilityScope } from "@/services/requests/scope";

async function requirePrSession(
  request: Request,
  authService: AuthService,
  permission: string,
) {
  const sessionResult = await requireSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult;
  }

  const permissionResult = requirePermission(
    request,
    sessionResult.session,
    permission,
  );
  if ("response" in permissionResult) {
    return permissionResult;
  }

  return {
    session: sessionResult.session,
  };
}

function mapPrError(request: Request, error: unknown): Response {
  if (error instanceof ZodError) {
    return errorResponse(request, "Query PR tidak valid.", 400, "INVALID_QUERY");
  }

  if (error instanceof Error) {
    if (error.message === "PR_NOT_FOUND") {
      return errorResponse(request, "PR tidak ditemukan.", 404, "PR_NOT_FOUND");
    }

    if (error.message === "MISSING_DIVISION") {
      return errorResponse(
        request,
        "Divisi user aktif belum tersedia untuk membuat PR.",
        400,
        "MISSING_DIVISION",
      );
    }

    if (error.message === "PR_NOT_APPROVED") {
      return errorResponse(
        request,
        "PR harus approved penuh sebelum diproses order atau receive.",
        409,
        "PR_NOT_APPROVED",
      );
    }

    if (
      error.message === "INVALID_APPROVAL_STATE" ||
      error.message === "INVALID_STATUS_TRANSITION"
    ) {
      return errorResponse(
        request,
        "Transisi PR tidak valid untuk aksi ini.",
        409,
        error.message,
      );
    }
  }

  return errorResponse(
    request,
    "Terjadi kesalahan internal pada modul PR.",
    500,
    "PR_FAILED",
  );
}

export async function handlePrListRoute(
  request: Request,
  authService: AuthService,
  prService: PrService,
): Promise<Response> {
  const sessionResult = await requirePrSession(request, authService, permissionCodes.prView);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const visibilitySession = applyRequestsVisibilityScope(sessionResult.session);
    const query = applyDefaultDivisionNameFilter(
      visibilitySession,
      sanitizePrGridQuery(new URL(request.url).searchParams),
    );
    const result = await prService.list(visibilitySession, query);
    return withCors(
      request,
      Response.json({
        success: true,
        message: "PR grid ready",
        data: result.data,
        meta: result.meta,
        references: result.references,
        query: result.query,
        summary: result.summary,
      }),
    );
  } catch (error) {
    return mapPrError(request, error);
  }
}

export async function handlePrCriticalRoute(
  request: Request,
  authService: AuthService,
  prService: PrService,
): Promise<Response> {
  const sessionResult = await requirePrSession(request, authService, permissionCodes.prView);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const visibilitySession = applyRequestsVisibilityScope(sessionResult.session);
    const rows = await prService.listCritical(visibilitySession);
    return withCors(
      request,
      Response.json({
        success: true,
        message: "PR critical board ready",
        data: rows,
      }),
    );
  } catch (error) {
    return mapPrError(request, error);
  }
}

export async function handlePrCreateRoute(
  request: Request,
  authService: AuthService,
  prService: PrService,
): Promise<Response> {
  const sessionResult = await requirePrSession(request, authService, permissionCodes.prCreate);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  const bodyResult = await parseJsonBody(request, createPrRequestSchema);
  if (!bodyResult.success) {
    return withCors(request, bodyResult.response);
  }

  try {
    const result = await prService.create(sessionResult.session, bodyResult.data);
    return withCors(
      request,
      Response.json({
        success: true,
        message: "PR berhasil dibuat.",
        data: result,
      }),
    );
  } catch (error) {
    return mapPrError(request, error);
  }
}

export async function handlePrDetailRoute(
  request: Request,
  prId: string,
  authService: AuthService,
  prService: PrService,
): Promise<Response> {
  const sessionResult = await requirePrSession(request, authService, permissionCodes.prView);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const visibilitySession = applyRequestsVisibilityScope(sessionResult.session);
    const detail = await prService.findDetail(visibilitySession, prId);
    if (!detail) {
      return errorResponse(request, "PR tidak ditemukan.", 404, "PR_NOT_FOUND");
    }

    return withCors(
      request,
      Response.json({
        success: true,
        message: "PR detail ready",
        data: detail,
      }),
    );
  } catch (error) {
    return mapPrError(request, error);
  }
}

export async function handlePrApproveRoute(
  request: Request,
  prId: string,
  authService: AuthService,
  prService: PrService,
): Promise<Response> {
  const sessionResult = await requirePrSession(request, authService, permissionCodes.prApprove);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  const bodyResult = await parseJsonBody(request, approvePrRequestSchema);
  if (!bodyResult.success) {
    return withCors(request, bodyResult.response);
  }

  try {
    const visibilitySession = applyRequestsVisibilityScope(sessionResult.session);
    const result = await prService.approve(visibilitySession, prId, bodyResult.data);
    return withCors(
      request,
      Response.json({
        success: true,
        message: "PR approval berhasil diproses.",
        data: result,
      }),
    );
  } catch (error) {
    return mapPrError(request, error);
  }
}

export async function handlePrOrderRoute(
  request: Request,
  prId: string,
  authService: AuthService,
  prService: PrService,
): Promise<Response> {
  const sessionResult = await requirePrSession(request, authService, permissionCodes.prOrder);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  const bodyResult = await parseJsonBody(request, orderPrRequestSchema);
  if (!bodyResult.success) {
    return withCors(request, bodyResult.response);
  }

  try {
    const visibilitySession = applyRequestsVisibilityScope(sessionResult.session);
    const result = await prService.order(visibilitySession, prId, bodyResult.data);
    return withCors(
      request,
      Response.json({
        success: true,
        message: "PR berhasil ditandai ordered.",
        data: result,
      }),
    );
  } catch (error) {
    return mapPrError(request, error);
  }
}

export async function handlePrReceiveRoute(
  request: Request,
  prId: string,
  authService: AuthService,
  prService: PrService,
): Promise<Response> {
  const sessionResult = await requirePrSession(request, authService, permissionCodes.prReceive);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  const bodyResult = await parseJsonBody(request, receivePrRequestSchema);
  if (!bodyResult.success) {
    return withCors(request, bodyResult.response);
  }

  try {
    const visibilitySession = applyRequestsVisibilityScope(sessionResult.session);
    const result = await prService.receive(visibilitySession, prId, bodyResult.data);
    return withCors(
      request,
      Response.json({
        success: true,
        message: "PR berhasil ditandai arrived.",
        data: result,
      }),
    );
  } catch (error) {
    return mapPrError(request, error);
  }
}

export async function handlePrCancelRoute(
  request: Request,
  prId: string,
  authService: AuthService,
  prService: PrService,
): Promise<Response> {
  const sessionResult = await requirePrSession(request, authService, permissionCodes.prOrder);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  const bodyResult = await parseJsonBody(request, cancelPrRequestSchema);
  if (!bodyResult.success) {
    return withCors(request, bodyResult.response);
  }

  try {
    const visibilitySession = applyRequestsVisibilityScope(sessionResult.session);
    const result = await prService.cancel(visibilitySession, prId, bodyResult.data);
    return withCors(
      request,
      Response.json({
        success: true,
        message: "PR berhasil dibatalkan.",
        data: result,
      }),
    );
  } catch (error) {
    return mapPrError(request, error);
  }
}

export async function handlePrUploadTicketRoute(
  request: Request,
  authService: AuthService,
): Promise<Response> {
  const sessionResult = await requireSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const url = new URL(request.url);
    const filename = url.searchParams.get("filename")?.trim() ?? "";
    const contentType = url.searchParams.get("contentType")?.trim() ?? "image/jpeg";

    if (!filename) {
      return errorResponse(request, "filename wajib diisi.", 400, "MISSING_FILENAME");
    }

    // Clean filename and structure it under 'pr/' prefix
    const cleanFilename = filename.replaceAll("/", "-").replaceAll(/[^\w\-.]/gu, "_");
    const objectKey = `pr/${Date.now()}_${cleanFilename}`;

    const { S3GalleryUploadTicketProvider } = await import("@/services/storage/r2-upload.service");
    const uploadTicketProvider = new S3GalleryUploadTicketProvider(getApiEnv());

    const ticket = await uploadTicketProvider.createTicket({
      objectKey,
      contentType,
    });

    return successResponse(
      request,
      "PR upload ticket ready",
      ticket as unknown as Record<string, unknown>,
    );
  } catch (error) {
    return mapPrError(request, error);
  }
}
