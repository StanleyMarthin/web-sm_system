import { describe, expect, it } from "bun:test";
import { formatCountdownImportIssue, formatCountdownStatus } from "../countdown-copy";

const componentDir = import.meta.dir;
const sourceFiles = [
  "countdown-board-shell.tsx",
  "countdown-detail-shell.tsx",
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
