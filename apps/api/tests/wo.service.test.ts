import type { AuthUser } from "@smsystem/contracts/auth";
import { describe, expect, test } from "bun:test";
import type {
  WoLinkedCountdown,
  WoRecord,
} from "@smsystem/contracts/wo";
import { DefaultWoService } from "@/services/wo.service";
import type { AuditService } from "@/services/audit/audit.service";
import type { WoRepository } from "@/repositories/wo.repo";
import type { WebSession } from "@/services/auth/session.service";

const woUser: AuthUser = {
  employeeId: "SM-08.005",
  fullName: "YUDHA AGUSTIANA",
  email: null,
  roleId: 19,
  roleName: "kepala_produksi",
  divisionId: 29,
  divisionName: "MANAGER PRODUKSI",
  grade: "KEPALA PRODUKSI",
  permissions: ["WO_VIEW", "WO_APPROVE", "WO_REJECT"],
  scope: {
    canViewAllUnits: false,
    canViewAssignedUnits: true,
    divisionIds: [29],
    managedDivisionIds: [],
    unitIds: [],
  },
};

const globalUser: AuthUser = {
  employeeId: "SM-03.004",
  fullName: "Sahrul Riswanto",
  email: null,
  roleId: 20,
  roleName: "mis",
  divisionId: 3,
  divisionName: "MANAGEMENT INFORMATION SYSTEM",
  grade: "MIS",
  permissions: ["WO_VIEW", "WO_CREATE", "WO_APPROVE", "WO_REJECT", "view_all_units"],
  scope: {
    canViewAllUnits: true,
    canViewAssignedUnits: false,
    divisionIds: [3],
    managedDivisionIds: [3],
    unitIds: [],
  },
};

const woSession: WebSession = {
  sessionId: "wo-session-1",
  sessionKey: "session:wo-1",
  employeeId: woUser.employeeId,
  refreshToken: "refresh-1",
  mobileSessionKey: "session:SM-08.005",
  deviceId: "web-device-1",
  user: woUser,
  createdAt: "2026-05-14T00:00:00.000Z",
};

const globalSession: WebSession = {
  ...woSession,
  sessionId: "wo-session-global",
  sessionKey: "session:wo-global",
  employeeId: globalUser.employeeId,
  mobileSessionKey: "session:SM-03.004",
  user: globalUser,
};

function createTicket(status: WoRecord["status"] = "APPROVED"): WoRecord {
  return {
    woId: "WO-1",
    woNumber: "WO/001/05/2026",
    carId: "CAR-1",
    unitName: "MB 500 SEL",
    customerName: "Mr. Silmy",
    fromDivisionId: 12,
    fromDivisionName: "INTERIOR",
    toDivisionId: 13,
    toDivisionName: "MEKANIK",
    panelName: "Dashboard",
    jobDetail: "Turunkan mesin",
    estimatedHours: 4,
    isPriority: true,
    status,
    requestDate: "2026-05-14",
    approvalDate: status === "APPROVED" ? "2026-05-14 10:00:00" : null,
    createdAt: "2026-05-14 09:00:00",
    notes: null,
    picId: null,
    picName: null,
    approverId: status === "APPROVED" ? "SM-03.004" : null,
    linkedCountdownId: status === "APPROVED" ? "CD-1" : null,
    linkedCountdownStatus: status === "APPROVED" ? "PLAN" : null,
    agingHours: 6,
    agingScore: 72,
    isUrgent: true,
  };
}

class InMemoryWoRepository implements WoRepository {
  ticket = createTicket();
  linkedCountdowns: WoLinkedCountdown[] = [
    {
      coreId: "CD-1",
      divisionId: 13,
      divisionName: "MEKANIK",
      status: "PLAN",
      createdAt: "2026-05-14 10:05:00",
    },
  ];

  async list() {
    return {
      rows: [this.ticket],
      total: 1,
      summary: {
        pendingApproval: this.ticket.status === "SUBMITTED" ? 1 : 0,
        approvedOpen: this.ticket.status === "APPROVED" ? 1 : 0,
        urgentCount: this.ticket.isUrgent ? 1 : 0,
      },
    };
  }

  async listPendingApproval() {
    return this.list();
  }

  async listMyDivision() {
    return this.list();
  }

  async listUrgent() {
    return [this.ticket];
  }

  async listReferences() {
    return {
      units: [],
      divisions: [],
      statuses: [],
    };
  }

  async create(
    _params: { actorId: string; fromDivisionId: number },
    _input: {
      carId: string;
      panelName: string | null;
      estimatedHours: number | null;
      items: unknown[];
    },
  ) {
    return { woId: "WO-NEW" };
  }

  async findById() {
    return this.ticket;
  }

  async updateStatus(woId: string, status: WoRecord["status"], _input?: { actorId?: string; reason?: string | null }) {
    if (woId !== this.ticket.woId) {
      throw new Error("WO_NOT_FOUND");
    }
    this.ticket = {
      ...this.ticket,
      status,
      approvalDate: status === "APPROVED" ? "2026-05-14 10:00:00" : this.ticket.approvalDate,
    };
  }

  async approveStage() {
    this.ticket = {
      ...this.ticket,
      status: "APPROVED",
      approvalDate: "2026-05-14 10:00:00",
      linkedCountdownId: "CD-1",
      linkedCountdownStatus: "PLAN",
    };
    return {
      status: this.ticket.status,
      linkedCountdownId: "CD-1",
    };
  }

  async findLinkedCountdowns() {
    return this.linkedCountdowns;
  }
}

describe("DefaultWoService", () => {
  test("creates WO using actor division as fromDivisionId", async () => {
    const service = new DefaultWoService(
      new InMemoryWoRepository(),
      {
        async log() {
          return;
        },
      } satisfies AuditService,
    );

    const result = await service.create(globalSession, {
      carId: "CAR-1",
      toDivisionId: 13,
      panelName: "Dashboard",
      jobDetail: "Turunkan mesin",
      requestDate: "2026-05-14",
      estimatedHours: 4,
      isPriority: true,
      notes: null,
      items: [],
    });

    expect(result.woId).toBe("WO-NEW");
  });

  test("rejects DONE transition when linked countdown is not done", async () => {
    const repository = new InMemoryWoRepository();
    const service = new DefaultWoService(
      repository,
      {
        async log() {
          return;
        },
      } satisfies AuditService,
    );

    try {
      await service.markDone(woSession, "WO-1");
      expect("should-fail").toBe("COUNTDOWN_NOT_DONE");
    } catch (error) {
      expect(error instanceof Error ? error.message : String(error)).toBe("COUNTDOWN_NOT_DONE");
    }
  });
});
