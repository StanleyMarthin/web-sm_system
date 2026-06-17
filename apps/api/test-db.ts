import { createConnection } from "mysql2/promise";
import { resolve } from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: resolve(process.cwd(), "../../.env.local") });

async function run() {
  const conn = await createConnection({
    host: "127.0.0.1",
    port: 3307,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
  });

  const [rows] = await conn.query("SELECT * FROM master_panels LIMIT 1");
  const panel = (rows as any)[0];
  if (!panel) return console.log("No panels found");
  
  console.log("Before:", panel.name);

  await conn.execute(
    "UPDATE master_panels SET name = ? WHERE id = ?",
    [panel.name + " TEST", panel.id]
  );

  const [updatedRows] = await conn.query("SELECT * FROM master_panels WHERE id = ?", [panel.id]);
  console.log("After:", (updatedRows as any)[0].name);
  
  await conn.end();
}

run().catch(console.error);
