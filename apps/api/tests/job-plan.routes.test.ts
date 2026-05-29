import { SESSION_COOKIE_NAME } from "@smsystem/contracts/auth";
import type { AuthUser } from "@smsystem/contracts/auth";
import { permissionCodes } from "@smsystem/permissions";
import { describe, expect, test } from "bun:test";
import { createApiFetchHandler } from "@/app";
import type { AuthService } from "@/services/auth/auth.service";
import type { JobPlanService } from "@/services/job-plan.service";
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
  scope: {
    canViewAllUnits: false,
    canViewAssignedUnits: true,
    divisionIds: [29],
    managedDivisionIds: [],
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

function createStubAuthService(overrides: Partial<AuthService> = {}): AuthService {
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
      return sampleSession;
    },
    async getCurrentUser() {
      return sampleUser;
    },
    async getCurrentPermissions() {
      return sampleUser.permissions;
    },
    ...overrides,
  };
}

function createStubJobPlanService(overrides: Partial<JobPlanService> = {}): JobPlanService {
  return {
    async list() {
      return {
        data: [
          {
            planId: "PLAN-1",
            coreId: "cd-1",
            taskDate: "2026-05-14",
            unitName: "MB 500 SEL",
            divisionId: 12,
            divisionName: "INTERIOR",
            assignedUserId: "SM-11.002",
            assignedUserName: "BUDI",
            targetHours: 4,
            startTime: "08:00",
            finishTime: "12:00",
            isOvertime: false,
            isPriority: false,
            status: "PENDING_MP",
            jobDescription: "Pasang ke unit",
            note: null,
            availablePlanHours: 6,
            remainingHours: 8,
            progressPercent: 10,
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
        references: {
          employees: [],
          divisions: [],
          units: [],
          countdowns: [],
          workOrders: [],
          panels: [],
          jobTypes: [],
          statuses: [],
        },
        query: {
          page: 1,
          limit: 25,
          search: "",
          sortBy: "taskDate",
          sortDirection: "asc",
          view: null,
          filters: [],
          date: "2026-05-14",
          window: "daily",
          mode: "normal",
          dateStart: "2026-05-14",
          dateEnd: "2026-05-14",
        },
        summary: {
          totalHours: 4,
          pendingCount: 1,
          approvedCount: 0,
          overtimeCount: 0,
        },
      };
    },
    async create() {
      return {
        createdIds: ["PLAN-1"],
        updatedPlanId: null,
        deletedPlanId: null,
        status: null,
      };
    },
    async createWorkspace() {
      return {
        createdIds: ["PLAN-WS-1"],
        updatedPlanId: null,
        deletedPlanId: null,
        status: null,
      };
    },
    async saveDraft() {
      return {
        createdIds: ["draft-1"],
        updatedPlanId: null,
        deletedPlanId: null,
        status: "DRAFT",
      };
    },
    async submitDrafts() {
      return {
        createdIds: ["PLAN-2"],
        updatedPlanId: null,
        deletedPlanId: null,
        status: null,
      };
    },
    async deleteDrafts() {
      return {
        createdIds: [],
        updatedPlanId: null,
        deletedPlanId: "draft-1",
        status: "DRAFT",
      };
    },
    async bulkCreate() {
      return {
        createdIds: ["PLAN-1"],
        updatedPlanId: null,
        deletedPlanId: null,
        status: null,
      };
    },
    async update() {
      return {
        createdIds: [],
        updatedPlanId: "PLAN-1",
        deletedPlanId: null,
        status: null,
      };
    },
    async updateStatus() {
      return {
        createdIds: [],
        updatedPlanId: "PLAN-1",
        deletedPlanId: null,
        status: "PLAN",
      };
    },
    async delete() {
      return {
        createdIds: [],
        updatedPlanId: null,
        deletedPlanId: "PLAN-1",
        status: null,
      };
    },
    async picLoad() {
      return {
        employeeId: "SM-11.002",
        taskDate: "2026-05-14",
        capacity: {
          normal: { used: 2, max: 8, remaining: 6 },
          overtime: { used: 0, max: 5, remaining: 5 },
        },
      };
    },
    async listToday() {
      return this.list(sampleSession, {
        page: 1,
        limit: 25,
        search: "",
        sortBy: "taskDate",
        sortDirection: "asc",
        view: null,
        filters: [],
        date: "2026-05-14",
        window: "daily",
        mode: "normal",
        dateStart: "2026-05-14",
        dateEnd: "2026-05-14",
      });
    },
    async listMyDivision() {
      return this.list(sampleSession, {
        page: 1,
        limit: 25,
        search: "",
        sortBy: "taskDate",
        sortDirection: "asc",
        view: null,
        filters: [],
        date: "2026-05-14",
        window: "daily",
        mode: "normal",
        dateStart: "2026-05-14",
        dateEnd: "2026-05-14",
      });
    },
    async exportFile(_session, _query, format) {
      if (format === "xlsx") {
        return {
          fileName: "job-plan.xlsx",
          contentType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          body: new Uint8Array([1, 2, 3]),
        };
      }

      return {
        fileName: "job-plan.csv",
        contentType: "text/csv; charset=utf-8",
        body: "planId,status\nPLAN-1,PENDING_MP\n",
      };
    },
    ...overrides,
  };
}

describe("job plan routes", () => {
  test("lists job plans and updates status", async () => {
    const fetchHandler = createApiFetchHandler({
      authService: createStubAuthService(),
      jobPlanService: createStubJobPlanService(),
    });

    const listResponse = await fetchHandler(
      new Request("http://localhost/api/job-plan?date=2026-05-14&mode=all", {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=session:SM-08.005:session-1`,
        },
      }),
    );

    expect(listResponse.status).toBe(200);
    const listBody = await listResponse.json();
    expect(listBody.data[0].planId).toBe("PLAN-1");

    const statusResponse = await fetchHandler(
      new Request("http://localhost/api/job-plan/PLAN-1/status", {
        method: "PATCH",
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=session:SM-08.005:session-1`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: "PLAN",
          note: "approved",
        }),
      }),
    );

    expect(statusResponse.status).toBe(200);
    const statusBody = await statusResponse.json();
    expect(statusBody.data.status).toBe("PLAN");
  });

  test("blocks route when permission missing", async () => {
    const fetchHandler = createApiFetchHandler({
      authService: createStubAuthService({
        async getCurrentSession() {
          return {
            ...sampleSession,
            user: {
              ...sampleSession.user,
              permissions: [],
            },
          };
        },
      }),
      jobPlanService: createStubJobPlanService(),
    });

    const response = await fetchHandler(
      new Request("http://localhost/api/job-plan", {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=session:SM-08.005:session-1`,
        },
      }),
    );

    expect(response.status).toBe(403);
  });

  test("rejects update when job plan already locked by active SPK", async () => {
    const fetchHandler = createApiFetchHandler({
      authService: createStubAuthService(),
      jobPlanService: createStubJobPlanService({
        async update() {
          throw new Error("PLAN_LOCKED");
        },
      }),
    });

    const response = await fetchHandler(
      new Request("http://localhost/api/job-plan/PLAN-1", {
        method: "PUT",
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=session:SM-08.005:session-1`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          assignedUserId: "SM-11.002",
          taskDate: "2026-05-14",
          targetHours: 4,
          jobDescription: "Pasang ke unit",
          isOvertime: false,
          isPriority: false,
        }),
      }),
    );

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.errorCode).toBe("PLAN_LOCKED");
  });

  test("exports xlsx format from job plan route", async () => {
    const fetchHandler = createApiFetchHandler({
      authService: createStubAuthService(),
      jobPlanService: createStubJobPlanService(),
    });

    const response = await fetchHandler(
      new Request("http://localhost/api/job-plan/export?date=2026-05-14&mode=all&format=xlsx", {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=session:SM-08.005:session-1`,
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    expect(response.headers.get("Content-Disposition")).toContain("job-plan.xlsx");
  });

  test("creates workspace job plan from popup flow", async () => {
    const fetchHandler = createApiFetchHandler({
      authService: createStubAuthService(),
      jobPlanService: createStubJobPlanService(),
    });

    const response = await fetchHandler(
      new Request("http://localhost/api/job-plan/workspace", {
        method: "POST",
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=session:SM-08.005:session-1`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: "normal",
          taskDate: "2026-05-19",
          deadlineDate: "2026-05-21",
          projectTargetHours: "008:00",
          isRework: false,
          rows: [
            {
              source: "countdown",
              referenceId: "cd-1",
              assignedUserId: "SM-11.002",
              targetHours: 4,
              startTime: "08:00",
              finishTime: "12:00",
              jobDescription: "Lanjut fitting interior",
              note: null,
              isPriority: false,
            },
          ],
        }),
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.createdIds[0]).toBe("PLAN-WS-1");
  });

  test("saves and submits drafts", async () => {
    const fetchHandler = createApiFetchHandler({
      authService: createStubAuthService(),
      jobPlanService: createStubJobPlanService(),
    });

    const saveDraftResponse = await fetchHandler(
      new Request("http://localhost/api/job-plan/draft", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: `${SESSION_COOKIE_NAME}=session:SM-08.005:session-1`,
        },
        body: JSON.stringify({
          replaceItems: false,
          items: [
            {
              draftItemId: "draft-1",
              sourceType: "COUNTDOWN",
              coreId: "cd-1",
              carId: "MB500SEL",
              unitName: "MB 500 SEL",
              divisionId: 12,
              divisionName: "INTERIOR",
              panelId: null,
              panelName: "Dashboard",
              jobTypeId: null,
              jobName: "Pasang ke unit",
              assignedUserId: "SM-11.002",
              assignedUserName: "BUDI",
              taskDate: "2026-05-14",
              targetHours: 2,
              startTime: "08:00",
              finishTime: "10:00",
              jobDescription: "Draft fitting",
              note: null,
              isOvertime: false,
              isPriority: false,
              deadlineDate: null,
              isRework: false,
            },
          ],
        }),
      }),
    );

    expect(saveDraftResponse.status).toBe(201);

    const submitDraftResponse = await fetchHandler(
      new Request("http://localhost/api/job-plan/draft/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: `${SESSION_COOKIE_NAME}=session:SM-08.005:session-1`,
        },
        body: JSON.stringify({
          draftItemIds: ["draft-1"],
        }),
      }),
    );

    expect(submitDraftResponse.status).toBe(200);
    const submitDraftBody = await submitDraftResponse.json();
    expect(submitDraftBody.data.createdIds[0]).toBe("PLAN-2");
  });
});
