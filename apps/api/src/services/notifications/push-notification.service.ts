import type { RowDataPacket } from "mysql2";
import { getMySqlPool } from "@/db/mysql";
import { getApiEnv } from "@/config/env";

interface DeviceRow extends RowDataPacket {
  fcm_token: string;
}

interface FcmLegacyPayload {
  registration_ids: string[];
  notification: {
    title: string;
    body: string;
    sound: string;
  };
  data?: Record<string, string>;
  priority: "high" | "normal";
}

/**
 * Fetch active FCM tokens for the given employee IDs.
 */
async function getFcmTokensForEmployees(employeeIds: string[]): Promise<string[]> {
  if (employeeIds.length === 0) {
    return [];
  }

  const pool = getMySqlPool();
  const placeholders = employeeIds.map(() => "?").join(", ");
  const [rows] = (await pool.query(
    `
      SELECT fcm_token
      FROM sm_user_devices
      WHERE employee_id IN (${placeholders})
        AND is_active = 1
        AND fcm_token IS NOT NULL
        AND fcm_token != ''
      ORDER BY last_active_at DESC
    `,
    employeeIds,
  )) as [DeviceRow[], unknown];

  // Deduplicate tokens in case a user has multiple devices
  return [...new Set(rows.map((r) => r.fcm_token))];
}

/**
 * Send FCM push notification using the legacy HTTP API.
 * Silently swallows errors so that a notification failure
 * never breaks the main business flow.
 */
export async function sendPushNotification(
  employeeIds: string[],
  notification: { title: string; body: string },
  data?: Record<string, string>,
): Promise<void> {
  const env = getApiEnv();
  const serverKey = env.FCM_SERVER_KEY;

  if (!serverKey) {
    console.warn("[push] FCM_SERVER_KEY not set — skipping notification");
    return;
  }

  let tokens: string[];
  try {
    tokens = await getFcmTokensForEmployees(employeeIds);
  } catch (err) {
    console.error("[push] Failed to fetch FCM tokens:", err);
    return;
  }

  if (tokens.length === 0) {
    console.info("[push] No active FCM tokens found for", employeeIds);
    return;
  }

  const payload: FcmLegacyPayload = {
    registration_ids: tokens,
    notification: {
      title: notification.title,
      body: notification.body,
      sound: "default",
    },
    data,
    priority: "high",
  };

  try {
    const response = await fetch("https://fcm.googleapis.com/fcm/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `key=${serverKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`[push] FCM request failed (${response.status}):`, text);
      return;
    }

    const result = await response.json() as {
      success: number;
      failure: number;
      results: Array<{ error?: string; message_id?: string }>;
    };

    if (result.failure > 0) {
      const errors = result.results
        .filter((r) => r.error)
        .map((r) => r.error)
        .join(", ");
      console.warn(`[push] ${result.failure} FCM message(s) failed: ${errors}`);
    } else {
      console.info(`[push] Sent ${result.success} FCM notification(s) to`, employeeIds);
    }
  } catch (err) {
    console.error("[push] FCM fetch error:", err);
  }
}
