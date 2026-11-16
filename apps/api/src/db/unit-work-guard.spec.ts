import { describe, expect, it } from "bun:test";
import assert from "node:assert/strict";
import { MySqlJobPlanRepository } from "@/repositories/job-plan/job-plan.repo";
import { CountdownRepository as MySqlCountdownRepository } from "@/repositories/countdown/countdown.repo";
import { UnitCatalogRepository as MySqlUnitCatalogRepository } from "@/repositories/units/unit-catalog.repo";
import { handleJobPlanAdditionalCountdownCreateRoute } from "@/routes/job-plan/job-plan.routes";
import { handleCountdownCreateRoute } from "@/routes/countdown/countdown.routes";
import { handleUnitCatalogPanelJobdescsRoute } from "@/routes/units/unit-catalog.routes";
import { assertUnitAcceptsNewWork } from "./unit-work-guard";

const scope = { canViewAllUnits: true, canViewAssignedUnits: false, divisionIds: [], managedDivisionIds: [], unitIds: [] };
const actor = { employeeId: "EMP-1", actorId: "EMP-1", actorName: "Tester", scope };
const additional = { carId: "CAR-1", divisionId: 4, panelId: 10, jobTypeName: "Repair", targetHours: 1,
  taskDate: "2026-10-31", deadlineDate: "2026-11-01", jobDescription: "Repair" };
const countdown = { carId: "CAR-1", divisionId: 4, sectionName: "Repair", targetHoursInitial: 1,
  startDate: "2026-10-31", deadlineDate: "2026-11-01", taskCategory: "MAIN" };

function fixture(status = "HOLD") {
  const queries: string[] = [];
  const writes: string[] = [];
  let rollbacks = 0;
  let commits = 0;
  const connection = {
    beginTransaction: async () => undefined,
    rollback: async () => { rollbacks++; },
    commit: async () => { commits++; },
    release: () => undefined,
    query: async (sql: string) => {
      queries.push(sql);
      if (/^\s*(INSERT|UPDATE|DELETE)/u.test(sql)) writes.push(sql);
      if (sql.includes("FROM cars")) return [[{ id: "CAR-1", status }]];
      if (sql.includes("FROM sm_jobdesc_countdown jc")) return [[{ coreId: "CORE-1", carId: "CAR-1", panelId: 10, divisionId: 4, currentStatus: "PLAN", remainingHours: 8 }]];
      if (sql.includes("FROM master_panels")) return [[{ id: 10 }]];
      if (sql.includes("FROM sm_jobdesc_plan p")) return [[{ total: 0 }]];
      if (sql.includes("FROM master_job_types")) return [[{ id: "TYPE-1" }]];
      return [[]];
    },
    execute: async (sql: string) => { writes.push(sql); return [{}]; },
  };
  return { connection, queries, writes, get rollbacks() { return rollbacks; }, get commits() { return commits; } };
}

describe("unit HOLD creation boundary", () => {
  it("rejects additional countdown creation without writing job types, countdowns or plans", async () => {
    const f = fixture(" hold ");
    const repo = new MySqlJobPlanRepository(() => ({ getConnection: async () => f.connection }) as never);
    await assert.rejects(() => repo.createAdditionalCountdown(actor, additional as never), /UNIT_ON_HOLD/u);
    expect(f.writes).toEqual([]);
    expect(f.rollbacks).toBe(1);
    expect(f.commits).toBe(0);
    expect(f.queries.some((sql) => sql.includes("FROM cars") && sql.includes("FOR UPDATE"))).toBe(true);
  });

  it("allows work on an active unit while locking its status row", async () => {
    const f = fixture("In_Progress");
    await assertUnitAcceptsNewWork(f.connection as never, "CAR-1");
    expect(f.writes).toEqual([]);
    expect(f.queries.some((sql) => sql.includes("FROM cars") && sql.includes("FOR UPDATE"))).toBe(true);
  });

  it("rejects direct countdown creation before any insert", async () => {
    const f = fixture();
    const repo = new MySqlCountdownRepository(() => ({ getConnection: async () => f.connection }) as never);
    await assert.rejects(() => repo.createCountdown(actor, countdown as never), /UNIT_ON_HOLD/u);
    expect(f.writes).toEqual([]);
    expect(f.rollbacks).toBe(1);
  });

  it("rejects Master Panel jobdesc creation before any insert", async () => {
    const f = fixture();
    const repo = new MySqlUnitCatalogRepository(() => ({ getConnection: async () => f.connection }) as never, {} as never);
    repo.getPanel = async () => ({ id: 10 }) as never;
    await assert.rejects(() => repo.createPanelJobdescs("CAR-1", 10, { jobs: [{}] } as never), /UNIT_ON_HOLD/u);
    expect(f.writes).toEqual([]);
    expect(f.rollbacks).toBe(1);
  });

  it("rejects import rows from held units while retaining per-row rejection reporting", async () => {
    const f = fixture();
    const repo = new MySqlCountdownRepository(() => ({ getConnection: async () => f.connection }) as never);
    const result = await repo.createCountdownImports(actor, [{ ...countdown, rowNumber: 2 }] as never);
    expect(result.inserted).toBe(0);
    expect(result.rejected).toBe(1);
    expect(result.issues[0]?.message).toContain("HOLD");
    expect(f.writes).toEqual([]);
  });

  it("maps plan, countdown and Master Panel creation conflicts to HTTP 409", async () => {
    const auth = { getCurrentSession: async () => ({ user: { employeeId: "EMP-1", scope, permissions: ["UPDATE_PLAN", "CREATE_COUNTDOWN", "CREATE_TASK", "UNIT_CATALOG_CREATE_JOBDESC"] } }) } as never;
    const request = (body: unknown) => new Request("http://localhost/api/create", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const held = async () => { throw new Error("UNIT_ON_HOLD"); };
    const responses = await Promise.all([
      handleJobPlanAdditionalCountdownCreateRoute(request(additional), auth, { createAdditionalCountdown: held } as never),
      handleCountdownCreateRoute(request(countdown), auth, { create: held } as never),
      handleUnitCatalogPanelJobdescsRoute(request({ jobs: [{ divisionId: 4, jobTypeId: "TYPE-1", picPlan: "EMP-1", targetHoursInitial: 1, description: "Repair" }] }), "CAR-1", 10, auth, { createPanelJobdescs: held } as never),
    ]);
    for (const response of responses) {
      expect(response.status).toBe(409);
      expect((await response.json()).errorCode).toBe("UNIT_ON_HOLD");
    }
  });
});
