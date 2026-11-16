import { describe, expect, it } from "bun:test";
import assert from "node:assert/strict";
import { MySqlJobPlanRepository } from "./job-plan.repo";

const scope = {
  canViewAllUnits: true,
  canViewAssignedUnits: false,
  divisionIds: [],
  managedDivisionIds: [],
  unitIds: [],
};

describe("MySqlJobPlanRepository countdown alignment", () => {
  it("rejects an out-of-scope existing Additional Countdown before provisioning", async () => {
    const mutations: string[] = [];
    let committed = false;
    let rolledBack = false;
    const connection = {
      beginTransaction: async () => undefined,
      commit: async () => { committed = true; },
      rollback: async () => { rolledBack = true; },
      release: () => undefined,
      query: async (sql: string) => {
        if (/INSERT|UPDATE|DELETE/u.test(sql)) mutations.push(sql);
        if (sql.includes("FROM cars c")) return [[{ carId: "CAR-1", panelId: 11,
          divisionId: 10, jobTypeId: "JOB-1", panelName: "Panel A", jobName: "Repair" }]];
        if (sql.includes("FROM master_job_types")) return [[{ id: "JOB-1", isTechnical: 1 }]];
        if (sql.includes("job_type_id = ?")) return [[{ coreId: "CD-OPEN" }]];
        if (sql.includes("WHERE jc.id = ?")) return [[{ coreId: "CD-OPEN", divisionId: 10 }]];
        return [[{ status: "In_Progress" }]];
      },
      execute: async (sql: string) => { mutations.push(sql); return [{}]; },
    };
    const repository = new MySqlJobPlanRepository(() => ({ getConnection: async () => connection }) as never);
    await assert.rejects(repository.createAdditionalCountdown({ employeeId: "OUTSIDE", scope: {
      ...scope, canViewAllUnits: false, canViewAssignedUnits: false,
    } }, { taskDate: "2026-11-13", deadlineDate: "2026-11-13", carId: "CAR-1", divisionId: 10,
      panelId: 11, jobTypeId: "JOB-1", jobTypeName: "Repair", targetHours: 1,
      jobDescription: "Repair", note: null, initialFinding: null, isNonTechnicalJob: false,
      picPlan: "EMP-1", requiredGrade: null }), /SCOPE_FORBIDDEN/u);
    expect(mutations).toEqual([]);
    expect(committed).toBe(false);
    expect(rolledBack).toBe(true);
  });

  it("filters countdown choices by available plan hours", async () => {
    const statements: string[] = [];
    const repository = new MySqlJobPlanRepository(() => ({
      query: async (sql: string) => {
        statements.push(sql);
        return [[]];
      },
    }) as never);

    await repository.listReferences({
      employeeId: "EMP-1",
      scope,
      mode: "all",
    });

    const countdownSql = statements.find((sql) =>
      sql.includes("FROM sm_jobdesc_countdown jc"),
    ) ?? "";
    expect(countdownSql).toContain("availablePlanHours");
    expect(countdownSql).toContain("planCapacity.reservedPlanHours");
    expect(countdownSql).toContain("> 0");
    expect(countdownSql).toContain("'READY_QC'");
    expect(countdownSql).toContain("'QC_READY'");
    expect(countdownSql).toContain("'REJECTED'");
    expect(countdownSql.includes("AND COALESCE(jc.remaining_hours, 0) > 0")).toBe(false);
  });

  it("loads jobdesc options by hierarchy without the broad plan capacity scan", async () => {
    const statements: string[] = [];
    const repository = new MySqlJobPlanRepository(() => ({
      query: async (sql: string) => {
        statements.push(sql);
        return [[]];
      },
    }) as never);

    await repository.listOptions({
      employeeId: "EMP-1",
      scope,
      kind: "jobdesc",
      divisionId: 10,
      unitId: "CAR-1",
      panelId: 11,
    });

    const sql = statements[0] ?? "";
    expect(sql).toContain("jc.car_id = ?");
    expect(sql).toContain("jc.panel_id = ?");
    expect(sql).toContain("jc.division_id = ?");
    expect(sql).toContain("'READY_QC'");
    expect(sql).toContain("'QC_READY'");
    expect(sql).toContain("'REJECTED'");
    expect(sql).toContain("p2.core_id = jc.id");
    expect(sql.includes("planCapacity")).toBe(false);
  });

  it("loads every master panel for a unit, including panels without a countdown", async () => {
    const statements: string[] = [];
    const repository = new MySqlJobPlanRepository(() => ({
      query: async (sql: string) => {
        statements.push(sql);
        return [[]];
      },
    }) as never);

    await repository.listOptions({
      employeeId: "EMP-1",
      scope,
      kind: "panels",
      unitId: "CAR-1",
      componentName: "RUANG MESIN",
    });

    const sql = statements[0] ?? "";
    expect(sql).toContain("FROM master_panels mp");
    expect(sql).toContain("mp.car_id = ?");
    expect(sql).toContain("UPPER(TRIM(mp.component_name)) = UPPER(?)");
    expect(sql.includes("FROM sm_jobdesc_countdown jc\n")).toBe(false);
    expect(sql.includes("LIMIT 300")).toBe(false);
  });

  it("exposes every panel of a car even when no countdown points at that panel yet", async () => {
    const statements: string[] = [];
    const repository = new MySqlJobPlanRepository(() => ({
      query: async (sql: string) => {
        statements.push(sql);
        return [[]];
      },
    }) as never);

    await repository.listOptions({
      employeeId: "EMP-1",
      scope: { ...scope, canViewAllUnits: false, divisionIds: [10] },
      kind: "panels",
      divisionId: 10,
      unitId: "CAR-1",
    });

    const sql = statements[0] ?? "";
    expect(sql).toContain("FROM master_panels mp");
    expect(sql).toContain("jc_panel.car_id = mp.car_id");
    expect(sql.includes("jc_panel.panel_id = mp.id")).toBe(false);
    expect(sql).toContain("jc_panel.division_id = ?");
  });

  it("resolves an additional job name and reuses an open countdown without writing a plan", async () => {
    const queries: Array<{ sql: string; params?: unknown[] }> = [];
    const executed: Array<{ sql: string; params?: unknown[] }> = [];
    const connection = {
      beginTransaction: async () => undefined,
      commit: async () => undefined,
      rollback: async () => undefined,
      release: () => undefined,
      query: async (sql: string, params?: unknown[]) => {
        queries.push({ sql, params });
        if (sql.includes("UPPER(job_name)")) return [[]];
        if (sql.includes("INSERT INTO master_job_types")) return [{}];
        if (sql.includes("FROM master_job_types mjt")) return [[{ id: "JOB-NEW" }]];
        if (sql.includes("FROM cars c")) {
          return [[{
            carId: "CAR-1",
            unitName: "Unit A",
            panelId: 11,
            panelName: "Panel A",
            divisionId: 10,
            divisionName: "BODY WORK",
            jobTypeId: "JOB-NEW",
            jobName: "Repair baru",
          }]];
        }
        if (sql.includes("FROM sm_jobdesc_countdown") && sql.includes("job_type_id = ?")) {
          return [[{ coreId: "CD-OPEN" }]];
        }
        if (sql.includes("FROM sm_jobdesc_countdown jc") && sql.includes("WHERE jc.id = ?")) {
          return [[{
            coreId: "CD-OPEN",
            carId: "CAR-1",
            unitName: "Unit A",
            divisionId: 10,
            divisionName: "BODY WORK",
            panelId: 11,
            remainingHours: 8,
            progressPercent: 0,
            currentStatus: "PLAN",
          }]];
        }
        if (sql.includes("FROM sm_car_panel_status")) return [[]];
        if (sql.includes("FROM sm_jobdesc_plan p")) return [[{ total: 0 }]];
        if (sql.includes("FROM car_project_assignment")) return [[]];
        return [[]];
      },
      execute: async (sql: string, params?: unknown[]) => {
        executed.push({ sql, params });
        return [{}];
      },
    };
    const repository = new MySqlJobPlanRepository(() => ({ getConnection: async () => connection }) as never);

    const result = await repository.createAdditionalCountdown(
      { employeeId: "EMP-1", scope },
      {
        taskDate: "2026-09-01", deadlineDate: "2026-09-01",
        carId: "CAR-1", divisionId: 10, panelId: 11,
        jobTypeId: null, jobTypeName: "Repair baru", targetHours: 2,
        jobDescription: "Repair baru", note: null, initialFinding: null,
        isNonTechnicalJob: false, picPlan: "EXECUTOR-1", requiredGrade: null,
      },
    );

    expect(queries.some(({ sql }) => sql.includes("INSERT INTO master_job_types"))).toBe(true);
    const additionalLookupSql = queries.find(({ sql }) => sql.includes("FROM sm_jobdesc_countdown") && sql.includes("job_type_id = ?"))?.sql ?? "";
    expect(additionalLookupSql).toContain("'READY_QC'");
    expect(additionalLookupSql).toContain("'QC_READY'");
    expect(additionalLookupSql).toContain("'REJECTED'");
    expect(executed.some(({ sql }) => sql.includes("INSERT INTO sm_jobdesc_countdown"))).toBe(false);
    expect(result.coreId).toBe("CD-OPEN");
    expect(result.isNewCore).toBe(false);
    expect(executed.some(({ sql }) => sql.includes("INSERT INTO sm_jobdesc_plan"))).toBe(false);
  });
});


describe("MySqlJobPlanRepository durable QC rework drafts", () => {
  it("loads only the current scoped QC draft with authoritative Countdown and inspection IDs", async () => {
    let statement = "";
    let values: unknown[] = [];
    const repository = new MySqlJobPlanRepository(() => ({ query: async (sql: string, params: unknown[]) => {
      statement = sql; values = params;
      return [[{ qcId: "QC-1", coreId: "CORE-1", qcNotes: JSON.stringify({
        notes: "Rapikan", jobPlanDraftState: "DRAFT", jobPlanDraft: {
          draftItemId: "untrusted-id", coreId: "untrusted-core", targetHours: 70 / 60,
        },
      }) }]];
    } }) as never);
    const drafts = await repository.listQcReworkDrafts({ employeeId: "KD-1", scope: {
      ...scope, canViewAllUnits: false, divisionIds: [7],
    }, divisionIds: [7] });
    expect(drafts).toEqual([{ draftItemId: "qc-rework:QC-1", coreId: "CORE-1", targetHours: 70 / 60 }]);
    expect(statement).toContain("jc.ref_rework_qc_id = q.id");
    expect(statement).toContain("JSON_VALID(q.qc_notes)");
    expect(statement).toContain("$.jobPlanDraftState");
    expect(statement).toContain("jc.division_id IN (?)");
    expect(statement).toContain("p_scope.assigned_user_id = ?");
    expect(values).toContain("KD-1");
    expect(values.filter((value) => value === 7).length >= 2).toBe(true);
  });

  it("allows scoped cleanup only after native cancellation consumed the QC draft", async () => {
    const statements: Array<{ sql: string; values: unknown[] }> = [];
    const repository = new MySqlJobPlanRepository(() => ({ query: async (sql: string, values: unknown[]) => {
      statements.push({ sql, values });
      return [[{ qcId: "QC-1", draftState: "DISMISSED" }]];
    } }) as never);
    const consumedIds = await repository.dismissQcReworkDrafts({ employeeId: "KD-1", scope: {
      ...scope, canViewAllUnits: false, divisionIds: [7],
    }, draftItemIds: ["ordinary-draft", "qc-rework:QC-1"] });
    expect(consumedIds).toEqual(["qc-rework:QC-1"]);
    expect(statements.length).toBe(1);
    expect(statements[0]?.sql.trim().startsWith("SELECT")).toBe(true);
    expect(statements[0]?.sql).toContain("p_scope.assigned_user_id = ?");
    expect(statements[0]?.values).toContain("QC-1");
    expect(statements[0]?.values.includes("ordinary-draft")).toBe(false);
    expect(statements[0]?.values).toContain("KD-1");
  });
  it("refuses direct dismissal of every active QC draft, including an unlinked intent", async () => {
    const statements: string[] = [];
    const repository = new MySqlJobPlanRepository(() => ({ query: async (sql: string) => {
      statements.push(sql);
      return [[{ qcId: "QC-1", draftState: "DRAFT" }]];
    } }) as never);
    await assert.rejects(repository.dismissQcReworkDrafts({ employeeId: "QA-1", scope,
      draftItemIds: ["qc-rework:QC-1"] }), /QC_REWORK_DRAFT_LINKED/u);
    expect(statements.length).toBe(1);
    expect(statements[0]?.trim().startsWith("SELECT")).toBe(true);
  });

  it("saves mutable fields under the scoped lock and preserves source and canonical linkage", async () => {
    const statements: Array<{ sql: string; values: unknown[] }> = [];
    const events: string[] = [];
    const original = { draftItemId: "qc-rework:QC-1", coreId: "CORE-1", carId: "CAR-1", divisionId: 7,
      isRework: true, linkedPlanId: "PLAN-REAL", linkedPlanVersion: 2, targetHours: 1 };
    const envelope = { notes: "Human QC note", workActualId: "ACTUAL-1", extensionHours: .5,
      jobPlanDraftState: "DRAFT", jobPlanDraft: original };
    const connection = {
      beginTransaction: async () => { events.push("begin"); },
      query: async (sql: string, values: unknown[]) => {
        statements.push({ sql, values });
        return [[{ qcId: "QC-1", coreId: "CORE-1", qcNotes: JSON.stringify(envelope) }]];
      },
      execute: async (sql: string, values: unknown[]) => { statements.push({ sql, values }); return [{}]; },
      commit: async () => { events.push("commit"); }, rollback: async () => { events.push("rollback"); },
      release: () => { events.push("release"); },
    };
    const repository = new MySqlJobPlanRepository(() => ({ getConnection: async () => connection }) as never);
    const saved = await repository.saveQcReworkDrafts({ employeeId: "KD-1", scope: { ...scope,
      canViewAllUnits: false, divisionIds: [7] }, items: [{ ...original, linkedPlanId: "FORGED",
        linkedPlanVersion: 99, carId: "FORGED-CAR", divisionId: 99, targetHours: .5, note: "KD edit" }] as never });
    expect(saved).toEqual([{ ...original, targetHours: .5, note: "KD edit", sourceType: "COUNTDOWN" }]);
    expect(statements[0]?.sql).toContain("FOR UPDATE");
    expect(statements[0]?.sql).toContain("jc.ref_rework_qc_id = q.id");
    expect(statements[0]?.values).toContain("KD-1");
    const persisted = JSON.parse(String(statements[1]?.values[0]));
    expect(persisted.notes).toBe("Human QC note");
    expect(persisted.workActualId).toBe("ACTUAL-1");
    expect(persisted.extensionHours).toBe(.5);
    expect(events).toEqual(["begin", "commit", "release"]);
  });

  it("rolls back without saving forged or missing QC draft identities", async () => {
    for (const rows of [[], [{ qcId: "QC-1", coreId: "OTHER", qcNotes: JSON.stringify({ notes: "QC",
      jobPlanDraftState: "DRAFT", jobPlanDraft: {} }) }]]) {
      const events: string[] = [];
      const repository = new MySqlJobPlanRepository(() => ({ getConnection: async () => ({
        beginTransaction: async () => undefined, query: async () => [rows],
        execute: async () => { events.push("write"); }, commit: async () => { events.push("commit"); },
        rollback: async () => { events.push("rollback"); }, release: () => { events.push("release"); },
      }) }) as never);
      await assert.rejects(repository.saveQcReworkDrafts({ employeeId: "KD-1", scope,
        items: [{ draftItemId: "qc-rework:QC-1", coreId: "CORE-1" }] as never }), /DRAFT_NOT_FOUND|SCOPE_FORBIDDEN/u);
      expect(events).toEqual(["rollback", "release"]);
    }
  });

});
