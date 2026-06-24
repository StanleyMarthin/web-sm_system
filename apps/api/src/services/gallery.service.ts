import {
  type CreateGalleryPhotoRequest,
  type GalleryActualSummary,
  type GalleryPhotoRecord,
  type GalleryPhotoType,
  type GalleryQuery,
  type UpdateGalleryPhotoRequest,
} from "@smsystem/contracts/gallery";
import { DefaultAuditService, type AuditService } from "@/services/audit/audit.service";
import { MySqlAuditRepository } from "@/repositories/audit.repo";
import {
  MySqlGalleryRepository,
  type GalleryRepository,
} from "@/repositories/gallery.repo";
import { getApiEnv } from "@/config/env";
import type { WebSession } from "@/services/auth/session.service";
import { S3GalleryUploadTicketProvider } from "@/services/storage/r2-upload.service";
import {
  consumeUploadTicketForPublicUrl,
  createUploadNonce,
  extensionForImageContentType,
  normalizeAllowedImageContentType,
  storeUploadTicket,
} from "@/security/upload-ticket";

const INDONESIAN_MONTHS = [
  "",
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
] as const;

function buildMeta(page: number, limit: number, total: number) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

function sanitizePath(value: string): string {
  return value
    .replaceAll("/", "-")
    .replaceAll(/[^\w\- ]/gu, "_")
    .trim();
}

function buildPhotoSuffix(photoType: GalleryPhotoType): string {
  switch (photoType) {
    case "BEFORE":
      return "bef";
    case "AFTER":
      return "aft";
    case "DEFECT":
      return "dft";
    default:
      return "pro";
  }
}

export interface GalleryUploadTicketProvider {
  createTicket(input: {
    objectKey: string;
    contentType: string;
    contentLength: number;
  }): Promise<{
    uploadUrl: string;
    publicUrl: string;
    objectKey: string;
  }>;
}

export interface GalleryService {
  listGallery(session: WebSession, query: GalleryQuery): Promise<{
    data: Awaited<ReturnType<GalleryRepository["listRows"]>>["rows"];
    meta: ReturnType<typeof buildMeta>;
    query: GalleryQuery;
    references: Awaited<ReturnType<GalleryRepository["listReferences"]>>;
  }>;
  getPhotos(session: WebSession, actualId: string): Promise<{
    actual: GalleryActualSummary;
    photos: GalleryPhotoRecord[];
  } | null>;
  createUploadTicket(
    session: WebSession,
    input: {
      actualId: string;
      photoType: GalleryPhotoType;
      filename: string;
      contentType: string;
      contentLength: number;
    },
  ): Promise<{
    uploadUrl: string;
    publicUrl: string;
    objectKey: string;
  }>;
  createPhoto(
    session: WebSession,
    input: CreateGalleryPhotoRequest,
  ): Promise<GalleryPhotoRecord>;
  updatePhoto(
    session: WebSession,
    photoId: string,
    input: UpdateGalleryPhotoRequest,
  ): Promise<GalleryPhotoRecord>;
  deletePhoto(session: WebSession, photoId: string): Promise<{ photoId: string }>;
}

export class DefaultGalleryService implements GalleryService {
  constructor(
    private readonly repository: GalleryRepository = new MySqlGalleryRepository(),
    private readonly uploadTicketProvider: GalleryUploadTicketProvider =
      new S3GalleryUploadTicketProvider(getApiEnv()),
    private readonly auditService: AuditService = new DefaultAuditService(
      new MySqlAuditRepository(),
    ),
  ) {}

  async listGallery(session: WebSession, query: GalleryQuery) {
    const [listResult, references] = await Promise.all([
      this.repository.listRows({
        employeeId: session.user.employeeId,
        scope: session.user.scope,
        query,
      }),
      this.repository.listReferences({
        employeeId: session.user.employeeId,
        scope: session.user.scope,
        date: query.date,
      }),
    ]);

    return {
      data: listResult.rows,
      meta: buildMeta(query.page, query.limit, listResult.total),
      query,
      references,
    };
  }

  async getPhotos(session: WebSession, actualId: string) {
    const actual = await this.repository.getActualContext({
      employeeId: session.user.employeeId,
      scope: session.user.scope,
      actualId,
    });
    if (!actual) {
      return null;
    }

    const photos = await this.repository.listPhotosByActualId({
      employeeId: session.user.employeeId,
      scope: session.user.scope,
      actualId,
    });

    return {
      actual: {
        actualId: actual.actualId,
        planId: actual.planId,
        countdownId: actual.countdownId,
        workDate: actual.workDate,
        carId: actual.carId,
        unitName: actual.unitName,
        divisionName: actual.divisionName,
        panelName: actual.panelName,
        partName: actual.partName,
        jobName: actual.jobName,
        jobDescription: actual.jobDescription,
        employeeName: actual.employeeName,
        actualStatus: actual.actualStatus,
        countdownStatus: actual.countdownStatus,
        submittedToLedger: actual.submittedToLedger,
      },
      photos,
    };
  }

  async createUploadTicket(
    session: WebSession,
    input: {
      actualId: string;
      photoType: GalleryPhotoType;
      filename: string;
      contentType: string;
      contentLength: number;
    },
  ) {
    const actual = await this.repository.getActualContext({
      employeeId: session.user.employeeId,
      scope: session.user.scope,
      actualId: input.actualId,
    });

    if (!actual) {
      throw new Error("ACTUAL_NOT_FOUND");
    }

    if (actual.submittedToLedger) {
      throw new Error("PHOTO_MUTATION_LOCKED");
    }

    const workDate = new Date(`${actual.workDate}T00:00:00`);
    const monthFolder = INDONESIAN_MONTHS[workDate.getUTCMonth() + 1] ?? "Unknown";
    const safeJob = sanitizePath(actual.jobName || actual.jobDescription || "Jobdesc");
    const safePanel = sanitizePath(actual.partName || actual.panelName || "Panel");
    const safeDivision = sanitizePath(actual.divisionName || "DIVISI");
    const safeUnit = sanitizePath(actual.unitName || actual.carId);
    const contentType = normalizeAllowedImageContentType(input.contentType);
    const safeExtension = extensionForImageContentType(contentType);
    const nonce = createUploadNonce();
    const suffix = buildPhotoSuffix(input.photoType);
    const objectKey =
      `${safeUnit}/${safeDivision}/${monthFolder}/${actual.workDate}/` +
      `${safeJob} ${safePanel}_${suffix}_${nonce}.${safeExtension}`;

    const ticket = await this.uploadTicketProvider.createTicket({
      objectKey,
      contentType,
      contentLength: input.contentLength,
    });

    await storeUploadTicket({
      nonce,
      employeeId: session.user.employeeId,
      objectKey,
    });

    return ticket;
  }

  async createPhoto(session: WebSession, input: CreateGalleryPhotoRequest) {
    const actual = await this.repository.getActualContext({
      employeeId: session.user.employeeId,
      scope: session.user.scope,
      actualId: input.actualId,
    });

    if (!actual) {
      throw new Error("ACTUAL_NOT_FOUND");
    }

    if (actual.submittedToLedger) {
      throw new Error("PHOTO_MUTATION_LOCKED");
    }

    await consumeUploadTicketForPublicUrl({
      employeeId: session.user.employeeId,
      publicUrl: input.photoUrl,
    });

    const photo = await this.repository.createPhoto({
      actualId: input.actualId,
      photoType: input.photoType,
      photoUrl: input.photoUrl,
      caption: input.caption ?? null,
      uploadedBy: session.user.employeeId,
      uploadedByName: session.user.fullName,
    });

    await this.auditService.log({
      actorId: session.user.employeeId,
      actorName: session.user.fullName,
      action: "gallery.photo.create",
      module: "gallery",
      recordId: photo.photoId,
      newValue: input,
    });

    return photo;
  }

  async updatePhoto(
    session: WebSession,
    photoId: string,
    input: UpdateGalleryPhotoRequest,
  ) {
    const existing = await this.repository.findPhotoById({
      employeeId: session.user.employeeId,
      scope: session.user.scope,
      photoId,
    });

    if (!existing) {
      throw new Error("PHOTO_NOT_FOUND");
    }

    if (existing.source !== "TEMP" || !existing.canEdit) {
      throw new Error("PHOTO_MUTATION_LOCKED");
    }

    if (input.photoUrl) {
      await consumeUploadTicketForPublicUrl({
        employeeId: session.user.employeeId,
        publicUrl: input.photoUrl,
      });
    }

    const updated = await this.repository.updatePhoto(photoId, input);
    await this.auditService.log({
      actorId: session.user.employeeId,
      actorName: session.user.fullName,
      action: "gallery.photo.update",
      module: "gallery",
      recordId: updated.photoId,
      oldValue: existing,
      newValue: input,
    });

    return updated;
  }

  async deletePhoto(session: WebSession, photoId: string) {
    const existing = await this.repository.findPhotoById({
      employeeId: session.user.employeeId,
      scope: session.user.scope,
      photoId,
    });

    if (!existing) {
      throw new Error("PHOTO_NOT_FOUND");
    }

    if (existing.source !== "TEMP" || !existing.canDelete) {
      throw new Error("PHOTO_MUTATION_LOCKED");
    }

    await this.repository.deletePhoto(photoId);
    await this.auditService.log({
      actorId: session.user.employeeId,
      actorName: session.user.fullName,
      action: "gallery.photo.delete",
      module: "gallery",
      recordId: photoId,
      oldValue: existing,
    });

    return { photoId };
  }
}
