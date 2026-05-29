import { afterEach, describe, expect, it, mock } from "bun:test";
import {
  fetchPermissions,
  fetchRolePermissions,
  fetchRoleReferences,
  fetchRoles,
  saveRolePermissions,
} from "@/shared/api/roles";

const originalFetch = global.fetch;
const originalApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

describe("roles api client", () => {
  afterEach(() => {
    global.fetch = originalFetch;
    if (originalApiBaseUrl === undefined) {
      delete process.env.NEXT_PUBLIC_API_BASE_URL;
    } else {
      process.env.NEXT_PUBLIC_API_BASE_URL = originalApiBaseUrl;
    }
    mock.restore();
  });

  it("parses roles payload on success", async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "http://127.0.0.1:3203";
    global.fetch = mock(async () => {
      return new Response(
        JSON.stringify({
          success: true,
          message: "ok",
          data: {
            roles: [
              {
                id: 1,
                roleName: "Admin",
                description: null,
                userCount: 1,
                permissionCount: 2,
                createdAt: null,
                profile: {
                  roleLevel: 900,
                  scopeBasis: "GLOBAL",
                  webEnabled: true,
                  mobileEnabled: true,
                  approvalRank: 9,
                  notes: "Akses penuh",
                },
              },
            ],
          },
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    const result = await fetchRoles("session=abc");
    expect(result.status).toBe(200);
    expect(result.payload?.data.roles[0]?.roleName).toBe("Admin");
    expect(result.payload?.data.roles[0]?.profile?.scopeBasis).toBe("GLOBAL");
  });

  it("parses role permission payload on success", async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "http://127.0.0.1:3203";
    global.fetch = mock(async () => {
      return new Response(
        JSON.stringify({
          success: true,
          message: "ok",
          data: {
            roleId: 2,
            permissionIds: [10, 11],
          },
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    const result = await fetchRolePermissions("session=abc", 2);
    expect(result.status).toBe(200);
    expect(result.payload?.data.permissionIds).toEqual([10, 11]);
  });

  it("parses permission platform metadata", async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "http://127.0.0.1:3203";
    global.fetch = mock(async () => {
      return new Response(
        JSON.stringify({
          success: true,
          message: "ok",
          data: {
            permissions: [
              {
                id: 31,
                permissionCode: "PROFILE_VIEW",
                description: "Lihat profil",
                moduleName: "profile",
                platforms: ["WEB", "MOBILE"],
                audience: "SHARED",
              },
            ],
          },
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    const result = await fetchPermissions("session=abc");
    expect(result.status).toBe(200);
    expect(result.payload?.data.permissions[0]?.platforms).toEqual(["WEB", "MOBILE"]);
    expect(result.payload?.data.permissions[0]?.audience).toBe("SHARED");
  });

  it("parses role scope references on success", async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "http://127.0.0.1:3203";
    global.fetch = mock(async () => {
      return new Response(
        JSON.stringify({
          success: true,
          message: "ok",
          data: {
            divisions: [{ label: "INTERIOR", value: "12" }],
            units: [{ label: "MB 500 SEL", value: "CAR-1" }],
          },
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    const result = await fetchRoleReferences("session=abc");
    expect(result.status).toBe(200);
    expect(result.payload?.data.divisions[0]?.label).toBe("INTERIOR");
    expect(result.payload?.data.units[0]?.value).toBe("CAR-1");
  });

  it("returns structured failure when save matrix is rejected", async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "http://127.0.0.1:3203";
    global.fetch = mock(async () => {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Forbidden",
          errorCode: "FORBIDDEN",
          data: {},
        }),
        { status: 403 },
      );
    }) as typeof fetch;

    const result = await saveRolePermissions(2, [10, 11]);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errorCode).toBe("FORBIDDEN");
      expect(result.message).toBe("Forbidden");
    }
  });
});
