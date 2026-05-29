import { SESSION_COOKIE_NAME } from "@smsystem/contracts/auth";
import type { AuthUser } from "@smsystem/contracts/auth";
import { permissionCodes } from "@smsystem/permissions";
import { describe, expect, test } from "bun:test";
import { createApiFetchHandler } from "@/app";
import type { AuthService } from "@/services/auth/auth.service";
import type { ReportsService } from "@/services/reports.service";
import type { WebSession } from "@/services/auth/session.service";

const sampleUser: AuthUser = {
  employeeId: "SM-00.001",
  fullName: "MIS Report",
  email: null,
  roleId: 1,
  roleName: "mis",
  divisionId: 8,
  divisionName: "INTERIOR",
  grade: "MIS",
  permissions: [permissionCodes.reportView, permissionCodes.reportExport],
  scope: {
    canViewAllUnits: true,
    canViewAssignedUnits: false,
    divisionIds: [],
    managedDivisionIds: [],
    unitIds: [],
  },
};

const sampleSession: WebSession = {
  sessionId: "reports-route-session-1",
  sessionKey: "session:reports-route-1",
  employeeId: sampleUser.employeeId,
  refreshToken: "refresh-1",
  mobileSessionKey: "session:SM-00.001",
  deviceId: "web-device-1",
  user: sampleUser,
  createdAt: "2026-05-15T00:00:00.000Z",
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

function createStubReportsService(): ReportsService {
  return {
    async getReport() {
      return {
        data: [
          {
            unitName: "MB 500 SEL",
            delayDays: 2,
            deliveryStatus: "DELAYED",
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
          sortBy: "delayDays",
          sortDirection: "desc" as const,
          view: null,
          filters: [],
          dateFrom: "2026-05-01",
          dateTo: "2026-05-15",
        },
        definition: {
          type: "delivery-accuracy" as const,
          title: "Delivery Accuracy",
          description: "Tracking akurasi delivery unit.",
          columns: [
            { key: "unitName", label: "Unit", kind: "mono" as const, align: "left" as const, sticky: true },
            { key: "delayDays", label: "Delay", kind: "number" as const, align: "right" as const, sticky: false },
            { key: "deliveryStatus", label: "Status", kind: "status" as const, align: "left" as const, sticky: false },
          ],
          sortOptions: [{ label: "Delay", value: "delayDays" }],
          filters: [],
          exportFormats: ["csv", "xlsx"] as const,
        },
        summary: [
          {
            label: "Total Unit",
            value: "1",
            helper: "Rows in current query.",
          },
        ],
      };
    },
    async exportReport() {
      return {
        fileName: "delivery-accuracy.csv",
        contentType: "text/csv; charset=utf-8",
        body: "unitName,delayDays,deliveryStatus\nMB 500 SEL,2,DELAYED",
      };
    },
  };
}

describe("reports routes", () => {
  test("lists a report and exports it", async () => {
    const fetchHandler = createApiFetchHandler({
      authService: createStubAuthService(sampleSession),
      reportsService: createStubReportsService(),
    });

    const listResponse = await fetchHandler(
      new Request("http://localhost/api/reports/delivery-accuracy", {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=session:reports-route-1`,
        },
      }),
    );
    expect(listResponse.status).toBe(200);
    const listBody = await listResponse.json();
    expect(listBody.definition.type).toBe("delivery-accuracy");

    const exportResponse = await fetchHandler(
      new Request("http://localhost/api/reports/delivery-accuracy/export?format=csv", {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=session:reports-route-1`,
        },
      }),
    );
    expect(exportResponse.status).toBe(200);
    expect(exportResponse.headers.get("Content-Type")).toContain("text/csv");
  });
});
