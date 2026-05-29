import type { AuthUser } from "@smsystem/contracts/auth";
import type {
  GalleryPhotoRecord,
  GalleryRecord,
  GalleryPhotoType,
  GalleryPhotoSource,
} from "@smsystem/contracts/gallery";
import { describe, expect, test } from "bun:test";
import type { AuditService } from "@/services/audit/audit.service";
import type { WebSession } from "@/services/auth/session.service";
import { DefaultGalleryService, type GalleryUploadTicketProvider } from "@/services/gallery.service";
import type {
  GalleryPhotoContext,
  GalleryReferences,
  GalleryRepository,
} from "@/repositories/gallery.repo";

const sampleUser: AuthUser = {
  employeeId: "SM-03.003",
  fullName: "Rifki Arischandra",
  email: null,
  roleId: 20,
  roleName: "mis",
  divisionId: 3,
  divisionName: "MANAGEMENT INFORMATION SYSTEM",
  grade: "MIS",
  permissions: ["GALLERY_VIEW", "GALLERY_DOWNLOAD", "GALLERY_PHOTO_MANAGE"],
  scope: {
    canViewAllUnits: true,
    canViewAssignedUnits: false,
    divisionIds: [],
    managedDivisionIds: [],
    unitIds: [],
  },
};

const sampleSession: WebSession = {
  sessionId: "gallery-service-session-1",
  sessionKey: "session:gallery-service-1",
  employeeId: sampleUser.employeeId,
  refreshToken: "refresh-1",
  mobileSessionKey: "session:SM-03.003",
  deviceId: "web-device-1",
  user: sampleUser,
  createdAt: "2026-05-19T00:00:00.000Z",
};

const sampleContext: GalleryPhotoContext = {
  actualId: "ACT-1",
  planId: "PLAN-1",
  countdownId: "COUNT-1",
  carId: "CAR-1",
  unitName: "MB 500 SEL",
  divisionId: 12,
  divisionName: "INTERIOR",
  panelName: "Dashboard",
  partName: "Trim bawah dashboard",
  jobName: "Pasang ke unit",
  jobDescription: "Pasang trim bawah dashboard",
  employeeId: "SM-11.003",
  employeeName: "Asep",
  workDate: "2026-05-19",
  actualStatus: "onprogress",
  countdownStatus: "PROSES",
  submittedToLedger: false,
};

class InMemoryGalleryRepository implements GalleryRepository {
  createdPayload: Record<string, unknown> | null = null;
  updatedPayload: Record<string, unknown> | null = null;
  deletedPhotoId: string | null = null;

  async listRows() {
    return {
      rows: [
        {
          actualId: "ACT-1",
          planId: "PLAN-1",
          countdownId: "COUNT-1",
          workDate: "2026-05-19",
          latestPhotoAt: "2026-05-19 09:00:00",
          carId: "CAR-1",
          unitName: "MB 500 SEL",
          customerName: "Mr. Silmy",
          divisionId: 12,
          divisionName: "INTERIOR",
          panelId: 55,
          panelName: "Dashboard",
          partName: "Trim bawah dashboard",
          jobTypeId: "JOB-1",
          jobName: "Pasang ke unit",
          jobDescription: "Pasang trim bawah dashboard",
          employeeId: "SM-11.003",
          employeeName: "Asep",
          actualStatus: "onprogress",
          countdownStatus: "PROSES",
          progressPercent: 45,
          photoCount: 2,
          beforeCount: 1,
          processCount: 1,
          afterCount: 0,
          defectCount: 0,
          submittedToLedger: false,
        } satisfies GalleryRecord,
      ],
      total: 1,
    };
  }

  async listReferences(): Promise<GalleryReferences> {
    return {
      units: [{ value: "CAR-1", label: "MB 500 SEL" }],
      divisions: [{ value: "12", label: "INTERIOR" }],
      panels: [{ value: "55", label: "Dashboard" }],
      statuses: [{ value: "onprogress", label: "Sedang dikerjakan" }],
    };
  }

  async getActualContext() {
    return sampleContext;
  }

  async listPhotosByActualId() {
    return [
      {
        photoId: "PHOTO-1",
        actualId: "ACT-1",
        photoType: "PROCESS",
        photoUrl: "https://pub.example/gallery/process-1.jpg",
        caption: null,
        source: "TEMP",
        uploadedBy: "SM-11.003",
        uploadedByName: "Asep",
        uploadedAt: "2026-05-19 09:00:00",
        canEdit: true,
        canDelete: true,
      } satisfies GalleryPhotoRecord,
    ];
  }

  async findPhotoById(): Promise<GalleryPhotoRecord> {
    return {
      photoId: "PHOTO-1",
      actualId: "ACT-1",
      photoType: "PROCESS" satisfies GalleryPhotoType,
      photoUrl: "https://pub.example/gallery/process-1.jpg",
      caption: null,
      source: "TEMP" satisfies GalleryPhotoSource,
      uploadedBy: "SM-11.003",
      uploadedByName: "Asep",
      uploadedAt: "2026-05-19 09:00:00",
      canEdit: true,
      canDelete: true,
    };
  }

  async createPhoto(
    input: {
      actualId: string;
      photoType: GalleryPhotoType;
      photoUrl: string;
      caption?: string | null;
      uploadedBy: string;
      uploadedByName: string;
    },
  ): Promise<GalleryPhotoRecord> {
    this.createdPayload = input;
    return {
      photoId: "PHOTO-2",
      actualId: input.actualId,
      photoType: input.photoType,
      photoUrl: input.photoUrl,
      caption: input.caption ?? null,
      source: "TEMP",
      uploadedBy: input.uploadedBy,
      uploadedByName: "Rifki Arischandra",
      uploadedAt: "2026-05-19 10:00:00",
      canEdit: true,
      canDelete: true,
    };
  }

  async updatePhoto(
    photoId: string,
    input: {
      photoType?: GalleryPhotoType;
      photoUrl?: string;
      caption?: string | null;
    },
  ): Promise<GalleryPhotoRecord> {
    this.updatedPayload = { photoId, ...input };
    return {
      photoId,
      actualId: "ACT-1",
      photoType: input.photoType ?? "PROCESS",
      photoUrl: input.photoUrl ?? "https://pub.example/gallery/process-2.jpg",
      caption: input.caption ?? null,
      source: "TEMP",
      uploadedBy: "SM-03.003",
      uploadedByName: "Rifki Arischandra",
      uploadedAt: "2026-05-19 10:30:00",
      canEdit: true,
      canDelete: true,
    };
  }

  async deletePhoto(photoId: string) {
    this.deletedPhotoId = photoId;
  }
}

describe("DefaultGalleryService", () => {
  test("builds list result and creates upload ticket with sanitized key", async () => {
    const repository = new InMemoryGalleryRepository();
    const service = new DefaultGalleryService(
      repository,
      {
        async createTicket(input) {
          return {
            uploadUrl: "https://signed.example/upload",
            publicUrl: `https://pub.example/${input.objectKey}`,
            objectKey: input.objectKey,
          };
        },
      } satisfies GalleryUploadTicketProvider,
      {
        async log() {
          return;
        },
      } satisfies AuditService,
    );

    const list = await service.listGallery(sampleSession, {
      page: 1,
      limit: 25,
      search: "",
      sortBy: "latestPhotoAt",
      sortDirection: "desc",
      view: null,
      filters: [],
      date: "2026-05-19",
      unitId: null,
      divisionId: null,
      panelId: null,
      status: null,
      part: "",
      jobSearch: "",
    });

    expect(list.data[0]?.actualId).toBe("ACT-1");
    expect(list.references.units[0]?.value).toBe("CAR-1");

    const ticket = await service.createUploadTicket(sampleSession, {
      actualId: "ACT-1",
      photoType: "PROCESS",
      filename: "foto proses 1.jpg",
      contentType: "image/jpeg",
    });

    expect(ticket.publicUrl).toContain("MB 500 SEL");
    expect(ticket.objectKey).toContain("INTERIOR");
    expect(ticket.objectKey).toContain("_pro");
  });

  test("creates, updates, and deletes temp photos only", async () => {
    const repository = new InMemoryGalleryRepository();
    const service = new DefaultGalleryService(
      repository,
      {
        async createTicket() {
          return {
            uploadUrl: "https://signed.example/upload",
            publicUrl: "https://pub.example/file.jpg",
            objectKey: "path/file.jpg",
          };
        },
      } satisfies GalleryUploadTicketProvider,
      {
        async log() {
          return;
        },
      } satisfies AuditService,
    );

    const created = await service.createPhoto(sampleSession, {
      actualId: "ACT-1",
      photoType: "AFTER",
      photoUrl: "https://pub.example/gallery/after-1.jpg",
      caption: "Hasil akhir",
    });

    expect(created.photoId).toBe("PHOTO-2");
    expect(repository.createdPayload).toMatchObject({
      actualId: "ACT-1",
      photoType: "AFTER",
      uploadedBy: "SM-03.003",
    });

    const updated = await service.updatePhoto(sampleSession, "PHOTO-1", {
      photoType: "PROCESS",
      photoUrl: "https://pub.example/gallery/process-2.jpg",
      caption: "Foto diganti",
    });

    expect(updated.photoId).toBe("PHOTO-1");
    expect(repository.updatedPayload).toMatchObject({
      photoId: "PHOTO-1",
      photoUrl: "https://pub.example/gallery/process-2.jpg",
    });

    const deleted = await service.deletePhoto(sampleSession, "PHOTO-1");
    expect(deleted.photoId).toBe("PHOTO-1");
    expect(repository.deletedPhotoId).toBe("PHOTO-1");
  });
});
