import { getMySqlPool } from "./src/db/mysql";

const pool = getMySqlPool();

async function run() {
  try {
    const [rows] = await pool.query(`
      SELECT
        cd.division_id AS divisionId,
        c.id AS carId,
        c.unit_name AS unitName,
        ROUND(SUM(CASE WHEN COALESCE(p.is_overtime, 0) = 0 THEN COALESCE(actual.duration_hours, 0) ELSE 0 END), 2) AS normalActualHours
      FROM sm_jobdesc_plan p
      JOIN sm_jobdesc_countdown cd ON cd.id = p.core_id
      JOIN cars c ON c.id = cd.car_id
      LEFT JOIN (
        SELECT a.plandaily_id, a.duration_hours
        FROM sm_jobdesc_actual a
        JOIN (
          SELECT plandaily_id, MAX(created_at) AS latestCreatedAt
          FROM sm_jobdesc_actual GROUP BY plandaily_id
        ) latest ON latest.plandaily_id = a.plandaily_id AND latest.latestCreatedAt = a.created_at
      ) actual ON actual.plandaily_id = p.id
      WHERE p.task_date BETWEEN '2026-06-01' AND '2026-06-07' AND COALESCE(p.is_overtime, 0) = 0
      GROUP BY cd.division_id, c.id, c.unit_name
    `);
    console.log("ROWS:");
    console.log(rows);
  } catch (err) {
    console.error(err);
  }
  process.exit(0);
}
run();
