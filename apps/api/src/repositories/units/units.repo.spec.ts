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
    expect(source).toContain("c.police_number AS policeNumber");
    expect(source).toContain("c.vehicle_year AS vehicleYear");
    expect(source).toContain("c.engine_number AS engineNumber");
    expect(source).toContain("c.has_bpkb AS hasBpkb");
    expect(source).toContain("id, unit_name, vin_number, police_number, customer_name, vehicle_year, engine_number, vehicle_color, vehicle_notes");
    expect(source).toContain("unit_name = ?, vin_number = ?, police_number = ?, customer_name = ?, vehicle_year = ?, engine_number = ?, vehicle_color = ?, vehicle_notes = ?");
    expect(source).toContain("params.input.hasBpkb === null ? null : params.input.hasBpkb ? 1 : 0");
    expect(source).toContain("params.input.hasStnk === null ? null : params.input.hasStnk ? 1 : 0");
    expect(source.includes("plate_number")).toBe(false);
  });

  it("searches unit identity by chassis and police number", () => {
    expect(source).toContain("OR COALESCE(ub.plateNumber, '') LIKE ?");
    expect(source).toContain("OR COALESCE(ub.policeNumber, '') LIKE ?");
  });

  it("returns the assigned KD name when an active assignment has one", () => {
    expect(source).toContain("kd.full_name AS kdName");
    expect(source).toContain("LEFT JOIN sm_employee kd ON kd.employee_id = cpa.kd_id");
    expect(source).toContain("kdName: row.kdName");
  });

  it("supplies one value for every unit intake column", () => {
    const createUnitMethod = source.slice(
      source.indexOf("async createUnit"),
      source.indexOf("async updateUnit"),
    );

    expect(createUnitMethod).toContain("VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PLAN')");
  });

  it("keeps historical activity, completion, target, and remaining hours semantically separate in the workspace", () => {
    const workspaceMethod = source.slice(
      source.indexOf("async findUnitWorkspace"),
      source.indexOf("async findUnitBom"),
    );

    expect(workspaceMethod).toContain("actual_history.core_id");
    expect(workspaceMethod).toContain("AS planWithActual");
    expect(workspaceMethod).toContain("AS planWithoutActual");
    expect(workspaceMethod).toContain("AS rawActualHours");
    expect(workspaceMethod).toContain("AS targetHours");
    expect(workspaceMethod).toContain("AS completionRate");
    expect(workspaceMethod).toContain("GREATEST(COALESCE(cd.target_hours, cd.target_hours_initial, 0) - COALESCE(cd.total_actual_hours, 0), 0)");
    expect(workspaceMethod).toContain("AS overrunHours");
    expect(workspaceMethod).toContain("GREATEST(COALESCE(cd.total_actual_hours, 0) - COALESCE(cd.target_hours, cd.target_hours_initial, 0), 0)");
    expect(workspaceMethod.includes("sms_migration_source_map")).toBe(false);
    expect(workspaceMethod.includes("historical_countdown")).toBe(false);
    expect(workspaceMethod.includes("SUM(COALESCE(remaining_hours, 0)) AS remainingHours")).toBe(false);
  });

  it("returns panel operational state and progress from relational data", () => {
    const panelsMethod = source.slice(
      source.indexOf("async findUnitPanels"),
      source.indexOf("async findUnitPanelDetail"),
    );

    expect(panelsMethod).toContain('${this.panelOperationalStatusSql("mp")}');
    expect(panelsMethod).toContain("mp.current_status AS currentStatus");
    expect(panelsMethod).toContain("AS progressPercent");
    expect(panelsMethod).toContain("= COUNT(*) THEN 100");
    expect(panelsMethod).toContain("ELSE COALESCE(actual_progress_percent, 0)");
    expect(source).toContain("private panelOperationalStatusSql");
    expect(source).toContain("ELSE 'MENUNGGU' END AS operationalStatus");
    expect(source.includes("panelWorkStatusSql")).toBe(false);
    expect(source.includes("hasActiveWork")).toBe(false);
    expect(source.includes("hasCompletedWork")).toBe(false);
    expect(source).toContain("sm_jobdesc_wo active_wo");
    expect(source).toContain("active_pr.master_panel_id");
    expect(source).toContain("active_wov.core_id");
  });
});
