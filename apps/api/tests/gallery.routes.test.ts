import { SESSION_COOKIE_NAME } from "@smsystem/contracts/auth";
import type { AuthUser } from "@smsystem/contracts/auth";
import { permissionCodes } from "@smsystem/permissions";
import { describe, expect, test } from "bun:test";
import { createApiFetchHandler } from "@/app";
import type { AuthService } from "@/services/auth/auth.service";
import type { WebSession } from "@/services/auth/session.service";
import type { GalleryService } from "@/services/gallery.service";

const sampleUser: AuthUser = {
  employeeId: "SM-03.003",
  fullName: "Rifki Arischandra",
  email: null,
  roleId: 20,
  roleName: "mis",
  divisionId: 3,
  divisionName: "MANAGEMENT INFORMATION SYSTEM",
  grade: "MIS",
  permissions: [
    permissionCodes.galleryView,
    permissionCodes.galleryDownload,
    permissionCodes.galleryPhotoManage,
  ],
  scope: {
    canViewAllUnits: true,
    canViewAssignedUnits: false,
    divisionIds: [],
    managedDivisionIds: [],
    unitIds: [],
  },
};

const sampleSession: WebSession = {
  sessionId: "gallery-route-session-1",
  sessionKey: "session:gallery-route-1",
  employeeId: sampleUser.employeeId,
  refreshToken: "refresh-1",
  mobileSessionKey: "session:SM-03.003",
  deviceId: "web-device-1",
  user: sampleUser,
  createdAt: "2026-05-19T00:00:00.000Z",
};

function createStubAuthService(session: WebSession): AuthService {
  return {
    async login() {
      throw new Error("Not implemented");
    },
    async logout() {
      return [];
    },
    async refresh() {
      throw new Error("Not implemented");
    },
    async getCurrentSession() {
      return session;
    },
    async getCurrentUser() {
      return session.user;
    },
    async getCurrentPermissions() {
      return session.user.permissions;
    },
  };
}

function createStubGalleryService(): GalleryService {
  return {
    async listGallery() {
      return {
        data: [
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
            actualStatus: "onprogress" as const,
            countdownStatus: "PROSES",
            progressPercent: 45,
            photoCount: 2,
            beforeCount: 1,
            processCount: 1,
            afterCount: 0,
            defectCount: 0,
            submittedToLedger: false,
          },
        ],
        meta: {
          page: 1,
          limit: 25,
          total: 1,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
        query: {
          page: 1,
          limit: 25,
          search: "",
          sortBy: "latestPhotoAt" as const,
          sortDirection: "desc" as const,
          view: null,
          filters: [],
          date: "2026-05-19",
          unitId: null,
          divisionId: null,
          panelId: null,
          status: null,
          part: "",
          jobSearch: "",
        },
        references: {
          units: [{ value: "CAR-1", label: "MB 500 SEL" }],
          divisions: [{ value: "12", label: "INTERIOR" }],
          panels: [{ value: "55", label: "Dashboard" }],
          statuses: [{ value: "onprogress", label: "Sedang dikerjakan" }],
        },
      };
    },
    async getPhotos() {
      return {
        actual: {
          actualId: "ACT-1",
          planId: "PLAN-1",
          countdownId: "COUNT-1",
          workDate: "2026-05-19",
          carId: "CAR-1",
          unitName: "MB 500 SEL",
          divisionName: "INTERIOR",
          panelName: "Dashboard",
          partName: "Trim bawah dashboard",
          jobName: "Pasang ke unit",
          jobDescription: "Pasang trim bawah dashboard",
          employeeName: "Asep",
          actualStatus: "onprogress" as const,
          countdownStatus: "PROSES",
          submittedToLedger: false,
        },
        photos: [
          {
            photoId: "PHOTO-1",
            actualId: "ACT-1",
            photoType: "PROCESS" as const,
            photoUrl: "https://pub.example/gallery/process-1.jpg",
            caption: null,
            source: "TEMP" as const,
            uploadedBy: "SM-11.003",
            uploadedByName: "Asep",
            uploadedAt: "2026-05-19 09:00:00",
            canEdit: true,
            canDelete: true,
          },
        ],
      };
    },
    async createUploadTicket() {
      return {
        uploadUrl: "https://signed.example/upload",
        publicUrl: "https://pub.example/gallery/process-1.jpg",
        objectKey: "MB 500 SEL/INTERIOR/Mei/2026-05-19/process-1.jpg",
      };
    },
    async createPhoto() {
      return {
        photoId: "PHOTO-2",
        actualId: "ACT-1",
        photoType: "AFTER" as const,
        photoUrl: "https://pub.example/gallery/after-1.jpg",
        caption: "Hasil setelah pemasangan",
        source: "TEMP" as const,
        uploadedBy: "SM-03.003",
        uploadedByName: "Rifki Arischandra",
        uploadedAt: "2026-05-19 10:00:00",
        canEdit: true,
        canDelete: true,
      };
    },
    async updatePhoto(_session: WebSession, photoId: string) {
      return {
        photoId,
        actualId: "ACT-1",
        photoType: "AFTER" as const,
        photoUrl: "https://pub.example/gallery/after-2.jpg",
        caption: "Foto diganti",
        source: "TEMP" as const,
        uploadedBy: "SM-03.003",
        uploadedByName: "Rifki Arischandra",
        uploadedAt: "2026-05-19 10:30:00",
        canEdit: true,
        canDelete: true,
      };
    },
    async deletePhoto(_session: WebSession, photoId: string) {
      return { photoId };
    },
  };
}

describe("gallery routes", () => {
  test("lists gallery rows, opens photo detail, and mutates photos", async () => {
    const fetchHandler = createApiFetchHandler({
      authService: createStubAuthService(sampleSession),
      galleryService: createStubGalleryService(),
    });

    const listResponse = await fetchHandler(
      new Request("http://localhost/api/gallery?date=2026-05-19", {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=session:gallery-route-1`,
        },
      }),
    );
    expect(listResponse.status).toBe(200);
    const listBody = await listResponse.json();
    expect(listBody.data[0].actualId).toBe("ACT-1");

    const detailResponse = await fetchHandler(
      new Request("http://localhost/api/gallery/ACT-1/photos", {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=session:gallery-route-1`,
        },
      }),
    );
    expect(detailResponse.status).toBe(200);
    const detailBody = await detailResponse.json();
    expect(detailBody.data.photos[0].photoId).toBe("PHOTO-1");

    const ticketResponse = await fetchHandler(
      new Request(
        "http://localhost/api/gallery/upload-ticket?actualId=ACT-1&photoType=PROCESS&filename=process-1.jpg&contentType=image/jpeg",
        {
          headers: {
            cookie: `${SESSION_COOKIE_NAME}=session:gallery-route-1`,
          },
        },
      ),
    );
    expect(ticketResponse.status).toBe(200);
    const ticketBody = await ticketResponse.json();
    expect(ticketBody.data.publicUrl).toContain("pub.example");

    const createResponse = await fetchHandler(
      new Request("http://localhost/api/gallery/photos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: `${SESSION_COOKIE_NAME}=session:gallery-route-1`,
        },
        body: JSON.stringify({
          actualId: "ACT-1",
          photoType: "AFTER",
          photoUrl: "https://pub.example/gallery/after-1.jpg",
          caption: "Hasil setelah pemasangan",
        }),
      }),
    );
    expect(createResponse.status).toBe(201);

    const updateResponse = await fetchHandler(
      new Request("http://localhost/api/gallery/photos/PHOTO-2", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          cookie: `${SESSION_COOKIE_NAME}=session:gallery-route-1`,
        },
        body: JSON.stringify({
          photoType: "AFTER",
          photoUrl: "https://pub.example/gallery/after-2.jpg",
          caption: "Foto diganti",
        }),
      }),
    );
    expect(updateResponse.status).toBe(200);

    const deleteResponse = await fetchHandler(
      new Request("http://localhost/api/gallery/photos/PHOTO-2", {
        method: "DELETE",
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=session:gallery-route-1`,
        },
      }),
    );
    expect(deleteResponse.status).toBe(200);
  });

  test("blocks gallery list when view permission is missing", async () => {
    const fetchHandler = createApiFetchHandler({
      authService: createStubAuthService({
        ...sampleSession,
        user: {
          ...sampleUser,
          permissions: [],
        },
      }),
      galleryService: createStubGalleryService(),
    });

    const response = await fetchHandler(
      new Request("http://localhost/api/gallery?date=2026-05-19"),
    );

    expect(response.status).toBe(403);
  });
});
