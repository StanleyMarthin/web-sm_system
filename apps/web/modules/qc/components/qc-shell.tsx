"use client";

import type {
  QcFinalChecklist,
  QcFinalChecklistItem,
  QcGridQuery,
  QcPassRequest,
  QcQueueRecord,
  QcReferences,
  QcRejectRequest,
  QcSummary,
} from "@smsystem/contracts/qc";
import type { GridFilter } from "@smsystem/contracts/grid";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  RefreshCcw,
  ShieldCheck,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  approveQcFinalChecklist,
  passQc,
  rejectQc,
} from "@/shared/api/qc";
import { humanizeCodeLabel } from "@/shared/format/humanize";
import { SmartDataGrid } from "@/shared/datagrid/smart-data-grid";
import type {
  SmartDataGridColumn,
  SmartDataGridFilterDefinition,
  SmartDataGridSavedView,
  SmartDataGridSortOption,
} from "@/shared/datagrid/types";

type QcTab = "ready" | "rework" | "recheck";

interface QcShellProps {
  activeTab: QcTab;
  rows: QcQueueRecord[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  state: QcGridQuery;
  references: QcReferences;
  summary: QcSummary;
  detail: QcQueueRecord | null;
  finalChecklist: {
    checklist: QcFinalChecklist;
    items: QcFinalChecklistItem[];
  } | null;
  canSubmit: boolean;
  canValidate: boolean;
}

interface PassFormState {
  notes: string;
  inspectionDurationMinutes: string;
  photoBeforeUrl: string;
  evidencePhotoUrl: string;
}

interface RejectFormState extends PassFormState {
  reworkDate: string;
  reworkAssignedUser: string;
  reworkDailyHours: string;
  reworkStartTime: string;
  reworkFinishTime: string;
  reworkDescription: string;
  reworkIsOvertime: boolean;
  reworkIsPriority: boolean;
}

function SummaryCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5">
      <p className="text-[10px] uppercase tracking-[0.18em] text-foreground/35">{label}</p>
      <p className="mt-3 text-lg text-foreground">{value}</p>
      <p className="mt-2 text-sm text-foreground/40">{helper}</p>
    </div>
  );
}

function emptyPassForm(detail: QcQueueRecord | null): PassFormState {
  return {
    notes: detail?.latestInspectionNotes ?? "",
    inspectionDurationMinutes: "",
    photoBeforeUrl: detail?.photoBeforeUrl ?? "",
    evidencePhotoUrl: detail?.evidencePhotoUrl ?? "",
  };
}

function emptyRejectForm(detail: QcQueueRecord | null): RejectFormState {
  const today = new Date().toISOString().slice(0, 10);
  return {
    ...emptyPassForm(detail),
    reworkDate: detail?.deadlineDate ?? today,
    reworkAssignedUser: detail?.reworkAssignedUserId ?? "",
    reworkDailyHours: "03:00",
    reworkStartTime: "08:00",
    reworkFinishTime: "11:00",
    reworkDescription: "",
    reworkIsOvertime: false,
    reworkIsPriority: true,
  };
}

const sortOptions: SmartDataGridSortOption[] = [
  { label: "Menunggu", value: "waitingHours" },
  { label: "Unit", value: "unitName" },
  { label: "Divisi", value: "divisionName" },
  { label: "Panel", value: "panelName" },
  { label: "Status", value: "countdownStatus" },
  { label: "Level QC", value: "qcLevel" },
  { label: "Deadline", value: "deadlineDate" },
  { label: "QC Terakhir", value: "latestInspectionDate" },
];

const savedViews: SmartDataGridSavedView[] = [
  {
    id: "ready-qc",
    label: "Siap QC",
    sortBy: "waitingHours",
    sortDirection: "desc",
    filters: [],
  },
  {
    id: "reject-only",
    label: "Tolak",
    sortBy: "latestInspectionDate",
    sortDirection: "desc",
    filters: [
      {
        field: "status",
        operator: "eq",
        value: "TIDAK_LOLOS",
      } satisfies GridFilter,
    ],
  },
  {
    id: "high-wait",
    label: "Aging",
    sortBy: "waitingHours",
    sortDirection: "desc",
    filters: [],
  },
];

export function QcShell({
  activeTab,
  rows,
  meta,
  state,
  references,
  summary,
  detail,
  finalChecklist,
  canSubmit,
  canValidate,
}: QcShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [passForm, setPassForm] = useState<PassFormState>(emptyPassForm(detail));
  const [rejectForm, setRejectForm] = useState<RejectFormState>(emptyRejectForm(detail));
  const [finalNotes, setFinalNotes] = useState(finalChecklist?.checklist.notes ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPassForm(emptyPassForm(detail));
    setRejectForm(emptyRejectForm(detail));
  }, [detail]);

  useEffect(() => {
    setFinalNotes(finalChecklist?.checklist.notes ?? "");
  }, [finalChecklist?.checklist.carId, finalChecklist?.checklist.notes]);

  const filters: SmartDataGridFilterDefinition[] = [
    {
      field: "divisionId",
      label: "Divisi",
      options: references.divisions,
    },
    {
      field: "carId",
      label: "Unit",
      options: references.units,
    },
    {
      field: "status",
      label: "Status",
      options: references.statuses,
    },
    {
      field: "qcLevel",
      label: "Level QC",
      options: references.qcLevels,
    },
  ];

  function pushParams(mutator: (params: URLSearchParams) => void) {
    const nextParams = new URLSearchParams(searchParams.toString());
    mutator(nextParams);
    nextParams.set("tab", activeTab);
    router.push(`${pathname}?${nextParams.toString()}`);
  }

  const columns: SmartDataGridColumn[] = [
    {
      key: "coreId",
      label: "Core ID",
      kind: "mono",
      sticky: true,
      renderCell: (value, row) => (
        <button
          type="button"
          onClick={() => {
            pushParams((params) => {
              params.set("coreId", String(row.coreId));
              params.set("carId", String(row.carId));
            });
          }}
          className="text-app-accent-ink transition-colors hover:text-app-accent-ink"
        >
          {String(value)}
        </button>
      ),
    },
    {
      key: "unitName",
      label: "Unit",
      filterKey: "carId",
      filterOptions: references.units,
    },
    {
      key: "divisionName",
      label: "Divisi",
      filterKey: "divisionId",
      filterOptions: references.divisions,
    },
    {
      key: "panelName",
      label: "Panel",
    },
    {
      key: "jobName",
      label: "Job",
      filterKey: "jobName",
    },
    {
      key: "countdownStatus",
      label: "Countdown",
      kind: "status",
      filterKey: "status",
      filterOptions: references.statuses,
    },
    {
      key: "qcLastStatus",
      label: "QC Result",
      kind: "status",
    },
    {
      key: "reworkPlanStatus",
      label: "Rework Plan",
      kind: "status",
    },
    {
      key: "waitingHours",
      label: "Waiting",
      kind: "number",
      align: "right",
    },
  ];

  async function handlePass() {
    if (!detail) {
      return;
    }

    setIsSubmitting(true);
    setMessage(null);
    setError(null);

    try {
      const payload: QcPassRequest = {
        notes: passForm.notes.trim() || null,
        inspectionDurationMinutes: passForm.inspectionDurationMinutes
          ? Number.parseInt(passForm.inspectionDurationMinutes, 10)
          : null,
        photoBeforeUrl: passForm.photoBeforeUrl.trim() || null,
        evidencePhotoUrl: passForm.evidencePhotoUrl.trim() || null,
      };
      const result = await passQc(detail.coreId, payload);
      if (!result.success) {
        setError(result.message);
        return;
      }

      setMessage("QC pass berhasil disimpan.");
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleReject() {
    if (!detail) {
      return;
    }

    if (!rejectForm.reworkDate || !rejectForm.reworkAssignedUser.trim()) {
      setError("Tanggal dan PIC rework wajib diisi.");
      return;
    }

    setIsSubmitting(true);
    setMessage(null);
    setError(null);

    try {
      const payload: QcRejectRequest = {
        notes: rejectForm.notes.trim() || null,
        inspectionDurationMinutes: rejectForm.inspectionDurationMinutes
          ? Number.parseInt(rejectForm.inspectionDurationMinutes, 10)
          : null,
        photoBeforeUrl: rejectForm.photoBeforeUrl.trim() || null,
        evidencePhotoUrl: rejectForm.evidencePhotoUrl.trim() || null,
        reworkDate: rejectForm.reworkDate,
        reworkAssignedUser: rejectForm.reworkAssignedUser.trim(),
        reworkDailyHours: rejectForm.reworkDailyHours,
        reworkStartTime: rejectForm.reworkStartTime || null,
        reworkFinishTime: rejectForm.reworkFinishTime || null,
        reworkDescription: rejectForm.reworkDescription.trim() || null,
        reworkIsOvertime: rejectForm.reworkIsOvertime,
        reworkIsPriority: rejectForm.reworkIsPriority,
      };
      const result = await rejectQc(detail.coreId, payload);
      if (!result.success) {
        setError(result.message);
        return;
      }

      setMessage("QC reject berhasil disimpan dan rework dibuat.");
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleApproveFinal() {
    if (!finalChecklist) {
      return;
    }

    setIsSubmitting(true);
    setMessage(null);
    setError(null);

    try {
      const result = await approveQcFinalChecklist(finalChecklist.checklist.carId, {
        notes: finalNotes.trim() || null,
      });
      if (!result.success) {
        setError(result.message);
        return;
      }

      setMessage("Final checklist delivery approved.");
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  const tabConfig: Array<{ id: QcTab; label: string }> = [
    { id: "ready", label: "Siap QC" },
    { id: "rework", label: "Rework" },
    { id: "recheck", label: "QC Ulang" },
  ];

  const selectedUnitLabel =
    finalChecklist?.checklist.unitName ?? detail?.unitName ?? "Belum ada unit dipilih";

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Antrian Siap QC"
          value={String(summary.readyCount)}
          helper="Task yang masuk antrian QC awal."
        />
        <SummaryCard
          label="Antrian QC Ulang"
          value={String(summary.recheckCount)}
          helper="Task reject yang selesai rework dan siap dicek ulang."
        />
        <SummaryCard
          label="Rework Aktif"
          value={String(summary.activeReworkCount)}
          helper="Task reject yang masih berjalan di rework plan."
        />
        <SummaryCard
          label="Siap Kirim"
          value={String(summary.finalReadyUnits)}
          helper="Unit yang siap final checklist delivery."
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.18fr)_minmax(360px,0.82fr)]">
        <div className="space-y-6">
          <div className="rounded-[28px] border border-white/[0.06] bg-card p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-app-accent-ink/70">
                  QC Center
                </p>
                <h1 className="mt-1 text-xl font-medium text-foreground">Antrian Operasional</h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-foreground/45">
                  Queue QC dibedakan menjadi antrian awal, task rework aktif, dan task yang siap
                  QC ulang. Semua list tetap server-side dan scope mengikuti permission user aktif.
                </p>
              </div>

              <button
                type="button"
                onClick={() => router.refresh()}
                className="inline-flex items-center gap-2 rounded-full bg-white/[0.03] px-3 py-1.5 text-[11px] uppercase tracking-[0.16em] text-foreground/55 ring-1 ring-white/[0.06] hover:text-foreground/80"
              >
                <RefreshCcw className="h-3.5 w-3.5" />
                Muat Ulang
              </button>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              {tabConfig.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    pushParams((params) => {
                      params.set("tab", tab.id);
                      params.set("page", "1");
                    });
                  }}
                  className={[
                    "rounded-full px-3 py-1.5 text-[11px] uppercase tracking-[0.16em] transition-colors",
                    activeTab === tab.id
                      ? "bg-primary/12 text-app-accent-ink ring-1 ring-primary/30"
                      : "bg-white/[0.03] text-foreground/40 ring-1 ring-white/[0.06] hover:text-foreground/70",
                  ].join(" ")}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <SmartDataGrid
        viewportClassName="max-h-[calc(100svh-260px)]"
            title={
              activeTab === "ready"
                ? "Siap QC"
                : activeTab === "rework"
                  ? "Antrian Rework"
                  : "QC Ulang"
            }
            description={
              activeTab === "ready"
                ? "Task yang sudah mencapai 100% dan menunggu hasil inspeksi QC."
                : activeTab === "rework"
                  ? "Task reject yang sudah dijadwalkan ke job plan rework."
                  : "Task reject yang siap diuji ulang oleh QC."
            }
            columns={columns}
            rows={rows}
            meta={meta}
            state={state}
            filters={filters}
            sortOptions={sortOptions}
            savedViews={savedViews}
            searchPlaceholder="Cari unit, panel, job, atau divisi..."
            emptyMessage="Belum ada data QC pada scope query saat ini."
            headerActions={
              <div className="inline-flex items-center gap-2 rounded-full bg-white/[0.03] px-3 py-1.5 text-[11px] uppercase tracking-[0.16em] text-foreground/50 ring-1 ring-white/[0.06]">
                <ShieldCheck className="h-3.5 w-3.5" />
                {selectedUnitLabel}
              </div>
            }
          />
        </div>

        <div className="space-y-6">
          <div className="rounded-[28px] border border-white/[0.06] bg-card p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
                <ClipboardCheck className="h-5 w-5 text-app-accent-ink" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-app-accent-ink/70">
                  QC Detail
                </p>
                <h2 className="mt-1 text-lg font-medium text-foreground">
                  {detail ? detail.jobName : "Pilih item QC"}
                </h2>
              </div>
            </div>

            {!detail ? (
              <div className="mt-5 rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.02] px-4 py-5 text-sm text-foreground/35">
                Klik `coreId` pada grid untuk membuka detail inspeksi dan final checklist unit.
              </div>
            ) : (
              <div className="mt-5 space-y-5">
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 text-sm text-foreground/60">
                  <p>Unit: {detail.unitName}</p>
                  <p>Divisi: {detail.divisionName ?? "-"}</p>
                  <p>Panel: {detail.panelName ?? "-"}</p>
                  <p>Countdown: {humanizeCodeLabel(detail.countdownStatus)}</p>
                  <p>QC Terakhir: {detail.qcLastStatus ? humanizeCodeLabel(detail.qcLastStatus) : "-"}</p>
                  <p>Issue Terbuka: {detail.openIssueCount}</p>
                  <p>Rencana Rework: {detail.reworkPlanId ?? "-"}</p>
                </div>

                <div className="space-y-3">
                  <input
                    value={passForm.notes}
                    onChange={(event) =>
                      setPassForm((current) => ({ ...current, notes: event.target.value }))
                    }
                    placeholder="Catatan QC"
                    className="h-11 w-full rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 text-sm text-foreground outline-none focus:border-primary/30"
                  />
                  <div className="grid gap-3 md:grid-cols-2">
                    <input
                      value={passForm.inspectionDurationMinutes}
                      onChange={(event) =>
                        setPassForm((current) => ({
                          ...current,
                          inspectionDurationMinutes: event.target.value,
                        }))
                      }
                      placeholder="Durasi inspeksi (menit)"
                      className="h-11 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 text-sm text-foreground outline-none focus:border-primary/30"
                    />
                    <input
                      value={passForm.photoBeforeUrl}
                      onChange={(event) =>
                        setPassForm((current) => ({ ...current, photoBeforeUrl: event.target.value }))
                      }
                      placeholder="Tautan foto sebelum"
                      className="h-11 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 text-sm text-foreground outline-none focus:border-primary/30"
                    />
                  </div>
                  <input
                    value={passForm.evidencePhotoUrl}
                    onChange={(event) =>
                      setPassForm((current) => ({ ...current, evidencePhotoUrl: event.target.value }))
                    }
                    placeholder="Tautan foto bukti"
                    className="h-11 w-full rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 text-sm text-foreground outline-none focus:border-primary/30"
                  />
                </div>

                {canSubmit && activeTab !== "rework" ? (
                  <div className="grid gap-4 xl:grid-cols-2">
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => void handlePass()}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary disabled:opacity-60"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Lolos QC
                    </button>

                    <div className="space-y-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
                      <p className="text-sm text-foreground">Tolak dan buat rework</p>
                      <input
                        value={rejectForm.reworkDate}
                        onChange={(event) =>
                          setRejectForm((current) => ({ ...current, reworkDate: event.target.value }))
                        }
                        type="date"
                        className="h-11 w-full rounded-2xl border border-white/[0.06] bg-black/40 px-3 text-sm text-foreground outline-none focus:border-primary/30"
                      />
                      <input
                        value={rejectForm.reworkAssignedUser}
                        onChange={(event) =>
                          setRejectForm((current) => ({
                            ...current,
                            reworkAssignedUser: event.target.value,
                          }))
                        }
                        placeholder="PIC rework (ID pegawai)"
                        className="h-11 w-full rounded-2xl border border-white/[0.06] bg-black/40 px-3 text-sm text-foreground outline-none focus:border-primary/30"
                      />
                      <div className="grid gap-3 md:grid-cols-3">
                        <input
                          value={rejectForm.reworkDailyHours}
                          onChange={(event) =>
                            setRejectForm((current) => ({
                              ...current,
                              reworkDailyHours: event.target.value,
                            }))
                          }
                          placeholder="HH:MM"
                          className="h-11 rounded-2xl border border-white/[0.06] bg-black/40 px-3 text-sm text-foreground outline-none focus:border-primary/30"
                        />
                        <input
                          value={rejectForm.reworkStartTime}
                          onChange={(event) =>
                            setRejectForm((current) => ({
                              ...current,
                              reworkStartTime: event.target.value,
                            }))
                          }
                          placeholder="Mulai"
                          className="h-11 rounded-2xl border border-white/[0.06] bg-black/40 px-3 text-sm text-foreground outline-none focus:border-primary/30"
                        />
                        <input
                          value={rejectForm.reworkFinishTime}
                          onChange={(event) =>
                            setRejectForm((current) => ({
                              ...current,
                              reworkFinishTime: event.target.value,
                            }))
                          }
                          placeholder="Selesai"
                          className="h-11 rounded-2xl border border-white/[0.06] bg-black/40 px-3 text-sm text-foreground outline-none focus:border-primary/30"
                        />
                      </div>
                      <textarea
                        value={rejectForm.reworkDescription}
                        onChange={(event) =>
                          setRejectForm((current) => ({
                            ...current,
                            reworkDescription: event.target.value,
                          }))
                        }
                        rows={3}
                        placeholder="Deskripsi rework"
                        className="w-full rounded-2xl border border-white/[0.06] bg-black/40 px-3 py-3 text-sm text-foreground outline-none placeholder:text-foreground/20 focus:border-primary/30"
                      />
                      <div className="grid gap-2 md:grid-cols-2">
                        <label className="flex items-center gap-2 text-sm text-foreground/65">
                          <input
                            type="checkbox"
                            checked={rejectForm.reworkIsPriority}
                            onChange={(event) =>
                              setRejectForm((current) => ({
                                ...current,
                                reworkIsPriority: event.target.checked,
                              }))
                            }
                          />
                          Prioritas
                        </label>
                        <label className="flex items-center gap-2 text-sm text-foreground/65">
                          <input
                            type="checkbox"
                            checked={rejectForm.reworkIsOvertime}
                            onChange={(event) =>
                              setRejectForm((current) => ({
                                ...current,
                                reworkIsOvertime: event.target.checked,
                              }))
                            }
                          />
                          Lembur
                        </label>
                      </div>
                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => void handleReject()}
                        className="inline-flex h-11 items-center justify-center rounded-2xl border border-destructive/20 bg-destructive/10 px-4 text-sm text-destructive transition-colors hover:bg-destructive/15 disabled:opacity-60"
                      >
                        Tolak + Rework
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.02] px-4 py-5 text-sm text-foreground/35">
                    Aksi kirim QC hanya tersedia pada tab Siap QC dan QC Ulang.
                  </p>
                )}

                {detail.linkedIssueId ? (
                  <button
                    type="button"
                    onClick={() => router.push(`/issues/${detail.linkedIssueId}`)}
                    className="inline-flex h-11 items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 text-sm text-foreground/75 hover:text-foreground"
                  >
                    Buka Issue Terkait
                  </button>
                ) : null}
              </div>
            )}
          </div>

          <div className="rounded-[28px] border border-white/[0.06] bg-card p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
                <AlertTriangle className="h-5 w-5 text-app-accent-ink" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-app-accent-ink/70">
                  Final Checklist
                </p>
                <h2 className="mt-1 text-lg font-medium text-foreground">{selectedUnitLabel}</h2>
              </div>
            </div>

            {!finalChecklist ? (
              <div className="mt-5 rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.02] px-4 py-5 text-sm text-foreground/35">
                Pilih item grid untuk memuat readiness per unit dan status final delivery.
              </div>
            ) : (
              <div className="mt-5 space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <SummaryCard
                    label="Task Lolos"
                    value={`${finalChecklist.checklist.passedTasks}/${finalChecklist.checklist.totalTasks}`}
                    helper="Task countdown yang sudah DONE + LOLOS."
                  />
                  <SummaryCard
                    label="Issue Terbuka"
                    value={String(finalChecklist.checklist.openIssueCount)}
                    helper="Issue open akan memblok delivery readiness."
                  />
                </div>

                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 text-sm text-foreground/60">
                  <p>Customer: {finalChecklist.checklist.customerName ?? "-"}</p>
                  <p>Target Delivery: {finalChecklist.checklist.targetDeliveryDate ?? "-"}</p>
                  <p>Disetujui pada: {finalChecklist.checklist.approvedAt ?? "-"}</p>
                  <p>Disetujui oleh: {finalChecklist.checklist.approvedBy ?? "-"}</p>
                  <p>
                    Siap kirim:
                    {" "}
                    <span
                      className={
                        finalChecklist.checklist.isReadyForDelivery
                          ? "text-success"
                          : "text-destructive"
                      }
                    >
                      {finalChecklist.checklist.isReadyForDelivery ? "Ya" : "Tidak"}
                    </span>
                  </p>
                </div>

                <div className="space-y-3">
                  {finalChecklist.items.map((item) => (
                    <div
                      key={item.coreId}
                      className="rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="font-mono text-xs text-app-accent-ink">{item.coreId}</p>
                          <p className="mt-2 text-sm text-foreground">{item.jobName}</p>
                          <p className="mt-1 text-sm text-foreground/45">
                            {item.divisionName ?? "-"} · {item.panelName ?? "-"}
                          </p>
                        </div>
                        <div className="text-right text-xs text-foreground/45">
                          <p>{humanizeCodeLabel(item.countdownStatus)}</p>
                          <p>{item.qcLastStatus ? humanizeCodeLabel(item.qcLastStatus) : "-"}</p>
                          <p>{item.issueStatus ? humanizeCodeLabel(item.issueStatus) : "-"}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {canValidate ? (
                  <div className="space-y-3">
                    <textarea
                      value={finalNotes}
                      onChange={(event) => setFinalNotes(event.target.value)}
                      rows={3}
                      placeholder="Catatan final kesiapan kirim"
                      className="w-full rounded-2xl border border-white/[0.06] bg-black/40 px-3 py-3 text-sm text-foreground outline-none placeholder:text-foreground/20 focus:border-primary/30"
                    />
                    <button
                      type="button"
                      disabled={isSubmitting || !finalChecklist.checklist.isReadyForDelivery}
                      onClick={() => void handleApproveFinal()}
                      className="inline-flex h-11 items-center justify-center rounded-2xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary disabled:opacity-60"
                    >
                      Setujui Kesiapan Kirim
                    </button>
                  </div>
                ) : null}
              </div>
            )}
          </div>

          {message ? <p className="text-sm text-success">{message}</p> : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
      </section>
    </div>
  );
}
