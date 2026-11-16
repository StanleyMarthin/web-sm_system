import { SESSION_COOKIE_NAME } from "@smsystem/contracts/auth";
import type { AuthUser } from "@smsystem/contracts/auth";
import { permissionCodes } from "@smsystem/permissions";
import { describe, expect, test } from "bun:test";
import { createApiFetchHandler } from "@/app";
import type { AuthService } from "@/services/auth/auth.service";
import type { JobPlanService } from "@/services/job-plan/job-plan.service";
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
            panelName: "Dashboard",
            panelSectionName: "Dashboard",
            jobName: "Pasang",
            masterJobName: "Pasang",
            assignedUserId: "SM-11.002",
            assignedUserName: "BUDI",
            targetHours: 4,
            targetDailyHours: 4,
            targetTotalHours: 8,
            startTime: "08:00",
            finishTime: "12:00",
            isOvertime: false,
            isPriority: false,
            status: "PENDING_MP",
            jobDescription: "Pasang ke unit",
            instructionText: "Pasang ke unit",
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
    async saveDraft() {
      return {
        createdIds: ["draft-1"],
        updatedPlanId: null,
        deletedPlanId: null,
        status: "DRAFT",
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
  const legacyPlan = {
    coreId: "cd-1", assignedUserId: "SM-11.002", taskDate: "2026-05-14",
    targetHours: 1, jobDescription: "Work", isOvertime: false, isPriority: false,
  };
  const legacyWrites = [
    ["POST", "/api/job-plan", legacyPlan],
    ["POST", "/api/job-plan/bulk", { plans: [legacyPlan] }],
    ["POST", "/api/job-plan/workspace", {
      mode: "normal", taskDate: "2026-05-14", deadlineDate: "2026-05-14", projectTargetHours: "01:00",
      rows: [{ source: "countdown", referenceId: "cd-1", assignedUserId: "SM-11.002", targetHours: 1, jobDescription: "Work" }],
    }],
    ["POST", "/api/job-plan/draft/submit", { draftItemIds: ["draft-1"] }],
    ["PATCH", "/api/job-plan/PLAN-1/status", { status: "PLAN" }],
    ["PUT", "/api/job-plan/PLAN-1", { targetHours: 1 }],
    ["DELETE", "/api/job-plan/PLAN-1", undefined],
  ] as const;

  test.each(legacyWrites)("does not expose legacy SQL writer %s %s", async (method, path, body) => {
    let writes = 0;
    const legacyWrite = async () => {
      writes += 1;
      return { createdIds: ["UNEXPECTED"], updatedPlanId: null, deletedPlanId: null, status: null };
    };
    const service = {
      ...createStubJobPlanService(),
      create: legacyWrite, bulkCreate: legacyWrite, createWorkspace: legacyWrite,
      submitDrafts: legacyWrite, update: legacyWrite, updateStatus: legacyWrite, delete: legacyWrite,
    };
    const fetchHandler = createApiFetchHandler({ authService: createStubAuthService(), jobPlanService: service });
    const response = await fetchHandler(new Request(`http://localhost${path}`, {
      method,
      headers: { cookie: `${SESSION_COOKIE_NAME}=session:SM-08.005:session-1`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    }));
    expect(response.status).toBe(404);
    expect(writes).toBe(0);
  });

  test("passes the nontechnical flag and returns a classification conflict without changing a job type", async () => {
    let receivedFlag: boolean | undefined;
    const fetchHandler = createApiFetchHandler({
      authService: createStubAuthService(),
      jobPlanService: createStubJobPlanService({
        async createAdditionalCountdown(_session, input) {
          receivedFlag = input.isNonTechnicalJob;
          throw new Error("JOB_TYPE_CLASSIFICATION_MISMATCH");
        },
      }),
    });
    const response = await fetchHandler(new Request("http://localhost/api/job-plan/additional-countdown", {
      method: "POST",
      headers: { cookie: `${SESSION_COOKIE_NAME}=session:SM-08.005:session-1`, "Content-Type": "application/json" },
      body: JSON.stringify({ carId: "CAR-1", divisionId: 12, panelId: 11, jobTypeName: "Cleanup",
        taskDate: "2026-11-04", deadlineDate: "2026-11-04", targetHours: 1,
        jobDescription: "Cleanup", isNonTechnicalJob: true }),
    }));
    expect(receivedFlag).toBe(true);
    expect(response.status).toBe(409);
    expect((await response.json()).errorCode).toBe("JOB_TYPE_CLASSIFICATION_MISMATCH");
  });

  test("lists historical job plans", async () => {
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

  test("saves and deletes shared drafts", async () => {
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

    const deleteDraftResponse = await fetchHandler(
      new Request("http://localhost/api/job-plan/draft/delete", {
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

    expect(deleteDraftResponse.status).toBe(200);
    const deleteDraftBody = await deleteDraftResponse.json();
    expect(deleteDraftBody.data.deletedPlanId).toBe("draft-1");
  });
});


describe("supplemental task entry access", () => {
  test("allows a worker to load scoped references without granting normal planner permission", async () => {
    const memberSession = { ...sampleSession, user: { ...sampleUser, permissions: [permissionCodes.taskExecute] } };
    const handler = createApiFetchHandler({ authService: createStubAuthService({ async getCurrentSession() { return memberSession; } }), jobPlanService: createStubJobPlanService() });
    const headers = { cookie: `${SESSION_COOKIE_NAME}=session:SM-08.005:session-1` };
    expect((await handler(new Request("http://localhost/api/job-plan?date=2026-11-14", { headers }))).status).toBe(200);
    expect((await handler(new Request("http://localhost/api/job-plan/export?date=2026-11-14&format=xlsx", { headers }))).status).toBe(403);
  });
  test("keeps the supplemental flag through additional Countdown request validation", async () => {
    let received: boolean | undefined;
    const handler = createApiFetchHandler({ authService: createStubAuthService(), jobPlanService: createStubJobPlanService({
      async createAdditionalCountdown(_session, input) {
        received = input.urgent;
        return { coreId: "CORE-1", jobTypeId: "JOB-1", carId: input.carId, divisionId: input.divisionId, panelId: input.panelId, unitName: "Unit", divisionName: "Interior", isNewCore: true, isNewJobType: false };
      },
    }) });
    const response = await handler(new Request("http://localhost/api/job-plan/additional-countdown", { method: "POST",
      headers: { cookie: `${SESSION_COOKIE_NAME}=session:SM-08.005:session-1`, "Content-Type": "application/json" },
      body: JSON.stringify({ carId: "CAR-1", divisionId: 7, panelId: 1, jobTypeName: "Repair", taskDate: "2026-11-14", deadlineDate: "2026-11-14", targetHours: 1, jobDescription: "Repair", urgent: true, picPlan: "EMP-1", note: "[Tambahan] Instruksi baru" }),
    }));
    expect(response.status).toBe(201);
    expect(received).toBe(true);
  });
});


test("task read access alone cannot mutate supplemental drafts", async () => {
  const session = { ...sampleSession, user: { ...sampleUser, permissions: [permissionCodes.taskView] } };
  const handler = createApiFetchHandler({ authService: createStubAuthService({ async getCurrentSession() { return session; } }), jobPlanService: createStubJobPlanService() });
  const response = await handler(new Request("http://localhost/api/job-plan/draft/delete", { method: "POST",
    headers: { cookie: `${SESSION_COOKIE_NAME}=session:SM-08.005:session-1`, "Content-Type": "application/json" },
    body: JSON.stringify({ draftItemIds: ["request-1"] }),
  }));
  expect(response.status).toBe(403);
});
