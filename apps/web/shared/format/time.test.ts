import { describe, expect, it } from "bun:test";
import { parseHHMMToDecimal, PARSE_HHMM_STRICT_PRESERVES_WORKFLOW_VALIDATION } from "./time";

describe("parseHHMMToDecimal", () => {
  it("keeps countdown's lenient parsing by default", () => {
    expect(parseHHMMToDecimal("01:30")).toBe(1.5);
    expect(parseHHMMToDecimal("1")).toBe(1);
    expect(parseHHMMToDecimal("01:99")).toBe(2.65);
    expect(parseHHMMToDecimal("junk")).toBe(0);
  });

  it("keeps workflow-job strict validation when requested", () => {
    expect(PARSE_HHMM_STRICT_PRESERVES_WORKFLOW_VALIDATION).toContain("workflow-job");
    expect(parseHHMMToDecimal("01:30", true)).toBe(1.5);
    expect(parseHHMMToDecimal("1.5", true)).toBe(1.5);
    expect(Number.isNaN(parseHHMMToDecimal("01:99", true))).toBe(true);
    expect(Number.isNaN(parseHHMMToDecimal("junk", true))).toBe(true);
  });
});
