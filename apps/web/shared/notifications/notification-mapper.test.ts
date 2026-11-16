import { describe, expect, it } from "bun:test";
import { notificationHref, parseNotifications } from "./notification-mapper";

describe("notification mapper", () => {
  const routes = [
    ["wo", "/requests/outstanding"],
    ["pr", "/requests/outstanding"],
    ["wov", "/requests/outstanding"],
    ["wo_ext", "/requests/outstanding"],
    ["warehouse", "/warehouse"],
    ["countdown", "/countdown"],
    ["qc", "/qc/dashboard"],
    ["job_plan", "/job-plan"],
    ["tasks", "/monitoring"],
  ] as const;

  for (const [module, href] of routes) {
    it(`maps ${module} notifications`, () => {
      expect(notificationHref({ module })).toBe(href);
    });
  }

  it("keeps a module-specific reference id without trusting the notification id", () => {
    expect(notificationHref({ module: "wo", woId: "WO 12" })).toBe(
      "/requests/outstanding?woId=WO+12",
    );
    expect(notificationHref({ module: "wo", id: "notification-9" })).toBe(
      "/requests/outstanding",
    );
  });

  it("normalizes the API envelope and JSON data payload", () => {
    expect(
      parseNotifications({
        data: [{ id: 7, title: "Approval", body: "Perlu ditinjau", dataPayload: '{"module":"qc"}', createdAt: "2026-08-10T08:00:00Z" }],
      }),
    ).toEqual([
      { id: "7", title: "Approval", body: "Perlu ditinjau", module: "qc", href: "/qc/dashboard", createdAt: "2026-08-10T08:00:00Z" },
    ]);
  });
});
