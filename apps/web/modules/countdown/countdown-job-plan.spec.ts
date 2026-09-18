import { describe, expect, it } from "bun:test";
import { buildCreateJobPlanV2Payload } from "@/modules/job-plan/job-plan-planner";
import {
  createCountdownPlanDraft,
  resolveCountdownPlanProgress,
  summarizeCountdownPlans,
} from "./countdown-job-plan";

function plan(planId: string, approvalState: string) {
  return {
    plan_id: planId,
    core_id: "cd-1",
    car_id: "CAR-1",
    panel_id: null,
    division_id: 10,
    employee_id: "SM-09.001",
    task_date: "2026-09-18",
    planned_start_minute: 480,
    planned_finish_minute: 960,
    planned_work_minutes: 480,
    approval_state: approvalState,
    execution_state: "NOT_STARTED",
    ledger_state: "UNMATERIALIZED",
    legacy_status: null,
    urgent: false,
    is_rework: false,
    is_overtime: false,
    is_priority: false,
    jobdescription: "Fitting",
    note: null,
    source: "V2_REDIS",
    accumulated_work_minutes: 0,
    persisted_work_minutes: 0,
    unverified_work_minutes: 0,
    live_state_available: true,
    read_only: false,
  } as never;
}

const planContext = {
  countdownId: "cd-1",
  jobDescription: "Repair Dashboard",
  taskDate: "2026-09-18",
  remainingHours: 8,
};

describe("countdown job plan", () => {
  it("reads plan versus actual minutes", () => {
    expect(
      resolveCountdownPlanProgress({ planned_work_minutes: 480, accumulated_work_minutes: 312 }),
    ).toEqual({ plannedMinutes: 480, workedMinutes: 312, remainingMinutes: 168, percent: 65 });
  });

  it("keeps remaining at zero and progress at 100 when actual passes the plan", () => {
    expect(
      resolveCountdownPlanProgress({ planned_work_minutes: 60, accumulated_work_minutes: 90 }),
    ).toEqual({ plannedMinutes: 60, workedMinutes: 90, remainingMinutes: 0, percent: 100 });
  });

  it("does not divide by a zero plan", () => {
    expect(
      resolveCountdownPlanProgress({ planned_work_minutes: 0, accumulated_work_minutes: 60 }).percent,
    ).toBe(0);
  });

  it("builds a normal plan payload that still needs Job Plan approval", () => {
    const payload = buildCreateJobPlanV2Payload(
      createCountdownPlanDraft(planContext, false),
      "SM-03.004",
      "cmd-normal",
    );

    expect(payload.isOvertime).toBe(false);
    expect(payload.plannedStartMinute).toBe(8 * 60);
    expect(payload.plannedWorkMinutes).toBe(8 * 60);
    expect(payload.coreId).toBe("cd-1");
    expect(payload).not.toHaveProperty("action");
  });

  it("builds an overtime plan payload starting at 17:00", () => {
    const payload = buildCreateJobPlanV2Payload(
      createCountdownPlanDraft(planContext, true),
      "SM-03.004",
      "cmd-overtime",
    );

    expect(payload.isOvertime).toBe(true);
    expect(payload.plannedStartMinute).toBe(17 * 60);
  });

  it("summarizes every job plan of the countdown by approval status", () => {
    const summary = summarizeCountdownPlans([
      plan("P-1", "DRAFT"),
      plan("P-2", "APPROVED"),
      plan("P-3", "DIVISION_REVIEW"),
    ]);

    expect(summary.total).toBe(3);
    expect(summary.breakdown).toEqual([
      { state: "DRAFT", count: 1 },
      { state: "DIVISION_REVIEW", count: 1 },
      { state: "APPROVED", count: 1 },
    ]);
  });

  it("keeps the breakdown stable regardless of array order", () => {
    const summary = summarizeCountdownPlans([
      plan("P-3", "MANAGEMENT_REVIEW"),
      plan("P-1", "DRAFT"),
      plan("P-2", "DRAFT"),
    ]);

    expect(summary.total).toBe(3);
    expect(summary.breakdown).toEqual([
      { state: "DRAFT", count: 2 },
      { state: "MANAGEMENT_REVIEW", count: 1 },
    ]);
  });

  it("shows cancelled plans only when they exist and handles an empty countdown", () => {
    expect(summarizeCountdownPlans([])).toEqual({ total: 0, breakdown: [] });
    expect(summarizeCountdownPlans([plan("P-1", "CANCELLED"), plan("P-2", "REJECTED")]).breakdown).toEqual([
      { state: "REJECTED", count: 1 },
      { state: "CANCELLED", count: 1 },
    ]);
  });
});
