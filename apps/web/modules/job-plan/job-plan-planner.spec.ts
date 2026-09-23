import { describe, expect, test } from "bun:test";
import { jobPlanV2ReadItemSchema } from "@smsystem/contracts/job-plan-v2";
import {
  buildCreateJobPlanV2Payload,
  buildEditDraftJobPlanV2Payload,
  buildManualExecutionJobPlanV2Payload,
  createEditDraftFromRow,
  createManualExecutionDraft,
  formatJobPlanV2Approval,
  formatJobPlanV2Execution,
  minutesToDuration,
  minutesToTime,
  toLocalDateValue,
  toJobPlanV2DisplayRows,
  validateJobPlanV2Draft,
} from "./job-plan-planner";

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
  kpId: "KP-1",
  kpName: "Iqbal",
  qaIds: ["QA-1"],
  qaNames: ["Hardian"],
  targetTotalHours: 8,
  remainingHours: 3,
};

const employee = {
  value: "EMP-1",
  label: "Asep",
  divisionId: 7,
  divisionName: "BODY",
};

describe("Job Plan planner helpers", () => {
  test("normalizes the active job description response key at the contract boundary", () => {
    const result = jobPlanV2ReadItemSchema.parse({
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
      approval_state: "DRAFT",
      execution_state: "NOT_STARTED",
      ledger_state: "UNMATERIALIZED",
      legacy_status: null,
      urgent: false,
      is_rework: false,
      is_overtime: false,
      is_priority: false,
      job_description: "Repair bumper",
      note: null,
      source: "V2_REDIS",
      version: 1,
    });

    expect(result.jobdescription).toBe("Repair bumper");
    expect("job_description" in result).toBe(false);
  });

  test("formats V2 states without collapsing domains", () => {
    expect(formatJobPlanV2Approval("DIVISION_REVIEW")).toBe("Review Divisi");
    expect(formatJobPlanV2Execution("FINISHED_PENDING_VALIDATION")).toBe("Menunggu Validasi");
  });

  test("formats planned minutes for grid display", () => {
    expect(minutesToTime(8 * 60 + 30)).toBe("08:30");
    expect(minutesToDuration(150)).toBe("02:30");
  });

  test("uses the browser local date for a new draft", () => {
    expect(toLocalDateValue(new Date(2026, 8, 16, 23, 59))).toBe("2026-09-16");
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
      ledger: "Belum Diproses",
      sync: "Synced",
    });
  });

  test("uses employee division name when countdown reference is missing", () => {
    const rows = toJobPlanV2DisplayRows([
      {
        plan_id: "PLAN-1",
        core_id: "MISSING-CORE",
        car_id: "220S",
        panel_id: 10,
        division_id: 11,
        employee_id: "EMP-1",
        task_date: "2026-09-15",
        planned_start_minute: 480,
        planned_finish_minute: 600,
        planned_work_minutes: 120,
        approval_state: "DRAFT",
        execution_state: "NOT_STARTED",
        ledger_state: "UNMATERIALIZED",
        legacy_status: null,
        urgent: false,
        is_rework: false,
        is_overtime: false,
        is_priority: false,
        jobdescription: "Repair bumper",
        note: null,
        source: "V2_REDIS",
        version: 1,
        projection_ready: true,
        accumulated_work_minutes: 0,
        persisted_work_minutes: 0,
        unverified_work_minutes: 0,
        live_state_available: true,
        read_only: false,
      },
    ], [], [employee]);

    expect(rows[0]?.divisionName).toBe("BODY");
  });

  test("hides cancelled rows from the operational grid", () => {
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
        approval_state: "CANCELLED",
        execution_state: "NOT_STARTED",
        ledger_state: "UNMATERIALIZED",
        legacy_status: null,
        urgent: false,
        is_rework: false,
        is_overtime: false,
        is_priority: false,
        jobdescription: "Repair bumper",
        note: null,
        source: "V2_REDIS",
        version: 1,
        projection_ready: true,
        accumulated_work_minutes: 0,
        persisted_work_minutes: 0,
        unverified_work_minutes: 0,
        live_state_available: true,
        read_only: false,
      },
    ], [countdown], [employee]);

    expect(rows).toHaveLength(0);
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

  test("builds edit draft mutation payload", () => {
    const draft = {
      clientId: "edit-1",
      isNew: true as const,
      coreId: "CORE-1",
      employeeId: "EMP-1",
      taskDate: "2026-09-15",
      startTime: "08:00",
      durationText: "02:00",
      jobDescription: "Repair bumper edited",
      note: "revisi",
      isOvertime: false,
      isRework: false,
      isPriority: false,
      error: null,
    };

    expect(buildEditDraftJobPlanV2Payload(draft, "USER-1", "cmd-edit", 4)).toMatchObject({
      action: "edit_draft",
      userId: "USER-1",
      expectedVersion: 4,
      employeeId: "EMP-1",
      jobDescription: "Repair bumper edited",
    });
  });

  test("creates an editable draft from a saved draft row", () => {
    const [row] = toJobPlanV2DisplayRows([
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
        approval_state: "DRAFT",
        execution_state: "NOT_STARTED",
        ledger_state: "UNMATERIALIZED",
        legacy_status: null,
        urgent: false,
        is_rework: false,
        is_overtime: false,
        is_priority: true,
        jobdescription: "Repair bumper",
        note: "awal",
        source: "V2_REDIS",
        version: 7,
        projection_ready: true,
        accumulated_work_minutes: 0,
        persisted_work_minutes: 0,
        unverified_work_minutes: 0,
        live_state_available: true,
        read_only: false,
      },
    ], [countdown], [employee]);

    expect(createEditDraftFromRow(row)).toMatchObject({
      editPlanId: "PLAN-1",
      editVersion: 7,
      coreId: "CORE-1",
      employeeId: "EMP-1",
      durationText: "02:00",
      note: "awal",
      isPriority: true,
    });
  });

  test("builds manual execution payload from detail draft", () => {
    const [row] = toJobPlanV2DisplayRows([
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
        approval_state: "APPROVED",
        execution_state: "NOT_STARTED",
        ledger_state: "UNMATERIALIZED",
        legacy_status: null,
        urgent: false,
        is_rework: false,
        is_overtime: false,
        is_priority: false,
        jobdescription: "Repair bumper",
        note: null,
        source: "V2_REDIS",
        version: 5,
        projection_ready: true,
        accumulated_work_minutes: 0,
        persisted_work_minutes: 0,
        unverified_work_minutes: 0,
        live_state_available: true,
        read_only: false,
      },
    ], [countdown], [employee]);
    const draft = {
      ...createManualExecutionDraft(row),
      actualStart: "2026-09-15T08:00",
      actualFinish: "2026-09-15T10:00",
      actualMinutesText: "01:30",
      result: "Selesai",
    };

    expect(buildManualExecutionJobPlanV2Payload(draft, "USER-1", "cmd-manual")).toMatchObject({
      userId: "USER-1",
      commandId: "cmd-manual",
      expectedVersion: 5,
      actualMinutes: 90,
      result: "Selesai",
    });
  });
});
