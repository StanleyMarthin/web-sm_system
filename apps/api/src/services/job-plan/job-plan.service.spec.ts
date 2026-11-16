import * as bunTest from "bun:test";
import assert from "node:assert/strict";
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

mock.module("@/services/notifications/mobile-notification.service", () => ({
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
      listDraftReferences: async () => ({
        countdowns: new Map([
          ["CORE-1", {
            value: "CORE-1",
            label: "Unit A · Panel A · 4j",
            carId: "CAR-1",
            panelId: 11,
            divisionId: 7,
            unitName: "Unit A",
            divisionName: "Divisi A",
            panelName: "Panel A",
            panelSectionName: "Panel A",
            jobName: "Pasang panel",
            qaIds: [],
            qaNames: [],
            targetTotalHours: 4,
            remainingHours: 4,
            availablePlanHours: 4,
            progressPercent: 0,
          }],
        ]),
        panels: new Map([[11, { panelName: "Panel A", componentName: null, partName: "Panel A" }]]),
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
                operationalPlanId: "PLAN-FROM-MOBILE",
                version: 7,
                sourceType: "ADDITIONAL",
                coreId: "CORE-1",
                carId: "CAR-1",
                divisionId: 7,
                panelId: 11,
                jobTypeId: "JOB-1",
                assignedUserId: "PIC-1",
                assignedUserName: "PIC One",
                taskDate: "2026-09-02",
                targetHours: 2,
                startTime: "08:00",
                finishTime: "10:00",
                jobDescription: "Pasang panel",
                note: "Prioritas",
                urgent: true,
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
    expect(result.data[0]?.draftLinkedPlanId).toBe("PLAN-FROM-MOBILE");
    expect(result.data[0]?.draftSourceType).toBe("ADDITIONAL");
    expect(result.data[0]?.draftUrgent).toBe(true);
    expect(result.data[0]?.divisionName).toBe("Divisi A");
    expect(result.data[0]?.panelName).toBe("Panel A");
    expect(result.data[0]?.remainingHours).toBe(4);
    expect(result.summary.totalHours).toBe(2);
  });

  it("keeps list available when Redis draft cache is down", async () => {
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
    const service = new DefaultJobPlanService(
      repository as never,
      { log: async () => undefined } as never,
      async () => {
        throw new Error("REDIS_DOWN");
      },
    );

    const result = await service.list({
      user: {
        employeeId: "EMP-1",
        fullName: "Planner",
        divisionId: null,
        scope,
      },
    } as never, query);

    expect(result.data).toEqual([]);
    expect(result.meta.total).toBe(0);
  });

  it("caches hierarchy options", async () => {
    let calls = 0;
    const repository = {
      listOptions: async () => {
        calls += 1;
        return [{ value: "10", label: "BODY WORK" }];
      },
    };
    const store = new Map<string, string>();
    const redis = {
      get: async (key: string) => store.get(key) ?? null,
      set: async (key: string, value: string) => {
        store.set(key, value);
      },
    };
    const service = new DefaultJobPlanService(
      repository as never,
      { log: async () => undefined } as never,
      async () => redis as never,
    );
    const session = {
      user: {
        employeeId: "EMP-1",
        scope,
      },
    } as never;

    await service.listOptions(session, { kind: "divisions" });
    await service.listOptions(session, { kind: "divisions" });

    expect(calls).toBe(1);
  });

  it("keeps component-scoped and unit-wide panel options under separate cache keys", async () => {
    const calls: Array<string | null | undefined> = [];
    const repository = {
      listOptions: async (params: { componentName?: string | null }) => {
        calls.push(params.componentName);
        return [{ value: String(calls.length), label: `panel-${calls.length}` }];
      },
    };
    const store = new Map<string, string>();
    const redis = {
      get: async (key: string) => store.get(key) ?? null,
      set: async (key: string, value: string) => {
        store.set(key, value);
      },
    };
    const service = new DefaultJobPlanService(
      repository as never,
      { log: async () => undefined } as never,
      async () => redis as never,
    );
    const session = {
      user: {
        employeeId: "EMP-1",
        scope,
      },
    } as never;

    await service.listOptions(session, { kind: "panels", unitId: "CAR-1", componentName: " RUANG MESIN " });
    await service.listOptions(session, { kind: "panels", unitId: "CAR-1", componentName: null });
    await service.listOptions(session, { kind: "panels", unitId: "CAR-1", componentName: "ruang mesin" });

    expect(calls).toEqual([" RUANG MESIN ", null]);
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
});


describe("DefaultJobPlanService durable QC rework drafts", () => {
  const draft = {
    draftItemId: "qc-rework:QC-1", sourceType: "COUNTDOWN", coreId: "CORE-1",
    carId: "CAR-1", unitName: "Unit A", divisionId: 7, divisionName: "Divisi A",
    panelId: 11, panelName: "Panel A", jobTypeId: null, jobName: "Perbaikan",
    assignedUserId: "PIC-1", assignedUserName: "PIC One", taskDate: "2026-09-02",
    targetHours: 1, startTime: "08:00", finishTime: "09:00", jobDescription: "Perbaikan QC",
    note: "Rapikan hasil", isOvertime: false, isPriority: false, deadlineDate: null,
    isRework: true, isNonTechnicalJob: false,
  };
  const session = { user: { employeeId: "EMP-1", fullName: "Planner", divisionId: 7, scope } } as never;
  function repository(activeDrafts: unknown[] = [draft]) {
    return {
      list: async () => ({ rows: [], total: 0, summary: { totalHours: 0, pendingCount: 0, approvedCount: 0, overtimeCount: 0 } }),
      listReferences: async () => ({ employees: [], divisions: [{ value: 7, label: "Divisi A" }], units: [], countdowns: [], workOrders: [], panels: [], jobTypes: [], statuses: [] }),
      listQcReworkDrafts: async () => activeDrafts,
    };
  }

  it("keeps a committed QC draft visible while Redis is unavailable", async () => {
    const service = new DefaultJobPlanService(repository() as never, { log: async () => undefined } as never,
      async () => { throw new Error("REDIS_DOWN"); });
    const result = await service.list(session, query);
    expect(result.data.map((row) => row.planId)).toEqual([draft.draftItemId]);
    expect(result.data[0]?.draftIsRework).toBe(true);
    expect(result.data[0]?.coreId).toBe("CORE-1");
  });

  it("ignores an old Redis edit when the durable QC draft is authoritative", async () => {
    const service = new DefaultJobPlanService(repository() as never, { log: async () => undefined } as never,
      async () => ({ get: async (key: string) => key === "jobplan:draft:division:7"
        ? JSON.stringify({ items: [{ ...draft, note: "Diubah KD", targetHours: 0.5 }] }) : null }) as never);
    const result = await service.list(session, query);
    expect(result.data.length).toBe(1);
    expect(result.data[0]?.note).toBe("Rapikan hasil");
    expect(result.data[0]?.targetHours).toBe(1);
  });

  it("does not resurrect a consumed QC draft from stale Redis", async () => {
    const service = new DefaultJobPlanService(repository([]) as never, { log: async () => undefined } as never,
      async () => ({ get: async () => JSON.stringify({ items: [draft] }) }) as never);
    const result = await service.list(session, query);
    expect(result.data).toEqual([]);
  });

  it("checks native draft consumption before deleting its cached copy", async () => {
    const events: string[] = [];
    const service = new DefaultJobPlanService({ ...repository(),
      dismissQcReworkDrafts: async (params: { draftItemIds: string[] }) => {
        expect(params.draftItemIds).toEqual([draft.draftItemId]); events.push("dismiss"); return params.draftItemIds;
      },
    } as never, { log: async () => undefined } as never, async () => ({
      get: async () => null, del: async () => { events.push("cache-delete"); },
      set: async () => undefined,
    }) as never);
    await service.deleteDrafts(session, { draftItemIds: [draft.draftItemId] });
    expect(events[0]).toBe("dismiss");
    expect(events).toContain("cache-delete");
  });
  it("allows cleanup after native submission consumed a durable QC draft", async () => {
    const service = new DefaultJobPlanService({ ...repository([]),
      dismissQcReworkDrafts: async () => [draft.draftItemId],
    } as never, { log: async () => undefined } as never, async () => ({
      get: async () => null, del: async () => undefined, set: async () => undefined,
    }) as never);
    const result = await service.deleteDrafts(session, { draftItemIds: [draft.draftItemId] });
    expect(result.deletedPlanId).toBe(draft.draftItemId);
  });

  it("rejects deletion when neither cache nor scoped QC metadata contains the draft", async () => {
    const service = new DefaultJobPlanService({ ...repository([]),
      dismissQcReworkDrafts: async () => [],
    } as never, { log: async () => undefined } as never, async () => ({ get: async () => null }) as never);
    await assert.rejects(service.deleteDrafts(session, { draftItemIds: ["qc-rework:OTHER"] }), /DRAFT_NOT_FOUND/u);
  });

  it("keeps canonical linkage and source identity authoritative over Redis edits", async () => {
    const service = new DefaultJobPlanService(repository([{ ...draft, linkedPlanId: "PLAN-A", version: 3 }]) as never,
      { log: async () => undefined } as never, async () => ({ get: async () => JSON.stringify({ items: [{
        ...draft, coreId: "OTHER-CORE", linkedPlanId: "PLAN-FORGED", linkedPlanVersion: 99,
      }] }) }) as never);
    const result = await service.list(session, query);
    expect(result.data[0]?.coreId).toBe("CORE-1");
    expect(result.data[0]?.draftLinkedPlanId).toBe("PLAN-A");
    expect(result.data[0]?.draftLinkedPlanVersion).toBe(3);
  });

  it("persists edited QC fields before a failed cache write and reloads SQL over stale Redis", async () => {
    let durable = { ...draft };
    const events: string[] = [];
    const repo = {
      ...repository(),
      listQcReworkDrafts: async () => [durable],
      listReferences: async () => ({ employees: [], divisions: [{ value: 7, label: "Divisi A" }],
        units: [], countdowns: [{ value: "CORE-1", remainingHours: 2, availablePlanHours: 2 }],
        workOrders: [], panels: [], jobTypes: [], statuses: [] }),
      saveQcReworkDrafts: async (params: { items: Array<typeof draft> }) => {
        events.push("sql-save"); durable = { ...durable, ...params.items[0] }; return [durable];
      },
    };
    const service = new DefaultJobPlanService(repo as never, { log: async () => undefined } as never,
      async () => ({ get: async () => JSON.stringify({ items: [draft] }),
        del: async () => { events.push("cache-write"); throw new Error("REDIS_DOWN"); } }) as never);
    await assert.rejects(service.saveDraft(session, { replaceItems: false,
      items: [{ ...draft, note: "Revisi KD", targetHours: .5 }] } as never), /REDIS_DOWN/u);
    expect(events[0]).toBe("sql-save");
    expect(events.slice(1).every((event) => event === "cache-write")).toBe(true);
    const result = await service.list(session, query);
    expect(result.data[0]?.note).toBe("Revisi KD");
    expect(result.data[0]?.targetHours).toBe(.5);
  });

});


describe("supplemental member draft scope", () => {
  const member = { user: { employeeId: "EMP-1", fullName: "Member", divisionId: 7,
    permissions: ["TASK_EXECUTE"], scope: { ...scope, canViewAllUnits: false, divisionIds: [7] } } };
  const request = { draftItemId: "request-1", sourceType: "COUNTDOWN", coreId: "CORE-1",
    carId: "CAR-1", divisionId: 7, assignedUserId: "EMP-1", taskDate: "2026-11-14",
    targetHours: 2, startTime: "08:00", finishTime: "10:00", jobDescription: "Pasang panel",
    note: "[Penggantian] Unit sebelumnya ditahan", urgent: true };
  function fixture() {
    const data = new Map([["jobplan:draft:division:7", JSON.stringify({ items: [{ ...request, draftItemId: "KD-draft", urgent: false }] })]]);
    const repository = { listReferences: async () => ({ countdowns: [{ value: "CORE-1", remainingHours: 8 }],
      employees: [], divisions: [], panels: [], jobTypes: [] }) };
    const redis = { get: async (key: string) => data.get(key) ?? null,
      set: async (key: string, value: string) => { data.set(key, value); }, del: async (key: string) => { data.delete(key); } };
    const service = new DefaultJobPlanService(repository as never, { log: async () => undefined } as never, async () => redis as never);
    return { service, data };
  }
  it("stores own supplemental requests without touching shared division drafts", async () => {
    const { service, data } = fixture();
    const shared = data.get("jobplan:draft:division:7");
    data.set("jobplan:draft:EMP-1", JSON.stringify({ items: [{ ...request, draftItemId: "older-normal-draft", urgent: false }] }));
    await service.saveDraft(member as never, { replaceItems: true, items: [request] } as never);
    expect(data.get("jobplan:draft:division:7")).toBe(shared);
    const personalItems = JSON.parse(data.get("jobplan:draft:EMP-1")!).items as Array<Record<string, unknown>>;
    expect(personalItems.find((item) => item.draftItemId === "request-1")).toMatchObject({ urgent: true, assignedUserId: "EMP-1" });
    expect(personalItems.find((item) => item.draftItemId === "older-normal-draft")).toMatchObject({ urgent: false });
  });
  it("rejects normal plans, other PICs, other divisions and empty reasons for member requests", async () => {
    for (const patch of [{ urgent: false }, { assignedUserId: "EMP-2" }, { divisionId: 8 }, { note: " " }, { draftItemId: "qc-rework:foreign" }]) {
      const { service } = fixture();
      await assert.rejects(service.saveDraft(member as never, { replaceItems: false, items: [{ ...request, ...patch }] } as never), /SCOPE_FORBIDDEN/);
    }
  });
  it("requires the own PIC for creating an additional Countdown", async () => {
    const { service } = fixture();
    await assert.rejects(service.createAdditionalCountdown(member as never, { urgent: true, picPlan: "EMP-2", divisionId: 7, note: "Extra" } as never), /SCOPE_FORBIDDEN/);
  });
});
