import type { AuthUser } from "@smsystem/contracts/auth";
import { describe, expect, test } from "bun:test";
import type {
  SpkDetailRecord,
  SpkHeaderRecord,
  SpkPreviewRecord,
} from "@smsystem/contracts/spk";
import { DefaultSpkService } from "@/services/spk.service";
import type { AuditService } from "@/services/audit/audit.service";
import type { SpkRepository } from "@/repositories/spk.repo";
import type { WebSession } from "@/services/auth/session.service";

const globalUser: AuthUser = {
  employeeId: "SM-03.004",
  fullName: "Sahrul Riswanto",
  email: null,
  roleId: 20,
  roleName: "mis",
  divisionId: 3,
  divisionName: "MANAGEMENT INFORMATION SYSTEM",
  grade: "MIS",
  permissions: ["UPDATE_PLAN", "view_all_units"],
  roleProfile: {
    roleLevel: 900,
    scopeBasis: "GLOBAL",
    webEnabled: true,
    mobileEnabled: true,
    approvalRank: 9,
    notes: null,
  },
  scope: {
    canViewAllUnits: true,
    canViewAssignedUnits: false,
    divisionIds: [3],
    managedDivisionIds: [3],
    unitIds: [],
  },
};

const globalSession: WebSession = {
  sessionId: "session-1",
  sessionKey: "session:SM-03.004:session-1",
  employeeId: globalUser.employeeId,
  refreshToken: "refresh-1",
  mobileSessionKey: "session:SM-03.004",
  deviceId: "web-device-1",
  user: globalUser,
  createdAt: "2026-05-13T00:00:00.000Z",
};

class InMemorySpkRepository implements SpkRepository {
  header: SpkHeaderRecord | null = null;
  details: SpkDetailRecord[] = [];
  activatedApprovedPlanIds: string[] = [];

  async list() {
    return {
      rows: this.header ? [this.header] : [],
      total: this.header ? 1 : 0,
      storageReady: true,
    };
  }

  async summary() {
    return {
      pendingApproval: this.header?.status === "SUBMITTED" ? 1 : 0,
    };
  }

  async preview() {
    return {
      rows: [
        {
          planId: "PLAN-1",
          unitName: "MB 500 SEL",
          divisionName: "INTERIOR",
          jobName: "Pasang ke unit",
          picName: "BUDI",
          targetHours: 4,
          targetDate: "2026-05-15",
        },
      ] satisfies SpkPreviewRecord[],
      totalUnits: 1,
      totalHours: 4,
    };
  }

  async findExistingByDate() {
    return null;
  }

  async findPlannerDraftByWeeklyPlan() {
    return null;
  }

  async generate(_params: { actorId: string; actorName: string }, input: { spkDate: string; notes: string | null }) {
    this.header = {
      spkId: "SPK-1",
      spkNumber: "SPK-20260515-001",
      spkDate: input.spkDate,
      status: "DRAFT",
      totalUnits: 1,
      totalHours: 4,
      createdBy: globalUser.fullName,
      approvedBy: null,
      rejectReason: null,
      notes: input.notes,
      createdAt: "2026-05-14 10:00:00",
      submittedAt: null,
      approvedAt: null,
      activatedAt: null,
    };
    this.details = [
      {
        detailId: "SPKD-1",
        spkId: "SPK-1",
        planId: "PLAN-1",
        unitNameSnapshot: "MB 500 SEL",
        divisionNameSnapshot: "INTERIOR",
        jobNameSnapshot: "Pasang ke unit",
        picNameSnapshot: "BUDI",
        targetHoursSnapshot: 4,
        targetDateSnapshot: input.spkDate,
        approvalState: "PENDING",
        approvalNote: null,
        approvedBy: null,
        approvedAt: null,
      },
    ];
    return { spkId: "SPK-1" };
  }

  async findDetail() {
    if (!this.header) {
      return null;
    }

    return {
      header: this.header,
      details: this.details,
    };
  }

  async updateHeaderStatus(spkId: string, status: SpkHeaderRecord["status"], input?: { actorId?: string; reason?: string | null }) {
    if (!this.header || this.header.spkId !== spkId) {
      throw new Error("Not found");
    }

    this.header = {
      ...this.header,
      status,
      rejectReason: input?.reason ?? this.header.rejectReason,
      approvedBy:
        status === "APPROVED" ? globalUser.fullName : this.header.approvedBy,
      approvedAt:
        status === "APPROVED" ? "2026-05-14 12:00:00" : this.header.approvedAt,
      submittedAt:
        status === "SUBMITTED" ? "2026-05-14 11:00:00" : this.header.submittedAt,
      activatedAt:
        status === "ACTIVE" ? "2026-05-14 13:00:00" : this.header.activatedAt,
    };
  }

  async updateItemApproval(spkId: string, detailId: string, input: { isApproved: boolean; note: string | null; actorId: string }) {
    void spkId;
    void input.actorId;
    this.details = this.details.map((detail) =>
      detail.detailId === detailId
        ? {
            ...detail,
            approvalState: input.isApproved ? "APPROVED" : "REJECTED",
            approvalNote: input.note,
            approvedBy: globalUser.fullName,
            approvedAt: "2026-05-14 11:30:00",
          }
        : detail,
    );
  }

  async lockPlansForActivation(spkId: string) {
    void spkId;
    this.activatedApprovedPlanIds = this.details
      .filter((detail) => detail.approvalState === "APPROVED")
      .map((detail) => detail.planId)
      .filter((planId): planId is string => Boolean(planId));
    return this.activatedApprovedPlanIds;
  }

  async today() {
    return this.header ? [this.header] : [];
  }

  async generateFromWeeklyPlan() {
    return { spkId: "SPK-PLANNER-1" };
  }

  async replaceDraftDetails(_spkId: string, rows: Array<{
    detailId?: string | null;
    unitNameSnapshot: string;
    divisionNameSnapshot: string;
    jobNameSnapshot: string;
    picNameSnapshot: string;
    targetHoursSnapshot: number;
    targetDateSnapshot: string;
  }>) {
    this.details = rows.map((row, index) => ({
      detailId: row.detailId ?? `SPKD-${index + 1}`,
      spkId: "SPK-1",
      planId: null,
      unitNameSnapshot: row.unitNameSnapshot,
      divisionNameSnapshot: row.divisionNameSnapshot,
      jobNameSnapshot: row.jobNameSnapshot,
      picNameSnapshot: row.picNameSnapshot,
      targetHoursSnapshot: row.targetHoursSnapshot,
      targetDateSnapshot: row.targetDateSnapshot,
      approvalState: "PENDING",
      approvalNote: null,
      approvedBy: null,
      approvedAt: null,
    }));
  }
}

describe("DefaultSpkService", () => {
  test("keeps snapshot fields immutable after submit and item approval", async () => {
    const repository = new InMemorySpkRepository();
    const service = new DefaultSpkService(
      repository,
      {
        async log() {
          return;
        },
      } satisfies AuditService,
    );

    const generated = await service.generate(globalSession, {
      spkDate: "2026-05-15",
      notes: "Plan besok",
    });
    await service.submit(globalSession, generated.spkId);

    const before = await service.findDetail(globalSession, generated.spkId);
    await service.approveItem(globalSession, generated.spkId, "SPKD-1", {
      isApproved: true,
      note: "Ok",
    });
    const after = await service.findDetail(globalSession, generated.spkId);

    expect(before?.details[0]?.jobNameSnapshot).toBe("Pasang ke unit");
    expect(after?.details[0]?.jobNameSnapshot).toBe("Pasang ke unit");
    expect(after?.details[0]?.targetHoursSnapshot).toBe(4);
    expect(after?.details[0]?.approvalState).toBe("APPROVED");
  });

  test("locks only approved plan rows when SPK becomes active", async () => {
    const repository = new InMemorySpkRepository();
    const service = new DefaultSpkService(
      repository,
      {
        async log() {
          return;
        },
      } satisfies AuditService,
    );

    const generated = await service.generate(globalSession, {
      spkDate: "2026-05-15",
      notes: null,
    });
    await service.submit(globalSession, generated.spkId);
    await service.approveItem(globalSession, generated.spkId, "SPKD-1", {
      isApproved: true,
      note: null,
    });
    await service.approve(globalSession, generated.spkId);
    await service.activate(globalSession, generated.spkId);

    expect(repository.activatedApprovedPlanIds).toEqual(["PLAN-1"]);
  });

  test("planner draft can be activated directly by approval rank flow", async () => {
    const repository = new InMemorySpkRepository();
    repository.header = {
      spkId: "SPK-PLANNER-1",
      spkNumber: "SPK-20260519-001",
      spkDate: "2026-05-19",
      status: "DRAFT",
      totalUnits: 1,
      totalHours: 6,
      createdBy: globalUser.fullName,
      approvedBy: null,
      rejectReason: null,
      notes:
        '[PLANNER_AUTO_DRAFT]{"source":"WEEKLY_PLANNER","weeklyPlanId":"PLAN-1","weekStartDate":"2026-05-19","generatedOvertimeRows":1,"allocations":[{"allocationKey":"MB 500 SEL::INTERIOR","carId":"CAR-1","unitName":"MB 500 SEL","divisionId":12,"divisionName":"INTERIOR","targetHours":6}],"note":"Planner"}',
      createdAt: "2026-05-18 08:00:00",
      submittedAt: null,
      approvedAt: null,
      activatedAt: null,
      plannerMeta: {
        source: "WEEKLY_PLANNER",
        weeklyPlanId: "PLAN-1",
        weekStartDate: "2026-05-19",
        generatedOvertimeRows: 1,
        allocations: [
          {
            allocationKey: "MB 500 SEL::INTERIOR",
            carId: "CAR-1",
            unitName: "MB 500 SEL",
            divisionId: 12,
            divisionName: "INTERIOR",
            targetHours: 6,
          },
        ],
        note: "Planner",
      },
    };
    repository.details = [
      {
        detailId: "SPKD-PLANNER-1",
        spkId: "SPK-PLANNER-1",
        planId: null,
        unitNameSnapshot: "MB 500 SEL",
        divisionNameSnapshot: "INTERIOR",
        jobNameSnapshot: "Target mingguan INTERIOR",
        picNameSnapshot: "Belum dibagi",
        targetHoursSnapshot: 6,
        targetDateSnapshot: "2026-05-19",
        approvalState: "PENDING",
        approvalNote: null,
        approvedBy: null,
        approvedAt: null,
      },
    ];

    const service = new DefaultSpkService(
      repository,
      {
        async log() {
          return;
        },
      } satisfies AuditService,
    );

    const result = await service.activate(globalSession, "SPK-PLANNER-1");

    expect(result.status).toBe("ACTIVE");
    expect(repository.header?.status).toBe("ACTIVE");
    expect(repository.activatedApprovedPlanIds).toEqual([]);
  });
});
