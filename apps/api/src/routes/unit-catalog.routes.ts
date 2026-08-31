import {
  bulkCatalogItemsRequestSchema,
  catalogMediaRequestSchema,
  catalogReferenceMediaRequestSchema,
  createPanelJobdescsRequestSchema,
  updateCatalogSurveyRequestSchema,
  upsertCatalogReferenceRequestSchema,
} from "@smsystem/contracts/unit-catalog";
import { permissionCodes } from "@smsystem/permissions";
import { parseJsonBody } from "@/http/request";
import { errorResponse, successResponse, withCors } from "@/http/response";
import { getApiEnv } from "@/config/env";
import { requireSession } from "@/middleware/auth.middleware";
import { requirePermission } from "@/middleware/permission.middleware";
import type { AuthService } from "@/services/auth/auth.service";
import { S3GalleryUploadTicketProvider } from "@/services/storage/r2-upload.service";
import { UnitCatalogService } from "@/services/unit-catalog.service";
import {
  createUploadNonce,
  extensionForImageContentType,
  normalizeAllowedImageContentType,
  parseUploadContentLength,
  storeUploadTicket,
} from "@/security/upload-ticket";

async function requireUnitCatalogSession(request: Request, authService: AuthService, manage = false) {
  const sessionResult = await requireSession(request, authService);
  if ("response" in sessionResult) return sessionResult;
  const base = requirePermission(request, sessionResult.session, permissionCodes.unitDetailView);
  if ("response" in base) return base;
  if (manage) {
    const manageResult = requirePermission(request, sessionResult.session, permissionCodes.unitPanelManage);
    if ("response" in manageResult) return manageResult;
  }
  return { session: sessionResult.session };
}

function mapCatalogError(request: Request, error: unknown): Response {
  if (error instanceof Error) {
    if (error.message === "UNIT_NOT_FOUND") return errorResponse(request, "Unit tidak ditemukan.", 404, "UNIT_NOT_FOUND");
    if (error.message === "CATALOG_REFERENCE_NOT_FOUND") return errorResponse(request, "Catalog reference tidak ditemukan.", 404, "CATALOG_REFERENCE_NOT_FOUND");
    if (error.message === "CATALOG_ITEM_NOT_FOUND") return errorResponse(request, "Catalog item tidak ditemukan.", 404, "CATALOG_ITEM_NOT_FOUND");
    if (error.message === "UNIT_PANEL_NOT_FOUND") return errorResponse(request, "Master panel tidak ditemukan.", 404, "UNIT_PANEL_NOT_FOUND");
    if (error.message === "SURVEY_NOT_CONFIRMED") return errorResponse(request, "Pendataan harus CONFIRMED sebelum menjadi Master Panel.", 409, "SURVEY_NOT_CONFIRMED");
  }
  return errorResponse(request, "Terjadi kesalahan internal pada Unit Preparation.", 500, "UNIT_CATALOG_FAILED");
}

export async function handleUnitCatalogRoute(request: Request, unitId: string, authService: AuthService, service: UnitCatalogService) {
  const sessionResult = await requireUnitCatalogSession(request, authService, request.method !== "GET");
  if ("response" in sessionResult) return sessionResult.response;
  try {
    if (request.method === "POST") {
      const body = await parseJsonBody(request, upsertCatalogReferenceRequestSchema);
      if (!body.success) return withCors(request, body.response);
      return successResponse(request, "Catalog reference berhasil dibuat.", {
        reference: await service.createReference(sessionResult.session, unitId, body.data),
      }, { status: 201 });
    }
    return successResponse(request, "Catalog unit berhasil dimuat.", {
      references: await service.listReferences(sessionResult.session, unitId),
    });
  } catch (error) {
    return mapCatalogError(request, error);
  }
}

export async function handleUnitCatalogReferenceRoute(request: Request, unitId: string, referenceId: number, authService: AuthService, service: UnitCatalogService) {
  const sessionResult = await requireUnitCatalogSession(request, authService);
  if ("response" in sessionResult) return sessionResult.response;
  try {
    const reference = await service.getReference(sessionResult.session, unitId, referenceId);
    if (!reference) return errorResponse(request, "Catalog reference tidak ditemukan.", 404, "CATALOG_REFERENCE_NOT_FOUND");
    return successResponse(request, "Catalog reference berhasil dimuat.", { reference });
  } catch (error) {
    return mapCatalogError(request, error);
  }
}

export async function handleUnitCatalogItemsBulkRoute(request: Request, unitId: string, referenceId: number, authService: AuthService, service: UnitCatalogService) {
  const sessionResult = await requireUnitCatalogSession(request, authService, true);
  if ("response" in sessionResult) return sessionResult.response;
  const body = await parseJsonBody(request, bulkCatalogItemsRequestSchema);
  if (!body.success) return withCors(request, body.response);
  try {
    return successResponse(request, "Catalog items berhasil disimpan.", await service.replaceItems(sessionResult.session, unitId, referenceId, body.data));
  } catch (error) {
    return mapCatalogError(request, error);
  }
}

export async function handleUnitCatalogReferenceMediaRoute(request: Request, unitId: string, referenceId: number, authService: AuthService, service: UnitCatalogService) {
  const sessionResult = await requireUnitCatalogSession(request, authService, true);
  if ("response" in sessionResult) return sessionResult.response;
  const body = await parseJsonBody(request, catalogReferenceMediaRequestSchema);
  if (!body.success) return withCors(request, body.response);
  try {
    return successResponse(request, "Gambar catalog berhasil disimpan.", {
      media: await service.addReferenceMedia(sessionResult.session, unitId, referenceId, body.data),
    }, { status: 201 });
  } catch (error) {
    return mapCatalogError(request, error);
  }
}

export async function handleUnitCatalogUploadTicketRoute(request: Request, unitId: string, authService: AuthService) {
  const sessionResult = await requireUnitCatalogSession(request, authService, true);
  if ("response" in sessionResult) return sessionResult.response;
  try {
    const url = new URL(request.url);
    const filename = url.searchParams.get("filename")?.trim() ?? "";
    const contentType = url.searchParams.get("contentType")?.trim() ?? "image/jpeg";
    if (!filename) return errorResponse(request, "filename wajib diisi.", 400, "MISSING_FILENAME");
    const allowedContentType = normalizeAllowedImageContentType(contentType);
    const extension = extensionForImageContentType(allowedContentType);
    const contentLength = parseUploadContentLength(url.searchParams.get("size") ?? url.searchParams.get("contentLength"));
    const nonce = createUploadNonce();
    const objectKey = `unit-preparation/${encodeURIComponent(unitId)}/${sessionResult.session.employeeId}/${nonce}.${extension}`;
    const ticket = await new S3GalleryUploadTicketProvider(getApiEnv()).createTicket({
      objectKey,
      contentType: allowedContentType,
      contentLength,
    });
    await storeUploadTicket({ nonce, employeeId: sessionResult.session.employeeId, objectKey });
    return successResponse(request, "Unit Preparation upload ticket ready", ticket as unknown as Record<string, unknown>);
  } catch (error) {
    return mapCatalogError(request, error);
  }
}

export async function handleUnitCatalogItemRoute(request: Request, unitId: string, itemId: number, authService: AuthService, service: UnitCatalogService) {
  const sessionResult = await requireUnitCatalogSession(request, authService);
  if ("response" in sessionResult) return sessionResult.response;
  try {
    const item = await service.getItem(sessionResult.session, unitId, itemId);
    if (!item) return errorResponse(request, "Catalog item tidak ditemukan.", 404, "CATALOG_ITEM_NOT_FOUND");
    return successResponse(request, "Catalog item berhasil dimuat.", { item });
  } catch (error) {
    return mapCatalogError(request, error);
  }
}

export async function handleUnitCatalogSurveyRoute(request: Request, unitId: string, itemId: number, authService: AuthService, service: UnitCatalogService) {
  const sessionResult = await requireUnitCatalogSession(request, authService, true);
  if ("response" in sessionResult) return sessionResult.response;
  const body = await parseJsonBody(request, updateCatalogSurveyRequestSchema);
  if (!body.success) return withCors(request, body.response);
  try {
    return successResponse(request, "Draft pendataan berhasil disimpan.", {
      item: await service.updateSurvey(sessionResult.session, unitId, itemId, body.data),
    });
  } catch (error) {
    return mapCatalogError(request, error);
  }
}

export async function handleUnitCatalogSurveyConfirmRoute(request: Request, unitId: string, itemId: number, authService: AuthService, service: UnitCatalogService) {
  const sessionResult = await requireUnitCatalogSession(request, authService, true);
  if ("response" in sessionResult) return sessionResult.response;
  const body = await parseJsonBody(request, updateCatalogSurveyRequestSchema);
  if (!body.success) return withCors(request, body.response);
  try {
    return successResponse(request, "Pendataan dikonfirmasi dan Master Panel dibuat.", {
      result: await service.confirmSurvey(sessionResult.session, unitId, itemId, body.data),
    });
  } catch (error) {
    return mapCatalogError(request, error);
  }
}

export async function handleUnitCatalogMediaRoute(request: Request, unitId: string, itemId: number, authService: AuthService, service: UnitCatalogService) {
  const sessionResult = await requireUnitCatalogSession(request, authService, true);
  if ("response" in sessionResult) return sessionResult.response;
  const body = await parseJsonBody(request, catalogMediaRequestSchema);
  if (!body.success) return withCors(request, body.response);
  try {
    return successResponse(request, "Foto pendataan berhasil disimpan.", {
      media: await service.addMedia(sessionResult.session, unitId, itemId, body.data),
    }, { status: 201 });
  } catch (error) {
    return mapCatalogError(request, error);
  }
}

export async function handleUnitCatalogMediaDeleteRoute(request: Request, unitId: string, itemId: number, mediaId: number, authService: AuthService, service: UnitCatalogService) {
  const sessionResult = await requireUnitCatalogSession(request, authService, true);
  if ("response" in sessionResult) return sessionResult.response;
  try {
    return successResponse(request, "Foto pendataan berhasil dihapus.", await service.deleteMedia(sessionResult.session, unitId, itemId, mediaId));
  } catch (error) {
    return mapCatalogError(request, error);
  }
}

export async function handleUnitCatalogPromoteRoute(request: Request, unitId: string, itemId: number, authService: AuthService, service: UnitCatalogService) {
  const sessionResult = await requireUnitCatalogSession(request, authService, true);
  if ("response" in sessionResult) return sessionResult.response;
  try {
    return successResponse(request, "Item berhasil diproses ke Master Panel.", await service.promoteItem(sessionResult.session, unitId, itemId));
  } catch (error) {
    return mapCatalogError(request, error);
  }
}

export async function handleUnitCatalogPanelRoute(request: Request, unitId: string, panelId: number, authService: AuthService, service: UnitCatalogService) {
  const sessionResult = await requireUnitCatalogSession(request, authService);
  if ("response" in sessionResult) return sessionResult.response;
  try {
    const panel = await service.getPanel(sessionResult.session, unitId, panelId);
    if (!panel) return errorResponse(request, "Master panel tidak ditemukan.", 404, "UNIT_PANEL_NOT_FOUND");
    return successResponse(request, "Master panel berhasil dimuat.", { panel });
  } catch (error) {
    return mapCatalogError(request, error);
  }
}

export async function handleUnitCatalogPanelJobdescsRoute(request: Request, unitId: string, panelId: number, authService: AuthService, service: UnitCatalogService) {
  const sessionResult = await requireUnitCatalogSession(request, authService, request.method !== "GET");
  if ("response" in sessionResult) return sessionResult.response;
  try {
    if (request.method === "POST") {
      const body = await parseJsonBody(request, createPanelJobdescsRequestSchema);
      if (!body.success) return withCors(request, body.response);
      return successResponse(request, "Jobdesc berhasil dibuat.", {
        jobdescs: await service.createPanelJobdescs(sessionResult.session, unitId, panelId, body.data),
      }, { status: 201 });
    }
    return successResponse(request, "List Jobdesc Master Panel.", {
      jobdescs: await service.listPanelJobdescs(sessionResult.session, unitId, panelId),
    });
  } catch (error) {
    return mapCatalogError(request, error);
  }
}
