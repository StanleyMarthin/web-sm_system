import { SESSION_COOKIE_NAME } from "@smsystem/contracts/auth";
import type { AuthUser } from "@smsystem/contracts/auth";
import { permissionCodes } from "@smsystem/permissions";
import { describe, expect, test } from "bun:test";
import { createApiFetchHandler } from "@/app";
import type { AuthService } from "@/services/auth/auth.service";
import type { SpkService } from "@/services/spk.service";
import type { WebSession } from "@/services/auth/session.service";

const sampleUser: AuthUser = {
  employeeId: "SM-08.005",
  fullName: "YUDHA AGUSTIANA",
  email: null,
  roleId: 19,
  roleName: "kepala_produksi",
  divisionId: 29,
  divisionName: "MANAGER PRODUKSI",
  grade: "KEPALA PRODUKSI",
  permissions: [permissionCodes.updatePlan],
  roleProfile: {
    roleLevel: 300,
    scopeBasis: "OWN_DIVISION",
    webEnabled: true,
    mobileEnabled: true,
    approvalRank: 3,
    notes: null,
  },
  scope: {
    canViewAllUnits: false,
    canViewAssignedUnits: true,
    divisionIds: [29],
    managedDivisionIds: [],
    unitIds: [],
  },
};

const globalUser: AuthUser = {
  ...sampleUser,
  employeeId: "SM-03.004",
  fullName: "Sahrul Riswanto",
  roleId: 20,
  roleName: "mis",
  divisionId: 3,
  divisionName: "MANAGEMENT INFORMATION SYSTEM",
  permissions: [permissionCodes.updatePlan, permissionCodes.viewAllUnits],
  scope: {
    canViewAllUnits: true,
    canViewAssignedUnits: false,
    divisionIds: [3],
    managedDivisionIds: [3],
    unitIds: [],
  },
};

const sampleSession: WebSession = {
  sessionId: "session-1",
  sessionKey: "session:SM-08.005:session-1",
  employeeId: sampleUser.employeeId,
  refreshToken: "refresh-1",
  mobileSessionKey: "session:SM-08.005",
  deviceId: "web-device-1",
  user: sampleUser,
  createdAt: "2026-05-13T00:00:00.000Z",
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

function createStubSpkService(overrides: Partial<SpkService> = {}): SpkService {
  return {
    async list() {
      return {
        data: [
          {
            spkId: "SPK-1",
            spkNumber: "SPK-20260515-001",
            spkDate: "2026-05-15",
            status: "DRAFT",
            totalUnits: 1,
            totalHours: 4,
            createdBy: "Sahrul Riswanto",
            approvedBy: null,
            rejectReason: null,
            notes: null,
            createdAt: "2026-05-14 10:00:00",
            submittedAt: null,
            approvedAt: null,
            activatedAt: null,
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
          sortBy: "spkDate",
          sortDirection: "desc",
          view: null,
          filters: [],
          date: "2026-05-15",
        },
        summary: {
          pendingApproval: 1,
        },
        storageReady: false,
      };
    },
    async preview() {
      return {
        rows: [
          {
            planId: "PLAN-1",
            unitName: "MB 500 SEL",
            divisionName: "INTERIOR",
            jobName: "Pasang ke unit",
            picName: "BUDI",
            targetHours: 4,
            targetDate: "2026-05-15",
          },
        ],
        totalUnits: 1,
        totalHours: 4,
      };
    },
    async generate() {
      return { spkId: "SPK-1" };
    },
    async findDetail() {
      return {
        header: {
          spkId: "SPK-1",
          spkNumber: "SPK-20260515-001",
          spkDate: "2026-05-15",
          status: "SUBMITTED",
          totalUnits: 1,
          totalHours: 4,
          createdBy: "Sahrul Riswanto",
          approvedBy: null,
          rejectReason: null,
          notes: null,
          createdAt: "2026-05-14 10:00:00",
          submittedAt: "2026-05-14 11:00:00",
          approvedAt: null,
          activatedAt: null,
        },
        details: [],
      };
    },
    async submit() {
      return { spkId: "SPK-1", status: "SUBMITTED" as const };
    },
    async approve() {
      return { spkId: "SPK-1", status: "APPROVED" as const };
    },
    async reject() {
      return { spkId: "SPK-1", status: "REJECTED" as const };
    },
    async activate() {
      return { spkId: "SPK-1", status: "ACTIVE" as const };
    },
    async markDone() {
      return { spkId: "SPK-1", status: "DONE" as const };
    },
    async updateDraftDetails() {
      return { spkId: "SPK-1", detailCount: 1 };
    },
    async approveItem() {
      return { spkId: "SPK-1", detailId: "SPKD-1", approvalState: "APPROVED" as const };
    },
    async today() {
      return [];
    },
    async summary() {
      return { pendingApproval: 1 };
    },
    ...overrides,
  };
}

describe("spk routes", () => {
  test("lists preview and generates SPK", async () => {
    const fetchHandler = createApiFetchHandler({
      authService: createStubAuthService({
        ...sampleSession,
        user: globalUser,
      }),
      spkService: createStubSpkService(),
    });

    const previewResponse = await fetchHandler(
      new Request("http://localhost/api/spk/preview?date=2026-05-15", {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=session:global`,
        },
      }),
    );

    expect(previewResponse.status).toBe(200);
    const previewBody = await previewResponse.json();
    expect(previewBody.data.rows[0].planId).toBe("PLAN-1");

    const listResponse = await fetchHandler(
      new Request("http://localhost/api/spk?date=2026-05-15", {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=session:global`,
        },
      }),
    );

    expect(listResponse.status).toBe(200);
    const listBody = await listResponse.json();
    expect(listBody.storageReady).toBe(false);

    const generateResponse = await fetchHandler(
      new Request("http://localhost/api/spk/generate", {
        method: "POST",
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=session:global`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          spkDate: "2026-05-15",
          notes: null,
        }),
      }),
    );

    expect(generateResponse.status).toBe(201);
    const generateBody = await generateResponse.json();
    expect(generateBody.data.spkId).toBe("SPK-1");
  });

  test("blocks approval route when session is not global scope", async () => {
    const fetchHandler = createApiFetchHandler({
      authService: createStubAuthService(sampleSession),
      spkService: createStubSpkService(),
    });

    const response = await fetchHandler(
      new Request("http://localhost/api/spk/SPK-1/approve", {
        method: "PATCH",
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=session:SM-08.005`,
        },
      }),
    );

    expect(response.status).toBe(403);
  });

  test("allows planner draft activation for approval rank without global scope", async () => {
    const fetchHandler = createApiFetchHandler({
      authService: createStubAuthService(sampleSession),
      spkService: createStubSpkService(),
    });

    const response = await fetchHandler(
      new Request("http://localhost/api/spk/SPK-1/activate", {
        method: "PATCH",
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=session:SM-08.005`,
        },
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.status).toBe("ACTIVE");
  });

  test("returns 503 when SPK storage is not ready", async () => {
    const fetchHandler = createApiFetchHandler({
      authService: createStubAuthService({
        ...sampleSession,
        user: globalUser,
      }),
      spkService: createStubSpkService({
        async generate() {
          throw new Error("SPK_STORAGE_NOT_READY");
        },
      }),
    });

    const response = await fetchHandler(
      new Request("http://localhost/api/spk/generate", {
        method: "POST",
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=session:global`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          spkDate: "2026-05-15",
          notes: null,
        }),
      }),
    );

    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.errorCode).toBe("SPK_STORAGE_NOT_READY");
  });
});
