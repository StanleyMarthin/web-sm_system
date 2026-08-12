export interface WebNotification {
  id: string;
  title: string;
  body: string;
  module: string;
  href: string | null;
  createdAt: string;
}

const moduleRoutes: Record<string, string> = {
  wo: "/requests/outstanding",
  pr: "/requests/outstanding",
  wov: "/requests/outstanding",
  wo_ext: "/requests/outstanding",
  warehouse: "/warehouse",
  countdown: "/countdown",
  qc: "/qc/dashboard",
  job_plan: "/job-plan",
  tasks: "/monitoring",
};

const referenceKeys: Record<string, string> = {
  wo: "woId",
  pr: "prId",
  wov: "wovId",
  wo_ext: "woExtId",
};

function record(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === "string") {
    try {
      return record(JSON.parse(value));
    } catch {
      return {};
    }
  }
  return {};
}

export function notificationHref(data: Record<string, unknown>): string | null {
  const moduleName = String(data.module ?? "").toLowerCase();
  const route = moduleRoutes[moduleName];
  if (!route) return null;

  const key = referenceKeys[moduleName];
  const value = key ? data[key] : null;
  if (typeof value !== "string" && typeof value !== "number") return route;
  return `${route}?${new URLSearchParams({ [key]: String(value) })}`;
}

export function parseNotifications(payload: unknown): WebNotification[] {
  const envelope = record(payload);
  const nested = record(envelope.data);
  const items = Array.isArray(envelope.data)
    ? envelope.data
    : Array.isArray(envelope.notifications)
      ? envelope.notifications
      : Array.isArray(nested.notifications)
        ? nested.notifications
        : [];

  return items.map((raw, index) => {
    const item = record(raw);
    const data = { ...record(item.dataPayload ?? item.data_payload), ...record(item.data) };
    const moduleName = String(data.module ?? item.module ?? "").toLowerCase();
    return {
      id: String(item.id ?? item.notificationId ?? index),
      title: String(item.title ?? "Notifikasi"),
      body: String(item.body ?? item.message ?? "-"),
      module: moduleName,
      href: notificationHref({ ...data, module: moduleName }),
      createdAt: String(item.createdAt ?? item.created_at ?? ""),
    };
  });
}
