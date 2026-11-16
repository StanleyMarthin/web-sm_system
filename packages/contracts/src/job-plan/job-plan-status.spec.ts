import { describe, expect, it } from "bun:test";
import {
  jobPlanGridEnvelopeSchema,
  jobPlanRecordSchema,
  jobPlanStatusSchema,
  updateJobPlanStatusRequestSchema,
} from "./job-plan";
import {
  jobPlanRuntimeApprovalStateSchema,
  jobPlanRuntimeExecutionStateSchema,
  jobPlanRuntimeLedgerStateSchema,
} from "./job-plan-runtime";

const historicalRecord = {
  planId: "PLAN-1",
  coreId: "CORE-1",
  taskDate: "2026-10-21",
  unitName: "Unit A",
  divisionId: 10,
  divisionName: "BODY WORK",
  assignedUserId: "EMP-1",
  assignedUserName: "Technician",
  targetHours: 2,
  startTime: "08:00",
  finishTime: "10:00",
  isOvertime: false,
  isPriority: false,
  status: "done",
  jobDescription: "Historical repair",
  note: null,
  remainingHours: 0,
  progressPercent: 100,
  actualStatus: "done",
};

describe("Job Plan status normalization", () => {
  it("accepts case variants and whitespace while retaining canonical values", () => {
    for (const [input, expected] of [["done", "DONE"], [" DoNe ", "DONE"], ["onprogress", "ONPROGRESS"], [" pending_adv ", "PENDING_ADV"]]) {
      expect(jobPlanStatusSchema.parse(input)).toBe(expected);
      expect(updateJobPlanStatusRequestSchema.parse({ status: input }).status).toBe(expected);
    }
  });

  it("rejects unknown states and non-string values", () => {
    for (const value of ["", "archived", "on_progress", null, 1, true, { status: "DONE" }]) {
      expect(jobPlanStatusSchema.safeParse(value).success).toBe(false);
      expect(updateJobPlanStatusRequestSchema.safeParse({ status: value }).success).toBe(false);
    }
  });

  it("loads historical grid records without changing the Actual status enum", () => {
    const payload = jobPlanGridEnvelopeSchema.parse({
      success: true,
      message: "ok",
      data: [historicalRecord, { ...historicalRecord, planId: "PLAN-2", status: "onprogress" }],
      meta: { page: 1, limit: 25, total: 2, totalPages: 1, hasNext: false, hasPrev: false },
      query: {},
      references: { employees: [], divisions: [], units: [], countdowns: [], workOrders: [], panels: [], jobTypes: [], statuses: [] },
      summary: { totalHours: 4, pendingCount: 0, approvedCount: 0, overtimeCount: 0 },
    });
    expect(payload.data.map((row) => row.status)).toEqual(["DONE", "ONPROGRESS"]);
    expect(payload.data[0]?.actualStatus).toBe("done");
    expect(jobPlanRecordSchema.safeParse({ ...historicalRecord, status: "archived" }).success).toBe(false);
  });

  it("normalizes runtime state casing without accepting unrelated states", () => {
    expect(jobPlanRuntimeApprovalStateSchema.parse(" approved ")).toBe("APPROVED");
    expect(jobPlanRuntimeExecutionStateSchema.parse(" VaLiDaTeD ")).toBe("VALIDATED");
    expect(jobPlanRuntimeLedgerStateSchema.parse(" finalized ")).toBe("FINALIZED");
    expect(jobPlanRuntimeApprovalStateSchema.safeParse("done").success).toBe(false);
    expect(jobPlanRuntimeExecutionStateSchema.safeParse("done").success).toBe(false);
    expect(jobPlanRuntimeLedgerStateSchema.safeParse("unknown").success).toBe(false);
  });
});
