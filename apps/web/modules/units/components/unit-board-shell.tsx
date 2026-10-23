"use client";

import type { AuthUser } from "@smsystem/contracts/auth";
import type { GridQueryState } from "@smsystem/contracts/grid";
import type { CreateUnitRequest, UnitBoardRow, UpdateUnitRequest, UnitReferenceOption } from "@smsystem/contracts/unit";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { permissionCodes } from "@smsystem/permissions";
import { Pencil, Plus, Search, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createUnit, deleteUnit, fetchUnitReferences, updateUnit } from "@/shared/api/units/units";
import { SmsAgGrid } from "@/shared/datagrid/sms-ag-grid";
import { useDataGridState } from "@/shared/datagrid/use-data-grid-state";
import { useSweetAlert } from "@/shared/ui/sweet-alert";

interface UnitBoardShellProps {
  rows: UnitBoardRow[];
  meta: { page: number; limit: number; total: number; totalPages: number; hasNext: boolean; hasPrev: boolean };
  state: GridQueryState;
  user: AuthUser | null;
}

interface UnitFormState {
  unitId: string;
  unitName: string;
  plateNumber: string;
  customerName: string;
  vehicleNotes: string;
  restorationType: "FULL_RESTORATION" | "PARTIAL_RESTORATION";
  isMargin: boolean;
  incomingDate: string;
  targetTdAwal: string;
  targetTdCoo: string;
  targetDelivery: string;
  kpId: string;
  kdId: string;
  status: UnitBoardRow["status"];
}

const UNIT_STATUS = {
  PLAN: { label: "Rencana", className: "border-border bg-muted/40 text-muted-foreground" },
  ON_PROGRESS: { label: "Sedang dikerjakan", className: "border-warning/25 bg-warning/15 text-warning" },
  HOLD: { label: "Ditahan", className: "border-destructive/25 bg-destructive/10 text-destructive" },
  DONE: { label: "Sudah diserahkan", className: "border-success/25 bg-success/15 text-success" },
} as const;

const DELIVERY_CONDITION_LABELS = {
  GREEN: "Lancar",
  YELLOW: "Perlu dipantau",
  ORANGE: "Butuh perhatian",
  RED: "Terlambat",
  DELIVERED: "Sudah diserahkan",
} as const;

function emptyForm(): UnitFormState {
  return { unitId: "", unitName: "", plateNumber: "", customerName: "", vehicleNotes: "", restorationType: "FULL_RESTORATION", isMargin: true, incomingDate: "", targetTdAwal: "", targetTdCoo: "", targetDelivery: "", kpId: "", kdId: "", status: "PLAN" };
}

function formFromUnit(row: UnitBoardRow): UnitFormState {
  return {
    unitId: row.unitId, unitName: row.unitName, plateNumber: row.plateNumber ?? "", customerName: row.customerName ?? "", vehicleNotes: row.vehicleNotes ?? "",
    restorationType: row.restorationType ?? "FULL_RESTORATION", isMargin: row.isMargin, incomingDate: row.incomingDate ?? "",
    targetTdAwal: row.targetTdAwal ?? "", targetTdCoo: row.targetTdCoo ?? "", targetDelivery: row.targetDelivery ?? "",
    kpId: row.kpId ?? "", kdId: row.kdId ?? "", status: row.status,
  };
}

function nullableText(value: string) { return value.trim() || null; }
function nullableDate(value: string) { return value.trim() || null; }
function suggestedUnitId(unitName: string, customerName: string) {
  const normalize = (value: string) => value.trim().toUpperCase().replace(/[^A-Z0-9]+/gu, "-").replace(/^-+|-+$/gu, "");
  return [normalize(unitName), normalize(customerName)].filter(Boolean).join("_").slice(0, 36);
}
function canManageUnitMaster(user: AuthUser | null): boolean {
  return Boolean(user && (user.scope.canViewAllUnits || user.permissions.includes(permissionCodes.viewAllUnits) || user.permissions.includes(permissionCodes.manageUsers) || user.permissions.includes(permissionCodes.unitPanelManage)));
}
function activeStatusFilterValue(state: GridQueryState) { return state.filters.find((filter) => filter.field === "status")?.value ?? ""; }
function deliveryConditionLabel(riskLevel: UnitBoardRow["riskLevel"]) { return DELIVERY_CONDITION_LABELS[riskLevel as keyof typeof DELIVERY_CONDITION_LABELS] ?? null; }
function UnitBadge({ label, className }: { label: string; className: string }) { return <span className={`inline-flex items-center justify-center border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${className}`}>{label}</span>; }
function errorDetail(result: { message: string; errorCode?: string }) { return `${result.message}${result.errorCode ? `\nKode: ${result.errorCode}` : ""}`; }

export function UnitBoardShell({ rows, meta, state, user }: UnitBoardShellProps) {
  const router = useRouter();
  const sweetAlert = useSweetAlert();
  const gridState = useDataGridState(state);
  const canManageUnits = canManageUnitMaster(user);
  const [dialogMode, setDialogMode] = useState<"create" | "edit" | null>(null);
  const [form, setForm] = useState<UnitFormState>(emptyForm());
  const [references, setReferences] = useState<{ customers: UnitReferenceOption[]; kps: UnitReferenceOption[]; kds: UnitReferenceOption[]; qa: UnitReferenceOption | null }>({ customers: [], kps: [], kds: [], qa: null });
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
    setForm(unit ? formFromUnit(unit) : emptyForm());
    setDialogMode(mode);
    setReferencesLoading(true);
    const result = await fetchUnitReferences();
    setReferencesLoading(false);
    if (!result.success) { sweetAlert.notifyError("Referensi Unit belum dimuat", errorDetail(result)); return; }
    setReferences(result.result);
  }

  async function handleSubmit() {
    if (!form.unitName.trim() || !form.kpId) return;
    setPending(true);
    const base = { unitName: form.unitName.trim(), plateNumber: nullableText(form.plateNumber), customerName: nullableText(form.customerName), vehicleNotes: nullableText(form.vehicleNotes), restorationType: form.restorationType, isMargin: form.isMargin, incomingDate: nullableDate(form.incomingDate), targetTdAwal: nullableDate(form.targetTdAwal), targetTdCoo: nullableDate(form.targetTdCoo), targetDelivery: nullableDate(form.targetDelivery), kpId: form.kpId, kdId: nullableText(form.kdId) };
    const result = dialogMode === "create"
      ? await createUnit({ ...base, unitId: nullableText(form.unitId) } satisfies CreateUnitRequest)
      : await updateUnit(form.unitId, { ...base, status: form.status === "ON_PROGRESS" || form.status === "DONE" ? undefined : form.status } satisfies UpdateUnitRequest);
    setPending(false);
    if (!result.success) { sweetAlert.notifyError("Unit belum tersimpan", errorDetail(result)); return; }
    sweetAlert.notifySuccess(dialogMode === "create" ? "Unit dibuat" : "Unit diperbarui");
    setDialogMode(null);
    if (dialogMode === "create") router.push(`/units/${result.result.unitId}`); else router.refresh();
  }

  async function handleDelete(unitId: string, unitName: string) {
    const confirmed = await sweetAlert.confirm({ title: "Hapus unit?", description: `${unitName} hanya bisa dihapus jika belum dipakai data operasional.`, confirmLabel: "Hapus", cancelLabel: "Batal", tone: "warning" });
    if (!confirmed) return;
    const result = await deleteUnit(unitId);
    if (!result.success) { sweetAlert.notifyError("Unit belum terhapus", errorDetail(result)); return; }
    sweetAlert.notifySuccess("Unit dihapus"); router.refresh();
  }

  const columns: ColDef<UnitBoardRow>[] = [
    { field: "unitName", headerName: "Unit", pinned: "left", minWidth: 210, cellRenderer: (params: ICellRendererParams<UnitBoardRow, string>) => <div className="flex h-full flex-col justify-center leading-tight"><span className="font-medium text-foreground">{params.value || "-"}</span><span className="mt-0.5 font-mono text-[11px] text-muted-foreground">{params.data?.unitId || "-"}</span></div> },
    { field: "plateNumber", headerName: "VIN Number", minWidth: 150 }, { field: "customerName", headerName: "Customer", minWidth: 170 },
    { field: "restorationType", headerName: "Restorasi", minWidth: 136, valueFormatter: (params) => params.value === "PARTIAL_RESTORATION" ? "Partial" : "Full" },
    { field: "kpName", headerName: "KP", minWidth: 150 }, { field: "advisorName", headerName: "KD", minWidth: 150 },
    { field: "incomingDate", headerName: "Tanggal Kedatangan", minWidth: 160, valueFormatter: (params) => params.value || "-" },
    { field: "targetDelivery", headerName: "Target Delivery", minWidth: 156, cellRenderer: (params: ICellRendererParams<UnitBoardRow, string>) => {
      const targetDelivery = params.value;
      const condition = targetDelivery && params.data ? deliveryConditionLabel(params.data.riskLevel) : null;
      return <div className="flex h-full flex-col justify-center leading-tight"><span>{targetDelivery || "Belum ditentukan"}</span>{condition ? <span className="mt-0.5 text-[11px] text-muted-foreground">({condition})</span> : null}</div>;
    } },
    { field: "progressPercent", headerName: "Progres", minWidth: 105, filter: "agNumberColumnFilter", valueFormatter: (params) => `${Number(params.value ?? 0).toFixed(0)}%` }, { field: "remainingHours", headerName: "Sisa Jam", minWidth: 110, filter: "agNumberColumnFilter", valueFormatter: (params) => `${Number(params.value ?? 0).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jam` },
    { field: "status", headerName: "Status", minWidth: 145, cellRenderer: (params: ICellRendererParams<UnitBoardRow, UnitBoardRow["status"]>) => <UnitBadge {...UNIT_STATUS[params.value || "PLAN"]} /> },
    { colId: "actions", headerName: "Aksi", pinned: "right", sortable: false, filter: false, width: canManageUnits ? 190 : 102, cellRenderer: (params: ICellRendererParams<UnitBoardRow>) => <div className="flex items-center justify-center gap-1.5"><Link href={`/units/${String(params.data?.unitId ?? "")}`} onClick={(event) => event.stopPropagation()} className="inline-flex h-7 items-center border border-primary/30 bg-primary/[0.04] px-2 text-[11px] font-medium text-app-accent-ink hover:border-primary/60 hover:bg-primary/10">Detail</Link>{canManageUnits ? <><button type="button" onClick={(event) => { event.stopPropagation(); void prepareDialog("edit", params.data); }} className="inline-flex h-6 w-6 items-center justify-center border border-border text-muted-foreground hover:border-primary/40 hover:text-app-accent-ink" title="Edit unit"><Pencil className="h-3.5 w-3.5" /></button><button type="button" onClick={(event) => { event.stopPropagation(); void handleDelete(String(params.data?.unitId ?? ""), String(params.data?.unitName ?? "-")); }} className="inline-flex h-6 w-6 items-center justify-center border border-border text-muted-foreground hover:border-destructive/40 hover:text-destructive" title="Hapus unit"><Trash2 className="h-3.5 w-3.5" /></button></> : null}</div> },
  ];

  return <>
    <section className="border border-border bg-card dark:border-white/[0.06]"><div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2 dark:border-white/[0.06]"><div><p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Master Data</p><h2 className="mt-0.5 text-sm font-semibold text-foreground">Daftar Unit</h2></div><div className="flex flex-wrap items-center gap-2"><label className="relative block"><span className="sr-only">Cari unit</span><Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" /><input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Cari Unit atau customer" className="h-8 w-52 border border-border bg-background pl-8 pr-3 text-[12px] text-foreground outline-none focus:border-primary/55" /></label><select aria-label="Filter status unit" value={activeStatusFilterValue(state)} onChange={(event) => gridState.setFilter("status", event.target.value)} className="h-8 border border-border bg-background px-2 text-[12px] text-foreground outline-none focus:border-primary/55 dark:[color-scheme:dark]"><option value="">Semua status</option><option value="PLAN">Rencana</option><option value="ON_PROGRESS">Sedang dikerjakan</option><option value="HOLD">Ditahan</option><option value="DONE">Sudah diserahkan</option></select>{canManageUnits ? <button type="button" onClick={() => void prepareDialog("create")} className="inline-flex h-8 items-center gap-1.5 border border-primary/40 bg-primary/10 px-3 text-[12px] font-medium text-app-accent-ink hover:bg-primary/20"><Plus className="h-3.5 w-3.5" />Tambah Unit</button> : null}</div></div>
      <SmsAgGrid<UnitBoardRow> heightClassName="h-[calc(100svh-246px)] min-h-[28rem]" rowData={rows} columnDefs={columns} quickFilterText={searchInput} getRowId={(params) => params.data.unitId} defaultColDef={{ floatingFilter: true, filter: "agTextColumnFilter", filterParams: { trimInput: true, debounceMs: 150 } }} onRowClicked={(event) => { if (event.data) router.push(`/units/${event.data.unitId}`); }} emptyMessage="Belum ada unit." />
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-3 py-2 text-[12px] text-muted-foreground"><span>{meta.total} unit</span><div className="flex items-center gap-2"><button type="button" disabled={!meta.hasPrev || gridState.isPending} onClick={() => gridState.setPage(meta.page - 1)} className="h-7 border border-border px-2 text-foreground disabled:cursor-not-allowed disabled:opacity-40">Sebelumnya</button><span>Halaman {meta.page}/{meta.totalPages}</span><button type="button" disabled={!meta.hasNext || gridState.isPending} onClick={() => gridState.setPage(meta.page + 1)} className="h-7 border border-border px-2 text-foreground disabled:cursor-not-allowed disabled:opacity-40">Berikutnya</button></div></div>
    </section>
    {dialogMode ? <UnitMutationDialog mode={dialogMode} form={form} references={references} referencesLoading={referencesLoading} pending={pending} onChange={setForm} onClose={() => setDialogMode(null)} onSubmit={handleSubmit} /> : null}{sweetAlert.alertElement}
  </>;
}

function UnitMutationDialog({ mode, form, references, referencesLoading, pending, onChange, onClose, onSubmit }: { mode: "create" | "edit"; form: UnitFormState; references: { customers: UnitReferenceOption[]; kps: UnitReferenceOption[]; kds: UnitReferenceOption[]; qa: UnitReferenceOption | null }; referencesLoading: boolean; pending: boolean; onChange: (value: UnitFormState) => void; onClose: () => void; onSubmit: () => void }) {
  const fieldClass = "h-9 w-full border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-primary/40 disabled:cursor-not-allowed disabled:bg-muted dark:[color-scheme:dark]";
  const labelClass = "space-y-1.5"; const captionClass = "block text-[11px] font-mono uppercase tracking-[0.08em] text-muted-foreground";
  return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"><div className="max-h-[calc(100svh-2rem)] w-full max-w-3xl overflow-y-auto border border-border bg-card shadow-2xl"><div className="flex items-center justify-between border-b border-border px-4 py-3"><div><p className="font-mono text-[11px] uppercase tracking-[0.08em] text-app-accent-ink">{mode === "create" ? "Tambah Unit" : "Edit Unit"}</p><p className="mt-1 text-sm text-muted-foreground">{mode === "create" ? "Buat Unit dan tetapkan penanggung jawab proyek." : form.unitName}</p></div><button type="button" onClick={onClose} className="inline-flex h-8 w-8 items-center justify-center border border-transparent text-muted-foreground hover:border-border hover:text-foreground" aria-label="Tutup"><X className="h-4 w-4" /></button></div>
    <div className="grid gap-3 px-4 py-4 md:grid-cols-2">
      <label className={labelClass}><span className={captionClass}>ID Unit</span><input value={form.unitId} disabled={mode === "edit"} onChange={(event) => onChange({ ...form, unitId: event.target.value })} placeholder="Otomatis dari nama Unit dan customer" className={fieldClass} /></label><label className={labelClass}><span className={captionClass}>Nama Unit</span><input value={form.unitName} onChange={(event) => { const unitName = event.target.value; onChange({ ...form, unitName, unitId: mode === "create" && !form.unitId.trim() && form.customerName.trim() ? suggestedUnitId(unitName, form.customerName) : form.unitId }); }} placeholder="Contoh: Jaguar XK120" className={fieldClass} /></label><label className={labelClass}><span className={captionClass}>VIN Number</span><input value={form.plateNumber} onChange={(event) => onChange({ ...form, plateNumber: event.target.value })} placeholder="Opsional" className={fieldClass} /></label><label className={labelClass}><span className={captionClass}>Customer</span><input list="unit-customers" value={form.customerName} onChange={(event) => { const customerName = event.target.value; onChange({ ...form, customerName, unitId: mode === "create" && !form.unitId.trim() && form.unitName.trim() ? suggestedUnitId(form.unitName, customerName) : form.unitId }); }} placeholder="Pilih atau ketik customer baru" className={fieldClass} /><datalist id="unit-customers">{references.customers.map((customer) => <option key={customer.value} value={customer.value} />)}</datalist></label><label className={`${labelClass} md:col-span-2`}><span className={captionClass}>Info Tambahan Kendaraan</span><textarea value={form.vehicleNotes} onChange={(event) => onChange({ ...form, vehicleNotes: event.target.value })} placeholder="Contoh: tahun, warna, nomor mesin, kondisi saat datang, atau catatan penting lain." rows={3} className="w-full resize-y border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40" /></label><label className={labelClass}><span className={captionClass}>Tipe Restorasi</span><select value={form.restorationType} onChange={(event) => onChange({ ...form, restorationType: event.target.value === "PARTIAL_RESTORATION" ? "PARTIAL_RESTORATION" : "FULL_RESTORATION" })} className={fieldClass}><option value="FULL_RESTORATION">Full restoration</option><option value="PARTIAL_RESTORATION">Partial restoration</option></select></label><label className={labelClass}><span className={captionClass}>KP</span><select value={form.kpId} disabled={referencesLoading} onChange={(event) => onChange({ ...form, kpId: event.target.value })} className={fieldClass}><option value="">Pilih KP</option>{references.kps.map((kp) => <option key={kp.value} value={kp.value}>{kp.label}</option>)}</select></label><label className={labelClass}><span className={captionClass}>KD</span><select value={form.kdId} disabled={referencesLoading} onChange={(event) => onChange({ ...form, kdId: event.target.value })} className={fieldClass}><option value="">Tidak ditetapkan</option>{references.kds.map((kd) => <option key={kd.value} value={kd.value}>{kd.label}</option>)}</select></label><div className={labelClass}><span className={captionClass}>QA</span><div className="flex h-9 items-center border border-border bg-muted/40 px-3 text-sm text-muted-foreground">{form.kdId ? (references.qa ? `Otomatis: ${references.qa.label}` : "QA belum tersedia") : "Pilih KD terlebih dahulu"}</div></div>{mode === "edit" ? <label className={labelClass}><span className={captionClass}>Status Unit</span><select value={form.status} disabled={form.status === "ON_PROGRESS" || form.status === "DONE"} onChange={(event) => onChange({ ...form, status: event.target.value === "HOLD" ? "HOLD" : "PLAN" })} className={fieldClass}><option value="PLAN">Rencana</option><option value="HOLD">Ditahan</option><option value="ON_PROGRESS">Sedang dikerjakan</option><option value="DONE">Sudah diserahkan</option></select></label> : null}<label className={labelClass}><span className={captionClass}>Tanggal Kedatangan</span><input type="date" value={form.incomingDate} onChange={(event) => onChange({ ...form, incomingDate: event.target.value })} className={fieldClass} /></label><label className={labelClass}><span className={captionClass}>Target TD Awal</span><input type="date" value={form.targetTdAwal} onChange={(event) => onChange({ ...form, targetTdAwal: event.target.value })} className={fieldClass} /></label><label className={labelClass}><span className={captionClass}>Target TD COO</span><input type="date" value={form.targetTdCoo} onChange={(event) => onChange({ ...form, targetTdCoo: event.target.value })} className={fieldClass} /></label><label className={labelClass}><span className={captionClass}>Target Delivery</span><input type="date" value={form.targetDelivery} onChange={(event) => onChange({ ...form, targetDelivery: event.target.value })} className={fieldClass} /></label><label className="flex items-center gap-2 self-end text-sm text-muted-foreground"><input type="checkbox" checked={form.isMargin} onChange={(event) => onChange({ ...form, isMargin: event.target.checked })} className="h-4 w-4" />Unit margin</label>
    </div><div className="flex justify-end gap-2 border-t border-border bg-background px-4 py-3"><button type="button" onClick={onClose} className="border border-border px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground">Batal</button><button type="button" disabled={pending || !form.unitName.trim() || !form.kpId} onClick={onSubmit} className="border border-primary/40 bg-primary/10 px-4 py-2 text-xs font-medium text-app-accent-ink disabled:cursor-not-allowed disabled:opacity-45">{pending ? "Menyimpan..." : "Simpan"}</button></div>
  </div></div>;
}
