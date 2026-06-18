import { getMySqlPool } from "./src/db/mysql";

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

async function run() {
  console.log("Altering master_panels...");
  try {
    await pool.query(`
      ALTER TABLE master_panels
      ADD COLUMN qty float DEFAULT 1 AFTER sort_order,
      ADD COLUMN default_location_type varchar(50) DEFAULT 'UNIT' AFTER qty,
      ADD COLUMN default_stock_status varchar(50) DEFAULT 'INSTALLED' AFTER default_location_type,
      ADD COLUMN default_condition_type varchar(50) DEFAULT 'BEKAS' AFTER default_stock_status;
    `);
    console.log("Success adding columns");
  } catch (e: any) {
    if (e.code === 'ER_DUP_FIELDNAME') {
      console.log("Columns already exist, skipping...");
    } else {
      console.error("Error:", e);
    }
  }

  await pool.end();
}

run().catch(console.error);
