"use client";

import type { CountdownDetail } from "@smsystem/contracts/countdown";
import type { JobPlanV2ReadItem } from "@smsystem/contracts/job-plan-v2";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createMonitoringActual } from "@/shared/api/monitoring";
import { DataGridStatusBadge } from "@/shared/datagrid/status-badge";
import { SmsAgGrid } from "@/shared/datagrid/sms-ag-grid";
import { fmtTime, humanizeCodeLabel } from "@/shared/format/humanize";
import { ActionButton, CompactInput, CompactSelect, CompactTextarea, FieldLabel, SectionCard } from "@/shared/ui/compact";
import { useSweetAlert } from "@/shared/ui/sweet-alert";

type CountdownActualEntry = CountdownDetail["details"][number];

const actualColumnDefs: ColDef<CountdownActualEntry>[] = [
  { headerName: "Tanggal", field: "workDate", minWidth: 120, valueFormatter: ({ value }) => formatLogDate(String(value ?? "")) },
  { headerName: "PIC", field: "employeeName", minWidth: 150, flex: 0.8 },
  { headerName: "Mulai", field: "startTime", minWidth: 85, valueFormatter: ({ value }) => fmtTime(String(value ?? "")) },
  { headerName: "Selesai", field: "finishTime", minWidth: 85, valueFormatter: ({ value }) => fmtTime(String(value ?? "")) },
  { headerName: "Durasi", field: "billedHours", minWidth: 95, valueFormatter: ({ value }) => `${Number(value ?? 0).toFixed(2)} jam` },
  {
    headerName: "Status",
    field: "taskStatus",
    minWidth: 130,
    cellRenderer: ({ value }: ICellRendererParams<CountdownActualEntry>) => <DataGridStatusBadge value={humanizeCodeLabel(value)} />,
  },
];

function formatLogDate(value: string) {
  if (!value) return "-";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function toLocalDateValue(value = new Date()) {
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${value.getFullYear()}-${month}-${day}`;
}

interface ActualFormState {
  date: string;
  employeeId: string;
  startTime: string;
  finishTime: string;
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
  // API actual menempel ke job plan; rencana pertama dipakai sebagai default agar
  // operator tidak perlu memilih (form tetap sederhana sesuai permintaan).
  const defaultPlanId = plans[0]?.plan_id ?? "";
  const canRecord = canInputActual && divisionId !== null && Boolean(defaultPlanId);

  function openForm() {
    setFormError(null);
    setForm({
      date: toLocalDateValue(),
      employeeId: "",
      startTime: "08:00",
      finishTime: "12:00",
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
    if (!defaultPlanId) {
      setFormError("Buat job plan dulu supaya actual bisa tercatat.");
      return;
    }
    if (!form.employeeId) {
      setFormError("PIC wajib dipilih.");
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
        planId: defaultPlanId,
        carId: countdown.carId,
        jobDescription: countdown.jobTypeName ?? countdown.sectionName ?? countdown.unitName,
        resultNote: form.resultNote.trim() || null,
        startTime: form.startTime,
        finishTime: form.finishTime,
        breakMinutes: 0,
        progressPercent: Math.round(countdown.actualProgressPercent),
        taskStatus: "ONPROGRESS",
        location: null,
        isOvertime: false,
      });
      if (!result.success) {
        setFormError(result.message);
        return;
      }
      setForm(null);
      sweetAlert.notifySuccess("Actual tersimpan", "Jam kerja tercatat pada job plan.");
      router.refresh();
    } catch {
      setFormError("Actual tidak bisa disimpan. Coba lagi sebentar.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div id="hasil-pekerjaan">
      {sweetAlert.alertElement}
      <SectionCard label="Hasil pekerjaan" count={countdown.details.length} collapsible defaultOpen>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[12px] text-muted-foreground">
            {countdown.details.length > 0
              ? `${countdown.details.length} catatan · ${countdown.totalActualHours.toFixed(2)} jam tercatat`
              : "Belum ada jam kerja tercatat."}
          </p>
          {canRecord ? (
            <ActionButton variant="primary" onClick={openForm} disabled={form !== null}>
              <Plus className="h-3 w-3" />Input Aktual
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
            heightClassName="h-64"
            rowData={countdown.details}
            columnDefs={actualColumnDefs}
            getRowId={(params) => params.data.detailId}
            emptyMessage="Belum ada hasil pekerjaan."
          />
        ) : null}

        {form ? (
          <div className="border border-primary/25 bg-primary/[0.03] p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[13px] font-semibold text-foreground">Input Aktual</p>
              <ActionButton onClick={() => setForm(null)} disabled={isSaving}>
                <X className="h-3 w-3" />Batal
              </ActionButton>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <FieldLabel required>Tanggal</FieldLabel>
                <CompactInput
                  aria-label="Tanggal aktual"
                  type="date"
                  value={form.date}
                  onChange={(event) => setForm({ ...form, date: event.target.value })}
                />
              </div>
              <div>
                <FieldLabel required>PIC</FieldLabel>
                <CompactSelect
                  value={form.employeeId}
                  disabled={employeeOptions.length === 0}
                  onChange={(event) => setForm({ ...form, employeeId: event.target.value })}
                >
                  <option value="">
                    {employeeOptions.length === 0 ? "Daftar PIC belum tersedia" : "Pilih PIC"}
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
                    Muat daftar PIC
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
              <div className="sm:col-span-2 lg:col-span-4">
                <FieldLabel>Catatan</FieldLabel>
                <CompactTextarea
                  aria-label="Catatan aktual"
                  rows={2}
                  maxLength={500}
                  value={form.resultNote}
                  onChange={(event) => setForm({ ...form, resultNote: event.target.value })}
                />
              </div>
            </div>
            {formError ? <p className="mt-2 text-[12px] text-destructive">{formError}</p> : null}
            <div className="mt-3 flex justify-end gap-1.5 border-t border-border pt-3 dark:border-white/[0.06]">
              <ActionButton onClick={() => setForm(null)} disabled={isSaving}>Batal</ActionButton>
              <ActionButton variant="primary" onClick={() => void submitForm()} disabled={isSaving}>
                <Plus className="h-3 w-3" />{isSaving ? "Menyimpan…" : "Simpan"}
              </ActionButton>
            </div>
          </div>
        ) : null}
      </SectionCard>
    </div>
  );
}
