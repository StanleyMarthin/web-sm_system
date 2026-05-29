import { SESSION_COOKIE_NAME } from "@smsystem/contracts/auth";
import type { AuthUser } from "@smsystem/contracts/auth";
import { permissionCodes } from "@smsystem/permissions";
import { describe, expect, test } from "bun:test";
import { createApiFetchHandler } from "@/app";
import type { AuthService } from "@/services/auth/auth.service";
import type { VendorService } from "@/services/vendor.service";
import type { WebSession } from "@/services/auth/session.service";

const sampleUser: AuthUser = {
  employeeId: "SM-17.001",
  fullName: "Ruhiat",
  email: null,
  roleId: 17,
  roleName: "ketua_divisi",
  divisionId: 12,
  divisionName: "INTERIOR",
  grade: "KD",
  permissions: [
    permissionCodes.vendorView,
    permissionCodes.vendorCreate,
    permissionCodes.vendorApprove,
    permissionCodes.vendorUpdateStatus,
    permissionCodes.vendorReceive,
  ],
  scope: {
    canViewAllUnits: false,
    canViewAssignedUnits: true,
    divisionIds: [12],
    managedDivisionIds: [12],
    unitIds: [],
  },
};

const sampleSession: WebSession = {
  sessionId: "vendor-route-session-1",
  sessionKey: "session:vendor-route-1",
  employeeId: sampleUser.employeeId,
  refreshToken: "refresh-1",
  mobileSessionKey: "session:SM-17.001",
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

function createStubVendorService(): VendorService {
  return {
    async list() {
      return {
        data: [
          {
            wovId: "WOV-1",
            wovNumber: "WOV/001/05/2026",
            carId: "CAR-1",
            unitName: "MB 500 SEL",
            customerName: "Mr. Silmy",
            coreId: null,
            prId: null,
            divisionName: "INTERIOR",
            requestedBy: "SM-17.001",
            requestedByName: "Ruhiat",
            accTracking: "PENDING_ADV" as const,
            status: "OPEN" as const,
            vendorId: null,
            vendorName: "Vendor A",
            picVendor: null,
            itemName: "Bumper chrome",
            quantity: 1,
            uom: "pcs",
            goodsConditionOut: "Retak halus",
            goodsConditionIn: null,
            dateOut: "2026-05-15",
            targetDateReturn: "2026-05-20",
            dateIn: null,
            qcStatus: null,
            estimatedCost: 2000000,
            actualCost: null,
            remarks: null,
            createdAt: "2026-05-15 09:00:00",
            updatedAt: "2026-05-15 09:00:00",
            agingDays: 0,
            riskScore: 30,
            isCritical: false,
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
          units: [],
          divisions: [],
          statuses: [],
          approvalStages: [],
          vendors: [],
        },
        query: {
          page: 1,
          limit: 25,
          search: "",
          sortBy: "createdAt",
          sortDirection: "desc" as const,
          view: null,
          filters: [],
          viewMode: "active" as const,
        },
        summary: {
          pendingApproval: 1,
          activeVendorCount: 1,
          overdueCount: 0,
          reworkCount: 0,
        },
      };
    },
    async create() {
      return {
        wovId: "WOV-NEW",
        accTracking: "PENDING_ADV" as const,
        status: "OPEN" as const,
      };
    },
    async findDetail() {
      return {
        ticket: (await this.list(sampleSession, {
          page: 1,
          limit: 25,
          search: "",
          sortBy: "createdAt",
          sortDirection: "desc",
          view: null,
          filters: [],
          viewMode: "active",
        })).data[0],
      };
    },
    async approve() {
      return { wovId: "WOV-1", accTracking: "PENDING_KP" as const, status: "OPEN" as const };
    },
    async updateStatus() {
      return { wovId: "WOV-1", accTracking: "APPROVED" as const, status: "SENT" as const };
    },
    async receive() {
      return { wovId: "WOV-1", accTracking: "APPROVED" as const, status: "RECEIVED" as const };
    },
    async cancel() {
      return { wovId: "WOV-1", accTracking: "APPROVED" as const, status: "CANCELLED" as const };
    },
  };
}

describe("vendor routes", () => {
  test("lists and creates vendor wo", async () => {
    const fetchHandler = createApiFetchHandler({
      authService: createStubAuthService(sampleSession),
      vendorService: createStubVendorService(),
    });

    const listResponse = await fetchHandler(
      new Request("http://localhost/api/vendor", {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=session:vendor-route-1`,
        },
      }),
    );
    expect(listResponse.status).toBe(200);
    const listBody = await listResponse.json();
    expect(listBody.data[0].wovId).toBe("WOV-1");

    const createResponse = await fetchHandler(
      new Request("http://localhost/api/vendor", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: `${SESSION_COOKIE_NAME}=session:vendor-route-1`,
        },
        body: JSON.stringify({
          carId: "CAR-1",
          coreId: null,
          prId: null,
          vendorId: null,
          vendorName: "Vendor A",
          picVendor: null,
          itemName: "Bumper chrome",
          quantity: 1,
          uom: "pcs",
          goodsConditionOut: "Retak halus",
          targetDateReturn: "2026-05-20",
          estimatedCost: 2000000,
          remarks: null,
        }),
      }),
    );
    expect(createResponse.status).toBe(200);
    const createBody = await createResponse.json();
    expect(createBody.data.wovId).toBe("WOV-NEW");
  });

  test("returns 400 for invalid vendor query limit", async () => {
    const fetchHandler = createApiFetchHandler({
      authService: createStubAuthService(sampleSession),
      vendorService: createStubVendorService(),
    });

    const response = await fetchHandler(
      new Request("http://localhost/api/vendor?limit=150", {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=session:vendor-route-1`,
        },
      }),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.errorCode).toBe("INVALID_QUERY");
  });
});
