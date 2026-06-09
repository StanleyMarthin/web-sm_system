import type { AuthUser } from "@smsystem/contracts/auth";
import type {
  CreateWarehouseStockAdjustment,
  CreateWarehouseStockOpname,
  CreateWarehouseRequest,
  WarehouseApprovalStatus,
  WarehouseStockAdjustmentRecord,
  WarehouseStockOpnameRecord,
  WarehouseTransactionQuery,
  WarehouseTransactionRecord,
} from "@smsystem/contracts/warehouse";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { AuditService } from "@/services/audit/audit.service";
import { DefaultWarehouseService } from "@/services/warehouse.service";
import type { WarehouseRepository } from "@/repositories/warehouse.repo";
import type { WebSession } from "@/services/auth/session.service";

type TestStockCardRow = Awaited<ReturnType<WarehouseRepository["listStockCard"]>>["rows"][number];
type TestStorageLocationRow = Awaited<
  ReturnType<WarehouseRepository["listStorageLocations"]>
>["rows"][number];
type TestTransferStockCardRow = Awaited<
  ReturnType<WarehouseRepository["listTransferStockCards"]>
>[number];

function createWarehouseService(repository: WarehouseRepository) {
  return new DefaultWarehouseService(
    repository,
    { async log() {} } satisfies AuditService,
    {
      async createTicket() {
        return {
          uploadUrl: "https://upload.example.com/object",
          publicUrl: "https://cdn.example.com/object.jpg",
          objectKey: "warehouse/object.jpg",
        };
      },
    },
  );
}

const warehouseUser: AuthUser = {
  employeeId: "SM-11.003",
  fullName: "Asep Gudang",
  email: null,
  roleId: 33,
  roleName: "warehouse",
  divisionId: 8,
  divisionName: "INTERIOR",
  grade: "KD",
  permissions: [
    "WAREHOUSE_VIEW",
    "WAREHOUSE_REQUEST",
    "WAREHOUSE_APPROVE",
    "WAREHOUSE_READY",
    "WAREHOUSE_ISSUE",
    "WAREHOUSE_RETURN",
    "WAREHOUSE_STOCK_CARD_MANAGE",
    "WAREHOUSE_LOCATION_MANAGE",
  ],
  scope: {
    canViewAllUnits: false,
    canViewAssignedUnits: true,
    divisionIds: [8],
    managedDivisionIds: [8],
    unitIds: ["CAR-1"],
  },
};

const warehouseSession: WebSession = {
  sessionId: "warehouse-session-1",
  sessionKey: "session:warehouse-1",
  employeeId: warehouseUser.employeeId,
  refreshToken: "refresh-1",
  mobileSessionKey: "session:SM-11.003",
  deviceId: "web-device-1",
  user: warehouseUser,
  createdAt: "2026-05-15T00:00:00.000Z",
};

function createTransaction(
  overrides: Partial<WarehouseTransactionRecord> = {},
): WarehouseTransactionRecord {
  return {
    transactionId: "WH-1",
    transactionType: "PENGAMBILAN",
    itemCategory: "SPARE_PART",
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
    itemStatus: "OPEN",
    approvalStatus: "PENDING_KD",
    itemCondition: null,
    notes: null,
    picWarehouseName: null,
    accKdName: null,
    photoCount: 0,
    daysOverdue: null,
    isOverdue: false,
    ...overrides,
  };
}

class InMemoryWarehouseRepository implements WarehouseRepository {
  transaction = createTransaction();
  storageLocations: TestStorageLocationRow[] = [
    {
      storageLocationId: 11,
      locationType: "GUDANG" as const,
      zone: "A",
      rack: "01",
      shelf: "01",
      label: "A-01-01",
      isActive: true,
      itemCount: 1,
    },
  ];
  stockCardPhotos = ["https://cdn.example.com/warehouse/sc-1.jpg"];
  opnameRows: WarehouseStockOpnameRecord[] = [
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
      findingStatus: "SHORT",
      itemCondition: "GOOD",
      countedAt: "2026-05-18",
      countedByName: "Asep Gudang",
      notes: "Kurang dua pcs",
    },
  ];
  adjustmentRows: WarehouseStockAdjustmentRecord[] = [
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
      adjustmentReason: "OPNAME_CORRECTION",
      itemCondition: "GOOD",
      createdAt: "2026-05-18",
      createdByName: "Asep Gudang",
      notes: "Selisih opname",
    },
  ];

  async getDashboard() {
    return {
      summary: {
        pendingApproval: 1,
        notPrepared: 1,
        notPickedUp: 0,
        inUse: 0,
        overdueNotReturned: 0,
      },
      lateUsers: [],
      divisionsUsing: [],
      materialsOut: [],
      lowStockAlerts: [],
    };
  }

  async listTransactions() {
    return {
      rows: [this.transaction],
      total: 1,
      summary: {
        pendingApproval: this.transaction.approvalStatus === "APPROVED" ? 0 : 1,
        readyCount: this.transaction.itemStatus === "READY" ? 1 : 0,
        releasedCount: this.transaction.itemStatus === "RELEASED" ? 1 : 0,
        overdueCount: 0,
        storedCount: this.transaction.itemStatus === "STORED" ? 1 : 0,
      },
    };
  }

  async listTransactionReferences() {
    return {
      units: [{ value: "CAR-1", label: "MB 500 SEL" }],
      divisions: [{ value: "8", label: "INTERIOR" }],
      itemCategories: [{ value: "SPARE_PART", label: "SPARE_PART" }],
      itemStatuses: [{ value: "OPEN", label: "OPEN" }],
      approvalStatuses: [{ value: "PENDING_KD", label: "PENDING_KD" }],
      transactionTypes: [{ value: "PENGAMBILAN", label: "PENGAMBILAN" }],
    };
  }

  async listPendingApproval() {
    return [this.transaction];
  }

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
  }

  async findRequestJobByCoreId() {
    return {
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
    };
  }

  async listRequestEmployees() {
    return [
      { value: "SM-11.003", label: "Asep Gudang · SM-11.003" },
      { value: "SM-08.001", label: "Budi Body · SM-08.001" },
    ];
  }

  async findRequestEmployeeById(employeeId: string) {
    if (employeeId === "SM-08.001") {
      return {
        employeeId,
        fullName: "Budi Body",
        divisionId: 9,
        divisionName: "BODY",
      };
    }

    if (employeeId === "SM-11.003") {
      return {
        employeeId,
        fullName: "Asep Gudang",
        divisionId: 8,
        divisionName: "INTERIOR",
      };
    }

    return null;
  }

  async canUseStockCardForCore() {
    return true;
  }

  async listRequestStockCards() {
    return [];
  }

  async listTransferStockCards(
    _: Parameters<WarehouseRepository["listTransferStockCards"]>[0],
  ) {
    const rows: TestTransferStockCardRow[] = [
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
        status: "IN_STORAGE",
        isLabeled: true,
        itemCategory: "SPARE_PART",
        photoUrls: [],
        itemMasterId: "ITEM-ECU-1",
      },
    ];
    return rows;
  }

  async findTransferStockCardById(
    input: Parameters<WarehouseRepository["findTransferStockCardById"]>[0],
  ) {
    const rows = await this.listTransferStockCards({
      employeeId: input.employeeId,
      scope: input.scope,
      destinationCarId: input.destinationCarId,
      search: "",
    });
    const stockCardId = input.stockCardId;
    return rows.find((row) => row.stockCardId === stockCardId) ?? null;
  }

  async listStockCard() {
    const rows: TestStockCardRow[] = [
      {
        stockCardId: "SC-1",
        entryNo: "SC/2026/05/0001",
        carId: "CAR-1",
        unitName: "MB 500 SEL",
        partCode: "CC-01",
        panelSection: "Interior",
        partName: "Chrome clip",
        conditionType: "BARU",
        qty: 2,
        uom: "pcs",
        storageLocationId: 11,
        locationLabel: "A-01-01",
        locationDetail: null,
        dateIn: "2026-05-20",
        dateOut: null,
        takenByName: null,
        status: "IN_STORAGE",
        isLabeled: true,
        itemCategory: "SPARE_PART",
        photoUrls: this.stockCardPhotos,
      },
    ];
    return {
      rows,
      total: 1,
    };
  }

  async findStockCardById(
    input: Parameters<WarehouseRepository["findStockCardById"]>[0],
  ) {
    const result = await this.listStockCard();
    return result.rows.find((row) => row.stockCardId === input.stockCardId) ?? null;
  }

  async listItems() {
    return {
      rows: [],
      total: 0,
    };
  }

  async listMaterialUsage() {
    return {
      rows: [],
      total: 0,
    };
  }

  async listStorageLocations() {
    return {
      rows: this.storageLocations,
      total: this.storageLocations.length,
    };
  }

  async listStockOpnames() {
    return {
      rows: this.opnameRows,
      total: this.opnameRows.length,
    };
  }

  async listStockAdjustments() {
    return {
      rows: this.adjustmentRows,
      total: this.adjustmentRows.length,
    };
  }

  async findTransactionById(params: { transactionId: string }) {
    if (params.transactionId !== this.transaction.transactionId) {
      return null;
    }

    return this.transaction;
  }

  async findDivisionNameById(divisionId: number) {
    if (divisionId === 8) {
      return "INTERIOR";
    }
    if (divisionId === 9) {
      return "BODY";
    }
    return null;
  }

  async canAccessCar() {
    return true;
  }

  async createRequest(
    context: {
      actorId: string;
      actorName: string;
      requesterEmployeeId: string;
      requesterName?: string;
      divisionId: number;
      divisionName: string;
      sourceCarId?: string | null;
      sourceUnitName?: string | null;
    },
    input: CreateWarehouseRequest,
  ) {
    this.transaction = createTransaction({
      transactionId: "WH-NEW",
      transactionType: input.transactionType,
      itemCategory: input.itemCategory,
      itemName: input.itemName,
      carId: input.carId,
      unitName: input.unitName ?? "MB 500 SEL",
      employeeId: context.requesterEmployeeId,
      requesterName: context.requesterName ?? context.actorName,
      divisionId: context.divisionId,
      divisionName: context.divisionName,
      stockCardId: input.stockCardId,
      sourceCarId: context.sourceCarId ?? null,
      sourceUnitName: context.sourceUnitName ?? null,
      qty: input.qty,
      uom: input.uom,
      approvalStatus:
        input.itemCategory === "TOOLS" ? "APPROVED" : "PENDING_KD",
      deadlineDate: input.deadlineDate,
    });

    return {
      transactionId: this.transaction.transactionId,
      approvalStatus: this.transaction.approvalStatus,
      itemStatus: this.transaction.itemStatus,
      transactionType: this.transaction.transactionType,
    };
  }

  async updateApprovalStatus(
    transactionId: string,
    approvalStatus: WarehouseApprovalStatus,
  ) {
    if (transactionId !== this.transaction.transactionId) {
      throw new Error("WAREHOUSE_TRANSACTION_NOT_FOUND");
    }

    this.transaction = { ...this.transaction, approvalStatus };
    return {
      transactionId,
      approvalStatus,
      itemStatus: this.transaction.itemStatus,
      transactionType: this.transaction.transactionType,
    };
  }

  async reject(transactionId: string) {
    if (transactionId !== this.transaction.transactionId) {
      throw new Error("WAREHOUSE_TRANSACTION_NOT_FOUND");
    }

    this.transaction = { ...this.transaction, approvalStatus: "REJECTED" };
    return {
      transactionId,
      approvalStatus: "REJECTED" as const,
      itemStatus: this.transaction.itemStatus,
      transactionType: this.transaction.transactionType,
    };
  }

  async issue(transactionId: string) {
    if (transactionId !== this.transaction.transactionId) {
      throw new Error("WAREHOUSE_TRANSACTION_NOT_FOUND");
    }

    this.transaction = { ...this.transaction, itemStatus: "RELEASED" };
    return {
      transactionId,
      approvalStatus: this.transaction.approvalStatus,
      itemStatus: "RELEASED" as const,
      transactionType: this.transaction.transactionType,
    };
  }

  async markReady(transactionId: string) {
    if (transactionId !== this.transaction.transactionId) {
      throw new Error("WAREHOUSE_TRANSACTION_NOT_FOUND");
    }

    this.transaction = { ...this.transaction, itemStatus: "READY" };
    return {
      transactionId,
      approvalStatus: this.transaction.approvalStatus,
      itemStatus: "READY" as const,
      transactionType: this.transaction.transactionType,
    };
  }

  async markReturned(
    transactionId: string,
    input: { itemCondition: WarehouseTransactionRecord["itemCondition"]; qtyReturned: number | null },
  ) {
    if (transactionId !== this.transaction.transactionId) {
      throw new Error("WAREHOUSE_TRANSACTION_NOT_FOUND");
    }

    this.transaction = {
      ...this.transaction,
      transactionType: "PENGEMBALIAN",
      itemStatus: "RETURNED",
      itemCondition: input.itemCondition,
      qtyReturned: input.qtyReturned,
    };
    return {
      transactionId,
      approvalStatus: this.transaction.approvalStatus,
      itemStatus: "RETURNED" as const,
      transactionType: "PENGEMBALIAN" as const,
    };
  }

  async markStored(
    transactionId: string,
    input: { storageLocationId: number | null; locationDetail: string | null },
  ) {
    if (transactionId !== this.transaction.transactionId) {
      throw new Error("WAREHOUSE_TRANSACTION_NOT_FOUND");
    }

    const location =
      input.storageLocationId === null
        ? null
        : this.storageLocations.find((row) => row.storageLocationId === input.storageLocationId) ?? null;

    this.transaction = {
      ...this.transaction,
      itemStatus: "STORED",
      storageLocationId: input.storageLocationId,
      locationLabel: location?.label ?? null,
      locationDetail: input.locationDetail,
    };

    return {
      transactionId,
      approvalStatus: this.transaction.approvalStatus,
      itemStatus: "STORED" as const,
      transactionType: this.transaction.transactionType,
    };
  }

  async createStorageLocation(input: {
    locationType: "GUDANG" | "WORKSHOP" | "UNIT";
    zone: string | null;
    rack: string | null;
    shelf: string | null;
    label: string | null;
    isActive: boolean;
  }) {
    const row: TestStorageLocationRow = {
      storageLocationId: 12,
      locationType: input.locationType,
      zone: input.zone,
      rack: input.rack,
      shelf: input.shelf,
      label: input.label ?? "B-01-01",
      isActive: input.isActive,
      itemCount: 0,
    };
    this.storageLocations = [...this.storageLocations, row];
    return row;
  }

  async updateStorageLocation(input: {
    storageLocationId: number;
    locationType: "GUDANG" | "WORKSHOP" | "UNIT";
    zone: string | null;
    rack: string | null;
    shelf: string | null;
    label: string | null;
    isActive: boolean;
  }) {
    this.storageLocations = this.storageLocations.map((row) =>
      row.storageLocationId === input.storageLocationId
        ? {
            ...row,
            locationType: input.locationType,
            zone: input.zone,
            rack: input.rack,
            shelf: input.shelf,
            label: input.label ?? row.label,
            isActive: input.isActive,
          }
        : row,
    );
    return this.storageLocations.find((row) => row.storageLocationId === input.storageLocationId)!;
  }

  async deactivateStorageLocation(storageLocationId: number) {
    this.storageLocations = this.storageLocations.map((row) =>
      row.storageLocationId === storageLocationId
        ? { ...row, isActive: false }
        : row,
    );
    return this.storageLocations.find((row) => row.storageLocationId === storageLocationId)!;
  }

  async updateStockCardPhotos(stockCardId: string, photoUrls: string[]) {
    if (stockCardId !== "SC-1") {
      throw new Error("WAREHOUSE_STOCK_CARD_NOT_FOUND");
    }
    this.stockCardPhotos = photoUrls;
    return {
      stockCardId,
      photoUrls,
    };
  }

  async createStockOpname(
    context: {
      actorId: string;
      actorName: string;
      divisionId: number;
      divisionName: string;
    },
    input: CreateWarehouseStockOpname,
  ) {
    const varianceQty = input.actualQty - input.expectedQty;
    const findingStatus =
      varianceQty === 0 ? "MATCH" : varianceQty > 0 ? "OVER" : "SHORT";

    const row: WarehouseStockOpnameRecord = {
      opnameId: "OPN-NEW",
      opnameNo: "OPN/2026/05/0002",
      stockCardId: input.stockCardId,
      carId: input.carId,
      unitName: "MB 500 SEL",
      itemName: input.itemName,
      partCode: input.partCode,
      uom: input.uom,
      storageLocationId: input.storageLocationId,
      locationLabel: "A-02",
      expectedQty: input.expectedQty,
      actualQty: input.actualQty,
      varianceQty,
      findingStatus,
      itemCondition: input.itemCondition,
      countedAt: input.countedAt ?? "2026-05-20",
      countedByName: context.actorName,
      notes: input.notes,
    };

    this.opnameRows = [row, ...this.opnameRows];

    return {
      opnameId: row.opnameId,
      opnameNo: row.opnameNo,
      findingStatus: row.findingStatus,
      varianceQty: row.varianceQty,
    };
  }

  async createStockAdjustment(
    context: {
      actorId: string;
      actorName: string;
      divisionId: number;
      divisionName: string;
    },
    input: CreateWarehouseStockAdjustment,
  ) {
    const adjustmentQty = input.qtyAfter - input.qtyBefore;
    const row: WarehouseStockAdjustmentRecord = {
      adjustmentId: "ADJ-NEW",
      adjustmentNo: "ADJ/2026/05/0002",
      opnameId: input.opnameId,
      stockCardId: input.stockCardId,
      carId: input.carId,
      unitName: "MB 500 SEL",
      itemName: input.itemName,
      partCode: input.partCode,
      uom: input.uom,
      qtyBefore: input.qtyBefore,
      qtyAfter: input.qtyAfter,
      adjustmentQty,
      adjustmentReason: input.adjustmentReason,
      itemCondition: input.itemCondition,
      createdAt: "2026-05-20",
      createdByName: context.actorName,
      notes: input.notes,
    };

    this.adjustmentRows = [row, ...this.adjustmentRows];

    return {
      adjustmentId: row.adjustmentId,
      adjustmentNo: row.adjustmentNo,
      adjustmentQty: row.adjustmentQty,
      adjustmentReason: row.adjustmentReason,
    };
  }
}

describe("DefaultWarehouseService", () => {
  beforeEach(() => {
    process.env.SM_TEST_MEMORY_UPLOAD_TICKETS = "1";
  });

  afterEach(() => {
    delete process.env.SM_TEST_MEMORY_UPLOAD_TICKETS;
  });

  test("creates tools request with direct approval stage", async () => {
    const service = createWarehouseService(new InMemoryWarehouseRepository());

    const result = await service.createRequest(warehouseSession, {
      carId: "CAR-1",
      coreId: "CORE-1",
      unitName: "MB 500 SEL",
      panelName: "Body",
      jobName: "Pasang clip",
      divisionId: 8,
      divisionName: "INTERIOR",
      requesterEmployeeId: "SM-11.003",
      stockCardId: "SC-1",
      itemCategory: "TOOLS",
      transactionType: "PEMINJAMAN",
      itemMasterId: null,
      itemAliasUsed: null,
      itemName: "Impact wrench",
      qty: 1,
      uom: "pcs",
      targetSearchDate: null,
      deadlineDate: "2026-05-17",
      notes: null,
    });

    expect(result.approvalStatus).toBe("APPROVED");
    expect(result.itemStatus).toBe("OPEN");
  });

  test("allows division override for global warehouse user", async () => {
    const repository = new InMemoryWarehouseRepository();
    repository.findRequestJobByCoreId = async () => ({
      coreId: "CORE-1",
      carId: "CAR-1",
      unitName: "MB 500 SEL",
      divisionId: 9,
      divisionName: "BODY",
      panelName: "Body",
      jobName: "Pasang clip",
      taskDate: "2026-05-20",
      targetSearchDate: "2026-05-20",
      deadlineDate: "2026-05-20",
      isOvertime: false,
    });
    const service = createWarehouseService(repository);
    const globalSession: WebSession = {
      ...warehouseSession,
      user: {
        ...warehouseSession.user,
        divisionId: 8,
        divisionName: "INTERIOR",
        scope: {
          ...warehouseSession.user.scope,
          canViewAllUnits: true,
          divisionIds: [8, 9],
          managedDivisionIds: [8, 9],
        },
      },
    };

    const result = await service.createRequest(globalSession, {
      carId: "CAR-1",
      coreId: "CORE-1",
      unitName: "MB 500 SEL",
      panelName: "Body",
      jobName: "Pasang clip",
      divisionId: 9,
      divisionName: "BODY",
      requesterEmployeeId: "SM-08.001",
      stockCardId: null,
      itemCategory: "TOOLS",
      transactionType: "PEMINJAMAN",
      itemMasterId: null,
      itemAliasUsed: null,
      itemName: "Impact wrench",
      qty: 1,
      uom: "pcs",
      targetSearchDate: null,
      deadlineDate: "2026-05-17",
      notes: null,
    });

    expect(result.approvalStatus).toBe("APPROVED");
    expect(repository.transaction.employeeId).toBe("SM-08.001");
    expect(repository.transaction.requesterName).toBe("Budi Body");
  });

  test("creates donor transfer request and keeps source unit trace", async () => {
    const repository = new InMemoryWarehouseRepository();
    const service = createWarehouseService(repository);

    const result = await service.createRequest(warehouseSession, {
      carId: "CAR-1",
      coreId: "CORE-1",
      unitName: "MB 500 SEL",
      panelName: "Electrical",
      jobName: "Pasang ECU",
      divisionId: 8,
      divisionName: "INTERIOR",
      requesterEmployeeId: "SM-11.003",
      stockCardId: "SC-DONOR-1",
      itemCategory: "SPARE_PART",
      transactionType: "TRANSFER_PART",
      itemMasterId: null,
      itemAliasUsed: null,
      itemName: "ECU Bosch",
      qty: 1,
      uom: "pcs",
      targetSearchDate: null,
      deadlineDate: "2026-05-17",
      notes: null,
    });

    expect(result.transactionType).toBe("TRANSFER_PART");
    expect(repository.transaction.stockCardId).toBe("SC-DONOR-1");
    expect(repository.transaction.sourceCarId).toBe("CAR-DONOR-1");
    expect(repository.transaction.sourceUnitName).toBe("W123 DONOR");
  });

  test("reads dashboard, stores returned item, and manages stock photo/location", async () => {
    const repository = new InMemoryWarehouseRepository();
    repository.transaction = createTransaction({
      approvalStatus: "APPROVED",
      itemStatus: "RETURNED",
      transactionType: "PENGEMBALIAN",
    });
    const service = createWarehouseService(repository);

    const dashboard = await service.getDashboard(warehouseSession);
    expect(dashboard.summary.pendingApproval).toBe(1);

    const stored = await service.storeItem(warehouseSession, {
      transactionId: "WH-1",
      storageLocationId: 11,
      locationDetail: "Rak A",
      notes: "Sudah disimpan",
    });
    expect(stored.itemStatus).toBe("STORED");

    const ticket = await service.createStockCardUploadTicket(warehouseSession, {
      stockCardId: "SC-1",
      filename: "foto.jpg",
      contentType: "image/jpeg",
    });
    expect(ticket.publicUrl).toContain("cdn.example.com");

    const photos = await service.updateStockCardPhotos(warehouseSession, {
      stockCardId: "SC-1",
      photoUrls: ["https://cdn.example.com/object.jpg"],
    });
    expect(photos.photoUrls.length).toBe(1);

    const createdLocation = await service.createStorageLocation(warehouseSession, {
      locationType: "GUDANG",
      zone: "B",
      rack: "01",
      shelf: "01",
      label: "B-01-01",
      isActive: true,
    });
    expect(createdLocation.label).toBe("B-01-01");

    const updatedLocation = await service.updateStorageLocation(warehouseSession, {
      storageLocationId: createdLocation.storageLocationId,
      locationType: "GUDANG",
      zone: "B",
      rack: "02",
      shelf: "03",
      label: "B-02-03",
      isActive: true,
    });
    expect(updatedLocation.rack).toBe("02");

    const deletedLocation = await service.deleteStorageLocation(
      warehouseSession,
      createdLocation.storageLocationId,
    );
    expect(deletedLocation.isActive).toBe(false);
  });

  test("advances approval then issues and returns an approved item", async () => {
    const repository = new InMemoryWarehouseRepository();
    repository.transaction = createTransaction({
      approvalStatus: "PENDING_KEPALA_GUDANG",
      itemCategory: "SPARE_PART",
    });
    const service = createWarehouseService(repository);

    const approved = await service.approve(warehouseSession, {
      transactionId: "WH-1",
      notes: "Lanjut PPIC",
    });
    expect(approved.approvalStatus).toBe("PENDING_PPIC");

    repository.transaction = createTransaction({
      approvalStatus: "APPROVED",
      itemStatus: "OPEN",
    });
    const ready = await service.ready(warehouseSession, {
      transactionId: "WH-1",
      notes: "Siap ambil",
    });
    expect(ready.itemStatus).toBe("READY");

    const issued = await service.issue(warehouseSession, {
      transactionId: "WH-1",
      notes: "Diambil",
      actualReleaseDate: null,
    });
    expect(issued.itemStatus).toBe("RELEASED");

    const returned = await service.returnItem(warehouseSession, {
      transactionId: "WH-1",
      notes: "Dikembalikan",
      actualReturnDate: null,
      qtyReturned: 2,
      itemCondition: "GOOD",
    });
    expect(returned.transactionType).toBe("PENGEMBALIAN");
    expect(returned.itemStatus).toBe("RETURNED");
  });

  test("lists and creates stock opname", async () => {
    const repository = new InMemoryWarehouseRepository();
    const service = createWarehouseService(repository);
    const query: WarehouseTransactionQuery = {
      page: 1,
      limit: 25,
      search: "",
      sortBy: "countedAt",
      sortDirection: "desc",
      filters: [],
      view: null,
      dateFrom: null,
      dateTo: null,
    };

    const list = await service.listStockOpnames(warehouseSession, query);
    expect(list.data[0]?.opnameId).toBe("OPN-1");

    const created = await service.createStockOpname(warehouseSession, {
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
    });

    expect(created.opnameId).toBe("OPN-NEW");
    expect(created.findingStatus).toBe("SHORT");
    expect(created.varianceQty).toBe(-1);
  });

  test("lists and creates stock adjustment", async () => {
    const repository = new InMemoryWarehouseRepository();
    const service = createWarehouseService(repository);
    const query: WarehouseTransactionQuery = {
      page: 1,
      limit: 25,
      search: "",
      sortBy: "createdAt",
      sortDirection: "desc",
      filters: [],
      view: null,
      dateFrom: null,
      dateTo: null,
    };

    const list = await service.listStockAdjustments(warehouseSession, query);
    expect(list.data[0]?.adjustmentId).toBe("ADJ-1");

    const created = await service.createStockAdjustment(warehouseSession, {
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
    });

    expect(created.adjustmentId).toBe("ADJ-NEW");
    expect(created.adjustmentQty).toBe(-2);
    expect(created.adjustmentReason).toBe("OPNAME_CORRECTION");
  });
});
