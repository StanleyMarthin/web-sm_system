import { describe, expect, it } from "bun:test";
import { MySqlJobPlanRepository } from "./job-plan.repo";

const scope = {
  canViewAllUnits: true,
  canViewAssignedUnits: false,
  divisionIds: [],
  managedDivisionIds: [],
  unitIds: [],
};

describe("MySqlJobPlanRepository countdown alignment", () => {
  async function createPlanWithCapacity(input: {
    remainingHours: number;
    reservedPlanHours: number;
    targetHours: number;
  }) {
    const executed: string[] = [];
    const connection = {
      beginTransaction: async () => undefined,
      commit: async () => undefined,
      rollback: async () => undefined,
      release: () => undefined,
      query: async (sql: string) => {
        if (sql.includes("FROM sm_jobdesc_countdown jc")) {
          return [[{
            coreId: "CD-1",
            carId: "CAR-1",
            unitName: "Unit A",
            divisionId: 1,
            divisionName: "Divisi A",
            panelId: 11,
            remainingHours: input.remainingHours,
            progressPercent: 0,
            currentStatus: "PLAN",
          }]];
        }
        if (sql.includes("FROM master_panels")) return [[{ id: 11 }]];
        if (sql.includes("FROM sm_car_panel_status")) return [[]];
        if (sql.includes("FROM sm_jobdesc_plan p")) return [[{ total: input.reservedPlanHours }]];
        if (sql.includes("FROM car_project_assignment")) return [[]];
        return [[]];
      },
      execute: async (sql: string) => {
        executed.push(sql);
        return [{}];
      },
    };
    const repository = new MySqlJobPlanRepository(() => ({ getConnection: async () => connection }) as never);

    await repository.createMany(
      { employeeId: "EMP-1", actorId: "EMP-1", actorName: "Tester", scope },
      [{
        coreId: "CD-1",
        assignedUserId: "EXECUTOR-1",
        taskDate: "2026-09-01",
        targetHours: input.targetHours,
        startTime: "08:00",
        finishTime: "09:00",
        jobDescription: "Repair",
        note: null,
        isOvertime: false,
        isPriority: false,
      }],
    );

    return executed;
  }

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
    expect(countdownSql.includes("AND COALESCE(jc.remaining_hours, 0) > 0")).toBe(false);
  });

  it("rejects a job plan that only provides a panel name", async () => {
    const connection = {
      beginTransaction: async () => undefined,
      commit: async () => undefined,
      rollback: async () => undefined,
      release: () => undefined,
      query: async () => [[]],
      execute: async () => [{}],
    };
    const repository = new MySqlJobPlanRepository(() => ({ getConnection: async () => connection }) as never);

    let message = "";
    try {
      await repository.createWorkspace(
        { employeeId: "EMP-1", actorId: "EMP-1", actorName: "Tester", scope },
        {
          mode: "normal",
          taskDate: "2026-09-01",
          deadlineDate: "2026-09-01",
          projectTargetHours: "02:00",
          isRework: false,
          rows: [{
            source: "additional",
            referenceId: null,
            carId: "UNIT-1",
            divisionId: 1,
            panelId: null,
            jobTypeId: "JOB-1",
            assignedUserId: "EXECUTOR-1",
            targetHours: 2,
            startTime: "08:00",
            finishTime: "10:00",
            jobDescription: "Panel name only",
            note: null,
            isPriority: false,
            isNonTechnicalJob: false,
            picPlan: "PIC-1",
            requiredGrade: "SENIOR",
          }],
        },
      );
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).toBe("ADDITIONAL_REFERENCE_INCOMPLETE");
  });

  it("rejects a WO row when no linked countdown exists", async () => {
    const statements: string[] = [];
    const connection = {
      beginTransaction: async () => undefined,
      commit: async () => undefined,
      rollback: async () => undefined,
      release: () => undefined,
      query: async (sql: string) => {
        statements.push(sql);
        return [[]];
      },
      execute: async () => [{}],
    };
    const repository = new MySqlJobPlanRepository(() => ({ getConnection: async () => connection }) as never);

    let message = "";
    try {
      await repository.createWorkspace(
        { employeeId: "EMP-1", actorId: "EMP-1", actorName: "Tester", scope },
        {
          mode: "normal",
          taskDate: "2026-09-01",
          deadlineDate: "2026-09-01",
          projectTargetHours: "02:00",
          isRework: false,
          rows: [{
            source: "wo",
            referenceId: "WO-1",
            carId: null,
            divisionId: null,
            panelId: null,
            jobTypeId: null,
            assignedUserId: "EXECUTOR-1",
            targetHours: 2,
            startTime: "08:00",
            finishTime: "10:00",
            jobDescription: "WO without countdown",
            note: null,
            isPriority: false,
            isNonTechnicalJob: false,
            picPlan: null,
            requiredGrade: null,
          }],
        },
      );
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).toBe("WORK_ORDER_COUNTDOWN_NOT_FOUND");
    expect(statements.some((sql) => sql.includes("INSERT INTO sm_jobdesc_plan"))).toBe(false);
  });

  it("allows 1 requested hour when 1 countdown hour remains and none is reserved", async () => {
    const executed = await createPlanWithCapacity({
      remainingHours: 1,
      reservedPlanHours: 0,
      targetHours: 1,
    });

    expect(executed.some((sql) => sql.includes("INSERT INTO sm_jobdesc_plan"))).toBe(true);
  });

  it("rejects requested hours when reserved plan hours exhaust countdown capacity", async () => {
    let message = "";
    try {
      await createPlanWithCapacity({
        remainingHours: 1,
        reservedPlanHours: 1,
        targetHours: 0.5,
      });
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).toBe("COUNTDOWN_CAPACITY_EXCEEDED");
  });

  it("allows requested hours equal to remaining minus reserved plan hours", async () => {
    const executed = await createPlanWithCapacity({
      remainingHours: 5,
      reservedPlanHours: 2,
      targetHours: 3,
    });

    expect(executed.some((sql) => sql.includes("INSERT INTO sm_jobdesc_plan"))).toBe(true);
  });
});
