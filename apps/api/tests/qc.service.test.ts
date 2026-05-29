import type { AuthUser } from "@smsystem/contracts/auth";
import { describe, expect, test } from "bun:test";
import type {
  QcFinalChecklist,
  QcFinalChecklistItem,
  QcGridQuery,
  QcPassRequest,
  QcQueueRecord,
  QcRejectRequest,
  QcSummary,
} from "@smsystem/contracts/qc";
import { DefaultQcService } from "@/services/qc.service";
import type { AuditService } from "@/services/audit/audit.service";
import type { IssuesRepository } from "@/repositories/issues.repo";
import type { QcRepository } from "@/repositories/qc.repo";
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
  sessionId: "qc-session-1",
  sessionKey: "session:qc-1",
  employeeId: sampleUser.employeeId,
  refreshToken: "refresh-1",
  mobileSessionKey: "session:SM-08.005",
  deviceId: "web-device-1",
  user: sampleUser,
  createdAt: "2026-05-14T00:00:00.000Z",
};

const qcRow: QcQueueRecord = {
  coreId: "CD-1",
  carId: "CAR-1",
  unitName: "MB 500 SEL",
  customerName: "Mr. Silmy",
  divisionId: 12,
  divisionName: "INTERIOR",
  panelId: 459,
  panelName: "Dashboard",
  taskCategory: "MAIN",
  jobName: "Pasang dashboard",
  countdownStatus: "READY_QC",
  qcLastStatus: null,
  qcLevel: null,
  latestQcId: null,
  refWoId: null,
  waitingHours: 2,
  remainingHours: 2,
  targetHours: 4,
  deadlineDate: "2026-05-14",
  latestInspectionDate: null,
  latestInspectionNotes: null,
  photoBeforeUrl: null,
  evidencePhotoUrl: null,
  reworkPlanId: null,
  reworkTaskDate: null,
  reworkAssignedUserId: null,
  reworkAssignedUserName: null,
  reworkPlanStatus: null,
  linkedIssueId: null,
  openIssueCount: 0,
};

class InMemoryQcRepository implements QcRepository {
  lastPassInput: QcPassRequest | null = null;
  lastRejectInput: QcRejectRequest | null = null;
  finalChecklist: QcFinalChecklist = {
    carId: "CAR-1",
    unitName: "MB 500 SEL",
    customerName: "Mr. Silmy",
    targetDeliveryDate: "2026-05-20",
    totalTasks: 2,
    completedTasks: 2,
    passedTasks: 2,
    rejectedTasks: 0,
    openIssueCount: 0,
    isReadyForDelivery: true,
    approvedAt: null,
    approvedBy: null,
    notes: null,
  };

  async listQueue() {
    return {
      rows: [qcRow],
      total: 1,
      summary: this.buildSummary(),
    };
  }

  async listRework() {
    return {
      rows: [],
      total: 0,
      summary: this.buildSummary(),
    };
  }

  async listRecheck() {
    return {
      rows: [],
      total: 0,
      summary: this.buildSummary(),
    };
  }

  async listReferences() {
    return {
      divisions: [{ label: "INTERIOR", value: "12" }],
      units: [{ label: "MB 500 SEL", value: "CAR-1" }],
      statuses: [{ label: "READY_QC", value: "READY_QC" }],
      qcLevels: [{ label: "QC_KP", value: "QC_KP" }],
    };
  }

  async findByCoreId() {
    return qcRow;
  }

  async passInspection(_context: { actorId: string; qcLevel: string }, input: { coreId: string; payload: QcPassRequest }) {
    this.lastPassInput = input.payload;
    return {
      qcId: "QC-1",
      coreId: input.coreId,
      resultStatus: "LOLOS" as const,
      issueId: null,
      reworkPlanId: null,
    };
  }

  async rejectInspection(_context: { actorId: string; qcLevel: string }, input: { coreId: string; payload: QcRejectRequest }) {
    this.lastRejectInput = input.payload;
    return {
      qcId: "QC-2",
      coreId: input.coreId,
      resultStatus: "TIDAK_LOLOS" as const,
      issueId: null,
      reworkPlanId: "PLAN-REWORK-1",
    };
  }

  async findFinalChecklist() {
    return {
      checklist: this.finalChecklist,
      items: [
        {
          coreId: "CD-1",
          panelName: "Dashboard",
          divisionName: "INTERIOR",
          jobName: "Pasang dashboard",
          countdownStatus: "DONE",
          qcLastStatus: "LOLOS",
          latestQcId: "QC-1",
          issueId: null,
          issueStatus: null,
        },
      ] satisfies QcFinalChecklistItem[],
    };
  }

  async approveFinalChecklist(_context: { actorId: string; actorName: string | null }, input: { carId: string; notes: string | null }) {
    this.finalChecklist = {
      ...this.finalChecklist,
      approvedAt: "2026-05-14 11:00:00",
      approvedBy: "Yudha Agustiana",
      notes: input.notes,
    };
    return {
      carId: input.carId,
      approved: true as const,
      approvedAt: "2026-05-14 11:00:00",
    };
  }

  private buildSummary(): QcSummary {
    return {
      readyCount: 1,
      recheckCount: 0,
      activeReworkCount: 0,
      finalReadyUnits: 1,
    };
  }
}

describe("DefaultQcService", () => {
  test("reject stores rework and auto-creates issue", async () => {
    const repository = new InMemoryQcRepository();
    let autoIssueInput: { sourceRefId: string; sourceType: string } | null = null;
    const service = new DefaultQcService(
      repository,
      {
        async upsertAutoIssue(input) {
          autoIssueInput = {
            sourceRefId: input.sourceRefId,
            sourceType: input.sourceType,
          };
          return "ISSUE-1";
        },
        async updateStatus() {
          return;
        },
      } satisfies Pick<IssuesRepository, "upsertAutoIssue" | "updateStatus">,
      {
        async log() {
          return;
        },
      } satisfies AuditService,
    );

    const result = await service.reject(sampleSession, "CD-1", {
      notes: "Cat kurang rata",
      inspectionDurationMinutes: 15,
      photoBeforeUrl: null,
      evidencePhotoUrl: "https://example.com/qc-2.jpg",
      reworkDate: "2026-05-15",
      reworkAssignedUser: "SM-11.002",
      reworkDailyHours: "03:00",
      reworkStartTime: "08:00",
      reworkFinishTime: "11:00",
      reworkDescription: "Amplas dan cat ulang",
      reworkIsOvertime: false,
      reworkIsPriority: true,
    });

    expect(result.qcId).toBe("QC-2");
    expect(result.reworkPlanId).toBe("PLAN-REWORK-1");
    expect(result.issueId).toBe("ISSUE-1");
    expect(repository.lastRejectInput?.reworkDailyHours).toBe("03:00");
    expect(autoIssueInput).toEqual({
      sourceRefId: "QC-2",
      sourceType: "QC_REJECT",
    });
  });

  test("blocks final approval when checklist is not ready", async () => {
    const repository = new InMemoryQcRepository();
    repository.finalChecklist = {
      ...repository.finalChecklist,
      isReadyForDelivery: false,
      openIssueCount: 2,
    };

    const service = new DefaultQcService(
      repository,
      {
        async upsertAutoIssue() {
          return "ISSUE-1";
        },
        async updateStatus() {
          return;
        },
      } satisfies Pick<IssuesRepository, "upsertAutoIssue" | "updateStatus">,
      {
        async log() {
          return;
        },
      } satisfies AuditService,
    );

    try {
      await service.approveFinalChecklist(sampleSession, "CAR-1", {
        notes: "Ready delivery",
      });
      expect("should-fail").toBe("FINAL_CHECKLIST_NOT_READY");
    } catch (error) {
      expect(error instanceof Error ? error.message : String(error)).toBe(
        "FINAL_CHECKLIST_NOT_READY",
      );
    }
  });

  test("reject still succeeds when issue storage is not ready", async () => {
    const repository = new InMemoryQcRepository();
    const service = new DefaultQcService(
      repository,
      {
        async upsertAutoIssue() {
          throw new Error("ISSUES_STORAGE_NOT_READY");
        },
        async updateStatus() {
          return;
        },
      } satisfies Pick<IssuesRepository, "upsertAutoIssue" | "updateStatus">,
      {
        async log() {
          return;
        },
      } satisfies AuditService,
    );

    const result = await service.reject(sampleSession, "CD-1", {
      notes: "Cat kurang rata",
      inspectionDurationMinutes: 15,
      photoBeforeUrl: null,
      evidencePhotoUrl: "https://example.com/qc-2.jpg",
      reworkDate: "2026-05-15",
      reworkAssignedUser: "SM-11.002",
      reworkDailyHours: "03:00",
      reworkStartTime: "08:00",
      reworkFinishTime: "11:00",
      reworkDescription: "Amplas dan cat ulang",
      reworkIsOvertime: false,
      reworkIsPriority: true,
    });

    expect(result.qcId).toBe("QC-2");
    expect(result.issueId).toBe(null);
  });
});
