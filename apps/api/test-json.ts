import { getMySqlPool } from "./src/db/mysql";
async function run() {
  const pool = getMySqlPool();
  try {
    const [res] = await pool.execute(`SELECT JSON_CONTAINS('{}', JSON_QUOTE('20'), '$.mergedWoIds') AS val`);
    console.log("Success:", res);
  } catch (e) {
    console.error("Error:", e);
  }
  process.exit(0);
}
run();
