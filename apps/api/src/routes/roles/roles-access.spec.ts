import { describe, expect, test } from "bun:test";
import type { AuthService } from "@/services/auth/auth.service";
import type { WebSession } from "@/services/auth/session.service";
import type { RolesService } from "@/services/roles/roles.service";
import { handleRoleHistoryRoute, handleRolesListRoute } from "./roles.routes";

const request = () => new Request("http://localhost/api/roles");
const auth = (roleName: string | null, permissions: string[] = [], employeeId = "EMP-MIS") => ({
  async getCurrentSession() {
    return roleName ? { user: { employeeId, roleName, permissions } } as unknown as WebSession : null;
  },
}) as unknown as AuthService;
const roles = {
  async listRoles() { return []; },
  async getRoleHistory() { return []; },
} as unknown as RolesService;

describe("role matrix access", () => {
  test("allows MIS with the database user.manage permission regardless of employee ID", async () => {
    for (const employeeId of ["SM-03.004", "EMP-MIS"]) {
      const session = auth("mis", ["user.manage"], employeeId);
      expect((await handleRolesListRoute(request(), session, roles)).status).toBe(200);
      expect((await handleRoleHistoryRoute(request(), 1, session, roles)).status).toBe(200);
    }
  });

  test("rejects MIS without permission and other roles even with permission", async () => {
    for (const session of [auth("mis"), auth("kd", ["user.manage"]), auth("qa", ["user.manage"])]) {
      expect((await handleRolesListRoute(request(), session, roles)).status).toBe(403);
      expect((await handleRoleHistoryRoute(request(), 1, session, roles)).status).toBe(403);
    }
    expect((await handleRolesListRoute(request(), auth(null), roles)).status).toBe(401);
  });
});
