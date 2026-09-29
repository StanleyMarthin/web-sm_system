import { describe, expect, test } from "bun:test";
import { jobPlanRuntimeReadItemSchema } from "@smsystem/contracts/job-plan-runtime";
import {
  buildCreateJobPlanRuntimePayload,
  buildEditDraftJobPlanRuntimePayload,
  buildJobPlanDraftRecord,
  buildManualExecutionJobPlanRuntimePayload,
  createEditDraftFromRow,
  createManualExecutionDraft,
  findJobPlanPanelValue,
  formatJobPlanRuntimeApproval,
  formatJobPlanRuntimeExecution,
  jobPlanComponentNames,
  jobPlanBreakMinutesForWindow,
  jobPlanPanelNames,
  jobPlanPartNames,
  jobPlanWindowMinutes,
  minutesToDuration,
  minutesToTime,
  toJobPlanDraftDisplayRows,
  toLocalDateValue,
  toJobPlanRuntimeDisplayRows,
  resolveJobPlanDivisionName,
  validateJobPlanRuntimeDraft,
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
    const result = jobPlanRuntimeReadItemSchema.parse({
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

  test("formats runtime states without collapsing domains", () => {
    expect(formatJobPlanRuntimeApproval("DIVISION_REVIEW")).toBe("Review QA");
    expect(formatJobPlanRuntimeApproval("UNIT_REVIEW")).toBe("Review KP");
    expect(formatJobPlanRuntimeApproval("MANAGEMENT_REVIEW")).toBe("Review PM");
    expect(formatJobPlanRuntimeExecution("FINISHED_PENDING_VALIDATION")).toBe("Menunggu Validasi");
  });

  test("formats planned minutes for grid display", () => {
    expect(minutesToTime(8 * 60 + 30)).toBe("08:30");
    expect(minutesToDuration(150)).toBe("02:30");
  });

  test("uses the browser local date for a new draft", () => {
    expect(toLocalDateValue(new Date(2026, 8, 16, 23, 59))).toBe("2026-09-16");
  });

  test("enriches read rows from countdown and employee references", () => {
    const rows = toJobPlanRuntimeDisplayRows([
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
      approval: "Review QA",
      execution: "Belum Mulai",
      ledger: "Belum Diproses",
      sync: "Synced",
    });
  });

  test("uses employee division name when countdown reference is missing", () => {
    const rows = toJobPlanRuntimeDisplayRows([
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

  test("resolves division labels from scoped employee references", () => {
    expect(resolveJobPlanDivisionName(7, [], [employee], [])).toBe("BODY");
  });

  test("builds a shared mobile draft from a web planner row", () => {
    const draft = {
      clientId: "draft-web-1",
      isNew: true as const,
      sourceType: "countdown" as const,
      workMode: "normal" as const,
      coreId: "CORE-1",
      divisionId: 7,
      carId: "220S",
      panelId: 10,
      jobTypeId: "",
      jobTypeName: "",
      employeeId: "EMP-1",
      taskDate: "2026-09-15",
      startTime: "08:00",
      durationText: "01:39",
      jobDescription: "Repair bumper",
      note: "Periksa sisi bawah",
      isOvertime: false,
      isRework: false,
      isPriority: false,
      error: null,
    };

    expect(buildJobPlanDraftRecord(draft, {
      countdowns: [countdown],
      employees: [employee],
      divisions: [],
      panels: [{ value: "10", label: "Front Bumper", panelName: "Front Bumper", carId: "220S" }],
      jobTypes: [],
    })).toMatchObject({
      draftItemId: "draft-web-1",
      sourceType: "COUNTDOWN",
      coreId: "CORE-1",
      divisionId: 7,
      divisionName: "BODY",
      panelName: "Front Bumper",
      assignedUserId: "EMP-1",
      targetHours: 1.65,
      finishTime: "09:39",
      note: "Periksa sisi bawah",
    });
  });

  test("keeps legacy mobile draft remaining hours visible without countdown reference", () => {
    const rows = toJobPlanDraftDisplayRows([
      {
        planId: "draft-1",
        coreId: "CORE-MISSING",
        taskDate: "2026-09-15",
        unitName: "MB 220S",
        divisionId: 7,
        divisionName: "BODY",
        panelName: "Panel Body",
        panelSectionName: "Panel Body",
        jobName: null,
        masterJobName: "Repair",
        assignedUserId: "EMP-1",
        assignedUserName: "Asep",
        targetHours: 1.65,
        targetDailyHours: 1.65,
        targetTotalHours: 1.65,
        startTime: "08:00",
        finishTime: "09:39",
        isOvertime: false,
        isPriority: false,
        status: "DRAFT",
        jobDescription: "Repair",
        instructionText: "Repair part",
        note: "Repair part",
        draftSourceType: "COUNTDOWN",
        draftCarId: "220S",
        draftPanelId: 10,
        draftJobTypeId: null,
        draftDeadlineDate: null,
        draftIsRework: false,
        draftIsNonTechnicalJob: false,
        availablePlanHours: null,
        remainingHours: null,
        progressPercent: null,
      },
    ], [], [employee]);

    expect(rows[0]?.panelName).toBe("Panel Body");
    expect(rows[0]?.remainingText).toBe("01:39");
  });

  test("hides cancelled rows from the operational grid", () => {
    const rows = toJobPlanRuntimeDisplayRows([
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
      sourceType: "countdown" as const,
      workMode: "normal" as const,
      coreId: "CORE-1",
      divisionId: 1,
      carId: "CAR-1",
      panelId: 10,
      jobTypeId: "",
      jobTypeName: "",
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

    expect(validateJobPlanRuntimeDraft(draft)).toBeNull();
    expect(buildCreateJobPlanRuntimePayload(draft, "USER-1", "cmd-1")).toMatchObject({
      userId: "USER-1",
      coreId: "CORE-1",
      employeeId: "EMP-1",
      plannedStartMinute: 480,
      plannedWorkMinutes: 180,
      commandId: "cmd-1",
      isPriority: true,
    });
  });

  test("validates additional jobdesc draft before countdown exists", () => {
    const draft = {
      clientId: "draft-additional-1",
      isNew: true as const,
      sourceType: "additional" as const,
      workMode: "overtime" as const,
      coreId: "additional:JOB-1",
      divisionId: 1,
      carId: "CAR-1",
      panelId: 10,
      jobTypeId: "JOB-1",
      jobTypeName: "",
      employeeId: "EMP-1",
      taskDate: "2026-09-15",
      startTime: "17:00",
      durationText: "02:00",
      jobDescription: "Jobdesc tambahan",
      note: "Temuan dadakan",
      isOvertime: true,
      isRework: false,
      isPriority: false,
      error: null,
    };

    expect(validateJobPlanRuntimeDraft(draft)).toBeNull();
  });

  test("derives component, panel, and part options from one unit panel list", () => {
    const panels = [
      { value: "11", label: "Front Bumper", panelName: "Front Bumper", componentName: "Bumper", partName: "Bracket", carId: "220S" },
      { value: "12", label: "Front Bumper", panelName: "Front Bumper", componentName: "Bumper", partName: null, carId: "220S" },
      { value: "13", label: "Rear Door", panelName: "Rear Door", componentName: "Door", partName: "Handle", carId: "220S" },
    ];

    expect(jobPlanComponentNames(panels)).toEqual(["Bumper", "Door"]);
    expect(jobPlanPanelNames(panels, "Bumper")).toEqual(["Front Bumper"]);
    expect(jobPlanPartNames(panels, "Front Bumper")).toEqual(["Bracket", "Tanpa part"]);
    expect(findJobPlanPanelValue(panels, "Front Bumper", "Bracket")).toBe("11");
    expect(findJobPlanPanelValue(panels, "Front Bumper", "")).toBe("12");
    expect(findJobPlanPanelValue(panels, "Rear Door", "Bracket")).toBeNull();
  });

  test("derives the daily target from the work window minus the weekday break", () => {
    // 2026-09-02 Rabu, 2026-09-04 Jumat, 2026-09-05 Sabtu, 2026-09-06 Minggu.
    expect(jobPlanWindowMinutes("08:00", "17:00")).toBe(540);
    expect(jobPlanBreakMinutesForWindow("2026-09-02", "08:00", "17:00")).toBe(60);
    expect(jobPlanBreakMinutesForWindow("2026-09-04", "08:00", "17:00")).toBe(90);
    expect(jobPlanBreakMinutesForWindow("2026-09-05", "08:00", "14:00")).toBe(60);
    expect(jobPlanBreakMinutesForWindow("2026-09-06", "08:00", "17:00")).toBe(0);
    // Window yang tidak melewati jam istirahat tidak memotong apa pun.
    expect(jobPlanBreakMinutesForWindow("2026-09-02", "08:00", "12:00")).toBe(0);
    expect(jobPlanBreakMinutesForWindow("2026-09-02", "17:00", "22:00")).toBe(0);
    expect(jobPlanBreakMinutesForWindow("2026-09-04", "11:00", "11:30")).toBe(0);
  });

  test("builds edit draft mutation payload", () => {
    const draft = {
      clientId: "edit-1",
      isNew: true as const,
      sourceType: "countdown" as const,
      workMode: "normal" as const,
      coreId: "CORE-1",
      divisionId: 1,
      carId: "CAR-1",
      panelId: 10,
      jobTypeId: "",
      jobTypeName: "",
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

    expect(buildEditDraftJobPlanRuntimePayload(draft, "USER-1", "cmd-edit", 4)).toMatchObject({
      action: "edit_draft",
      userId: "USER-1",
      expectedVersion: 4,
      employeeId: "EMP-1",
      jobDescription: "Repair bumper edited",
    });
  });

  test("creates an editable draft from a saved draft row", () => {
    const [row] = toJobPlanRuntimeDisplayRows([
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
    const [row] = toJobPlanRuntimeDisplayRows([
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

    expect(buildManualExecutionJobPlanRuntimePayload(draft, "USER-1", "cmd-manual")).toMatchObject({
      userId: "USER-1",
      commandId: "cmd-manual",
      expectedVersion: 5,
      actualMinutes: 90,
      result: "Selesai",
    });
  });
});
