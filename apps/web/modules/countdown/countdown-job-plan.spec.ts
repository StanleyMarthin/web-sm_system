import { describe, expect, it } from "bun:test";
import { resolveCountdownPlanProgress } from "./countdown-job-plan";

describe("countdown plan progress", () => {
  it("reads plan versus actual minutes", () => {
    expect(
      resolveCountdownPlanProgress({ planned_work_minutes: 480, accumulated_work_minutes: 312 }),
    ).toEqual({ plannedMinutes: 480, workedMinutes: 312, remainingMinutes: 168, percent: 65 });
  });

  it("keeps remaining at zero and progress at 100 when actual passes the plan", () => {
    expect(
      resolveCountdownPlanProgress({ planned_work_minutes: 60, accumulated_work_minutes: 90 }),
    ).toEqual({ plannedMinutes: 60, workedMinutes: 90, remainingMinutes: 0, percent: 100 });
  });

  it("does not divide by a zero plan", () => {
    expect(
      resolveCountdownPlanProgress({ planned_work_minutes: 0, accumulated_work_minutes: 60 }).percent,
    ).toBe(0);
  });
});
