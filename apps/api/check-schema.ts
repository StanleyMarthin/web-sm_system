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

async function run() {
  const schema = await (repo as any).getMasterPanelInventorySchema(pool);
  console.log("Schema cache:", schema);
  await pool.end();
}

run().catch(console.error);
