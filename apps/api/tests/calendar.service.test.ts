import type { AuthUser } from "@smsystem/contracts/auth";
import { describe, expect, test } from "bun:test";
import { DefaultCalendarService } from "@/services/calendar.service";
import type { CalendarRepository } from "@/repositories/calendar.repo";
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
  sessionId: "calendar-session-1",
  sessionKey: "session:calendar-1",
  employeeId: sampleUser.employeeId,
  refreshToken: "refresh-1",
  mobileSessionKey: "session:SM-03.004",
  deviceId: "web-device-1",
  user: sampleUser,
  createdAt: "2026-05-14T00:00:00.000Z",
};

class InMemoryCalendarRepository implements CalendarRepository {
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
  }

  async upsertWeeklyConfig(_input: unknown) {
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
  }

  async getUnitCapacitySnapshot() {
    return {
      carId: "CAR-1",
      unitName: "MB 500 SEL",
      customerName: "Mr. Silmy",
      targetDeliveryDate: "2026-05-22",
      remainingHours: 16,
      activePicCount: 1,
      openWoCount: 1,
      openIssueCount: 1,
      highSeverityIssueCount: 1,
      latestCountdownUpdateAt: "2026-05-18 10:00:00",
      isMargin: false,
    };
  }

  async listDeliveryRiskRows() {
    return [
      {
        carId: "CAR-1",
        unitName: "MB 500 SEL",
        customerName: "Mr. Silmy",
        targetDeliveryDate: "2026-05-22",
        remainingHours: 16,
        activePicCount: 1,
        openWoCount: 1,
        openIssueCount: 1,
        highSeverityIssueCount: 1,
        latestCountdownUpdateAt: "2026-05-18 10:00:00",
        isMargin: false,
      },
    ];
  }

  async countActivePicByDivision() {
    return 0;
  }

  async findDivisionName() {
    return "INTERIOR";
  }

  async createOrUpdateWeeklyPlan() {
    return {
      planId: "PLAN-1",
      weekStartDate: "2026-05-18",
      targetHours: 120,
      targetIncome: 12000000,
      labourRate: 100000,
      createdBy: "SM-03.004",
      notes: null,
      status: "DRAFT" as const,
      createdAt: "2026-05-18 08:00:00",
    };
  }

  async getWeeklyPlan() {
    return null;
  }

  async getWeeklyPlanById() {
    return null;
  }

  async publishWeeklyPlan() {
    return;
  }

  async upsertPlanOvertime() {
    return;
  }

  async listPlanOvertime() {
    return [];
  }

  async upsertPlanDivisionInputs() {
    return;
  }

  async listPlanDivisionInputs() {
    return [];
  }

  async upsertPlanUnits() {
    return;
  }

  async listPlanUnits() {
    return [];
  }

  async snapshotAbsenceForWeek() {
    return 0;
  }

  async countActiveMembersByDivision() {
    return [];
  }

  async listTechnicalDivisions() {
    return [];
  }

  async listAbsenceLossByDivision() {
    return [];
  }

  async upsertCapacityCache() {
    return;
  }

  async getCapacityCache() {
    return [];
  }

  async listPlanningUnitsForRisk() {
    return [];
  }

  async listPlanningDivisionDemand() {
    return [];
  }
}

class InMemoryEtaCache {
  values = new Map<string, string>();

  async get(key: string) {
    return this.values.get(key) ?? null;
  }

  async set(key: string, value: string) {
    this.values.set(key, value);
  }
}

describe("DefaultCalendarService", () => {
  test("calculates working day entries with configured hours", async () => {
    const service = new DefaultCalendarService(
      new InMemoryCalendarRepository(),
      new InMemoryEtaCache(),
    );

    const result = await service.getWorkingDays(sampleSession, {
      startDate: "2026-05-18",
      endDate: "2026-05-24",
      includeOvertime: false,
    });

    expect(result.days.length).toBe(7);
    expect(result.days[0]?.workingHours).toBe(8);
    expect(result.days[5]?.workingHours).toBe(5);
    expect(result.days[6]?.workingHours).toBe(0);
  });

  test("calculates ETA and risk using cached planning engine", async () => {
    const cache = new InMemoryEtaCache();
    const service = new DefaultCalendarService(
      new InMemoryCalendarRepository(),
      cache,
    );

    const eta = await service.getUnitEta(sampleSession, "CAR-1", {
      asOfDate: "2026-05-18",
    });
    const cached = await service.getUnitEta(sampleSession, "CAR-1", {
      asOfDate: "2026-05-18",
    });

    expect(eta.predictedDeliveryDate).toBe("2026-05-22");
    expect(eta.riskLevel).toBe("YELLOW");
    expect(cached.predictedDeliveryDate).toBe("2026-05-22");
    expect(cache.values.size).toBe(1);
  });
});
