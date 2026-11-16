import { describe, expect, it } from "bun:test";
import assert from "node:assert/strict";
import { jobPlanGridQuerySchema, jobPlanRecordSchema } from "@smsystem/contracts/job-plan";
import { MySqlJobPlanRepository } from "./job-plan.repo";

const scope = { canViewAllUnits: true, canViewAssignedUnits: false, divisionIds: [], managedDivisionIds: [], unitIds: [] };
const row = {
  planId: "PLAN-1", coreId: "CORE-1", taskDate: "2026-10-21", unitName: "Unit A",
  divisionId: 10, divisionName: "BODY WORK", assignedUserId: "EMP-1", assignedUserName: "Technician",
  targetHours: 2, targetTotalHours: 2, startTime: "08:00", finishTime: "10:00", isOvertime: 0, isPriority: 0,
  status: "done", jobDescription: "Repair", note: null, availablePlanHours: 0, remainingHours: 0, progressPercent: 100,
  actualStatus: "done",
};

describe("Job Plan repository status boundaries", () => {
  function repository(status: string) {
    const statements: Array<{ sql: string; params: unknown[] }> = [];
    const repo = new MySqlJobPlanRepository(() => ({ query: async (sql: string, params: unknown[]) => {
      statements.push({ sql, params });
      if (sql.includes("p.id AS planId")) return [[{ ...row, status }]];
      if (sql.includes("COUNT(*) AS total")) return [[{ total: 1 }]];
      return [[{ totalHours: 2, pendingCount: 0, approvedCount: 0, overtimeCount: 0 }]];
    } }) as never);
    return { repo, statements };
  }

  it("returns canonical Plan status for historical rows while retaining Actual casing", async () => {
    for (const status of ["done", " DoNe ", "onprogress", "OnPrOgReSs"]) {
      const { repo } = repository(status);
      const result = await repo.list({ employeeId: "EMP-1", scope, query: jobPlanGridQuerySchema.parse({}) });
      expect(result.rows[0]?.status).toBe(status.trim().toUpperCase());
      expect(jobPlanRecordSchema.safeParse(result.rows[0]).success).toBe(true);
      expect(result.rows[0]?.actualStatus).toBe("done");
    }
  });

  it("rejects unknown persisted Plan status rather than casting it as valid", async () => {
    const { repo } = repository("archived");
    await assert.rejects(() => repo.list({ employeeId: "EMP-1", scope, query: jobPlanGridQuerySchema.parse({}) }), /Invalid option/);
  });

  it("filters status case-insensitively without relying on database collation", async () => {
    const { repo, statements } = repository("done");
    await repo.list({ employeeId: "EMP-1", scope, query: jobPlanGridQuerySchema.parse({ filters: [{ field: "status", operator: "eq", value: " dOnE " }] }) });
    expect(statements.length).toBe(3);
    for (const statement of statements) {
      expect(statement.sql).toContain("UPPER(TRIM(p.status)) = ?");
      expect(statement.params).toContain("DONE");
    }
  });
});
