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
  "position",
  "qtyNormal",
  "isRestoration",
] as const;

export type CatalogDraftField = typeof catalogGridFields[number];

export interface CatalogDraftRow {
  rowId: string;
  persistedId: number | null;
  code: string;
  partNumber: string;
  itemName: string;
  position: string;
  qtyNormal: string;
  isRestoration: boolean;
}

export interface CatalogDraftPanelImage {
  id: number | null;
  fileUrl: string;
  caption: string;
  sortOrder: number;
  file?: File | null;
}

export interface CatalogWorkspaceDraft {
  panelId: number;
  panelImages: CatalogDraftPanelImage[];
  rows: CatalogDraftRow[];
}

const allowedCatalogImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const allowedCatalogImageExtensions = new Set(["jpg", "jpeg", "png", "webp"]);
export const catalogImageMaxBytes = Number(process.env.NEXT_PUBLIC_CATALOG_IMAGE_MAX_BYTES ?? 10 * 1024 * 1024);
export const catalogImageZoomMin = 1;
export const catalogImageZoomMax = 4;

function createRowId() {
  return `tmp-${Math.random().toString(36).slice(2, 10)}`;
}

function emptyString(value: string | null | undefined) {
  return value ?? "";
}

function normalizeCell(value: string) {
  return value.replace(/\r/gu, "");
}

function normalizeBoolean(value: string | boolean) {
  if (typeof value === "boolean") return value;
  const normalized = value.trim().toUpperCase();
  if (!normalized) return false;
  return ["1", "TRUE", "YA", "YES", "Y", "RESTORE", "RESTORATION"].includes(normalized);
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
    position: emptyString(item.position),
    qtyNormal: item.qtyNormal == null ? "" : String(item.qtyNormal),
    isRestoration: Boolean(item.isRestoration),
  };
}

export function createCatalogDraftRow(partial: Partial<CatalogDraftRow> = {}): CatalogDraftRow {
  return {
    rowId: partial.rowId ?? createRowId(),
    persistedId: partial.persistedId ?? null,
    code: partial.code ?? "",
    partNumber: partial.partNumber ?? "",
    itemName: partial.itemName ?? "",
    position: partial.position ?? "",
    qtyNormal: partial.qtyNormal ?? "",
    isRestoration: partial.isRestoration ?? false,
  };
}

export function createCatalogWorkspaceDraft(panelId = 0): CatalogWorkspaceDraft {
  return {
    panelId,
    panelImages: [],
    rows: [createCatalogDraftRow()],
  };
}

export function workspaceDraftFromWorkspace(workspace: CatalogWorkspace): CatalogWorkspaceDraft {
  return {
    panelId: workspace.panel.id,
    panelImages: workspace.panelImages.map((media) => ({
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

export function updateCatalogDraftCell(rows: CatalogDraftRow[], rowId: string, field: CatalogDraftField, value: string | boolean) {
  return rows.map((row) => (
    row.rowId === rowId
      ? { ...row, [field]: field === "isRestoration" ? normalizeBoolean(value) : normalizeCell(String(value)) }
      : row
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

function getFileExtension(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

export function isValidCatalogImageFile(file: File, maxBytes = catalogImageMaxBytes) {
  const type = file.type.split(";")[0]?.trim().toLowerCase() ?? "";
  const extension = getFileExtension(file.name);
  return (allowedCatalogImageTypes.has(type) || (!type && allowedCatalogImageExtensions.has(extension))) &&
    file.size > 0 &&
    file.size <= maxBytes;
}

export function stageCatalogImageFiles(
  images: CatalogDraftPanelImage[],
  files: File[],
  createObjectUrl: (file: File) => string,
  maxBytes = catalogImageMaxBytes,
) {
  const staged = files
    .filter((file) => isValidCatalogImageFile(file, maxBytes))
    .map((file, index) => ({
      id: null,
      fileUrl: createObjectUrl(file),
      caption: "",
      sortOrder: images.length + index,
      file,
    }));

  return [...images, ...staged];
}

export function getCatalogImageFilesFromClipboardItems(items: Array<Pick<DataTransferItem, "kind" | "type" | "getAsFile">>) {
  return items
    .filter((item) => item.kind === "file" && item.type.toLowerCase().startsWith("image/"))
    .map((item) => item.getAsFile())
    .filter((file): file is File => file !== null);
}

export function removeCatalogDraftImage(images: CatalogDraftPanelImage[], index: number) {
  const removed = images[index] ?? null;
  return {
    images: images
      .filter((_, imageIndex) => imageIndex !== index)
      .map((image, imageIndex) => ({ ...image, sortOrder: imageIndex })),
    deletedId: removed?.id ?? null,
  };
}

export function clampCatalogImageZoom(value: number) {
  if (!Number.isFinite(value)) return catalogImageZoomMin;
  return Math.min(Math.max(value, catalogImageZoomMin), catalogImageZoomMax);
}

export function getCatalogImageHoverPosition(
  clientX: number,
  clientY: number,
  rect: Pick<DOMRect, "left" | "top" | "width" | "height">,
) {
  const x = rect.width > 0 ? ((clientX - rect.left) / rect.width) * 100 : 50;
  const y = rect.height > 0 ? ((clientY - rect.top) / rect.height) * 100 : 50;
  return {
    x: Math.min(Math.max(x, 0), 100),
    y: Math.min(Math.max(y, 0), 100),
  };
}

export async function resolveCatalogPanelImagesForSave(
  images: CatalogDraftPanelImage[],
  uploadFile: (file: File) => Promise<string>,
) {
  const resolved = [];
  for (const [index, image] of images.entries()) {
    const fileUrl = image.file ? await uploadFile(image.file) : image.fileUrl.trim();
    if (!fileUrl) continue;
    resolved.push({
      id: image.id,
      fileUrl,
      caption: image.caption.trim() || null,
      sortOrder: index,
    });
  }
  return resolved;
}

function draftRowHasValue(row: CatalogDraftRow) {
  return Boolean(
    row.code.trim() ||
    row.partNumber.trim() ||
    row.itemName.trim() ||
    row.position.trim() ||
    row.qtyNormal.trim() ||
    row.isRestoration,
  );
}

function draftRowToInput(row: CatalogDraftRow): CatalogWorkspaceItemInput {
  return {
    id: row.persistedId,
    clientRowId: row.rowId,
    code: nullableText(row.code),
    partNumber: nullableText(row.partNumber),
    itemName: nullableText(row.itemName),
    position: nullableText(row.position),
    qtyNormal: nullableNumber(row.qtyNormal),
    isRestoration: row.isRestoration,
  };
}

export function serializeCatalogDraftRows(rows: CatalogDraftRow[]) {
  return rows
    .filter(draftRowHasValue)
    .map((row) => draftRowToInput(row));
}

function parsedItemToDraftRow(item: CatalogWorkspaceItemInput): CatalogDraftRow {
  return createCatalogDraftRow({
    code: emptyString(item.code),
    partNumber: emptyString(item.partNumber),
    itemName: emptyString(item.itemName),
    position: emptyString(item.position),
    qtyNormal: item.qtyNormal == null ? "" : String(item.qtyNormal),
    isRestoration: Boolean(item.isRestoration),
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
    const next: CatalogDraftRow = { ...row };
    for (let columnOffset = 0; columnOffset < pastedRow.length; columnOffset += 1) {
      const field = catalogGridFields[startColumn + columnOffset];
      if (!field) break;
      if (field === "isRestoration") {
        next.isRestoration = normalizeBoolean(pastedRow[columnOffset] ?? "");
      } else {
        next[field] = normalizeCell(pastedRow[columnOffset] ?? "");
      }
    }
    return next;
  });
}

export function isCatalogDraftDirty(base: CatalogWorkspaceDraft, current: CatalogWorkspaceDraft) {
  return JSON.stringify({
    panelId: base.panelId,
    panelImages: base.panelImages,
    rows: base.rows.map(({ rowId: _rowId, ...row }) => row),
  }) !== JSON.stringify({
    panelId: current.panelId,
    panelImages: current.panelImages,
    rows: current.rows.map(({ rowId: _rowId, ...row }) => row),
  });
}
