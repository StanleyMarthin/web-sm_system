import { describe, expect, test } from "bun:test";
import type { AuthService } from "@/services/auth/auth.service";
import type { WebSession } from "@/services/auth/session.service";
import type { RolesService } from "@/services/roles/roles.service";
import { handleRoleHistoryRoute, handleRolesListRoute } from "./roles.routes";

const request = () => new Request("http://localhost/api/roles");
const auth = (employeeId: string | null) => ({
  async getCurrentSession() {
    return employeeId ? { user: { employeeId, permissions: [] } } as unknown as WebSession : null;
  },
}) as unknown as AuthService;
const roles = {
  async listRoles() { return []; },
  async getRoleHistory() { return []; },
} as unknown as RolesService;

describe("role matrix access", () => {
  test("allows the designated employee without user.manage", async () => {
    expect((await handleRolesListRoute(request(), auth("SM-03.004"), roles)).status).toBe(200);
    expect((await handleRoleHistoryRoute(request(), 1, auth("SM-03.004"), roles)).status).toBe(200);
  });

  test("rejects other employees and unauthenticated requests", async () => {
    expect((await handleRolesListRoute(request(), auth("SM-03.005"), roles)).status).toBe(403);
    expect((await handleRoleHistoryRoute(request(), 1, auth("SM-03.005"), roles)).status).toBe(403);
    expect((await handleRolesListRoute(request(), auth(null), roles)).status).toBe(401);
  });
});
