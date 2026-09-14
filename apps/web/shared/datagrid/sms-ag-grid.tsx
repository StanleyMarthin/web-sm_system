"use client";

import { AllCommunityModule, ModuleRegistry, type ColDef } from "ag-grid-community";
import { AgGridReact, type AgGridReactProps } from "ag-grid-react";
import type { ReactNode } from "react";
import { useMemo } from "react";

ModuleRegistry.registerModules([AllCommunityModule]);

export const smsAgGridDefaultColDef = {
  resizable: true,
  sortable: true,
  filter: true,
  suppressHeaderMenuButton: true,
} satisfies ColDef;

export interface SmsAgGridProps<TRow> extends Omit<AgGridReactProps<TRow>, "defaultColDef" | "rowHeight" | "headerHeight" | "popupParent"> {
  heightClassName?: string;
  className?: string;
  defaultColDef?: ColDef<TRow>;
  rowHeight?: number;
  headerHeight?: number;
  popupParent?: HTMLElement;
  emptyMessage?: string;
  children?: ReactNode;
}

export function SmsAgGrid<TRow>({
  heightClassName = "h-[24rem]",
  className = "",
  defaultColDef,
  rowHeight = 42,
  headerHeight = 40,
  popupParent,
  emptyMessage = "Belum ada data.",
  children,
  ...props
}: SmsAgGridProps<TRow>) {
  const resolvedPopupParent = useMemo(
    () => popupParent ?? (typeof document === "undefined" ? undefined : document.body),
    [popupParent],
  );
  const resolvedDefaultColDef = useMemo<ColDef<TRow>>(
    () => ({
      resizable: true,
      sortable: true,
      filter: true,
      suppressHeaderMenuButton: true,
      ...defaultColDef,
    }),
    [defaultColDef],
  );

  return (
    <div className={["ag-theme-alpine sms-ag-grid w-full", heightClassName, className].filter(Boolean).join(" ")}>
      {children}
      <AgGridReact<TRow>
        {...props}
        defaultColDef={resolvedDefaultColDef}
        rowHeight={rowHeight}
        headerHeight={headerHeight}
        popupParent={resolvedPopupParent}
        suppressMovableColumns={props.suppressMovableColumns ?? true}
        stopEditingWhenCellsLoseFocus={props.stopEditingWhenCellsLoseFocus ?? true}
        overlayNoRowsTemplate={`<span class="text-muted-foreground">${emptyMessage}</span>`}
      />
    </div>
  );
}

interface SmsGridDraftActionsProps {
  canCreate: boolean;
  hasDrafts: boolean;
  isSaving: boolean;
  onAdd: () => void;
  onSave: () => void;
  onCancel: () => void;
}

export function SmsGridDraftActions({
  canCreate,
  hasDrafts,
  isSaving,
  onAdd,
  onSave,
  onCancel,
}: SmsGridDraftActionsProps) {
  if (!canCreate) return null;

  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={onAdd} disabled={isSaving} className="inline-flex items-center gap-1.5 border border-border px-2 py-1 text-[12px] font-mono uppercase text-foreground hover:bg-muted disabled:opacity-40">
        + Tambah Row
      </button>
      <button type="button" onClick={onSave} disabled={!hasDrafts || isSaving} className="inline-flex items-center gap-1.5 border border-primary/40 bg-primary/[0.06] px-2 py-1 text-[12px] font-mono uppercase text-app-accent-ink hover:bg-primary/10 disabled:opacity-40">
        {isSaving ? "Menyimpan..." : "Simpan"}
      </button>
      <button type="button" onClick={onCancel} disabled={!hasDrafts || isSaving} className="inline-flex items-center gap-1.5 border border-border px-2 py-1 text-[12px] font-mono uppercase text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40">
        Batal
      </button>
    </div>
  );
}
