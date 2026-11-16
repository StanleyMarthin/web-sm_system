import { randomBytes, timingSafeEqual } from "node:crypto";
import type { Pool, RowDataPacket } from "mysql2/promise";
import type { RedisClientType } from "redis";

type Store = Pick<RedisClientType, "get" | "getDel" | "set" | "del" | "sAdd" | "sRem" | "sMembers" | "expire">;
const ttl = 2_592_000;
const envelope = (status: number, message: string, data: object = {}) =>
  Response.json({ success: status < 400, message, data, ...(status >= 400 ? { errorCode: status === 401 ? "INVALID_CREDENTIALS" : "LOCAL_AUTH_ERROR" } : {}) }, { status });

export function createLocalLoginHandler(pool: Pick<Pool, "query">, redis: Store, internalToken: string) {
  async function issue(employeeId: string, deviceId: string) {
    const refreshToken = randomBytes(32).toString("hex");
    await redis.set(`local-auth:refresh:${refreshToken}`, JSON.stringify({ employeeId, deviceId }), { EX: ttl });
    await redis.sAdd(`local-auth:employee:${employeeId}`, refreshToken);
    await redis.expire(`local-auth:employee:${employeeId}`, ttl);
    return envelope(200, "Local login successful", { token: `local-session:${randomBytes(24).toString("hex")}`, refreshToken, user: { employeeId } });
  }

  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    if (!["127.0.0.1", "localhost"].includes(url.hostname)) return envelope(403, "Local requests only");
    if (request.method === "GET" && url.pathname === "/health") return envelope(200, "Local login ready");
    if (request.method !== "POST") return envelope(404, "Unknown local login route");
    let body: Record<string, unknown>;
    try { body = await request.json(); } catch { return envelope(400, "Invalid JSON"); }
    if (!body || typeof body !== "object" || Array.isArray(body)) return envelope(400, "Invalid request");

    if (url.pathname === "/api/v1/auth/login-web") {
      if (typeof body.employeeId !== "string" || typeof body.password !== "string" || typeof body.deviceId !== "string" ||
          !body.employeeId.trim() || body.employeeId.length > 50 || body.password.length > 255 || !body.deviceId || body.deviceId.length > 255) {
        return envelope(400, "Username, password and device are required");
      }
      const name = body.employeeId.trim();
      const [rows] = await pool.query<RowDataPacket[]>(`SELECT e.employee_id,e.password_hash,e.is_active
        FROM sms_db.sm_employee e LEFT JOIN sms_local_setup.login_names n ON n.employee_id=e.employee_id
        WHERE e.employee_id=? OR n.login_name=? LIMIT 1`, [name, name]);
      const employee = rows[0];
      if (!employee || employee.is_active !== 1 || !await Bun.password.verify(body.password, employee.password_hash)) return envelope(401, "Username or password incorrect");
      return issue(employee.employee_id, body.deviceId);
    }

    if (url.pathname === "/api/v1/auth/refresh") {
      if (typeof body.refreshToken !== "string" || !/^[a-f0-9]{64}$/u.test(body.refreshToken) || typeof body.deviceId !== "string") return envelope(401, "Invalid refresh token");
      const key = `local-auth:refresh:${body.refreshToken}`;
      const raw = await redis.get(key);
      if (!raw) return envelope(401, "Refresh session expired");
      const session = JSON.parse(raw) as { employeeId: string; deviceId: string };
      if (session.deviceId !== body.deviceId) return envelope(401, "Device mismatch");
      const [rows] = await pool.query<RowDataPacket[]>("SELECT is_active FROM sms_db.sm_employee WHERE employee_id=?", [session.employeeId]);
      if (rows[0]?.is_active !== 1 || await redis.getDel(key) !== raw) return envelope(401, "Refresh session expired");
      await redis.sRem(`local-auth:employee:${session.employeeId}`, body.refreshToken);
      return issue(session.employeeId, session.deviceId);
    }

    if (["/api/v1/auth/internal/sessions/sync", "/api/v1/auth/internal/sessions/invalidate"].includes(url.pathname)) {
      const provided = Buffer.from(request.headers.get("X-SM-Internal-Token") ?? "");
      const expected = Buffer.from(internalToken);
      if (!expected.length || provided.length !== expected.length || !timingSafeEqual(provided, expected)) return envelope(403, "Invalid internal token");
      if (!Array.isArray(body.employeeIds) || body.employeeIds.length > 200 || !body.employeeIds.every(id => typeof id === "string" && id.trim() && id.length <= 50)) return envelope(400, "Invalid employee list");
      if (url.pathname.endsWith("/invalidate")) {
        for (const id of body.employeeIds) {
          const key = `local-auth:employee:${id.trim().toUpperCase()}`;
          const tokens = await redis.sMembers(key);
          for (const token of tokens) await redis.del(`local-auth:refresh:${token}`);
          await redis.del(key);
        }
      }
      return envelope(200, "Local sessions updated");
    }
    return envelope(404, "Unknown local login route");
  };
}
