"use client";

import type { CountdownDetail } from "@smsystem/contracts/countdown";
import type { JobPlanV2ReadItem } from "@smsystem/contracts/job-plan-v2";
import { ChevronDown, Plus, X } from "lucide-react";
import { useState } from "react";
import { createJobPlanV2, createJobPlanV2CommandId } from "@/shared/api/job-plan-v2";
import { DataGridStatusBadge } from "@/shared/datagrid/status-badge";
import { ActionButton, CompactInput, CompactSelect, CompactTextarea, FieldLabel, SectionCard } from "@/shared/ui/compact";
import { useSweetAlert } from "@/shared/ui/sweet-alert";
import {
  buildCreateJobPlanV2Payload,
  formatJobPlanV2Approval,
  formatJobPlanV2Execution,
  formatJobPlanV2Ledger,
  minutesToDuration,
  minutesToTime,
  resolveJobPlanV2Sync,
  toLocalDateValue,
  validateJobPlanV2Draft,
  type JobPlanV2PlannerDraft,
} from "@/modules/job-plan/job-plan-planner";
import { resolveCountdownPlanProgress } from "../countdown-job-plan";

interface EmployeeOption {
  label: string;
  value: string;
}

interface CountdownJobPlanSectionProps {
  countdown: CountdownDetail;
  userId: string;
  plans: JobPlanV2ReadItem[];
  isLoading: boolean;
  error: string | null;
  canManagePlan: boolean;
  employeeOptions: EmployeeOption[];
  onReload: () => void;
  onRequestEmployeeOptions: () => void;
}

function createDraft(countdown: CountdownDetail): JobPlanV2PlannerDraft {
  return {
    clientId: `countdown-${countdown.countdownId}`,
    isNew: true,
    coreId: countdown.countdownId,
    employeeId: "",
    taskDate: toLocalDateValue(),
    startTime: "08:00",
    durationText: countdown.remainingHours > 0 ? minutesToDuration(Math.round(countdown.remainingHours * 60)) : "01:00",
    jobDescription: countdown.jobTypeName ?? countdown.sectionName ?? countdown.unitName,
    note: "",
    isOvertime: false,
    isRework: false,
    isPriority: false,
    error: null,
  };
}

function PlanStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-mono text-[13px] tabular-nums text-foreground">{value}</p>
    </div>
  );
}

export function CountdownJobPlanSection({
  countdown,
  userId,
  plans,
  isLoading,
  error,
  canManagePlan,
  employeeOptions,
  onReload,
  onRequestEmployeeOptions,
}: CountdownJobPlanSectionProps) {
  const sweetAlert = useSweetAlert();
  const [draft, setDraft] = useState<JobPlanV2PlannerDraft | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);

  const employeeNameById = new Map(employeeOptions.map((option) => [option.value, option.label]));
  const actualEmployeeNameById = new Map(
    countdown.details
      .filter((detail) => detail.employeeId)
      .map((detail) => [String(detail.employeeId), detail.employeeName]),
  );

  function resolveEmployeeName(employeeId: string | null) {
    if (!employeeId) return "Belum ada PIC";
    return employeeNameById.get(employeeId) ?? actualEmployeeNameById.get(employeeId) ?? employeeId;
  }

  function openDraft() {
    setDraftError(null);
    setDraft(createDraft(countdown));
    if (employeeOptions.length === 0) onRequestEmployeeOptions();
  }

  async function submitDraft() {
    if (!draft || isSaving) return;
    const validation = validateJobPlanV2Draft(draft);
    if (validation) {
      setDraftError(validation);
      return;
    }

    setIsSaving(true);
    setDraftError(null);
    try {
      const result = await createJobPlanV2(
        buildCreateJobPlanV2Payload(draft, userId, createJobPlanV2CommandId("countdown-job-plan")),
      );
      if (!result.success) {
        setDraftError(result.message);
        return;
      }
      setDraft(null);
      onReload();
      sweetAlert.notifySuccess("Rencana tersimpan", "Job plan baru tercatat untuk countdown ini.");
    } catch {
      setDraftError("Job plan tidak bisa disimpan. Coba lagi sebentar.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div id="job-plan">
      {sweetAlert.alertElement}
      <SectionCard label="Rencana pekerjaan" count={plans.length}>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Memuat rencana pekerjaan…</p>
        ) : error ? (
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-destructive">
            <span>{error}</span>
            <ActionButton onClick={onReload}>Muat ulang</ActionButton>
          </div>
        ) : plans.length === 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[13px] text-foreground">{countdown.panelName ?? countdown.sectionName ?? countdown.unitName}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">Belum ada rencana pekerjaan untuk countdown ini.</p>
            </div>
            {canManagePlan ? (
              <ActionButton variant="primary" onClick={openDraft}>
                <Plus className="h-3 w-3" />Buat Job Plan
              </ActionButton>
            ) : null}
          </div>
        ) : (
          <div className="space-y-2">
            {plans.map((plan) => {
              const numbers = resolveCountdownPlanProgress(plan);
              const isExpanded = expandedPlanId === plan.plan_id;
              const sync = resolveJobPlanV2Sync(plan);
              return (
                <div key={plan.plan_id} className="border border-border dark:border-white/[0.06]">
                  <div className="flex flex-wrap items-start justify-between gap-2 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-foreground">
                        {plan.jobdescription ?? countdown.jobTypeName ?? countdown.sectionName ?? "-"}
                      </p>
                      <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                        {countdown.divisionName ?? "Tanpa divisi"} · {resolveEmployeeName(plan.employee_id)} · {plan.task_date}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {plan.is_overtime ? <DataGridStatusBadge value="OVERTIME" /> : null}
                      <DataGridStatusBadge value={plan.approval_state} />
                      <DataGridStatusBadge value={plan.execution_state} />
                      <button
                        type="button"
                        aria-expanded={isExpanded}
                        onClick={() => setExpandedPlanId(isExpanded ? null : plan.plan_id)}
                        className="inline-flex h-9 items-center gap-1.5 border border-border px-3 font-mono text-[12px] font-medium uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-white/[0.08] dark:text-foreground/60"
                      >
                        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                        Detail
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-2 border-t border-border px-3 py-2 sm:grid-cols-4 dark:border-white/[0.06]">
                    <PlanStat label="Rencana" value={minutesToDuration(numbers.plannedMinutes)} />
                    <PlanStat label="Aktual" value={minutesToDuration(numbers.workedMinutes)} />
                    <PlanStat label="Sisa" value={minutesToDuration(numbers.remainingMinutes)} />
                    <PlanStat label="Progress" value={`${numbers.percent}%`} />
                  </div>
                  <div className="h-1 overflow-hidden bg-muted">
                    <div
                      className="h-full bg-primary"
                      style={{ width: `${numbers.percent}%` }}
                      role="progressbar"
                      aria-label={`Progress ${plan.jobdescription ?? "job plan"}`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={numbers.percent}
                    />
                  </div>

                  {isExpanded ? (
                    <div className="grid gap-2 border-t border-border px-3 py-2 sm:grid-cols-3 dark:border-white/[0.06]">
                      <PlanStat label="Jadwal" value={`${minutesToTime(plan.planned_start_minute)} - ${minutesToTime(plan.planned_finish_minute)}`} />
                      <PlanStat label="Persetujuan" value={formatJobPlanV2Approval(plan.approval_state)} />
                      <PlanStat label="Pelaksanaan" value={formatJobPlanV2Execution(plan.execution_state)} />
                      <PlanStat label="Ledger" value={formatJobPlanV2Ledger(plan.ledger_state)} />
                      <PlanStat label="Sinkronisasi" value={sync} />
                      <PlanStat label="Nomor rencana" value={plan.plan_id} />
                      {plan.note ? <PlanStat label="Catatan" value={plan.note} /> : null}
                    </div>
                  ) : null}
                </div>
              );
            })}

            {canManagePlan ? (
              <div className="flex justify-end">
                <ActionButton variant="primary" onClick={openDraft} disabled={draft !== null}>
                  <Plus className="h-3 w-3" />Tambah Job Plan
                </ActionButton>
              </div>
            ) : null}
          </div>
        )}

        {draft ? (
          <div className="border border-primary/25 bg-primary/[0.03] p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[13px] font-semibold text-foreground">Tambah Job Plan</p>
              <ActionButton onClick={() => setDraft(null)} disabled={isSaving}>
                <X className="h-3 w-3" />Batal
              </ActionButton>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <FieldLabel required>Tanggal</FieldLabel>
                <CompactInput
                  aria-label="Tanggal rencana"
                  type="date"
                  value={draft.taskDate}
                  onChange={(event) => setDraft({ ...draft, taskDate: event.target.value })}
                />
              </div>
              <div>
                <FieldLabel required>Jam mulai</FieldLabel>
                <CompactInput
                  aria-label="Jam mulai rencana"
                  type="time"
                  value={draft.startTime}
                  onChange={(event) => setDraft({ ...draft, startTime: event.target.value })}
                />
              </div>
              <div>
                <FieldLabel required>Divisi</FieldLabel>
                <CompactInput aria-label="Divisi" value={countdown.divisionName ?? "Tanpa divisi"} disabled />
              </div>
              <div>
                <FieldLabel required>Estimasi jam</FieldLabel>
                <CompactInput
                  aria-label="Estimasi jam"
                  placeholder="08:00"
                  value={draft.durationText}
                  onChange={(event) => setDraft({ ...draft, durationText: event.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <FieldLabel required>PIC</FieldLabel>
                <CompactSelect
                  aria-label="PIC"
                  value={draft.employeeId}
                  disabled={employeeOptions.length === 0}
                  onChange={(event) => setDraft({ ...draft, employeeId: event.target.value })}
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
              <div className="sm:col-span-2">
                <FieldLabel required>Jobdesc</FieldLabel>
                <CompactInput
                  aria-label="Jobdesc"
                  value={draft.jobDescription}
                  onChange={(event) => setDraft({ ...draft, jobDescription: event.target.value })}
                />
              </div>
              <div className="sm:col-span-2 lg:col-span-4">
                <FieldLabel>Catatan</FieldLabel>
                <CompactTextarea
                  aria-label="Catatan rencana"
                  rows={2}
                  maxLength={1000}
                  value={draft.note}
                  onChange={(event) => setDraft({ ...draft, note: event.target.value })}
                />
              </div>
            </div>
            {draftError ? <p className="mt-2 text-[12px] text-destructive">{draftError}</p> : null}
            <div className="mt-3 flex justify-end gap-1.5 border-t border-border pt-3 dark:border-white/[0.06]">
              <ActionButton onClick={() => setDraft(null)} disabled={isSaving}>Batal</ActionButton>
              <ActionButton variant="primary" onClick={() => void submitDraft()} disabled={isSaving}>
                <Plus className="h-3 w-3" />{isSaving ? "Menyimpan…" : "Simpan"}
              </ActionButton>
            </div>
          </div>
        ) : null}
      </SectionCard>
    </div>
  );
}
