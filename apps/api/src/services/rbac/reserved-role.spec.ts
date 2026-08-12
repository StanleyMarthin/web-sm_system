import { describe, expect, it } from "bun:test";

import { isQaRole } from "./reserved-role";

describe("isQaRole", () => {
  it("accepts all legacy QA role names", () => {
    for (const roleName of ["advisor", "Advisor", "adv", "qa", "quality assurance", "quality_assurance"]) {
      expect(isQaRole(roleName)).toBe(true);
    }
  });

  it("does not match unrelated roles", () => {
    expect(isQaRole("kepala_divisi")).toBe(false);
  });
});
