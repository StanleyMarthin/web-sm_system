import {
  catalogMediaRequestSchema,
  catalogPanelImageRequestSchema,
  createAdditionalCatalogItemRequestSchema,
  createPanelJobdescsRequestSchema,
  openCatalogPanelRequestSchema,
  saveCatalogPanelsRequestSchema,
  saveCatalogWorkspaceRequestSchema,
  updateCatalogSurveyRequestSchema,
} from "@smsystem/contracts/unit-catalog";
import { permissionCodes } from "@smsystem/permissions";
import { getApiEnv } from "@/config/env";
import { parseJsonBody } from "@/http/request";
import { errorResponse, successResponse, withCors } from "@/http/response";
import { requireSession } from "@/middleware/auth.middleware";
import { requireAnyPermission } from "@/middleware/permission.middleware";
import { CatalogPanelDeleteConflictError } from "@/repositories/unit-catalog.repo";
import { S3GalleryUploadTicketProvider } from "@/services/storage/r2-upload.service";
import type { AuthService } from "@/services/auth/auth.service";
import { UnitCatalogService } from "@/services/unit-catalog.service";
import {
  assertImageMagicBytes,
  createUploadNonce,
  detectAllowedImageContentType,
  extensionForImageContentType,
  MAX_IMAGE_UPLOAD_BYTES,
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

interface UploadTicketEnvelope {
  success?: boolean;
  data?: {
    upload_url?: string;
    public_url?: string;
    uploadUrl?: string;
    publicUrl?: string;
  };
  message?: string;
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/$/u, "");
}

function resolveTasksBaseUrl(): string {
  const env = getApiEnv();
  if (env.SM_TASKS_BASE_URL) return stripTrailingSlash(env.SM_TASKS_BASE_URL);

  try {
    const loginUrl = new URL(env.SM_LOGIN_BASE_URL);
    loginUrl.port = "8086";
    loginUrl.pathname = "";
    loginUrl.search = "";
    loginUrl.hash = "";
    return stripTrailingSlash(loginUrl.toString());
  } catch {
    return "http://172.31.11.74:8086";
  }
}

async function requestTaskUploadTicket(objectKey: string, contentType: string): Promise<{
  uploadUrl: string;
  publicUrl: string;
}> {
  const ticketUrl = new URL(`${resolveTasksBaseUrl()}/sm/tasks/upload-ticket`);
  ticketUrl.searchParams.set("filename", objectKey);
  ticketUrl.searchParams.set("contentType", contentType);

  const response = await fetch(ticketUrl);
  const payload = (await response.json().catch(() => null)) as UploadTicketEnvelope | null;
  const data = payload?.data ?? {};
  const uploadUrl = data.upload_url ?? data.uploadUrl;
  const publicUrl = data.public_url ?? data.publicUrl;

  if (!response.ok || payload?.success === false || !uploadUrl || !publicUrl) {
    throw new Error(payload?.message || "UPLOAD_TICKET_FAILED");
  }

  return { uploadUrl, publicUrl };
}

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

async function requireCatalogMasterSession(
  request: Request,
  authService: AuthService,
  requiredPermissions: readonly string[] = unitCatalogReadPermissions,
) {
  return requireUnitCatalogSession(request, authService, requiredPermissions);
}

function mapCatalogError(request: Request, error: unknown): Response {
  if (error instanceof CatalogPanelDeleteConflictError) {
    return errorResponse(
      request,
      "Panel tidak dapat dihapus karena sudah digunakan.",
      409,
      "CATALOG_PANEL_DELETE_CONFLICT",
      error.conflict,
    );
  }
  if (error instanceof Error) {
    if (error.message === "UNIT_NOT_FOUND") return errorResponse(request, "Unit tidak ditemukan.", 404, "UNIT_NOT_FOUND");
    if (error.message === "CATALOG_PANEL_NOT_FOUND") return errorResponse(request, "Panel catalog tidak ditemukan.", 404, "CATALOG_PANEL_NOT_FOUND");
    if (error.message === "CATALOG_PANEL_DUPLICATE") return errorResponse(request, "Nama panel sudah ada pada komponen ini.", 409, "CATALOG_PANEL_DUPLICATE");
    if (error.message === "CATALOG_COMPONENT_NOT_FOUND") return errorResponse(request, "Komponen catalog tidak ditemukan.", 404, "CATALOG_COMPONENT_NOT_FOUND");
    if (error.message === "CATALOG_ITEM_NOT_FOUND") return errorResponse(request, "Item catalog tidak ditemukan.", 404, "CATALOG_ITEM_NOT_FOUND");
    if (error.message === "ADDITIONAL_ITEM_NOT_FOUND") return errorResponse(request, "Item tambahan tidak ditemukan.", 404, "ADDITIONAL_ITEM_NOT_FOUND");
    if (error.message === "CATALOG_REFERENCE_NOT_FOUND") return errorResponse(request, "Workspace catalog tidak ditemukan.", 404, "CATALOG_REFERENCE_NOT_FOUND");
    if (error.message === "UNIT_PANEL_NOT_FOUND") return errorResponse(request, "Master panel tidak ditemukan.", 404, "UNIT_PANEL_NOT_FOUND");
    if (error.message === "SURVEY_NOT_CONFIRMED") return errorResponse(request, "Pendataan harus CONFIRMED sebelum menjadi Master Panel.", 409, "SURVEY_NOT_CONFIRMED");
    if (error.message === "CATALOG_ITEM_MEDIA_REQUIRES_MASTER_PANEL") return errorResponse(request, "Foto aktual baru bisa disimpan setelah item dikonfirmasi ke Master Panel.", 409, "CATALOG_ITEM_MEDIA_REQUIRES_MASTER_PANEL");
    if (error.message === "GALLERY_UPLOAD_NOT_CONFIGURED") return errorResponse(request, "Upload gambar belum siap di server saat ini.", 503, "GALLERY_UPLOAD_NOT_CONFIGURED");
    if (error.message === "INVALID_UPLOAD_CONTENT_TYPE") return errorResponse(request, "Tipe file upload tidak diizinkan.", 400, "INVALID_UPLOAD_CONTENT_TYPE");
    if (error.message === "UPLOAD_SIZE_REQUIRED" || error.message === "INVALID_UPLOAD_SIZE") return errorResponse(request, "Ukuran file upload tidak valid.", 400, error.message);
    if (error.message === "UPLOAD_TOO_LARGE") return errorResponse(request, "Ukuran gambar maksimal 10MB.", 413, "UPLOAD_TOO_LARGE");
    if (error.message === "INVALID_IMAGE_BYTES") return errorResponse(request, "Isi file tidak sesuai dengan tipe gambar.", 400, "INVALID_IMAGE_BYTES");
    if (error.message === "UPLOAD_TICKET_FAILED") return errorResponse(request, "Upload ticket object storage gagal dibuat.", 502, "UPLOAD_TICKET_FAILED");
    if (error.message === "R2_UPLOAD_FAILED") return errorResponse(request, "Gagal mengupload gambar ke object storage.", 502, "R2_UPLOAD_FAILED");
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
      const body = await parseJsonBody(request, openCatalogPanelRequestSchema);
      if (!body.success) return withCors(request, body.response);
      return successResponse(request, "Panel catalog siap dipakai.", {
        workspace: await service.openPanel(sessionResult.session, unitId, body.data),
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

export async function handleCatalogComponentsRoute(request: Request, authService: AuthService, service: UnitCatalogService) {
  const sessionResult = await requireCatalogMasterSession(request, authService);
  if ("response" in sessionResult) return sessionResult.response;

  try {
    return successResponse(request, "Daftar komponen catalog berhasil dimuat.", {
      components: await service.listComponents(),
    });
  } catch (error) {
    return mapCatalogError(request, error);
  }
}

export async function handleCatalogComponentPanelsRoute(request: Request, componentId: number, authService: AuthService, service: UnitCatalogService) {
  const sessionResult = await requireCatalogMasterSession(request, authService);
  if ("response" in sessionResult) return sessionResult.response;

  try {
    return successResponse(request, "Daftar panel catalog berhasil dimuat.", {
      panels: await service.listPanelsByComponent(componentId),
    });
  } catch (error) {
    return mapCatalogError(request, error);
  }
}

export async function handleCatalogComponentPanelsBatchRoute(request: Request, componentId: number, authService: AuthService, service: UnitCatalogService) {
  const sessionResult = await requireCatalogMasterSession(request, authService, unitCatalogAdminPermissions);
  if ("response" in sessionResult) return sessionResult.response;
  const body = await parseJsonBody(request, saveCatalogPanelsRequestSchema);
  if (!body.success) return withCors(request, body.response);

  try {
    return successResponse(request, "Panel catalog berhasil disimpan.", {
      panels: await service.saveCatalogPanels(sessionResult.session, componentId, body.data),
    });
  } catch (error) {
    return mapCatalogError(request, error);
  }
}

export async function handleUnitCatalogPanelAliasRoute(request: Request, unitId: string, panelId: number, authService: AuthService, service: UnitCatalogService) {
  const sessionResult = await requireUnitCatalogSession(request, authService);
  if ("response" in sessionResult) return sessionResult.response;

  try {
    const workspace = await service.getPanelWorkspace(sessionResult.session, unitId, panelId);
    if (!workspace) return errorResponse(request, "Panel catalog tidak ditemukan.", 404, "CATALOG_PANEL_NOT_FOUND");
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

export async function handleUnitCatalogPanelItemsAliasRoute(request: Request, unitId: string, panelId: number, authService: AuthService, service: UnitCatalogService) {
  const sessionResult = await requireUnitCatalogSession(request, authService, unitCatalogAdminPermissions);
  if ("response" in sessionResult) return sessionResult.response;
  const body = await parseJsonBody(request, saveCatalogWorkspaceRequestSchema.pick({ items: true, deletedItemIds: true }));
  if (!body.success) return withCors(request, body.response);

  try {
    const workspace = await service.getPanelWorkspace(sessionResult.session, unitId, panelId);
    if (!workspace) throw new Error("CATALOG_PANEL_NOT_FOUND");
    return successResponse(request, "Item catalog berhasil disimpan.", {
      workspace: await service.savePanelWorkspace(sessionResult.session, unitId, workspace.panel.id, {
        deletedItemIds: body.data.deletedItemIds,
        panelImages: workspace.panelImages.map((media) => ({
          id: media.id,
          fileUrl: media.fileUrl,
          caption: media.caption,
          sortOrder: media.sortOrder,
        })),
        deletedPanelImageIds: [],
        items: body.data.items,
      }),
    });
  } catch (error) {
    return mapCatalogError(request, error);
  }
}

export async function handleUnitCatalogPanelMediaAliasRoute(request: Request, unitId: string, panelId: number, authService: AuthService, service: UnitCatalogService) {
  const sessionResult = await requireUnitCatalogSession(request, authService, unitCatalogAdminPermissions);
  if ("response" in sessionResult) return sessionResult.response;
  const body = await parseJsonBody(request, catalogPanelImageRequestSchema);
  if (!body.success) return withCors(request, body.response);

  try {
    return successResponse(request, "Gambar catalog berhasil disimpan.", {
      media: await service.addPanelImage(sessionResult.session, unitId, panelId, body.data),
    }, { status: 201 });
  } catch (error) {
    return mapCatalogError(request, error);
  }
}

export async function handleUnitCatalogAdditionalRoute(request: Request, unitId: string, authService: AuthService, service: UnitCatalogService) {
  const sessionResult = await requireUnitCatalogSession(request, authService, unitCatalogAdminPermissions);
  if ("response" in sessionResult) return sessionResult.response;
  const body = await parseJsonBody(request, createAdditionalCatalogItemRequestSchema);
  if (!body.success) return withCors(request, body.response);

  try {
    return successResponse(request, "Item tambahan berhasil dibuat.", {
      item: await service.createAdditionalItem(sessionResult.session, unitId, body.data),
    }, { status: 201 });
  } catch (error) {
    return mapCatalogError(request, error);
  }
}

export async function handleUnitCatalogAdditionalPromoteRoute(request: Request, unitId: string, itemId: number, authService: AuthService, service: UnitCatalogService) {
  const sessionResult = await requireUnitCatalogSession(request, authService, unitCatalogSurveyPermissions);
  if ("response" in sessionResult) return sessionResult.response;

  try {
    return successResponse(request, "Item tambahan berhasil diproses ke Master Panel.", {
      result: await service.promoteAdditionalItem(sessionResult.session, unitId, itemId),
    });
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

export async function handleUnitCatalogPanelImageUploadRoute(request: Request, unitId: string, authService: AuthService) {
  const sessionResult = await requireUnitCatalogSession(request, authService, unitCatalogAdminPermissions);
  if ("response" in sessionResult) return sessionResult.response;

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!file || typeof file === "string") {
      return errorResponse(request, "File gambar wajib diisi.", 400, "MISSING_FILE");
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.byteLength <= 0) throw new Error("INVALID_UPLOAD_SIZE");
    if (bytes.byteLength > MAX_IMAGE_UPLOAD_BYTES) throw new Error("UPLOAD_TOO_LARGE");
    const contentType = detectAllowedImageContentType(bytes);
    if (!contentType) throw new Error("INVALID_IMAGE_BYTES");
    const extension = extensionForImageContentType(contentType);
    assertImageMagicBytes(contentType, bytes);

    const objectKey = `catalog-panels/${unitId}/${sessionResult.session.employeeId}/${createUploadNonce()}.${extension}`;
    const ticket = await requestTaskUploadTicket(objectKey, contentType);
    const uploadResponse = await fetch(ticket.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: bytes,
    });
    if (!uploadResponse.ok) {
      const body = await uploadResponse.text().catch(() => "");
      console.error("[unit-catalog] panel image upload failed", {
        status: uploadResponse.status,
        body: body.slice(0, 500),
      });
      throw new Error("R2_UPLOAD_FAILED");
    }

    return successResponse(request, "Gambar siap disimpan.", { publicUrl: ticket.publicUrl });
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
