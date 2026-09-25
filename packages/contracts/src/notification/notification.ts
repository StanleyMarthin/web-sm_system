import { z } from "zod";

export const notificationItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  isRead: z.boolean(),
  createdAt: z.string(),
  data: z.record(z.string(), z.unknown()),
});

export const notificationListSchema = z.object({
  notifications: z.array(notificationItemSchema),
  page: z.number().int().positive(),
  limit: z.number().int().min(1).max(50),
});

export type NotificationItem = z.infer<typeof notificationItemSchema>;
export type NotificationList = z.infer<typeof notificationListSchema>;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function payload(value: Record<string, unknown>): Record<string, unknown> {
  const raw = value.data ?? value.dataPayload ?? value.data_payload;
  if (typeof raw === "string") {
    try {
      return record(JSON.parse(raw));
    } catch {
      return {};
    }
  }
  return record(raw);
}

export function normalizeNotificationItem(value: unknown): NotificationItem {
  const item = record(value);
  const data = payload(item);
  return {
    id: String(item.id ?? item.notificationId ?? ""),
    title: String(item.title ?? "Notifikasi"),
    body: String(item.body ?? item.message ?? "-"),
    isRead: item.isRead === true || item.is_read === 1,
    createdAt: String(item.createdAt ?? item.created_at ?? ""),
    data: item.module && data.module === undefined ? { ...data, module: item.module } : data,
  };
}
