/*
Tujuan: Menyimpan state spreadsheet catalog web dan parser paste TSV.
Caller: unit catalog tab dan test helper.
Dependensi: kontrak unit-catalog.
Main Functions: hydrate draft, edit cell, paste range, serialisasi save batch.
Side Effects: Tidak ada.
*/

import {
  parseCatalogSpreadsheetText,
  type CatalogWorkspace,
  type CatalogWorkspaceItemInput,
} from "@smsystem/contracts/unit-catalog";

export const catalogGridFields = [
  "code",
  "partNumber",
  "itemName",
  "positionCode",
  "qtyNormal",
  "notes",
] as const;

export type CatalogDraftField = typeof catalogGridFields[number];

export interface CatalogDraftRow {
  rowId: string;
  persistedId: number | null;
  code: string;
  partNumber: string;
  itemName: string;
  positionCode: string;
  qtyNormal: string;
  notes: string;
}

export interface CatalogWorkspaceDraft {
  referenceId: number | null;
  panelId: number;
  referenceUrl: string;
  notes: string;
  media: Array<{
    id: number | null;
    fileUrl: string;
    caption: string;
    sortOrder: number;
  }>;
  rows: CatalogDraftRow[];
}

function createRowId() {
  return `tmp-${Math.random().toString(36).slice(2, 10)}`;
}

function emptyString(value: string | null | undefined) {
  return value ?? "";
}

function normalizeCell(value: string) {
  return value.replace(/\r/gu, "");
}

function nullableText(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function nullableNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed.replace(",", "."));
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`QTY_INVALID:${trimmed}`);
  }
  return parsed;
}

function rowFromItem(item: Partial<CatalogWorkspace["items"][number]> & { id?: number | null }): CatalogDraftRow {
  return {
    rowId: createRowId(),
    persistedId: item.id ?? null,
    code: emptyString(item.code),
    partNumber: emptyString(item.partNumber),
    itemName: emptyString(item.itemName),
    positionCode: emptyString(item.positionCode),
    qtyNormal: item.qtyNormal == null ? "" : String(item.qtyNormal),
    notes: emptyString(item.notes),
  };
}

export function createCatalogDraftRow(partial: Partial<CatalogDraftRow> = {}): CatalogDraftRow {
  return {
    rowId: partial.rowId ?? createRowId(),
    persistedId: partial.persistedId ?? null,
    code: partial.code ?? "",
    partNumber: partial.partNumber ?? "",
    itemName: partial.itemName ?? "",
    positionCode: partial.positionCode ?? "",
    qtyNormal: partial.qtyNormal ?? "",
    notes: partial.notes ?? "",
  };
}

export function createCatalogWorkspaceDraft(panelId = 0): CatalogWorkspaceDraft {
  return {
    referenceId: null,
    panelId,
    referenceUrl: "",
    notes: "",
    media: [],
    rows: [createCatalogDraftRow()],
  };
}

export function workspaceDraftFromWorkspace(workspace: CatalogWorkspace): CatalogWorkspaceDraft {
  return {
    referenceId: workspace.referenceId,
    panelId: workspace.panel.id,
    referenceUrl: emptyString(workspace.referenceUrl),
    notes: emptyString(workspace.notes),
    media: workspace.media.map((media) => ({
      id: media.id,
      fileUrl: media.fileUrl,
      caption: emptyString(media.caption),
      sortOrder: media.sortOrder,
    })),
    rows: workspace.items.length > 0
      ? workspace.items.map((item) => rowFromItem(item))
      : [createCatalogDraftRow()],
  };
}

export function updateCatalogDraftCell(rows: CatalogDraftRow[], rowId: string, field: CatalogDraftField, value: string) {
  return rows.map((row) => (
    row.rowId === rowId ? { ...row, [field]: normalizeCell(value) } : row
  ));
}

export function appendEmptyCatalogDraftRow(rows: CatalogDraftRow[]) {
  return [...rows, createCatalogDraftRow()];
}

export function removeCatalogDraftRows(rows: CatalogDraftRow[], rowIds: string[]) {
  const set = new Set(rowIds);
  const next = rows.filter((row) => !set.has(row.rowId));
  return next.length > 0 ? next : [createCatalogDraftRow()];
}

function draftRowHasValue(row: CatalogDraftRow) {
  return Boolean(
    row.code.trim() ||
    row.partNumber.trim() ||
    row.itemName.trim() ||
    row.positionCode.trim() ||
    row.qtyNormal.trim() ||
    row.notes.trim(),
  );
}

function draftRowToInput(row: CatalogDraftRow, sortOrder: number): CatalogWorkspaceItemInput {
  return {
    id: row.persistedId,
    clientRowId: row.rowId,
    code: nullableText(row.code),
    partNumber: nullableText(row.partNumber),
    itemName: nullableText(row.itemName),
    positionCode: nullableText(row.positionCode),
    qtyNormal: nullableNumber(row.qtyNormal),
    notes: nullableText(row.notes),
    sortOrder,
  };
}

export function serializeCatalogDraftRows(rows: CatalogDraftRow[]) {
  return rows
    .filter(draftRowHasValue)
    .map((row, index) => draftRowToInput(row, index));
}

function parsedItemToDraftRow(item: CatalogWorkspaceItemInput): CatalogDraftRow {
  return createCatalogDraftRow({
    code: emptyString(item.code),
    partNumber: emptyString(item.partNumber),
    itemName: emptyString(item.itemName),
    positionCode: emptyString(item.positionCode),
    qtyNormal: item.qtyNormal == null ? "" : String(item.qtyNormal),
    notes: emptyString(item.notes),
  });
}

export function appendParsedCatalogRows(rows: CatalogDraftRow[], text: string) {
  const parsed = parseCatalogSpreadsheetText(text).map(parsedItemToDraftRow);
  if (parsed.length === 0) return rows;
  if (rows.length === 1 && !draftRowHasValue(rows[0])) return parsed;
  return [...rows, ...parsed];
}

export function applyCatalogPaste(rows: CatalogDraftRow[], input: { rowIndex: number; column: CatalogDraftField; text: string }) {
  const parsedRows = input.text
    .split(/\r?\n/u)
    .map((line) => line.split("\t"))
    .filter((cells) => cells.some((cell) => cell.trim().length > 0));

  if (parsedRows.length === 0) return rows;

  const startColumn = catalogGridFields.indexOf(input.column);
  if (startColumn < 0) return rows;

  const nextRows = [...rows];
  while (nextRows.length < input.rowIndex + parsedRows.length) {
    nextRows.push(createCatalogDraftRow());
  }

  return nextRows.map((row, rowIndex) => {
    const pastedRow = parsedRows[rowIndex - input.rowIndex];
    if (!pastedRow) return row;
    const next = { ...row };
    for (let columnOffset = 0; columnOffset < pastedRow.length; columnOffset += 1) {
      const field = catalogGridFields[startColumn + columnOffset];
      if (!field) break;
      next[field] = normalizeCell(pastedRow[columnOffset] ?? "");
    }
    return next;
  });
}

export function isCatalogDraftDirty(base: CatalogWorkspaceDraft, current: CatalogWorkspaceDraft) {
  return JSON.stringify({
    referenceId: base.referenceId,
    panelId: base.panelId,
    referenceUrl: base.referenceUrl,
    notes: base.notes,
    media: base.media,
    rows: base.rows.map(({ rowId: _rowId, ...row }) => row),
  }) !== JSON.stringify({
    referenceId: current.referenceId,
    panelId: current.panelId,
    referenceUrl: current.referenceUrl,
    notes: current.notes,
    media: current.media,
    rows: current.rows.map(({ rowId: _rowId, ...row }) => row),
  });
}
