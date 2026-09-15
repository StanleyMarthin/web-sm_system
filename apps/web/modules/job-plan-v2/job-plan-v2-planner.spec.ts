import { describe, expect, test } from "bun:test";
import {
  buildCreateJobPlanV2Payload,
  formatJobPlanV2Approval,
  formatJobPlanV2Execution,
  minutesToDuration,
  minutesToTime,
  toJobPlanV2DisplayRows,
  validateJobPlanV2Draft,
} from "./job-plan-v2-planner";

const countdown = {
  value: "CORE-1",
  label: "Repair bumper",
  unitName: "MB 220S",
  carId: "220S",
  panelId: 10,
  divisionId: 7,
  divisionName: "BODY",
  panelName: "Front Bumper",
  jobName: "Repair bumper",
  remainingHours: 3,
};

const employee = {
  value: "EMP-1",
  label: "Asep",
  divisionId: 7,
  divisionName: "BODY",
};

describe("Job Plan V2 planner helpers", () => {
  test("formats V2 states without collapsing domains", () => {
    expect(formatJobPlanV2Approval("DIVISION_REVIEW")).toBe("Review Divisi");
    expect(formatJobPlanV2Execution("FINISHED_PENDING_VALIDATION")).toBe("Menunggu Validasi");
  });

  test("formats planned minutes for grid display", () => {
    expect(minutesToTime(8 * 60 + 30)).toBe("08:30");
    expect(minutesToDuration(150)).toBe("02:30");
  });

  test("enriches read rows from countdown and employee references", () => {
    const rows = toJobPlanV2DisplayRows([
      {
        plan_id: "PLAN-1",
        core_id: "CORE-1",
        car_id: "220S",
        panel_id: 10,
        division_id: 7,
        employee_id: "EMP-1",
        task_date: "2026-09-15",
        planned_start_minute: 480,
        planned_finish_minute: 600,
        planned_work_minutes: 120,
        approval_state: "DIVISION_REVIEW",
        execution_state: "NOT_STARTED",
        ledger_state: "UNMATERIALIZED",
        legacy_status: null,
        urgent: false,
        is_rework: false,
        is_overtime: false,
        is_priority: false,
        jobdescription: null,
        note: null,
        source: "V2_REDIS",
        version: 3,
        projection_ready: true,
        accumulated_work_minutes: 0,
        persisted_work_minutes: 0,
        unverified_work_minutes: 0,
        live_state_available: true,
        read_only: false,
      },
    ], [countdown], [employee]);

    expect(rows[0]).toMatchObject({
      unitName: "MB 220S",
      panelName: "Front Bumper",
      employeeName: "Asep",
      approval: "Review Divisi",
      execution: "Belum Mulai",
      ledger: "Belum Materialized",
      sync: "Synced",
    });
  });

  test("validates and builds canonical create payload", () => {
    const draft = {
      clientId: "draft-1",
      isNew: true as const,
      coreId: "CORE-1",
      employeeId: "EMP-1",
      taskDate: "2026-09-15",
      startTime: "08:00",
      durationText: "03:00",
      jobDescription: "Repair bumper",
      note: "",
      isOvertime: false,
      isRework: false,
      isPriority: true,
      error: null,
    };

    expect(validateJobPlanV2Draft(draft)).toBeNull();
    expect(buildCreateJobPlanV2Payload(draft, "USER-1", "cmd-1")).toMatchObject({
      userId: "USER-1",
      coreId: "CORE-1",
      employeeId: "EMP-1",
      plannedStartMinute: 480,
      plannedWorkMinutes: 180,
      commandId: "cmd-1",
      isPriority: true,
    });
  });
});
