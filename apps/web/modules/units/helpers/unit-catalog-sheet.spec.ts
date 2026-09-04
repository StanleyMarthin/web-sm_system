import { describe, expect, it } from "bun:test";
import type { CatalogWorkspace } from "@smsystem/contracts/unit-catalog";
import {
  applyCatalogPaste,
  appendParsedCatalogRows,
  createCatalogDraftRow,
  createCatalogWorkspaceDraft,
  isCatalogDraftDirty,
  removeCatalogDraftRows,
  serializeCatalogDraftRows,
  updateCatalogDraftCell,
  workspaceDraftFromWorkspace,
} from "./unit-catalog-sheet";

describe("unit catalog sheet helper", () => {
  it("parses one spreadsheet row", () => {
    const rows = appendParsedCatalogRows(
      [createCatalogDraftRow()],
      "1\tPN-1\tRubber Seal\t21\t1\tYA",
    );

    expect(rows.length).toBe(1);
    expect(rows[0]).toMatchObject({
      code: "1",
      partNumber: "PN-1",
      itemName: "Rubber Seal",
      position: "21",
      qtyNormal: "1",
      isRestoration: true,
    });
  });

  it("parses multi row tsv with CRLF", () => {
    const rows = appendParsedCatalogRows(
      [createCatalogDraftRow({ code: "seed" })],
      "CODE\tPART NUMBER\tITEM NAME\tPOSITION\tQTY NORMAL\tRESTORATION\r\n1\tPN-1\tDoor Trim\t11\t1\tYA\r\n2\t\tClip\t12\t\t\r\n",
    );

    expect(rows.length).toBe(3);
    expect(rows[1]).toMatchObject({
      code: "1",
      partNumber: "PN-1",
      itemName: "Door Trim",
      position: "11",
      qtyNormal: "1",
      isRestoration: true,
    });
    expect(rows[2]).toMatchObject({
      code: "2",
      partNumber: "",
      itemName: "Clip",
      position: "12",
      qtyNormal: "",
      isRestoration: false,
    });
  });

  it("updates one cell immutably", () => {
    const seed = createCatalogDraftRow({ itemName: "" });
    const rows = [seed];
    const updated = updateCatalogDraftCell(
      rows,
      seed.rowId,
      "itemName",
      "Front Fender LH",
    );

    expect(rows[0]?.itemName).toBe("");
    expect(updated[0]?.itemName).toBe("Front Fender LH");
  });

  it("hydrates draft from workspace", () => {
    const workspace: CatalogWorkspace = {
      carId: "CAR-1",
      panel: {
        id: 7,
        componentId: 4,
        componentCode: "BODY",
        componentName: "BODY",
        panelName: "FRONT FENDER LH",
      },
      panelImages: [{
        id: 3,
        panelId: 7,
        fileUrl: "https://img.test/1.jpg",
        caption: "main",
        sortOrder: 0,
        createdAt: null,
      }],
      items: [{
        id: 5,
        clientRowId: null,
        code: "11",
        partNumber: null,
        itemName: "Rubber Seal",
        position: "21",
        qtyNormal: 1,
        isRestoration: true,
        createdAt: null,
        updatedAt: null,
      }],
    };

    const draft = workspaceDraftFromWorkspace(workspace);

    expect(draft.panelId).toBe(7);
    expect(draft.panelImages).toHaveLength(1);
    expect(draft.rows[0]).toMatchObject({
      persistedId: 5,
      code: "11",
      itemName: "Rubber Seal",
      qtyNormal: "1",
      isRestoration: true,
    });
  });

  it("keeps one blank row when selection removes all rows", () => {
    const seed = createCatalogDraftRow({ itemName: "Front Fender LH" });
    const reset = removeCatalogDraftRows([seed], [seed.rowId]);

    expect(reset.length).toBe(1);
    expect(reset[0]).toMatchObject({
      code: "",
      partNumber: "",
      itemName: "",
      position: "",
      qtyNormal: "",
      isRestoration: false,
    });
  });

  it("preserves empty cells and appends rows when paste starts from selected column", () => {
    const rows = applyCatalogPaste([createCatalogDraftRow()], {
      rowIndex: 0,
      column: "partNumber",
      text: "PN-1\tRubber Seal\t21\nPN-2\t\t22",
    });

    expect(rows.length).toBe(2);
    expect(rows[0]).toMatchObject({
      code: "",
      partNumber: "PN-1",
      itemName: "Rubber Seal",
      position: "21",
    });
    expect(rows[1]).toMatchObject({
      partNumber: "PN-2",
      itemName: "",
      position: "22",
    });
  });

  it("drops trailing empty row on save but keeps partial row", () => {
    const items = serializeCatalogDraftRows([
      createCatalogDraftRow({
        code: "1",
        partNumber: "",
        itemName: "Rubber Seal",
        isRestoration: true,
      }),
      createCatalogDraftRow(),
    ]);

    expect(items.length).toBe(1);
    expect(items[0]).toMatchObject({
      code: "1",
      partNumber: null,
      itemName: "Rubber Seal",
      position: null,
      qtyNormal: null,
      isRestoration: true,
    });
  });

  it("tracks dirty state and cancel restore shape", () => {
    const baseline = createCatalogWorkspaceDraft(7);
    const changed = {
      ...baseline,
      rows: updateCatalogDraftCell(
        baseline.rows,
        baseline.rows[0]!.rowId,
        "itemName",
        "Rubber Seal",
      ),
    };

    expect(isCatalogDraftDirty(baseline, changed)).toBe(true);
    expect(isCatalogDraftDirty(baseline, baseline)).toBe(false);

    const restored = workspaceDraftFromWorkspace({
      carId: "CAR-1",
      panel: {
        id: 7,
        componentId: 4,
        componentCode: "BODY",
        componentName: "BODY",
        panelName: "FRONT FENDER LH",
      },
      panelImages: [],
      items: [],
    });

    expect(isCatalogDraftDirty(restored, restored)).toBe(false);
  });
});
