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
      description: null,
      isActive: true,
    });
    repository.ensureReference = async () => 17;
    repository.getPanelWorkspace = async () => ({
      referenceId: 17,
      carId: "CAR-1",
      panel: {
        id: 11,
        componentId: 4,
        componentCode: "BODY",
        componentName: "BODY",
        panelName: "FRONT FENDER LH",
        description: null,
        isActive: true,
      },
      referenceUrl: null,
      notes: null,
      media: [],
      items: [],
    });

    await repository.savePanelWorkspace("CAR-1", 11, "EMP-1", {
      referenceUrl: null,
      notes: null,
      deletedItemIds: [],
      deletedMediaIds: [],
      media: [],
      items: [
        {
          id: null,
          clientRowId: "tmp-1",
          code: "12",
          partNumber: null,
          itemName: "Rubber Seal",
          positionCode: null,
          qtyNormal: null,
          notes: null,
          sortOrder: 0,
        },
        {
          id: null,
          clientRowId: "tmp-2",
          code: null,
          partNumber: null,
          itemName: null,
          positionCode: null,
          qtyNormal: null,
          notes: null,
          sortOrder: 1,
        },
      ],
    });

    const itemInsertStatements = statements.filter(({ sql }) =>
      sql.includes("INSERT INTO unit_catalog_items"),
    );

    expect(itemInsertStatements.length).toBe(1);
    expect(itemInsertStatements[0]?.params).toEqual([
      17,
      "12",
      null,
      "Rubber Seal",
      null,
      null,
      null,
      0,
    ]);
    expect(statements.some(({ sql }) => sql.includes("master_panels"))).toBe(
      false,
    );
  });
});
