import { describe, expect, it } from "bun:test";
import { rejects } from "node:assert/strict";
import { createJobPlanAdditionalCountdownRequestSchema } from "@smsystem/contracts/job-plan";
import { MySqlJobPlanRepository } from "./job-plan.repo";

const scope = { canViewAllUnits: true, canViewAssignedUnits: false, divisionIds: [], managedDivisionIds: [], unitIds: [] };
const actor = { employeeId: "EMP-1", actorId: "EMP-1", actorName: "Tester", scope };

function harness(input: { existingType?: unknown; selectedId?: boolean; duplicateType?: unknown; missingPanel?: boolean } = {}) {
  const statements: Array<{ sql: string; values: unknown[] }> = [];
  let rolledBack = false;
  let committed = false;
  let coreId = "CD-1";
  let insertedJobType = "JOB-1";
  let insertAttempted = false;
  const connection = {
    beginTransaction: async () => undefined,
    commit: async () => { committed = true; },
    rollback: async () => { rolledBack = true; },
    release: () => undefined,
    query: async (sql: string, values: unknown[] = []) => {
      statements.push({ sql, values });
      if (sql.includes("UPPER(job_name)")) {
        if (input.existingType !== undefined) return [[{ id: "JOB-EXISTING", isTeknis: input.existingType }]];
        if (insertAttempted && input.duplicateType !== undefined) return [[{ id: "JOB-WINNER", isTeknis: input.duplicateType }]];
        return [[]];
      }
      if (sql.includes("INSERT INTO master_job_types")) {
        insertAttempted = true;
        insertedJobType = String(values[0]);
        if (input.duplicateType !== undefined) throw Object.assign(new Error("Duplicate name"), { code: "ER_DUP_ENTRY" });
        return [{}];
      }
      if (sql.includes("FROM master_job_types") && !sql.includes("FROM master_job_types mjt")) {
        return [[{ id: values[0], isTeknis: input.existingType !== undefined ? input.existingType : input.duplicateType ?? 0 }]];
      }
      if (sql.includes("FROM master_job_types mjt")) return [[{ id: insertedJobType }]];
      if (sql.includes("FROM cars c")) return [input.missingPanel ? [] : [{
        carId: "CAR-1", unitName: "Unit A", panelId: 11, panelName: "Panel A",
        divisionId: 10, divisionName: "BODY WORK", jobTypeId: insertedJobType, jobName: "Cleanup",
      }]];
      if (sql.includes("FROM sm_jobdesc_countdown jc")) return [[{
        coreId, carId: "CAR-1", unitName: "Unit A", panelId: 11,
        divisionId: 10, divisionName: "BODY WORK", remainingHours: 8,
        currentStatus: "PLAN", progressPercent: 0,
      }]];
      return [[]];
    },
    execute: async (sql: string, values: unknown[] = []) => {
      statements.push({ sql, values });
      if (sql.includes("INSERT INTO sm_jobdesc_countdown")) coreId = String(values[0]);
      return [{}];
    },
  };
  const repository = new MySqlJobPlanRepository(() => ({ getConnection: async () => connection }) as never);
  const request = createJobPlanAdditionalCountdownRequestSchema.parse({
    carId: "CAR-1", divisionId: 10, panelId: 11, jobTypeId: input.selectedId ? "JOB-SELECTED" : null,
    jobTypeName: "Cleanup", taskDate: "2026-11-04", deadlineDate: "2026-11-04",
    targetHours: 1, jobDescription: "Cleanup", isNonTechnicalJob: true,
  });
  return { repository, statements, request, rollback: () => rolledBack, commit: () => committed };
}

describe("additional Job Plan nontechnical classification", () => {
  it("keeps the nontechnical request flag and defaults old callers to technical", () => {
    const { request } = harness();
    expect(request.isNonTechnicalJob).toBe(true);
    const { isNonTechnicalJob: _flag, ...legacy } = request;
    expect(createJobPlanAdditionalCountdownRequestSchema.parse(legacy).isNonTechnicalJob).toBe(false);
    expect(createJobPlanAdditionalCountdownRequestSchema.safeParse({ ...legacy, isNonTechnicalJob: "true" }).success).toBe(false);
  });

  it("creates a nontechnical job type and its countdown without changing another job type", async () => {
    const h = harness();
    await h.repository.createAdditionalCountdown(actor, h.request);
    const insert = h.statements.find(({ sql }) => sql.includes("INSERT INTO master_job_types"));
    expect(insert?.values[3]).toBe(0);
    expect(h.statements.some(({ sql }) => sql.includes("INSERT INTO sm_jobdesc_countdown"))).toBe(true);
    expect(h.statements.some(({ sql }) => /UPDATE\s+master_job_types/u.test(sql))).toBe(false);
    expect(h.commit()).toBe(true);
  });

  it("keeps the technical default for a new job type", async () => {
    const h = harness();
    await h.repository.createAdditionalCountdown(actor, { ...h.request, isNonTechnicalJob: false });
    expect(h.statements.find(({ sql }) => sql.includes("INSERT INTO master_job_types"))?.values[3]).toBe(1);
  });

  it("reuses a matching nontechnical name without inserting another job type", async () => {
    const h = harness({ existingType: 0 });
    await h.repository.createAdditionalCountdown(actor, h.request);
    expect(h.statements.some(({ sql }) => sql.includes("INSERT INTO master_job_types"))).toBe(false);
    expect(h.commit()).toBe(true);
  });

  it("preserves legacy selected types when the checkbox is unchecked", async () => {
    const h = harness({ existingType: 1, selectedId: true });
    await h.repository.createAdditionalCountdown(actor, { ...h.request, isNonTechnicalJob: false });
    expect(h.commit()).toBe(true);
    expect(h.statements.some(({ sql }) => sql.includes("INSERT INTO master_job_types"))).toBe(false);
  });

  for (const existingType of [0, "0", false]) {
    it(`reuses an existing nontechnical selected type (${String(existingType)})`, async () => {
      const h = harness({ existingType, selectedId: true });
      await h.repository.createAdditionalCountdown(actor, h.request);
      expect(h.statements.some(({ sql }) => sql.includes("INSERT INTO master_job_types"))).toBe(false);
      expect(h.commit()).toBe(true);
    });
  }

  for (const selectedId of [false, true]) {
    for (const existingType of [1, true, null]) {
      it(`rejects an existing technical ${selectedId ? "ID" : "name"} (${String(existingType)}) before countdown creation`, async () => {
        const h = harness({ existingType, selectedId });
        await rejects(h.repository.createAdditionalCountdown(actor, h.request), /JOB_TYPE_CLASSIFICATION_MISMATCH/u);
        expect(h.statements.some(({ sql }) => sql.includes("INSERT INTO sm_jobdesc_countdown"))).toBe(false);
        expect(h.rollback()).toBe(true);
      });
    }
  }

  it("checks the winning job type after a duplicate-name race", async () => {
    const h = harness({ duplicateType: 1 });
    await rejects(h.repository.createAdditionalCountdown(actor, h.request), /JOB_TYPE_CLASSIFICATION_MISMATCH/u);
    expect(h.statements.some(({ sql }) => sql.includes("INSERT INTO sm_jobdesc_countdown"))).toBe(false);
    expect(h.rollback()).toBe(true);
  });

  it("allows a matching nontechnical winner after a duplicate-name race", async () => {
    const h = harness({ duplicateType: 0 });
    await h.repository.createAdditionalCountdown(actor, h.request);
    expect(h.commit()).toBe(true);
  });

  it("rejects a missing Master Panel context before provisioning an additional countdown", async () => {
    const h = harness({ missingPanel: true });
    await rejects(h.repository.createAdditionalCountdown(actor, h.request), /ADDITIONAL_REFERENCE_INCOMPLETE/u);
    expect(h.statements.some(({ sql }) => sql.includes("INSERT INTO sm_jobdesc_countdown"))).toBe(false);
    expect(h.statements.some(({ sql }) => sql.includes("INSERT INTO sm_jobdesc_plan"))).toBe(false);
    expect(h.rollback()).toBe(true);
  });
});
