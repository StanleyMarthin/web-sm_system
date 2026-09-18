import { describe, expect, it } from "bun:test";
import {
  formatCountdownImportIssue,
  formatCountdownStatus,
  formatCountdownStatusLabel,
  hasCountdownTargetRevision,
} from "../countdown-copy";

const componentDir = import.meta.dir;
const sourceFiles = [
  "countdown-board-shell.tsx",
  "countdown-detail-shell.tsx",
  "countdown-job-plan-section.tsx",
  "countdown-actual-section.tsx",
  "countdown-master-panel.tsx",
  "countdown-documentation-section.tsx",
  "forms/countdown-board-form.tsx",
];

describe("countdown UI copy", () => {
  it("keeps standard status wording without underscores", () => {
    expect(formatCountdownStatus("QC_READY")).toBe("QC READY");
    expect(formatCountdownStatus("ON_PROGRESS")).toBe("ON PROGRESS");
  });

  it("hides internal import field names", () => {
    expect(formatCountdownImportIssue("targetHoursInitial", "targetHoursInitial tidak valid.")).toEqual([
      "Target awal",
      "Target awal tidak valid.",
    ]);
  });

  it("renders one status label with lateness folded in", () => {
    expect(formatCountdownStatusLabel({ status: "PLAN", isOverdue: false, progressPercent: 0 })).toBe("Menunggu");
    expect(formatCountdownStatusLabel({ status: "PROSES", isOverdue: false, progressPercent: 40 })).toBe("On Progress");
    expect(formatCountdownStatusLabel({ status: "QC_READY", isOverdue: false, progressPercent: 90 })).toBe("Siap QC");
    expect(formatCountdownStatusLabel({ status: "DONE", isOverdue: false, progressPercent: 100 })).toBe("Selesai");
    expect(formatCountdownStatusLabel({ status: "PROSES", isOverdue: true, progressPercent: 40 })).toBe("Terlambat");
    expect(formatCountdownStatusLabel({ status: "DONE", isOverdue: true, progressPercent: 100 })).toBe("Selesai");
  });

  it("flags a target revision only when active target differs from initial", () => {
    expect(hasCountdownTargetRevision({ targetHoursInitial: 10, targetHoursRevised: 12 })).toBe(true);
    expect(hasCountdownTargetRevision({ targetHoursInitial: 10, targetHoursRevised: 10 })).toBe(false);
  });

  it("uses human Indonesian labels instead of raw system wording", async () => {
    const source = (
      await Promise.all(sourceFiles.map((file) => Bun.file(`${componentDir}/${file}`).text()))
    ).join("\n");

    for (const wording of [
      'label: "Actual"',
      'label: "Remaining"',
      'label: "Risk"',
      'label: "Action"',
      '"Overdue" : "On Track"',
      ">Del<",
      "Countdown Detail",
      ">Role<",
      "Belum ada history detail.",
      ">Main<",
      ">Additional<",
      "Detail Job Description",
      ">Start Date<",
      '"Uploading..."',
      "Inserted:",
      "Updated:",
      "Rejected:",
      "Row {issue.rowNumber}",
    ]) {
      expect(source).not.toContain(wording);
    }
  });
});
