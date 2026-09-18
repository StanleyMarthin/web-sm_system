import { describe, expect, it } from "bun:test";
import {
  addIsoDays,
  filterApprovalQueueRows,
  filterExecutionRows,
  isReviewState,
  resolveApprovalDateWindow,
  resolveDefaultApprovalStage,
  resolveMonitoringBoardView,
  summarizeExecutionSelection,
} from "./monitoring-views";

function row(planId: string, approvalState: string | null) {
  return { planId, approvalState } as never;
}

describe("monitoring board view", () => {
  it("defaults to operational and only accepts known views", () => {
    expect(resolveMonitoringBoardView(null)).toBe("operational");
    expect(resolveMonitoringBoardView("")).toBe("operational");
    expect(resolveMonitoringBoardView("bogus")).toBe("operational");
    expect(resolveMonitoringBoardView("approval")).toBe("approval");
    expect(resolveMonitoringBoardView("execution")).toBe("execution");
  });
});

describe("monitoring approval stage per role", () => {
  it("maps KD, KP, and management to their review stage", () => {
    expect(resolveDefaultApprovalStage("KD BODY WORK", false)).toBe("DIVISION_REVIEW");
    expect(resolveDefaultApprovalStage("KP PRODUKSI", false)).toBe("UNIT_REVIEW");
    expect(resolveDefaultApprovalStage("MANAGER PRODUKSI", false)).toBe("MANAGEMENT_REVIEW");
  });

  it("lets admin see all stages and keeps unknown roles unfiltered", () => {
    expect(resolveDefaultApprovalStage("SUPER ADMIN", true)).toBe(null);
    expect(resolveDefaultApprovalStage("MIS", false)).toBe(null);
    expect(resolveDefaultApprovalStage(null, false)).toBe(null);
  });
});

describe("monitoring board row filters", () => {
  const rows = [
    row("P-1", "DRAFT"),
    row("P-2", "DIVISION_REVIEW"),
    row("P-3", "UNIT_REVIEW"),
    row("P-4", "MANAGEMENT_REVIEW"),
    row("P-5", "APPROVED"),
    row("P-6", "REJECTED"),
  ];

  it("keeps only review stages in the approval queue", () => {
    expect(isReviewState("DRAFT")).toBe(false);
    expect(isReviewState("APPROVED")).toBe(false);
    expect(filterApprovalQueueRows(rows, null).map((item) => item.planId)).toEqual(["P-2", "P-3", "P-4"]);
  });

  it("narrows the queue to the role stage but never hides other stages from admin", () => {
    expect(filterApprovalQueueRows(rows, "DIVISION_REVIEW").map((item) => item.planId)).toEqual(["P-2"]);
    expect(filterApprovalQueueRows(rows, "UNIT_REVIEW").map((item) => item.planId)).toEqual(["P-3"]);
    expect(filterApprovalQueueRows(rows, "MANAGEMENT_REVIEW").map((item) => item.planId)).toEqual(["P-4"]);
  });

  it("shows only approved plans in execution monitoring", () => {
    expect(filterExecutionRows(rows).map((item) => item.planId)).toEqual(["P-5"]);
    expect(filterExecutionRows([])).toEqual([]);
  });

  it("never leaks draft or review rows into execution monitoring", () => {
    const mixed = [
      row("P-1", "DRAFT"),
      row("P-2", "DIVISION_REVIEW"),
      row("P-3", "UNIT_REVIEW"),
      row("P-4", "MANAGEMENT_REVIEW"),
      row("P-5", "APPROVED"),
      row("P-6", null),
    ];

    expect(filterExecutionRows(mixed).map((item) => item.planId)).toEqual(["P-5"]);
  });
});

describe("execution selection summary", () => {
  it("adds hours and averages progress for the selected rows", () => {
    expect(summarizeExecutionSelection([
      { targetTotalHours: 8, totalActualHours: 3, remainingHours: 5, progressPercent: 40 },
      { targetTotalHours: 4, countdownTargetHours: 6, totalActualHours: 1.5, remainingHours: 2.5, progressPercent: 60 },
    ] as never)).toEqual({
      count: 2,
      targetHours: 12,
      actualHours: 4.5,
      remainingHours: 7.5,
      averageProgressPercent: 50,
    });
  });

  it("returns zeroes when nothing is selected", () => {
    expect(summarizeExecutionSelection([])).toEqual({
      count: 0,
      targetHours: 0,
      actualHours: 0,
      remainingHours: 0,
      averageProgressPercent: 0,
    });
  });
});

describe("monitoring approval date window", () => {
  it("adds days across month and year boundaries", () => {
    expect(addIsoDays("2026-09-18", 5)).toBe("2026-09-23");
    expect(addIsoDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(addIsoDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("widens the queue beyond today when the user has no explicit date filter", () => {
    expect(resolveApprovalDateWindow("2026-09-18", false)).toEqual({
      from: "2026-08-19",
      to: "2026-10-18",
    });
  });

  it("never overrides an explicit date filter", () => {
    expect(resolveApprovalDateWindow("2026-09-18", true)).toBe(null);
  });
});
