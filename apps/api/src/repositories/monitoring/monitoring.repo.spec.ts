import { describe, it } from "bun:test";
import assert from "node:assert/strict";
import { MySqlMonitoringRepository } from "./monitoring.repo";

function submissionFixture(historicalUnbilled: number, existingLedgerId?: string) {
  const transactions = { commits: 0, rollbacks: 0, releases: 0 };
  const writes: Array<{ sql: string; params: unknown[] }> = [];
  const connection = {
    beginTransaction: async () => undefined,
    commit: async () => { transactions.commits += 1; },
    rollback: async () => { transactions.rollbacks += 1; },
    release: () => { transactions.releases += 1; },
    query: async (sql: string) => {
      if (sql.includes("FROM sm_work_ledger")) {
        return [existingLedgerId ? [{ id: existingLedgerId }] : []];
      }
      return [[{
        submittedToLedger: 0, historicalUnbilled, planId: "PLAN-1", countdownId: "CD-1",
        carId: "UNIT-1", divisionId: 7, employeeId: "EMP-1", employeeName: "Teknisi",
        workDate: "2026-10-30", startTime: "08:00:00", finishTime: "10:00:00",
        breakHours: 0, durationHours: historicalUnbilled ? null : 2, overtimeHours: 0,
        progressPercent: 100, progressNotes: null, actualStatus: "done",
      }]];
    },
    execute: async (sql: string, params: unknown[]) => {
      writes.push({ sql, params });
      return [{ affectedRows: 1 }];
    },
  };
  const repository = new MySqlMonitoringRepository(() => ({ getConnection: async () => connection }) as never);
  const submit = () => repository.submitActualToLedger({
    employeeId: "EMP-1", actorId: "EMP-1", actorName: "Teknisi",
    scope: { canViewAllUnits: true, canViewAssignedUnits: false, divisionIds: [], managedDivisionIds: [], unitIds: [] },
  }, "ACTUAL-1");
  return { transactions, writes, submit };
}

describe("monitoring ledger historical billing guard", () => {
  it("rolls back historical work without writing a ledger or marking it submitted", async () => {
    const { transactions, writes, submit } = submissionFixture(1);

    await assert.rejects(submit(), /HISTORICAL_UNBILLED_LEDGER_FORBIDDEN/);

    assert.equal(writes.length, 0);
    assert.deepEqual(transactions, { commits: 0, rollbacks: 1, releases: 1 });
  });

  it("still commits ordinary work with its billable hours", async () => {
    const { transactions, writes, submit } = submissionFixture(0);

    const result = await submit();

    assert.equal(result.alreadySubmitted, false);
    assert.ok(result.ledgerId);
    assert.equal(writes[0].params[12], 2);
    assert.equal(writes.length, 3);
    assert.deepEqual(transactions, { commits: 1, rollbacks: 0, releases: 1 });
  });

  it("returns an existing submission without duplicating or rewriting it", async () => {
    const { transactions, writes, submit } = submissionFixture(0, "LEDGER-1");

    assert.deepEqual(await submit(), { ledgerId: "LEDGER-1", alreadySubmitted: true });
    assert.equal(writes.length, 0);
    assert.deepEqual(transactions, { commits: 0, rollbacks: 1, releases: 1 });
  });
});
