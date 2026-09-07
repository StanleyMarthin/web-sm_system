import type { CatalogPanel } from "@smsystem/contracts/unit-catalog";

export interface CatalogPanelDraftRow {
  rowId: string;
  id: number | null;
  panelName: string;
}

function createRowId() {
  return `tmp-panel-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizePanelName(value: string) {
  return value.trim().replace(/\s+/gu, " ");
}

function copyCell(value: string) {
  return value.replace(/\r?\n/gu, " ").replace(/\t/gu, " ").trim();
}

export function createCatalogPanelDraftRow(partial: Partial<CatalogPanelDraftRow> = {}): CatalogPanelDraftRow {
  return {
    rowId: partial.rowId ?? createRowId(),
    id: partial.id ?? null,
    panelName: partial.panelName ?? "",
  };
}

export function catalogPanelDraftRowsFromPanels(panels: CatalogPanel[]) {
  return panels.length > 0
    ? panels.map((panel) => createCatalogPanelDraftRow({ id: panel.id, panelName: panel.panelName }))
    : [createCatalogPanelDraftRow()];
}

export function appendCatalogPanelDraftRow(rows: CatalogPanelDraftRow[]) {
  return [...rows, createCatalogPanelDraftRow()];
}

export function removeCatalogPanelDraftRows(rows: CatalogPanelDraftRow[], rowIds: string[]) {
  const rowIdSet = new Set(rowIds);
  const next = rows.filter((row) => !rowIdSet.has(row.rowId));
  return next.length > 0 ? next : [createCatalogPanelDraftRow()];
}

export function updateCatalogPanelDraftCell(rows: CatalogPanelDraftRow[], rowId: string, value: string) {
  return rows.map((row) => (
    row.rowId === rowId ? { ...row, panelName: value.replace(/\r/gu, "") } : row
  ));
}

export function applyCatalogPanelPaste(rows: CatalogPanelDraftRow[], input: { rowIndex: number; text: string }) {
  const names = input.text
    .split(/\r?\n/u)
    .map((line) => line.split("\t")[0] ?? "")
    .filter((name) => name.trim().length > 0);
  if (names.length === 0) return rows;

  const nextRows = [...rows];
  while (nextRows.length < input.rowIndex + names.length) {
    nextRows.push(createCatalogPanelDraftRow());
  }

  return nextRows.map((row, rowIndex) => {
    const name = names[rowIndex - input.rowIndex];
    return name === undefined ? row : { ...row, panelName: name };
  });
}

export function serializeCatalogPanelDraftRows(rows: CatalogPanelDraftRow[]) {
  const items = rows
    .map((row) => ({
      id: row.id,
      panelName: normalizePanelName(row.panelName),
    }))
    .filter((row) => row.panelName.length > 0);

  const names = new Set<string>();
  for (const item of items) {
    const key = item.panelName.toUpperCase();
    if (names.has(key)) throw new Error("CATALOG_PANEL_DUPLICATE");
    names.add(key);
  }

  return items;
}

export function catalogPanelRowsToClipboardTsv(rows: CatalogPanelDraftRow[]) {
  return ["Panel Name", ...rows.map((row) => copyCell(row.panelName))].join("\n");
}

export function isCatalogPanelDraftDirty(base: CatalogPanelDraftRow[], current: CatalogPanelDraftRow[], deletedIds: number[]) {
  const simplify = (rows: CatalogPanelDraftRow[]) => rows.map(({ rowId: _rowId, ...row }) => ({
    ...row,
    panelName: normalizePanelName(row.panelName),
  }));
  return deletedIds.length > 0 || JSON.stringify(simplify(base)) !== JSON.stringify(simplify(current));
}
