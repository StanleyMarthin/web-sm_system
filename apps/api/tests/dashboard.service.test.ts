import type { AuthUser } from "@smsystem/contracts/auth";
import { describe, expect, test } from "bun:test";
import type {
  DashboardCountdownOverdueItem,
  DashboardDeliveryRiskSection,
  DashboardDivisionKpiItem,
  DashboardKpi,
  DashboardManhourSummary,
  DashboardMonitoringFlags,
  DashboardQcTrendPoint,
  DashboardUnitProgressItem,
  DashboardUrgentIssueItem,
} from "@smsystem/contracts/dashboard";
import type { DashboardRepository } from "@/repositories/dashboard.repo";
import {
  DefaultDashboardService,
  type DashboardRiskSource,
} from "@/services/dashboard.service";
import type { WebSession } from "@/services/auth/session.service";

const fullAccessUser: AuthUser = {
  employeeId: "SM-01.001",
  fullName: "Planning Manager",
  email: null,
  roleId: 1,
  roleName: "pm",
  divisionId: 1,
  divisionName: "PLANNING",
  grade: "PM",
  permissions: [
    "PROFILE_VIEW",
    "LIST_CAR_PROGRESS",
    "VIEW_COUNTDOWN",
    "QC_VIEW",
    "WO_VIEW",
    "WO_APPROVE",
    "PR_VIEW",
    "PR_APPROVE",
    "VENDOR_VIEW",
    "VENDOR_APPROVE",
    "WAREHOUSE_VIEW",
    "WAREHOUSE_APPROVE",
  ],
  scope: {
    canViewAllUnits: true,
    canViewAssignedUnits: false,
    divisionIds: [],
    managedDivisionIds: [],
    unitIds: [],
  },
};

const limitedUser: AuthUser = {
  employeeId: "SM-11.004",
  fullName: "Advisor Interior",
  email: null,
  roleId: 11,
  roleName: "advisor",
  divisionId: 8,
  divisionName: "INTERIOR",
  grade: "ADV",
  permissions: ["PROFILE_VIEW", "QC_VIEW"],
  scope: {
    canViewAllUnits: false,
    canViewAssignedUnits: true,
    divisionIds: [8],
    managedDivisionIds: [8],
    unitIds: ["CAR-1"],
  },
};

function createSession(user: AuthUser): WebSession {
  return {
    sessionId: `session-${user.employeeId}`,
    sessionKey: `session:${user.employeeId}`,
    employeeId: user.employeeId,
    refreshToken: "refresh-1",
    mobileSessionKey: `session:${user.employeeId}`,
    deviceId: "web-device-1",
    user,
    createdAt: "2026-05-18T00:00:00.000Z",
  };
}

class InMemoryDashboardRepository implements DashboardRepository {
  calls = {
    getKpis: 0,
    listUnitProgress: 0,
    listQcTrend: 0,
    listUrgentIssues: 0,
    listCountdownOverdue: 0,
    getManhourSummary: 0,
    listDivisionKpis: 0,
    getPendingActions: 0,
    getMonitoringFlags: 0,
  };

  async getKpis(): Promise<DashboardKpi> {
    this.calls.getKpis += 1;
    return {
      activeUnits: 10,
      deliveryThisWeek: 4,
      overdueUnits: 2,
      urgentIssues: 3,
    };
  }

  async listUnitProgress(): Promise<DashboardUnitProgressItem[]> {
    this.calls.listUnitProgress += 1;
    return [
      {
        divisionId: 8,
        divisionName: "INTERIOR",
        activeUnits: 4,
        avgProgressPercent: 72,
        completedPanels: 14,
        plannedPanels: 18,
        actualHours: 56,
      },
    ];
  }

  async listQcTrend(): Promise<DashboardQcTrendPoint[]> {
    this.calls.listQcTrend += 1;
    return [
      {
        date: "2026-05-18",
        passCount: 3,
        rejectCount: 1,
      },
    ];
  }

  async listUrgentIssues(): Promise<DashboardUrgentIssueItem[]> {
    this.calls.listUrgentIssues += 1;
    return [
      {
        issueId: "ISS-1",
        issueNumber: "ISS-001",
        title: "Warna panel belum rata",
        unitName: "MB 500 SEL",
        divisionName: "INTERIOR",
        severity: "HIGH",
        status: "OPEN",
        ageDays: 1,
      },
    ];
  }

  async listCountdownOverdue(): Promise<DashboardCountdownOverdueItem[]> {
    this.calls.listCountdownOverdue += 1;
    return [
      {
        countdownId: "CD-1",
        carId: "CAR-1",
        unitName: "MB 500 SEL",
        divisionName: "INTERIOR",
        panelName: "Dashboard",
        deadlineDate: "2026-05-17",
        overdueDays: 1,
        remainingHours: 6,
      },
    ];
  }

  async getManhourSummary(): Promise<DashboardManhourSummary> {
    this.calls.getManhourSummary += 1;
    return {
      weekStartDate: "2026-05-18",
      planStatus: "PUBLISHED",
      targetHours: 240,
      byDivision: [
        {
          divisionId: 8,
          divisionName: "INTERIOR",
          capacityHours: 80,
          plannedHours: 72,
          actualHours: 60,
          remainingHours: 12,
          utilizationPercent: 83.33,
        },
      ],
    };
  }

  async listDivisionKpis(): Promise<DashboardDivisionKpiItem[]> {
    this.calls.listDivisionKpis += 1;
    return [
      {
        divisionId: 8,
        divisionName: "INTERIOR",
        activeUnits: 4,
        avgProgressPercent: 72,
        completedPanels: 14,
        plannedPanels: 18,
        totalHours: 56,
      },
    ];
  }

  async getPendingActions() {
    this.calls.getPendingActions += 1;
    return {
      woApproval: 2,
      prApproval: 1,
      vendorApproval: 1,
      warehouseApproval: 1,
      total: 5,
    };
  }

  async getMonitoringFlags(): Promise<DashboardMonitoringFlags> {
    this.calls.getMonitoringFlags += 1;
    return {
      noStart: 2,
      noSubmit: 1,
      delayRisk: 3,
      overtimeCount: 0,
    };
  }

  async listUnitWorkHours() {
    return [
      {
        carId: "CAR-1",
        unitName: "MB 500 SEL",
        actualHours: 56,
      },
    ];
  }
}

class InMemoryRiskSource implements DashboardRiskSource {
  async listDeliveryRisk(): Promise<DashboardDeliveryRiskSection> {
    return {
      summary: {
        green: 4,
        yellow: 3,
        orange: 2,
        red: 1,
        black: 0,
      },
      topUnits: [
        {
          carId: "CAR-1",
          unitName: "MB 500 SEL",
          customerName: "Mr. Silmy",
          targetDeliveryDate: "2026-05-20",
          predictedDeliveryDate: "2026-05-21",
          riskLevel: "ORANGE",
          remainingHours: 32,
          effectiveDailyCapacity: 8,
        },
      ],
    };
  }
}

describe("DefaultDashboardService", () => {
  test("returns full dashboard summary for broad operational permissions", async () => {
    const repository = new InMemoryDashboardRepository();
    const service = new DefaultDashboardService(repository, new InMemoryRiskSource());

    const result = await service.getSummary(createSession(fullAccessUser), { date: "2026-05-18" });

    expect(result.kpis.activeUnits).toBe(10);
    expect(result.deliveryRisk?.summary.red).toBe(1);
    expect(result.manhour?.byDivision[0]?.divisionName).toBe("INTERIOR");
    expect(result.pendingActions?.total).toBe(5);
    expect(result.headline.highlights.length > 0).toBe(true);
    expect(repository.calls.getPendingActions).toBe(1);
    expect(repository.calls.getManhourSummary).toBe(1);
  });

  test("only loads widgets that match current permissions", async () => {
    const repository = new InMemoryDashboardRepository();
    const service = new DefaultDashboardService(repository, new InMemoryRiskSource());

    const result = await service.getSummary(createSession(limitedUser), { date: "2026-05-18" });

    expect(result.kpis.overdueUnits).toBe(2);
    expect(result.qcTrend?.length).toBe(7);
    expect(result.qcTrend?.[6]?.passCount).toBe(3);
    expect(result.urgentIssues?.length).toBe(1);
    expect(result.deliveryRisk).toBe(null);
    expect(result.pendingActions).toBe(null);
    expect(result.manhour).toBe(null);
    expect(repository.calls.getPendingActions).toBe(0);
    expect(repository.calls.getManhourSummary).toBe(0);
    expect(repository.calls.listCountdownOverdue).toBe(0);
  });
});
