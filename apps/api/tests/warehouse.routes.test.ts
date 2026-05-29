import { SESSION_COOKIE_NAME } from "@smsystem/contracts/auth";
import type { AuthUser } from "@smsystem/contracts/auth";
import { permissionCodes } from "@smsystem/permissions";
import { describe, expect, test } from "bun:test";
import { createApiFetchHandler } from "@/app";
import type { AuthService } from "@/services/auth/auth.service";
import type { WarehouseService } from "@/services/warehouse.service";
import type { WebSession } from "@/services/auth/session.service";

function createWarehouseQuery(overrides: Record<string, unknown> = {}) {
  return {
    page: 1,
    limit: 25,
    search: "",
    sortBy: "requestDate",
    sortDirection: "desc" as const,
    view: null,
    filters: [],
    dateFrom: null,
    dateTo: null,
    ...overrides,
  };
}

const sampleUser: AuthUser = {
  employeeId: "SM-11.003",
  fullName: "Asep Gudang",
  email: null,
  roleId: 33,
  roleName: "warehouse",
  divisionId: 8,
  divisionName: "INTERIOR",
  grade: "KD",
  permissions: [
    permissionCodes.warehouseView,
    permissionCodes.warehouseRequest,
    permissionCodes.warehouseApprove,
    permissionCodes.warehouseReady,
    permissionCodes.warehouseIssue,
    permissionCodes.warehouseReturn,
    permissionCodes.warehouseStockCardView,
    permissionCodes.warehouseStockCardManage,
    permissionCodes.warehouseStockOpnameView,
    permissionCodes.warehouseStockOpnameCreate,
    permissionCodes.warehouseStockAdjustmentView,
    permissionCodes.warehouseStockAdjustmentCreate,
    permissionCodes.warehouseLocationManage,
  ],
  scope: {
    canViewAllUnits: false,
    canViewAssignedUnits: true,
    divisionIds: [8],
    managedDivisionIds: [8],
    unitIds: ["CAR-1"],
  },
};

const sampleSession: WebSession = {
  sessionId: "warehouse-route-session-1",
  sessionKey: "session:warehouse-route-1",
  employeeId: sampleUser.employeeId,
  refreshToken: "refresh-1",
  mobileSessionKey: "session:SM-11.003",
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

function createStubWarehouseService(): WarehouseService {
  return {
    async getDashboard() {
      return {
        summary: {
          pendingApproval: 1,
          notPrepared: 2,
          notPickedUp: 1,
          inUse: 3,
          overdueNotReturned: 1,
        },
        lateUsers: [],
        divisionsUsing: [],
        materialsOut: [],
        lowStockAlerts: [],
      };
    },
    async listTransactions() {
      return {
        data: [
          {
            transactionId: "WH-1",
            transactionType: "PENGAMBILAN" as const,
            itemCategory: "SPARE_PART" as const,
            itemName: "Chrome clip",
            itemMasterId: null,
            itemAliasUsed: null,
            qty: 2,
            qtyReturned: null,
            uom: "pcs",
            carId: "CAR-1",
            unitName: "MB 500 SEL",
            employeeId: "SM-11.003",
            requesterName: "Asep Gudang",
            divisionId: 8,
            divisionName: "INTERIOR",
            stockCardId: null,
            sourceCarId: null,
            sourceUnitName: null,
            storageLocationId: null,
            locationLabel: null,
            locationDetail: null,
            requestDate: "2026-05-15 09:00:00",
            targetSearchDate: null,
            actualReleaseDate: null,
            deadlineDate: "2026-05-17",
            actualReturnDate: null,
            itemStatus: "OPEN" as const,
            approvalStatus: "PENDING_KD" as const,
            itemCondition: null,
            notes: null,
            picWarehouseName: null,
            accKdName: null,
            photoCount: 0,
            daysOverdue: null,
            isOverdue: false,
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
          itemCategories: [],
          itemStatuses: [],
          approvalStatuses: [],
          transactionTypes: [],
        },
        query: {
          ...createWarehouseQuery({
            sortBy: "requestDate",
            sortDirection: "desc" as const,
            view: "active" as const,
          }),
        },
        summary: {
          pendingApproval: 1,
          readyCount: 0,
          releasedCount: 0,
          overdueCount: 0,
          storedCount: 0,
        },
      };
    },
    async listPendingApproval() {
      return [];
    },
    async listStockCard() {
      return {
        data: [],
        meta: {
          page: 1,
          limit: 25,
          total: 0,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
        query: {
          ...createWarehouseQuery({
            sortBy: "dateIn",
            sortDirection: "desc" as const,
          }),
        },
      };
    },
    async listItems() {
      return {
        data: [],
        meta: {
          page: 1,
          limit: 25,
          total: 0,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
        query: {
          ...createWarehouseQuery({
            sortBy: "itemName",
            sortDirection: "asc" as const,
          }),
        },
      };
    },
    async listMaterialUsage() {
      return {
        data: [],
        meta: {
          page: 1,
          limit: 25,
          total: 0,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
        query: {
          ...createWarehouseQuery({
            sortBy: "usageDate",
            sortDirection: "desc" as const,
          }),
        },
      };
    },
    async listStorageLocations() {
      return {
        data: [
          {
            storageLocationId: 11,
            locationType: "GUDANG" as const,
            zone: "A",
            rack: "01",
            shelf: "01",
            label: "A-01-01",
            isActive: true,
            itemCount: 2,
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
          ...createWarehouseQuery({
            sortBy: "label",
            sortDirection: "asc" as const,
          }),
        },
      };
    },
    async listRequestJobs() {
      return [
        {
          coreId: "CORE-1",
          carId: "CAR-1",
          unitName: "MB 500 SEL",
          divisionId: 8,
          divisionName: "INTERIOR",
          panelName: "Body",
          jobName: "Pasang clip",
          taskDate: "2026-05-20",
          targetSearchDate: "2026-05-20",
          deadlineDate: "2026-05-20",
          isOvertime: false,
        },
      ];
    },
    async listRequestEmployees() {
      return [{ value: "SM-11.003", label: "Asep Gudang · SM-11.003" }];
    },
    async listRequestStockCards() {
      return [];
    },
    async listTransferStockCards() {
      return [
        {
          stockCardId: "SC-DONOR-1",
          entryNo: "SC/2026/05/0091",
          carId: "CAR-DONOR-1",
          unitName: "W123 DONOR",
          partCode: "ECU-123",
          panelSection: "Electrical",
          partName: "ECU Bosch",
          conditionType: "BEKAS" as const,
          qty: 1,
          uom: "pcs",
          storageLocationId: 11,
          locationLabel: "A-01-01",
          locationDetail: null,
          dateIn: "2026-05-20",
          dateOut: null,
          takenByName: null,
          status: "IN_STORAGE" as const,
          isLabeled: true,
          itemCategory: "SPARE_PART" as const,
          photoUrls: [],
          itemMasterId: "ITEM-ECU-1",
        },
      ];
    },
    async createRequest() {
      return {
        transactionId: "WH-NEW",
        approvalStatus: "PENDING_KD" as const,
        itemStatus: "OPEN" as const,
        transactionType: "PENGAMBILAN" as const,
      };
    },
    async approve() {
      return {
        transactionId: "WH-1",
        approvalStatus: "PENDING_KEPALA_GUDANG" as const,
        itemStatus: "OPEN" as const,
        transactionType: "PENGAMBILAN" as const,
      };
    },
    async reject() {
      return {
        transactionId: "WH-1",
        approvalStatus: "REJECTED" as const,
        itemStatus: "OPEN" as const,
        transactionType: "PENGAMBILAN" as const,
      };
    },
    async issue() {
      return {
        transactionId: "WH-1",
        approvalStatus: "APPROVED" as const,
        itemStatus: "RELEASED" as const,
        transactionType: "PENGAMBILAN" as const,
      };
    },
    async ready() {
      return {
        transactionId: "WH-1",
        approvalStatus: "APPROVED" as const,
        itemStatus: "READY" as const,
        transactionType: "PENGAMBILAN" as const,
      };
    },
    async returnItem() {
      return {
        transactionId: "WH-1",
        approvalStatus: "APPROVED" as const,
        itemStatus: "RETURNED" as const,
        transactionType: "PENGEMBALIAN" as const,
      };
    },
    async storeItem() {
      return {
        transactionId: "WH-1",
        approvalStatus: "APPROVED" as const,
        itemStatus: "STORED" as const,
        transactionType: "PENGEMBALIAN" as const,
      };
    },
    async createStockCardUploadTicket() {
      return {
        uploadUrl: "https://upload.example.com/object",
        publicUrl: "https://cdn.example.com/object.jpg",
        objectKey: "warehouse/object.jpg",
      };
    },
    async updateStockCardPhotos() {
      return {
        stockCardId: "SC-1",
        photoUrls: ["https://cdn.example.com/object.jpg"],
      };
    },
    async createStorageLocation() {
      return {
        storageLocationId: 22,
        locationType: "GUDANG" as const,
        zone: "B",
        rack: "02",
        shelf: "03",
        label: "B-02-03",
        isActive: true,
        itemCount: 0,
      };
    },
    async updateStorageLocation() {
      return {
        storageLocationId: 22,
        locationType: "GUDANG" as const,
        zone: "B",
        rack: "02",
        shelf: "03",
        label: "B-02-03",
        isActive: true,
        itemCount: 0,
      };
    },
    async deleteStorageLocation() {
      return {
        storageLocationId: 22,
        locationType: "GUDANG" as const,
        zone: "B",
        rack: "02",
        shelf: "03",
        label: "B-02-03",
        isActive: false,
        itemCount: 0,
      };
    },
    async listStockOpnames() {
      return {
        data: [
          {
            opnameId: "OPN-1",
            opnameNo: "OPN/2026/05/0001",
            stockCardId: "SC-1",
            carId: "CAR-1",
            unitName: "MB 500 SEL",
            itemName: "Chrome clip",
            partCode: "CC-01",
            uom: "pcs",
            storageLocationId: 11,
            locationLabel: "A-01",
            expectedQty: 10,
            actualQty: 8,
            varianceQty: -2,
            findingStatus: "SHORT" as const,
            itemCondition: "GOOD" as const,
            countedAt: "2026-05-18",
            countedByName: "Asep Gudang",
            notes: "Kurang dua pcs",
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
          itemCategories: [],
          itemStatuses: [],
          approvalStatuses: [],
          transactionTypes: [],
        },
        query: {
          ...createWarehouseQuery({
            sortBy: "countedAt",
            sortDirection: "desc" as const,
          }),
        },
      };
    },
    async createStockOpname() {
      return {
        opnameId: "OPN-NEW",
        opnameNo: "OPN/2026/05/0002",
        findingStatus: "SHORT" as const,
        varianceQty: -1,
      };
    },
    async listStockAdjustments() {
      return {
        data: [
          {
            adjustmentId: "ADJ-1",
            adjustmentNo: "ADJ/2026/05/0001",
            opnameId: "OPN-1",
            stockCardId: "SC-1",
            carId: "CAR-1",
            unitName: "MB 500 SEL",
            itemName: "Chrome clip",
            partCode: "CC-01",
            uom: "pcs",
            qtyBefore: 10,
            qtyAfter: 8,
            adjustmentQty: -2,
            adjustmentReason: "OPNAME_CORRECTION" as const,
            itemCondition: "GOOD" as const,
            createdAt: "2026-05-18",
            createdByName: "Asep Gudang",
            notes: "Selisih opname",
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
          itemCategories: [],
          itemStatuses: [],
          approvalStatuses: [],
          transactionTypes: [],
        },
        query: {
          ...createWarehouseQuery({
            sortBy: "createdAt",
            sortDirection: "desc" as const,
          }),
        },
      };
    },
    async createStockAdjustment() {
      return {
        adjustmentId: "ADJ-NEW",
        adjustmentNo: "ADJ/2026/05/0002",
        adjustmentQty: -2,
        adjustmentReason: "OPNAME_CORRECTION" as const,
      };
    },
  };
}

describe("warehouse routes", () => {
  test("lists transactions and creates a request", async () => {
    const fetchHandler = createApiFetchHandler({
      authService: createStubAuthService(sampleSession),
      warehouseService: createStubWarehouseService(),
    });

    const listResponse = await fetchHandler(
      new Request("http://localhost/api/warehouse/transactions", {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=session:warehouse-route-1`,
        },
      }),
    );
    expect(listResponse.status).toBe(200);
    const listBody = await listResponse.json();
    expect(listBody.data[0].transactionId).toBe("WH-1");

    const createResponse = await fetchHandler(
      new Request("http://localhost/api/warehouse/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: `${SESSION_COOKIE_NAME}=session:warehouse-route-1`,
        },
        body: JSON.stringify({
          carId: "CAR-1",
          itemCategory: "SPARE_PART",
          transactionType: "PENGAMBILAN",
          itemMasterId: null,
          itemAliasUsed: null,
          itemName: "Chrome clip",
          qty: 2,
          uom: "pcs",
          targetSearchDate: null,
          deadlineDate: "2026-05-17",
          notes: null,
        }),
      }),
    );
    expect(createResponse.status).toBe(200);
    const createBody = await createResponse.json();
    expect(createBody.data.transactionId).toBe("WH-NEW");
  });

  test("reads dashboard and store/location/photo routes", async () => {
    const fetchHandler = createApiFetchHandler({
      authService: createStubAuthService(sampleSession),
      warehouseService: createStubWarehouseService(),
    });

    const dashboardResponse = await fetchHandler(
      new Request("http://localhost/api/warehouse/dashboard", {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=session:warehouse-route-1`,
        },
      }),
    );
    expect(dashboardResponse.status).toBe(200);
    const dashboardBody = await dashboardResponse.json();
    expect(dashboardBody.data.summary.pendingApproval).toBe(1);

    const storeResponse = await fetchHandler(
      new Request("http://localhost/api/warehouse/store", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: `${SESSION_COOKIE_NAME}=session:warehouse-route-1`,
        },
        body: JSON.stringify({
          transactionId: "WH-1",
          storageLocationId: 11,
          locationDetail: "Rak A",
          notes: "Sudah tersimpan",
        }),
      }),
    );
    expect(storeResponse.status).toBe(200);
    const storeBody = await storeResponse.json();
    expect(storeBody.data.itemStatus).toBe("STORED");

    const uploadTicketResponse = await fetchHandler(
      new Request("http://localhost/api/warehouse/stock-card/upload-ticket?stockCardId=SC-1&filename=foto.jpg&contentType=image%2Fjpeg", {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=session:warehouse-route-1`,
        },
      }),
    );
    expect(uploadTicketResponse.status).toBe(200);

    const photoResponse = await fetchHandler(
      new Request("http://localhost/api/warehouse/stock-card/photos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: `${SESSION_COOKIE_NAME}=session:warehouse-route-1`,
        },
        body: JSON.stringify({
          stockCardId: "SC-1",
          photoUrls: ["https://cdn.example.com/object.jpg"],
        }),
      }),
    );
    expect(photoResponse.status).toBe(200);

    const createLocationResponse = await fetchHandler(
      new Request("http://localhost/api/warehouse/storage-locations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: `${SESSION_COOKIE_NAME}=session:warehouse-route-1`,
        },
        body: JSON.stringify({
          locationType: "GUDANG",
          zone: "B",
          rack: "02",
          shelf: "03",
          label: "B-02-03",
          isActive: true,
        }),
      }),
    );
    expect(createLocationResponse.status).toBe(200);
  });

  test("reads donor transfer references for warehouse request form", async () => {
    const fetchHandler = createApiFetchHandler({
      authService: createStubAuthService(sampleSession),
      warehouseService: createStubWarehouseService(),
    });

    const response = await fetchHandler(
      new Request(
        "http://localhost/api/warehouse/request-references?date=2026-05-20&coreId=CORE-1&transactionType=TRANSFER_PART",
        {
          headers: {
            cookie: `${SESSION_COOKIE_NAME}=session:warehouse-route-1`,
          },
        },
      ),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.stockCards.length).toBe(1);
    expect(body.data.stockCards[0].stockCardId).toBe("SC-DONOR-1");
    expect(body.data.stockCards[0].unitName).toBe("W123 DONOR");
  });

  test("approves, issues, and returns a transaction", async () => {
    const fetchHandler = createApiFetchHandler({
      authService: createStubAuthService(sampleSession),
      warehouseService: createStubWarehouseService(),
    });

    const approveResponse = await fetchHandler(
      new Request("http://localhost/api/warehouse/approve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: `${SESSION_COOKIE_NAME}=session:warehouse-route-1`,
        },
        body: JSON.stringify({
          transactionId: "WH-1",
          notes: "Setuju",
        }),
      }),
    );
    expect(approveResponse.status).toBe(200);

    const issueResponse = await fetchHandler(
      new Request("http://localhost/api/warehouse/ready", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: `${SESSION_COOKIE_NAME}=session:warehouse-route-1`,
        },
        body: JSON.stringify({
          transactionId: "WH-1",
          notes: "Siap",
        }),
      }),
    );
    expect(issueResponse.status).toBe(200);
    const readyBody = await issueResponse.json();
    expect(readyBody.data.itemStatus).toBe("READY");

    const releaseResponse = await fetchHandler(
      new Request("http://localhost/api/warehouse/issue", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: `${SESSION_COOKIE_NAME}=session:warehouse-route-1`,
        },
        body: JSON.stringify({
          transactionId: "WH-1",
          notes: "Ambil",
          actualReleaseDate: null,
        }),
      }),
    );
    expect(releaseResponse.status).toBe(200);
    const issueBody = await releaseResponse.json();
    expect(issueBody.data.itemStatus).toBe("RELEASED");

    const returnResponse = await fetchHandler(
      new Request("http://localhost/api/warehouse/return", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: `${SESSION_COOKIE_NAME}=session:warehouse-route-1`,
        },
        body: JSON.stringify({
          transactionId: "WH-1",
          notes: "Kembali",
          actualReturnDate: null,
          qtyReturned: 2,
          itemCondition: "GOOD",
        }),
      }),
    );
    expect(returnResponse.status).toBe(200);
    const returnBody = await returnResponse.json();
    expect(returnBody.data.transactionType).toBe("PENGEMBALIAN");
  });

  test("lists and creates stock opname", async () => {
    const fetchHandler = createApiFetchHandler({
      authService: createStubAuthService(sampleSession),
      warehouseService: createStubWarehouseService(),
    });

    const listResponse = await fetchHandler(
      new Request("http://localhost/api/warehouse/opname", {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=session:warehouse-route-1`,
        },
      }),
    );
    expect(listResponse.status).toBe(200);
    const listBody = await listResponse.json();
    expect(listBody.data[0].opnameId).toBe("OPN-1");

    const createResponse = await fetchHandler(
      new Request("http://localhost/api/warehouse/opname", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: `${SESSION_COOKIE_NAME}=session:warehouse-route-1`,
        },
        body: JSON.stringify({
          stockCardId: "SC-1",
          carId: "CAR-1",
          itemName: "Bumper clip",
          partCode: "BC-01",
          uom: "pcs",
          storageLocationId: 12,
          expectedQty: 12,
          actualQty: 11,
          itemCondition: "GOOD",
          countedAt: "2026-05-20",
          notes: "Kurang satu",
        }),
      }),
    );
    expect(createResponse.status).toBe(200);
    const createBody = await createResponse.json();
    expect(createBody.data.opnameId).toBe("OPN-NEW");
  });

  test("lists and creates stock adjustments", async () => {
    const fetchHandler = createApiFetchHandler({
      authService: createStubAuthService(sampleSession),
      warehouseService: createStubWarehouseService(),
    });

    const listResponse = await fetchHandler(
      new Request("http://localhost/api/warehouse/adjustments", {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=session:warehouse-route-1`,
        },
      }),
    );
    expect(listResponse.status).toBe(200);
    const listBody = await listResponse.json();
    expect(listBody.data[0].adjustmentId).toBe("ADJ-1");

    const createResponse = await fetchHandler(
      new Request("http://localhost/api/warehouse/adjustments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: `${SESSION_COOKIE_NAME}=session:warehouse-route-1`,
        },
        body: JSON.stringify({
          opnameId: "OPN-1",
          stockCardId: "SC-1",
          carId: "CAR-1",
          itemName: "Bumper clip",
          partCode: "BC-01",
          uom: "pcs",
          qtyBefore: 12,
          qtyAfter: 10,
          adjustmentReason: "OPNAME_CORRECTION",
          itemCondition: "GOOD",
          notes: "Selisih opname",
        }),
      }),
    );
    expect(createResponse.status).toBe(200);
    const createBody = await createResponse.json();
    expect(createBody.data.adjustmentId).toBe("ADJ-NEW");
  });
});
