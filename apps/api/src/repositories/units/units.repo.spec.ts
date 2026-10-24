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

  it("stores VIN values in the VIN column", () => {
    expect(source).toContain("c.vin_number AS plateNumber");
    expect(source).toContain("id, unit_name, vin_number, customer_name");
    expect(source).toContain("unit_name = ?, vin_number = ?, customer_name");
    expect(source.includes("plate_number")).toBe(false);
  });

  it("supplies one value for every unit intake column", () => {
    const createUnitMethod = source.slice(
      source.indexOf("async createUnit"),
      source.indexOf("async updateUnit"),
    );

    expect(createUnitMethod).toContain("VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PLAN')");
  });
});
