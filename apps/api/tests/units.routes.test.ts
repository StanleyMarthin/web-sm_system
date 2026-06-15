import { SESSION_COOKIE_NAME } from "@smsystem/contracts/auth";
import type { AuthUser } from "@smsystem/contracts/auth";
import type { UnitBomWorkspace } from "@smsystem/contracts/unit-bom";
import type { UnitPanelCollection, UnitPanelRecord } from "@smsystem/contracts/unit-panel";
import { permissionCodes } from "@smsystem/permissions";
import { describe, expect, test } from "bun:test";
import { createApiFetchHandler } from "@/app";
import type { AuthService } from "@/services/auth/auth.service";
import type { WebSession } from "@/services/auth/session.service";
import type { UnitBoardListResult, UnitsService } from "@/services/units.service";

const sampleUser: AuthUser = {
  employeeId: "SM-08.005",
  fullName: "YUDHA AGUSTIANA",
  email: null,
  roleId: 19,
  roleName: "kepala_produksi",
  divisionId: 29,
  divisionName: "MANAGER PRODUKSI",
  grade: "KEPALA PRODUKSI",
  permissions: [
    permissionCodes.viewUnits,
    permissionCodes.unitDetailView,
    permissionCodes.viewAssignedUnits,
  ],
  scope: {
    canViewAllUnits: false,
    canViewAssignedUnits: true,
    divisionIds: [29],
    managedDivisionIds: [],
    unitIds: [],
  },
};

const sampleSession: WebSession = {
  sessionId: "session-1",
  sessionKey: "session:SM-08.005:session-1",
  employeeId: sampleUser.employeeId,
  refreshToken: "refresh-1",
  mobileSessionKey: "session:SM-08.005",
  deviceId: "web-device-1",
  user: sampleUser,
  createdAt: "2026-05-13T00:00:00.000Z",
};

const sampleBoardResult: UnitBoardListResult = {
  data: [
    {
      unitId: "MB500SEL_MRSILMY",
      unitName: "MB 500 SEL",
      plateNumber: null,
      customerName: "Mr. SILMY",
      restorationType: "FULL_RESTORASI",
      isMargin: true,
      incomingDate: "2026-05-01",
      revisionContract: null,
      kpName: "IQBAL TAUFIK NURDIN",
      advisorName: "-",
      targetDeliveryDate: "2026-05-30",
      etaDate: "2026-05-28",
      riskLevel: "YELLOW",
      progressPercent: 55,
      remainingHours: 124.5,
      woOpenCount: 2,
      prOpenCount: 0,
      qcIssueOpenCount: 1,
      issueOpenCount: 0,
      status: "In_Progress",
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
    sortBy: "targetDeliveryDate",
    sortDirection: "asc",
    view: null,
    filters: [],
  },
};

function createStubAuthService(overrides: Partial<AuthService> = {}): AuthService {
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
      return sampleSession;
    },
    async getCurrentUser() {
      return sampleUser;
    },
    async getCurrentPermissions() {
      return sampleUser.permissions;
    },
    ...overrides,
  };
}

function createStubUnitsService(overrides: Partial<UnitsService> = {}): UnitsService {
  return {
    async listUnits() {
      return sampleBoardResult;
    },
    async getUnitSummary() {
      return {
        unitId: "MB500SEL_MRSILMY",
        unitName: "MB 500 SEL",
        plateNumber: null,
        customerName: "Mr. SILMY",
        restorationType: "FULL_RESTORASI",
        isMargin: true,
        incomingDate: "2026-05-01",
        revisionContract: null,
        kpName: "IQBAL TAUFIK NURDIN",
        advisorName: "-",
        targetDeliveryDate: "2026-05-30",
        etaDate: "2026-05-28",
        riskLevel: "YELLOW",
        progressPercent: 55,
        remainingHours: 124.5,
        woOpenCount: 2,
        prOpenCount: 0,
        qcIssueOpenCount: 1,
        issueOpenCount: 0,
        status: "In_Progress",
      };
    },
    async createUnit(_session, input) {
      return {
        unitId: input.unitId,
        unitName: input.unitName,
        plateNumber: input.plateNumber,
        customerName: input.customerName,
        restorationType: input.restorationType,
        isMargin: input.isMargin,
        incomingDate: input.incomingDate,
        revisionContract: input.revisionContract,
        kpName: "-",
        advisorName: "-",
        targetDeliveryDate: input.contractDeliveryDate,
        etaDate: input.contractDeliveryDate,
        riskLevel: "UNKNOWN",
        progressPercent: 0,
        remainingHours: 0,
        woOpenCount: 0,
        prOpenCount: 0,
        qcIssueOpenCount: 0,
        issueOpenCount: 0,
        status: input.status,
      };
    },
    async updateUnit(_session, unitId, input) {
      return {
        unitId,
        unitName: input.unitName,
        plateNumber: input.plateNumber,
        customerName: input.customerName,
        restorationType: input.restorationType,
        isMargin: input.isMargin,
        incomingDate: input.incomingDate,
        revisionContract: input.revisionContract,
        kpName: "-",
        advisorName: "-",
        targetDeliveryDate: input.contractDeliveryDate,
        etaDate: input.contractDeliveryDate,
        riskLevel: "UNKNOWN",
        progressPercent: 0,
        remainingHours: 0,
        woOpenCount: 0,
        prOpenCount: 0,
        qcIssueOpenCount: 0,
        issueOpenCount: 0,
        status: input.status,
      };
    },
    async deleteUnit(_session, unitId) {
      return { deletedUnitId: unitId };
    },
    async getUnitWorkspace() {
      return {
        unitId: "MB500SEL_MRSILMY",
        countdownSummary: {
          total: 10,
          plan: 3,
          proses: 5,
          qcReady: 1,
          done: 1,
          remainingHours: 124.5,
          progressPercent: 55,
        },
        woSummary: {
          submitted: 0,
          approved: 2,
          rejected: 0,
          open: 2,
        },
        issueSummary: {
          open: 0,
          resolved: 0,
          highSeverityOpen: 0,
        },
        deliveryRisk: {
          level: "YELLOW",
          reason: "ETA mendekati target delivery.",
        },
      };
    },
    async getUnitBom() {
      const payload: UnitBomWorkspace = {
        unitId: "MB500SEL_MRSILMY",
        summary: {
          totalParts: 2,
          installedParts: 1,
          inDivisionParts: 0,
          disassembledParts: 1,
        },
        tree: [
          {
            nodeId: "category-1",
            nodeType: "CATEGORY",
            label: "Interior",
            category: "Interior",
            section: null,
            panelId: null,
            physicalStatus: null,
            divisionId: null,
            divisionName: null,
            progressPercent: 50,
            remainingHours: 2,
            actualId: null,
            logisticStatus: null,
            logisticReference: null,
            logisticPath: null,
            children: [
              {
                nodeId: "section-1",
                nodeType: "SECTION",
                label: "ASBAK COIN",
                category: "Interior",
                section: "ASBAK COIN",
                panelId: null,
                physicalStatus: null,
                divisionId: null,
                divisionName: null,
                progressPercent: 50,
                remainingHours: 2,
                actualId: null,
                logisticStatus: null,
                logisticReference: null,
                logisticPath: null,
                children: [
                  {
                    nodeId: "part-1",
                    nodeType: "PART",
                    label: "ASBAK COIN",
                    category: "Interior",
                    section: "ASBAK COIN",
                    panelId: 459,
                    physicalStatus: "DISASSEMBLED",
                    divisionId: null,
                    divisionName: null,
                    progressPercent: 0,
                    remainingHours: 2,
                    actualId: null,
                    logisticStatus: "READY_GUDANG",
                    logisticReference: "Ready Gudang",
                    logisticPath: "/warehouse?section=stock-card&tab=stock-card&search=ASBAK%20COIN",
                    children: [],
                  },
                ],
              },
            ],
          },
        ],
      };

      return payload;
    },
    async getUnitPanels() {
      const payload: UnitPanelCollection = {
        unitId: "MB500SEL_MRSILMY",
        tree: [
          {
            id: 1,
            carId: "MB500SEL_MRSILMY",
            parentId: null,
            nodeType: "PANEL",
            section: "Interior",
            name: "Dashboard",
            category: "Interior",
            isActive: true,
            sortOrder: 1,
            qty: 1,
            defaultLocationType: "UNIT",
            defaultStockStatus: "INSTALLED",
            defaultConditionType: "BEKAS",
            countdownUsageCount: 0,
            statusUsageCount: 0,
            childCount: 1,
            createdAt: "2026-05-30 10:00:00",
            updatedAt: "2026-05-30 10:00:00",
            children: [
              {
                id: 2,
                carId: "MB500SEL_MRSILMY",
                parentId: 1,
                nodeType: "PART",
                section: "Interior",
                name: "Panel Speedometer",
                category: "Interior",
                isActive: true,
                sortOrder: 1,
                qty: 1,
                defaultLocationType: "UNIT",
                defaultStockStatus: "INSTALLED",
                defaultConditionType: "BEKAS",
                countdownUsageCount: 0,
                statusUsageCount: 0,
                childCount: 0,
                createdAt: "2026-05-30 10:00:00",
                updatedAt: "2026-05-30 10:00:00",
                children: [],
              },
            ],
          },
        ],
      };

      return payload;
    },
    async createUnitPanel(_session, _unitId, input) {
      const record: UnitPanelRecord = {
        id: 10,
        carId: "MB500SEL_MRSILMY",
        parentId: input.parentId,
        nodeType: input.parentId === null ? "PANEL" : "PART",
        section: input.section,
        name: input.name,
        category: input.category,
        isActive: input.isActive,
        sortOrder: input.sortOrder,
        qty: input.qty,
        defaultLocationType: input.defaultLocationType,
        defaultStockStatus: input.defaultStockStatus,
        defaultConditionType: input.defaultConditionType,
        countdownUsageCount: 0,
        statusUsageCount: 0,
        childCount: 0,
        createdAt: "2026-05-30 10:00:00",
        updatedAt: "2026-05-30 10:00:00",
        children: [],
      };
      return record;
    },
    async updateUnitPanel(_session, _unitId, panelId, input) {
      const record: UnitPanelRecord = {
        id: panelId,
        carId: "MB500SEL_MRSILMY",
        parentId: null,
        nodeType: "PANEL",
        section: input.section,
        name: input.name,
        category: input.category,
        isActive: input.isActive,
        sortOrder: input.sortOrder,
        qty: input.qty,
        defaultLocationType: input.defaultLocationType,
        defaultStockStatus: input.defaultStockStatus,
        defaultConditionType: input.defaultConditionType,
        countdownUsageCount: 0,
        statusUsageCount: 0,
        childCount: 0,
        createdAt: "2026-05-30 10:00:00",
        updatedAt: "2026-05-30 10:10:00",
        children: [],
      };
      return record;
    },
    async renameUnitPanelCategory() {
      return { updatedCount: 2 };
    },
    async deleteUnitPanel(_session, _unitId, panelId) {
      return { deletedId: panelId };
    },
    ...overrides,
  };
}

describe("units routes", () => {
  test("lists units and returns workspace summary", async () => {
    const fetchHandler = createApiFetchHandler({
      authService: createStubAuthService(),
      unitsService: createStubUnitsService(),
    });

    const listResponse = await fetchHandler(
      new Request("http://localhost/api/units?page=1&limit=25", {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=session:SM-08.005:session-1`,
        },
      }),
    );
    const listBody = await listResponse.json();

    expect(listResponse.status).toBe(200);
    expect(listBody.data[0].unitId).toBe("MB500SEL_MRSILMY");
    expect(listBody.meta.total).toBe(1);

    const detailResponse = await fetchHandler(
      new Request("http://localhost/api/units/MB500SEL_MRSILMY", {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=session:SM-08.005:session-1`,
        },
      }),
    );
    const detailBody = await detailResponse.json();

    expect(detailResponse.status).toBe(200);
    expect(detailBody.data.unit.unitId).toBe("MB500SEL_MRSILMY");

    const workspaceResponse = await fetchHandler(
      new Request("http://localhost/api/units/MB500SEL_MRSILMY/workspace", {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=session:SM-08.005:session-1`,
        },
      }),
    );
    const workspaceBody = await workspaceResponse.json();

    expect(workspaceResponse.status).toBe(200);
    expect(workspaceBody.data.deliveryRisk.level).toBe("YELLOW");
    expect(workspaceBody.data.countdownSummary.total).toBe(10);

    const bomResponse = await fetchHandler(
      new Request("http://localhost/api/units/MB500SEL_MRSILMY/bom", {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=session:SM-08.005:session-1`,
        },
      }),
    );
    const bomBody = await bomResponse.json();

    expect(bomResponse.status).toBe(200);
    expect(bomBody.data.summary.totalParts).toBe(2);
    expect(bomBody.data.tree[0].children[0].children[0].logisticStatus).toBe("READY_GUDANG");
  });

  test("blocks units route when permission is missing", async () => {
    const fetchHandler = createApiFetchHandler({
      authService: createStubAuthService({
        async getCurrentSession() {
          return {
            ...sampleSession,
            user: {
              ...sampleUser,
              permissions: [],
            },
          };
        },
      }),
      unitsService: createStubUnitsService(),
    });

    const response = await fetchHandler(
      new Request("http://localhost/api/units"),
    );

    expect(response.status).toBe(403);
  });

  test("allows units route with board permission only", async () => {
    const fetchHandler = createApiFetchHandler({
      authService: createStubAuthService({
        async getCurrentSession() {
          return {
            ...sampleSession,
            user: {
              ...sampleUser,
              permissions: [permissionCodes.viewUnits],
            },
          };
        },
      }),
      unitsService: createStubUnitsService(),
    });

    const response = await fetchHandler(
      new Request("http://localhost/api/units"),
    );

    expect(response.status).toBe(200);
  });

  test("allows super-unit scope to create unit without legacy manage permissions", async () => {
    const fetchHandler = createApiFetchHandler({
      authService: createStubAuthService({
        async getCurrentSession() {
          return {
            ...sampleSession,
            user: {
              ...sampleUser,
              permissions: [
                permissionCodes.viewUnits,
                permissionCodes.viewAllUnits,
              ],
              scope: {
                ...sampleUser.scope,
                canViewAllUnits: true,
              },
            },
          };
        },
      }),
      unitsService: createStubUnitsService(),
    });

    const response = await fetchHandler(
      new Request("http://localhost/api/units", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          unitId: "TEST_SUPER_UNIT",
          unitName: "Test Super Unit",
          plateNumber: null,
          customerName: "Mr. Test",
          restorationType: "FULL_RESTORASI",
          isMargin: true,
          contractDeliveryDate: "2026-06-30",
          incomingDate: "2026-06-12",
          revisionContract: null,
          status: "In_Progress",
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data.unit.unitId).toBe("TEST_SUPER_UNIT");
  });

  test("blocks unit detail when detail permission is missing", async () => {
    const fetchHandler = createApiFetchHandler({
      authService: createStubAuthService({
        async getCurrentSession() {
          return {
            ...sampleSession,
            user: {
              ...sampleUser,
              permissions: [permissionCodes.viewUnits],
            },
          };
        },
      }),
      unitsService: createStubUnitsService(),
    });

    const response = await fetchHandler(
      new Request("http://localhost/api/units/MB500SEL_MRSILMY"),
    );

    expect(response.status).toBe(403);
  });

  test("lists unit master panels and mutates with manage permission", async () => {
    const fetchHandler = createApiFetchHandler({
      authService: createStubAuthService({
        async getCurrentSession() {
          return {
            ...sampleSession,
            user: {
              ...sampleUser,
              permissions: [
                permissionCodes.viewUnits,
                permissionCodes.unitDetailView,
                permissionCodes.unitPanelManage,
              ],
            },
          };
        },
      }),
      unitsService: createStubUnitsService(),
    });

    const listResponse = await fetchHandler(
      new Request("http://localhost/api/units/MB500SEL_MRSILMY/master-panels"),
    );
    const listBody = await listResponse.json();

    expect(listResponse.status).toBe(200);
    expect(listBody.data.tree[0].children[0].name).toBe("Panel Speedometer");

    const createResponse = await fetchHandler(
      new Request("http://localhost/api/units/MB500SEL_MRSILMY/master-panels", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          parentId: null,
          section: "Interior",
          name: "Console Tengah",
          category: "Interior",
          sortOrder: 2,
          isActive: true,
        }),
      }),
    );
    const createBody = await createResponse.json();

    expect(createResponse.status).toBe(201);
    expect(createBody.data.record.id).toBe(10);

    const updateResponse = await fetchHandler(
      new Request("http://localhost/api/units/MB500SEL_MRSILMY/master-panels/10", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          section: "Interior",
          name: "Console Tengah Revisi",
          category: "Interior",
          sortOrder: 3,
          isActive: true,
        }),
      }),
    );
    const updateBody = await updateResponse.json();

    expect(updateResponse.status).toBe(200);
    expect(updateBody.data.record.sortOrder).toBe(3);

    const categoryResponse = await fetchHandler(
      new Request("http://localhost/api/units/MB500SEL_MRSILMY/master-panels/category", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fromCategory: "Lainnya",
          toCategory: "Body",
        }),
      }),
    );
    const categoryBody = await categoryResponse.json();

    expect(categoryResponse.status).toBe(200);
    expect(categoryBody.data.updatedCount).toBe(2);

    const deleteResponse = await fetchHandler(
      new Request("http://localhost/api/units/MB500SEL_MRSILMY/master-panels/10", {
        method: "DELETE",
      }),
    );
    const deleteBody = await deleteResponse.json();

    expect(deleteResponse.status).toBe(200);
    expect(deleteBody.data.deletedId).toBe(10);
  });

  test("blocks unit master panel mutation when manage permission is missing", async () => {
    const fetchHandler = createApiFetchHandler({
      authService: createStubAuthService({
        async getCurrentSession() {
          return {
            ...sampleSession,
            user: {
              ...sampleUser,
              permissions: [permissionCodes.viewUnits, permissionCodes.unitDetailView],
            },
          };
        },
      }),
      unitsService: createStubUnitsService(),
    });

    const response = await fetchHandler(
      new Request("http://localhost/api/units/MB500SEL_MRSILMY/master-panels", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          parentId: null,
          section: "Interior",
          name: "Console Tengah",
          category: "Interior",
          sortOrder: 2,
          isActive: true,
        }),
      }),
    );

    expect(response.status).toBe(403);
  });
});
