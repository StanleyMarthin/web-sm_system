import { describe, expect, it } from "bun:test";
import type { QcGridQuery } from "@smsystem/contracts/qc";
import { MySqlQcRepository } from "./qc.repo";

const query: QcGridQuery = {
  page: 1,
  limit: 20,
  search: "",
  sortBy: "waitingHours",
  sortDirection: "desc",
  view: null,
  filters: [],
};

const scope = {
  canViewAllUnits: true,
  canViewAssignedUnits: false,
  divisionIds: [],
  managedDivisionIds: [],
  unitIds: [],
};

describe("MySqlQcRepository mobile parity", () => {
  it("lists only technical countdown rows in QC queue", async () => {
    const statements: string[] = [];
    const repository = new MySqlQcRepository(() => ({
      query: async (sql: string) => {
        statements.push(sql);
        if (sql.includes("COUNT(*) AS total")) return [[{ total: 0 }]];
        return [[]];
      },
    }) as never);

    await repository.listQueue({
      employeeId: "EMP-1",
      scope,
      query,
    });

    expect(statements.some((sql) => sql.includes("COALESCE(jt.is_teknis, 1) = 1"))).toBe(true);
  });

  it("keeps KD pass in READY_QC until QA approves it", async () => {
    const executed: Array<{ sql: string; params: unknown[] }> = [];
    const connection = {
      beginTransaction: async () => undefined,
      commit: async () => undefined,
      rollback: async () => undefined,
      release: () => undefined,
      query: async () => [[{
        coreId: "CD-1",
        jobName: "Las panel",
        panelName: "Panel A",
        reworkPlanId: null,
        remainingHours: 1,
        isTechnicalJob: 1,
        workCompleted: 1,
      }]],
      execute: async (sql: string, params: unknown[]) => {
        executed.push({ sql, params });
        return [{}];
      },
    };
    const repository = new MySqlQcRepository(() => ({
      getConnection: async () => connection,
    }) as never);

    await repository.passInspection(
      { actorId: "KD-1", qcLevel: "QC_KD" },
      {
        coreId: "CD-1",
        payload: {
          notes: null,
          inspectionDurationMinutes: null,
          photoBeforeUrl: null,
          evidencePhotoUrl: null,
        },
      },
    );

    const countdownUpdate = executed.find(({ sql }) => sql.includes("UPDATE sm_jobdesc_countdown"));
    expect(Array.isArray(countdownUpdate?.params)).toBe(true);
    expect(typeof countdownUpdate?.params[1]).toBe("string");
    expect(countdownUpdate?.params).toEqual([
      "READY_QC",
      countdownUpdate?.params[1],
      "QC_KD",
      1,
      "KD-1",
      "CD-1",
    ]);
  });

  it("marks countdown DONE only after QA pass", async () => {
    const executed: Array<{ sql: string; params: unknown[] }> = [];
    const connection = {
      beginTransaction: async () => undefined,
      commit: async () => undefined,
      rollback: async () => undefined,
      release: () => undefined,
      query: async () => [[{
        coreId: "CD-1",
        jobName: "Las panel",
        panelName: "Panel A",
        reworkPlanId: null,
        remainingHours: 1,
        isTechnicalJob: 1,
        workCompleted: 1,
      }]],
      execute: async (sql: string, params: unknown[]) => {
        executed.push({ sql, params });
        return [{}];
      },
    };
    const repository = new MySqlQcRepository(() => ({
      getConnection: async () => connection,
    }) as never);

    await repository.passInspection(
      { actorId: "ADV-1", qcLevel: "QC_QA" },
      {
        coreId: "CD-1",
        payload: {
          notes: null,
          inspectionDurationMinutes: null,
          photoBeforeUrl: null,
          evidencePhotoUrl: null,
        },
      },
    );

    const countdownUpdate = executed.find(({ sql }) => sql.includes("UPDATE sm_jobdesc_countdown"));
    expect(Array.isArray(countdownUpdate?.params)).toBe(true);
    expect(typeof countdownUpdate?.params[1]).toBe("string");
    expect(countdownUpdate?.params).toEqual([
      "DONE",
      countdownUpdate?.params[1],
      "QC_QA",
      0,
      "ADV-1",
      "CD-1",
    ]);
  });

  it("extends the same countdown when QC rework needs more hours", async () => {
    const executed: Array<{ sql: string; params: unknown[] }> = [];
    const connection = {
      beginTransaction: async () => undefined,
      commit: async () => undefined,
      rollback: async () => undefined,
      release: () => undefined,
      query: async () => [[{
        coreId: "CD-1",
        jobName: "Las panel",
        panelName: "Panel A",
        reworkPlanId: null,
        remainingHours: 0.5,
        targetHours: 10,
        deadlineDate: "2026-10-02",
        isTechnicalJob: 1,
        workCompleted: 1,
      }]],
      execute: async (sql: string, params: unknown[]) => {
        executed.push({ sql, params });
        return [{}];
      },
    };
    const repository = new MySqlQcRepository(() => ({
      getConnection: async () => connection,
    }) as never);

    await repository.rejectInspection(
      { actorId: "QA-1", qcLevel: "QC_QA" },
      {
        coreId: "CD-1",
        payload: {
          notes: "ulang las",
          inspectionDurationMinutes: null,
          photoBeforeUrl: null,
          evidencePhotoUrl: null,
          reworkDate: "2026-10-03",
          reworkAssignedUser: "SM-1",
          reworkDailyHours: "01:00",
          reworkStartTime: "08:00",
          reworkFinishTime: "09:00",
          reworkDescription: "Rework las",
          reworkIsOvertime: false,
          reworkIsPriority: false,
        },
      },
    );

    const revisionInsert = executed.find(({ sql }) => sql.includes("INSERT INTO sm_jobdesc_countdown_revisions"));
    const countdownUpdate = executed.find(({ sql }) => sql.includes("UPDATE sm_jobdesc_countdown"));

    expect(revisionInsert?.params.slice(0, 6)).toEqual(["CD-1", 10, 10.5, 0.5, "2026-10-02", "2026-10-03"]);
    expect(countdownUpdate?.sql).toContain("SET status = 'PROSES'");
    expect(typeof countdownUpdate?.params[0]).toBe("string");
    expect(countdownUpdate?.params).toEqual([
      countdownUpdate?.params[0],
      countdownUpdate?.params[1],
      "QC_QA",
      10.5,
      1,
      "QA-1",
      "CD-1",
    ]);
  });
});

it("reads QC history with examiner, duration and photos within the user's division scope", async () => {
  let sql = "";
  let bound: unknown[] = [];
  const repository = new MySqlQcRepository(() => ({
    query: async (query: string, params: unknown[]) => {
      sql = query; bound = params;
      return [[{ qcId: "QC-1", qcLevel: "QC_KD", resultStatus: "LOLOS",
        inspectionDate: "2026-10-02 08:00:00", inspectorId: "KD-1", inspectorName: "Haris",
        inspectionDurationMinutes: "42", notes: "rapi", photoBeforeUrl: "https://example.com/1.jpg",
        evidencePhotoUrl: "https://example.com/2.jpg" }]];
    },
  }) as never);
  const history = await repository.listInspectionHistory({ employeeId: "KD-1", coreId: "CD-1",
    scope: { ...scope, canViewAllUnits: false, divisionIds: [12], managedDivisionIds: [12] } });
  expect(sql).toContain("cd.division_id IN");
  expect(sql).toContain("ORDER BY q.inspection_date DESC");
  expect(bound).toEqual(["CD-1", 12]);
  expect(history[0]?.inspectorName).toBe("Haris");
  expect(history[0]?.inspectionDurationMinutes).toBe(42);
  expect(history[0]?.evidencePhotoUrl).toBe("https://example.com/2.jpg");
});

it("records KD pass and reject without overriding a QA result or creating rework", async () => {
  const statements: string[] = [];
  const connection = {
    beginTransaction: async () => undefined, commit: async () => undefined,
    rollback: async () => undefined, release: () => undefined,
    query: async () => [[{ coreId: "CD-1", isTechnicalJob: 1,
      workCompleted: 1, qaQcId: "QA-1", qaResult: "LOLOS" }]],
    execute: async (sql: string) => { statements.push(sql); return [{}]; },
  };
  const repository = new MySqlQcRepository(() => ({ getConnection: async () => connection }) as never);
  await repository.passInspection({ actorId: "KD", qcLevel: "QC_KD" }, {
    coreId: "CD-1", payload: { notes: null, inspectionDurationMinutes: null, photoBeforeUrl: null, evidencePhotoUrl: null },
  });
  expect(statements.some((sql) => sql.includes("INSERT INTO sm_qc_inspections"))).toBe(true);
  expect(statements.some((sql) => sql.includes("UPDATE sm_jobdesc_countdown"))).toBe(false);
  statements.length = 0;
  const rejected = await repository.rejectInspection({ actorId: "KD", qcLevel: "QC_KD" }, {
    coreId: "CD-1", payload: { notes: "KD tidak lolos", inspectionDurationMinutes: null,
      photoBeforeUrl: null, evidencePhotoUrl: null, reworkAssignedUser: "" } as never,
  });
  expect(rejected.applied).toBe(false);
  expect(statements.some((sql) => sql.includes("INSERT INTO sm_qc_inspections"))).toBe(true);
  expect(statements.some((sql) => sql.includes("UPDATE sm_jobdesc_countdown"))).toBe(false);
  expect(statements.some((sql) => sql.includes("INSERT INTO sm_jobdesc_plan"))).toBe(false);
});

it("blocks inspection for unfinished actual work", async () => {
  const connection = {
    beginTransaction: async () => undefined, rollback: async () => undefined, release: () => undefined,
    query: async () => [[{ isTechnicalJob: 1, workCompleted: 0 }]],
  };
  const repository = new MySqlQcRepository(() => ({ getConnection: async () => connection }) as never);
  const error = await repository.passInspection({ actorId: "QA", qcLevel: "QC_QA" }, {
    coreId: "CD-1", payload: { notes: null, inspectionDurationMinutes: null, photoBeforeUrl: null, evidencePhotoUrl: null },
  }).then(() => null, (error: Error) => error.message);
  expect(error).toBe("QC_WORK_NOT_COMPLETED");
});
