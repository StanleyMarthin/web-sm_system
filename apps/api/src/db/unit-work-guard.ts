import type { PoolConnection, RowDataPacket } from "mysql2/promise";

export async function assertUnitAcceptsNewWork(connection: PoolConnection, unitId: string | null) {
  const [rows] = await connection.query<RowDataPacket[]>(
    "SELECT status FROM cars WHERE id = ? FOR UPDATE", [unitId],
  );
  if (String(rows[0]?.status ?? "").trim().toUpperCase() === "HOLD") {
    throw new Error("UNIT_ON_HOLD");
  }
}
