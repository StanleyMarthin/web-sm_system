import { describe, expect, test } from "bun:test";
import { buildAutoPlanEntries, isTargetEntryComplete } from "./target-work-step";

describe("buildAutoPlanEntries", () => {
  test("fills targets from open countdown jobs without manual input", () => {
    const entries = buildAutoPlanEntries(
      {
        carId: "unit-1",
        unitName: "B 1234 CD",
        customerName: "Sahrul",
        involvedDivisions: [{ divisionId: 7, pendingHours: 12 }],
        riskLevel: "HIGH",
        suggestedFinishDate: "2026-08-16",
        jobs: [
          {
            jobId: "job-1",
            divisionId: "7",
            divisionName: "Body Repair",
            jobName: "Perbaikan pintu",
            panel: "Pintu kanan",
            status: "IN_PROGRESS",
            remainingHours: 6,
            estimatedHours: 8,
            deadlineDate: "2026-08-15",
            dependsOn: [],
            qcLastStatus: null,
          },
        ],
      },
      "2026-08-17",
    );

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      carId: "unit-1",
      targetOutput: "Perbaikan pintu — Pintu kanan",
      divisionId: 7,
      targetHours: 6,
      targetFinishDate: "2026-08-15",
      priority: "IMPORTANT",
      riskLevel: "HIGH",
    });
    expect(isTargetEntryComplete(entries[0]!)).toBe(true);
  });

  test("keeps an incomplete row when source data needs manual completion", () => {
    const entries = buildAutoPlanEntries(
      {
        carId: "unit-2",
        unitName: "B 9876 EF",
        customerName: null,
        involvedDivisions: [{ divisionId: 8, pendingHours: 0 }],
        riskLevel: "LOW",
        suggestedFinishDate: null,
        jobs: [],
      },
      "2026-08-17",
    );

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      carId: "unit-2",
      divisionId: 8,
      targetHours: 0,
      targetFinishDate: "2026-08-17",
    });
    expect(isTargetEntryComplete(entries[0]!)).toBe(false);
  });
});
