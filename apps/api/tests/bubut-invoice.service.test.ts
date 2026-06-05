import type { AuthUser } from "@smsystem/contracts/auth";
import type {
  BubutInvoiceSnapshot,
} from "@smsystem/contracts/bubut-invoice";
import { describe, expect, test } from "bun:test";
import type { BubutInvoiceRepository, BubutInvoiceSource } from "@/repositories/bubut-invoice.repo";
import { handleBubutInvoiceWorkHistoryRoute } from "@/routes/bubut-invoice.routes";
import type { AuthService } from "@/services/auth/auth.service";
import { DefaultBubutInvoiceService } from "@/services/bubut-invoice.service";
import type { AuditService } from "@/services/audit/audit.service";
import type { WebSession } from "@/services/auth/session.service";
import {
  buildBubutInvoiceTotals,
  calculateWorkingHourTotal,
  ceilToStep,
  minutesToHourText,
} from "@/services/bubut-invoice/calculation";

const user: AuthUser = {
  employeeId: "SM-03.004",
  fullName: "Sahrul Riswanto",
  email: null,
  roleId: 20,
  roleName: "mis",
  divisionId: 3,
  divisionName: "MIS",
  grade: "MIS",
  permissions: ["bubut_invoice.view", "bubut_invoice.release"],
  scope: {
    canViewAllUnits: true,
    canViewAssignedUnits: false,
    divisionIds: [],
    managedDivisionIds: [],
    unitIds: [],
  },
};

const session: WebSession = {
  sessionId: "bubut-invoice-session",
  sessionKey: "session:bubut-invoice",
  employeeId: user.employeeId,
  refreshToken: "refresh",
  mobileSessionKey: "session:SM-03.004",
  deviceId: "web",
  user,
  createdAt: "2026-05-29T00:00:00.000Z",
};

const source: BubutInvoiceSource = {
  sourceWoId: "WO-1",
  sourceWobNo: "WO/001/05/2026",
  woDate: "2026-05-20",
  carId: "MB500SEL_MRSILMY",
  carType: "MB 500 SEL",
  headProjectName: "TETEN",
  sparepartName: "BUBUT DISCBRAKE",
  qty: 2,
  qtyUnit: "pcs",
  operatorName: "SUMARYATNO",
  divisionName: "BUBUT",
  processDetailText: "Bubut discbrake",
};

class InMemoryBubutInvoiceRepository implements BubutInvoiceRepository {
  active = false;
  source: BubutInvoiceSource | null = source;
  materialRows: Awaited<ReturnType<BubutInvoiceRepository["findWarehouseMaterialsByWo"]>> = [
    {
      materialName: "PLAT BESI",
      qty: 16.5,
      unit: "cm",
      price: 9000,
      total: 148500,
      warehouseTransactionId: "TRX-1",
      stockCardId: "STOCK-1",
    },
  ];
  pictureRows: Awaited<ReturnType<BubutInvoiceRepository["findPicturesByWo"]>> = [];
  inserted: BubutInvoiceSnapshot[] = [];

  async findCompletedBubutWorkOrders() {
    return {
      rows: [],
      total: 0,
    };
  }

  async findWorkOrderSource() {
    return this.source;
  }

  async findActualWorkingHoursByWo() {
    return [
      {
        actualId: "ACT-1",
        workDate: "2026-05-22",
        start: "08:00",
        finish: "15:00",
        breakHours: 1.5,
        workingHourDecimal: 5.5,
        employeeName: "SUMARYATNO",
      },
    ];
  }

  async findWarehouseMaterialsByWo() {
    return this.materialRows;
  }

  async findPicturesByWo() {
    return this.pictureRows;
  }

  async findWorkHistoryRowsByWo() {
    return [
      {
        id: "CD-1",
        actualId: "ACT-1",
        countdownId: "CORE-1",
        workDate: "2026-05-22",
        startTime: "08:00",
        finishTime: "15:00",
        breakHours: 1.5,
        workingHourDecimal: 5.5,
        resultStatus: "DONE",
        operatorName: "SUMARYATNO",
        panelPartName: "BUBUT DISCBRAKE",
        jobdesc: "Bubut discbrake",
        processDetail: "Finishing discbrake",
        documentationUrls: [],
      },
    ];
  }

  async findActiveInvoiceIdsBySourceWoId() {
    return {
      direksiInvoiceId: null,
      customerInvoiceId: this.active ? 10 : null,
    };
  }

  async findActiveInvoiceBySource() {
    return this.active ? { id: 1 } : null;
  }

  async insertInvoice(snapshot: BubutInvoiceSnapshot) {
    this.active = true;
    this.inserted.push(snapshot);
    return {
      invoiceId: 10,
      invoiceNo: snapshot.invoiceNo ?? "SIB/01/05/2026",
    };
  }

  async findInvoiceById() {
    return null;
  }

  async cancelInvoice() {
    return false;
  }

  async getNextInvoiceSequence() {
    return 1;
  }

  async markPrinted() {}
  
  async updateInvoice() {
    return true;
  }
}

const silentAudit: AuditService = {
  async log() {},
};

function createStubAuthService(currentSession: WebSession): AuthService {
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
      return currentSession;
    },
    async getCurrentUser() {
      return currentSession.user;
    },
    async getCurrentPermissions() {
      return currentSession.user.permissions;
    },
  };
}

describe("bubut invoice calculation", () => {
  test("calculates working hour, markup, and rounding", () => {
    expect(minutesToHourText(330)).toBe("05:30");
    expect(calculateWorkingHourTotal(5.5)).toBe(119130);
    expect(ceilToStep(399086, 1000)).toBe(400000);

    const totals = buildBubutInvoiceTotals({
      invoiceType: "CUSTOMER",
      workingHours: [
        {
          no: 1,
          date: "2026-05-22",
          start: "08:00",
          break: "01:30",
          finish: "15:00",
          workingHourText: "05:30",
          workingHourDecimal: 5.5,
          powerWatt: 7500,
          powerCostKwh: 1444,
          total: 119130,
          actualId: "ACT-1",
        },
      ],
      materials: [
        {
          no: 1,
          materialName: "PLAT BESI",
          qty: 16.5,
          unit: "cm",
          price: 9000,
          total: 148500,
        },
      ],
      roundingStep: 1000,
    });

    expect(totals.totalPriceBubut).toBe(267630);
    expect(totals.priceAfterMarkup).toBe(896561);
    expect(totals.priceRounding).toBe(897000);
  });

  test("does not calculate customer fields for direksi invoice", () => {
    const totals = buildBubutInvoiceTotals({
      invoiceType: "DIREKSI",
      workingHours: [],
      materials: [],
      roundingStep: 1000,
    });

    expect(totals.priceAfterMarkup).toBe(null);
    expect(totals.priceRounding).toBe(null);
  });
});

describe("DefaultBubutInvoiceService", () => {
  test("returns work history header, rows, empty docs, and totals", async () => {
    const repository = new InMemoryBubutInvoiceRepository();
    const service = new DefaultBubutInvoiceService(repository, silentAudit);

    const result = await service.getWorkHistory(session, "WO-1");

    expect(result.header.wobNo).toBe("WO/001/05/2026");
    expect(result.workRows[0]?.documentationUrls).toEqual([]);
    expect(result.workRows[0]?.workingHourText).toBe("05:30");
    expect(result.totals.totalWorkingHourCost).toBe(calculateWorkingHourTotal(5.5));
    expect(result.totals.totalMaterial).toBe(148500);
    expect(result.totals.totalBasePrice).toBe(267630);
  });

  test("keeps materialRows empty when no warehouse usage exists", async () => {
    const repository = new InMemoryBubutInvoiceRepository();
    repository.materialRows = [];
    const service = new DefaultBubutInvoiceService(repository, silentAudit);

    const result = await service.getWorkHistory(session, "WO-1");

    expect(result.materialRows).toEqual([]);
    expect(result.totals.totalMaterial).toBe(0);
    expect(result.totals.totalBasePrice).toBe(calculateWorkingHourTotal(5.5));
  });

  test("throws not found for invalid sourceKey", async () => {
    const repository = new InMemoryBubutInvoiceRepository();
    repository.source = null;
    const service = new DefaultBubutInvoiceService(repository, silentAudit);

    let errorMessage = "";
    try {
      await service.getWorkHistory(session, "INVALID");
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
    }

    expect(errorMessage).toBe("BUBUT_WO_NOT_FOUND");
  });

  test("prevents double release for same WO and invoice type", async () => {
    const repository = new InMemoryBubutInvoiceRepository();
    const service = new DefaultBubutInvoiceService(repository, silentAudit);

    const result = await service.releaseInvoice(session, {
      sourceWoId: "WO-1",
      invoiceType: "CUSTOMER",
      salesInvoiceDate: "2026-05-29",
      poNo: null,
      poDate: null,
      roundingStep: 1000,
      notes: null,
      beforePictureUrls: [],
      afterPictureUrls: [],
    });

    expect(result.invoiceId).toBe(10);
    expect(repository.inserted.length).toBe(1);

    let errorMessage = "";
    try {
      await service.releaseInvoice(session, {
        sourceWoId: "WO-1",
        invoiceType: "CUSTOMER",
        salesInvoiceDate: "2026-05-29",
        poNo: null,
        poDate: null,
        roundingStep: 1000,
        notes: null,
        beforePictureUrls: [],
        afterPictureUrls: [],
      });
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
    }

    expect(errorMessage).toBe("BUBUT_INVOICE_ALREADY_RELEASED");
  });

  test("stores selected before and after pictures in released invoice snapshot", async () => {
    const repository = new InMemoryBubutInvoiceRepository();
    repository.pictureRows = [
      { url: "https://cdn.local/before.jpg", caption: null, source: "GALLERY" },
      { url: "https://cdn.local/after.jpg", caption: null, source: "LEDGER" },
      { url: "https://cdn.local/other.jpg", caption: null, source: "LEDGER" },
    ];
    const service = new DefaultBubutInvoiceService(repository, silentAudit);

    await service.releaseInvoice(session, {
      sourceWoId: "WO-1",
      invoiceType: "CUSTOMER",
      salesInvoiceDate: "2026-05-29",
      poNo: null,
      poDate: null,
      roundingStep: 1000,
      notes: null,
      beforePictureUrls: ["https://cdn.local/before.jpg"],
      afterPictureUrls: ["https://cdn.local/after.jpg"],
    });

    expect(repository.inserted[0]?.pictures).toEqual([
      { url: "https://cdn.local/before.jpg", caption: "BEFORE", source: "GALLERY" },
      { url: "https://cdn.local/after.jpg", caption: "AFTER", source: "LEDGER" },
    ]);
  });
});

describe("bubut invoice work-history route", () => {
  test("returns 403 without view permission", async () => {
    const noPermissionSession: WebSession = {
      ...session,
      user: {
        ...session.user,
        permissions: [],
      },
    };

    const response = await handleBubutInvoiceWorkHistoryRoute(
      new Request("http://localhost/api/wo-bubut-invoice/WO-1/work-history"),
      "WO-1",
      createStubAuthService(noPermissionSession),
      new DefaultBubutInvoiceService(new InMemoryBubutInvoiceRepository(), silentAudit),
    );

    expect(response.status).toBe(403);
  });

  test("maps invalid sourceKey to 404", async () => {
    const repository = new InMemoryBubutInvoiceRepository();
    repository.source = null;

    const response = await handleBubutInvoiceWorkHistoryRoute(
      new Request("http://localhost/api/wo-bubut-invoice/INVALID/work-history"),
      "INVALID",
      createStubAuthService(session),
      new DefaultBubutInvoiceService(repository, silentAudit),
    );

    expect(response.status).toBe(404);
  });
});
