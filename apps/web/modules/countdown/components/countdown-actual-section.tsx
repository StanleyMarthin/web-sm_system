"use client";

import type { CountdownDetail } from "@smsystem/contracts/countdown";
import type { JobPlanV2ReadItem } from "@smsystem/contracts/job-plan-v2";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { Camera, ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createMonitoringActual } from "@/shared/api/monitoring";
import { DataGridStatusBadge } from "@/shared/datagrid/status-badge";
import { SmsAgGrid } from "@/shared/datagrid/sms-ag-grid";
import { fmtTime, humanizeCodeLabel } from "@/shared/format/humanize";
import { ActionButton, CompactInput, CompactSelect, CompactTextarea, FieldLabel, SectionCard } from "@/shared/ui/compact";
import { useSweetAlert } from "@/shared/ui/sweet-alert";
import { resolveCountdownPhotoUrl } from "../countdown-dialog";

type CountdownActualEntry = CountdownDetail["details"][number];

const photoLabels = {
  BEFORE: "Sebelum",
  PROCESS: "Pengerjaan",
  AFTER: "Setelah",
  DEFECT: "Temuan",
} as const;

const actualColumnDefs: ColDef<CountdownActualEntry>[] = [
  { headerName: "Tanggal", field: "workDate", minWidth: 110 },
  { headerName: "Operator", field: "employeeName", minWidth: 150, flex: 0.8 },
  { headerName: "Mulai", field: "startTime", minWidth: 85, valueFormatter: ({ value }) => fmtTime(String(value ?? "")) },
  { headerName: "Selesai", field: "finishTime", minWidth: 85, valueFormatter: ({ value }) => fmtTime(String(value ?? "")) },
  { headerName: "Jam", field: "billedHours", minWidth: 90, valueFormatter: ({ value }) => `${Number(value ?? 0).toFixed(2)} jam` },
  { headerName: "Progress", field: "progressPercent", minWidth: 90, valueFormatter: ({ value }) => `${Number(value ?? 0).toFixed(0)}%` },
  {
    headerName: "Status",
    field: "taskStatus",
    minWidth: 130,
    cellRenderer: ({ value }: ICellRendererParams<CountdownActualEntry>) => <DataGridStatusBadge value={humanizeCodeLabel(value)} />,
  },
  { headerName: "Catatan", field: "dailyNotes", minWidth: 220, flex: 1 },
];

function CountdownGallery({ countdown }: { countdown: CountdownDetail }) {
  const photos = countdown.details.flatMap((detail) => detail.photos.map((photo) => ({
    ...photo,
    workDate: detail.workDate,
    employeeName: detail.employeeName,
  }))).filter((photo) => resolveCountdownPhotoUrl(photo.url));
  const [activeIndex, setActiveIndex] = useState(0);
  const activePhoto = photos[activeIndex];
  const activeUrl = activePhoto ? resolveCountdownPhotoUrl(activePhoto.url) : null;

  if (!activePhoto || !activeUrl) {
    return (
      <section id="dokumentasi" className="border border-border bg-card dark:border-white/[0.06]">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2.5 dark:border-white/[0.06]">
          <Camera className="h-4 w-4 text-app-accent-ink" />
          <h2 className="text-sm font-semibold text-foreground">Dokumentasi</h2>
        </div>
        <p className="px-3 py-5 text-sm text-muted-foreground">Belum ada foto.</p>
      </section>
    );
  }

  function move(delta: number) {
    setActiveIndex((current) => (current + delta + photos.length) % photos.length);
  }

  return (
    <section id="dokumentasi" className="border border-border bg-card dark:border-white/[0.06]">
      <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2.5 dark:border-white/[0.06]">
        <div className="flex items-center gap-2">
          <Camera className="h-4 w-4 text-app-accent-ink" />
          <h2 className="text-sm font-semibold text-foreground">Dokumentasi</h2>
        </div>
        <span className="font-mono text-[10px] uppercase text-muted-foreground">{photos.length} foto</span>
      </div>
      <div className="grid gap-3 p-3 lg:grid-cols-[minmax(0,1fr)_10rem]">
        <div className="relative flex min-h-[18rem] items-center justify-center overflow-hidden bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element -- URL dokumentasi berasal dari storage dinamis. */}
          <img src={activeUrl} alt={activePhoto.caption || `Dokumentasi ${photoLabels[activePhoto.type]}`} className="max-h-[32rem] w-full object-contain" />
          {photos.length > 1 ? (
            <>
              <button type="button" onClick={() => move(-1)} className="absolute left-2 inline-flex h-8 w-8 items-center justify-center border border-white/30 bg-black/45 text-white hover:bg-black/65" aria-label="Foto sebelumnya"><ChevronLeft className="h-4 w-4" /></button>
              <button type="button" onClick={() => move(1)} className="absolute right-2 inline-flex h-8 w-8 items-center justify-center border border-white/30 bg-black/45 text-white hover:bg-black/65" aria-label="Foto berikutnya"><ChevronRight className="h-4 w-4" /></button>
            </>
          ) : null}
        </div>
        <div className="flex gap-2 overflow-x-auto lg:block lg:space-y-2 lg:overflow-y-auto">
          {photos.map((photo, index) => {
            const url = resolveCountdownPhotoUrl(photo.url);
            if (!url) return null;
            return (
              <button key={photo.photoId} type="button" onClick={() => setActiveIndex(index)} className={`block shrink-0 overflow-hidden border text-left ${index === activeIndex ? "border-primary" : "border-border hover:border-primary/50"}`} aria-label={`Pilih foto ${index + 1}`}>
                {/* eslint-disable-next-line @next/next/no-img-element -- URL dokumentasi berasal dari storage dinamis. */}
                <img src={url} alt="" className="h-16 w-20 object-cover lg:h-20 lg:w-full" />
                <span className="hidden px-2 py-1 font-mono text-[10px] uppercase text-muted-foreground lg:block">{photoLabels[photo.type]}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="border-t border-border px-3 py-2 text-[12px] text-muted-foreground dark:border-white/[0.06]">
        <span className="font-medium text-foreground">{photoLabels[activePhoto.type]}</span>
        {activePhoto.caption ? ` · ${activePhoto.caption}` : ""}
        {activePhoto.workDate ? ` · ${activePhoto.workDate}` : ""}
      </div>
    </section>
  );
}

type ActualTaskStatus = "ONPROGRESS" | "READY_QC" | "DONE" | "PENDING" | "CANCEL";

// ponytail: empat status yang dipakai operator harian; tambah CANCEL kalau operator perlu membatalkan.
const actualStatusOptions: Array<{ label: string; value: ActualTaskStatus }> = [
  { label: "Progress", value: "ONPROGRESS" },
  { label: "Ready QC", value: "READY_QC" },
  { label: "Done", value: "DONE" },
  { label: "Pending", value: "PENDING" },
];

interface ActualFormState {
  planId: string;
  date: string;
  employeeId: string;
  startTime: string;
  finishTime: string;
  breakMinutes: string;
  progressPercent: string;
  taskStatus: ActualTaskStatus;
  resultNote: string;
}

interface CountdownActualSectionProps {
  countdown: CountdownDetail;
  plans: JobPlanV2ReadItem[];
  plansLoading: boolean;
  canInputActual: boolean;
  employeeOptions: { label: string; value: string }[];
  onRequestEmployeeOptions: () => void;
}

function toLocalDateValue(value = new Date()) {
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${value.getFullYear()}-${month}-${day}`;
}

export function CountdownActualSection({
  countdown,
  plans,
  plansLoading,
  canInputActual,
  employeeOptions,
  onRequestEmployeeOptions,
}: CountdownActualSectionProps) {
  const router = useRouter();
  const sweetAlert = useSweetAlert();
  const [form, setForm] = useState<ActualFormState | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const divisionId = countdown.divisionId;
  const planOptions = plans.map((plan) => ({
    value: plan.plan_id,
    label: `${plan.jobdescription ?? countdown.jobTypeName ?? "Pekerjaan"} · ${plan.task_date}`,
  }));
  const canRecord = canInputActual && divisionId !== null && planOptions.length > 0;

  function openForm() {
    setFormError(null);
    setForm({
      planId: planOptions[0]?.value ?? "",
      date: toLocalDateValue(),
      employeeId: "",
      startTime: "08:00",
      finishTime: "09:00",
      breakMinutes: "0",
      progressPercent: String(Math.round(countdown.actualProgressPercent)),
      taskStatus: "ONPROGRESS",
      resultNote: "",
    });
    if (employeeOptions.length === 0) onRequestEmployeeOptions();
  }

  async function submitForm() {
    if (!form || isSaving) return;
    if (divisionId === null) {
      setFormError("Divisi countdown belum ditentukan.");
      return;
    }
    if (!form.planId) {
      setFormError("Pilih rencana pekerjaan untuk mencatat actual.");
      return;
    }
    if (!form.employeeId) {
      setFormError("Operator wajib dipilih.");
      return;
    }
    if (!form.startTime || !form.finishTime) {
      setFormError("Jam mulai dan jam selesai wajib diisi.");
      return;
    }

    setIsSaving(true);
    setFormError(null);
    try {
      const result = await createMonitoringActual({
        date: form.date,
        employeeId: form.employeeId,
        divisionId,
        planId: form.planId,
        carId: countdown.carId,
        jobDescription: countdown.jobTypeName ?? countdown.sectionName ?? countdown.unitName,
        resultNote: form.resultNote.trim() || null,
        startTime: form.startTime,
        finishTime: form.finishTime,
        breakMinutes: Number(form.breakMinutes || 0),
        progressPercent: Number(form.progressPercent || 0),
        taskStatus: form.taskStatus,
        location: null,
        isOvertime: false,
      });
      if (!result.success) {
        setFormError(result.message);
        return;
      }
      setForm(null);
      sweetAlert.notifySuccess("Actual tersimpan", "Jam kerja tercatat pada rencana pilihan.");
      router.refresh();
    } catch {
      setFormError("Actual tidak bisa disimpan. Coba lagi sebentar.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div id="actual" className="space-y-2">
      {sweetAlert.alertElement}
      <SectionCard label="Aktual pekerjaan" count={countdown.details.length}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[12px] text-muted-foreground">
            {countdown.details.length > 0
              ? `${countdown.details.length} catatan aktual · ${countdown.totalActualHours.toFixed(2)} jam tercatat`
              : "Belum ada jam kerja tercatat pada countdown ini."}
          </p>
          {canRecord ? (
            <ActionButton variant="primary" onClick={openForm} disabled={form !== null}>
              <Plus className="h-3 w-3" />Input Actual
            </ActionButton>
          ) : canInputActual ? (
            <span className="text-[12px] text-muted-foreground">
              {plansLoading
                ? "Memuat rencana pekerjaan…"
                : divisionId === null
                ? "Divisi countdown belum ditentukan."
                : "Actual teknis perlu job plan. Buat job plan dulu."}
            </span>
          ) : null}
        </div>

        {countdown.details.length > 0 ? (
          <SmsAgGrid<CountdownActualEntry>
            heightClassName="h-72"
            rowData={countdown.details}
            columnDefs={actualColumnDefs}
            getRowId={(params) => params.data.detailId}
            emptyMessage="Belum ada hasil pekerjaan."
          />
        ) : null}

        {form ? (
          <div className="border border-primary/25 bg-primary/[0.03] p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[13px] font-semibold text-foreground">Input Actual</p>
              <ActionButton onClick={() => setForm(null)} disabled={isSaving}>
                <X className="h-3 w-3" />Batal
              </ActionButton>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="sm:col-span-2">
                <FieldLabel required>Rencana</FieldLabel>
                <CompactSelect
                  aria-label="Rencana pekerjaan"
                  value={form.planId}
                  onChange={(event) => setForm({ ...form, planId: event.target.value })}
                >
                  {planOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </CompactSelect>
              </div>
              <div>
                <FieldLabel required>Tanggal</FieldLabel>
                <CompactInput
                  aria-label="Tanggal actual"
                  type="date"
                  value={form.date}
                  onChange={(event) => setForm({ ...form, date: event.target.value })}
                />
              </div>
              <div>
                <FieldLabel required>Operator</FieldLabel>
                <CompactSelect
                  aria-label="Operator"
                  value={form.employeeId}
                  disabled={employeeOptions.length === 0}
                  onChange={(event) => setForm({ ...form, employeeId: event.target.value })}
                >
                  <option value="">
                    {employeeOptions.length === 0 ? "Daftar operator belum tersedia" : "Pilih operator"}
                  </option>
                  {employeeOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </CompactSelect>
                {employeeOptions.length === 0 ? (
                  <button
                    type="button"
                    onClick={onRequestEmployeeOptions}
                    className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-app-accent-ink underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    Muat daftar operator
                  </button>
                ) : null}
              </div>
              <div>
                <FieldLabel required>Mulai</FieldLabel>
                <CompactInput
                  aria-label="Jam mulai"
                  type="time"
                  value={form.startTime}
                  onChange={(event) => setForm({ ...form, startTime: event.target.value })}
                />
              </div>
              <div>
                <FieldLabel required>Selesai</FieldLabel>
                <CompactInput
                  aria-label="Jam selesai"
                  type="time"
                  value={form.finishTime}
                  onChange={(event) => setForm({ ...form, finishTime: event.target.value })}
                />
              </div>
              <div>
                <FieldLabel>Istirahat (menit)</FieldLabel>
                <CompactInput
                  aria-label="Istirahat menit"
                  type="number"
                  min={0}
                  max={720}
                  value={form.breakMinutes}
                  onChange={(event) => setForm({ ...form, breakMinutes: event.target.value })}
                />
              </div>
              <div>
                <FieldLabel>Progress (%)</FieldLabel>
                <CompactInput
                  aria-label="Progress persen"
                  type="number"
                  min={0}
                  max={100}
                  value={form.progressPercent}
                  onChange={(event) => setForm({ ...form, progressPercent: event.target.value })}
                />
              </div>
              <div>
                <FieldLabel required>Status</FieldLabel>
                <CompactSelect
                  aria-label="Status pekerjaan"
                  value={form.taskStatus}
                  onChange={(event) => setForm({ ...form, taskStatus: event.target.value as ActualFormState["taskStatus"] })}
                >
                  {actualStatusOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </CompactSelect>
              </div>
              <div className="sm:col-span-2 lg:col-span-4">
                <FieldLabel>Catatan hasil</FieldLabel>
                <CompactTextarea
                  aria-label="Catatan hasil"
                  rows={2}
                  maxLength={500}
                  value={form.resultNote}
                  onChange={(event) => setForm({ ...form, resultNote: event.target.value })}
                />
              </div>
            </div>
            {formError ? <p className="mt-2 text-[12px] text-destructive">{formError}</p> : null}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 dark:border-white/[0.06]">
              <p className="text-[11px] text-muted-foreground">
                Log countdown dan rollup jam mengikuti sinkronisasi detail aktual.
              </p>
              <div className="flex gap-1.5">
                <ActionButton onClick={() => setForm(null)} disabled={isSaving}>Batal</ActionButton>
                <ActionButton variant="primary" onClick={() => void submitForm()} disabled={isSaving}>
                  <Plus className="h-3 w-3" />{isSaving ? "Menyimpan…" : "Simpan"}
                </ActionButton>
              </div>
            </div>
          </div>
        ) : null}
      </SectionCard>

      <CountdownGallery countdown={countdown} />
    </div>
  );
}
