import { describe, expect, test } from "bun:test";
import { buildPlanningNarrative } from "./adaptive-dashboard-tab";

describe("buildPlanningNarrative", () => {
  test("explains blocked work before overtime or risk", () => {
    const narrative = buildPlanningNarrative({
      selectedUnitCount: 3,
      readyHours: 30,
      blockedHours: 8,
      needOvertimeCount: 1,
      highRiskCount: 1,
    });

    expect(narrative.title).toBe("Sebagian pekerjaan belum bisa dimulai");
    expect(narrative.explanation).toContain("8 jam");
  });

  test("states plainly when the plan is ready", () => {
    const narrative = buildPlanningNarrative({
      selectedUnitCount: 2,
      readyHours: 24,
      blockedHours: 0,
      needOvertimeCount: 0,
      highRiskCount: 0,
    });

    expect(narrative.title).toBe("Rencana minggu ini siap dijalankan");
  });
});
