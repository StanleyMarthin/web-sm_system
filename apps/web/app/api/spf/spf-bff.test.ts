import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

test("SPF BFF forwards only session and CSRF to the canonical backend route", () => {
  const source = readFileSync(new URL("./[resource]/route.ts", import.meta.url), "utf8");
  expect(source).toContain("/api/spf/${targetResource}");
  expect(source).toContain("request.cookies.get(CSRF_COOKIE_NAME)");
  expect(source).toContain('"cache-control"');
  expect(source.includes("/api/admin/spf/")).toBe(false);
  expect(source.includes("PORTAL_ADMIN_API_KEY")).toBe(false);
  expect(source.includes("x-admin-role")).toBe(false);
  expect(source.includes("x-employee-id")).toBe(false);
  expect(source.includes("mock")).toBe(false);
});
