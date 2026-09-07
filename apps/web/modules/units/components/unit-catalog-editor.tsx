/*
Tujuan: Grid catalog berbasis AG Grid Community untuk workspace panel.
Caller: UnitCatalogTab.
Dependensi: ag-grid-react/community, helper unit-catalog-sheet.
Main Functions: edit cell, pilih row, paste TSV custom, grid read-only/edit mode.
Side Effects: Tidak ada langsung.
*/

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CellMouseDownEvent, CellMouseOverEvent, ColDef } from "ag-grid-community";
import { AllCommunityModule, ModuleRegistry } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { Clipboard, ClipboardPaste, Plus, Trash2 } from "lucide-react";
import {
  ActionButton,
  CompactInput,
} from "@/shared/ui/compact";
import {
  applyCatalogPaste,
  catalogCellsToClipboardTsv,
  catalogGridFields,
  catalogRowsToClipboardTsv,
  updateCatalogDraftCell,
  type CatalogDraftField,
  type CatalogDraftRow,
} from "@/modules/units/helpers/unit-catalog-sheet";

ModuleRegistry.registerModules([AllCommunityModule]);

interface UnitCatalogEditorProps {
  rows: CatalogDraftRow[];
  editMode: boolean;
  searchValue: string;
  selectedRowIds: string[];
  onSearchChange: (value: string) => void;
  onRowsChange: (rows: CatalogDraftRow[]) => void;
  onSelectedRowIdsChange: (rowIds: string[]) => void;
  onAddRow: () => void;
  onDeleteSelected: () => void;
}

type GridRef = AgGridReact<CatalogDraftRow>;
type CatalogCellRef = { rowIndex: number; field: CatalogDraftField };
type CatalogCellRange = { start: CatalogCellRef; end: CatalogCellRef };

function qtyCellClass(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return "";
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? "" : "catalog-cell-invalid";
}

export function UnitCatalogEditor({
  rows,
  editMode,
  searchValue,
  selectedRowIds,
  onSearchChange,
  onRowsChange,
  onSelectedRowIdsChange,
  onAddRow,
  onDeleteSelected,
}: UnitCatalogEditorProps) {
  const gridRef = useRef<GridRef>(null);
  const draggingCellRange = useRef(false);
  const [cellRange, setCellRange] = useState<CatalogCellRange | null>(null);

  useEffect(() => {
    function stopDragging() {
      draggingCellRange.current = false;
    }

    window.addEventListener("mouseup", stopDragging);
    return () => window.removeEventListener("mouseup", stopDragging);
  }, []);

  useEffect(() => {
    gridRef.current?.api.refreshCells({ force: true });
  }, [cellRange]);

  function isCellInRange(rowIndex: number | null | undefined, field: string | undefined) {
    if (rowIndex == null || !field || !catalogGridFields.includes(field as CatalogDraftField) || !cellRange) return false;
    const startColumn = catalogGridFields.indexOf(cellRange.start.field);
    const endColumn = catalogGridFields.indexOf(cellRange.end.field);
    const fieldColumn = catalogGridFields.indexOf(field as CatalogDraftField);
    return rowIndex >= Math.min(cellRange.start.rowIndex, cellRange.end.rowIndex) &&
      rowIndex <= Math.max(cellRange.start.rowIndex, cellRange.end.rowIndex) &&
      fieldColumn >= Math.min(startColumn, endColumn) &&
      fieldColumn <= Math.max(startColumn, endColumn);
  }

  function getCellClass(field: CatalogDraftField, value: unknown, rowIndex: number | null | undefined) {
    return [
      field === "qtyNormal" ? qtyCellClass(value) : "",
      isCellInRange(rowIndex, field) ? "catalog-cell-range-selected" : "",
    ].filter(Boolean).join(" ");
  }

  const columnDefs = useMemo<ColDef<CatalogDraftRow>[]>(() => ([
    {
      field: "code",
      headerName: "Code",
      minWidth: 110,
      editable: editMode,
      cellClass: (params) => getCellClass("code", params.value, params.node.rowIndex),
    },
    {
      field: "partNumber",
      headerName: "Part Number",
      minWidth: 160,
      editable: editMode,
      cellClass: (params) => getCellClass("partNumber", params.value, params.node.rowIndex),
    },
    {
      field: "itemName",
      headerName: "Item Name",
      minWidth: 220,
      editable: editMode,
      flex: 1,
      cellClass: (params) => getCellClass("itemName", params.value, params.node.rowIndex),
    },
    {
      field: "position",
      headerName: "Position",
      minWidth: 120,
      editable: editMode,
      cellClass: (params) => getCellClass("position", params.value, params.node.rowIndex),
    },
    {
      field: "qtyNormal",
      headerName: "Qty Normal",
      minWidth: 120,
      editable: editMode,
      cellClass: (params) => getCellClass("qtyNormal", params.value, params.node.rowIndex),
    },
    {
      field: "isRestoration",
      headerName: "Restorasi",
      minWidth: 120,
      editable: editMode,
      cellEditor: "agCheckboxCellEditor",
      cellRenderer: (params: { value: boolean }) => (params.value ? "Ya" : "-"),
      valueFormatter: (params) => (params.value ? "Ya" : "-"),
      cellClass: (params) => getCellClass("isRestoration", params.value, params.node.rowIndex),
    },
  ]), [editMode, cellRange]);

  function handlePaste(text: string) {
    const focused = gridRef.current?.api.getFocusedCell();
    const rowIndex = focused?.rowIndex ?? 0;
    const column = focused?.column?.getColId() as CatalogDraftField | undefined;
    const targetColumn = column && catalogGridFields.includes(column) ? column : "code";
    onRowsChange(applyCatalogPaste(rows, { rowIndex, column: targetColumn, text }));
  }

  function getRowsForCopy() {
    const visible: CatalogDraftRow[] = [];
    const selectedVisible: CatalogDraftRow[] = [];
    gridRef.current?.api.forEachNodeAfterFilterAndSort((node) => {
      if (!node.data) return;
      visible.push(node.data);
      if (node.isSelected()) selectedVisible.push(node.data);
    });
    if (selectedVisible.length > 0) return selectedVisible;
    return visible.length > 0 ? visible : rows;
  }

  function getRangeForCopy() {
    if (!cellRange) return null;
    const visibleRows: CatalogDraftRow[] = [];
    gridRef.current?.api.forEachNodeAfterFilterAndSort((node) => {
      if (node.data) visibleRows.push(node.data);
    });

    const rowStart = Math.min(cellRange.start.rowIndex, cellRange.end.rowIndex);
    const rowEnd = Math.max(cellRange.start.rowIndex, cellRange.end.rowIndex);
    const columnStart = Math.min(catalogGridFields.indexOf(cellRange.start.field), catalogGridFields.indexOf(cellRange.end.field));
    const columnEnd = Math.max(catalogGridFields.indexOf(cellRange.start.field), catalogGridFields.indexOf(cellRange.end.field));

    return {
      rows: visibleRows.slice(rowStart, rowEnd + 1),
      fields: catalogGridFields.slice(columnStart, columnEnd + 1),
    };
  }

  function getClipboardText() {
    const range = getRangeForCopy();
    if (range && range.rows.length > 0) return catalogCellsToClipboardTsv(range.rows, range.fields);
    return catalogRowsToClipboardTsv(getRowsForCopy());
  }

  async function copyRows() {
    await navigator.clipboard?.writeText(getClipboardText());
  }

  async function handleClipboardPaste() {
    try {
      const text = await navigator.clipboard?.readText();
      if (text?.trim()) handlePaste(text);
    } catch {
      return;
    }
  }

  function getEventCell(event: CellMouseDownEvent<CatalogDraftRow> | CellMouseOverEvent<CatalogDraftRow>): CatalogCellRef | null {
    const rowIndex = event.node.rowIndex;
    const field = event.column.getColId();
    if (rowIndex == null || !catalogGridFields.includes(field as CatalogDraftField)) return null;
    return { rowIndex, field: field as CatalogDraftField };
  }

  function startCellRange(event: CellMouseDownEvent<CatalogDraftRow>) {
    if (event.event instanceof MouseEvent && event.event.button !== 0) return;
    const cell = getEventCell(event);
    if (!cell) return;
    draggingCellRange.current = true;
    setCellRange({ start: cell, end: cell });
  }

  function extendCellRange(event: CellMouseOverEvent<CatalogDraftRow>) {
    if (!draggingCellRange.current) return;
    const cell = getEventCell(event);
    if (!cell) return;
    setCellRange((current) => current ? { ...current, end: cell } : { start: cell, end: cell });
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <div className="min-w-[16rem] flex-1">
          <CompactInput
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Cari code, part number, atau nama item"
          />
        </div>
        <ActionButton
          onClick={() => {
            void copyRows();
          }}
          title="Copy ke Excel"
        >
          <Clipboard className="h-3.5 w-3.5" />
          Copy
        </ActionButton>
        {editMode ? (
          <>
            <ActionButton onClick={onAddRow} title="Tambah row kosong">
              <Plus className="h-3.5 w-3.5" />
              + Row
            </ActionButton>
            <ActionButton
              onClick={() => {
                void handleClipboardPaste();
              }}
              title="Tempel isi spreadsheet"
            >
              <ClipboardPaste className="h-3.5 w-3.5" />
              Paste
            </ActionButton>
            <ActionButton
              onClick={onDeleteSelected}
              disabled={selectedRowIds.length === 0}
              title="Hapus row terpilih"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete Row
            </ActionButton>
          </>
        ) : null}
      </div>

      <div
        className="ag-theme-alpine sms-ag-grid h-full min-h-[30rem] w-full"
        onPasteCapture={(event) => {
          if (!editMode) return;
          const text = event.clipboardData.getData("text/plain");
          if (!text.trim()) return;
          event.preventDefault();
          handlePaste(text);
        }}
        onCopyCapture={(event) => {
          const activeElement = document.activeElement;
          if (activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement) return;
          event.preventDefault();
          event.clipboardData.setData("text/plain", getClipboardText());
        }}
      >
        <AgGridReact<CatalogDraftRow>
          ref={gridRef}
          rowData={rows}
          columnDefs={columnDefs}
          rowSelection="multiple"
          animateRows={false}
          suppressMovableColumns
          suppressClipboardPaste
          defaultColDef={{
            sortable: true,
            resizable: true,
            editable: editMode,
          }}
          quickFilterText={searchValue}
          getRowId={(params) => params.data.rowId}
          onSelectionChanged={() => {
            const selected = gridRef.current?.api.getSelectedRows() ?? [];
            onSelectedRowIdsChange(selected.map((row) => row.rowId));
          }}
          onCellMouseDown={startCellRange}
          onCellMouseOver={extendCellRange}
          onCellValueChanged={(event) => {
            const field = event.colDef.field as CatalogDraftField | undefined;
            if (!field) return;
            onRowsChange(updateCatalogDraftCell(rows, event.data.rowId, field, event.newValue as string | boolean));
          }}
        />
      </div>
    </div>
  );
}
