import { describe, expect, it } from "bun:test";
import type { JobPlanV2ReadItem } from "@smsystem/contracts/job-plan-v2";
import { actualMinutes, fmtMinutes, progressPercent } from "./countdown-job-history";

function historyRow(overrides: Partial<JobPlanV2ReadItem> = {}): JobPlanV2ReadItem {
  return {
    plan_id: "PLAN-1",
    core_id: "CORE-1",
    car_id: null,
    panel_id: null,
    division_id: null,
    employee_id: "EMP-1",
    task_date: "2026-09-16",
    planned_start_minute: 480,
    planned_finish_minute: 960,
    planned_work_minutes: 480,
    approval_state: "APPROVED",
    execution_state: "RUNNING",
    ledger_state: "UNMATERIALIZED",
    legacy_status: null,
    urgent: false,
    is_rework: false,
    is_overtime: false,
    is_priority: false,
    jobdescription: null,
    note: null,
    source: "MYSQL_V2_PROJECTION",
    version: 1,
    projection_ready: true,
    accumulated_work_minutes: 0,
    persisted_work_minutes: 0,
    unverified_work_minutes: 0,
    live_state_available: true,
    read_only: false,
    ...overrides,
  };
}

describe("countdown job history helpers", () => {
  it("formats whole hours without decimals", () => {
    expect(fmtMinutes(480)).toBe("8 Jam");
  });

  it("formats fractional hours with one decimal", () => {
    expect(fmtMinutes(270)).toBe("4.5 Jam");
  });

  it("formats missing minutes as dash", () => {
    expect(fmtMinutes(0)).toBe("-");
    expect(fmtMinutes(null)).toBe("-");
  });

  it("prefers accumulated minutes over persisted", () => {
    expect(actualMinutes(historyRow({ accumulated_work_minutes: 300, persisted_work_minutes: 200 }))).toBe(300);
  });

  it("falls back to persisted when accumulated is empty", () => {
    expect(actualMinutes(historyRow({ accumulated_work_minutes: 0, persisted_work_minutes: 240 }))).toBe(240);
  });

  it("computes progress against planned minutes and caps at 100", () => {
    expect(progressPercent(historyRow({ planned_work_minutes: 480, accumulated_work_minutes: 240 }))).toBe(50);
    expect(progressPercent(historyRow({ planned_work_minutes: 480, accumulated_work_minutes: 960 }))).toBe(100);
  });

  it("returns null progress when no planned minutes", () => {
    expect(progressPercent(historyRow({ planned_work_minutes: 0 }))).toBeNull();
  });
});
