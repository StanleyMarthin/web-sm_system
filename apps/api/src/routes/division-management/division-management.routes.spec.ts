import { describe, expect, it } from "bun:test";
import { createsDivisionCycle } from "./division-management.helpers";

describe("createsDivisionCycle", () => {
  const parents = new Map<number, number | null>([
    [10, null],
    [11, 10],
    [12, 11],
  ]);

  it("rejects a team becoming an ancestor of itself", () => {
    expect(createsDivisionCycle(10, 12, parents)).toBe(true);
  });

  it("allows a parent outside the division branch", () => {
    expect(createsDivisionCycle(12, 10, parents)).toBe(false);
  });
});
