"use client";

import type { CreateUnitRequest, UnitBoardRow, UnitReferenceOption, UpdateUnitRequest } from "@smsystem/contracts/unit";
import { X } from "lucide-react";

export type VehicleDocumentAvailability = "" | "yes" | "no";

export interface UnitFormState {
  unitId: string;
  unitName: string;
  plateNumber: string;
  policeNumber: string;
  customerName: string;
  vehicleYear: string;
  engineNumber: string;
  vehicleColor: string;
  vehicleNotes: string;
  hasBpkb: VehicleDocumentAvailability;
  hasStnk: VehicleDocumentAvailability;
  stnkTaxDueDate: string;
  bpkbTaxDueDate: string;
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

export interface UnitMutationReferences {
  customers: UnitReferenceOption[];
  kps: UnitReferenceOption[];
  kds: UnitReferenceOption[];
  qa: UnitReferenceOption | null;
}

export const emptyUnitMutationReferences: UnitMutationReferences = {
  customers: [],
  kps: [],
  kds: [],
  qa: null,
};

export function emptyUnitForm(): UnitFormState {
  return {
    unitId: "",
    unitName: "",
    plateNumber: "",
    policeNumber: "",
    customerName: "",
    vehicleYear: "",
    engineNumber: "",
    vehicleColor: "",
    vehicleNotes: "",
    hasBpkb: "",
    hasStnk: "",
    stnkTaxDueDate: "",
    bpkbTaxDueDate: "",
    restorationType: "FULL_RESTORATION",
    isMargin: true,
    incomingDate: "",
    targetTdAwal: "",
    targetTdCoo: "",
    targetDelivery: "",
    kpId: "",
    kdId: "",
    status: "PLAN",
  };
}

export function unitFormFromRow(row: UnitBoardRow): UnitFormState {
  return {
    unitId: row.unitId,
    unitName: row.unitName,
    plateNumber: row.plateNumber ?? "",
    policeNumber: row.policeNumber ?? "",
    customerName: row.customerName ?? "",
    vehicleYear: row.vehicleYear?.toString() ?? "",
    engineNumber: row.engineNumber ?? "",
    vehicleColor: row.vehicleColor ?? "",
    vehicleNotes: row.vehicleNotes ?? "",
    hasBpkb: row.hasBpkb === null ? "" : row.hasBpkb ? "yes" : "no",
    hasStnk: row.hasStnk === null ? "" : row.hasStnk ? "yes" : "no",
    stnkTaxDueDate: row.stnkTaxDueDate ?? "",
    bpkbTaxDueDate: row.bpkbTaxDueDate ?? "",
    restorationType: row.restorationType ?? "FULL_RESTORATION",
    isMargin: row.isMargin,
    incomingDate: row.incomingDate ?? "",
    targetTdAwal: row.targetTdAwal ?? "",
    targetTdCoo: row.targetTdCoo ?? "",
    targetDelivery: row.targetDelivery ?? "",
    kpId: row.kpId ?? "",
    kdId: row.kdId ?? "",
    status: row.status,
  };
}

function nullableText(value: string): string | null {
  return value.trim() || null;
}

function nullableVehicleYear(value: string): number | null {
  const year = value.trim();
  return year ? Number(year) : null;
}

function nullableDocumentAvailability(value: VehicleDocumentAvailability): boolean | null {
  if (value === "") return null;
  return value === "yes";
}

export function buildUnitMutationInput(form: UnitFormState): Omit<UpdateUnitRequest, "status"> {
  return {
    unitName: form.unitName.trim(),
    plateNumber: nullableText(form.plateNumber),
    policeNumber: nullableText(form.policeNumber),
    customerName: nullableText(form.customerName),
    vehicleYear: nullableVehicleYear(form.vehicleYear),
    engineNumber: nullableText(form.engineNumber),
    vehicleColor: nullableText(form.vehicleColor),
    vehicleNotes: nullableText(form.vehicleNotes),
    hasBpkb: nullableDocumentAvailability(form.hasBpkb),
    hasStnk: nullableDocumentAvailability(form.hasStnk),
    stnkTaxDueDate: nullableText(form.stnkTaxDueDate),
    bpkbTaxDueDate: nullableText(form.bpkbTaxDueDate),
    restorationType: form.restorationType,
    isMargin: form.isMargin,
    incomingDate: nullableText(form.incomingDate),
    targetTdAwal: nullableText(form.targetTdAwal),
    targetTdCoo: nullableText(form.targetTdCoo),
    targetDelivery: nullableText(form.targetDelivery),
    kpId: form.kpId,
    kdId: nullableText(form.kdId),
  };
}

export function buildCreateUnitInput(form: UnitFormState): CreateUnitRequest {
  return {
    ...buildUnitMutationInput(form),
    unitId: nullableText(form.unitId),
  };
}

function suggestedUnitId(unitName: string, customerName: string): string {
  const normalize = (value: string) => value.trim().toUpperCase().replace(/[^A-Z0-9]+/gu, "-").replace(/^-+|-+$/gu, "");
  return [normalize(unitName), normalize(customerName)].filter(Boolean).join("_").slice(0, 36);
}

interface UnitMutationDialogProps {
  mode: "create" | "edit";
  variant?: "full" | "vehicle";
  form: UnitFormState;
  references: UnitMutationReferences;
  referencesLoading?: boolean;
  pending: boolean;
  onChange: (value: UnitFormState) => void;
  onClose: () => void;
  onSubmit: () => void;
}

export function UnitMutationDialog({
  mode,
  variant = "full",
  form,
  references,
  referencesLoading = false,
  pending,
  onChange,
  onClose,
  onSubmit,
}: UnitMutationDialogProps) {
  const isVehicleEditor = variant === "vehicle";
  const fieldClass = "h-9 w-full border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-primary/40 disabled:cursor-not-allowed disabled:bg-muted dark:[color-scheme:dark]";
  const labelClass = "space-y-1.5";
  const captionClass = "block text-[11px] font-mono uppercase tracking-[0.08em] text-muted-foreground";
  const updateAutoUnitId = (unitName: string, customerName: string) => (
    mode === "create" && !form.unitId.trim() && unitName.trim() && customerName.trim()
      ? suggestedUnitId(unitName, customerName)
      : form.unitId
  );

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="unit-mutation-title" onKeyDown={(event) => { if (event.key === "Escape") onClose(); }}>
      <div className="max-h-[calc(100svh-2rem)] w-full max-w-3xl overflow-y-auto border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <p id="unit-mutation-title" className="font-mono text-[11px] uppercase tracking-[0.08em] text-app-accent-ink">{isVehicleEditor ? "Data Kendaraan" : mode === "create" ? "Tambah Unit" : "Edit Unit"}</p>
            <p className="mt-1 text-sm text-muted-foreground">{isVehicleEditor ? form.unitName : mode === "create" ? "Buat unit dan tetapkan penanggung jawab proyek." : form.unitName}</p>
          </div>
          <button type="button" onClick={onClose} className="inline-flex h-8 w-8 items-center justify-center border border-transparent text-muted-foreground hover:border-border hover:text-foreground" aria-label="Tutup"><X className="h-4 w-4" /></button>
        </div>

        <div className="grid gap-3 px-4 py-4 md:grid-cols-2">
          <label className={labelClass}>
            <span className={captionClass}>ID Unit</span>
            <input value={form.unitId} disabled={mode === "edit"} onChange={(event) => onChange({ ...form, unitId: event.target.value })} placeholder="Otomatis dari nama unit dan pemilik" className={fieldClass} />
          </label>
          <label className={labelClass}>
            <span className={captionClass}>Jenis kendaraan</span>
            <input value={form.unitName} onChange={(event) => { const unitName = event.target.value; onChange({ ...form, unitName, unitId: updateAutoUnitId(unitName, form.customerName) }); }} placeholder="Contoh: MB 190 SL" className={fieldClass} />
          </label>
          <label className={labelClass}>
            <span className={captionClass}>No. rangka / VIN</span>
            <input value={form.plateNumber} onChange={(event) => onChange({ ...form, plateNumber: event.target.value })} placeholder="Opsional" className={fieldClass} />
          </label>
          <label className={labelClass}>
            <span className={captionClass}>Pemilik</span>
            <input list="unit-customers" value={form.customerName} onChange={(event) => { const customerName = event.target.value; onChange({ ...form, customerName, unitId: updateAutoUnitId(form.unitName, customerName) }); }} placeholder="Pilih atau ketik pemilik" className={fieldClass} />
            <datalist id="unit-customers">{references.customers.map((customer) => <option key={customer.value} value={customer.value} />)}</datalist>
          </label>
          <label className={labelClass}>
            <span className={captionClass}>No. polisi</span>
            <input value={form.policeNumber} onChange={(event) => onChange({ ...form, policeNumber: event.target.value })} placeholder="Opsional" className={fieldClass} />
          </label>
          <label className={labelClass}>
            <span className={captionClass}>Tahun kendaraan</span>
            <input type="number" min="1886" max="2100" value={form.vehicleYear} onChange={(event) => onChange({ ...form, vehicleYear: event.target.value })} placeholder="Opsional" className={fieldClass} />
          </label>
          <label className={labelClass}>
            <span className={captionClass}>No. mesin</span>
            <input value={form.engineNumber} onChange={(event) => onChange({ ...form, engineNumber: event.target.value })} placeholder="Opsional" className={fieldClass} />
          </label>
          <label className={labelClass}>
            <span className={captionClass}>Warna</span>
            <input value={form.vehicleColor} onChange={(event) => onChange({ ...form, vehicleColor: event.target.value })} placeholder="Opsional" className={fieldClass} />
          </label>
          <label className={labelClass}>
            <span className={captionClass}>BPKB</span>
            <select value={form.hasBpkb} onChange={(event) => onChange({ ...form, hasBpkb: event.target.value as VehicleDocumentAvailability })} className={fieldClass}>
              <option value="">Belum dicek</option><option value="yes">Ada</option><option value="no">Tidak ada</option>
            </select>
          </label>
          <label className={labelClass}>
            <span className={captionClass}>STNK</span>
            <select value={form.hasStnk} onChange={(event) => onChange({ ...form, hasStnk: event.target.value as VehicleDocumentAvailability })} className={fieldClass}>
              <option value="">Belum dicek</option><option value="yes">Ada</option><option value="no">Tidak ada</option>
            </select>
          </label>
          <label className={labelClass}>
            <span className={captionClass}>Pajak STNK</span>
            <input type="date" value={form.stnkTaxDueDate} onChange={(event) => onChange({ ...form, stnkTaxDueDate: event.target.value })} className={fieldClass} />
          </label>
          <label className={labelClass}>
            <span className={captionClass}>Pajak BPKB</span>
            <input type="date" value={form.bpkbTaxDueDate} onChange={(event) => onChange({ ...form, bpkbTaxDueDate: event.target.value })} className={fieldClass} />
          </label>
          <label className={`${labelClass} md:col-span-2`}>
            <span className={captionClass}>Keterangan</span>
            <textarea value={form.vehicleNotes} onChange={(event) => onChange({ ...form, vehicleNotes: event.target.value })} placeholder="Catatan kendaraan bila ada" rows={3} className="w-full resize-y border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40" />
          </label>

          {!isVehicleEditor ? <>
            <label className={labelClass}>
              <span className={captionClass}>Tipe restorasi</span>
              <select value={form.restorationType} onChange={(event) => onChange({ ...form, restorationType: event.target.value === "PARTIAL_RESTORATION" ? "PARTIAL_RESTORATION" : "FULL_RESTORATION" })} className={fieldClass}>
                <option value="FULL_RESTORATION">Full restoration</option><option value="PARTIAL_RESTORATION">Partial restoration</option>
              </select>
            </label>
            <label className={labelClass}>
              <span className={captionClass}>KP</span>
              <select value={form.kpId} disabled={referencesLoading} onChange={(event) => onChange({ ...form, kpId: event.target.value })} className={fieldClass}>
                <option value="">Pilih KP</option>{references.kps.map((kp) => <option key={kp.value} value={kp.value}>{kp.label}</option>)}
              </select>
            </label>
            <label className={labelClass}>
              <span className={captionClass}>KD</span>
              <select value={form.kdId} disabled={referencesLoading} onChange={(event) => onChange({ ...form, kdId: event.target.value })} className={fieldClass}>
                <option value="">Tidak ditetapkan</option>{references.kds.map((kd) => <option key={kd.value} value={kd.value}>{kd.label}</option>)}
              </select>
            </label>
            <div className={labelClass}>
              <span className={captionClass}>QA</span>
              <div className="flex h-9 items-center border border-border bg-muted/40 px-3 text-sm text-muted-foreground">{form.kdId ? (references.qa ? `Otomatis: ${references.qa.label}` : "QA belum tersedia") : "Pilih KD terlebih dahulu"}</div>
            </div>
            {mode === "edit" ? <label className={labelClass}>
              <span className={captionClass}>Status unit</span>
              <select value={form.status} disabled={form.status === "ON_PROGRESS" || form.status === "DONE"} onChange={(event) => onChange({ ...form, status: event.target.value === "HOLD" ? "HOLD" : "PLAN" })} className={fieldClass}>
                <option value="PLAN">Rencana</option><option value="HOLD">Ditahan</option><option value="ON_PROGRESS">Sedang dikerjakan</option><option value="DONE">Sudah diserahkan</option>
              </select>
            </label> : null}
            <label className={labelClass}><span className={captionClass}>Tanggal kedatangan</span><input type="date" value={form.incomingDate} onChange={(event) => onChange({ ...form, incomingDate: event.target.value })} className={fieldClass} /></label>
            <label className={labelClass}><span className={captionClass}>Target TD awal</span><input type="date" value={form.targetTdAwal} onChange={(event) => onChange({ ...form, targetTdAwal: event.target.value })} className={fieldClass} /></label>
            <label className={labelClass}><span className={captionClass}>Target TD COO</span><input type="date" value={form.targetTdCoo} onChange={(event) => onChange({ ...form, targetTdCoo: event.target.value })} className={fieldClass} /></label>
            <label className={labelClass}><span className={captionClass}>Target delivery</span><input type="date" value={form.targetDelivery} onChange={(event) => onChange({ ...form, targetDelivery: event.target.value })} className={fieldClass} /></label>
            <label className="flex items-center gap-2 self-end text-sm text-muted-foreground"><input type="checkbox" checked={form.isMargin} onChange={(event) => onChange({ ...form, isMargin: event.target.checked })} className="h-4 w-4" />Unit margin</label>
          </> : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-border bg-background px-4 py-3">
          <button type="button" onClick={onClose} className="border border-border px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground">Batal</button>
          <button type="button" disabled={pending || !form.unitName.trim() || !form.kpId} onClick={onSubmit} className="border border-primary/40 bg-primary/10 px-4 py-2 text-xs font-medium text-app-accent-ink disabled:cursor-not-allowed disabled:opacity-45">{pending ? "Menyimpan..." : "Simpan"}</button>
        </div>
      </div>
    </div>
  );
}
