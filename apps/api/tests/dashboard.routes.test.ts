import { SESSION_COOKIE_NAME } from "@smsystem/contracts/auth";
import type { AuthUser } from "@smsystem/contracts/auth";
import { describe, expect, test } from "bun:test";
import { createApiFetchHandler } from "@/app";
import type { AuthService } from "@/services/auth/auth.service";
import type { DashboardService } from "@/services/dashboard.service";
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
  permissions: ["PROFILE_VIEW", "LIST_CAR_PROGRESS", "VIEW_COUNTDOWN", "WO_VIEW"],
  scope: {
    canViewAllUnits: true,
    canViewAssignedUnits: false,
    divisionIds: [3],
    managedDivisionIds: [3],
    unitIds: [],
  },
};

const sampleSession: WebSession = {
  sessionId: "dashboard-session-1",
  sessionKey: "session:SM-03.004:dashboard-session-1",
  employeeId: sampleUser.employeeId,
  refreshToken: "refresh-1",
  mobileSessionKey: "session:SM-03.004",
  deviceId: "web-device-1",
  user: sampleUser,
  createdAt: "2026-05-18T00:00:00.000Z",
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

function createStubDashboardService(): DashboardService {
  return {
    async getSummary() {
      return {
        generatedAt: "2026-05-18T10:00:00.000Z",
        asOfDate: "2026-05-18",
        headline: {
          title: "Ringkasan kerja hari ini",
          subtitle: "Prioritas sudah diringkas dari unit, QC, dan antrean approval.",
          scopeNote: "Anda sedang melihat semua unit aktif.",
          highlights: ["2 unit mendekati tanggal serah terima."],
        },
        kpis: {
          activeUnits: 12,
          deliveryThisWeek: 4,
          overdueUnits: 1,
          urgentIssues: 3,
        },
        deliveryRisk: {
          summary: {
            green: 6,
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
              predictedDeliveryDate: "2026-05-22",
              riskLevel: "RED",
              remainingHours: 48,
              effectiveDailyCapacity: 8,
            },
          ],
        },
        unitProgress: [],
        qcTrend: [],
        urgentIssues: [],
        countdownOverdue: [],
        manhour: null,
        divisionKpis: [],
        pendingActions: {
          woApproval: 2,
          prApproval: 1,
          vendorApproval: 0,
          warehouseApproval: null,
          total: 3,
        },
        monitoringFlags: {
          noStart: 1,
          noSubmit: 2,
          delayRisk: 1,
          overtimeCount: 0,
        },
      };
    },
  };
}

describe("dashboard summary route", () => {
  test("returns dashboard summary for authorized session", async () => {
    const fetchHandler = createApiFetchHandler({
      authService: createStubAuthService(sampleSession),
      dashboardService: createStubDashboardService(),
    });

    const response = await fetchHandler(
      new Request("http://localhost/api/dashboard/summary", {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=session:SM-03.004:dashboard-session-1`,
        },
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.kpis.activeUnits).toBe(12);
    expect(body.data.pendingActions.total).toBe(3);
    expect(body.data.headline.title).toBe("Ringkasan kerja hari ini");
  });

  test("blocks dashboard summary when dashboard permission is missing", async () => {
    const fetchHandler = createApiFetchHandler({
      authService: createStubAuthService({
        ...sampleSession,
        user: {
          ...sampleUser,
          permissions: [],
        },
      }),
      dashboardService: createStubDashboardService(),
    });

    const response = await fetchHandler(
      new Request("http://localhost/api/dashboard/summary"),
    );

    expect(response.status).toBe(403);
  });
});
