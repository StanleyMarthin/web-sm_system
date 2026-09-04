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
});

describe("UnitCatalogRepository promoteAdditionalItem", () => {
  it("creates master panel with ADDITIONAL provenance", async () => {
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
            componentName: "BODY",
            panelName: "FRONT BUMPER",
            itemName: "Bracket Bumper",
            partNumber: "ADD-001",
            deskription: "temuan tambahan",
          }]];
        }
        if (sql.includes("FROM catalog_panels")) {
          return [[{
            componentId: 4,
            panelId: 1,
            componentName: "BODY",
            panelName: "FRONT BUMPER",
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

    const repository: any = new UnitCatalogRepository(
      () =>
        ({
          getConnection: async () => connection,
        }) as never,
      {} as never,
    );

    await repository.promoteAdditionalItem("CAR-1", 77, "EMP-1");

    const masterInsert = statements.find(({ sql }) => sql.includes("INSERT INTO master_panels"));
    expect(masterInsert?.params?.slice(0, 8)).toEqual([
      "CAR-1",
      77,
      4,
      1,
      "BODY",
      "FRONT BUMPER",
      "Bracket Bumper",
      "ADD-001",
    ]);
    expect(masterInsert?.sql.includes("'ADDITIONAL'")).toBe(true);
    expect(statements.some(({ sql }) => sql.includes("sm_jobdesc_countdown"))).toBe(false);
    expect(statements.some(({ sql }) => sql.includes("sm_jobdesc_wo"))).toBe(false);
  });
});
