import { SESSION_COOKIE_NAME } from "@smsystem/contracts/auth";
import type { AuthUser } from "@smsystem/contracts/auth";
import { describe, expect, test } from "bun:test";
import { createApiFetchHandler } from "@/app";
import type { AuthService } from "@/services/auth/auth.service";
import type { IssuesService } from "@/services/issues.service";
import type { WebSession } from "@/services/auth/session.service";

const sampleUser: AuthUser = {
  employeeId: "SM-08.005",
  fullName: "Yudha Agustiana",
  email: null,
  roleId: 19,
  roleName: "kepala_produksi",
  divisionId: 12,
  divisionName: "INTERIOR",
  grade: "KP",
  permissions: ["QC_VIEW", "QC_SUBMIT", "QC_VALIDATE"],
  scope: {
    canViewAllUnits: false,
    canViewAssignedUnits: true,
    divisionIds: [12],
    managedDivisionIds: [12],
    unitIds: [],
  },
};

const sampleSession: WebSession = {
  sessionId: "issue-route-session-1",
  sessionKey: "session:issue-route-1",
  employeeId: sampleUser.employeeId,
  refreshToken: "refresh-1",
  mobileSessionKey: "session:SM-08.005",
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

function createStubIssuesService(): IssuesService {
  return {
    async list() {
      return {
        data: [
          {
            issueId: "ISSUE-1",
            issueNumber: "ISS-20260514-001",
            sourceType: "MANUAL" as const,
            sourceRefId: null,
            carId: "CAR-1",
            unitName: "MB 500 SEL",
            customerName: "Mr. Silmy",
            divisionId: 12,
            divisionName: "INTERIOR",
            countdownId: null,
            planId: null,
            qcId: null,
            ledgerId: null,
            issueType: "HAMBATAN",
            severity: "HIGH" as const,
            title: "Parts belum datang",
            description: "Perlu follow-up vendor.",
            status: "OPEN" as const,
            isUrgent: true,
            assignedTo: null,
            assignedToName: null,
            reportedBy: "SM-08.005",
            reportedByName: "Yudha Agustiana",
            createdAt: "2026-05-14 09:00:00",
            updatedAt: "2026-05-14 09:00:00",
            resolutionNotes: null,
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
          sortBy: "createdAt",
          sortDirection: "desc" as const,
          view: null,
          filters: [],
        },
        references: {
          units: [],
          divisions: [],
          statuses: [],
          severities: [],
          employees: [],
        },
        storageReady: true,
        summary: {
          openCount: 1,
          urgentCount: 1,
          escalatedCount: 0,
        },
      };
    },
    async listUrgent() {
      return [
        {
          issueId: "ISSUE-1",
          issueNumber: "ISS-20260514-001",
          sourceType: "MANUAL" as const,
          sourceRefId: null,
          carId: "CAR-1",
          unitName: "MB 500 SEL",
          customerName: "Mr. Silmy",
          divisionId: 12,
          divisionName: "INTERIOR",
          countdownId: null,
          planId: null,
          qcId: null,
          ledgerId: null,
          issueType: "HAMBATAN",
          severity: "HIGH" as const,
          title: "Parts belum datang",
          description: "Perlu follow-up vendor.",
          status: "OPEN" as const,
          isUrgent: true,
          assignedTo: null,
          assignedToName: null,
          reportedBy: "SM-08.005",
          reportedByName: "Yudha Agustiana",
          createdAt: "2026-05-14 09:00:00",
          updatedAt: "2026-05-14 09:00:00",
          resolutionNotes: null,
        },
      ];
    },
    async findDetail() {
      return {
        issue: {
          issueId: "ISSUE-1",
          issueNumber: "ISS-20260514-001",
          sourceType: "MANUAL" as const,
          sourceRefId: null,
          carId: "CAR-1",
          unitName: "MB 500 SEL",
          customerName: "Mr. Silmy",
          divisionId: 12,
          divisionName: "INTERIOR",
          countdownId: null,
          planId: null,
          qcId: null,
          ledgerId: null,
          issueType: "HAMBATAN",
          severity: "HIGH" as const,
          title: "Parts belum datang",
          description: "Perlu follow-up vendor.",
          status: "OPEN" as const,
          isUrgent: true,
          assignedTo: null,
          assignedToName: null,
          reportedBy: "SM-08.005",
          reportedByName: "Yudha Agustiana",
          createdAt: "2026-05-14 09:00:00",
          updatedAt: "2026-05-14 09:00:00",
          resolutionNotes: null,
        },
      };
    },
    async create() {
      return { issueId: "ISSUE-1", status: "OPEN" as const };
    },
    async acknowledge() {
      return { issueId: "ISSUE-1", status: "ACKNOWLEDGED" as const };
    },
    async assign() {
      return { issueId: "ISSUE-1", status: "ACKNOWLEDGED" as const };
    },
    async start() {
      return { issueId: "ISSUE-1", status: "IN_PROGRESS" as const };
    },
    async markQcRecheck() {
      return { issueId: "ISSUE-1", status: "QC_RECHECK" as const };
    },
    async resolve() {
      return { issueId: "ISSUE-1", status: "RESOLVED" as const };
    },
    async escalate() {
      return { issueId: "ISSUE-1", status: "ESCALATED" as const };
    },
    async waive() {
      return { issueId: "ISSUE-1", status: "WAIVED" as const };
    },
    async listByUnit() {
      return [];
    },
  };
}

describe("issues routes", () => {
  test("lists issue log and creates issue", async () => {
    const fetchHandler = createApiFetchHandler({
      authService: createStubAuthService(sampleSession),
      issuesService: createStubIssuesService(),
    });

    const listResponse = await fetchHandler(
      new Request("http://localhost/api/issues?page=1&limit=25", {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=session:issue-route-1`,
        },
      }),
    );

    expect(listResponse.status).toBe(200);
    const listBody = await listResponse.json();
    expect(listBody.data[0].issueId).toBe("ISSUE-1");

    const createResponse = await fetchHandler(
      new Request("http://localhost/api/issues", {
        method: "POST",
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=session:issue-route-1`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          carId: "CAR-1",
          issueType: "HAMBATAN",
          severity: "HIGH",
          title: "Parts belum datang",
          description: "Perlu follow-up vendor.",
        }),
      }),
    );

    expect(createResponse.status).toBe(201);
    const createBody = await createResponse.json();
    expect(createBody.data.issueId).toBe("ISSUE-1");
  });

  test("resolves issue when validation permission exists", async () => {
    const fetchHandler = createApiFetchHandler({
      authService: createStubAuthService(sampleSession),
      issuesService: createStubIssuesService(),
    });

    const response = await fetchHandler(
      new Request("http://localhost/api/issues/ISSUE-1/resolve", {
        method: "PATCH",
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=session:issue-route-1`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          resolutionNotes: "Issue selesai.",
        }),
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.status).toBe("RESOLVED");
  });

  test("blocks resolve when validation permission is missing", async () => {
    const fetchHandler = createApiFetchHandler({
      authService: createStubAuthService({
        ...sampleSession,
        user: {
          ...sampleUser,
          permissions: ["QC_VIEW", "QC_SUBMIT"],
        },
      }),
      issuesService: createStubIssuesService(),
    });

    const response = await fetchHandler(
      new Request("http://localhost/api/issues/ISSUE-1/resolve", {
        method: "PATCH",
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=session:issue-route-1`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          resolutionNotes: "Issue selesai.",
        }),
      }),
    );

    expect(response.status).toBe(403);
  });

  test("returns storage readiness flag when issue log is not ready", async () => {
    const fetchHandler = createApiFetchHandler({
      authService: createStubAuthService(sampleSession),
      issuesService: {
        ...createStubIssuesService(),
        async list() {
          return {
            data: [],
            storageReady: false,
            meta: {
              page: 1,
              limit: 25,
              total: 0,
              totalPages: 0,
              hasNext: false,
              hasPrev: false,
            },
            query: {
              page: 1,
              limit: 25,
              search: "",
              sortBy: "createdAt",
              sortDirection: "desc" as const,
              view: null,
              filters: [],
            },
            references: {
              units: [],
              divisions: [],
              statuses: [],
              severities: [],
              employees: [],
            },
            summary: {
              openCount: 0,
              urgentCount: 0,
              escalatedCount: 0,
            },
          };
        },
      },
    });

    const response = await fetchHandler(
      new Request("http://localhost/api/issues?page=1&limit=25", {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=session:issue-route-1`,
        },
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.storageReady).toBe(false);
  });
});
