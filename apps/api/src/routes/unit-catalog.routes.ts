import {
  catalogMediaRequestSchema,
  catalogReferenceMediaRequestSchema,
  createPanelJobdescsRequestSchema,
  saveCatalogWorkspaceRequestSchema,
  updateCatalogSurveyRequestSchema,
  upsertCatalogReferenceRequestSchema,
} from "@smsystem/contracts/unit-catalog";
import { permissionCodes } from "@smsystem/permissions";
import { getApiEnv } from "@/config/env";
import { parseJsonBody } from "@/http/request";
import { errorResponse, successResponse, withCors } from "@/http/response";
import { requireSession } from "@/middleware/auth.middleware";
import { requireAnyPermission } from "@/middleware/permission.middleware";
import { S3GalleryUploadTicketProvider } from "@/services/storage/r2-upload.service";
import type { AuthService } from "@/services/auth/auth.service";
import { UnitCatalogService } from "@/services/unit-catalog.service";
import {
  createUploadNonce,
  extensionForImageContentType,
  normalizeAllowedImageContentType,
  parseUploadContentLength,
  storeUploadTicket,
} from "@/security/upload-ticket";

const unitCatalogAdminPermissions = [permissionCodes.unitCatalogManage] as const;
const unitCatalogSurveyPermissions = [
  permissionCodes.unitCatalogSurvey,
  permissionCodes.unitCatalogManage,
] as const;
const unitCatalogReadPermissions = [
  permissionCodes.unitCatalogView,
  ...unitCatalogSurveyPermissions,
  permissionCodes.unitCatalogCreateJobdesc,
] as const;
const unitCatalogJobdescPermissions = [
  permissionCodes.unitCatalogCreateJobdesc,
  permissionCodes.unitCatalogManage,
] as const;

async function requireUnitCatalogSession(
  request: Request,
  authService: AuthService,
  requiredPermissions: readonly string[] = unitCatalogReadPermissions,
) {
  const sessionResult = await requireSession(request, authService);
  if ("response" in sessionResult) return sessionResult;
  const permissionResult = requireAnyPermission(request, sessionResult.session, requiredPermissions);
  if ("response" in permissionResult) return permissionResult;
  return { session: sessionResult.session };
}

function mapCatalogError(request: Request, error: unknown): Response {
  if (error instanceof Error) {
    if (error.message === "UNIT_NOT_FOUND") return errorResponse(request, "Unit tidak ditemukan.", 404, "UNIT_NOT_FOUND");
    if (error.message === "CATALOG_REFERENCE_NOT_FOUND") return errorResponse(request, "Referensi catalog tidak ditemukan.", 404, "CATALOG_REFERENCE_NOT_FOUND");
    if (error.message === "CATALOG_PANEL_NOT_FOUND") return errorResponse(request, "Panel catalog tidak ditemukan.", 404, "CATALOG_PANEL_NOT_FOUND");
    if (error.message === "CATALOG_COMPONENT_NOT_FOUND") return errorResponse(request, "Komponen catalog tidak ditemukan.", 404, "CATALOG_COMPONENT_NOT_FOUND");
    if (error.message === "CATALOG_ITEM_NOT_FOUND") return errorResponse(request, "Item catalog tidak ditemukan.", 404, "CATALOG_ITEM_NOT_FOUND");
    if (error.message === "UNIT_PANEL_NOT_FOUND") return errorResponse(request, "Master panel tidak ditemukan.", 404, "UNIT_PANEL_NOT_FOUND");
    if (error.message === "SURVEY_NOT_CONFIRMED") return errorResponse(request, "Pendataan harus CONFIRMED sebelum menjadi Master Panel.", 409, "SURVEY_NOT_CONFIRMED");
  }
  return errorResponse(request, "Terjadi kesalahan internal pada modul catalog.", 500, "UNIT_CATALOG_FAILED");
}

export async function handleUnitCatalogRoute(request: Request, unitId: string, authService: AuthService, service: UnitCatalogService) {
  const sessionResult = await requireUnitCatalogSession(
    request,
    authService,
    request.method === "GET" ? unitCatalogReadPermissions : unitCatalogAdminPermissions,
  );
  if ("response" in sessionResult) return sessionResult.response;

  try {
    if (request.method === "POST") {
      const body = await parseJsonBody(request, upsertCatalogReferenceRequestSchema);
      if (!body.success) return withCors(request, body.response);
      return successResponse(request, "Panel catalog siap dipakai.", {
        workspace: await service.createReference(sessionResult.session, unitId, body.data),
      }, { status: 201 });
    }

    return successResponse(request, "Ringkasan catalog unit berhasil dimuat.", {
      overview: await service.getOverview(sessionResult.session, unitId),
    });
  } catch (error) {
    return mapCatalogError(request, error);
  }
}

export async function handleUnitCatalogSearchRoute(request: Request, unitId: string, authService: AuthService, service: UnitCatalogService) {
  const sessionResult = await requireUnitCatalogSession(request, authService);
  if ("response" in sessionResult) return sessionResult.response;

  try {
    const url = new URL(request.url);
    const q = url.searchParams.get("q")?.trim() ?? "";
    const componentId = Number(url.searchParams.get("componentId"));
    const panelId = Number(url.searchParams.get("panelId"));
    const limit = Number(url.searchParams.get("limit"));
    const offset = Number(url.searchParams.get("offset"));

    return successResponse(request, "Hasil pencarian catalog berhasil dimuat.", {
      items: await service.searchCatalog(sessionResult.session, unitId, q, {
        componentId: Number.isFinite(componentId) ? componentId : null,
        panelId: Number.isFinite(panelId) ? panelId : null,
        limit: Number.isFinite(limit) ? limit : undefined,
        offset: Number.isFinite(offset) ? offset : undefined,
      }),
    });
  } catch (error) {
    return mapCatalogError(request, error);
  }
}

export async function handleUnitCatalogReferenceRoute(request: Request, unitId: string, referenceId: number, authService: AuthService, service: UnitCatalogService) {
  const sessionResult = await requireUnitCatalogSession(request, authService);
  if ("response" in sessionResult) return sessionResult.response;

  try {
    const workspace = await service.getReference(sessionResult.session, unitId, referenceId);
    if (!workspace) return errorResponse(request, "Referensi catalog tidak ditemukan.", 404, "CATALOG_REFERENCE_NOT_FOUND");
    return successResponse(request, "Workspace catalog berhasil dimuat.", { workspace });
  } catch (error) {
    return mapCatalogError(request, error);
  }
}

export async function handleUnitCatalogPanelWorkspaceRoute(request: Request, unitId: string, panelId: number, authService: AuthService, service: UnitCatalogService) {
  const sessionResult = await requireUnitCatalogSession(request, authService);
  if ("response" in sessionResult) return sessionResult.response;

  try {
    const workspace = await service.getPanelWorkspace(sessionResult.session, unitId, panelId);
    if (!workspace) return errorResponse(request, "Panel catalog tidak ditemukan.", 404, "CATALOG_PANEL_NOT_FOUND");
    return successResponse(request, "Workspace panel catalog berhasil dimuat.", { workspace });
  } catch (error) {
    return mapCatalogError(request, error);
  }
}

export async function handleUnitCatalogPanelItemsBatchRoute(request: Request, unitId: string, panelId: number, authService: AuthService, service: UnitCatalogService) {
  const sessionResult = await requireUnitCatalogSession(request, authService, unitCatalogAdminPermissions);
  if ("response" in sessionResult) return sessionResult.response;
  const body = await parseJsonBody(request, saveCatalogWorkspaceRequestSchema);
  if (!body.success) return withCors(request, body.response);

  try {
    return successResponse(request, "Workspace catalog berhasil disimpan.", {
      workspace: await service.savePanelWorkspace(sessionResult.session, unitId, panelId, body.data),
    });
  } catch (error) {
    return mapCatalogError(request, error);
  }
}

export async function handleUnitCatalogItemsBulkRoute(request: Request, unitId: string, referenceId: number, authService: AuthService, service: UnitCatalogService) {
  const sessionResult = await requireUnitCatalogSession(request, authService, unitCatalogAdminPermissions);
  if ("response" in sessionResult) return sessionResult.response;
  const body = await parseJsonBody(request, saveCatalogWorkspaceRequestSchema.pick({ items: true }));
  if (!body.success) return withCors(request, body.response);

  try {
    const workspace = await service.getReference(sessionResult.session, unitId, referenceId);
    if (!workspace) throw new Error("CATALOG_REFERENCE_NOT_FOUND");
    return successResponse(request, "Item catalog berhasil disimpan.", {
      workspace: await service.savePanelWorkspace(sessionResult.session, unitId, workspace.panel.id, {
        referenceUrl: workspace.referenceUrl,
        notes: workspace.notes,
        media: workspace.media.map((media) => ({
          id: media.id,
          fileUrl: media.fileUrl,
          caption: media.caption,
          sortOrder: media.sortOrder,
        })),
        deletedMediaIds: [],
        deletedItemIds: [],
        items: body.data.items,
      }),
    });
  } catch (error) {
    return mapCatalogError(request, error);
  }
}

export async function handleUnitCatalogReferenceMediaRoute(request: Request, unitId: string, referenceId: number, authService: AuthService, service: UnitCatalogService) {
  const sessionResult = await requireUnitCatalogSession(request, authService, unitCatalogAdminPermissions);
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
  const sessionResult = await requireUnitCatalogSession(request, authService, unitCatalogSurveyPermissions);
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
    if (!item) return errorResponse(request, "Item catalog tidak ditemukan.", 404, "CATALOG_ITEM_NOT_FOUND");
    return successResponse(request, "Item catalog berhasil dimuat.", { item });
  } catch (error) {
    return mapCatalogError(request, error);
  }
}

export async function handleUnitCatalogSurveyRoute(request: Request, unitId: string, itemId: number, authService: AuthService, service: UnitCatalogService) {
  const sessionResult = await requireUnitCatalogSession(request, authService, unitCatalogSurveyPermissions);
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
  const sessionResult = await requireUnitCatalogSession(request, authService, unitCatalogSurveyPermissions);
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
  const sessionResult = await requireUnitCatalogSession(request, authService, unitCatalogSurveyPermissions);
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
  const sessionResult = await requireUnitCatalogSession(request, authService, unitCatalogSurveyPermissions);
  if ("response" in sessionResult) return sessionResult.response;

  try {
    return successResponse(request, "Foto pendataan berhasil dihapus.", await service.deleteMedia(sessionResult.session, unitId, itemId, mediaId));
  } catch (error) {
    return mapCatalogError(request, error);
  }
}

export async function handleUnitCatalogPromoteRoute(request: Request, unitId: string, itemId: number, authService: AuthService, service: UnitCatalogService) {
  const sessionResult = await requireUnitCatalogSession(request, authService, unitCatalogSurveyPermissions);
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
  const sessionResult = await requireUnitCatalogSession(
    request,
    authService,
    request.method === "GET" ? unitCatalogReadPermissions : unitCatalogJobdescPermissions,
  );
  if ("response" in sessionResult) return sessionResult.response;

  try {
    if (request.method === "POST") {
      const body = await parseJsonBody(request, createPanelJobdescsRequestSchema);
      if (!body.success) return withCors(request, body.response);
      return successResponse(request, "Jobdesc berhasil dibuat.", {
        jobdescs: await service.createPanelJobdescs(sessionResult.session, unitId, panelId, body.data),
      }, { status: 201 });
    }

    return successResponse(request, "Daftar jobdesc panel berhasil dimuat.", {
      jobdescs: await service.listPanelJobdescs(sessionResult.session, unitId, panelId),
    });
  } catch (error) {
    return mapCatalogError(request, error);
  }
}
