import { describe, expect, it } from "bun:test";

import { humanizeCodeLabel } from "./humanize";

describe("humanizeCodeLabel", () => {
  it("shows the legacy advisor approval status as QA", () => {
    expect(humanizeCodeLabel("PENDING_ADVISOR_APPROVAL")).toBe("Menunggu Persetujuan QA");
  });

  it("shows all legacy role names as QA", () => {
    for (const roleName of ["advisor", "adv", "qa", "quality assurance"]) {
      expect(humanizeCodeLabel(roleName)).toBe("QA");
    }
  });
});
