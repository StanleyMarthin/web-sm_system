import { expect, test } from "bun:test";
import { canManageRoleMatrix } from "./index";

test("role matrix requires MIS membership and its DB administration grant", () => {
  expect(canManageRoleMatrix(" mis ", ["user.manage"])).toBe(true);
  expect(canManageRoleMatrix("MIS", [])).toBe(false);
  expect(canManageRoleMatrix("admin", ["user.manage"])).toBe(false);
  expect(canManageRoleMatrix("qa", ["user.manage"])).toBe(false);
});
