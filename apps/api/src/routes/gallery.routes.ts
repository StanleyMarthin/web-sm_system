import { parseGridQueryParams } from "@smsystem/contracts/grid";
import {
  createGalleryPhotoRequestSchema,
  galleryPhotoTypeSchema,
  updateGalleryPhotoRequestSchema,
} from "@smsystem/contracts/gallery";
import { permissionCodes } from "@smsystem/permissions";
import { parseJsonBody } from "@/http/request";
import { errorResponse, successResponse, withCors } from "@/http/response";
import { requireSession } from "@/middleware/auth.middleware";
import { requirePermission } from "@/middleware/permission.middleware";
import type { AuthService } from "@/services/auth/auth.service";
import type { GalleryService } from "@/services/gallery.service";
import { sanitizeGalleryGridQuery } from "@/services/gallery/query";

async function requireGalleryViewSession(request: Request, authService: AuthService) {
  const sessionResult = await requireSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult;
  }

  const permissionResult = requirePermission(
    request,
    sessionResult.session,
    permissionCodes.galleryView,
  );
  if ("response" in permissionResult) {
    return permissionResult;
  }

  return { session: sessionResult.session };
}

async function requireGalleryManageSession(request: Request, authService: AuthService) {
  const sessionResult = await requireGalleryViewSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult;
  }

  const permissionResult = requirePermission(
    request,
    sessionResult.session,
    permissionCodes.galleryPhotoManage,
  );
  if ("response" in permissionResult) {
    return permissionResult;
  }

  return { session: sessionResult.session };
}

function mapGalleryError(request: Request, error: unknown): Response {
  if (error instanceof Error) {
    if (error.message === "ACTUAL_NOT_FOUND" || error.message === "PHOTO_NOT_FOUND") {
      return errorResponse(request, "Data foto tidak ditemukan.", 404, error.message);
    }

    if (error.message === "PHOTO_MUTATION_LOCKED") {
      return errorResponse(
        request,
        "Foto final tidak bisa diubah lagi dari galeri ini.",
        409,
        "PHOTO_MUTATION_LOCKED",
      );
    }

    if (error.message === "GALLERY_UPLOAD_NOT_CONFIGURED") {
      return errorResponse(
        request,
        "Upload foto belum siap di server saat ini.",
        503,
        "GALLERY_UPLOAD_NOT_CONFIGURED",
      );
    }

    if (error.message === "INVALID_UPLOAD_CONTENT_TYPE") {
      return errorResponse(
        request,
        "Tipe file upload tidak diizinkan.",
        400,
        "INVALID_UPLOAD_CONTENT_TYPE",
      );
    }

    if (error.message === "INVALID_UPLOAD_TICKET") {
      return errorResponse(
        request,
        "Upload ticket tidak valid atau sudah kedaluwarsa.",
        400,
        "INVALID_UPLOAD_TICKET",
      );
    }
  }

  return errorResponse(
    request,
    "Terjadi kesalahan internal pada galeri foto.",
    500,
    "GALLERY_MODULE_FAILED",
  );
}

export async function handleGalleryListRoute(
  request: Request,
  authService: AuthService,
  galleryService: GalleryService,
): Promise<Response> {
  const sessionResult = await requireGalleryViewSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const url = new URL(request.url);
    const query = sanitizeGalleryGridQuery({
      ...parseGridQueryParams(url.searchParams),
      date: url.searchParams.get("date") ?? new Date().toISOString().slice(0, 10),
      unitId: url.searchParams.get("unitId"),
      panelId: url.searchParams.get("panelId"),
      status: url.searchParams.get("status"),
      part: url.searchParams.get("part") ?? "",
      jobSearch: url.searchParams.get("jobSearch") ?? "",
    });
    const result = await galleryService.listGallery(sessionResult.session, query);

    return withCors(
      request,
      Response.json({
        success: true,
        message: "Gallery grid ready",
        data: result.data,
        meta: result.meta,
        references: result.references,
        query: result.query,
      }),
    );
  } catch (error) {
    return mapGalleryError(request, error);
  }
}

export async function handleGalleryPhotosRoute(
  request: Request,
  actualId: string,
  authService: AuthService,
  galleryService: GalleryService,
): Promise<Response> {
  const sessionResult = await requireGalleryViewSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const result = await galleryService.getPhotos(sessionResult.session, actualId);
    if (!result) {
      return errorResponse(request, "Data foto tidak ditemukan.", 404, "ACTUAL_NOT_FOUND");
    }

    return successResponse(request, "Gallery photos ready", result);
  } catch (error) {
    return mapGalleryError(request, error);
  }
}

export async function handleGalleryUploadTicketRoute(
  request: Request,
  authService: AuthService,
  galleryService: GalleryService,
): Promise<Response> {
  const sessionResult = await requireGalleryManageSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const url = new URL(request.url);
    const actualId = url.searchParams.get("actualId")?.trim() ?? "";
    const photoType = url.searchParams.get("photoType")?.trim() ?? "";
    const filename = url.searchParams.get("filename")?.trim() ?? "";
    const contentType = url.searchParams.get("contentType")?.trim() ?? "image/jpeg";

    if (!actualId || !photoType || !filename) {
      return errorResponse(
        request,
        "actualId, photoType, dan filename wajib diisi.",
        400,
        "MISSING_UPLOAD_TICKET_PARAM",
      );
    }

    const parsedPhotoType = galleryPhotoTypeSchema.safeParse(photoType);
    if (!parsedPhotoType.success) {
      return errorResponse(
        request,
        "Jenis foto yang dipilih belum valid.",
        400,
        "INVALID_GALLERY_PHOTO_TYPE",
      );
    }

    const ticket = await galleryService.createUploadTicket(
      sessionResult.session,
      {
        actualId,
        photoType: parsedPhotoType.data,
        filename,
        contentType,
      },
    );

    return successResponse(request, "Gallery upload ticket ready", ticket);
  } catch (error) {
    return mapGalleryError(request, error);
  }
}

export async function handleGalleryCreatePhotoRoute(
  request: Request,
  authService: AuthService,
  galleryService: GalleryService,
): Promise<Response> {
  const sessionResult = await requireGalleryManageSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  const parsedBody = await parseJsonBody(request, createGalleryPhotoRequestSchema);
  if (!parsedBody.success) {
    return parsedBody.response;
  }

  try {
    const photo = await galleryService.createPhoto(sessionResult.session, parsedBody.data);
    return successResponse(
      request,
      "Foto berhasil ditambahkan.",
      { photo },
      { status: 201 },
    );
  } catch (error) {
    return mapGalleryError(request, error);
  }
}

export async function handleGalleryUpdatePhotoRoute(
  request: Request,
  photoId: string,
  authService: AuthService,
  galleryService: GalleryService,
): Promise<Response> {
  const sessionResult = await requireGalleryManageSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  const parsedBody = await parseJsonBody(request, updateGalleryPhotoRequestSchema);
  if (!parsedBody.success) {
    return parsedBody.response;
  }

  try {
    const photo = await galleryService.updatePhoto(sessionResult.session, photoId, parsedBody.data);
    return successResponse(request, "Foto berhasil diperbarui.", { photo });
  } catch (error) {
    return mapGalleryError(request, error);
  }
}

export async function handleGalleryDeletePhotoRoute(
  request: Request,
  photoId: string,
  authService: AuthService,
  galleryService: GalleryService,
): Promise<Response> {
  const sessionResult = await requireGalleryManageSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const result = await galleryService.deletePhoto(sessionResult.session, photoId);
    return successResponse(request, "Foto berhasil dihapus.", result);
  } catch (error) {
    return mapGalleryError(request, error);
  }
}
