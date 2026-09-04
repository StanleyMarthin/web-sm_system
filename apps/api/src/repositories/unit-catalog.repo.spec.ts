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
