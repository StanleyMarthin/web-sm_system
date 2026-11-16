import { describe, expect, it } from "bun:test";
import { jobPlanRuntimeMutationEnvelopeSchema, jobPlanRuntimeReadItemSchema, monitorJobPlanRuntimeRequestSchema, mutateJobPlanRuntimeExecutionRequestSchema } from "./job-plan-runtime";

describe("manual execution progress contract", () => {
  it("retains the selected result and authoritative cancelled result", () => {
    const command = { action: "finish", userId: "EMP-1", commandId: "finish-pending", expectedVersion: 8,
      occurredAt: "2026-11-12T08:06:00+07:00", status: " Pending ", note: "Material belum tersedia" };
    expect(mutateJobPlanRuntimeExecutionRequestSchema.parse(command)).toMatchObject({ status: "pending" });
    expect(mutateJobPlanRuntimeExecutionRequestSchema.safeParse({ ...command, status: "unknown" }).success).toBe(false);
    const row = jobPlanRuntimeReadItemSchema.parse({
      plan_id: "P1", core_id: "C1", car_id: "U1", panel_id: 1, division_id: 1, employee_id: "E1",
      task_date: "2026-11-12", planned_start_minute: 480, planned_finish_minute: 540,
      planned_work_minutes: 60, approval_state: "APPROVED", execution_state: "FINISHED_PENDING_VALIDATION",
      ledger_state: "UNMATERIALIZED", legacy_status: "CANCEL", urgent: false,
      is_rework: false, is_overtime: false, is_priority: false, note: null, source: "V2_REDIS",
      execution_status: " CANCEL ", progress_percent: 100,
    });
    expect(row).toMatchObject({ execution_status: "cancel", progress_percent: 100 });
    const response = jobPlanRuntimeMutationEnvelopeSchema.parse({ statusCode: 200, success: true, message: "Tersimpan",
      data: { planId: "P1", version: 9, executionState: "FINISHED_PENDING_VALIDATION", executionStatus: " Cancel " } });
    expect(response.data).toMatchObject({ executionStatus: "cancel" });
  });

  it("retains actual overtime metadata beyond a day without changing planned times", () => {
    const row = jobPlanRuntimeReadItemSchema.parse({
      plan_id: "P1", core_id: "C1", car_id: "U1", panel_id: 1, division_id: 1, employee_id: "E1",
      task_date: "2026-11-06", planned_start_minute: 1020, planned_finish_minute: 1320,
      planned_work_minutes: 300, approval_state: "APPROVED", execution_state: "RUNNING",
      ledger_state: "UNMATERIALIZED", legacy_status: "ONPROGRESS", urgent: false,
      is_rework: false, is_overtime: true, is_priority: false, note: null, source: "V2_REDIS",
      execution_budget_minutes: 3000, execution_deadline: "2026-11-09T01:00:00+07:00", continuation_of: "P0",
    });
    expect(row.execution_budget_minutes).toBe(3000);
    expect(row.execution_deadline).toBe("2026-11-09T01:00:00+07:00");
    expect(row.continuation_of).toBe("P0");
    expect(row.planned_finish_minute).toBe(1320);
  });

  it("retains valid documentation and permits hold/resume without new photos", () => {
    const command = { action: "start", userId: "EMP-1", commandId: "start-photos", expectedVersion: 1,
      occurredAt: "2026-10-31T08:00:00+07:00" };
    const photos = { before: ["https://photos.example/before.jpg"], process: [], after: [] };
    expect(mutateJobPlanRuntimeExecutionRequestSchema.parse({ ...command, photos }).photos).toEqual(photos);
    for (const action of ["hold", "resume"]) {
      expect(mutateJobPlanRuntimeExecutionRequestSchema.parse({ ...command, action }).photos).toBeUndefined();
    }
    for (const before of [["file:///camera.jpg"], ["javascript:alert(1)"], Array(4).fill("https://photos.example/before.jpg")]) {
      expect(mutateJobPlanRuntimeExecutionRequestSchema.safeParse({ ...command, photos: { ...photos, before } }).success).toBe(false);
    }
  });

  it("keeps manual progress and note through web execution validation", () => {
    const command = { action: "finish", userId: "EMP-1", commandId: "finish-1", expectedVersion: 8,
      occurredAt: "2026-10-31T11:00:00+07:00", progressPercent: 80.5, note: "Lanjut besok" };
    const parsed = mutateJobPlanRuntimeExecutionRequestSchema.parse(command);
    expect(parsed.progressPercent).toBe(80.5);
    expect(parsed.note).toBe("Lanjut besok");
    for (const invalid of [-1, 101, Number.NaN, Infinity]) {
      expect(mutateJobPlanRuntimeExecutionRequestSchema.safeParse({ ...command, progressPercent: invalid }).success).toBe(false);
    }
  });
  it("preserves fractional monitoring corrections without inventing a progress value", () => {
    const command = { userId: "KD-1", commandId: "monitor-1", expectedVersion: 9 };
    expect(monitorJobPlanRuntimeRequestSchema.parse({ ...command, progressSeen: 40.5 }).progressSeen).toBe(40.5);
    expect(monitorJobPlanRuntimeRequestSchema.parse(command).progressSeen).toBe(undefined);
  });
});


describe("server-authorized Job Plan actions", () => {
  const item = {
    plan_id: "PLAN-1", core_id: "CORE-1", car_id: "CAR-1", panel_id: 1,
    division_id: 4, employee_id: "EMP-1", task_date: "2026-11-16",
    planned_start_minute: 480, planned_finish_minute: 540, planned_work_minutes: 60,
    approval_state: "UNIT_REVIEW", execution_state: "NOT_STARTED", ledger_state: "UNMATERIALIZED",
    legacy_status: null, urgent: true, is_rework: false, is_overtime: false,
    is_priority: false, note: null, source: "V2_REDIS",
  };

  it("preserves actor-scoped server actions without deriving them from stage", () => {
    expect(jobPlanRuntimeReadItemSchema.parse({ ...item, available_actions: ["approve", "reject"] }).available_actions)
      .toEqual(["approve", "reject"]);
    expect(jobPlanRuntimeReadItemSchema.parse({ ...item, available_actions: [] }).available_actions).toEqual([]);
    expect(jobPlanRuntimeReadItemSchema.parse(item).available_actions).toBeUndefined();
  });

  it("normalizes the camel alias while an explicit canonical denial takes precedence", () => {
    expect(jobPlanRuntimeReadItemSchema.parse({ ...item, availableActions: ["monitor"] }).available_actions)
      .toEqual(["monitor"]);
    const denied = jobPlanRuntimeReadItemSchema.parse({ ...item, available_actions: [], availableActions: ["approve"] });
    expect(denied.available_actions).toEqual([]);
    expect("availableActions" in denied).toBe(false);
    expect(jobPlanRuntimeReadItemSchema.safeParse({ ...item, available_actions: "approve" }).success).toBe(false);
  });
});
