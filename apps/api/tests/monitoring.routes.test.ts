import { SESSION_COOKIE_NAME } from "@smsystem/contracts/auth";
import type { AuthUser } from "@smsystem/contracts/auth";
import { describe, expect, test } from "bun:test";
import { createApiFetchHandler } from "@/app";
import type { AuthService } from "@/services/auth/auth.service";
import type { WebSession } from "@/services/auth/session.service";
import type { MonitoringService } from "@/services/monitoring.service";
import type { MonitoringTaskRecord } from "@smsystem/contracts/monitoring";

const sampleUser: AuthUser = {
  employeeId: "SM-03.004",
  fullName: "Sahrul Riswanto",
  email: null,
  roleId: 20,
  roleName: "mis",
  divisionId: 3,
  divisionName: "MANAGEMENT INFORMATION SYSTEM",
  grade: "MIS",
  permissions: ["LIST_CAR_PROGRESS", "CAR_PROGRESS_DETAIL", "view_all_units"],
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
  sessionKey: "session:SM-03.004:session-1",
  employeeId: sampleUser.employeeId,
  refreshToken: "refresh-1",
  mobileSessionKey: "session:SM-03.004",
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

function createStubMonitoringService(): MonitoringService {
  const taskRow: MonitoringTaskRecord = {
    planId: "PLAN-1",
    coreId: "CD-1",
    carId: "CAR-1",
    unitName: "MB 500 SEL",
    customerName: "Mr. Silmy",
    divisionId: 12,
    divisionName: "INTERIOR",
    employeeId: "SM-11.002",
    employeeName: "Agus Rusmawan",
    taskDate: "2026-05-14",
    panelName: "Dashboard",
    masterJobName: "Turun Dashboard",
    jobDescription: "Turunkan dashboard",
    instructionText: "Turunkan dashboard",
    targetDailyHours: 4,
    targetTotalHours: 8,
    planStatus: "ONPROGRESS",
    actualStatus: "onprogress",
    executionStatus: "ONPROGRESS",
    countdownStatus: "PROSES",
    progressPercent: 25,
    totalActualHours: 1.5,
    remainingHours: 6.5,
    latestStartTime: "2026-05-14 08:00:00",
    latestFinishTime: null,
    latestBreakDurationMinutes: 0,
    actualStartTime: "2026-05-14 08:00:00",
    actualBreakMinutes: 0,
    actualFinishTime: null,
    actualDurationHours: null,
    qcStatus: "BELUM_QC",
    qcResult: null,
    qcNotes: null,
    monitoringStatus: null,
    monitoringResult: null,
    isOvertime: false,
    isStarted: true,
    isSubmitted: false,
    hasDelayRisk: true,
  };

  return {
    async listToday() {
      return {
        data: [taskRow],
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
          sortBy: "taskDate",
          sortDirection: "desc" as const,
          view: null,
          filters: [],
          date: "2026-05-14",
        },
        references: {
          divisions: [],
          units: [],
          employees: [],
        },
        summary: {
          activeWork: 1,
          noStart: 0,
          noSubmit: 1,
          delayRisk: 1,
          overtimeCount: 0,
        },
      };
    },
    async listDivisionLoad() {
      return [
        {
          divisionId: 12,
          divisionName: "INTERIOR",
          totalTasks: 3,
          startedTasks: 2,
          pendingSubmitTasks: 1,
          doneTasks: 1,
          totalActualHours: 3.5,
          totalRemainingHours: 10.5,
          averageProgressPercent: 45,
        },
      ];
    },
    async getDivisionDetail(_session, divisionId) {
      return {
        divisionId,
        divisionName: "INTERIOR",
        summary: {
          totalUnits: 1,
          totalMembers: 1,
          totalTasks: 3,
          totalPlannedHours: 8,
          totalActualHours: 3.5,
          totalRemainingHours: 4.5,
        },
        units: [
          {
            carId: "CAR-1",
            unitName: "MB 500 SEL",
            customerName: "Mr. Silmy",
            totalTasks: 3,
            startedTasks: 2,
            pendingSubmitTasks: 1,
            doneTasks: 1,
            totalPlannedHours: 8,
            totalActualHours: 3.5,
            totalRemainingHours: 4.5,
            averageProgressPercent: 45,
          },
        ],
        members: [
          {
            employeeId: "SM-11.002",
            employeeName: "Agus Rusmawan",
            totalTasks: 3,
            startedTasks: 2,
            pendingSubmitTasks: 1,
            doneTasks: 1,
            totalPlannedHours: 8,
            totalActualHours: 3.5,
            totalRemainingHours: 4.5,
            averageProgressPercent: 45,
          },
        ],
      };
    },
    async listEmployeeTimesheet() {
      return [];
    },
    async listReferences() {
      return {
        divisions: [],
        units: [],
        employees: [],
      };
    },
    async listOvertime() {
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
          sortBy: "taskDate",
          sortDirection: "desc" as const,
          view: null,
          filters: [],
          date: "2026-05-14",
        },
        references: {
          divisions: [],
          units: [],
          employees: [],
        },
        summary: {
          activeWork: 0,
          noStart: 0,
          noSubmit: 0,
          delayRisk: 0,
          overtimeCount: 0,
        },
      };
    },
    async listNoStart() {
      return [taskRow];
    },
    async listNoSubmit() {
      return [taskRow];
    },
  };
}

describe("monitoring routes", () => {
  test("lists today monitoring and division load", async () => {
    const fetchHandler = createApiFetchHandler({
      authService: createStubAuthService(sampleSession),
      monitoringService: createStubMonitoringService(),
    });

    const todayResponse = await fetchHandler(
      new Request("http://localhost/api/monitoring/today?date=2026-05-14", {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=session:SM-03.004:session-1`,
        },
      }),
    );

    expect(todayResponse.status).toBe(200);
    const todayBody = await todayResponse.json();
    expect(todayBody.data[0].planId).toBe("PLAN-1");
    expect(todayBody.summary.noSubmit).toBe(1);

    const divisionResponse = await fetchHandler(
      new Request("http://localhost/api/monitoring/division?date=2026-05-14", {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=session:SM-03.004:session-1`,
        },
      }),
    );

    expect(divisionResponse.status).toBe(200);
    const divisionBody = await divisionResponse.json();
    expect(divisionBody.data[0].divisionId).toBe(12);
  });

  test("keeps division mode on division endpoint", async () => {
    let receivedMode: "all" | "normal" | "overtime" | null = null;
    let receivedSpan: "daily" | "weekly" | null = null;

    const fetchHandler = createApiFetchHandler({
      authService: createStubAuthService(sampleSession),
      monitoringService: {
        ...createStubMonitoringService(),
        async listDivisionLoad(_session, _date, mode = "normal", span = "daily") {
          receivedMode = mode;
          receivedSpan = span;
          return [
            {
              divisionId: 12,
              divisionName: "INTERIOR",
              totalTasks: 1,
              startedTasks: 1,
              pendingSubmitTasks: 0,
              doneTasks: 0,
              totalActualHours: 1,
              totalRemainingHours: 2,
              averageProgressPercent: 50,
            },
          ];
        },
      },
    });

    const response = await fetchHandler(
      new Request("http://localhost/api/monitoring/division?date=2026-05-14&mode=overtime&span=weekly", {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=session:SM-03.004:session-1`,
        },
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.mode).toBe("overtime");
    expect(body.span).toBe("weekly");
    expect(body.dateTo).toBe("2026-05-20");
    expect(receivedMode).toBe("overtime");
    expect(receivedSpan).toBe("weekly");
  });

  test("returns division detail for interactive page", async () => {
    let receivedDivisionId: number | null = null;
    let receivedSpan: "daily" | "weekly" | null = null;

    const fetchHandler = createApiFetchHandler({
      authService: createStubAuthService(sampleSession),
      monitoringService: {
        ...createStubMonitoringService(),
        async getDivisionDetail(_session, divisionId, _date, mode = "normal", span = "daily") {
          void mode;
          receivedDivisionId = divisionId;
          receivedSpan = span;
          return {
            divisionId,
            divisionName: "INTERIOR",
            summary: {
              totalUnits: 2,
              totalMembers: 3,
              totalTasks: 5,
              totalPlannedHours: 12,
              totalActualHours: 4,
              totalRemainingHours: 8,
            },
            units: [],
            members: [],
          };
        },
      },
    });

    const response = await fetchHandler(
      new Request("http://localhost/api/monitoring/division/12?date=2026-05-14&mode=overtime&span=weekly", {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=session:SM-03.004:session-1`,
        },
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.divisionId).toBe(12);
    expect(body.divisionName).toBe("INTERIOR");
    expect(body.summary.totalUnits).toBe(2);
    expect(body.dateTo).toBe("2026-05-20");
    expect(receivedDivisionId).toBe(12);
    expect(receivedSpan).toBe("weekly");
  });

  test("supports all mode on main monitoring route", async () => {
    let receivedMode: "all" | "normal" | "overtime" | null = null;

    const fetchHandler = createApiFetchHandler({
      authService: createStubAuthService(sampleSession),
      monitoringService: {
        ...createStubMonitoringService(),
        async listToday(_session, _query, _date, mode = "normal") {
          receivedMode = mode;
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
              sortBy: "taskDate",
              sortDirection: "desc" as const,
              view: null,
              filters: [],
              date: "2026-05-14",
            },
            references: {
              divisions: [],
              units: [],
              employees: [],
            },
            summary: {
              activeWork: 0,
              noStart: 0,
              noSubmit: 0,
              delayRisk: 0,
              overtimeCount: 0,
            },
          };
        },
      },
    });

    const response = await fetchHandler(
      new Request("http://localhost/api/monitoring/today?date=2026-05-14&mode=all", {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=session:SM-03.004:session-1`,
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(receivedMode).toBe("all");
  });

  test("passes date range to main monitoring route", async () => {
    let receivedDate: string | undefined;
    let receivedDateTo: string | undefined;

    const fetchHandler = createApiFetchHandler({
      authService: createStubAuthService(sampleSession),
      monitoringService: {
        ...createStubMonitoringService(),
        async listToday(_session, _query, date, mode = "normal", dateTo) {
          void mode;
          receivedDate = date;
          receivedDateTo = dateTo;
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
              sortBy: "taskDate",
              sortDirection: "desc" as const,
              view: null,
              filters: [],
              date: "2026-05-14",
              dateTo: "2026-05-20",
            },
            references: {
              divisions: [],
              units: [],
              employees: [],
            },
            summary: {
              activeWork: 0,
              noStart: 0,
              noSubmit: 0,
              delayRisk: 0,
              overtimeCount: 0,
            },
          };
        },
      },
    });

    const response = await fetchHandler(
      new Request("http://localhost/api/monitoring/today?date=2026-05-14&dateTo=2026-05-20", {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=session:SM-03.004:session-1`,
        },
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(receivedDate).toBe("2026-05-14");
    expect(receivedDateTo).toBe("2026-05-20");
    expect(body.query.dateTo).toBe("2026-05-20");
    expect(body.dateTo).toBe("2026-05-20");
  });

  test("returns no-start and no-submit task views", async () => {
    const fetchHandler = createApiFetchHandler({
      authService: createStubAuthService(sampleSession),
      monitoringService: createStubMonitoringService(),
    });

    const noStartResponse = await fetchHandler(
      new Request("http://localhost/api/monitoring/no-start?date=2026-05-14", {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=session:SM-03.004:session-1`,
        },
      }),
    );

    expect(noStartResponse.status).toBe(200);
    const noStartBody = await noStartResponse.json();
    expect(noStartBody.data[0].planId).toBe("PLAN-1");

    const noSubmitResponse = await fetchHandler(
      new Request("http://localhost/api/monitoring/no-submit?date=2026-05-14", {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=session:SM-03.004:session-1`,
        },
      }),
    );

    expect(noSubmitResponse.status).toBe(200);
    const noSubmitBody = await noSubmitResponse.json();
    expect(noSubmitBody.data[0].actualStatus).toBe("onprogress");
  });

  test("blocks monitoring routes when permission is missing", async () => {
    const fetchHandler = createApiFetchHandler({
      authService: createStubAuthService({
        ...sampleSession,
        user: {
          ...sampleUser,
          permissions: [],
        },
      }),
      monitoringService: createStubMonitoringService(),
    });

    const response = await fetchHandler(
      new Request("http://localhost/api/monitoring/today", {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=session:SM-03.004:session-1`,
        },
      }),
    );

    expect(response.status).toBe(403);
  });
});
