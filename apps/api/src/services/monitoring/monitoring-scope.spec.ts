import { describe, it } from "bun:test";
import assert from "node:assert/strict";
import { DefaultMonitoringService } from "./monitoring.service";
import { MySqlMonitoringRepository } from "@/repositories/monitoring/monitoring.repo";

function scope() {
  return { canViewAllUnits: true, canViewAssignedUnits: true, divisionIds: [4, 5], managedDivisionIds: [4], unitIds: ["CAR-OTHER"] };
}

describe("Monitoring KD division scope", () => {
  it("caps every Monitoring repository entry point and cache key without mutating session scope", async () => {
    const calls: Array<{ scope: ReturnType<typeof scope> & { divisionOnly?: boolean } }> = [];
    const repository = {
      listTasks: async (params: never) => { calls.push(params); return { rows: [], total: 0 }; },
      getSummary: async (params: never) => { calls.push(params); return {}; },
      listReferences: async (params: never) => { calls.push(params); return { divisions: [], units: [], employees: [] }; },
      listDivisionLoad: async (params: never) => { calls.push(params); return []; },
      getDivisionDetail: async (params: never) => { calls.push(params); return { divisionName: null, summary: {}, units: [], members: [] }; },
      listUnitLoad: async (params: never) => { calls.push(params); return []; },
      listEmployeeTimesheet: async (params: never) => { calls.push(params); return []; },
      submitActualToLedger: async (params: never) => { calls.push(params); return { ledgerId: "LEDGER-1", alreadySubmitted: false }; },
    };
    const session = { user: { employeeId: "SCOPE-KD-1", roleName: "KETUA_DIVISI", divisionId: 4, divisionName: "Body", scope: scope() } };
    const service = new DefaultMonitoringService(repository as never);
    await service.listToday(session as never, { page: 1, limit: 20, search: "", sortBy: "taskDate", sortDirection: "asc", view: null, filters: [{ field: "divisionId", operator: "eq", value: "9" }] });
    await service.listNoStart(session as never);
    await service.listNoSubmit(session as never);
    await service.listDivisionLoad(session as never);
    await service.getDivisionDetail(session as never, 9);
    await service.listUnitLoad(session as never);
    await service.listEmployeeTimesheet(session as never, "2026-10-31", "2026-10-31");
    await service.submitActualToLedger(session as never, "ACT-1");
    assert(calls.length >= 10);
    for (const params of calls) {
      assert.equal(params.scope.divisionOnly, true);
      assert.equal(params.scope.canViewAllUnits, false);
      assert.equal(params.scope.canViewAssignedUnits, false);
      assert.deepEqual(params.scope.divisionIds, [4, 5]);
    }
    assert.equal(session.user.scope.canViewAllUnits, true);
    const before = calls.length;
    await service.listReferences({ user: { ...session.user, roleName: "MP" } } as never);
    assert.equal(calls.length, before + 1);
    assert.equal(calls.at(-1)!.scope.canViewAllUnits, true);
  });

  it("uses division-only SQL for rows, aggregates, references and ledger, including empty scope", async () => {
    const calls: Array<{ sql: string; params: unknown[] }> = [];
    const connection = {
      beginTransaction: async () => undefined, rollback: async () => undefined, release: () => undefined,
      query: async (sql: string, params: unknown[] = []) => { calls.push({ sql, params }); return [[]]; },
    };
    const pool = { query: connection.query, getConnection: async () => connection };
    const repository = new MySqlMonitoringRepository(() => pool as never);
    const params = { employeeId: "KD-1", scope: { ...scope(), canViewAllUnits: false, canViewAssignedUnits: false, divisionOnly: true } };
    await repository.listTasks({ ...params, mode: "all", query: { page: 1, limit: 20, search: "", sortBy: "taskDate", sortDirection: "asc", view: null, date: "2026-10-31", filters: [{ field: "divisionId", operator: "eq", value: "9" }] } });
    await repository.getSummary({ ...params, date: "2026-10-31" });
    await repository.listEmployeeTimesheet({ ...params, date: "2026-10-31", dateTo: "2026-10-31" });
    await repository.listReferences(params);
    await assert.rejects(repository.submitActualToLedger({ ...params, actorId: "KD-1", actorName: "KD" }, "ACT-1"));
    const scoped = calls.filter(call => /FROM sm_jobdesc_plan p|SELECT a.submitted_to_ledger/u.test(call.sql));
    assert(scoped.length >= 5);
    for (const call of scoped) {
      assert.match(call.sql, /division_id[^\n]*IN \(\?, \?\)/u);
      assert(!call.sql.includes("p.assigned_user_id = ?"));
      assert(!call.sql.includes("cpa_scope"));
      assert(call.params.includes(4) && call.params.includes(5));
    }
    const employees = calls.find(call => call.sql.includes("FROM sm_employee e") && call.sql.includes("AS value"))!;
    assert.match(employees.sql, /e\.division_id IN \(\?, \?\)/u);
    const units = calls.find(call => call.sql.includes("FROM cars c") && call.sql.includes("AS value"))!;
    assert.match(units.sql, /cd_scope\.division_id IN \(\?, \?\)/u);
    assert(!units.params.includes("CAR-OTHER"));
    calls.length = 0;
    await repository.listReferences({ ...params, scope: { ...params.scope, divisionIds: [] } });
    assert.equal(calls.length, 3);
    for (const call of calls) assert.match(call.sql, /1 = 0/u);
  });

});
