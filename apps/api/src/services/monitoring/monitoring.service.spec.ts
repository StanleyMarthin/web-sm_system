import * as bunTest from "bun:test";

const { beforeEach, describe, expect, it } = bunTest;
const mock = (bunTest as unknown as {
  mock: ((implementation: (...args: unknown[]) => unknown) => (...args: unknown[]) => unknown) & {
    module: (name: string, factory: () => unknown) => void;
  };
}).mock;

const notifications: unknown[][] = [];
const notifyMobileEmployees = mock(async (...args: unknown[]) => { notifications.push(args); });

mock.module("@/services/notifications/mobile-notification.service", () => ({
  notifyMobileEmployees,
}));

const { DefaultMonitoringService } = await import("./monitoring.service");

function monitoringRow(overrides: Record<string, unknown> = {}) {
  return {
    planId: "PLAN-1",
    coreId: "CORE-1",
    countdownId: "CORE-1",
    carId: "CAR-1",
    unitName: "220S",
    customerName: null,
    divisionId: 7,
    divisionName: "Body",
    employeeId: "PIC-1",
    employeeName: "Asep",
    taskDate: "2026-09-16",
    panelName: "Door LH",
    masterJobName: "Repair",
    jobDescription: "Repair door",
    instructionText: "Repair door",
    targetDailyHours: 2,
    targetTotalHours: 4,
    planStatus: "PLAN",
    actualStatus: null,
    executionStatus: "PLAN",
    countdownStatus: "PLAN",
    progressPercent: 0,
    totalActualHours: 0,
    remainingHours: 4,
    latestStartTime: null,
    latestFinishTime: null,
    latestBreakDurationMinutes: null,
    actualStartTime: null,
    actualBreakMinutes: null,
    actualFinishTime: null,
    actualDurationHours: null,
    actualId: null,
    submittedToLedger: false,
    planStartTime: "08:00",
    planFinishTime: "10:00",
    qcStatus: "BELUM_QC",
    qcResult: null,
    qcNotes: null,
    monitoringStatus: null,
    monitoringResult: null,
    isOvertime: false,
    isStarted: false,
    isSubmitted: false,
    hasDelayRisk: false,
    masterPanelId: 519,
    countdownDeadline: "2026-09-20",
    countdownTargetHours: 4,
    countdownRemainingHours: 4,
    ...overrides,
  };
}

function monitoringRepository(rows: unknown[]) {
  return {
    listTasks: mock(async () => ({ rows, total: rows.length })),
    listReferences: mock(async () => ({ divisions: [], units: [], employees: [] })),
    getSummary: mock(async () => ({
      activeWork: 0,
      noStart: 0,
      noSubmit: 0,
      delayRisk: 0,
      overtimeCount: 0,
    })),
  };
}

function monitoringSession() {
  return {
    user: {
      employeeId: "USER-1",
      fullName: "User",
      scope: { canViewAllUnits: true, canViewAssignedUnits: true, divisionIds: [], unitIds: [] },
    },
  };
}

describe("DefaultMonitoringService mobile notification", () => {
  beforeEach(() => {
    notifications.length = 0;
  });

  it("notifies the assigned employee after actual task submit", async () => {
    const repository = {
      createActual: mock(async () => ({ planId: "PLAN-1", actualId: "ACT-1" })),
    };
    const service = new DefaultMonitoringService(repository as never);

    await service.createActual({
      user: { employeeId: "LEAD-1", fullName: "Lead", scope: {} },
    } as never, {
      date: "2026-08-10",
      employeeId: "PIC-1",
      divisionId: 3,
      planId: "PLAN-1",
      carId: "CAR-1",
      jobDescription: "Wiring",
      resultNote: null,
      startTime: "08:00",
      finishTime: "10:00",
      breakMinutes: 0,
      progressPercent: 100,
      taskStatus: "DONE",
      location: null,
      isOvertime: false,
    });

    expect(notifications).toEqual([[
      ["PIC-1"],
      {
        title: "Update Task",
        body: "Lead memperbarui task Wiring menjadi DONE.",
        data: {
          module: "task",
          taskId: "PLAN-1",
          plandailyId: "PLAN-1",
          actualId: "ACT-1",
          status: "DONE",
        },
      },
      "sm_tasks",
    ]]);
  });

  it("submits one actual to the immutable ledger", async () => {
    const ledgerCalls: unknown[][] = [];
    const submitActualToLedger = mock(async (...args: unknown[]) => {
      ledgerCalls.push(args);
      return { ledgerId: "LEDGER-1", alreadySubmitted: false };
    });
    const service = new DefaultMonitoringService({ submitActualToLedger } as never);
    const result = await service.submitActualToLedger({
      user: { employeeId: "KD-1", fullName: "Kepala Divisi", scope: {} },
    } as never, "ACT-1");

    expect(result).toEqual({ ledgerId: "LEDGER-1", alreadySubmitted: false });
    expect(ledgerCalls.length).toBe(1);
  });
});

describe("DefaultMonitoringService runtime monitoring enrichment", () => {
  it("enriches monitoring rows from Job Plan Runtime by planId", async () => {
    const repository = monitoringRepository([
      monitoringRow({ planId: "PLAN-1", coreId: "CORE-1" }),
    ]);
    const readModel = {
      listByCoreIds: mock(async () => [
        {
          plan_id: "PLAN-1",
          core_id: "OTHER-CORE",
          car_id: "CAR-1",
          panel_id: 519,
          division_id: 7,
          employee_id: "PIC-1",
          task_date: "2026-09-16",
          planned_start_minute: 480,
          planned_finish_minute: 600,
          planned_work_minutes: 120,
          approval_state: "DIVISION_REVIEW",
          execution_state: "RUNNING",
          ledger_state: "UNMATERIALIZED",
          legacy_status: null,
          urgent: false,
          is_rework: false,
          is_overtime: false,
          is_priority: false,
          jobdescription: "Repair door",
          note: null,
          source: "V2_REDIS",
          version: 4,
          projection_ready: true,
          accumulated_work_minutes: 75,
          persisted_work_minutes: 30,
          unverified_work_minutes: 45,
          live_state_available: true,
          read_only: false,
        },
      ]),
    };

    const service = new DefaultMonitoringService(repository as never, readModel as never);
    const result = await service.listToday(monitoringSession() as never, {
      page: 1,
      limit: 20,
      search: "",
      sortBy: "taskDate",
      sortDirection: "desc",
      view: null,
      filters: [],
    });

    expect(result.data[0]).toMatchObject({
      planId: "PLAN-1",
      coreId: "CORE-1",
      approvalState: "DIVISION_REVIEW",
      executionState: "RUNNING",
      ledgerState: "UNMATERIALIZED",
      version: 4,
      syncStatus: "SYNCED",
      dataSource: "V2_REDIS",
      actualMinutes: 75,
    });
  });

  it("falls back to legacy rows when Job Plan Runtime is unavailable", async () => {
    const repository = monitoringRepository([monitoringRow()]);
    const readModel = {
      listByCoreIds: mock(async () => {
        throw new Error("RUNTIME_DOWN");
      }),
    };

    const service = new DefaultMonitoringService(repository as never, readModel as never);
    const result = await service.listToday(monitoringSession() as never, {
      page: 1,
      limit: 20,
      search: "",
      sortBy: "taskDate",
      sortDirection: "desc",
      view: null,
      filters: [],
    });

    expect(result.data[0]).toMatchObject({
      planId: "PLAN-1",
      syncStatus: "UNAVAILABLE",
      dataSource: "LEGACY_ONLY",
    });
  });

  it("does not merge runtime data by coreId when planId differs", async () => {
    const repository = monitoringRepository([monitoringRow({ planId: "PLAN-1", coreId: "CORE-1" })]);
    const readModel = {
      listByCoreIds: mock(async () => [
        {
          plan_id: "PLAN-OTHER",
          core_id: "CORE-1",
          car_id: "CAR-1",
          panel_id: 519,
          division_id: 7,
          employee_id: "PIC-1",
          task_date: "2026-09-16",
          planned_start_minute: 480,
          planned_finish_minute: 600,
          planned_work_minutes: 120,
          approval_state: "APPROVED",
          execution_state: "VALIDATED",
          ledger_state: "FINALIZED",
          legacy_status: null,
          urgent: false,
          is_rework: false,
          is_overtime: false,
          is_priority: false,
          jobdescription: "Wrong row",
          note: null,
          source: "V2_REDIS",
          version: 9,
          projection_ready: true,
          accumulated_work_minutes: 120,
          persisted_work_minutes: 120,
          unverified_work_minutes: 0,
          live_state_available: true,
          read_only: false,
        },
      ]),
    };

    const service = new DefaultMonitoringService(repository as never, readModel as never);
    const result = await service.listToday(monitoringSession() as never, {
      page: 1,
      limit: 20,
      search: "",
      sortBy: "taskDate",
      sortDirection: "desc",
      view: null,
      filters: [],
    });

    expect(result.data[0]).toMatchObject({
      planId: "PLAN-1",
      syncStatus: "UNAVAILABLE",
      dataSource: "LEGACY_ONLY",
    });
    expect(result.data[0]?.approvalState).toBe(null);
  });
});
