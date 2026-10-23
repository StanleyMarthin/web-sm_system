import { describe, expect, test } from "bun:test";
import type { AuthService } from "@/services/auth/auth.service";
import type { WebSession } from "@/services/auth/session.service";
import type { RolesRepository } from "@/repositories/roles/roles.repo";
import { DefaultRolesService } from "@/services/roles/roles.service";
import { handleRolesCreateRoute, handleRolesUpdateRoute } from "./roles.routes";

const session = { user: { employeeId: "SM-03.004", fullName: "Admin", permissions: [] } } as unknown as WebSession;
const auth = { async getCurrentSession() { return session; } } as unknown as AuthService;

describe("role save flow", () => {
  test("passes role and permissions together and records before and after", async () => {
    let ids = [1];
    let name = "awal";
    const role = () => ({ id: 5, roleName: name, description: null, userCount: 0, permissionCount: ids.length, createdAt: null, profile: null });
    const repository: Partial<RolesRepository> = {
      async findRoleById() { return role(); },
      async getRolePermissionIds() { return ids; },
      async listEmployeeIdsByRoleId() { return []; },
      async createRole(input) { name = input.roleName; ids = input.permissionIds ?? []; return role(); },
      async updateRole(_roleId, input) { name = input.roleName ?? name; ids = input.permissionIds ?? ids; return role(); },
    };
    const entries: Array<{ oldValue?: unknown; newValue?: unknown }> = [];
    const service = new DefaultRolesService(repository as RolesRepository, { async log(entry) { entries.push(entry); } }, { async listRoleHistory() { return []; } });
    const req = (method: string, body: object) => new Request("http://localhost/api/roles", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

    const created = await handleRolesCreateRoute(req("POST", { roleName: "baru", permissionIds: [2] }), auth, service);
    expect(created.status).toBe(201);
    expect((await created.json()).data.permissionIds).toEqual([2]);
    const updated = await handleRolesUpdateRoute(req("PATCH", { roleName: "ubah", permissionIds: [3] }), 5, auth, service);
    expect(updated.status).toBe(200);
    expect((await updated.json()).data.permissionIds).toEqual([3]);
    expect(ids).toEqual([3]);
    expect(entries[1]?.oldValue).toMatchObject({ role: { roleName: "baru" }, permissionIds: [2] });
    expect(entries[1]?.newValue).toMatchObject({ role: { roleName: "ubah" }, permissionIds: [3] });
  });
});
