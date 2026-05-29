import type { AuthUser } from "@smsystem/contracts/auth";
import { describe, expect, test } from "bun:test";
import type { VendorRecord } from "@smsystem/contracts/vendor";
import { DefaultVendorService } from "@/services/vendor.service";
import type { AuditService } from "@/services/audit/audit.service";
import type { VendorRepository } from "@/repositories/vendor.repo";
import type { WebSession } from "@/services/auth/session.service";

const vendorUser: AuthUser = {
  employeeId: "SM-17.001",
  fullName: "Ruhiat",
  email: null,
  roleId: 17,
  roleName: "ketua_divisi",
  divisionId: 12,
  divisionName: "INTERIOR",
  grade: "KD",
  permissions: ["VENDOR_VIEW", "VENDOR_CREATE", "VENDOR_APPROVE", "VENDOR_UPDATE_STATUS", "VENDOR_RECEIVE"],
  scope: {
    canViewAllUnits: false,
    canViewAssignedUnits: true,
    divisionIds: [12],
    managedDivisionIds: [12],
    unitIds: [],
  },
};

const vendorSession: WebSession = {
  sessionId: "vendor-session-1",
  sessionKey: "session:vendor-1",
  employeeId: vendorUser.employeeId,
  refreshToken: "refresh-1",
  mobileSessionKey: "session:SM-17.001",
  deviceId: "web-device-1",
  user: vendorUser,
  createdAt: "2026-05-15T00:00:00.000Z",
};

function createTicket(
  stage: VendorRecord["accTracking"] = "PENDING_ADV",
  status: VendorRecord["status"] = "OPEN",
): VendorRecord {
  return {
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
    accTracking: stage,
    status,
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
  };
}

class InMemoryVendorRepository implements VendorRepository {
  ticket = createTicket();

  async list() {
    return {
      rows: [this.ticket],
      total: 1,
      summary: {
        pendingApproval: this.ticket.accTracking === "APPROVED" ? 0 : 1,
        activeVendorCount: this.ticket.status === "RECEIVED" ? 0 : 1,
        overdueCount: 0,
        reworkCount: this.ticket.status === "REWORK_VENDOR" ? 1 : 0,
      },
    };
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

  async create() {
    return {
      wovId: "WOV-NEW",
      accTracking: "PENDING_ADV" as const,
      status: "OPEN" as const,
    };
  }

  async findById() {
    return { ticket: this.ticket };
  }

  async advanceApproval(wovId: string) {
    if (wovId !== this.ticket.wovId) {
      throw new Error("VENDOR_WO_NOT_FOUND");
    }

    if (this.ticket.accTracking === "PENDING_PM") {
      this.ticket = { ...this.ticket, accTracking: "APPROVED" };
      return { wovId, accTracking: "APPROVED" as const, status: this.ticket.status };
    }

    this.ticket = { ...this.ticket, accTracking: "PENDING_PM" };
    return { wovId, accTracking: "PENDING_PM" as const, status: this.ticket.status };
  }

  async updateStatus(wovId: string, input: { status: VendorRecord["status"] }) {
    if (wovId !== this.ticket.wovId) {
      throw new Error("VENDOR_WO_NOT_FOUND");
    }
    this.ticket = { ...this.ticket, status: input.status };
    return { wovId, accTracking: this.ticket.accTracking, status: input.status };
  }

  async receive(wovId: string) {
    if (wovId !== this.ticket.wovId) {
      throw new Error("VENDOR_WO_NOT_FOUND");
    }
    this.ticket = { ...this.ticket, status: "RECEIVED", dateIn: "2026-05-20", qcStatus: "GOOD" };
    return { wovId, accTracking: this.ticket.accTracking, status: "RECEIVED" as const };
  }

  async cancel(wovId: string) {
    if (wovId !== this.ticket.wovId) {
      throw new Error("VENDOR_WO_NOT_FOUND");
    }
    this.ticket = { ...this.ticket, status: "CANCELLED" };
    return { wovId, accTracking: this.ticket.accTracking, status: "CANCELLED" as const };
  }
}

describe("DefaultVendorService", () => {
  test("creates vendor wo with initial approval stage", async () => {
    const service = new DefaultVendorService(
      new InMemoryVendorRepository(),
      { async log() {} } satisfies AuditService,
    );

    const result = await service.create(vendorSession, {
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
      items: [],
    });

    expect(result.accTracking).toBe("PENDING_ADV");
    expect(result.status).toBe("OPEN");
  });

  test("approves final stage and marks received", async () => {
    const repository = new InMemoryVendorRepository();
    repository.ticket = createTicket("PENDING_PM", "DONE_VENDOR");
    const service = new DefaultVendorService(
      repository,
      { async log() {} } satisfies AuditService,
    );

    const approved = await service.approve(vendorSession, "WOV-1", { notes: "Lanjut" });
    expect(approved.accTracking).toBe("APPROVED");

    const received = await service.receive(vendorSession, "WOV-1", {
      dateIn: "2026-05-20",
      goodsConditionIn: "Sudah diperbaiki",
      qcStatus: "GOOD",
      actualCost: 2200000,
      remarks: null,
    });
    expect(received.status).toBe("RECEIVED");
  });
});
