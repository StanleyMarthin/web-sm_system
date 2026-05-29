import type { AuthUser } from "@smsystem/contracts/auth";
import { describe, expect, test } from "bun:test";
import type {
  PrItemRecord,
  PrRecord,
} from "@smsystem/contracts/pr";
import { DefaultPrService } from "@/services/pr.service";
import type { AuditService } from "@/services/audit/audit.service";
import type { PrRepository } from "@/repositories/pr.repo";
import type { WebSession } from "@/services/auth/session.service";

const prUser: AuthUser = {
  employeeId: "SM-08.005",
  fullName: "Yudha Agustiana",
  email: null,
  roleId: 19,
  roleName: "kepala_produksi",
  divisionId: 12,
  divisionName: "INTERIOR",
  grade: "KP",
  permissions: ["PR_VIEW", "PR_CREATE", "PR_APPROVE", "PR_ORDER", "PR_RECEIVE"],
  scope: {
    canViewAllUnits: false,
    canViewAssignedUnits: true,
    divisionIds: [12],
    managedDivisionIds: [12],
    unitIds: [],
  },
};

const globalUser: AuthUser = {
  ...prUser,
  employeeId: "SM-03.004",
  fullName: "Sahrul Riswanto",
  roleId: 20,
  roleName: "mis",
  divisionId: 3,
  divisionName: "MANAGEMENT INFORMATION SYSTEM",
  grade: "MIS",
  permissions: ["PR_VIEW", "PR_CREATE", "PR_APPROVE", "PR_ORDER", "PR_RECEIVE", "view_all_units"],
  scope: {
    canViewAllUnits: true,
    canViewAssignedUnits: false,
    divisionIds: [3],
    managedDivisionIds: [3],
    unitIds: [],
  },
};

const prSession: WebSession = {
  sessionId: "pr-session-1",
  sessionKey: "session:pr-1",
  employeeId: prUser.employeeId,
  refreshToken: "refresh-1",
  mobileSessionKey: "session:SM-08.005",
  deviceId: "web-device-1",
  user: prUser,
  createdAt: "2026-05-15T00:00:00.000Z",
};

const globalSession: WebSession = {
  ...prSession,
  sessionId: "pr-session-global",
  sessionKey: "session:pr-global",
  employeeId: globalUser.employeeId,
  mobileSessionKey: "session:SM-03.004",
  user: globalUser,
};

function createHeader(
  stage: PrRecord["accTracking"] = "PENDING_ADV",
  status: PrRecord["status"] = "OPEN",
): PrRecord {
  return {
    prId: "PR-1",
    prNumber: "PRIN/001/05/2026",
    carId: "CAR-1",
    unitName: "MB 500 SEL",
    customerName: "Mr. Silmy",
    divisionName: "INTERIOR",
    requestedBy: "SM-08.005",
    requestedByName: "Yudha Agustiana",
    accTracking: stage,
    status,
    targetDate: null,
    priority: "NORMAL",
    notes: null,
    createdAt: "2026-05-15 09:00:00",
    updatedAt: "2026-05-15 09:00:00",
    totalItems: 1,
    totalQty: 2,
    totalEstimatedPrice: 1000000,
    totalActualPrice: 0,
    vendorSummary: "-",
    latestArrivalDate: null,
    agingDays: 0,
    riskScore: 35,
    isCritical: false,
  };
}

function createItem(status: PrItemRecord["status"] = "HUNTING"): PrItemRecord {
  return {
    itemId: "PRI-1",
    prId: "PR-1",
    itemName: "Karet seal",
    description: null,
    originType: "LOKAL",
    qty: 2,
    uom: "pcs",
    estimatedPrice: 1000000,
    actualPrice: null,
    vendorId: null,
    vendorName: null,
    photoUrl: null,
    status,
    huntingNotes: null,
    arrivalDate: null,
  };
}

class InMemoryPrRepository implements PrRepository {
  header = createHeader();
  items = [createItem()];

  async list() {
    return {
      rows: [this.header],
      total: 1,
      summary: {
        pendingApproval: this.header.accTracking === "APPROVED" ? 0 : 1,
        huntingCount: this.header.status === "HUNTING" ? 1 : 0,
        orderedCount: this.header.status === "ORDERED" ? 1 : 0,
        criticalCount: this.header.isCritical ? 1 : 0,
      },
    };
  }

  async listCritical() {
    return this.header.isCritical ? [this.header] : [];
  }

  async listReferences() {
    return {
      units: [],
      divisions: [],
      statuses: [],
      approvalStages: [],
      vendors: [],
    };
  }

  async create(_context: { actorId: string; actorName: string; divisionName: string }, _input: { carId: string }) {
    return {
      prId: "PR-NEW",
      accTracking: "PENDING_ADV" as const,
      status: "OPEN" as const,
    };
  }

  async findById() {
    return {
      header: this.header,
      items: this.items,
    };
  }

  async advanceApproval(prId: string) {
    if (prId !== this.header.prId) {
      throw new Error("PR_NOT_FOUND");
    }

    if (this.header.accTracking === "PENDING_ADV") {
      this.header = { ...this.header, accTracking: "PENDING_KP" };
      return { prId, accTracking: "PENDING_KP" as const, status: this.header.status };
    }

    if (this.header.accTracking === "PENDING_PUR") {
      this.header = { ...this.header, accTracking: "APPROVED", status: "HUNTING" };
      return { prId, accTracking: "APPROVED" as const, status: "HUNTING" as const };
    }

    this.header = { ...this.header, accTracking: "PENDING_PUR" };
    return { prId, accTracking: "PENDING_PUR" as const, status: this.header.status };
  }

  async markOrdered(prId: string) {
    if (prId !== this.header.prId) {
      throw new Error("PR_NOT_FOUND");
    }
    this.header = { ...this.header, status: "ORDERED", totalActualPrice: 1200000, vendorSummary: "Vendor A" };
    this.items = this.items.map((item) => ({
      ...item,
      status: "ORDERED",
      vendorName: "Vendor A",
      actualPrice: 1200000,
    }));
    return { prId, accTracking: this.header.accTracking, status: "ORDERED" as const };
  }

  async markReceived(prId: string) {
    if (prId !== this.header.prId) {
      throw new Error("PR_NOT_FOUND");
    }
    this.header = { ...this.header, status: "ARRIVED", latestArrivalDate: "2026-05-16" };
    this.items = this.items.map((item) => ({
      ...item,
      status: "ARRIVED",
      arrivalDate: "2026-05-16",
    }));
    return { prId, accTracking: this.header.accTracking, status: "ARRIVED" as const };
  }

  async cancel(prId: string) {
    if (prId !== this.header.prId) {
      throw new Error("PR_NOT_FOUND");
    }
    this.header = { ...this.header, status: "CANCELLED" };
    return { prId, accTracking: this.header.accTracking, status: "CANCELLED" as const };
  }
}

describe("DefaultPrService", () => {
  test("creates PR with initial PENDING_ADV stage and OPEN status", async () => {
    const service = new DefaultPrService(
      new InMemoryPrRepository(),
      { async log() {} } satisfies AuditService,
    );

    const result = await service.create(globalSession, {
      carId: "CAR-1",
      divisionName: null,
      targetDate: null,
      priority: "NORMAL",
      notes: null,
      items: [
        {
          itemName: "Karet seal",
          description: null,
          originType: "LOKAL",
          qty: 2,
          uom: "pcs",
          estimatedPrice: 1000000,
          photoUrl: null,
        },
      ],
    });

    expect(result.accTracking).toBe("PENDING_ADV");
    expect(result.status).toBe("OPEN");
  });

  test("moves final purchase approval into HUNTING", async () => {
    const repository = new InMemoryPrRepository();
    repository.header = createHeader("PENDING_PUR", "OPEN");
    const service = new DefaultPrService(
      repository,
      { async log() {} } satisfies AuditService,
    );

    const result = await service.approve(globalSession, "PR-1", { notes: "Lanjut hunting" });

    expect(result.accTracking).toBe("APPROVED");
    expect(result.status).toBe("HUNTING");
  });

  test("marks ordered and received transitions", async () => {
    const repository = new InMemoryPrRepository();
    repository.header = createHeader("APPROVED", "HUNTING");
    const service = new DefaultPrService(
      repository,
      { async log() {} } satisfies AuditService,
    );

    const ordered = await service.order(globalSession, "PR-1", {
      notes: "Vendor dipilih",
      items: [
        {
          itemId: "PRI-1",
          vendorId: null,
          vendorName: "Vendor A",
          actualPrice: 1200000,
          notes: null,
        },
      ],
    });
    expect(ordered.status).toBe("ORDERED");

    const received = await service.receive(globalSession, "PR-1", {
      notes: "Barang diterima",
      items: [
        {
          itemId: "PRI-1",
          arrivalDate: "2026-05-16",
          actualPrice: 1200000,
          notes: null,
        },
      ],
    });
    expect(received.status).toBe("ARRIVED");
  });
});
