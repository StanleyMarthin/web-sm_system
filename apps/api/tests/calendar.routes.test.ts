import { SESSION_COOKIE_NAME } from "@smsystem/contracts/auth";
import type { AuthUser } from "@smsystem/contracts/auth";
import { describe, expect, test } from "bun:test";
import { createApiFetchHandler } from "@/app";
import type { AuthService } from "@/services/auth/auth.service";
import type { CalendarService } from "@/services/calendar.service";
import type { WebSession } from "@/services/auth/session.service";

const sampleUser: AuthUser = {
  employeeId: "SM-03.004",
  fullName: "Sahrul Riswanto",
  email: null,
  roleId: 20,
  roleName: "mis",
  divisionId: 3,
  divisionName: "MANAGEMENT INFORMATION SYSTEM",
  grade: "MIS",
  permissions: ["UPDATE_PLAN", "LIST_CAR_PROGRESS", "view_all_units"],
  scope: {
    canViewAllUnits: true,
    canViewAssignedUnits: false,
    divisionIds: [3],
    managedDivisionIds: [3],
    unitIds: [],
  },
};

const sampleSession: WebSession = {
  sessionId: "calendar-route-session-1",
  sessionKey: "session:calendar-route-1",
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

function createStubCalendarService(): CalendarService {
  return {
    async listWeeklyConfigs() {
      return [
        {
          configId: "CFG-1",
          weekStartDate: "2026-05-18",
          weekdayHours: 8,
          saturdayHours: 5,
          sundayHours: 0,
          weekdayOvertimeHours: 2,
          saturdayOvertimeHours: 3,
          sundayOvertimeHours: 0,
          efficiencyFactor: 1,
          qcBufferDays: 1,
          createdBy: "SM-03.004",
          createdAt: "2026-05-14 10:00:00",
          updatedAt: "2026-05-14 10:00:00",
        },
      ];
    },
    async upsertWeeklyConfig() {
      return {
        configId: "CFG-1",
        weekStartDate: "2026-05-18",
        weekdayHours: 8,
        saturdayHours: 5,
        sundayHours: 0,
        weekdayOvertimeHours: 2,
        saturdayOvertimeHours: 3,
        sundayOvertimeHours: 0,
        efficiencyFactor: 1,
        qcBufferDays: 1,
        createdBy: "SM-03.004",
        createdAt: "2026-05-14 10:00:00",
        updatedAt: "2026-05-14 10:00:00",
      };
    },
    async listDayOverrides() {
      return [];
    },
    async upsertDayOverride() {
      return {
        date: "2026-05-18",
        mode: "LIBUR",
        workingHours: 0,
        overtimeHours: 0,
        note: null,
        updatedBy: "SM-03.004",
        updatedAt: "2026-05-14T10:00:00.000Z",
      };
    },
    async getWorkingDays() {
      return {
        startDate: "2026-05-18",
        endDate: "2026-05-24",
        includeOvertime: false,
        days: [
          {
            date: "2026-05-18",
            dayName: "Monday",
            workingHours: 8,
            overtimeHours: 0,
            totalCapacityHours: 8,
            isWorkingDay: true,
          },
        ],
      };
    },
    async simulateCapacity() {
      return {
        divisionId: 12,
        divisionName: "INTERIOR",
        activePicCount: 4,
        workingHours: 8,
        efficiencyFactor: 0.85,
        effectiveDailyCapacity: 27.2,
      };
    },
    async getUnitEta() {
      return {
        carId: "CAR-1",
        unitName: "MB 500 SEL",
        customerName: "Mr. Silmy",
        targetDeliveryDate: "2026-05-22",
        predictedDeliveryDate: "2026-05-21",
        riskLevel: "YELLOW" as const,
        remainingHours: 16,
        effectiveDailyCapacity: 8,
        etaDays: 2,
        blockerDelayDays: 0,
        qcBufferDays: 1,
      };
    },
    async listDeliveryRisk() {
      return {
        data: [
          {
            carId: "CAR-1",
            unitName: "MB 500 SEL",
            customerName: "Mr. Silmy",
            targetDeliveryDate: "2026-05-22",
            predictedDeliveryDate: "2026-05-21",
            riskLevel: "YELLOW" as const,
            remainingHours: 16,
            effectiveDailyCapacity: 8,
            etaDays: 2,
            blockerDelayDays: 0,
            qcBufferDays: 1,
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
          sortBy: "predictedDeliveryDate",
          sortDirection: "asc" as const,
          view: null,
          filters: [],
          asOfDate: "2026-05-18",
        },
        summary: {
          green: 0,
          yellow: 1,
          orange: 0,
          red: 0,
          black: 0,
        },
      };
    },
  };
}

describe("calendar routes", () => {
  test("returns working days and delivery risk", async () => {
    const fetchHandler = createApiFetchHandler({
      authService: createStubAuthService(sampleSession),
      calendarService: createStubCalendarService(),
    });

    const workingDaysResponse = await fetchHandler(
      new Request("http://localhost/api/calendar/working-days?startDate=2026-05-18&endDate=2026-05-24", {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=session:calendar-route-1`,
        },
      }),
    );

    expect(workingDaysResponse.status).toBe(200);
    const workingDaysBody = await workingDaysResponse.json();
    expect(workingDaysBody.data.days[0].workingHours).toBe(8);

    const riskResponse = await fetchHandler(
      new Request("http://localhost/api/planning/delivery-risk?asOfDate=2026-05-18", {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=session:calendar-route-1`,
        },
      }),
    );

    expect(riskResponse.status).toBe(200);
    const riskBody = await riskResponse.json();
    expect(riskBody.data[0].riskLevel).toBe("YELLOW");
  });

  test("blocks weekly config update when planning permission is missing", async () => {
    const fetchHandler = createApiFetchHandler({
      authService: createStubAuthService({
        ...sampleSession,
        user: {
          ...sampleUser,
          permissions: ["LIST_CAR_PROGRESS"],
        },
      }),
      calendarService: createStubCalendarService(),
    });

    const response = await fetchHandler(
      new Request("http://localhost/api/calendar/weekly-config", {
        method: "POST",
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=session:calendar-route-1`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          weekStartDate: "2026-05-18",
          weekdayHours: 8,
          saturdayHours: 5,
          sundayHours: 0,
          weekdayOvertimeHours: 2,
          saturdayOvertimeHours: 3,
          sundayOvertimeHours: 0,
          efficiencyFactor: 1,
          qcBufferDays: 1,
        }),
      }),
    );

    expect(response.status).toBe(403);
  });
});
