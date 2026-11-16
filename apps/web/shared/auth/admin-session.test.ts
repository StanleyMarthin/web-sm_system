import type { AuthUser } from "@smsystem/contracts/auth";
import { describe, expect, it, mock } from "bun:test";

const misUser: AuthUser = {
  employeeId: "SM-03.004",
  fullName: "MIS USER",
  email: null,
  roleId: 20,
  roleName: "mis",
  divisionId: 3,
  divisionName: "MANAGEMENT INFORMATION SYSTEM",
  grade: null,
  permissions: ["spf:admin", "spf:approve", "spf:publish"],
  scope: {
    canViewAllUnits: true,
    canViewAssignedUnits: true,
    divisionIds: [],
    managedDivisionIds: [],
    unitIds: [],
  },
};

const mockModule = (mock as unknown as { module: (path: string, factory: () => unknown) => void }).module;
mockModule("server-only", () => ({}));
mockModule("@/shared/auth/server", () => ({
  fetchCurrentUser: async () => ({ user: misUser, status: 200 }),
}));

describe("SPF admin session", () => {
  it("keeps every SPF permission explicitly granted to the user", async () => {
    const { requireAdminSession } = await import("@/shared/auth/admin-session");
    const session = await requireAdminSession("sm_session=test");

    expect(session).toMatchObject({
      employeeId: "SM-03.004",
      canAdmin: true,
      canApprove: true,
      canPublish: true,
    });
  });
});
