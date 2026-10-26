"use client";

import type { AuthUser } from "@smsystem/contracts/auth";
import type { GridQueryState } from "@smsystem/contracts/grid";
import type { UnitBoardRow } from "@smsystem/contracts/unit";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { permissionCodes } from "@smsystem/permissions";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createUnit, deleteUnit, fetchUnitReferences, updateUnit } from "@/shared/api/units/units";
import { SmsAgGrid } from "@/shared/datagrid/sms-ag-grid";
import { useDataGridState } from "@/shared/datagrid/use-data-grid-state";
import { useSweetAlert } from "@/shared/ui/sweet-alert";
import {
  buildCreateUnitInput,
  buildUnitMutationInput,
  emptyUnitForm,
  emptyUnitMutationReferences,
  UnitMutationDialog,
  unitFormFromRow,
  type UnitFormState,
  type UnitMutationReferences,
} from "./unit-mutation-dialog";

interface UnitBoardShellProps {
  rows: UnitBoardRow[];
  meta: { page: number; limit: number; total: number; totalPages: number; hasNext: boolean; hasPrev: boolean };
  state: GridQueryState;
  user: AuthUser | null;
}

const unitStatus = {
  PLAN: { label: "Rencana", className: "border-border bg-muted/40 text-muted-foreground" },
  ON_PROGRESS: { label: "Sedang dikerjakan", className: "border-warning/25 bg-warning/15 text-warning" },
  HOLD: { label: "Ditahan", className: "border-destructive/25 bg-destructive/10 text-destructive" },
  DONE: { label: "Sudah diserahkan", className: "border-success/25 bg-success/15 text-success" },
} as const;

const deliveryConditionLabels = {
  GREEN: "Lancar",
  YELLOW: "Perlu dipantau",
  ORANGE: "Butuh perhatian",
  RED: "Terlambat",
  DELIVERED: "Sudah diserahkan",
} as const;

function canManageUnitMaster(user: AuthUser | null): boolean {
  return Boolean(user && (
    user.scope.canViewAllUnits
    || user.permissions.includes(permissionCodes.viewAllUnits)
    || user.permissions.includes(permissionCodes.manageUsers)
    || user.permissions.includes(permissionCodes.unitPanelManage)
  ));
}

function activeStatusFilterValue(state: GridQueryState): string {
  return state.filters.find((filter) => filter.field === "status")?.value ?? "";
}

function deliveryConditionLabel(riskLevel: UnitBoardRow["riskLevel"]): string | null {
  return deliveryConditionLabels[riskLevel as keyof typeof deliveryConditionLabels] ?? null;
}

function UnitBadge({ label, className }: { label: string; className: string }) {
  return <span className={`inline-flex items-center justify-center border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${className}`}>{label}</span>;
}

function errorDetail(result: { message: string; errorCode?: string }): string {
  return `${result.message}${result.errorCode ? `\nKode: ${result.errorCode}` : ""}`;
}

export function UnitBoardShell({ rows, meta, state, user }: UnitBoardShellProps) {
  const router = useRouter();
  const sweetAlert = useSweetAlert();
  const gridState = useDataGridState(state);
  const canManageUnits = canManageUnitMaster(user);
  const [dialogMode, setDialogMode] = useState<"create" | "edit" | null>(null);
  const [form, setForm] = useState<UnitFormState>(emptyUnitForm());
  const [references, setReferences] = useState<UnitMutationReferences>(emptyUnitMutationReferences);
  const [referencesLoading, setReferencesLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [searchInput, setSearchInput] = useState(state.search);

  useEffect(() => setSearchInput(state.search), [state.search]);
  useEffect(() => {
    const search = searchInput.trim();
    if (search === state.search) return;
    const timeoutId = window.setTimeout(() => gridState.setSearch(search), 250);
    return () => window.clearTimeout(timeoutId);
  }, [gridState, searchInput, state.search]);

  async function prepareDialog(mode: "create" | "edit", unit?: UnitBoardRow) {
    setForm(unit ? unitFormFromRow(unit) : emptyUnitForm());
    setDialogMode(mode);
    setReferencesLoading(true);
    const result = await fetchUnitReferences();
    setReferencesLoading(false);
    if (!result.success) {
      sweetAlert.notifyError("Referensi unit belum dimuat", errorDetail(result));
      return;
    }
    setReferences(result.result);
  }

  async function handleSubmit() {
    if (!form.unitName.trim() || !form.kpId) return;
    setPending(true);
    const result = dialogMode === "create"
      ? await createUnit(buildCreateUnitInput(form))
      : await updateUnit(form.unitId, {
        ...buildUnitMutationInput(form),
        status: form.status === "ON_PROGRESS" || form.status === "DONE" ? undefined : form.status,
      });
    setPending(false);

    if (!result.success) {
      sweetAlert.notifyError("Unit belum tersimpan", errorDetail(result));
      return;
    }

    sweetAlert.notifySuccess(dialogMode === "create" ? "Unit dibuat" : "Unit diperbarui");
    setDialogMode(null);
    if (dialogMode === "create") {
      router.push(`/units/${result.result.unitId}`);
    } else {
      router.refresh();
    }
  }

  async function handleDelete(unitId: string, unitName: string) {
    const confirmed = await sweetAlert.confirm({
      title: "Hapus unit?",
      description: `${unitName} hanya bisa dihapus jika belum dipakai data operasional.`,
      confirmLabel: "Hapus",
      cancelLabel: "Batal",
      tone: "warning",
    });
    if (!confirmed) return;

    const result = await deleteUnit(unitId);
    if (!result.success) {
      sweetAlert.notifyError("Unit belum terhapus", errorDetail(result));
      return;
    }
    sweetAlert.notifySuccess("Unit dihapus");
    router.refresh();
  }

  const columns: ColDef<UnitBoardRow>[] = [
    {
      field: "unitName",
      headerName: "Unit",
      pinned: "left",
      minWidth: 210,
      cellRenderer: (params: ICellRendererParams<UnitBoardRow, string>) => (
        <div className="flex h-full flex-col justify-center leading-tight">
          <Link href={`/units/${encodeURIComponent(String(params.data?.unitId ?? ""))}`} onClick={(event) => event.stopPropagation()} className="w-fit font-medium text-foreground outline-none hover:text-app-accent-ink hover:underline focus-visible:ring-2 focus-visible:ring-primary/30">
            {params.value || "-"}
          </Link>
          <span className="mt-0.5 font-mono text-[11px] text-muted-foreground">{params.data?.unitId || "-"}</span>
        </div>
      ),
    },
    { field: "plateNumber", headerName: "No. Rangka / VIN", minWidth: 170 },
    { field: "customerName", headerName: "Pemilik", minWidth: 170 },
    { field: "restorationType", headerName: "Restorasi", minWidth: 136, valueFormatter: (params) => params.value === "PARTIAL_RESTORATION" ? "Partial" : "Full" },
    { field: "kpName", headerName: "KP", minWidth: 150 },
    { field: "advisorName", headerName: "KD", minWidth: 150 },
    { field: "incomingDate", headerName: "Tanggal Kedatangan", minWidth: 160, valueFormatter: (params) => params.value || "-" },
    {
      field: "targetDelivery",
      headerName: "Target Delivery",
      minWidth: 156,
      cellRenderer: (params: ICellRendererParams<UnitBoardRow, string>) => {
        const condition = params.value && params.data ? deliveryConditionLabel(params.data.riskLevel) : null;
        return <div className="flex h-full flex-col justify-center leading-tight"><span>{params.value || "Belum ditentukan"}</span>{condition ? <span className="mt-0.5 text-[11px] text-muted-foreground">({condition})</span> : null}</div>;
      },
    },
    { field: "progressPercent", headerName: "Progres", minWidth: 105, filter: "agNumberColumnFilter", valueFormatter: (params) => `${Number(params.value ?? 0).toFixed(0)}%` },
    { field: "remainingHours", headerName: "Sisa Jam", minWidth: 110, filter: "agNumberColumnFilter", valueFormatter: (params) => `${Number(params.value ?? 0).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jam` },
    { field: "status", headerName: "Status", minWidth: 145, cellRenderer: (params: ICellRendererParams<UnitBoardRow, UnitBoardRow["status"]>) => <UnitBadge {...unitStatus[params.value || "PLAN"]} /> },
    {
      colId: "actions",
      headerName: "Aksi",
      pinned: "right",
      sortable: false,
      filter: false,
      width: canManageUnits ? 190 : 102,
      cellRenderer: (params: ICellRendererParams<UnitBoardRow>) => (
        <div className="flex items-center justify-center gap-1.5">
          <Link href={`/units/${encodeURIComponent(String(params.data?.unitId ?? ""))}`} onClick={(event) => event.stopPropagation()} className="inline-flex h-7 items-center border border-primary/30 bg-primary/[0.04] px-2 text-[11px] font-medium text-app-accent-ink hover:border-primary/60 hover:bg-primary/10">Lihat detail</Link>
          {canManageUnits ? <>
            <button type="button" onClick={(event) => { event.stopPropagation(); void prepareDialog("edit", params.data); }} className="inline-flex h-6 w-6 items-center justify-center border border-border text-muted-foreground hover:border-primary/40 hover:text-app-accent-ink" title="Edit unit"><Pencil className="h-3.5 w-3.5" /></button>
            <button type="button" onClick={(event) => { event.stopPropagation(); void handleDelete(String(params.data?.unitId ?? ""), String(params.data?.unitName ?? "-")); }} className="inline-flex h-6 w-6 items-center justify-center border border-border text-muted-foreground hover:border-destructive/40 hover:text-destructive" title="Hapus unit"><Trash2 className="h-3.5 w-3.5" /></button>
          </> : null}
        </div>
      ),
    },
  ];

  return <>
    <section className="border border-border bg-card dark:border-white/[0.06]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2 dark:border-white/[0.06]">
        <div><p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Master Data</p><h2 className="mt-0.5 text-sm font-semibold text-foreground">Daftar Unit</h2></div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative block"><span className="sr-only">Cari unit</span><Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" /><input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Cari unit, pemilik, atau nomor rangka" className="h-8 w-60 border border-border bg-background pl-8 pr-3 text-[12px] text-foreground outline-none focus:border-primary/55" /></label>
          <select aria-label="Filter status unit" value={activeStatusFilterValue(state)} onChange={(event) => gridState.setFilter("status", event.target.value)} className="h-8 border border-border bg-background px-2 text-[12px] text-foreground outline-none focus:border-primary/55 dark:[color-scheme:dark]"><option value="">Semua status</option><option value="PLAN">Rencana</option><option value="ON_PROGRESS">Sedang dikerjakan</option><option value="HOLD">Ditahan</option><option value="DONE">Sudah diserahkan</option></select>
          {canManageUnits ? <button type="button" onClick={() => void prepareDialog("create")} className="inline-flex h-8 items-center gap-1.5 border border-primary/40 bg-primary/10 px-3 text-[12px] font-medium text-app-accent-ink hover:bg-primary/20"><Plus className="h-3.5 w-3.5" />Tambah Unit</button> : null}
        </div>
      </div>
      <SmsAgGrid<UnitBoardRow> heightClassName="h-[calc(100svh-246px)] min-h-[28rem]" rowData={rows} columnDefs={columns} quickFilterText={searchInput} getRowId={(params) => params.data.unitId} defaultColDef={{ floatingFilter: true, filter: "agTextColumnFilter", filterParams: { trimInput: true, debounceMs: 150 } }} onRowClicked={(event) => { if (event.data) router.push(`/units/${encodeURIComponent(event.data.unitId)}`); }} emptyMessage="Belum ada unit." />
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-3 py-2 text-[12px] text-muted-foreground"><span>{meta.total} unit</span><div className="flex items-center gap-2"><button type="button" disabled={!meta.hasPrev || gridState.isPending} onClick={() => gridState.setPage(meta.page - 1)} className="h-7 border border-border px-2 text-foreground disabled:cursor-not-allowed disabled:opacity-40">Sebelumnya</button><span>Halaman {meta.page}/{meta.totalPages}</span><button type="button" disabled={!meta.hasNext || gridState.isPending} onClick={() => gridState.setPage(meta.page + 1)} className="h-7 border border-border px-2 text-foreground disabled:cursor-not-allowed disabled:opacity-40">Berikutnya</button></div></div>
    </section>
    {dialogMode ? <UnitMutationDialog mode={dialogMode} form={form} references={references} referencesLoading={referencesLoading} pending={pending} onChange={setForm} onClose={() => setDialogMode(null)} onSubmit={handleSubmit} /> : null}
    {sweetAlert.alertElement}
  </>;
}
