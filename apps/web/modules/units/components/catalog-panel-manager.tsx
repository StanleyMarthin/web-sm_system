"use client";

import type { CatalogComponent } from "@smsystem/contracts/unit-catalog";
import type { ColDef } from "ag-grid-community";
import { AllCommunityModule, ModuleRegistry } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { Clipboard, ClipboardPaste, Plus, Save, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  appendCatalogPanelDraftRow,
  applyCatalogPanelPaste,
  catalogPanelDraftRowsFromPanels,
  catalogPanelRowsToClipboardTsv,
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
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const dirty = isCatalogPanelDraftDirty(baseline, rows, deletedIds);
  const columnDefs = useMemo<ColDef<CatalogPanelDraftRow>[]>(() => ([
    { field: "id", headerName: "ID", hide: true },
    { field: "panelName", headerName: "Panel Name", editable: true, flex: 1, minWidth: 240 },
  ]), []);

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

  async function changeComponent(nextValue: string) {
    const nextComponentId = Number(nextValue);
    if (!Number.isFinite(nextComponentId) || nextComponentId <= 0) return;
    if (dirty) {
      const confirmed = await sweetAlert.confirm({
        title: "Perubahan belum disimpan",
        description: "Perubahan panel akan dibuang bila pindah komponen sekarang.",
        confirmLabel: "Pindah",
        cancelLabel: "Tetap",
      });
      if (!confirmed) return;
    }
    setComponentId(nextComponentId);
  }

  function handlePaste(text: string) {
    const rowIndex = gridRef.current?.api.getFocusedCell()?.rowIndex ?? 0;
    setRows((current) => applyCatalogPanelPaste(current, { rowIndex, text }));
  }

  function getRowsForCopy() {
    const visible: CatalogPanelDraftRow[] = [];
    const selectedVisible: CatalogPanelDraftRow[] = [];
    gridRef.current?.api.forEachNodeAfterFilterAndSort((node) => {
      if (!node.data) return;
      visible.push(node.data);
      if (node.isSelected()) selectedVisible.push(node.data);
    });
    return selectedVisible.length > 0 ? selectedVisible : visible;
  }

  async function copyRows() {
    await navigator.clipboard?.writeText(catalogPanelRowsToClipboardTsv(getRowsForCopy()));
  }

  async function pasteFromClipboard() {
    const text = await navigator.clipboard?.readText().catch(() => "");
    if (text.trim()) handlePaste(text);
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

  async function cancel() {
    setRows(baseline);
    setDeletedIds([]);
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
    if (!componentId) return;
    setSaving(true);
    let items;
    try {
      items = serializeCatalogPanelDraftRows(rows);
    } catch {
      sweetAlert.notifyError("Nama panel duplikat", "Panel dengan nama yang sama tidak boleh ada dalam satu komponen.");
      setSaving(false);
      return;
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
      return;
    }
    const nextRows = catalogPanelDraftRowsFromPanels(result.payload.data.panels);
    setBaseline(nextRows);
    setRows(nextRows);
    setDeletedIds([]);
    setSelectedRowIds([]);
    sweetAlert.notifySuccess("Panel catalog tersimpan");
    onSaved();
  }

  function activeRowCount() {
    try {
      return serializeCatalogPanelDraftRows(rows).length;
    } catch {
      return rows.filter((row) => row.panelName.trim()).length;
    }
  }

  return (
    <SectionCard label="Kelola Panel Catalog" count={activeRowCount()} className="min-h-[42rem]">
      {sweetAlert.alertElement}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={componentId}
          onChange={(event) => { void changeComponent(event.target.value); }}
          className="h-9 min-w-[14rem] border border-border bg-card px-3 text-sm"
        >
          {components.map((component) => (
            <option key={component.id} value={component.id}>
              {component.componentName}
            </option>
          ))}
        </select>
        <ActionButton onClick={() => setRows((current) => appendCatalogPanelDraftRow(current))}>
          <Plus className="h-3.5 w-3.5" />
          Tambah Baris
        </ActionButton>
        <ActionButton onClick={() => { void pasteFromClipboard(); }}>
          <ClipboardPaste className="h-3.5 w-3.5" />
          Paste
        </ActionButton>
        <ActionButton onClick={() => { void copyRows(); }}>
          <Clipboard className="h-3.5 w-3.5" />
          Copy
        </ActionButton>
        <ActionButton onClick={deleteSelectedRows} disabled={selectedRowIds.length === 0} variant="danger">
          <Trash2 className="h-3.5 w-3.5" />
          Delete Row
        </ActionButton>
        <div className="flex-1" />
        <ActionButton onClick={() => { void cancel(); }} disabled={!dirty}>
          <X className="h-3.5 w-3.5" />
          Batal
        </ActionButton>
        <ActionButton onClick={() => { void save(); }} disabled={!dirty || saving || loading} variant="primary">
          <Save className="h-3.5 w-3.5" />
          {saving ? "Menyimpan" : "Simpan"}
        </ActionButton>
        <ActionButton onClick={() => { void close(); }}>Kembali</ActionButton>
      </div>
      <div
        className="ag-theme-alpine sms-ag-grid h-[34rem] w-full border border-border"
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
          getRowId={(params) => params.data.rowId}
          onSelectionChanged={() => {
            const selected = gridRef.current?.api.getSelectedRows() ?? [];
            setSelectedRowIds(selected.map((row) => row.rowId));
          }}
          onCellValueChanged={(event) => {
            setRows((current) => updateCatalogPanelDraftCell(current, event.data.rowId, String(event.newValue ?? "")));
          }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Paste dari Excel/Google Sheets masuk ke kolom Panel Name. Delete akan ditolak bila panel sudah dipakai.
      </p>
    </SectionCard>
  );
}
