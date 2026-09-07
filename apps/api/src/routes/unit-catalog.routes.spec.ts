import { describe, expect, it } from "bun:test";
import { permissionCodes } from "@smsystem/permissions";
import { CatalogPanelDeleteConflictError } from "@/repositories/unit-catalog.repo";
import { handleCatalogComponentPanelsBatchRoute, handleUnitCatalogRoute } from "./unit-catalog.routes";

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

describe("handleCatalogComponentPanelsBatchRoute", () => {
  it("saves catalog panels through batch endpoint", async () => {
    const authService = {
      getCurrentSession: async () => ({
        ...createSession(),
        user: {
          ...createSession().user,
          permissions: [permissionCodes.unitCatalogManage],
        },
      }),
    } as any;
    const service = {
      saveCatalogPanels: async (_session: unknown, componentId: number, input: unknown) => ({
        componentId,
        input,
      }),
    } as any;

    const response = await handleCatalogComponentPanelsBatchRoute(
      new Request("http://127.0.0.1:3203/api/catalog/components/4/panels/batch", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [{ id: null, panelName: "Front Door LH" }],
          deletedIds: [],
        }),
      }),
      4,
      authService,
      service,
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toMatchObject({
      success: true,
      data: {
        panels: {
          componentId: 4,
          input: {
            items: [{ id: null, panelName: "Front Door LH" }],
            deletedIds: [],
          },
        },
      },
    });
  });

  it("returns delete conflict counts", async () => {
    const authService = {
      getCurrentSession: async () => ({
        ...createSession(),
        user: {
          ...createSession().user,
          permissions: [permissionCodes.unitCatalogManage],
        },
      }),
    } as any;
    const service = {
      saveCatalogPanels: async () => {
        throw new CatalogPanelDeleteConflictError({
          panelId: 12,
          unitCatalogCount: 1,
          imageCount: 2,
          masterPanelCount: 3,
        });
      },
    } as any;

    const response = await handleCatalogComponentPanelsBatchRoute(
      new Request("http://127.0.0.1:3203/api/catalog/components/4/panels/batch", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: [], deletedIds: [12] }),
      }),
      4,
      authService,
      service,
    );

    expect(response.status).toBe(409);
    const payload = await response.json();
    expect(payload).toMatchObject({
      success: false,
      errorCode: "CATALOG_PANEL_DELETE_CONFLICT",
      data: {
        panelId: 12,
        unitCatalogCount: 1,
        imageCount: 2,
        masterPanelCount: 3,
      },
    });
  });
});
