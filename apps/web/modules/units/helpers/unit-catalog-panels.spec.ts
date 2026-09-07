import { describe, expect, it } from "bun:test";
import {
  applyCatalogPanelPaste,
  catalogPanelDraftRowsFromPanels,
  catalogPanelRowsToClipboardTsv,
  catalogPanelPlaceholderRowCount,
  createCatalogPanelDraftRow,
  ensureCatalogPanelPlaceholderRows,
  getDuplicateCatalogPanelRowIds,
  isCatalogPanelDraftDirty,
  serializeCatalogPanelDraftRows,
} from "./unit-catalog-panels";

describe("unit catalog panel helper", () => {
  it("shows blank spreadsheet rows for empty components", () => {
    const rows = catalogPanelDraftRowsFromPanels([]);

    expect(rows).toHaveLength(catalogPanelPlaceholderRowCount);
    expect(serializeCatalogPanelDraftRows(rows)).toEqual([]);
  });

  it("creates multiple panel rows through paste", () => {
    const rows = applyCatalogPanelPaste([createCatalogPanelDraftRow()], {
      rowIndex: 0,
      text: "Front Door LH\nRear Door RH",
    });

    expect(rows).toHaveLength(catalogPanelPlaceholderRowCount);
    expect(rows.slice(0, 2).map((row) => row.panelName)).toEqual(["Front Door LH", "Rear Door RH"]);
  });

  it("supports CRLF paste and trims whitespace", () => {
    const rows = applyCatalogPanelPaste(ensureCatalogPanelPlaceholderRows([]), {
      rowIndex: 0,
      text: " FRONT BUMPER \r\nREAR BUMPER\r\n",
    });

    expect(rows.slice(0, 2).map((row) => row.panelName)).toEqual(["FRONT BUMPER", "REAR BUMPER"]);
  });

  it("appends rows when paste exceeds placeholders", () => {
    const text = Array.from({ length: 20 }, (_, index) => `PANEL ${index + 1}`).join("\n");
    const rows = applyCatalogPanelPaste(ensureCatalogPanelPlaceholderRows([]), { rowIndex: 5, text });

    expect(rows).toHaveLength(26);
    expect(rows[24]?.panelName).toBe("PANEL 20");
    expect(rows[25]?.panelName).toBe("");
  });

  it("appends a blank row after editing the last row", () => {
    const initialRows = ensureCatalogPanelPlaceholderRows([]);
    const rows = ensureCatalogPanelPlaceholderRows(
      initialRows.map((row, index) => (
        index === catalogPanelPlaceholderRowCount - 1 ? { ...row, panelName: "HOOD" } : row
      )),
    );

    expect(rows).toHaveLength(catalogPanelPlaceholderRowCount + 1);
    expect(rows.at(-1)?.panelName).toBe("");
  });

  it("trims panel names and skips empty rows", () => {
    const items = serializeCatalogPanelDraftRows([
      createCatalogPanelDraftRow({ id: null, panelName: " Front Door LH " }),
      createCatalogPanelDraftRow({ id: null, panelName: "" }),
    ]);

    expect(items).toEqual([{ id: null, panelName: "Front Door LH" }]);
  });

  it("rejects duplicate panel names within a component", () => {
    const rows = [
      createCatalogPanelDraftRow({ panelName: "Front Door LH" }),
      createCatalogPanelDraftRow({ panelName: " front door lh " }),
    ];

    expect(getDuplicateCatalogPanelRowIds(rows).size).toBe(2);
    expect(() => serializeCatalogPanelDraftRows(rows)).toThrow("CATALOG_PANEL_DUPLICATE");
  });

  it("tracks dirty state and cancel restore shape", () => {
    const base = catalogPanelDraftRowsFromPanels([{
      id: 1,
      componentId: 4,
      componentCode: "BODY",
      componentName: "BODY",
      panelName: "Front Door LH",
    }]);
    const changed = [{ ...base[0]!, panelName: "Front Door RH" }];

    expect(isCatalogPanelDraftDirty(base, changed, [])).toBe(true);
    expect(isCatalogPanelDraftDirty(base, base, [])).toBe(false);
    expect(isCatalogPanelDraftDirty(base, base, [1])).toBe(true);
  });

  it("serializes panel rows for spreadsheet copy", () => {
    expect(catalogPanelRowsToClipboardTsv([
      createCatalogPanelDraftRow({ panelName: "Front Door LH" }),
      createCatalogPanelDraftRow({ panelName: "Rear Door RH" }),
      createCatalogPanelDraftRow({ panelName: "" }),
    ])).toBe("Front Door LH\nRear Door RH");
  });
});
