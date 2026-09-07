"use client";

import type { CatalogComponent } from "@smsystem/contracts/unit-catalog";
import type { ColDef } from "ag-grid-community";
import { AllCommunityModule, ModuleRegistry } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { Save, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  applyCatalogPanelPaste,
  catalogPanelDraftRowsFromPanels,
  catalogPanelRowsToClipboardTsv,
  ensureCatalogPanelPlaceholderRows,
  getDuplicateCatalogPanelRowIds,
  isCatalogPanelDraftDirty,
  removeCatalogPanelDraftRows,
  serializeCatalogPanelDraftRows,
  updateCatalogPanelDraftCell,
  type CatalogPanelDraftRow,
} from "@/modules/units/helpers/unit-catalog-panels";
import {
  fetchCatalogPanelsByComponent,
  saveCatalogPanels,
} from "@/shared/api/unit-catalog";
import { ActionButton, SectionCard } from "@/shared/ui/compact";
import { useSweetAlert } from "@/shared/ui/sweet-alert";

ModuleRegistry.registerModules([AllCommunityModule]);

interface CatalogPanelManagerProps {
  components: CatalogComponent[];
  onClose: () => void;
  onSaved: () => void;
}

type GridRef = AgGridReact<CatalogPanelDraftRow>;

export function CatalogPanelManager({ components, onClose, onSaved }: CatalogPanelManagerProps) {
  const sweetAlert = useSweetAlert();
  const gridRef = useRef<GridRef>(null);
  const [componentId, setComponentId] = useState(components[0]?.id ?? 0);
  const [baseline, setBaseline] = useState<CatalogPanelDraftRow[]>([]);
  const [rows, setRows] = useState<CatalogPanelDraftRow[]>([]);
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const [deletedIds, setDeletedIds] = useState<number[]>([]);
  const [pendingComponentId, setPendingComponentId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const dirty = isCatalogPanelDraftDirty(baseline, rows, deletedIds);
  const duplicateRowIds = useMemo(() => getDuplicateCatalogPanelRowIds(rows), [rows]);
  const activeComponent = components.find((component) => component.id === componentId) ?? components[0] ?? null;
  const columnDefs = useMemo<ColDef<CatalogPanelDraftRow>[]>(() => ([
    { field: "id", headerName: "ID", hide: true },
    {
      headerName: "NO",
      valueGetter: (params) => (params.node?.rowIndex ?? 0) + 1,
      editable: false,
      width: 82,
      minWidth: 72,
      sortable: false,
      resizable: false,
      cellClass: "font-mono text-muted-foreground",
    },
    {
      field: "panelName",
      headerName: "PANEL NAME",
      editable: true,
      flex: 1,
      minWidth: 240,
      cellClass: (params) => (
        params.data && duplicateRowIds.has(params.data.rowId) ? "catalog-cell-invalid" : ""
      ),
    },
  ]), [duplicateRowIds]);

  async function loadPanels(nextComponentId: number) {
    setLoading(true);
    const result = await fetchCatalogPanelsByComponent(nextComponentId);
    setLoading(false);
    if (!result.success) {
      sweetAlert.notifyError("Panel belum dapat dimuat", result.message);
      return;
    }
    const nextRows = catalogPanelDraftRowsFromPanels(result.payload.data.panels);
    setBaseline(nextRows);
    setRows(nextRows);
    setDeletedIds([]);
    setSelectedRowIds([]);
  }

  useEffect(() => {
    if (componentId <= 0 && components[0]?.id) setComponentId(components[0].id);
  }, [componentId, components]);

  useEffect(() => {
    if (componentId > 0) void loadPanels(componentId);
  }, [componentId]);

  function requestComponentChange(nextComponentId: number) {
    if (!Number.isFinite(nextComponentId) || nextComponentId <= 0) return;
    if (nextComponentId === componentId) return;
    if (dirty) {
      setPendingComponentId(nextComponentId);
      return;
    }
    setComponentId(nextComponentId);
  }

  function handlePaste(text: string) {
    const rowIndex = gridRef.current?.api?.getFocusedCell()?.rowIndex ?? 0;
    setRows((current) => applyCatalogPanelPaste(current, { rowIndex, text }));
  }

  function getRowsForCopy() {
    const visible: CatalogPanelDraftRow[] = [];
    const selectedVisible: CatalogPanelDraftRow[] = [];
    gridRef.current?.api?.forEachNodeAfterFilterAndSort((node) => {
      if (!node.data) return;
      visible.push(node.data);
      if (node.isSelected()) selectedVisible.push(node.data);
    });
    return selectedVisible.length > 0 ? selectedVisible : visible;
  }

  function deleteSelectedRows() {
    setRows((current) => {
      const selected = new Set(selectedRowIds);
      const persistedIds = current
        .filter((row) => selected.has(row.rowId) && row.id)
        .map((row) => row.id as number);
      if (persistedIds.length > 0) {
        setDeletedIds((existing) => [...new Set([...existing, ...persistedIds])]);
      }
      return removeCatalogPanelDraftRows(current, selectedRowIds);
    });
    setSelectedRowIds([]);
  }

  async function close() {
    if (dirty) {
      const confirmed = await sweetAlert.confirm({
        title: "Perubahan belum disimpan",
        description: "Perubahan panel akan dibuang bila kembali sekarang.",
        confirmLabel: "Kembali",
        cancelLabel: "Tetap",
      });
      if (!confirmed) return;
    }
    onClose();
  }

  async function save() {
    return saveCurrentComponent();
  }

  async function saveCurrentComponent() {
    if (!componentId || duplicateRowIds.size > 0) {
      sweetAlert.notifyError("Nama panel duplikat", "Panel dengan nama yang sama tidak boleh ada dalam satu komponen.");
      return false;
    }
    setSaving(true);
    let items;
    try {
      items = serializeCatalogPanelDraftRows(rows);
    } catch {
      sweetAlert.notifyError("Nama panel duplikat", "Panel dengan nama yang sama tidak boleh ada dalam satu komponen.");
      setSaving(false);
      return false;
    }

    const result = await saveCatalogPanels(componentId, { items, deletedIds });
    setSaving(false);
    if (!result.success) {
      const conflict = result.data as {
        unitCatalogCount?: number;
        imageCount?: number;
        masterPanelCount?: number;
      } | undefined;
      sweetAlert.notifyError(
        result.errorCode === "CATALOG_PANEL_DELETE_CONFLICT" ? "Panel tidak dapat dihapus karena sudah digunakan." : "Panel belum tersimpan",
        conflict
          ? `Unit catalog: ${conflict.unitCatalogCount ?? 0}, gambar: ${conflict.imageCount ?? 0}, master panel: ${conflict.masterPanelCount ?? 0}.`
          : result.message,
      );
      return false;
    }
    const nextRows = catalogPanelDraftRowsFromPanels(result.payload.data.panels);
    setBaseline(nextRows);
    setRows(nextRows);
    setDeletedIds([]);
    setSelectedRowIds([]);
    sweetAlert.notifySuccess("Panel catalog tersimpan");
    onSaved();
    return true;
  }

  async function saveAndContinue() {
    if (pendingComponentId == null) return;
    const nextComponentId = pendingComponentId;
    const saved = await saveCurrentComponent();
    if (!saved) return;
    setPendingComponentId(null);
    setComponentId(nextComponentId);
  }

  function discardAndContinue() {
    if (pendingComponentId == null) return;
    const nextComponentId = pendingComponentId;
    setPendingComponentId(null);
    setRows(baseline);
    setDeletedIds([]);
    setSelectedRowIds([]);
    setComponentId(nextComponentId);
  }

  function activeRowCount() {
    try {
      return serializeCatalogPanelDraftRows(rows).length;
    } catch {
      return rows.filter((row) => row.panelName.trim()).length;
    }
  }

  const pendingComponent = components.find((component) => component.id === pendingComponentId) ?? null;

  return (
    <SectionCard label="Master Panel Catalog" count={activeRowCount()} className="min-h-[42rem]">
      {sweetAlert.alertElement}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Kelola Master Panel Catalog</p>
            <p className="text-xs text-muted-foreground">
              Klik cell untuk mengetik • Ctrl+V untuk paste dari Excel/Sheets • Enter untuk baris berikutnya
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <ActionButton onClick={() => { void close(); }}>Kembali</ActionButton>
            <ActionButton
              onClick={() => { void save(); }}
              disabled={!dirty || saving || loading}
              variant="primary"
              title={duplicateRowIds.size > 0 ? "Ada nama panel duplikat" : undefined}
            >
              <Save className="h-3.5 w-3.5" />
              {saving ? "Menyimpan" : "Simpan"}
            </ActionButton>
          </div>
        </div>

        <select
          value={componentId}
          onChange={(event) => requestComponentChange(Number(event.target.value))}
          className="h-10 w-full border border-border bg-card px-3 text-sm md:hidden"
        >
          {components.map((component) => (
            <option key={component.id} value={component.id}>
              {component.componentName}
            </option>
          ))}
        </select>

        <div className="hidden gap-1 overflow-x-auto border-b border-border pb-2 md:flex">
          {components.map((component) => (
            <button
              key={component.id}
              type="button"
              onClick={() => requestComponentChange(component.id)}
              className={`h-10 shrink-0 border px-4 font-mono text-[12px] font-medium uppercase tracking-[0.08em] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                component.id === activeComponent?.id
                  ? "border-primary/45 bg-primary/10 text-app-accent-ink"
                  : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {component.componentName}
            </button>
          ))}
        </div>

        {pendingComponent ? (
          <div className="flex flex-wrap items-center justify-between gap-2 border border-primary/25 bg-primary/10 px-3 py-2 text-sm">
            <span className="text-foreground">Perubahan belum disimpan.</span>
            <div className="flex flex-wrap items-center gap-1.5">
              <ActionButton variant="primary" onClick={() => { void saveAndContinue(); }}>
                Simpan & lanjut
              </ActionButton>
              <ActionButton onClick={discardAndContinue}>Buang perubahan</ActionButton>
              <ActionButton onClick={() => setPendingComponentId(null)}>
                <X className="h-3.5 w-3.5" />
                Batal
              </ActionButton>
            </div>
          </div>
        ) : null}
      </div>
      <div
        className="ag-theme-alpine sms-ag-grid h-[34rem] w-full border border-border"
        onKeyDownCapture={(event) => {
          const target = event.target;
          const isTyping = target instanceof HTMLInputElement ||
            target instanceof HTMLTextAreaElement ||
            (target instanceof HTMLElement && target.isContentEditable);
          if (isTyping || selectedRowIds.length === 0 || !["Delete", "Backspace"].includes(event.key)) return;
          event.preventDefault();
          deleteSelectedRows();
        }}
        onPasteCapture={(event) => {
          const text = event.clipboardData.getData("text/plain");
          if (!text.trim()) return;
          event.preventDefault();
          handlePaste(text);
        }}
        onCopyCapture={(event) => {
          event.preventDefault();
          event.clipboardData.setData("text/plain", catalogPanelRowsToClipboardTsv(getRowsForCopy()));
        }}
      >
        <AgGridReact<CatalogPanelDraftRow>
          ref={gridRef}
          rowData={rows}
          columnDefs={columnDefs}
          rowSelection="multiple"
          animateRows={false}
          suppressMovableColumns
          suppressClipboardPaste
          defaultColDef={{ sortable: true, resizable: true, editable: true }}
          singleClickEdit
          enterNavigatesVertically
          enterNavigatesVerticallyAfterEdit
          stopEditingWhenCellsLoseFocus
          getRowId={(params) => params.data.rowId}
          onSelectionChanged={() => {
            const selected = gridRef.current?.api?.getSelectedRows() ?? [];
            setSelectedRowIds(selected.map((row) => row.rowId));
          }}
          onCellValueChanged={(event) => {
            setRows((current) => updateCatalogPanelDraftCell(current, event.data.rowId, String(event.newValue ?? "")));
          }}
          onGridReady={() => setRows((current) => ensureCatalogPanelPlaceholderRows(current))}
        />
      </div>
    </SectionCard>
  );
}
