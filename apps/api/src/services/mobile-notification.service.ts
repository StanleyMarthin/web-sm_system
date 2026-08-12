import { getMySqlPool } from "@/db/mysql";
import { getRedisClient } from "@/redis/client";

type MobileNotification = {
  title: string;
  body: string;
  data?: Record<string, string>;
};

type RedisFactory = () => Promise<{
  xAdd: (...args: any[]) => Promise<unknown>;
}>;

type PoolFactory = () => {
  query: (sql: string, params: unknown[]) => Promise<any>;
};

const normalizeIds = (ids: string[]) => [
  ...new Set(ids.map((id) => id.trim()).filter(Boolean)),
];

export async function notifyMobileEmployees(
  employeeIds: string[],
  notification: MobileNotification,
  source: string,
  redisFactory: RedisFactory = getRedisClient,
): Promise<void> {
  try {
    const ids = normalizeIds(employeeIds);
    const title = notification.title.trim();
    const body = notification.body.trim();
    const normalizedSource = source.trim();
    const validData = !notification.data
      || Object.values(notification.data).every((value) => typeof value === "string");

    if (ids.length === 0 || !title || title.length > 255 || !body || !normalizedSource || !validData) {
      return;
    }

    const redis = await redisFactory();
    await redis.xAdd(
      "notif:requests",
      "*",
      {
        payload: JSON.stringify({
          target: { type: "employee", employeeIds: ids },
          notification: { title, body, ...(notification.data ? { data: notification.data } : {}) },
          source: normalizedSource,
        }),
      },
      { TRIM: { strategy: "MAXLEN", strategyModifier: "~", threshold: 10_000 } },
    );
  } catch (error) {
    console.error("[mobile-notification] Failed to enqueue notification:", error);
  }
}

export async function resolveEmployeeIdsByPermission(
  permissionCode: string,
  divisionId?: number,
  poolFactory: PoolFactory = getMySqlPool,
): Promise<string[]> {
  const permission = permissionCode.trim();
  if (!permission || (divisionId !== undefined && !Number.isInteger(divisionId))) return [];

  const divisionFilter = divisionId === undefined
    ? ""
    : `AND (e.division_id = ? OR EXISTS (
        SELECT 1 FROM employee_managed_divisions emd
        WHERE emd.employee_id = e.employee_id AND emd.division_id = ?
      ))`;

  try {
    const [rows] = await poolFactory().query(
      `SELECT DISTINCT e.employee_id AS employeeId
       FROM sm_employee e
       JOIN sys_role_permissions srp ON srp.role_id = e.role_id
       JOIN sys_permissions sp ON sp.id = srp.permission_id
       WHERE COALESCE(e.is_active, 1) = 1
         AND sp.permission_code = ?
         ${divisionFilter}`,
      divisionId === undefined ? [permission] : [permission, divisionId, divisionId],
    );

    return normalizeIds((rows as Array<{ employeeId: string }>).map(({ employeeId }) => employeeId));
  } catch (error) {
    console.error("[mobile-notification] Failed to resolve recipients:", error);
    return [];
  }
}
