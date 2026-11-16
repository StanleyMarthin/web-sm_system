import type { AuthUser } from "@smsystem/contracts/auth";
import { describe, expect, test } from "bun:test";
import type {
  JobPlanDraftRecord,
  JobPlanGridQuery,
  JobPlanPicLoad,
  JobPlanRecord,
} from "@smsystem/contracts/job-plan";
import { DefaultJobPlanService } from "@/services/job-plan/job-plan.service";
import { sanitizeJobPlanGridQuery } from "@/services/job-plan/query";
import type { AuditService } from "@/services/audit/audit.service";
import type { JobPlanRepository } from "@/repositories/job-plan/job-plan.repo";
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
  permissions: ["CREATE_TASK", "UPDATE_PLAN", "view_all_units"],
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
  async listOptions() {
    return [];
  }

  async createAdditionalCountdown(): Promise<never> {
    throw new Error("Unexpected countdown creation");
  }

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
      countdowns: [{
        value: "cd-1",
        label: "Fitting dashboard",
        remainingHours: 5,
        availablePlanHours: 5,
      }],
      workOrders: [],
      panels: [],
      jobTypes: [],
      statuses: [],
    };
  }

  async getPicLoad() {
    return sampleCapacity;
  }

  async getPicLoadBatch(requests: Array<{ employeeId: string; taskDate: string }>) {
    return new Map(requests.map((request) => [
      `${request.employeeId}|${request.taskDate}`,
      sampleCapacity,
    ]));
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
        const payload = JSON.parse(value) as JobPlanDraftRecord[] | { items?: JobPlanDraftRecord[] };
        currentDrafts = Array.isArray(payload) ? payload : payload.items ?? [];
      },
      async del() {
        currentDrafts = [];
      },
    }) as unknown as RedisClientType;
}

describe("DefaultJobPlanService", () => {

  test("stores and deletes shared drafts without creating an operational plan", async () => {
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
    const query = sanitizeJobPlanGridQuery(new URLSearchParams({ date: "2026-05-14", mode: "all" }));
    const saved = await service.list(sampleSession, query);
    expect(saved.data[0]?.status).toBe("DRAFT");
    const deleted = await service.deleteDrafts(sampleSession, {
      draftItemIds: ["draft-1"],
    });
    expect(deleted.deletedPlanId).toBe("draft-1");
    expect((await service.list(sampleSession, query)).data).toEqual([]);
    expect(auditActions).toEqual(["jobplan.draft_save", "jobplan.draft_delete"]);
  });

  test("list tetap berjalan saat Redis draft tidak tersedia", async () => {
    const repository = new InMemoryJobPlanRepository();
    const service = new DefaultJobPlanService(
      repository,
      { async log() { return; } } satisfies AuditService,
      async () => {
        throw new Error("REDIS_DOWN");
      },
    );

    const result = await service.list(sampleSession, {
      page: 1,
      limit: 25,
      search: "",
      sortBy: "taskDate",
      sortDirection: "asc",
      view: null,
      filters: [],
      date: "2026-05-14",
      window: "daily",
      mode: "normal",
      dateStart: "2026-05-14",
      dateEnd: "2026-05-14",
    });

    expect(result.data).toEqual([]);
    expect(result.meta.total).toBe(0);
  });

  test("menolak total draft yang melebihi sisa target countdown", async () => {
    const repository = new InMemoryJobPlanRepository();
    repository.listReferences = async () => ({
      employees: [],
      divisions: [],
      units: [],
      countdowns: [{
        value: "cd-1",
        label: "Fitting dashboard",
        remainingHours: 5,
        availablePlanHours: 5,
      }],
      workOrders: [],
      panels: [],
      jobTypes: [],
      statuses: [],
    });
    const service = new DefaultJobPlanService(
      repository,
      { async log() { return; } } satisfies AuditService,
      createRedisStub(),
    );
    const draft = {
      draftItemId: "draft-1",
      sourceType: "COUNTDOWN" as const,
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
      targetHours: 3,
      startTime: "08:00",
      finishTime: "11:00",
      jobDescription: "Fitting dashboard",
      note: null,
      isOvertime: false,
      isPriority: false,
      deadlineDate: null,
      isRework: false,
    };

    await expect(service.saveDraft(sampleSession, {
      replaceItems: true,
      items: [draft, { ...draft, draftItemId: "draft-2" }],
    })).rejects.toThrow("COUNTDOWN_CAPACITY_EXCEEDED");
  });
});
