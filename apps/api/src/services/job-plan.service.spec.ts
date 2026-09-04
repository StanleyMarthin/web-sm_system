import * as bunTest from "bun:test";
import type { JobPlanGridQuery } from "@smsystem/contracts/job-plan";

const { beforeEach, describe, expect, it } = bunTest;
const mock = (bunTest as unknown as {
  mock: ((implementation: (...args: unknown[]) => unknown) => (...args: unknown[]) => unknown) & {
    module: (name: string, factory: () => unknown) => void;
  };
}).mock;

const notifications: unknown[][] = [];
const notifyMobileEmployees = mock(async (...args: unknown[]) => {
  notifications.push(args);
});

mock.module("@/services/mobile-notification.service", () => ({
  notifyMobileEmployees,
}));

const { DefaultJobPlanService } = await import("./job-plan.service");

const scope = {
  canViewAllUnits: true,
  canViewAssignedUnits: false,
  divisionIds: [],
  managedDivisionIds: [],
  unitIds: [],
};

const query: JobPlanGridQuery = {
  page: 1,
  limit: 20,
  search: "",
  sortBy: "taskDate",
  sortDirection: "asc",
  view: null,
  filters: [],
  date: "2026-09-02",
  window: "daily",
  mode: "all",
  dateStart: "2026-09-02",
  dateEnd: "2026-09-02",
};

describe("DefaultJobPlanService draft sync", () => {
  beforeEach(() => {
    notifications.length = 0;
  });

  it("shows mobile Redis drafts in the web list", async () => {
    const repository = {
      list: async () => ({
        rows: [],
        total: 0,
        summary: {
          totalHours: 0,
          pendingCount: 0,
          approvedCount: 0,
          overtimeCount: 0,
        },
      }),
      listReferences: async () => ({
        employees: [],
        divisions: [{ value: 7, label: "Divisi A" }],
        units: [],
        countdowns: [],
        workOrders: [],
        panels: [],
        jobTypes: [],
        statuses: [],
      }),
    };
    const redis = {
      get: async (key: string) =>
        key === "jobplan:draft:division:7"
          ? JSON.stringify({
              action: "save_draft",
              divisionId: 7,
              sourceType: "ADDITIONAL",
              items: [{
                draftItemId: "draft-mobile",
                sourceType: "ADDITIONAL",
                carId: "CAR-1",
                divisionId: 7,
                panelId: 11,
                panelName: "Panel A",
                jobTypeId: "JOB-1",
                assignedUserId: "PIC-1",
                assignedUserName: "PIC One",
                taskDate: "2026-09-02",
                targetHours: 2,
                startTime: "08:00",
                finishTime: "10:00",
                jobDescription: "Pasang panel",
                note: "Prioritas",
              }],
            })
          : null,
    };
    const service = new DefaultJobPlanService(
      repository as never,
      { log: async () => undefined } as never,
      async () => redis as never,
    );

    const result = await service.list({
      user: {
        employeeId: "EMP-1",
        fullName: "Planner",
        divisionId: null,
        scope,
      },
    } as never, query);

    expect(result.data[0]?.planId).toBe("draft-mobile");
    expect(result.data[0]?.draftSourceType).toBe("ADDITIONAL");
    expect(result.summary.totalHours).toBe(2);
  });

  it("writes web drafts to the mobile Redis key", async () => {
    const repository = {
      listReferences: async () => ({
        employees: [],
        divisions: [],
        units: [],
        countdowns: [],
        workOrders: [],
        panels: [],
        jobTypes: [],
        statuses: [],
      }),
    };
    const writes: Record<string, string> = {};
    const deleted: string[] = [];
    const redis = {
      get: async () => null,
      set: async (key: string, value: string) => {
        writes[key] = value;
      },
      del: async (key: string) => {
        deleted.push(key);
      },
    };
    const service = new DefaultJobPlanService(
      repository as never,
      { log: async () => undefined } as never,
      async () => redis as never,
    );

    await service.saveDraft({
      user: {
        employeeId: "EMP-1",
        fullName: "Planner",
        divisionId: null,
        scope,
      },
    } as never, {
      replaceItems: true,
      items: [{
        draftItemId: "draft-web",
        sourceType: "ADDITIONAL",
        coreId: null,
        carId: "CAR-1",
        unitName: "Unit A",
        divisionId: 7,
        divisionName: "Divisi A",
        panelId: 11,
        panelName: "Panel A",
        jobTypeId: "JOB-1",
        jobName: "Pasang",
        assignedUserId: "PIC-1",
        assignedUserName: "PIC One",
        taskDate: "2026-09-02",
        targetHours: 2,
        startTime: "08:00",
        finishTime: "10:00",
        jobDescription: "Pasang panel",
        note: "Prioritas",
        isOvertime: false,
        isPriority: false,
        deadlineDate: "2026-09-02",
        isRework: false,
        isNonTechnicalJob: false,
      }],
    });

    expect(JSON.parse(writes["jobplan:draft:division:7"] ?? "{}")).toMatchObject({
      action: "save_draft",
      divisionId: 7,
      sourceType: "ADDITIONAL",
      items: [{ draftItemId: "draft-web" }],
    });
    expect(deleted).toContain("jobplan:web:draft:EMP-1");
    expect(deleted).toContain("jobplan:draft:EMP-1");
  });

  it("notifies only the active submit approver for each car", async () => {
    const service = new DefaultJobPlanService({} as never, {
      log: async () => undefined,
    } as never);

    await (service as any).notifySubmittedPlans(
      ["CAR-ADV", "CAR-KP"],
      ["PLAN-1", "PLAN-2"],
      "Planner",
      [
        { carId: "CAR-ADV", advisorId: "ADV-1", kpId: "KP-1", kdId: "KD-1" },
        { carId: "CAR-KP", advisorId: null, kpId: "KP-2", kdId: "KD-2" },
      ],
    );

    expect(notifications).toEqual([
      [[
        "ADV-1",
      ], {
        title: "Job Plan Menunggu Persetujuan QA",
        body: "Planner mengajukan 1 rencana kerja yang perlu disetujui QA.",
        data: {
          module: "job_plan",
          planId: "PLAN-1",
          status: "PENDING_ADV",
        },
      }, "sm_job_plan"],
      [[
        "KP-2",
      ], {
        title: "Job Plan Menunggu Persetujuan KP",
        body: "Planner mengajukan 1 rencana kerja yang perlu disetujui KP.",
        data: {
          module: "job_plan",
          planId: "PLAN-2",
          status: "PENDING_KP",
        },
      }, "sm_job_plan"],
    ]);
  });
});
