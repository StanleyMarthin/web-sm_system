import type { AuthUser } from "@smsystem/contracts/auth";
import { describe, expect, test } from "bun:test";
import type {
  BulkCreateJobPlanRequest,
  CreateJobPlanWorkspaceRequest,
  JobPlanDraftRecord,
  JobPlanGridQuery,
  JobPlanPicLoad,
  JobPlanRecord,
} from "@smsystem/contracts/job-plan";
import { DefaultJobPlanService } from "@/services/job-plan.service";
import type { AuditService } from "@/services/audit/audit.service";
import type { JobPlanRepository } from "@/repositories/job-plan.repo";
import type { WebSession } from "@/services/auth/session.service";
import type { RedisClientType } from "redis";

const sampleUser: AuthUser = {
  employeeId: "SM-03.004",
  fullName: "Sahrul Riswanto",
  email: null,
  roleId: 20,
  roleName: "mis",
  divisionId: 3,
  divisionName: "MANAGEMENT INFORMATION SYSTEM",
  grade: "MIS",
  permissions: ["UPDATE_PLAN", "view_all_units"],
  scope: {
    canViewAllUnits: true,
    canViewAssignedUnits: false,
    divisionIds: [3],
    managedDivisionIds: [3],
    unitIds: [],
  },
};

const sampleSession: WebSession = {
  sessionId: "session-1",
  sessionKey: "session:SM-03.004:session-1",
  employeeId: sampleUser.employeeId,
  refreshToken: "refresh-1",
  mobileSessionKey: "session:SM-03.004",
  deviceId: "web-device-1",
  user: sampleUser,
  createdAt: "2026-05-13T00:00:00.000Z",
};

const sampleCapacity: JobPlanPicLoad = {
  normal: { used: 2, max: 8, remaining: 6 },
  overtime: { used: 0, max: 5, remaining: 5 },
};

class InMemoryJobPlanRepository implements JobPlanRepository {
  readonly createdInputs: BulkCreateJobPlanRequest["plans"][] = [];

  async list() {
    return {
      rows: [] as JobPlanRecord[],
      total: 0,
      summary: {
        totalHours: 0,
        pendingCount: 0,
        approvedCount: 0,
        overtimeCount: 0,
      },
    };
  }

  async listReferences() {
    return {
      employees: [],
      divisions: [],
      units: [],
      countdowns: [],
      workOrders: [],
      panels: [],
      jobTypes: [],
      statuses: [],
    };
  }

  async getPicLoad() {
    return sampleCapacity;
  }

  async createMany(_params: { actorId: string }, input: BulkCreateJobPlanRequest["plans"]) {
    this.createdInputs.push(input);
    return {
      createdIds: input.map((_, index) => `PLAN-${index + 1}`),
    };
  }

  async createWorkspace(
    _params: { actorId: string },
    input: CreateJobPlanWorkspaceRequest,
  ) {
    this.createdInputs.push(
      input.rows.map((row) => ({
        coreId: row.referenceId ?? row.jobTypeId ?? "additional",
        assignedUserId: row.assignedUserId,
        taskDate: input.taskDate,
        targetHours: row.targetHours,
        startTime: row.startTime,
        finishTime: row.finishTime,
        jobDescription: row.jobDescription,
        note: row.note,
        isOvertime: input.mode === "overtime",
        isPriority: row.isPriority,
      })),
    );
    return {
      createdIds: ["PLAN-WS-1"],
    };
  }

  async submitDrafts(
    _params: { actorId: string },
    drafts: JobPlanDraftRecord[],
  ) {
    this.createdInputs.push(
      drafts.map((draft) => ({
        coreId: draft.coreId ?? draft.draftItemId,
        assignedUserId: draft.assignedUserId,
        taskDate: draft.taskDate,
        targetHours: draft.targetHours,
        startTime: draft.startTime,
        finishTime: draft.finishTime,
        jobDescription: draft.jobDescription,
        note: draft.note,
        isOvertime: draft.isOvertime,
        isPriority: draft.isPriority,
      })),
    );
    return {
      createdIds: drafts.map((_, index) => `PLAN-DRAFT-${index + 1}`),
    };
  }

  async findById() {
    return null;
  }

  async update() {
    return {
      updatedPlanId: "PLAN-1",
    };
  }

  async updateStatus() {
    return {
      planId: "PLAN-1",
      status: "PLAN" as const,
    };
  }

  async delete() {
    return;
  }

  async exportCsv() {
    return "planId,status\n";
  }
}

function createRedisStub(initialDrafts: JobPlanDraftRecord[] = []): () => Promise<RedisClientType> {
  let currentDrafts = [...initialDrafts];

  return async () =>
    ({
      async get() {
        return currentDrafts.length > 0 ? JSON.stringify(currentDrafts) : null;
      },
      async set(_key: string, value: string) {
        currentDrafts = JSON.parse(value) as JobPlanDraftRecord[];
      },
      async del() {
        currentDrafts = [];
      },
    }) as unknown as RedisClientType;
}

describe("DefaultJobPlanService", () => {
  test("rejects bulk create when aggregated hours exceed remaining capacity", async () => {
    const repository = new InMemoryJobPlanRepository();
    const service = new DefaultJobPlanService(
      repository,
      {
        async log() {
          return;
        },
      } satisfies AuditService,
      createRedisStub(),
    );

    const payload: BulkCreateJobPlanRequest = {
      plans: [
        {
          coreId: "cd-1",
          assignedUserId: "SM-11.002",
          taskDate: "2026-05-14",
          targetHours: 4,
          startTime: "08:00",
          finishTime: "12:00",
          jobDescription: "Fitting dashboard",
          note: null,
          isOvertime: false,
          isPriority: false,
        },
        {
          coreId: "cd-2",
          assignedUserId: "SM-11.002",
          taskDate: "2026-05-14",
          targetHours: 3,
          startTime: "13:00",
          finishTime: "16:00",
          jobDescription: "Install carpet",
          note: null,
          isOvertime: false,
          isPriority: false,
        },
      ],
    };

    try {
      await service.bulkCreate(sampleSession, payload);
      throw new Error("Expected capacity validation to fail");
    } catch (error) {
      expect((error as Error).message).toBe("CAPACITY_EXCEEDED");
    }
  });

  test("writes audit entry after successful bulk create", async () => {
    const repository = new InMemoryJobPlanRepository();
    const auditActions: string[] = [];
    const service = new DefaultJobPlanService(
      repository,
      {
        async log(entry) {
          auditActions.push(entry.action);
        },
      } satisfies AuditService,
      createRedisStub(),
    );

    await service.bulkCreate(sampleSession, {
      plans: [
        {
          coreId: "cd-1",
          assignedUserId: "SM-11.002",
          taskDate: "2026-05-14",
          targetHours: 2,
          startTime: "08:00",
          finishTime: "10:00",
          jobDescription: "Fitting dashboard",
          note: null,
          isOvertime: false,
          isPriority: false,
        },
      ],
    });

    expect(repository.createdInputs.length).toBe(1);
    expect(auditActions).toEqual(["jobplan.bulk_create"]);
  });

  test("membagi create normal menjadi normal dan lembur saat jam melewati batas harian", async () => {
    const repository = new InMemoryJobPlanRepository();
    const service = new DefaultJobPlanService(
      repository,
      {
        async log() {
          return;
        },
      } satisfies AuditService,
      createRedisStub(),
    );

    const result = await service.create(sampleSession, {
      coreId: "cd-1",
      assignedUserId: "SM-11.002",
      taskDate: "2026-05-23",
      targetHours: 6,
      startTime: null,
      finishTime: null,
      jobDescription: "Tambahan sabtu",
      note: null,
      isOvertime: false,
      isPriority: false,
    });

    expect(result.createdIds.length).toBe(2);
    expect(repository.createdInputs.length).toBe(1);
    expect(repository.createdInputs[0]).toEqual([
      {
        coreId: "cd-1",
        assignedUserId: "SM-11.002",
        taskDate: "2026-05-23",
        targetHours: 5,
        startTime: "08:00",
        finishTime: "14:00",
        jobDescription: "Tambahan sabtu",
        note: null,
        isOvertime: false,
        isPriority: false,
      },
      {
        coreId: "cd-1",
        assignedUserId: "SM-11.002",
        taskDate: "2026-05-23",
        targetHours: 1,
        startTime: "14:00",
        finishTime: "15:00",
        jobDescription: "Tambahan sabtu",
        note: null,
        isOvertime: true,
        isPriority: false,
      },
    ]);
  });

  test("writes audit entry after successful workspace create", async () => {
    const repository = new InMemoryJobPlanRepository();
    const auditActions: string[] = [];
    const service = new DefaultJobPlanService(
      repository,
      {
        async log(entry) {
          auditActions.push(entry.action);
        },
      } satisfies AuditService,
      createRedisStub(),
    );

    await service.createWorkspace(sampleSession, {
      mode: "normal",
      taskDate: "2026-05-19",
      deadlineDate: "2026-05-21",
      projectTargetHours: "008:00",
      isRework: false,
      rows: [
        {
          source: "countdown",
          referenceId: "cd-1",
          carId: null,
          panelId: null,
          jobTypeId: null,
          assignedUserId: "SM-11.002",
          targetHours: 2,
          startTime: "08:00",
          finishTime: "10:00",
          jobDescription: "Fitting dashboard",
          note: null,
          isPriority: false,
        },
      ],
    });

    expect(repository.createdInputs.length).toBe(1);
    expect(auditActions).toEqual(["jobplan.workspace_create"]);
  });

  test("menyimpan draft lalu submit ke repository tanpa langsung jadi plan saat save", async () => {
    const repository = new InMemoryJobPlanRepository();
    const service = new DefaultJobPlanService(
      repository,
      {
        async log() {
          return;
        },
      } satisfies AuditService,
      createRedisStub(),
    );

    const saveResult = await service.saveDraft(sampleSession, {
      replaceItems: false,
      items: [
        {
          draftItemId: "draft-1",
          sourceType: "COUNTDOWN",
          coreId: "cd-1",
          carId: "MB500SEL",
          unitName: "MB 500 SEL",
          divisionId: 29,
          divisionName: "MANAGER PRODUKSI",
          panelId: null,
          panelName: "Dashboard",
          jobTypeId: null,
          jobName: "Fitting dashboard",
          assignedUserId: "SM-11.002",
          assignedUserName: "BUDI",
          taskDate: "2026-05-14",
          targetHours: 2,
          startTime: "08:00",
          finishTime: "10:00",
          jobDescription: "Fitting dashboard",
          note: null,
          isOvertime: false,
          isPriority: false,
          deadlineDate: null,
          isRework: false,
        },
      ],
    });

    expect(saveResult.status).toBe("DRAFT");
    expect(repository.createdInputs.length).toBe(0);

    const submitResult = await service.submitDrafts(sampleSession, {
      draftItemIds: ["draft-1"],
    });

    expect(submitResult.createdIds[0]).toBe("PLAN-DRAFT-1");
    expect(repository.createdInputs.length).toBe(1);
  });
});
