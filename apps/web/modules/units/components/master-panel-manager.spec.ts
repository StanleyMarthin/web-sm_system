import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";

describe("master panel operational display", () => {
  const source = readFileSync(new URL("./master-panel-manager.tsx", import.meta.url), "utf8");

  it("renders status and progress supplied by the API", () => {
    expect(source).toContain('record.operationalStatus === "PROSES"');
    expect(source).toContain('record.operationalStatus === "SELESAI"');
    expect(source).toContain("part.progressPercent");
    expect(source.includes("master-panel-progress")).toBe(false);
    expect(source.includes("hasActiveWork")).toBe(false);
    expect(source.includes("hasCompletedWork")).toBe(false);
    expect(source.includes("isRestorationPart")).toBe(false);
  });
});
