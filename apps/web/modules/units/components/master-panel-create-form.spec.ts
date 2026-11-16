import { describe, expect, it } from "bun:test";
import type { UnitPanelRecord } from "@smsystem/contracts/unit-panel";
import { buildUnitPanelCreateInput, type PanelCreateValues } from "./master-panel-create-form";

const values: PanelCreateValues = {
  parentId: null, category: "BODY", name: "FRONT BUMPER", partNumber: "", qty: "1",
  initialCondition: "BEKAS", currentStatus: "UNKNOWN", notes: "",
};
const parent = { id: 11, category: "BODY", section: "FRONT BUMPER", name: "Bumper assembly" } as UnitPanelRecord;

describe("new operational panel and child part", () => {
  it("creates a root panel with one name and no invented parent", () => {
    const input = buildUnitPanelCreateInput(values, null);
    expect(input.parentId).toBeNull();
    expect(input.name).toBe("FRONT BUMPER");
    expect(input.section).toBe("FRONT BUMPER");
    expect(input.category).toBe("BODY");
  });

  it("links a child by ID and inherits its parent's grouping", () => {
    const input = buildUnitPanelCreateInput({ ...values, parentId: 11, category: "Wrong stale category", name: "Foglamp bracket", qty: "2" }, parent);
    expect(input.parentId).toBe(11);
    expect(input.category).toBe("BODY");
    expect(input.section).toBe("FRONT BUMPER");
    expect(input.name).toBe("Foglamp bracket");
    expect(input.qty).toBe(2);
  });

  it("allows a part to be the parent of another part", () => {
    const part = { ...parent, id: 12, parentId: 11, name: "Foglamp bracket" };
    expect(buildUnitPanelCreateInput({ ...values, parentId: 12, name: "Mounting tab" }, part).parentId).toBe(12);
  });

  it("rejects a missing or stale parent selection instead of creating a root", () => {
    expect(() => buildUnitPanelCreateInput({ ...values, parentId: 99 }, null)).toThrow();
    expect(() => buildUnitPanelCreateInput({ ...values, parentId: 99 }, parent)).toThrow();
  });

  it("keeps inventory constraints from the shared contract", () => {
    for (const qty of ["0", "-1", "NaN", "100001"]) {
      expect(() => buildUnitPanelCreateInput({ ...values, qty }, null)).toThrow();
    }
    expect(() => buildUnitPanelCreateInput({ ...values, name: " " }, null)).toThrow();
  });
});
