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
      { actorId: "ADV-1", qcLevel: "QC_ADVISOR" },
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
      "QC_ADVISOR",
      0,
      "ADV-1",
      "CD-1",
    ]);
  });
});
