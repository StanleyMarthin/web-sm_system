import { getMySqlPool } from "./src/db/mysql";
import { UnitsRepository } from "./src/repositories/units.repo";

process.env.DB_HOST = "127.0.0.1";
process.env.DB_PORT = "3306";
process.env.DB_USER = "sarito";
process.env.DB_PASS = "SahrulR01";
process.env.DB_NAME = "sms_db";
process.env.CORE_DB_NAME = "sms_db";
process.env.PURCHASE_DB_NAME = "sms_purchase";
process.env.WAREHOUSE_DB_NAME = "sms_warehouse";
process.env.AUDIT_DB_NAME = "sms_log";
process.env.REDIS_HOST = "127.0.0.1";
process.env.REDIS_PORT = "6379";

const pool = getMySqlPool();
const repo = new UnitsRepository(() => pool);

const dummyScope = {
  actorId: "tester",
  scope: {
    canViewAllUnits: true,
    canViewAssignedUnits: true,
    divisionIds: [],
    managedDivisionIds: [],
  }
};

async function run() {
  const [rows] = await pool.query("SELECT id, car_id, parent_id FROM master_panels WHERE parent_id IS NOT NULL LIMIT 1");
  const part = (rows as any)[0];
  if (!part) return console.log("No parts found");

  const panelId = part.id;
  const unitId = part.car_id;
  const oldParentId = part.parent_id;

  const [panelRows] = await pool.query("SELECT id FROM master_panels WHERE parent_id IS NULL AND car_id = ? AND id != ? LIMIT 1", [unitId, oldParentId]);
  const newParent = (panelRows as any)[0];
  if (!newParent) return console.log("No alternative parent found");
  
  const newParentId = newParent.id;

  console.log("Testing moving part", panelId, "from", oldParentId, "to", newParentId);

  // Fetch full before record
  const tree = await repo.findUnitPanels({ unitId, ...dummyScope });
  const node = findNode(tree?.tree || [], panelId);
  
  const updated = await repo.updateUnitPanel({
    unitId,
    panelId,
    actorId: "test_actor",
    scope: dummyScope.scope,
    input: {
      parentId: newParentId,
      section: node.section,
      name: node.name,
      category: node.category,
      sortOrder: node.sortOrder,
      qty: node.qty,
      defaultLocationType: node.defaultLocationType,
      defaultStockStatus: node.defaultStockStatus,
      defaultConditionType: node.defaultConditionType,
      isActive: node.isActive
    }
  });

  console.log("Updated returned parentId:", updated.after.parentId);

  const [checkRow] = await pool.query("SELECT parent_id FROM master_panels WHERE id = ?", [panelId]);
  console.log("DB parent_id:", (checkRow as any)[0].parent_id);

  // Revert
  await repo.updateUnitPanel({
    unitId,
    panelId,
    actorId: "test_actor",
    scope: dummyScope.scope,
    input: {
      parentId: oldParentId,
      section: node.section,
      name: node.name,
      category: node.category,
      sortOrder: node.sortOrder,
      qty: node.qty,
      defaultLocationType: node.defaultLocationType,
      defaultStockStatus: node.defaultStockStatus,
      defaultConditionType: node.defaultConditionType,
      isActive: node.isActive
    }
  });

  await pool.end();
}

function findNode(nodes: any[], id: number): any {
  for (const n of nodes) {
    if (n.id === id) return n;
    const child = findNode(n.children || [], id);
    if (child) return child;
  }
  return null;
}

run().catch(console.error);
