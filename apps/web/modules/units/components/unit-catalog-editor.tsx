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
import { CheckCircle2, Eye } from "lucide-react";
import {
  CompactInput,
} from "@/shared/ui/compact";
import {
  applyCatalogPaste,
  catalogCellsToClipboardTsv,
  catalogGridFields,
  catalogRowsToClipboardTsv,
  updateCatalogDraftCell,
  type CatalogDraftField,
  type CatalogGridField,
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
  onOpenDetail: (row: CatalogDraftRow) => void;
  onMarkPosition: (row: CatalogDraftRow) => void;
  onSurvey: (row: CatalogDraftRow) => void;
}

type GridRef = AgGridReact<CatalogDraftRow>;
type CatalogCellRef = { rowIndex: number; field: CatalogGridField };
type CatalogCellRange = { start: CatalogCellRef; end: CatalogCellRef };

function qtyCellClass(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return "";
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? "" : "catalog-cell-invalid";
}

function surveyStatusLabel(row: CatalogDraftRow) {
  if (row.surveyStatus === "MASTER_PANEL_CREATED") return "Master Panel Created";
  if (row.surveyStatus === "SUDAH_DIDATA" || row.isRestoration) return "Pendataan Selesai";
  return "Belum Didata";
}

function surveyStatusTone(row: CatalogDraftRow) {
  if (row.surveyStatus === "MASTER_PANEL_CREATED") return "bg-foreground";
  if (row.surveyStatus === "SUDAH_DIDATA" || row.isRestoration) return "bg-success";
  return "bg-amber-500";
}

function availabilityLabel(value: CatalogDraftRow["availabilityStatus"]) {
  if (value === "AVAILABLE") return "Ada";
  if (value === "NOT_AVAILABLE") return "Tidak Ada";
  if (value === "UNKNOWN") return "Tidak Ditemukan";
  return "-";
}

function conditionLabel(value: CatalogDraftRow["conditionStatus"]) {
  if (value === "GOOD") return "Layak";
  if (value === "RESTORE") return "Restorasi";
  if (value === "NOT_USABLE") return "Tidak Layak";
  return "-";
}

function isRowEditable(editMode: boolean, row?: CatalogDraftRow) {
  return editMode && !row?.promotedPanelId;
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
  onOpenDetail,
  onMarkPosition,
  onSurvey,
}: UnitCatalogEditorProps) {
  const gridRef = useRef<GridRef>(null);
  const draggingCellRange = useRef(false);
  const [cellRange, setCellRange] = useState<CatalogCellRange | null>(null);

  useEffect(() => {
    if (!editMode) return;
    const lastRow = rows.at(-1);
    if (!lastRow || lastRow.code || lastRow.partNumber || lastRow.itemName || lastRow.qtyNormal || lastRow.isRestoration) {
      onAddRow();
    }
  }, [editMode, onAddRow, rows]);

  useEffect(() => {
    function stopDragging() {
      draggingCellRange.current = false;
    }

    window.addEventListener("mouseup", stopDragging);
    return () => window.removeEventListener("mouseup", stopDragging);
  }, []);

  useEffect(() => {
    gridRef.current?.api?.refreshCells({ force: true });
  }, [cellRange]);

  function isCellInRange(rowIndex: number | null | undefined, field: string | undefined) {
    if (rowIndex == null || !field || !catalogGridFields.includes(field as CatalogGridField) || !cellRange) return false;
    const startColumn = catalogGridFields.indexOf(cellRange.start.field);
    const endColumn = catalogGridFields.indexOf(cellRange.end.field);
    const fieldColumn = catalogGridFields.indexOf(field as CatalogGridField);
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
      field: "aliasName",
      headerName: "Alias Name",
      minWidth: 160,
      editable: false,
      valueGetter: (params) => params.data?.aliasName || "-",
    },
    {
      field: "itemName",
      headerName: "Original Name",
      minWidth: 220,
      editable: (params) => isRowEditable(editMode, params.data),
      flex: 1,
      cellClass: (params) => getCellClass("itemName", params.value, params.node.rowIndex),
    },
    {
      field: "partNumber",
      headerName: "Part Number",
      minWidth: 160,
      editable: (params) => isRowEditable(editMode, params.data),
      cellClass: (params) => getCellClass("partNumber", params.value, params.node.rowIndex),
    },
    {
      field: "code",
      headerName: "Code",
      minWidth: 110,
      editable: (params) => isRowEditable(editMode, params.data),
      cellClass: (params) => getCellClass("code", params.value, params.node.rowIndex),
    },
    {
      field: "qtyNormal",
      headerName: "Qty Normal",
      minWidth: 96,
      editable: (params) => isRowEditable(editMode, params.data),
      cellClass: (params) => getCellClass("qtyNormal", params.value, params.node.rowIndex),
    },
    {
      colId: "availabilityStatus",
      headerName: "Availability",
      minWidth: 130,
      editable: false,
      valueGetter: (params) => availabilityLabel(params.data?.availabilityStatus ?? null),
    },
    {
      colId: "conditionStatus",
      headerName: "Condition",
      minWidth: 130,
      editable: false,
      valueGetter: (params) => conditionLabel(params.data?.conditionStatus ?? null),
    },
    {
      field: "isRestoration",
      headerName: "Progress Restorasi",
      minWidth: 150,
      editable: (params) => isRowEditable(editMode, params.data),
      cellEditor: "agCheckboxCellEditor",
      cellRenderer: (params: { value: boolean }) => (params.value ? "Ya" : "-"),
      valueFormatter: (params) => (params.value ? "Ya" : "-"),
      cellClass: (params) => getCellClass("isRestoration", params.value, params.node.rowIndex),
    },
    {
      colId: "surveyStatus",
      headerName: "Status",
      minWidth: 140,
      editable: false,
      valueGetter: (params) => params.data ? surveyStatusLabel(params.data) : "",
      cellRenderer: (params: { data?: CatalogDraftRow }) => {
        if (!params.data) return null;
        return (
          <span className="inline-flex h-full items-center gap-2 text-xs font-medium">
            <span className={`h-2 w-2 rounded-full ${surveyStatusTone(params.data)}`} />
            {surveyStatusLabel(params.data)}
          </span>
        );
      },
      cellClass: (params) => params.data?.surveyStatus === "MASTER_PANEL_CREATED"
        ? "text-success"
        : params.data?.isRestoration
          ? "text-app-accent-ink"
          : "text-muted-foreground",
    },
    {
      colId: "actions",
      headerName: "Action",
      minWidth: 128,
      editable: false,
      sortable: false,
      resizable: false,
      cellRenderer: (params: { data?: CatalogDraftRow }) => {
        if (!params.data) return null;
        const row = params.data as CatalogDraftRow;
        const promoted = Boolean(row.promotedPanelId);
        return (
          <div className="flex h-full items-center gap-1">
            <button type="button" className="catalog-icon-button" onClick={() => onOpenDetail(row)} title="Detail">
              <Eye className="h-3.5 w-3.5" />
            </button>
            <button type="button" className="catalog-icon-button" onClick={() => onMarkPosition(row)} title={promoted ? "Lihat lokasi" : "Tandai"}>
              <span aria-hidden="true" className="text-[13px] leading-none">📌</span>
            </button>
            {!promoted ? (
              <button type="button" className="catalog-icon-button" onClick={() => onSurvey(row)} title="Pendataan">
                <CheckCircle2 className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        );
      },
    },
  ]), [editMode, cellRange, onOpenDetail, onMarkPosition, onSurvey]);

  function handlePaste(text: string) {
    const focused = gridRef.current?.api?.getFocusedCell();
    const rowIndex = focused?.rowIndex ?? 0;
    const column = focused?.column?.getColId() as CatalogGridField | undefined;
    const targetColumn = column && catalogGridFields.includes(column) ? column : "itemName";
    onRowsChange(applyCatalogPaste(rows, { rowIndex, column: targetColumn, text }));
  }

  function getRowsForCopy() {
    const visible: CatalogDraftRow[] = [];
    const selectedVisible: CatalogDraftRow[] = [];
    gridRef.current?.api?.forEachNodeAfterFilterAndSort((node) => {
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
    gridRef.current?.api?.forEachNodeAfterFilterAndSort((node) => {
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

  function getEventCell(event: CellMouseDownEvent<CatalogDraftRow> | CellMouseOverEvent<CatalogDraftRow>): CatalogCellRef | null {
    const rowIndex = event.node.rowIndex;
    const field = event.column.getColId();
    if (rowIndex == null || !catalogGridFields.includes(field as CatalogGridField)) return null;
    return { rowIndex, field: field as CatalogGridField };
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
            placeholder="Cari alias, part number, atau nama item"
          />
        </div>
      </div>

      <div
        className="ag-theme-alpine sms-ag-grid h-full min-h-[30rem] w-full"
        onKeyDownCapture={(event) => {
          if (!editMode) return;
          const activeElement = document.activeElement;
          if (activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement) return;
          if ((event.key === "Delete" || event.key === "Backspace") && selectedRowIds.length > 0) {
            event.preventDefault();
            onDeleteSelected();
          }
        }}
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
            const selected = gridRef.current?.api?.getSelectedRows() ?? [];
            onSelectedRowIdsChange(selected.map((row) => row.rowId));
          }}
          onCellMouseDown={startCellRange}
          onCellMouseOver={extendCellRange}
          onCellValueChanged={(event) => {
            const field = event.colDef.field;
            if (!field || !catalogGridFields.includes(field as CatalogGridField)) return;
            onRowsChange(updateCatalogDraftCell(rows, event.data.rowId, field as CatalogGridField, event.newValue as string | boolean));
          }}
        />
      </div>
    </div>
  );
}
