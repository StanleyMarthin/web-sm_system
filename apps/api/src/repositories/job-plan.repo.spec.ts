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
});
