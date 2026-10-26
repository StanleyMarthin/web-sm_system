"use client";

import type { UnitBoardRow } from "@smsystem/contracts/unit";
import { CarFront, Pencil, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { updateUnit } from "@/shared/api/units/units";
import { useSweetAlert } from "@/shared/ui/sweet-alert";
import {
  buildUnitMutationInput,
  emptyUnitMutationReferences,
  UnitMutationDialog,
  unitFormFromRow,
  type UnitFormState,
} from "./unit-mutation-dialog";

interface UnitVehicleDetailsPanelProps {
  unit: UnitBoardRow;
  canManage: boolean;
}

function formatDate(value: string | null): string {
  if (!value) return "-";
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(parsed);
}

function documentStatus(value: boolean | null): string {
  if (value === null) return "Belum dicek";
  return value ? "Ada" : "Tidak ada";
}

function errorDetail(result: { message: string; errorCode?: string }): string {
  return `${result.message}${result.errorCode ? `\nKode: ${result.errorCode}` : ""}`;
}

function VehicleDataCell({ label, value, fullWidth = false }: { label: string; value: string | number | null | undefined; fullWidth?: boolean }) {
  return (
    <div className={`min-w-0 border-b border-border px-3 py-2.5 ${fullWidth ? "sm:col-span-2 xl:col-span-3" : ""}`}>
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words text-sm text-foreground">{value === null || value === "" ? "-" : value}</dd>
    </div>
  );
}

export function UnitVehicleDetailsPanel({ unit, canManage }: UnitVehicleDetailsPanelProps) {
  const router = useRouter();
  const sweetAlert = useSweetAlert();
  const [form, setForm] = useState<UnitFormState>(() => unitFormFromRow(unit));
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const canEdit = canManage && Boolean(unit.kpId);

  function openEditor() {
    setForm(unitFormFromRow(unit));
    setOpen(false);
    setEditing(true);
  }

  async function saveVehicleDetails() {
    if (!form.unitName.trim() || !form.kpId) return;
    setPending(true);
    const result = await updateUnit(unit.unitId, buildUnitMutationInput(form));
    setPending(false);
    if (!result.success) {
      sweetAlert.notifyError("Data kendaraan belum tersimpan", errorDetail(result));
      return;
    }
    sweetAlert.notifySuccess("Data kendaraan diperbarui");
    setEditing(false);
    router.refresh();
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex h-10 items-center gap-2 border border-border px-3 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground">
        <CarFront className="h-4 w-4" />Data kendaraan
      </button>
      {open ? <div className="fixed inset-0 z-[70] flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="vehicle-details-title" onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); }}>
        <div className="max-h-[calc(100svh-2rem)] w-full max-w-3xl overflow-y-auto border border-border bg-card shadow-2xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div><h2 id="vehicle-details-title" className="text-sm font-semibold text-foreground">Data kendaraan</h2><p className="mt-0.5 text-xs text-muted-foreground">{unit.unitName}</p></div>
            <button type="button" onClick={() => setOpen(false)} className="inline-flex h-8 w-8 items-center justify-center border border-transparent text-muted-foreground hover:border-border hover:text-foreground" aria-label="Tutup"><X className="h-4 w-4" /></button>
          </div>
          <dl className="grid sm:grid-cols-2 xl:grid-cols-3">
            <VehicleDataCell label="Pemilik" value={unit.customerName} />
            <VehicleDataCell label="Jenis kendaraan" value={unit.unitName} />
            <VehicleDataCell label="Tahun" value={unit.vehicleYear} />
            <VehicleDataCell label="No. polisi" value={unit.policeNumber} />
            <VehicleDataCell label="No. rangka / VIN" value={unit.plateNumber} />
            <VehicleDataCell label="No. mesin" value={unit.engineNumber} />
            <VehicleDataCell label="Warna" value={unit.vehicleColor} />
            <VehicleDataCell label="BPKB" value={documentStatus(unit.hasBpkb)} />
            <VehicleDataCell label="STNK" value={documentStatus(unit.hasStnk)} />
            <VehicleDataCell label="Pajak STNK" value={formatDate(unit.stnkTaxDueDate)} />
            <VehicleDataCell label="Pajak BPKB" value={formatDate(unit.bpkbTaxDueDate)} />
            <VehicleDataCell label="ID Unit" value={unit.unitId} />
            <VehicleDataCell label="Keterangan" value={unit.vehicleNotes} fullWidth />
          </dl>
          {canManage ? <div className="flex justify-end border-t border-border px-4 py-3"><button type="button" disabled={!canEdit} title={!canEdit ? "Tetapkan KP terlebih dahulu" : undefined} onClick={openEditor} className="inline-flex h-8 items-center gap-1.5 border border-border px-3 text-xs font-medium text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-45"><Pencil className="h-3.5 w-3.5" />Ubah data</button></div> : null}
        </div>
      </div> : null}
      {editing ? <UnitMutationDialog mode="edit" variant="vehicle" form={form} references={emptyUnitMutationReferences} pending={pending} onChange={setForm} onClose={() => setEditing(false)} onSubmit={saveVehicleDetails} /> : null}
      {sweetAlert.alertElement}
    </>
  );
}
