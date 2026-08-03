"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Save } from "lucide-react";
import { mutateSpf } from "@/shared/api/spf";
import type { SpfItem, SpfPeriod, SpfSource } from "@/shared/api/spf-contracts";
import { ActionButton, CompactInput, CompactTextarea, FieldLabel, PageHeader, SectionCard, Toast } from "@/shared/ui/compact";
import { VehicleCombobox } from "../vehicle-combobox";
import { TechnicalJobdescSelector } from "../source-collector";
import { ManualJobdescForm } from "./item-form";
import { CuratedItemEditor } from "../item-list";
import { DocumentationManager } from "../item-media";
import { PortalPreview } from "../portal-preview";

type WizardStep = 1 | 2 | 3 | 4 | 5 | 6;

interface PeriodWizardDraft {
  car_id: string;
  year: string;
  date_start: string;
  date_end: string;
  description: string;
  selected_source_keys: string[];
  selected_item_ids: string[];
  documentation_checked: boolean;
}

const EMPTY_DRAFT: PeriodWizardDraft = {
  car_id: "",
  year: String(new Date().getFullYear()),
  date_start: "",
  date_end: "",
  description: "",
  selected_source_keys: [],
  selected_item_ids: [],
  documentation_checked: false,
};

function storageKey(periodId?: string) {
  return `spf.period-wizard.${periodId ?? "new"}`;
}

function sourceIdFromKey(key: string) {
  return key.split(":").slice(1).join(":");
}

function validateDraft(draft: PeriodWizardDraft, items: readonly SpfItem[]) {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!draft.car_id) errors.push("Unit wajib dipilih.");
  if (!draft.date_start || !draft.date_end) errors.push("Rentang periode wajib diisi.");
  if (draft.date_start && draft.date_end && draft.date_end < draft.date_start) errors.push("Tanggal selesai harus setelah atau sama dengan tanggal mulai.");
  const included = items.filter((item) => item.spf_status === "INCLUDED");
  if (included.length === 0) errors.push("Minimal satu item INCLUDED.");
  if (included.some((item) => !item.customer_description.trim())) errors.push("Customer description setiap item INCLUDED wajib terisi.");
  if (included.some((item) => item.progress < 0 || item.progress > 100)) errors.push("Progress item wajib berada pada rentang 0-100.");
  if (!draft.documentation_checked) errors.push("Dokumentasi wajib diperiksa.");
  if (included.some((item) => (item.documentation_count ?? 0) === 0)) warnings.push("Ada item INCLUDED tanpa dokumentasi.");
  return { errors, warnings };
}

export function PeriodWizard({ period }: { period?: SpfPeriod }) {
  const router = useRouter();
  const [step, setStep] = useState<WizardStep>(1);
  const [draft, setDraft] = useState<PeriodWizardDraft>(EMPTY_DRAFT);
  const [sources, setSources] = useState<SpfSource[]>([]);
  const [items, setItems] = useState<SpfItem[]>([]);
  const [periods, setPeriods] = useState<SpfPeriod[]>([]);
  const [activeSourceTab, setActiveSourceTab] = useState<"SYSTEM" | "MANUAL">("SYSTEM");
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverSuccess, setServerSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const stored = window.localStorage.getItem(storageKey(period?.id));
    if (stored) {
      try {
        setDraft({ ...EMPTY_DRAFT, ...JSON.parse(stored) });
        return;
      } catch {
        window.localStorage.removeItem(storageKey(period?.id));
      }
    }
    if (period) {
      setDraft({
        ...EMPTY_DRAFT,
        car_id: period.car_id,
        year: period.date_start?.slice(0, 4) || String(new Date().getFullYear()),
        date_start: period.date_start ?? "",
        date_end: period.date_end ?? "",
        description: period.description ?? "",
      });
    }
  }, [period]);

  useEffect(() => {
    window.localStorage.setItem(storageKey(period?.id), JSON.stringify(draft));
  }, [draft, period?.id]);

  useEffect(() => {
    if (!draft.car_id || !draft.date_start || !draft.date_end) return;
    let cancelled = false;
    void mutateSpf<{ items: SpfSource[] }>("source", {
      mode: "SMS_DB",
      car_id: draft.car_id,
      date_start: draft.date_start,
      date_end: draft.date_end,
      technical_only: true,
      exclude_repetition: true,
      limit: 100,
      offset: 0,
    }).then((result) => {
      if (!cancelled && result.success) setSources(result.data.items ?? []);
    });
    void mutateSpf<{ periods: SpfPeriod[]; items?: SpfPeriod[] }>("period", {
      mode: "LIST",
      car_id: draft.car_id,
      year: draft.year,
      limit: 100,
      offset: 0,
    }).then((result) => {
      if (!cancelled && result.success) setPeriods(result.data.periods ?? result.data.items ?? []);
    });
    void mutateSpf<{ items: SpfItem[] }>("item", {
      mode: "LIST",
      car_id: draft.car_id,
      period_id: period?.id,
      limit: 100,
      offset: 0,
    }).then((result) => {
      if (!cancelled && result.success) setItems(result.data.items ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [draft.car_id, draft.date_end, draft.date_start, draft.year, period?.id]);

  const overlapWarnings = useMemo(
    () => periods.filter((row) => row.id !== period?.id && row.date_start && row.date_end && draft.date_start <= row.date_end && draft.date_end >= row.date_start),
    [draft.date_end, draft.date_start, period?.id, periods],
  );
  const validation = useMemo(() => validateDraft(draft, items), [draft, items]);

  function createOrSaveDraft() {
    setServerError(null);
    setServerSuccess(null);
    if (validation.errors.length > 0) {
      setServerError(validation.errors[0] ?? "Validasi gagal.");
      return;
    }

    startTransition(async () => {
      const sourceIds = draft.selected_source_keys
        .filter((key) => !key.startsWith("MANUAL:"))
        .map(sourceIdFromKey);
      const itemIds = Array.from(new Set([...draft.selected_item_ids, ...items.filter((item) => item.spf_status === "INCLUDED").map((item) => item.id)]));
      const result = await mutateSpf<Record<string, unknown>>("period", period
        ? {
            mode: "UPDATE",
            period_id: period.id,
            date_start: draft.date_start,
            date_end: draft.date_end,
            description: draft.description || undefined,
            item_ids: itemIds,
            source_ids: sourceIds,
          }
        : {
            mode: "CREATE",
            car_id: draft.car_id,
            date_start: draft.date_start,
            date_end: draft.date_end,
            description: draft.description || undefined,
            item_ids: itemIds,
            source_ids: sourceIds,
          });

      if (!result.success) {
        const message = result.status === 409 ? "Data telah berubah. Halaman akan diperbarui." : result.message;
        setServerError(message);
        if (result.status === 409) router.refresh();
        return;
      }

      window.localStorage.removeItem(storageKey(period?.id));
      setServerSuccess("Draft periode berhasil disimpan.");
      const nextId = String(result.data.period_id ?? result.data.id ?? period?.id ?? "");
      router.push(nextId ? `/spf/periods/${encodeURIComponent(nextId)}` : "/spf/periods");
      router.refresh();
    });
  }

  function go(next: WizardStep) {
    setStep(next);
  }

  return (
    <section className="space-y-4" aria-labelledby="period-wizard-title">
      <PageHeader eyebrow="SPF Admin" title={period ? `Edit Draft ${period.id}` : "Buat Periode"} />

      <div className="grid gap-2 md:grid-cols-6">
        {[1, 2, 3, 4, 5, 6].map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setStep(item as WizardStep)}
            className={`border px-3 py-2 text-left font-mono text-[11px] uppercase tracking-[0.08em] ${
              step === item ? "border-primary bg-primary/10 text-app-accent-ink" : "border-border text-muted-foreground dark:border-white/[0.08]"
            }`}
          >
            Step {item}
          </button>
        ))}
      </div>

      {step === 1 ? (
        <SectionCard label="Step 1 - Unit dan Periode">
          <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
            <VehicleCombobox value={draft.car_id} onChange={(value) => setDraft({ ...draft, car_id: value })} />
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <FieldLabel required>Tahun</FieldLabel>
                <CompactInput value={draft.year} onChange={(event) => setDraft({ ...draft, year: event.target.value })} />
              </div>
              <div>
                <FieldLabel required>Tanggal mulai</FieldLabel>
                <CompactInput type="date" value={draft.date_start} onChange={(event) => setDraft({ ...draft, date_start: event.target.value })} />
              </div>
              <div>
                <FieldLabel required>Tanggal selesai</FieldLabel>
                <CompactInput type="date" value={draft.date_end} onChange={(event) => setDraft({ ...draft, date_end: event.target.value })} />
              </div>
            </div>
          </div>
          <div>
            <FieldLabel>Deskripsi internal</FieldLabel>
            <CompactTextarea rows={3} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
          </div>
          <div className="border border-border bg-muted/30 px-3 py-2 text-[12px] text-muted-foreground dark:border-white/[0.06]">
            Backend akan menghasilkan period_id otomatis dengan format <span className="font-mono text-foreground">{"{CAR_ID}-{YYYY}-{MM}-{SEQUENCE}"}</span>.
          </div>
          {overlapWarnings.length > 0 ? (
            <div className="border border-primary/25 bg-primary/8 px-3 py-2 text-[12px] text-app-accent-ink">
              <AlertTriangle className="mr-1 inline h-3.5 w-3.5" />
              Rentang bertabrakan dengan {overlapWarnings.length} periode existing.
            </div>
          ) : null}
        </SectionCard>
      ) : null}

      {step === 2 ? (
        <SectionCard label="Step 2 - Pilih Sumber Data">
          <div className="mb-3 flex gap-2">
            <ActionButton variant={activeSourceTab === "SYSTEM" ? "primary" : "default"} onClick={() => setActiveSourceTab("SYSTEM")}>Tarik dari Sistem</ActionButton>
            <ActionButton variant={activeSourceTab === "MANUAL" ? "primary" : "default"} onClick={() => setActiveSourceTab("MANUAL")}>Buat Manual</ActionButton>
          </div>
          {activeSourceTab === "SYSTEM" ? (
            <TechnicalJobdescSelector
              sources={sources}
              selectedIds={draft.selected_source_keys}
              onSelectionChange={(ids) => setDraft({ ...draft, selected_source_keys: ids })}
            />
          ) : (
            <ManualJobdescForm mode="CREATE" carId={draft.car_id} periodId={period?.id} onSuccess={() => router.refresh()} />
          )}
        </SectionCard>
      ) : null}

      {step === 3 ? (
        <SectionCard label="Step 3 - Kurasi Isi Periode">
          <CuratedItemEditor
            rows={items}
            meta={{ total: items.length, limit: Math.max(1, items.length), offset: 0, hasNextPage: false }}
            role="ADMIN"
            editable
          />
        </SectionCard>
      ) : null}

      {step === 4 ? (
        <SectionCard label="Step 4 - Dokumentasi">
          <div className="space-y-4">
            {items.length === 0 ? <p className="text-[13px] text-muted-foreground">Simpan atau tarik item terlebih dahulu untuk melihat dokumentasi per item.</p> : null}
            {items.map((item) => (
              <SectionCard key={item.id} label={item.customer_description || item.id}>
                <DocumentationManager itemId={item.id} media={[]} editable />
              </SectionCard>
            ))}
            <label className="flex items-center gap-2 text-[13px] text-foreground">
              <input
                type="checkbox"
                checked={draft.documentation_checked}
                onChange={(event) => setDraft({ ...draft, documentation_checked: event.target.checked })}
              />
              Dokumentasi sudah diperiksa.
            </label>
          </div>
        </SectionCard>
      ) : null}

      {step === 5 ? (
        <SectionCard label="Step 5 - Review">
          <PortalPreview period={{ ...(period ?? { id: "DRAFT", title: "Draft", status: "DRAFT", workflow_status: "DRAFT", created_by: "-", created_at: "", updated_at: "" }), ...draft }} items={items.filter((item) => item.spf_status === "INCLUDED")} adminPreview />
          {validation.errors.length > 0 || validation.warnings.length > 0 ? (
            <div className="space-y-2">
              {validation.errors.map((error) => <p key={error} className="border border-destructive/20 bg-destructive/5 px-3 py-2 text-[12px] text-destructive">{error}</p>)}
              {validation.warnings.map((warning) => <p key={warning} className="border border-primary/25 bg-primary/8 px-3 py-2 text-[12px] text-app-accent-ink">{warning}</p>)}
            </div>
          ) : (
            <p className="inline-flex items-center gap-2 text-[13px] text-success"><CheckCircle2 className="h-4 w-4" />Validasi review lolos.</p>
          )}
        </SectionCard>
      ) : null}

      {step === 6 ? (
        <SectionCard label="Step 6 - Simpan Draft">
          <p className="text-[13px] text-muted-foreground">
            Tombol ini hanya menyimpan DRAFT. Submit approval tetap dilakukan dari detail periode setelah admin memeriksa ulang laporan.
          </p>
          <ActionButton variant="primary" disabled={isPending} onClick={createOrSaveDraft}>
            <Save className="h-3.5 w-3.5" />
            {isPending ? "Menyimpan..." : "Simpan DRAFT"}
          </ActionButton>
        </SectionCard>
      ) : null}

      <Toast message={serverError} variant="err" />
      <Toast message={serverSuccess} variant="ok" />

      <div className="flex items-center justify-between border-t border-border pt-4 dark:border-white/[0.05]">
        <ActionButton disabled={step === 1} onClick={() => go((step - 1) as WizardStep)}>
          <ChevronLeft className="h-3.5 w-3.5" />
          Sebelumnya
        </ActionButton>
        <ActionButton disabled={step === 6} variant="primary" onClick={() => go((step + 1) as WizardStep)}>
          Berikutnya
          <ChevronRight className="h-3.5 w-3.5" />
        </ActionButton>
      </div>
    </section>
  );
}

export function PeriodForm() {
  return <PeriodWizard />;
}
