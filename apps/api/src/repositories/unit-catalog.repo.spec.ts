import { describe, expect, it } from "bun:test";
import { UnitCatalogRepository } from "./unit-catalog.repo";

describe("UnitCatalogRepository savePanelWorkspace", () => {
  it("stores partial catalog rows, skips fully empty rows, and stays staging-only", async () => {
    const statements: Array<{ sql: string; params: unknown[] }> = [];
    const connection = {
      beginTransaction: async () => undefined,
      commit: async () => undefined,
      rollback: async () => undefined,
      release: () => undefined,
      query: async (sql: string, params: unknown[] = []) => {
        statements.push({ sql, params });
        return [[]];
      },
      execute: async (sql: string, params: unknown[] = []) => {
        statements.push({ sql, params });
        return [{ insertId: 901 }];
      },
    };

    const repository: any = new UnitCatalogRepository(
      () =>
        ({
          getConnection: async () => connection,
        }) as never,
      {} as never,
    );

    repository.getCatalogPanel = async () => ({
      id: 11,
      componentId: 4,
      componentCode: "BODY",
      componentName: "BODY",
      panelName: "FRONT FENDER LH",
    });
    repository.getPanelWorkspace = async () => ({
      carId: "CAR-1",
      panel: {
        id: 11,
        componentId: 4,
        componentCode: "BODY",
        componentName: "BODY",
        panelName: "FRONT FENDER LH",
      },
      panelImages: [],
      items: [],
    });

    await repository.savePanelWorkspace("CAR-1", 11, "EMP-1", {
      deletedItemIds: [],
      deletedPanelImageIds: [],
      panelImages: [],
      items: [
        {
          id: null,
          clientRowId: "tmp-1",
          code: "12",
          partNumber: null,
          itemName: "Rubber Seal",
          position: null,
          qtyNormal: null,
          isRestoration: true,
        },
        {
          id: null,
          clientRowId: "tmp-2",
          code: null,
          partNumber: null,
          itemName: null,
          position: null,
          qtyNormal: null,
          isRestoration: false,
        },
      ],
    });

    const itemInsertStatements = statements.filter(({ sql }) =>
      sql.includes("INSERT INTO unit_catalog"),
    );

    expect(itemInsertStatements.length).toBe(1);
    expect(itemInsertStatements[0]?.params).toEqual([
      "CAR-1",
      11,
      "12",
      null,
      "Rubber Seal",
      null,
      null,
      1,
    ]);
    expect(statements.some(({ sql }) => sql.includes("master_panels"))).toBe(
      false,
    );
  });

  it("blocks update and delete for catalog rows already promoted to master panel", async () => {
    let rolledBack = false;
    const connection = {
      beginTransaction: async () => undefined,
      commit: async () => undefined,
      rollback: async () => {
        rolledBack = true;
      },
      release: () => undefined,
      query: async (sql: string) => {
        if (sql.includes("FROM master_panels") && sql.includes("source_part = 'CATALOG'")) {
          return [[{ partId: 12 }]];
        }
        return [[]];
      },
      execute: async () => [{ insertId: 901 }],
    };

    const repository = new UnitCatalogRepository(
      () => ({ getConnection: async () => connection }) as never,
      {} as never,
    ) as any;

    repository.getCatalogPanel = async () => ({
      id: 11,
      componentId: 4,
      componentCode: "BODY",
      componentName: "BODY",
      panelName: "FRONT FENDER LH",
    });

    let errorMessage = "";
    try {
      await repository.savePanelWorkspace("CAR-1", 11, "EMP-1", {
        deletedItemIds: [12],
        deletedPanelImageIds: [],
        panelImages: [],
        items: [{
          id: 12,
          clientRowId: null,
          code: "12",
          partNumber: null,
          itemName: "Locked Item",
          position: null,
          qtyNormal: null,
          isRestoration: true,
        }],
      });
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
    }
    expect(errorMessage).toBe("CATALOG_ITEM_ALREADY_PROMOTED");
    expect(rolledBack).toBe(true);
  });
});

describe("UnitCatalogRepository promoteAdditionalItem", () => {
  function createAdditionalRepository(additionalItem: {
    componentName: string | null;
    panelName: string | null;
    itemName: string;
    partNumber: string | null;
    deskription: string | null;
  }) {
    const statements: Array<{ sql: string; params: unknown[] }> = [];
    const connection = {
      beginTransaction: async () => undefined,
      commit: async () => undefined,
      rollback: async () => undefined,
      release: () => undefined,
      query: async (sql: string, params: unknown[] = []) => {
        statements.push({ sql, params });
        if (sql.includes("SELECT id FROM master_panels")) return [[]];
        if (sql.includes("FROM unit_additional_items")) {
          return [[{
            id: 77,
            carId: "CAR-1",
            ...additionalItem,
          }]];
        }
        if (sql.includes("FROM catalog_panels")) {
          throw new Error("ADDITIONAL_PROMOTE_MUST_NOT_QUERY_CATALOG_PANELS");
        }
        if (sql.includes("FROM sm_car_panel_status")) return [[]];
        return [[]];
      },
      execute: async (sql: string, params: unknown[] = []) => {
        statements.push({ sql, params });
        return [{ insertId: 901 }];
      },
    };

    const repository = new UnitCatalogRepository(
      () => ({ getConnection: async () => connection }) as never,
      {} as never,
    ) as any;

    return { repository, statements };
  }

  it("creates master panel with ADDITIONAL provenance", async () => {
    const { repository, statements } = createAdditionalRepository({
      componentName: "BODY",
      panelName: "FRONT BUMPER",
      itemName: "Bracket Bumper",
      partNumber: "ADD-001",
      deskription: "temuan tambahan",
    });

    await repository.promoteAdditionalItem("CAR-1", 77, "EMP-1");

    const masterInsert = statements.find(({ sql }) => sql.includes("INSERT INTO master_panels"));
    expect(masterInsert?.params?.slice(0, 8)).toEqual([
      "CAR-1",
      77,
      null,
      null,
      "BODY",
      "FRONT BUMPER",
      "Bracket Bumper",
      "ADD-001",
    ]);
    expect(masterInsert?.sql.includes("'ADDITIONAL'")).toBe(true);
    expect(statements.some(({ sql }) => sql.includes("FROM catalog_panels"))).toBe(false);
    expect(statements.some(({ sql }) => sql.includes("FROM catalog_components"))).toBe(false);
    expect(statements.some(({ sql }) => sql.includes("sm_jobdesc_countdown"))).toBe(false);
    expect(statements.some(({ sql }) => sql.includes("sm_jobdesc_wo"))).toBe(false);
  });

  it("promotes additional snapshot without catalog master dependency", async () => {
    const { repository, statements } = createAdditionalRepository({
      componentName: "ENGINE",
      panelName: "CUSTOM BRACKET AREA",
      itemName: "Custom Radiator Bracket",
      partNumber: null,
      deskription: null,
    });

    await repository.promoteAdditionalItem("CAR-1", 77, "EMP-1");

    const masterInsert = statements.find(({ sql }) => sql.includes("INSERT INTO master_panels"));
    expect(masterInsert?.params?.slice(0, 8)).toEqual([
      "CAR-1",
      77,
      null,
      null,
      "ENGINE",
      "CUSTOM BRACKET AREA",
      "Custom Radiator Bracket",
      null,
    ]);
    expect(statements.some(({ sql }) => sql.includes("FROM catalog_panels"))).toBe(false);
    expect(statements.some(({ sql }) => sql.includes("FROM catalog_components"))).toBe(false);
  });
});

describe("UnitCatalogRepository listWorkspaceItems", () => {
  it("derives survey status and master panel alias from catalog source", async () => {
    const repository = new UnitCatalogRepository(
      () => ({
        query: async () => [[{
          id: 12,
          promotedPanelId: 90,
          aliasName: "Door Handle LH",
          code: "A1",
          partNumber: "PN-1",
          itemName: "Inside Door Handle",
          position: null,
          qtyNormal: "1",
          isRestoration: 1,
          createdAt: null,
          updatedAt: null,
        }]],
      }) as never,
      {} as never,
    ) as any;

    const rows = await repository.listWorkspaceItems("CAR-1", 7);

    expect(rows[0]).toMatchObject({
      id: 12,
      promotedPanelId: 90,
      aliasName: "Door Handle LH",
      surveyStatus: "MASTER_PANEL_CREATED",
    });
  });
});

describe("UnitCatalogRepository catalog materialization", () => {
  it("creates master panel from unit catalog without operational side effects", async () => {
    const statements: Array<{ sql: string; params: unknown[] }> = [];
    const connection = {
      query: async (sql: string, params: unknown[] = []) => {
        statements.push({ sql, params });
        if (sql.includes("SELECT id FROM master_panels")) return [[]];
        if (sql.includes("FROM unit_catalog uc")) {
          return [[{
            id: 55,
            carId: "CAR-1",
            componentId: 4,
            componentCode: "BODY",
            componentName: "BODY",
            panelId: 10,
            panelName: "FRONT BUMPER",
            itemName: "Rubber Seal",
            partNumber: "PN-1",
            position: null,
            qtyNormal: "2",
            isRestoration: 1,
          }]];
        }
        if (sql.includes("FROM sm_car_panel_status")) return [[]];
        return [[]];
      },
      execute: async (sql: string, params: unknown[] = []) => {
        statements.push({ sql, params });
        return [{ insertId: 901 }];
      },
    };
    const repository = new UnitCatalogRepository(() => ({}) as never, {} as never) as any;

    const result = await repository.materializeItemWithConnection(connection, "CAR-1", 55, "EMP-1", {
      actualName: "Front Seal",
      availabilityStatus: "AVAILABLE",
      conditionStatus: "RESTORE",
      isRestoration: true,
      actionType: "NO_ACTION",
      location: "UNIT",
      notes: null,
      mapping: null,
      qtyOpname: null,
    });

    const masterInsert = statements.find(({ sql }) => sql.includes("INSERT INTO master_panels"));
    expect(result).toEqual({ panelId: 901, alreadyPromoted: false });
    expect(masterInsert?.params?.slice(0, 10)).toEqual([
      "CAR-1",
      55,
      4,
      10,
      "BODY",
      "FRONT BUMPER",
      "Rubber Seal",
      "Front Seal",
      "PN-1",
      2,
    ]);
    expect(masterInsert?.params?.[10]).toBe("RESTORE");
    expect(masterInsert?.params?.[11]).toBe("WAITING");
    expect(masterInsert?.sql.includes("'CATALOG'")).toBe(true);
    expect(statements.some(({ sql }) => sql.includes("sm_jobdesc_countdown"))).toBe(false);
    expect(statements.some(({ sql }) => sql.includes("sm_jobdesc_wo"))).toBe(false);
    expect(statements.some(({ sql }) => sql.toLowerCase().includes("purchase"))).toBe(false);
  });
});

describe("UnitCatalogRepository saveCatalogPanels", () => {
  function createRepository(overrides: {
    existingPanels?: Array<{ id: number; panelName: string }>;
    dependencyCounts?: Record<number, { unitCatalogCount: number; imageCount: number; masterPanelCount: number }>;
  } = {}) {
    const statements: Array<{ sql: string; params: unknown[] }> = [];
    const existingPanels = overrides.existingPanels ?? [];
    const dependencyCounts = overrides.dependencyCounts ?? {};
    const connection = {
      beginTransaction: async () => undefined,
      commit: async () => undefined,
      rollback: async () => undefined,
      release: () => undefined,
      query: async (sql: string, params: unknown[] = []) => {
        statements.push({ sql, params });
        if (sql.includes("FROM catalog_components")) return [[{ id: 4, code: "BODY", componentName: "BODY" }]];
        if (sql.includes("FROM catalog_panels") && sql.includes("FOR UPDATE")) {
          return [existingPanels.map((panel) => ({
            id: panel.id,
            componentId: 4,
            componentCode: "BODY",
            componentName: "BODY",
            panelName: panel.panelName,
          }))];
        }
        if (sql.includes("unitCatalogCount")) {
          const panelId = Number(params[0]);
          return [[dependencyCounts[panelId] ?? { unitCatalogCount: 0, imageCount: 0, masterPanelCount: 0 }]];
        }
        return [[]];
      },
      execute: async (sql: string, params: unknown[] = []) => {
        statements.push({ sql, params });
        return [{ insertId: 901 }];
      },
    };

    const repository = new UnitCatalogRepository(
      () =>
        ({
          getConnection: async () => connection,
        }) as never,
      {} as never,
    );
    repository.listPanelsByComponent = async () => [];
    return { repository, statements };
  }

  it("creates multiple panels through one batch", async () => {
    const { repository, statements } = createRepository();

    await repository.saveCatalogPanels(4, {
      items: [
        { id: null, panelName: " Front Door LH " },
        { id: null, panelName: "Rear Door RH" },
      ],
      deletedIds: [],
    });

    const inserts = statements.filter(({ sql }) => sql.includes("INSERT INTO catalog_panels"));
    expect(inserts.length).toBe(2);
    expect(inserts[0]?.params).toEqual([4, "Front Door LH"]);
    expect(inserts[1]?.params).toEqual([4, "Rear Door RH"]);
  });

  it("renames an existing panel without changing its id", async () => {
    const { repository, statements } = createRepository({
      existingPanels: [{ id: 12, panelName: "FRONT DOOR LH" }],
    });

    await repository.saveCatalogPanels(4, {
      items: [{ id: 12, panelName: "FRONT DOOR LEFT" }],
      deletedIds: [],
    });

    const update = statements.find(({ sql }) => sql.includes("UPDATE catalog_panels"));
    expect(update?.params).toEqual(["FRONT DOOR LEFT", 12, 4]);
  });

  it("rejects duplicate panel name within the same component", async () => {
    const { repository } = createRepository({
      existingPanels: [{ id: 12, panelName: "FRONT DOOR LH" }],
    });

    let error: unknown;
    try {
      await repository.saveCatalogPanels(4, {
        items: [
          { id: 12, panelName: "FRONT DOOR LH" },
          { id: null, panelName: " front door lh " },
        ],
        deletedIds: [],
      });
    } catch (caught) {
      error = caught;
    }

    expect(error instanceof Error ? error.message : "").toBe("CATALOG_PANEL_DUPLICATE");
  });

  it("deletes an unused panel", async () => {
    const { repository, statements } = createRepository({
      existingPanels: [{ id: 12, panelName: "FRONT DOOR LH" }],
    });

    await repository.saveCatalogPanels(4, {
      items: [],
      deletedIds: [12],
    });

    expect(statements.some(({ sql }) => sql.includes("DELETE FROM catalog_panels"))).toBe(true);
  });

  it("blocks deleting a panel used by unit catalog, images, or master panels", async () => {
    const { repository } = createRepository({
      existingPanels: [{ id: 12, panelName: "FRONT DOOR LH" }],
      dependencyCounts: {
        12: { unitCatalogCount: 1, imageCount: 1, masterPanelCount: 1 },
      },
    });

    let error: any;
    try {
      await repository.saveCatalogPanels(4, {
        items: [],
        deletedIds: [12],
      });
    } catch (caught) {
      error = caught;
    }

    expect(error?.message).toBe("CATALOG_PANEL_DELETE_CONFLICT");
    expect(error?.conflict).toEqual({
      panelId: 12,
      unitCatalogCount: 1,
      imageCount: 1,
      masterPanelCount: 1,
    });
  });
});
