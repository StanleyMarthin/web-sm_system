import {
  approveVendorRequestSchema,
  cancelVendorRequestSchema,
  createVendorRequestSchema,
  receiveVendorRequestSchema,
  vendorStatusUpdateRequestSchema,
} from "@smsystem/contracts/vendor";
import { permissionCodes } from "@smsystem/permissions";
import { ZodError } from "zod";
import { parseJsonBody } from "@/http/request";
import { errorResponse, withCors } from "@/http/response";
import { requireSession } from "@/middleware/auth.middleware";
import { requirePermission } from "@/middleware/permission.middleware";
import type { AuthService } from "@/services/auth/auth.service";
import type { VendorService } from "@/services/vendor.service";
import { sanitizeVendorGridQuery } from "@/services/vendor/query";
import { applyDefaultDivisionNameFilter } from "@/services/grid/division-default";
import { applyRequestsVisibilityScope } from "@/services/requests/scope";

async function requireVendorSession(
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

function mapVendorError(request: Request, error: unknown): Response {
  if (error instanceof ZodError) {
    return errorResponse(request, "Query Vendor WO tidak valid.", 400, "INVALID_QUERY");
  }

  if (error instanceof Error) {
    if (error.message === "VENDOR_WO_NOT_FOUND") {
      return errorResponse(request, "Vendor WO tidak ditemukan.", 404, "VENDOR_WO_NOT_FOUND");
    }

    if (error.message === "MISSING_DIVISION") {
      return errorResponse(
        request,
        "Divisi user aktif belum tersedia untuk membuat Vendor WO.",
        400,
        "MISSING_DIVISION",
      );
    }

    if (error.message === "VENDOR_WO_NOT_APPROVED") {
      return errorResponse(
        request,
        "Vendor WO harus approved penuh sebelum status vendor diproses.",
        409,
        "VENDOR_WO_NOT_APPROVED",
      );
    }

    if (
      error.message === "INVALID_APPROVAL_STATE" ||
      error.message === "INVALID_STATUS_TRANSITION"
    ) {
      return errorResponse(
        request,
        "Transisi Vendor WO tidak valid untuk aksi ini.",
        409,
        error.message,
      );
    }
  }

  return errorResponse(
    request,
    "Terjadi kesalahan internal pada modul Vendor WO.",
    500,
    "VENDOR_WO_FAILED",
  );
}

export async function handleVendorListRoute(
  request: Request,
  authService: AuthService,
  vendorService: VendorService,
): Promise<Response> {
  const sessionResult = await requireVendorSession(
    request,
    authService,
    permissionCodes.vendorView,
  );
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const visibilitySession = applyRequestsVisibilityScope(sessionResult.session);
    const query = applyDefaultDivisionNameFilter(
      visibilitySession,
      sanitizeVendorGridQuery(new URL(request.url).searchParams),
    );
    const result = await vendorService.list(visibilitySession, query);
    return withCors(
      request,
      Response.json({
        success: true,
        message: "Vendor WO grid ready",
        data: result.data,
        meta: result.meta,
        references: result.references,
        query: result.query,
        summary: result.summary,
      }),
    );
  } catch (error) {
    return mapVendorError(request, error);
  }
}

export async function handleVendorCreateRoute(
  request: Request,
  authService: AuthService,
  vendorService: VendorService,
): Promise<Response> {
  const sessionResult = await requireVendorSession(
    request,
    authService,
    permissionCodes.vendorCreate,
  );
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  const bodyResult = await parseJsonBody(request, createVendorRequestSchema);
  if (!bodyResult.success) {
    return withCors(request, bodyResult.response);
  }

  try {
    const result = await vendorService.create(sessionResult.session, bodyResult.data);
    return withCors(
      request,
      Response.json({
        success: true,
        message: "Vendor WO berhasil dibuat.",
        data: result,
      }),
    );
  } catch (error) {
    return mapVendorError(request, error);
  }
}

export async function handleVendorDetailRoute(
  request: Request,
  wovId: string,
  authService: AuthService,
  vendorService: VendorService,
): Promise<Response> {
  const sessionResult = await requireVendorSession(
    request,
    authService,
    permissionCodes.vendorView,
  );
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const visibilitySession = applyRequestsVisibilityScope(sessionResult.session);
    const detail = await vendorService.findDetail(visibilitySession, wovId);
    if (!detail) {
      return errorResponse(request, "Vendor WO tidak ditemukan.", 404, "VENDOR_WO_NOT_FOUND");
    }

    return withCors(
      request,
      Response.json({
        success: true,
        message: "Vendor WO detail ready",
        data: detail,
      }),
    );
  } catch (error) {
    return mapVendorError(request, error);
  }
}

export async function handleVendorApproveRoute(
  request: Request,
  wovId: string,
  authService: AuthService,
  vendorService: VendorService,
): Promise<Response> {
  const sessionResult = await requireVendorSession(
    request,
    authService,
    permissionCodes.vendorApprove,
  );
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  const bodyResult = await parseJsonBody(request, approveVendorRequestSchema);
  if (!bodyResult.success) {
    return withCors(request, bodyResult.response);
  }

  try {
    const visibilitySession = applyRequestsVisibilityScope(sessionResult.session);
    const result = await vendorService.approve(visibilitySession, wovId, bodyResult.data);
    return withCors(
      request,
      Response.json({
        success: true,
        message: "Approval Vendor WO berhasil diproses.",
        data: result,
      }),
    );
  } catch (error) {
    return mapVendorError(request, error);
  }
}

export async function handleVendorStatusRoute(
  request: Request,
  wovId: string,
  authService: AuthService,
  vendorService: VendorService,
): Promise<Response> {
  const sessionResult = await requireVendorSession(
    request,
    authService,
    permissionCodes.vendorUpdateStatus,
  );
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  const bodyResult = await parseJsonBody(request, vendorStatusUpdateRequestSchema);
  if (!bodyResult.success) {
    return withCors(request, bodyResult.response);
  }

  try {
    const visibilitySession = applyRequestsVisibilityScope(sessionResult.session);
    const result = await vendorService.updateStatus(visibilitySession, wovId, bodyResult.data);
    return withCors(
      request,
      Response.json({
        success: true,
        message: "Status Vendor WO berhasil diperbarui.",
        data: result,
      }),
    );
  } catch (error) {
    return mapVendorError(request, error);
  }
}

export async function handleVendorReceiveRoute(
  request: Request,
  wovId: string,
  authService: AuthService,
  vendorService: VendorService,
): Promise<Response> {
  const sessionResult = await requireVendorSession(
    request,
    authService,
    permissionCodes.vendorReceive,
  );
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  const bodyResult = await parseJsonBody(request, receiveVendorRequestSchema);
  if (!bodyResult.success) {
    return withCors(request, bodyResult.response);
  }

  try {
    const visibilitySession = applyRequestsVisibilityScope(sessionResult.session);
    const result = await vendorService.receive(visibilitySession, wovId, bodyResult.data);
    return withCors(
      request,
      Response.json({
        success: true,
        message: "Vendor WO berhasil ditandai received.",
        data: result,
      }),
    );
  } catch (error) {
    return mapVendorError(request, error);
  }
}

export async function handleVendorCancelRoute(
  request: Request,
  wovId: string,
  authService: AuthService,
  vendorService: VendorService,
): Promise<Response> {
  const sessionResult = await requireVendorSession(
    request,
    authService,
    permissionCodes.vendorUpdateStatus,
  );
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  const bodyResult = await parseJsonBody(request, cancelVendorRequestSchema);
  if (!bodyResult.success) {
    return withCors(request, bodyResult.response);
  }

  try {
    const visibilitySession = applyRequestsVisibilityScope(sessionResult.session);
    const result = await vendorService.cancel(visibilitySession, wovId, bodyResult.data);
    return withCors(
      request,
      Response.json({
        success: true,
        message: "Vendor WO berhasil dibatalkan.",
        data: result,
      }),
    );
  } catch (error) {
    return mapVendorError(request, error);
  }
}
