import { describe, expect, it } from "bun:test";
import assert from "node:assert/strict";
import { createUnitPanelRequestSchema, updateUnitPanelRequestSchema } from "@smsystem/contracts/unit-panel";
import type { ApiEnv } from "@/config/env";
import { UnitsRepository } from "./units.repo";

type Panel = { id: number; carId: string; name: string; section: string; category: string; parentId: number | null; qty?: number };
const scope = { canViewAllUnits: true, canViewAssignedUnits: false, divisionIds: [], managedDivisionIds: [], unitIds: [] };
const actor = { unitId: "UNIT-1", employeeId: "EMP-1", actorId: "EMP-1", scope };
const env = { PURCHASE_DB_NAME: "sms_purchase", WAREHOUSE_DB_NAME: "sms_warehouse", CLIENT_DB_NAME: "sms_client" } as ApiEnv;
const initial: Panel[] = [
  { id: 1, carId: "UNIT-1", name: "Bumper", section: "Depan", category: "BODY", parentId: null },
  { id: 2, carId: "UNIT-1", name: "Bracket", section: "Depan", category: "BODY", parentId: 1 },
  { id: 3, carId: "OTHER-UNIT", name: "Foreign", section: "Depan", category: "BODY", parentId: null },
];

function fixture(hasParent = true, insertFailure: "missing-id" | "other-column" | null = null) {
  let panels = structuredClone(initial);
  let backup: Panel[] = [];
  let commits = 0;
  let rollbacks = 0;
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const row = (panel: Panel) => ({
    ...panel,
    parentId: hasParent ? panel.parentId : null,
    childCount: hasParent ? panels.filter((child) => child.carId === panel.carId && child.parentId === panel.id).length : 0,
    isActive: 1, qty: panel.qty ?? 1, operationalStatus: "MENUNGGU", progressPercent: 0,
    sortOrder: 0, defaultLocationType: "UNIT", defaultStockStatus: "INSTALLED", defaultConditionType: "BEKAS",
    countdownUsageCount: 0, statusUsageCount: 0, createdAt: null, updatedAt: null,
  });
  const pool = {
    getConnection: async () => pool,
    beginTransaction: async () => { backup = structuredClone(panels); },
    commit: async () => { commits++; },
    rollback: async () => { panels = backup; rollbacks++; },
    release: () => {},
    query: async (sql: string, params: unknown[] = []) => {
      calls.push({ sql, params });
      if (sql.includes("information_schema.columns")) return [[{ columnName: "qty" }, ...(hasParent ? [{ columnName: "parent_id" }] : [])]];
      if (sql.includes("WHERE ub.unitId")) return [[{ unitId: "UNIT-1", unitName: "Unit", vehicleYear: null }]];
      if (sql.includes("FROM cars WHERE id")) return [[{ id: params[0] }]];
      if (sql.includes("COALESCE(MAX(id), 0) + 1 AS nextId")) return [[{ nextId: Math.max(...panels.map((p) => p.id)) + 1 }]];
      if (sql.includes("SELECT COUNT(*) AS total")) {
        const [unit, section, name, category, parent, excluded] = params;
        return [[{ total: panels.filter((p) => p.carId === unit && p.section === section && p.name === name && p.category === category && (!hasParent || p.parentId === parent) && (!excluded || p.id !== excluded)).length }]];
      }
      if (sql.includes("SELECT id, parent_id AS parentId")) return [panels.filter((p) => p.carId === params[0]).map((p) => ({ id: p.id, parentId: p.parentId }))];
      if (sql.includes("FROM master_panels mp")) {
        const found = panels.filter((p) => p.carId === params[0] && (params.length === 1 || p.id === params[1]));
        return [found.map(row)];
      }
      throw new Error(`Unexpected query: ${sql}`);
    },
    execute: async (sql: string, params: unknown[] = []) => {
      calls.push({ sql, params });
      const map: Record<string, keyof Panel> = { id: "id", car_id: "carId", name_part: "name", panel_name: "section", component_name: "category", parent_id: "parentId", qty: "qty" };
      if (sql.includes("INSERT INTO master_panels")) {
        const columns = sql.split("(")[1]!.split(")")[0]!.split(",").map((c) => c.trim());
        expect((sql.match(/\?/g) ?? []).length).toBe(params.length);
        if (insertFailure && !columns.includes("id")) {
          const field = insertFailure === "missing-id" ? "id" : "created_by";
          throw Object.assign(new Error(`Field '${field}' doesn't have a default value`), {
            code: "ER_NO_DEFAULT_FOR_FIELD", sqlMessage: `Field '${field}' doesn't have a default value`,
          });
        }
        const panel: Panel = { id: Math.max(...panels.map((p) => p.id)) + 1, carId: "", name: "", section: "", category: "", parentId: null };
        columns.forEach((column, index) => { if (map[column]) Object.assign(panel, { [map[column]]: params[index] }); });
        panels.push(panel);
        return [{ insertId: columns.includes("id") ? 0 : panel.id, affectedRows: 1 }];
      }
      if (sql.includes("UPDATE master_panels")) {
        const panel = panels.find((p) => p.id === params.at(-2) && p.carId === params.at(-1))!;
        sql.split("SET")[1]!.split("WHERE")[0]!.split(",").forEach((assignment, index) => {
          const column = assignment.trim().split(" ")[0]!;
          if (map[column]) Object.assign(panel, { [map[column]]: params[index] });
        });
        return [{ affectedRows: 1 }];
      }
      if (sql.includes("DELETE FROM master_panels")) {
        panels = panels.filter((p) => !(p.id === params[0] && p.carId === params[1]));
        return [{ affectedRows: 1 }];
      }
      throw new Error(`Unexpected mutation: ${sql}`);
    },
  };
  return { repository: new UnitsRepository(() => pool as never, env), calls, get panels() { return panels; }, get commits() { return commits; }, get rollbacks() { return rollbacks; } };
}

const create = (name: string, parentId: number | null = null) => createUnitPanelRequestSchema.parse({ name, parentId, section: "Depan", category: "BODY" });
const update = (extra: object = {}) => updateUnitPanelRequestSchema.parse({ name: "Bracket", section: "Depan", category: "BODY", ...extra });

describe("master panel parent relation", () => {
  it("returns child and grandchild under the exact stored parent", async () => {
    const f = fixture();
    f.panels.push({ id: 4, carId: "UNIT-1", name: "Bolt", section: "Depan", category: "BODY", parentId: 2 });
    const tree = (await f.repository.findUnitPanels(actor))!.tree;
    expect(tree.length).toBe(1);
    expect(tree[0]!.childCount).toBe(1);
    expect(tree[0]!.children[0]!.parentId).toBe(1);
    expect(tree[0]!.children[0]!.children[0]!.id).toBe(4);
    const query = f.calls.find((c) => c.sql.includes("FROM master_panels mp"))!;
    expect(query.sql).toContain("mp.parent_id AS parentId");
    expect(query.sql).toContain("child.parent_id = mp.id");
    expect(tree[0]!.nodeType).toBe("PANEL");
    expect(tree[0]!.children[0]!.nodeType).toBe("PART");
  });

  it("creates root, child, and part fragments with durable parent IDs", async () => {
    const f = fixture();
    const root = await f.repository.createUnitPanel({ ...actor, input: create("Root") });
    const child = await f.repository.createUnitPanel({ ...actor, input: create("Child", root.id) });
    const grandchild = await f.repository.createUnitPanel({ ...actor, input: create("Fragment", child.id) });
    expect(root.parentId).toBe(null);
    expect(child.parentId).toBe(root.id);
    expect(grandchild.parentId).toBe(child.id);
    expect(f.commits).toBe(3);
    expect(f.calls.filter((c) => c.sql.includes("FROM cars WHERE id = ? FOR UPDATE")).length).toBe(3);
  });

  it("allocates an explicit locked ID on legacy tables without auto increment", async () => {
    const f = fixture(true, "missing-id");
    const child = await f.repository.createUnitPanel({ ...actor, input: { ...create("Fragment", 2), qty: 2.5 } });
    expect(child.id).toBe(4);
    expect(child.parentId).toBe(2);
    expect(child.qty).toBe(2.5);
    expect(f.calls.filter((c) => c.sql.includes("INSERT INTO master_panels")).length).toBe(2);
    expect(f.calls.some((c) => c.sql.includes("COALESCE(MAX(id), 0) + 1 AS nextId FROM master_panels FOR UPDATE"))).toBe(true);
    expect(f.commits).toBe(1);
    expect(f.rollbacks).toBe(0);
  });

  it("does not disguise unrelated insert errors as a missing legacy ID", async () => {
    const f = fixture(true, "other-column");
    await assert.rejects(f.repository.createUnitPanel({ ...actor, input: create("Fragment", 2) }), /Field 'created_by'/);
    expect(f.calls.some((c) => c.sql.includes("COALESCE(MAX(id)"))).toBe(false);
    expect(f.panels).toEqual(initial);
    expect(f.rollbacks).toBe(1);
  });

  it("rejects missing or cross-unit parents before insert", async () => {
    for (const parentId of [3, 999]) {
      const f = fixture();
      await assert.rejects(f.repository.createUnitPanel({ ...actor, input: create("Child", parentId) }), /UNIT_PANEL_PARENT_NOT_FOUND/);
      expect(f.panels).toEqual(initial);
      expect(f.rollbacks).toBe(1);
    }
  });

  it("rejects direct and descendant cycles before update", async () => {
    for (const parentId of [1, 2, 4]) {
      const f = fixture();
      f.panels.push({ id: 4, carId: "UNIT-1", name: "Bolt", section: "Depan", category: "BODY", parentId: 2 });
      const before = structuredClone(f.panels);
      await assert.rejects(f.repository.updateUnitPanel({ ...actor, panelId: 1, input: update({ name: "Bumper", parentId }) }), /UNIT_PANEL_PARENT_CYCLE/);
      expect(f.panels).toEqual(before);
    }
  });

  it("keeps the current parent on ordinary edits and allows explicit detach", async () => {
    const f = fixture();
    const kept = await f.repository.updateUnitPanel({ ...actor, panelId: 2, input: update() });
    expect(kept.after.parentId).toBe(1);
    const detached = await f.repository.updateUnitPanel({ ...actor, panelId: 2, input: update({ parentId: null }) });
    expect(detached.after.parentId).toBe(null);
  });

  it("checks duplicates within a parent and permits equal names under another parent", async () => {
    const f = fixture();
    await assert.rejects(f.repository.createUnitPanel({ ...actor, input: create("Bracket", 1) }), /UNIT_PANEL_DUPLICATE/);
    const other = await f.repository.createUnitPanel({ ...actor, input: create("Other") });
    const child = await f.repository.createUnitPanel({ ...actor, input: create("Bracket", other.id) });
    expect(child.parentId).toBe(other.id);
  });

  it("cannot delete a parent but may delete an unused leaf", async () => {
    const f = fixture();
    await assert.rejects(f.repository.deleteUnitPanel({ ...actor, panelId: 1 }), /UNIT_PANEL_HAS_CHILDREN/);
    expect(f.panels.some((p) => p.id === 1)).toBe(true);
    await f.repository.deleteUnitPanel({ ...actor, panelId: 2 });
    expect(f.panels.some((p) => p.id === 2)).toBe(false);
  });

  it("keeps flat legacy reads but refuses to silently lose requested parent IDs", async () => {
    const f = fixture(false);
    const tree = (await f.repository.findUnitPanels(actor))!.tree;
    expect(tree.length).toBe(2);
    const legacyQuery = f.calls.find((c) => c.sql.includes("FROM master_panels mp"))!;
    expect(legacyQuery.sql).toContain("NULL AS parentId");
    expect(legacyQuery.sql).toContain("0 AS childCount");
    await assert.rejects(f.repository.createUnitPanel({ ...actor, input: create("Child", 1) }), /UNIT_PANEL_PARENT_SCHEMA_REQUIRED/);
    await assert.rejects(f.repository.updateUnitPanel({ ...actor, panelId: 2, input: update({ parentId: 1 }) }), /UNIT_PANEL_PARENT_SCHEMA_REQUIRED/);
    expect(f.calls.some((c) => c.sql.includes("INSERT INTO master_panels"))).toBe(false);
  });
});
