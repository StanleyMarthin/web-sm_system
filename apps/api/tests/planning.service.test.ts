import type { AuthUser } from "@smsystem/contracts/auth";
import { describe, expect, test } from "bun:test";
import type { WeeklyPlanRecord } from "@smsystem/contracts/calendar";
import type { AuditService } from "@/services/audit/audit.service";
import { DefaultCalendarService } from "@/services/calendar.service";
import {
  type CalendarRepository,
  type PlanningDivisionDemandRow,
  type PlanOvertimeRow,
  type PlanUnitRow,
  type PlanningUnitRiskRow,
  type UnitCapacitySnapshot,
} from "@/repositories/calendar.repo";
import { DefaultWeeklyPlanningService } from "@/services/planning.service";
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
  sessionId: "planning-session-1",
  sessionKey: "session:planning-1",
  employeeId: sampleUser.employeeId,
  refreshToken: "refresh-1",
  mobileSessionKey: "session:SM-03.004",
  deviceId: "web-device-1",
  user: sampleUser,
  createdAt: "2026-05-18T00:00:00.000Z",
};

class InMemoryCalendarRepository implements CalendarRepository {
  plan: WeeklyPlanRecord = {
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

  weeklyConfigs = [
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
      createdAt: "2026-05-18 08:00:00",
      updatedAt: "2026-05-18 08:00:00",
    },
  ];

  technicalDivisions = [
    {
      divisionId: 12,
      divisionName: "INTERIOR",
    },
  ];

  activeMembers = [
    {
      divisionId: 12,
      count: 2,
    },
  ];

  overtimeRows: PlanOvertimeRow[] = [
    {
      divisionId: 12,
      divisionName: "INTERIOR",
      overtimeDate: "2026-05-20",
      dayType: "WEEKDAY",
      overtimeHours: 2,
      memberCount: 1,
      includeHead: true,
      notes: null,
    },
  ];

  divisionInputRows: Array<{
    divisionId: number;
    divisionName: string;
    memberCount: number;
  }> = [
    {
      divisionId: 12,
      divisionName: "INTERIOR",
      memberCount: 2,
    },
  ];

  unitRows: PlanUnitRow[] = [
    {
      carId: "CAR-1",
      divisionId: 12,
      divisionName: "INTERIOR",
      allocatedHours: 20,
      priorityRank: 1,
      notes: null,
      unitName: "MB 500 SEL",
      customerName: "Mr. Silmy",
      isMargin: false,
      materialStatus: "READY",
      materialReady: true,
      materialNote: null,
      targetDeliveryDate: "2026-05-21",
      remainingHours: 64,
    },
  ];

  absenceLossRows = [
    {
      divisionId: 12,
      lostHours: 8,
    },
  ];

  capacityCacheRows: Array<{
    divisionId: number;
    divisionName: string;
    memberCountActive: number;
    normalCapacityHours: number;
    overtimeCapacityHours: number;
    absenceLostHours: number;
    netCapacityHours: number;
    allocatedHours: number;
    utilizationPct: number;
  }> = [];

  planningRiskRows: PlanningUnitRiskRow[] = [];
  planningDemandRows: PlanningDivisionDemandRow[] = [
    {
      carId: "CAR-1",
      unitName: "MB 500 SEL",
      customerName: "Mr. Silmy",
      targetDeliveryDate: "2026-05-21",
      isMargin: false,
      materialStatus: "READY",
      materialReady: true,
      materialNote: null,
      divisionId: 12,
      divisionName: "INTERIOR",
      remainingHours: 64,
      progressPercent: 30,
      panelCount: 4,
      lockedPanelCount: 2,
    },
    {
      carId: "CAR-1",
      unitName: "MB 500 SEL",
      customerName: "Mr. Silmy",
      targetDeliveryDate: "2026-05-21",
      isMargin: false,
      materialStatus: "READY",
      materialReady: true,
      materialNote: null,
      divisionId: 18,
      divisionName: "MEKANIK",
      remainingHours: 18,
      progressPercent: 60,
      panelCount: 2,
      lockedPanelCount: 0,
    },
  ];

  async listWeeklyConfigs() {
    return this.weeklyConfigs;
  }

  async upsertWeeklyConfig(input: {
    weekStartDate: string;
    weekdayHours: number;
    saturdayHours: number;
    sundayHours: number;
    weekdayOvertimeHours: number;
    saturdayOvertimeHours: number;
    sundayOvertimeHours: number;
    efficiencyFactor: number;
    qcBufferDays: number;
    createdBy: string | null;
  }) {
    return {
      configId: "CFG-NEW",
      weekStartDate: input.weekStartDate,
      weekdayHours: input.weekdayHours,
      saturdayHours: input.saturdayHours,
      sundayHours: input.sundayHours,
      weekdayOvertimeHours: input.weekdayOvertimeHours,
      saturdayOvertimeHours: input.saturdayOvertimeHours,
      sundayOvertimeHours: input.sundayOvertimeHours,
      efficiencyFactor: input.efficiencyFactor,
      qcBufferDays: input.qcBufferDays,
      createdBy: input.createdBy,
      createdAt: "2026-05-18 08:00:00",
      updatedAt: "2026-05-18 08:00:00",
    };
  }

  async getUnitCapacitySnapshot() {
    return null;
  }

  async listDeliveryRiskRows() {
    return [];
  }

  async countActivePicByDivision() {
    return 0;
  }

  async findDivisionName(divisionId: number) {
    return `Division ${divisionId}`;
  }

  async createOrUpdateWeeklyPlan() {
    return this.plan;
  }

  async getWeeklyPlan() {
    return this.plan;
  }

  async getWeeklyPlanById(planId: string) {
    return planId === this.plan.planId ? this.plan : null;
  }

  async publishWeeklyPlan() {
    this.plan = {
      ...this.plan,
      status: "PUBLISHED",
    };
  }

  async upsertPlanOvertime(_planId: string, rows: Array<{
    divisionId: number;
    overtimeDate: string;
    dayType: "WEEKDAY" | "SATURDAY" | "SUNDAY";
    overtimeHours: number;
    memberCount: number;
    includeHead: boolean;
    notes?: string;
  }>) {
    this.overtimeRows = rows.map((row) => ({
      divisionId: row.divisionId,
      divisionName: "INTERIOR",
      overtimeDate: row.overtimeDate,
      dayType: row.dayType,
      overtimeHours: row.overtimeHours,
      memberCount: row.memberCount,
      includeHead: row.includeHead,
      notes: row.notes ?? null,
    }));
  }

  async listPlanOvertime() {
    return this.overtimeRows;
  }

  async upsertPlanDivisionInputs(
    _planId: string,
    rows: Array<{ divisionId: number; memberCount: number }>,
  ) {
    this.divisionInputRows = rows.map((row) => ({
      divisionId: row.divisionId,
      divisionName:
        this.technicalDivisions.find((division) => division.divisionId === row.divisionId)
          ?.divisionName ?? `Division ${row.divisionId}`,
      memberCount: row.memberCount,
    }));
  }

  async listPlanDivisionInputs() {
    return this.divisionInputRows;
  }

  async upsertPlanUnits(_planId: string, rows: Array<{
    carId: string;
    divisionId: number;
    allocatedHours: number;
    priorityRank?: number;
    notes?: string;
  }>) {
    this.unitRows = rows.map((row) => ({
      carId: row.carId,
      divisionId: row.divisionId,
      divisionName: "INTERIOR",
      allocatedHours: row.allocatedHours,
      priorityRank: row.priorityRank ?? null,
      notes: row.notes ?? null,
      unitName: "Unit Placeholder",
      customerName: null,
      isMargin: false,
      materialStatus: "READY",
      materialReady: true,
      materialNote: null,
      targetDeliveryDate: null,
      remainingHours: 0,
    }));
  }

  async listPlanUnits() {
    return this.unitRows;
  }

  async snapshotAbsenceForWeek() {
    return 0;
  }

  async countActiveMembersByDivision() {
    return this.activeMembers;
  }

  async listTechnicalDivisions() {
    return this.technicalDivisions;
  }

  async listAbsenceLossByDivision() {
    return this.absenceLossRows;
  }

  async upsertCapacityCache(_planId: string, rows: Array<{
    divisionId: number;
    divisionName: string;
    memberCountActive: number;
    normalCapacityHours: number;
    overtimeCapacityHours: number;
    absenceLostHours: number;
    netCapacityHours: number;
    allocatedHours: number;
    utilizationPct: number;
  }>) {
    this.capacityCacheRows = rows;
  }

  async getCapacityCache() {
    return this.capacityCacheRows;
  }

  async listPlanningUnitsForRisk() {
    return this.planningRiskRows;
  }

  async listPlanningDivisionDemand() {
    return this.planningDemandRows;
  }
}

describe("DefaultWeeklyPlanningService", () => {
  test("recomputeCapacity calculates net capacity with overtime and absence", async () => {
    const repository = new InMemoryCalendarRepository();
    const service = new DefaultWeeklyPlanningService(
      repository,
      {
        async log() {
          return;
        },
      } satisfies AuditService,
    );

    const result = await service.recomputeCapacity("PLAN-1");
    const firstDivision = result[0];

    expect(firstDivision?.memberCountActive).toBe(2);
    expect(firstDivision?.normalCapacityHours).toBe(90);
    expect(firstDivision?.overtimeCapacityHours).toBe(4);
    expect(firstDivision?.absenceLostHours).toBe(8);
    expect(firstDivision?.netCapacityHours).toBe(86);
    expect(firstDivision?.allocatedHours).toBe(20);
  });

  test("generateAlerts returns GAP_DEFICIT when target exceeds capacity", async () => {
    const repository = new InMemoryCalendarRepository();
    repository.plan = {
      ...repository.plan,
      targetHours: 200,
    };

    const service = new DefaultWeeklyPlanningService(
      repository,
      {
        async log() {
          return;
        },
      } satisfies AuditService,
    );

    const alerts = await service.generateAlerts(sampleSession, "PLAN-1");
    expect(alerts.some((alert) => alert.type === "GAP_DEFICIT")).toBe(true);
  });

  test("recomputeCapacity follows manual division member input when PM overrides team size", async () => {
    const repository = new InMemoryCalendarRepository();
    repository.divisionInputRows = [
      {
        divisionId: 12,
        divisionName: "INTERIOR",
        memberCount: 1,
      },
    ];

    const service = new DefaultWeeklyPlanningService(
      repository,
      {
        async log() {
          return;
        },
      } satisfies AuditService,
    );

    const result = await service.recomputeCapacity("PLAN-1");
    const firstDivision = result[0];

    expect(firstDivision?.memberCountActive).toBe(1);
    expect(firstDivision?.normalCapacityHours).toBe(45);
    expect(firstDivision?.netCapacityHours).toBe(41);
  });

  test("generateAlerts returns NON_MARGIN_IDLE when non-margin unit has no allocation", async () => {
    const repository = new InMemoryCalendarRepository();
    repository.unitRows = [];
    repository.planningRiskRows = [
      {
        carId: "CAR-NM-1",
        unitName: "Unit Internal",
        customerName: null,
        targetDeliveryDate: "2026-05-20",
        remainingHours: 12,
        isMargin: false,
        materialStatus: "READY",
        materialReady: true,
        materialNote: null,
        lockedDivisionName: null,
      },
    ];

    const service = new DefaultWeeklyPlanningService(
      repository,
      {
        async log() {
          return;
        },
      } satisfies AuditService,
    );

    const alerts = await service.generateAlerts(sampleSession, "PLAN-1");
    const idleAlert = alerts.find((alert) => alert.type === "NON_MARGIN_IDLE");

    expect(Boolean(idleAlert)).toBe(true);
    expect(idleAlert?.carId).toBe("CAR-NM-1");
  });

  test("getRecommendations keeps focus on the locked division first and computes minimum overtime", async () => {
    const repository = new InMemoryCalendarRepository();
    repository.plan = {
      ...repository.plan,
      targetHours: 70,
    };
    repository.unitRows = [
      {
        ...repository.unitRows[0]!,
        isMargin: true,
      },
    ];
    repository.planningDemandRows = repository.planningDemandRows.map((row) => ({
      ...row,
      isMargin: true,
    }));
    repository.technicalDivisions = [
      {
        divisionId: 12,
        divisionName: "INTERIOR",
      },
      {
        divisionId: 18,
        divisionName: "MEKANIK",
      },
    ];
    repository.activeMembers = [
      {
        divisionId: 12,
        count: 1,
      },
      {
        divisionId: 18,
        count: 0,
      },
    ];
    repository.absenceLossRows = [
      {
        divisionId: 12,
        lostHours: 8,
      },
      {
        divisionId: 18,
        lostHours: 0,
      },
    ];
    repository.overtimeRows = [
      {
        divisionId: 12,
        divisionName: "INTERIOR",
        overtimeDate: "2026-05-20",
        dayType: "WEEKDAY",
        overtimeHours: 2,
        memberCount: 1,
        includeHead: true,
        notes: null,
      },
    ];

    const service = new DefaultWeeklyPlanningService(
      repository,
      {
        async log() {
          return;
        },
      } satisfies AuditService,
    );

    const recommendations = await service.getRecommendations(sampleSession, "PLAN-1");

    expect(recommendations.units[0]?.lockedDivisionName).toBe("INTERIOR");
    expect(recommendations.units[0]?.divisions[0]?.divisionName).toBe("INTERIOR");
    expect(recommendations.units[0]?.divisions[0]?.recommendedHours).toBe(64);
    expect(recommendations.units[0]?.divisions[1]?.recommendedHours).toBe(6);
    expect(
      recommendations.divisions.some((division) => division.divisionName === "INTERIOR"),
    ).toBe(true);
    expect(recommendations.divisions.length > 0).toBe(true);
    expect(recommendations.summary.totalDemandHours).toBe(82);
  });

  test("recomputeCapacity does not double-count full-week absence", async () => {
    const repository = new InMemoryCalendarRepository();
    repository.absenceLossRows = [
      {
        divisionId: 12,
        lostHours: 45,
      },
    ];

    const service = new DefaultWeeklyPlanningService(
      repository,
      {
        async log() {
          return;
        },
      } satisfies AuditService,
    );

    const result = await service.recomputeCapacity("PLAN-1");
    const firstDivision = result[0];

    expect(firstDivision?.memberCountActive).toBe(1);
    expect(firstDivision?.normalCapacityHours).toBe(90);
    expect(firstDivision?.netCapacityHours).toBe(49);
  });

  test("publishPlan auto-generates overtime rows and planner-origin SPK draft", async () => {
    const repository = new InMemoryCalendarRepository();
    repository.plan = {
      ...repository.plan,
      targetHours: 110,
      notes: "Fokus unit margin siap material",
    };
    repository.unitRows = [
      {
        ...repository.unitRows[0]!,
        isMargin: true,
      },
    ];
    repository.planningDemandRows = repository.planningDemandRows.map((row) => ({
      ...row,
      isMargin: true,
    }));
    repository.activeMembers = [
      {
        divisionId: 12,
        count: 1,
      },
    ];
    repository.divisionInputRows = [
      {
        divisionId: 12,
        divisionName: "INTERIOR",
        memberCount: 1,
      },
    ];
    repository.overtimeRows = [];

    const service = new DefaultWeeklyPlanningService(
      repository,
      {
        async log() {
          return;
        },
      } satisfies AuditService,
      {
        async list() {
          throw new Error("Not implemented");
        },
        async summary() {
          throw new Error("Not implemented");
        },
        async preview() {
          throw new Error("Not implemented");
        },
        async findExistingByDate() {
          return null;
        },
        async generate() {
          throw new Error("Not implemented");
        },
        async findPlannerDraftByWeeklyPlan() {
          return null;
        },
        async generateFromWeeklyPlan(_params) {
          return { spkId: "SPK-PLANNER-1" };
        },
        async findDetail() {
          return null;
        },
        async replaceDraftDetails() {
          return;
        },
        async updateHeaderStatus() {
          return;
        },
        async updateItemApproval() {
          return;
        },
        async lockPlansForActivation() {
          return [];
        },
        async today() {
          return [];
        },
      },
    );

    const result = await service.publishPlan(sampleSession, "PLAN-1");

    expect(result.plan.status).toBe("PUBLISHED");
    expect(result.spkDraftId).toBe("SPK-PLANNER-1");
    expect(result.generatedOvertimeRows > 0).toBe(true);
    expect(repository.overtimeRows.length > 0).toBe(true);
  });
});

describe("DefaultCalendarService planning context", () => {
  test("buildEtaRecord applies planContext to remaining hours and effective capacity", async () => {
    const repository = new InMemoryCalendarRepository();
    const service = new DefaultCalendarService(
      repository,
      {
        async get() {
          return null;
        },
        async set() {
          return;
        },
      },
      {
        async list() {
          return [];
        },
        async upsert(input) {
          return {
            date: input.date,
            mode: input.mode,
            workingHours: input.workingHours,
            overtimeHours: input.overtimeHours,
            note: input.note ?? null,
            updatedBy: input.updatedBy,
            updatedAt: "2026-05-18T00:00:00.000Z",
          };
        },
      },
    );

    const snapshot: UnitCapacitySnapshot = {
      carId: "CAR-1",
      unitName: "MB 500 SEL",
      customerName: "Mr. Silmy",
      targetDeliveryDate: "2026-05-25",
      remainingHours: 20,
      activePicCount: 1,
      openWoCount: 0,
      openIssueCount: 0,
      highSeverityIssueCount: 0,
      latestCountdownUpdateAt: "2026-05-18 08:00:00",
      isMargin: false,
    };

    const result = await (
      service as unknown as {
        buildEtaRecord(
          snapshot: UnitCapacitySnapshot,
          asOfDate: string,
          planContext?: {
            allocatedHoursThisWeek: number;
            netCapacityThisWeek: number;
          },
        ): Promise<{
          remainingHours: number;
          effectiveDailyCapacity: number;
          etaDays: number;
        }>;
      }
    ).buildEtaRecord(snapshot, "2026-05-18", {
      allocatedHoursThisWeek: 10,
      netCapacityThisWeek: 25,
    });

    expect(result.remainingHours).toBe(10);
    expect(result.effectiveDailyCapacity).toBe(5);
    expect(result.etaDays).toBe(2);
  });
});
