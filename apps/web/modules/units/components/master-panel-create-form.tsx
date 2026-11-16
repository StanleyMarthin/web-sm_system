"use client";

import { createUnitPanelRequestSchema, type CreateUnitPanelRequest, type UnitPanelRecord } from "@smsystem/contracts/unit-panel";
import { Dialog } from "radix-ui";
import { useState, type FormEvent } from "react";

export interface PanelCreateValues {
  parentId: number | null;
  category: string;
  name: string;
  partNumber: string;
  qty: string;
  initialCondition: string;
  currentStatus: string;
  notes: string;
}

export function buildUnitPanelCreateInput(values: PanelCreateValues, parent: UnitPanelRecord | null): CreateUnitPanelRequest {
  if (values.parentId !== null && parent?.id !== values.parentId) {
    throw new Error("Induk panel/part tidak tersedia. Pilih kembali dari daftar.");
  }
  return createUnitPanelRequestSchema.parse({
    parentId: values.parentId,
    category: parent ? parent.category : values.category,
    section: parent ? parent.section : values.name,
    name: values.name,
    partNumber: values.partNumber.trim() || null,
    qty: Number(values.qty),
    initialCondition: values.initialCondition,
    currentStatus: values.currentStatus,
    notes: values.notes.trim() || null,
  });
}

interface Props {
  records: UnitPanelRecord[];
  initialCategory: string;
  initialParentId: number | null;
  isSaving: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (input: CreateUnitPanelRequest) => Promise<void>;
}

const inputClass = "min-h-11 w-full min-w-0 border border-border bg-background px-3 text-[14px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/60 disabled:opacity-50";
const labelClass = "block space-y-1 text-sm text-muted-foreground";

export function MasterPanelCreateForm({ records, initialCategory, initialParentId, isSaving, error, onClose, onSubmit }: Props) {
  const [values, setValues] = useState<PanelCreateValues>({
    parentId: initialParentId, category: initialCategory, name: "", partNumber: "", qty: "1",
    initialCondition: "BEKAS", currentStatus: "UNKNOWN", notes: "",
  });
  const [validationError, setValidationError] = useState<string | null>(null);
  const parent = records.find((record) => record.id === values.parentId) ?? null;
  const categories = [...new Set(records.map((record) => record.category).filter((category): category is string => Boolean(category)))];
  const change = (patch: Partial<PanelCreateValues>) => {
    setValues((current) => ({ ...current, ...patch }));
    setValidationError(null);
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;
    let input: CreateUnitPanelRequest;
    try {
      input = buildUnitPanelCreateInput(values, parent);
    } catch (cause) {
      setValidationError(cause instanceof Error && !('issues' in cause) ? cause.message : "Periksa nama, jumlah, dan induk panel/part.");
      return;
    }
    await onSubmit(input);
  }

  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open && !isSaving) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content aria-describedby="master-panel-create-description" onEscapeKeyDown={(event) => { if (isSaving) event.preventDefault(); }}
          onInteractOutside={(event) => { if (isSaving) event.preventDefault(); }}
          className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-border bg-card shadow-2xl">
          <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
            <div>
              <Dialog.Title className="text-lg font-semibold text-foreground">Tambah Panel / Part</Dialog.Title>
              <Dialog.Description id="master-panel-create-description" className="mt-1 text-sm text-muted-foreground">
                Pilih induk jika item ini pecahan dari panel atau part yang sudah ada.
              </Dialog.Description>
            </div>
            <Dialog.Close disabled={isSaving} aria-label="Tutup form panel/part" className="min-h-11 min-w-11 border border-border text-foreground focus-visible:ring-2 focus-visible:ring-primary/60">×</Dialog.Close>
          </div>
          <form className="flex min-h-0 flex-1 flex-col" onSubmit={(event) => void submit(event)}>
            <fieldset disabled={isSaving} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
              {validationError || error ? <p role="alert" className="text-sm text-destructive">{validationError ?? error}</p> : null}
              <label className={labelClass}>Panel/part induk
                <select className={inputClass} value={values.parentId ?? ""} onChange={(event) => change({ parentId: event.target.value ? Number(event.target.value) : null })}>
                  <option value="">Tanpa induk (panel baru)</option>
                  {records.map((record) => <option key={record.id} value={record.id}>{record.category ?? "Lainnya"} / {record.section} / {record.name} (#{record.id})</option>)}
                </select>
              </label>
              {parent ? <dl className="space-y-1 text-sm text-muted-foreground">
                <div><dt className="inline">Bagian: </dt><dd className="inline break-words text-foreground">{parent.category ?? "Lainnya"}</dd></div>
                <div><dt className="inline">Panel: </dt><dd className="inline break-words text-foreground">{parent.section}</dd></div>
              </dl> : <label className={labelClass}>Bagian
                <input required maxLength={50} list="master-panel-create-categories" className={inputClass} value={values.category} onChange={(event) => change({ category: event.target.value })} placeholder="Pilih atau cari bagian" />
                <datalist id="master-panel-create-categories">{categories.map((category) => <option key={category} value={category} />)}</datalist>
              </label>}
              <label className={labelClass}>{parent ? "Nama Part" : "Nama Panel"}
                <input required maxLength={parent ? 100 : 50} className={inputClass} value={values.name} onChange={(event) => change({ name: event.target.value })} placeholder={parent ? "Contoh: Bracket Foglamp" : "Contoh: FRONT BUMPER"} />
              </label>
              <label className={labelClass}>Part Number (opsional)
                <input maxLength={100} className={inputClass} value={values.partNumber} onChange={(event) => change({ partNumber: event.target.value })} />
              </label>
              <label className={labelClass}>Jumlah
                <input required type="number" min="0.001" max="100000" step="any" inputMode="decimal" className={inputClass} value={values.qty} onChange={(event) => change({ qty: event.target.value })} />
              </label>
              <label className={labelClass}>Kondisi
                <select className={inputClass} value={values.initialCondition} onChange={(event) => change({ initialCondition: event.target.value })}>
                  <option value="BEKAS">Bekas</option><option value="BARU">Baru</option><option value="RESTORE">Restore</option>
                </select>
              </label>
              <label className={labelClass}>Status awal
                <select className={inputClass} value={values.currentStatus} onChange={(event) => change({ currentStatus: event.target.value })}>
                  <option value="UNKNOWN">Belum diperbarui</option><option value="WAITING">Menunggu</option><option value="INSTALLED">Terpasang</option>
                </select>
              </label>
              <label className={labelClass}>Catatan (opsional)
                <textarea className={`${inputClass} min-h-24 resize-y py-2`} value={values.notes} onChange={(event) => change({ notes: event.target.value })} />
              </label>
            </fieldset>
            <div className="flex shrink-0 justify-end gap-2 border-t border-border px-5 py-3">
              <Dialog.Close disabled={isSaving} className="min-h-11 border border-border px-3 text-sm text-foreground focus-visible:ring-2 focus-visible:ring-primary/60">Batal</Dialog.Close>
              <button type="submit" disabled={isSaving} className="min-h-11 border border-primary/40 bg-primary/10 px-3 text-sm text-app-accent-ink focus-visible:ring-2 focus-visible:ring-primary/60 disabled:opacity-50">{isSaving ? "Menyimpan..." : "Simpan Data"}</button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
