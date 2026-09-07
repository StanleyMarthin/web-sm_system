import { describe, expect, it } from "bun:test";
import {
  applyCatalogPanelPaste,
  catalogPanelDraftRowsFromPanels,
  catalogPanelRowsToClipboardTsv,
  createCatalogPanelDraftRow,
  isCatalogPanelDraftDirty,
  serializeCatalogPanelDraftRows,
} from "./unit-catalog-panels";

describe("unit catalog panel helper", () => {
  it("creates multiple panel rows through paste", () => {
    const rows = applyCatalogPanelPaste([createCatalogPanelDraftRow()], {
      rowIndex: 0,
      text: "Front Door LH\nRear Door RH",
    });

    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.panelName)).toEqual(["Front Door LH", "Rear Door RH"]);
  });

  it("trims panel names and skips empty rows", () => {
    const items = serializeCatalogPanelDraftRows([
      createCatalogPanelDraftRow({ id: null, panelName: " Front Door LH " }),
      createCatalogPanelDraftRow({ id: null, panelName: "" }),
    ]);

    expect(items).toEqual([{ id: null, panelName: "Front Door LH" }]);
  });

  it("rejects duplicate panel names within a component", () => {
    expect(() => serializeCatalogPanelDraftRows([
      createCatalogPanelDraftRow({ panelName: "Front Door LH" }),
      createCatalogPanelDraftRow({ panelName: " front door lh " }),
    ])).toThrow("CATALOG_PANEL_DUPLICATE");
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
    ])).toBe("Panel Name\nFront Door LH\nRear Door RH");
  });
});
