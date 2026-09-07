import { describe, expect, it } from "bun:test";
import type { CatalogWorkspace } from "@smsystem/contracts/unit-catalog";
import {
  applyCatalogPaste,
  appendParsedCatalogRows,
  catalogCellsToClipboardTsv,
  catalogRowsToClipboardTsv,
  clampCatalogImageZoom,
  createCatalogDraftRow,
  createCatalogWorkspaceDraft,
  getCatalogImageFilesFromClipboardItems,
  getCatalogImageHoverPosition,
  isCatalogDraftDirty,
  removeCatalogDraftImage,
  resolveCatalogPanelImagesForSave,
  removeCatalogDraftRows,
  serializeCatalogDraftRows,
  stageCatalogImageFiles,
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

  it("stages one uploaded image with local preview before save", () => {
    const file = new File(["image"], "front.jpg", { type: "image/jpeg" });
    const images = stageCatalogImageFiles([], [file], () => "blob:front");

    expect(images).toHaveLength(1);
    expect(images[0]).toMatchObject({
      id: null,
      fileUrl: "blob:front",
      caption: "",
      sortOrder: 0,
    });
    expect(images[0]?.file).toBe(file);
  });

  it("stages multiple image files and rejects non-image files", () => {
    const first = new File(["image"], "front.png", { type: "image/png" });
    const second = new File(["image"], "rear.webp", { type: "image/webp" });

    const images = stageCatalogImageFiles([], [
      first,
      new File(["text"], "notes.txt", { type: "text/plain" }),
      second,
    ], (file) => `blob:${file.name}`);

    expect(images.map((image) => image.fileUrl)).toEqual(["blob:front.png", "blob:rear.webp"]);
    expect(images.map((image) => image.sortOrder)).toEqual([0, 1]);
  });

  it("extracts pasted clipboard image files", () => {
    const file = new File(["image"], "paste.png", { type: "image/png" });
    const files = getCatalogImageFilesFromClipboardItems([
      { kind: "string", type: "text/plain", getAsFile: () => null },
      { kind: "file", type: "image/png", getAsFile: () => file },
    ]);

    expect(files).toEqual([file]);
  });

  it("removes staged image before save without marking persisted delete", () => {
    const file = new File(["image"], "front.jpg", { type: "image/jpeg" });
    const images = stageCatalogImageFiles([
      { id: 9, fileUrl: "https://img.test/old.jpg", caption: "", sortOrder: 0 },
    ], [file], () => "blob:front");

    const result = removeCatalogDraftImage(images, 1);

    expect(result.images).toHaveLength(1);
    expect(result.deletedId).toBeNull();
    expect(result.images[0]?.id).toBe(9);
  });

  it("uploads staged images only when catalog panel is saved", async () => {
    const file = new File(["image"], "front.jpg", { type: "image/jpeg" });
    const images = stageCatalogImageFiles([
      { id: 9, fileUrl: "https://img.test/old.jpg", caption: "old", sortOrder: 0 },
    ], [file], () => "blob:front");

    const saved = await resolveCatalogPanelImagesForSave(images, async (stagedFile) => (
      `https://img.test/uploaded/${stagedFile.name}`
    ));

    expect(saved).toEqual([
      { id: 9, fileUrl: "https://img.test/old.jpg", caption: "old", sortOrder: 0 },
      { id: null, fileUrl: "https://img.test/uploaded/front.jpg", caption: null, sortOrder: 1 },
    ]);
  });

  it("clamps image zoom", () => {
    expect(clampCatalogImageZoom(0.5)).toBe(1);
    expect(clampCatalogImageZoom(2.25)).toBe(2.25);
    expect(clampCatalogImageZoom(8)).toBe(4);
    expect(clampCatalogImageZoom(Number.NaN)).toBe(1);
  });

  it("maps hover position to image percentages", () => {
    expect(getCatalogImageHoverPosition(150, 80, {
      left: 100,
      top: 40,
      width: 200,
      height: 80,
    })).toEqual({ x: 25, y: 50 });
    expect(getCatalogImageHoverPosition(20, 200, {
      left: 100,
      top: 40,
      width: 200,
      height: 80,
    })).toEqual({ x: 0, y: 100 });
  });

  it("serializes catalog rows for Excel copy", () => {
    const text = catalogRowsToClipboardTsv([
      createCatalogDraftRow({
        code: "1",
        partNumber: "PN\t1",
        itemName: "Rubber\nSeal",
        position: "21",
        qtyNormal: "1",
        isRestoration: true,
      }),
    ]);

    expect(text).toBe("Code\tPart Number\tItem Name\tPosition\tQty Normal\tRestorasi\n1\tPN 1\tRubber Seal\t21\t1\tYa");
  });

  it("serializes selected catalog cells without headers", () => {
    const text = catalogCellsToClipboardTsv([
      createCatalogDraftRow({
        partNumber: "PN 1",
        itemName: "Rubber Seal",
      }),
      createCatalogDraftRow({
        partNumber: "PN 2",
        itemName: "Door Clip",
      }),
    ], ["partNumber", "itemName"]);

    expect(text).toBe("PN 1\tRubber Seal\nPN 2\tDoor Clip");
  });
});
