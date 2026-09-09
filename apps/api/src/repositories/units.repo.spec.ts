import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";

describe("unit panel operational detail relations", () => {
  const source = readFileSync(new URL("./units.repo.ts", import.meta.url), "utf8");
  const detailMethod = source.slice(
    source.indexOf("async findUnitPanelDetail"),
    source.indexOf("async findGeneralUnitPanels"),
  );

  it("uses clean master panel relationships for operational activity", () => {
    expect(detailMethod).toContain("cd.panel_id = ?");
    expect(detailMethod).toContain("h.master_panel_id = ?");
    expect(detailMethod).toContain("w.master_panel_id = ?");
    expect(detailMethod).toContain("w.id = cd.ref_taks_id");
    expect(detailMethod).toContain("cd.id = w.core_id");
    expect(detailMethod).toContain("pr.master_panel_id = ?");
  });

  it("deduplicates activity rows by type and id", () => {
    expect(detailMethod).toContain("new Map<string, UnitPanelActivity>()");
    expect(detailMethod).toContain("activityMap.set(`${activity.type}:${activity.id}`");
    expect(detailMethod).toContain("const activities = [...activityMap.values()]");
  });

  it("does not link operational activity by snapshot strings", () => {
    expect(detailMethod.includes("panel_name = ?")).toBe(false);
    expect(detailMethod.includes("component_name = ?")).toBe(false);
    expect(detailMethod.includes("name_part = ?")).toBe(false);
    expect(detailMethod.includes("part_number = ?")).toBe(false);
    expect(detailMethod.includes("item_name = ?")).toBe(false);
  });
});
