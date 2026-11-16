import { describe, expect, it } from "bun:test";
import { HttpJobPlanRuntimeReadModel } from "./job-plan-runtime-read-model";

function item(id: number) {
  return { plan_id: `PLAN-${id}`, core_id: "CORE-1", car_id: "CAR-1", panel_id: 1, division_id: 4,
    employee_id: "EMP-1", task_date: "2026-10-30", planned_start_minute: 480, planned_finish_minute: 540,
    planned_work_minutes: 60, approval_state: "APPROVED", execution_state: "HOLD", ledger_state: "UNMATERIALIZED",
    legacy_status: null, urgent: false, is_rework: false, is_overtime: false, is_priority: false, note: null,
    source: "V2_REDIS", progress_percent: 80.5, execution_note: "Menunggu sparepart",
    execution_segments: [{ segment_id: `SEG-${id}`, started_at: "2026-10-30T08:00:00+07:00", finished_at: "2026-10-30T09:00:00+07:00", break_minutes: 0, worked_minutes: 60, close_reason: "HOLD" }],
  };
}

describe("runtime read pagination", () => {
  it("retains manual progress and segment history beyond the first 200 plans", async () => {
    const calls: string[] = [];
    const fetcher = (async (url: string) => {
      calls.push(url);
      const items = new URL(url).searchParams.get("page") === "1" ? Array.from({ length: 200 }, (_, i) => item(i)) : [item(200)];
      return Response.json({ statusCode: 200, success: true, message: "OK", data: { items, count: items.length } });
    }) as typeof fetch;
    const result = await new HttpJobPlanRuntimeReadModel(fetcher, "http://runtime").listByCoreIds("EMP-1", ["CORE-1", "CORE-1"]);
    expect(result.length).toBe(201);
    expect(calls.length).toBe(2);
    expect(result[200]?.progress_percent).toBe(80.5);
    expect(result[200]?.execution_segments?.[0]?.worked_minutes).toBe(60);
  });
  it("forwards server capabilities and an explicit empty denial for the requested actor", async () => {
    let requestedUser: string | null = null;
    const fetcher = (async (url: string) => {
      requestedUser = new URL(url).searchParams.get("userId");
      return Response.json({ statusCode: 200, success: true, message: "OK", data: {
        items: [{ ...item(1), available_actions: ["monitor", "validate"] },
          { ...item(2), available_actions: [], availableActions: ["approve"] }], count: 2,
      } });
    }) as typeof fetch;
    const rows = await new HttpJobPlanRuntimeReadModel(fetcher, "http://runtime").listByCoreIds("REVIEWER-1", ["CORE-1"]);
    expect(requestedUser).toBe("REVIEWER-1");
    expect(rows[0]?.available_actions).toEqual(["monitor", "validate"]);
    expect(rows[1]?.available_actions).toEqual([]);
  });

});
