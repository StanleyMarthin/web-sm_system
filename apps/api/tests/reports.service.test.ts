import type { AuthUser } from "@smsystem/contracts/auth";
import type { ReportQuery, ReportType } from "@smsystem/contracts/reports";
import { describe, expect, test } from "bun:test";
import type { ReportsRepository } from "@/repositories/reports.repo";
import { DefaultReportsService } from "@/services/reports.service";
import type { WebSession } from "@/services/auth/session.service";
import type { AuditService } from "@/services/audit/audit.service";

const reportUser: AuthUser = {
  employeeId: "SM-00.001",
  fullName: "MIS Report",
  email: null,
  roleId: 1,
  roleName: "mis",
  divisionId: 8,
  divisionName: "INTERIOR",
  grade: "MIS",
  permissions: ["REPORT_VIEW", "REPORT_EXPORT"],
  scope: {
    canViewAllUnits: true,
    canViewAssignedUnits: false,
    divisionIds: [],
    managedDivisionIds: [],
    unitIds: [],
  },
};

const reportSession: WebSession = {
  sessionId: "report-session-1",
  sessionKey: "session:report-1",
  employeeId: reportUser.employeeId,
  refreshToken: "refresh-1",
  mobileSessionKey: "session:SM-00.001",
  deviceId: "web-device-1",
  user: reportUser,
  createdAt: "2026-05-15T00:00:00.000Z",
};

const sampleQuery: ReportQuery = {
  page: 1,
  limit: 25,
  search: "",
  sortBy: "delayDays",
  sortDirection: "desc",
  view: null,
  filters: [],
  dateFrom: "2026-05-01",
  dateTo: "2026-05-15",
};

class InMemoryReportsRepository implements ReportsRepository {
  async getReportData(params: { type: ReportType }) {
    return {
      rows:
        params.type === "delivery-accuracy"
          ? [
              {
                unitName: "MB 500 SEL",
                customerName: "Mr. Silmy",
                contractDeliveryDate: "2026-05-10",
                qcApprovedAt: "2026-05-12",
                delayDays: 2,
                deliveryStatus: "DELAYED",
              },
            ]
          : [],
      total: params.type === "delivery-accuracy" ? 1 : 0,
      summary: [
        {
          label: "Total Unit",
          value: params.type === "delivery-accuracy" ? "1" : "0",
          helper: "Rows in current query.",
        },
      ],
      filterOptions: {
        deliveryStatus: [
          { value: "DELAYED", label: "Delayed" },
          { value: "ON_TIME", label: "On Time" },
        ],
      },
    };
  }
}

const noopAuditService: AuditService = {
  async log() {
    return undefined;
  },
};

describe("DefaultReportsService", () => {
  test("returns report grid with definition metadata", async () => {
    const service = new DefaultReportsService(
      new InMemoryReportsRepository(),
      noopAuditService,
    );
    const result = await service.getReport(
      reportSession,
      "delivery-accuracy",
      sampleQuery,
    );

    expect(result.definition.type).toBe("delivery-accuracy");
    expect(result.definition.columns[0]?.key).toBe("unitName");
    expect(result.data[0]?.deliveryStatus).toBe("DELAYED");
    expect(result.summary[0]?.value).toBe("1");
  });

  test("builds xlsx export payload", async () => {
    const service = new DefaultReportsService(
      new InMemoryReportsRepository(),
      noopAuditService,
    );
    const exported = await service.exportReport(
      reportSession,
      "delivery-accuracy",
      sampleQuery,
      "xlsx",
    );

    expect(exported.fileName).toContain("delivery-accuracy");
    expect(exported.contentType).toContain("spreadsheetml");
    expect(exported.body instanceof Uint8Array).toBe(true);
  });
});
