import { describe, expect, it } from "bun:test";
import { permissionCodes } from "@smsystem/permissions";
import { handleUnitCatalogRoute } from "./unit-catalog.routes";

function createSession() {
  return {
    sessionKey: "session:SM-03.004:test",
    sessionId: "test-session",
    employeeId: "SM-03.004",
    refreshToken: "refresh-token",
    mobileSessionKey: "mobile-session",
    deviceId: "device-id",
    createdAt: "2026-09-05T00:00:00.000Z",
    user: {
      employeeId: "SM-03.004",
      fullName: "Sahrul Riswanto",
      email: null,
      roleId: 1,
      roleName: "mis",
      divisionId: 1,
      divisionName: "MANAGEMENT INFORMATION SYSTEM",
      grade: "MIS",
      permissions: [permissionCodes.unitCatalogView],
      scope: {
        canViewAllUnits: true,
        canViewAssignedUnits: true,
        divisionIds: [],
        managedDivisionIds: [],
        unitIds: [],
      },
    },
  };
}

describe("handleUnitCatalogRoute", () => {
  it("returns 200 with an empty overview when catalog has no panels yet", async () => {
    const authService = {
      getCurrentSession: async () => createSession(),
    } as any;
    const service = {
      getOverview: async () => ({
        components: [
          { id: 1, code: "ENGINE", componentName: "ENGINE" },
          { id: 2, code: "UNDERCARRIAGE", componentName: "UNDERCARRIAGE" },
          { id: 3, code: "ELECTRICAL", componentName: "ELECTRICAL" },
          { id: 4, code: "BODY", componentName: "BODY" },
          { id: 5, code: "INTERIOR", componentName: "INTERIOR" },
        ],
        panels: [],
      }),
    } as any;

    const response = await handleUnitCatalogRoute(
      new Request("http://127.0.0.1:3203/api/units/CHEVROLET_MRNYOMAN/catalog"),
      "CHEVROLET_MRNYOMAN",
      authService,
      service,
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toMatchObject({
      success: true,
      message: "Ringkasan catalog unit berhasil dimuat.",
      data: {
        overview: {
          components: [
            { id: 1, code: "ENGINE", componentName: "ENGINE" },
            { id: 2, code: "UNDERCARRIAGE", componentName: "UNDERCARRIAGE" },
            { id: 3, code: "ELECTRICAL", componentName: "ELECTRICAL" },
            { id: 4, code: "BODY", componentName: "BODY" },
            { id: 5, code: "INTERIOR", componentName: "INTERIOR" },
          ],
          panels: [],
        },
      },
    });
  });
});
