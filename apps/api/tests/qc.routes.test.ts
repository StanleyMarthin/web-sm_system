import { SESSION_COOKIE_NAME } from "@smsystem/contracts/auth";
import type { AuthUser } from "@smsystem/contracts/auth";
import { permissionCodes } from "@smsystem/permissions";
import { describe, expect, test } from "bun:test";
import { createApiFetchHandler } from "@/app";
import type { AuthService } from "@/services/auth/auth.service";
import type { QcService } from "@/services/qc.service";
import type { WebSession } from "@/services/auth/session.service";

const sampleUser: AuthUser = {
  employeeId: "SM-08.005",
  fullName: "Yudha Agustiana",
  email: null,
  roleId: 19,
  roleName: "kepala_produksi",
  divisionId: 12,
  divisionName: "INTERIOR",
  grade: "KP",
  permissions: [
    permissionCodes.qcView,
    permissionCodes.qcSubmit,
    permissionCodes.qcValidate,
  ],
  scope: {
    canViewAllUnits: false,
    canViewAssignedUnits: true,
    divisionIds: [12],
    managedDivisionIds: [12],
    unitIds: [],
  },
};

const sampleSession: WebSession = {
  sessionId: "qc-route-session-1",
  sessionKey: "session:qc-route-1",
  employeeId: sampleUser.employeeId,
  refreshToken: "refresh-1",
  mobileSessionKey: "session:SM-08.005",
  deviceId: "web-device-1",
  user: sampleUser,
  createdAt: "2026-05-14T00:00:00.000Z",
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

function createStubQcService(): QcService {
  return {
    async listQueue() {
      return {
        data: [
          {
            coreId: "CD-1",
            carId: "CAR-1",
            unitName: "MB 500 SEL",
            customerName: "Mr. Silmy",
            divisionId: 12,
            divisionName: "INTERIOR",
            panelId: 459,
            panelName: "Dashboard",
            taskCategory: "MAIN",
            jobName: "Pasang dashboard",
            countdownStatus: "READY_QC",
            qcLastStatus: null,
            qcLevel: null,
            latestQcId: null,
            refWoId: null,
            waitingHours: 2,
            remainingHours: 2,
            targetHours: 4,
            deadlineDate: "2026-05-14",
            latestInspectionDate: null,
            latestInspectionNotes: null,
            photoBeforeUrl: null,
            evidencePhotoUrl: null,
            reworkPlanId: null,
            reworkTaskDate: null,
            reworkAssignedUserId: null,
            reworkAssignedUserName: null,
            reworkPlanStatus: null,
            linkedIssueId: null,
            openIssueCount: 0,
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
          sortBy: "waitingHours",
          sortDirection: "desc" as const,
          view: null,
          filters: [],
        },
        references: {
          divisions: [],
          units: [],
          statuses: [],
          qcLevels: [],
        },
        summary: {
          readyCount: 1,
          recheckCount: 0,
          activeReworkCount: 0,
          finalReadyUnits: 0,
        },
      };
    },
    async listRework() {
      return {
        data: [],
        meta: {
          page: 1,
          limit: 25,
          total: 0,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
        query: {
          page: 1,
          limit: 25,
          search: "",
          sortBy: "waitingHours",
          sortDirection: "desc" as const,
          view: null,
          filters: [],
        },
        references: {
          divisions: [],
          units: [],
          statuses: [],
          qcLevels: [],
        },
        summary: {
          readyCount: 1,
          recheckCount: 0,
          activeReworkCount: 0,
          finalReadyUnits: 0,
        },
      };
    },
    async listRecheck() {
      return {
        data: [],
        meta: {
          page: 1,
          limit: 25,
          total: 0,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
        query: {
          page: 1,
          limit: 25,
          search: "",
          sortBy: "waitingHours",
          sortDirection: "desc" as const,
          view: null,
          filters: [],
        },
        references: {
          divisions: [],
          units: [],
          statuses: [],
          qcLevels: [],
        },
        summary: {
          readyCount: 1,
          recheckCount: 0,
          activeReworkCount: 0,
          finalReadyUnits: 0,
        },
      };
    },
    async findDetail() {
      return {
        item: {
          coreId: "CD-1",
          carId: "CAR-1",
          unitName: "MB 500 SEL",
          customerName: "Mr. Silmy",
          divisionId: 12,
          divisionName: "INTERIOR",
          panelId: 459,
          panelName: "Dashboard",
          taskCategory: "MAIN",
          jobName: "Pasang dashboard",
          countdownStatus: "READY_QC",
          qcLastStatus: null,
          qcLevel: null,
          latestQcId: null,
          refWoId: null,
          waitingHours: 2,
          remainingHours: 2,
          targetHours: 4,
          deadlineDate: "2026-05-14",
          latestInspectionDate: null,
          latestInspectionNotes: null,
          photoBeforeUrl: null,
          evidencePhotoUrl: null,
          reworkPlanId: null,
          reworkTaskDate: null,
          reworkAssignedUserId: null,
          reworkAssignedUserName: null,
          reworkPlanStatus: null,
          linkedIssueId: null,
          openIssueCount: 0,
        },
      };
    },
    async pass() {
      return {
        qcId: "QC-1",
        coreId: "CD-1",
        resultStatus: "LOLOS" as const,
        issueId: null,
        reworkPlanId: null,
      };
    },
    async reject() {
      return {
        qcId: "QC-2",
        coreId: "CD-1",
        resultStatus: "TIDAK_LOLOS" as const,
        issueId: "ISSUE-1",
        reworkPlanId: "PLAN-REWORK-1",
      };
    },
    async getFinalChecklist() {
      return {
        checklist: {
          carId: "CAR-1",
          unitName: "MB 500 SEL",
          customerName: "Mr. Silmy",
          targetDeliveryDate: "2026-05-20",
          totalTasks: 1,
          completedTasks: 1,
          passedTasks: 1,
          rejectedTasks: 0,
          openIssueCount: 0,
          isReadyForDelivery: true,
          approvedAt: null,
          approvedBy: null,
          notes: null,
        },
        items: [],
      };
    },
    async approveFinalChecklist() {
      return {
        carId: "CAR-1",
        approved: true as const,
        approvedAt: "2026-05-14 12:00:00",
      };
    },
  };
}

describe("qc routes", () => {
  test("lists ready queue and submits QC pass", async () => {
    const fetchHandler = createApiFetchHandler({
      authService: createStubAuthService(sampleSession),
      qcService: createStubQcService(),
    });

    const listResponse = await fetchHandler(
      new Request("http://localhost/api/qc/queue?page=1&limit=25", {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=session:qc-route-1`,
        },
      }),
    );

    expect(listResponse.status).toBe(200);
    const listBody = await listResponse.json();
    expect(listBody.data[0].coreId).toBe("CD-1");
    expect(listBody.summary.readyCount).toBe(1);

    const passResponse = await fetchHandler(
      new Request("http://localhost/api/qc/CD-1/pass", {
        method: "POST",
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=session:qc-route-1`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          notes: "Lolos QC",
          inspectionDurationMinutes: 12,
        }),
      }),
    );

    expect(passResponse.status).toBe(200);
    const passBody = await passResponse.json();
    expect(passBody.data.qcId).toBe("QC-1");
    expect(passBody.data.resultStatus).toBe("LOLOS");
  });

  test("blocks final checklist approval without QC_VALIDATE", async () => {
    const fetchHandler = createApiFetchHandler({
      authService: createStubAuthService({
        ...sampleSession,
        user: {
          ...sampleUser,
          permissions: [permissionCodes.qcView, permissionCodes.qcSubmit],
        },
      }),
      qcService: createStubQcService(),
    });

    const response = await fetchHandler(
      new Request("http://localhost/api/qc/final-checklist/CAR-1/approve", {
        method: "POST",
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=session:qc-route-1`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          notes: "Ready delivery",
        }),
      }),
    );

    expect(response.status).toBe(403);
  });
});
