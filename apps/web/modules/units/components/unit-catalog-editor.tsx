/*
Tujuan: Grid catalog berbasis AG Grid Community untuk workspace panel.
Caller: UnitCatalogTab.
Dependensi: ag-grid-react/community, helper unit-catalog-sheet.
Main Functions: edit cell, pilih row, paste TSV custom, grid read-only/edit mode.
Side Effects: Tidak ada langsung.
*/

"use client";

import { useMemo, useRef } from "react";
import type { ColDef } from "ag-grid-community";
import { AllCommunityModule, ModuleRegistry } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { Clipboard, ClipboardPaste, Plus, Trash2 } from "lucide-react";
import {
  ActionButton,
  CompactInput,
} from "@/shared/ui/compact";
import {
  applyCatalogPaste,
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

  const columnDefs = useMemo<ColDef<CatalogDraftRow>[]>(() => ([
    { field: "code", headerName: "Code", minWidth: 110, editable: editMode },
    { field: "partNumber", headerName: "Part Number", minWidth: 160, editable: editMode },
    { field: "itemName", headerName: "Item Name", minWidth: 220, editable: editMode, flex: 1 },
    { field: "position", headerName: "Position", minWidth: 120, editable: editMode },
    {
      field: "qtyNormal",
      headerName: "Qty Normal",
      minWidth: 120,
      editable: editMode,
      cellClass: (params) => qtyCellClass(params.value),
    },
    {
      field: "isRestoration",
      headerName: "Restorasi",
      minWidth: 120,
      editable: editMode,
      cellEditor: "agCheckboxCellEditor",
      cellRenderer: (params: { value: boolean }) => (params.value ? "Ya" : "-"),
      valueFormatter: (params) => (params.value ? "Ya" : "-"),
    },
  ]), [editMode]);

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

  function getClipboardText() {
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
