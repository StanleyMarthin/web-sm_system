"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { CheckSquare, Loader2, RefreshCcw, X } from "lucide-react";

import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { DarkCard } from "@/components/ui/dark-card";
import { useAuthStore } from "@/features/auth/stores/auth-store";
import { SERIF_STYLE } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { getCountdownPlanAssignees, type CountdownEmployeeOption } from "@/features/countdown/services/countdown-service";
import {
  getQcDivisions,
  getQcItems,
  submitQc,
  type QcItem,
} from "@/features/operational/services/qc-service";

type NoticeTone = "success" | "error";

interface NoticeState {
  tone: NoticeTone;
  message: string;
}

function formatDateLabel(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatHours(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(1)} jam`;
}

function currentDateInput(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function statusBadge(status: string) {
  const upper = status.toUpperCase();
  if (upper === "READY_QC") return "border-amber-500/25 bg-amber-500/10 text-amber-200";
  if (upper === "DONE") return "border-emerald-500/25 bg-emerald-500/10 text-emerald-200";
  return "border-white/10 bg-white/[0.04] text-white/60";
}

function qcLevelLabel(level: string | null | undefined): string {
  if (!level) return "Belum QC";
  return level.replace("QC_", "QC ");
}

function lastQcTone(status: string | null | undefined): string {
  const upper = (status || "").toUpperCase();
  if (upper === "LOLOS") return "text-emerald-300";
  if (upper === "TIDAK_LOLOS") return "text-rose-300";
  return "text-white/35";
}

function SelectField({
  label,
  value,
  onChange,
  options,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] uppercase tracking-[0.16em] text-white/35">{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white/80 outline-none transition focus:border-amber-500/40 disabled:cursor-not-allowed disabled:opacity-45"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function NoticeBar({ notice, onDismiss }: { notice: NoticeState; onDismiss: () => void }) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm",
        notice.tone === "success"
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
          : "border-rose-500/30 bg-rose-500/10 text-rose-100",
      )}
    >
      <span>{notice.message}</span>
      <button
        type="button"
        onClick={onDismiss}
        className="rounded-md p-1 text-current/70 transition hover:bg-black/10 hover:text-current"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function SubmitQcModal({
  item,
  action,
  userId,
  onClose,
  onSuccess,
}: {
  item: QcItem;
  action: "lolos" | "tidak_lolos";
  userId: string;
  onClose: () => void;
  onSuccess: (message: string) => void;
}) {
  const [notes, setNotes] = useState("");
  const [inspectionDuration, setInspectionDuration] = useState("30");
  const [reworkDate, setReworkDate] = useState(currentDateInput());
  const [reworkAssignedUser, setReworkAssignedUser] = useState("");
  const [reworkDailyHours, setReworkDailyHours] = useState("07:00");
  const [reworkStartTime, setReworkStartTime] = useState("07:00");
  const [reworkFinishTime, setReworkFinishTime] = useState("16:00");
  const [reworkDescription, setReworkDescription] = useState(item.jobName || item.taskCategory);
  const [reworkIsOvertime, setReworkIsOvertime] = useState(false);
  const [reworkIsPriority, setReworkIsPriority] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: assignees = [], isLoading: assigneeLoading } = useSWR<CountdownEmployeeOption[]>(
    action === "tidak_lolos" ? ["qc-rework-assignees", item.divisionId] : null,
    () => getCountdownPlanAssignees(item.divisionId),
    { revalidateOnFocus: false },
  );

  async function handleSubmit() {
    if (action === "tidak_lolos") {
      if (!reworkDate || !reworkAssignedUser || !reworkDailyHours.trim()) {
        setError("Tanggal rework, pelaksana, dan jam kerja rework wajib diisi.");
        return;
      }
    }

    setSaving(true);
    setError(null);

    try {
      await submitQc({
        userId,
        coreId: item.coreId,
        action,
        notes: notes.trim() || undefined,
        inspectionDurationMinutes: inspectionDuration ? Number(inspectionDuration) : undefined,
        reworkDate: action === "tidak_lolos" ? reworkDate : undefined,
        reworkAssignedUser: action === "tidak_lolos" ? reworkAssignedUser : undefined,
        reworkDailyHours: action === "tidak_lolos" ? reworkDailyHours.trim() : undefined,
        reworkStartTime: action === "tidak_lolos" ? reworkStartTime : undefined,
        reworkFinishTime: action === "tidak_lolos" ? reworkFinishTime : undefined,
        reworkDescription: action === "tidak_lolos" ? reworkDescription.trim() || undefined : undefined,
        reworkIsOvertime: action === "tidak_lolos" ? reworkIsOvertime : undefined,
        reworkIsPriority: action === "tidak_lolos" ? reworkIsPriority : undefined,
      });
      onSuccess(action === "lolos" ? "QC berhasil disubmit sebagai LOLOS." : "QC berhasil disubmit dan rework dijadwalkan.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Gagal submit QC.");
      setSaving(false);
      return;
    }

    setSaving(false);
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="max-h-[92vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-[#0d0d0d] shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-white/[0.06] px-5 py-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/35">Submit QC</p>
            <h3 className="mt-2 text-lg font-medium text-white/90" style={SERIF_STYLE}>
              {action === "lolos" ? "QC Lolos" : "QC Tidak Lolos"}
            </h3>
            <p className="mt-2 text-sm text-white/45">
              {item.unitName} • {item.panelName || "-"} • {item.jobName || item.taskCategory}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 p-2 text-white/45 transition hover:border-white/20 hover:text-white/80"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[calc(92vh-84px)] overflow-y-auto px-5 py-5">
          <div className="grid gap-4 md:grid-cols-2">
            <DarkCard className="p-4">
              <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">Status Countdown</p>
              <p className="mt-3 text-sm font-medium text-white/85">{item.status}</p>
              <p className="mt-1 text-xs text-white/40">{qcLevelLabel(item.qcLevel)}</p>
            </DarkCard>
            <DarkCard className="p-4">
              <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">Sisa / Deadline</p>
              <p className="mt-3 text-sm font-medium text-white/85">{formatHours(item.remainingHours)}</p>
              <p className="mt-1 text-xs text-white/40">{formatDateLabel(item.deadlineDate)}</p>
            </DarkCard>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.16em] text-white/40">
                Durasi QC (menit)
              </label>
              <input
                type="number"
                min={1}
                value={inspectionDuration}
                onChange={(event) => setInspectionDuration(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white/80 outline-none transition focus:border-amber-500/40"
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.16em] text-white/40">
              Catatan QC
            </label>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              placeholder="Catatan hasil inspeksi..."
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white/80 outline-none transition focus:border-amber-500/40"
            />
          </div>

          {action === "tidak_lolos" ? (
            <div className="mt-6 space-y-4 rounded-2xl border border-orange-500/20 bg-orange-500/10 p-4">
              <div>
                <h4 className="text-sm font-semibold text-orange-100">Jadwal Rework</h4>
                <p className="mt-1 text-xs text-orange-100/70">Web membuat rework plan baru seperti alur QC mobile.</p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.16em] text-orange-100/75">
                    Tanggal Rework
                  </label>
                  <input
                    type="date"
                    value={reworkDate}
                    onChange={(event) => setReworkDate(event.target.value)}
                    style={{ colorScheme: "dark" }}
                    className="w-full rounded-xl border border-white/10 bg-black/10 px-3 py-2.5 text-sm text-white/80 outline-none transition focus:border-orange-400/40"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.16em] text-orange-100/75">
                    Pelaksana Rework
                  </label>
                  <select
                    value={reworkAssignedUser}
                    onChange={(event) => setReworkAssignedUser(event.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-black/10 px-3 py-2.5 text-sm text-white/80 outline-none transition focus:border-orange-400/40"
                  >
                    <option value="">Pilih pelaksana</option>
                    {assignees.map((assignee) => (
                      <option key={assignee.id} value={assignee.id}>
                        {assignee.name}{assignee.grade ? ` • ${assignee.grade}` : ""}
                      </option>
                    ))}
                  </select>
                  {assigneeLoading ? <p className="mt-1 text-xs text-orange-100/60">Mengambil pelaksana...</p> : null}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.16em] text-orange-100/75">
                    Jam Rework
                  </label>
                  <input
                    value={reworkDailyHours}
                    onChange={(event) => setReworkDailyHours(event.target.value)}
                    placeholder="07:00"
                    className="w-full rounded-xl border border-white/10 bg-black/10 px-3 py-2.5 text-sm text-white/80 outline-none transition focus:border-orange-400/40"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.16em] text-orange-100/75">
                    Mulai
                  </label>
                  <input
                    type="time"
                    value={reworkStartTime}
                    onChange={(event) => setReworkStartTime(event.target.value)}
                    style={{ colorScheme: "dark" }}
                    className="w-full rounded-xl border border-white/10 bg-black/10 px-3 py-2.5 text-sm text-white/80 outline-none transition focus:border-orange-400/40"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.16em] text-orange-100/75">
                    Selesai
                  </label>
                  <input
                    type="time"
                    value={reworkFinishTime}
                    onChange={(event) => setReworkFinishTime(event.target.value)}
                    style={{ colorScheme: "dark" }}
                    className="w-full rounded-xl border border-white/10 bg-black/10 px-3 py-2.5 text-sm text-white/80 outline-none transition focus:border-orange-400/40"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.16em] text-orange-100/75">
                  Deskripsi Rework
                </label>
                <textarea
                  value={reworkDescription}
                  onChange={(event) => setReworkDescription(event.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-white/10 bg-black/10 px-3 py-2.5 text-sm text-white/80 outline-none transition focus:border-orange-400/40"
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/10 px-4 py-3 text-sm text-white/75">
                  <input
                    type="checkbox"
                    checked={reworkIsOvertime}
                    onChange={(event) => setReworkIsOvertime(event.target.checked)}
                    className="h-4 w-4 accent-orange-400"
                  />
                  <span>Rework lembur</span>
                </label>
                <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/10 px-4 py-3 text-sm text-white/75">
                  <input
                    type="checkbox"
                    checked={reworkIsPriority}
                    onChange={(event) => setReworkIsPriority(event.target.checked)}
                    className="h-4 w-4 accent-orange-400"
                  />
                  <span>Rework prioritas</span>
                </label>
              </div>
            </div>
          ) : null}

          {error ? (
            <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              {error}
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 border-t border-white/[0.06] px-5 py-4 sm:flex-row">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-white/10 px-4 py-3 text-sm text-white/55 transition hover:border-white/20 hover:text-white/80"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className={cn(
              "flex-1 rounded-xl border px-4 py-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
              action === "lolos"
                ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/20"
                : "border-orange-500/30 bg-orange-500/15 text-orange-200 hover:bg-orange-500/20",
            )}
          >
            {saving ? "Memproses..." : action === "lolos" ? "Submit QC Lolos" : "Submit QC Tidak Lolos"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function QcPageClient() {
  const user = useAuthStore((state) => state.user);
  const [selectedDivisionId, setSelectedDivisionId] = useState("");
  const [selectedUnitId, setSelectedUnitId] = useState("all");
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [submitTarget, setSubmitTarget] = useState<{ item: QcItem; action: "lolos" | "tidak_lolos" } | null>(null);

  const {
    data: divisionData,
    isLoading: divisionLoading,
    mutate: mutateDivisions,
  } = useSWR(
    user ? ["op-qc-divisions", user.userId] : null,
    () => getQcDivisions(user!.userId),
    { revalidateOnFocus: false },
  );

  const divisions = divisionData?.divisions || [];
  const effectiveDivisionId = selectedDivisionId || divisions[0]?.divisionId || "";

  const {
    data: itemData,
    isLoading: itemLoading,
    mutate: mutateItems,
  } = useSWR(
    user && effectiveDivisionId
      ? ["op-qc-items", user.userId, effectiveDivisionId]
      : null,
    () => getQcItems({
      userId: user!.userId,
      divisionId: effectiveDivisionId,
      pageSize: 500,
    }),
    { revalidateOnFocus: false },
  );

  const allItems = itemData?.items || [];
  const unitOptions = [
    { value: "all", label: "Semua Unit" },
    ...Array.from(
      new Map(allItems.map((item) => [item.unitId, item.unitName])).entries(),
    ).map(([value, label]) => ({ value, label })).sort((left, right) => left.label.localeCompare(right.label)),
  ];

  const items = selectedUnitId === "all"
    ? allItems
    : allItems.filter((item) => item.unitId === selectedUnitId);

  const columns = useMemo<DataTableColumn<QcItem>[]>(() => [
    {
      key: "unit",
      label: "Unit / Divisi",
      sortable: true,
      sortValue: (row) => `${row.unitName} ${row.divisionName}`,
      render: (row) => (
        <div>
          <p className="text-[12px] font-medium text-white/85">{row.unitName}</p>
          <p className="text-[10px] text-white/35">{row.divisionName}</p>
        </div>
      ),
    },
    {
      key: "panel",
      label: "Panel / Job",
      render: (row) => (
        <div>
          <p className="text-[12px] text-white/75">{row.panelName || "-"}</p>
          <p className="text-[10px] text-white/35">{row.jobName || row.taskCategory}</p>
          {(row.woNumber || row.vendorName) ? (
            <p className="mt-1 text-[10px] text-white/25">
              {[row.woNumber, row.vendorName].filter(Boolean).join(" • ")}
            </p>
          ) : null}
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (row) => (
        <span className={cn("inline-flex rounded-full border px-2 py-1 text-[10px] font-medium", statusBadge(row.status))}>
          {row.status}
        </span>
      ),
    },
    {
      key: "level",
      label: "Level QC",
      render: (row) => <span className="text-[11px] text-white/55">{qcLevelLabel(row.qcLevel)}</span>,
    },
    {
      key: "last",
      label: "QC Terakhir",
      render: (row) => <span className={cn("text-[11px] font-medium", lastQcTone(row.qcLastStatus))}>{row.qcLastStatus || "—"}</span>,
    },
    {
      key: "remaining",
      label: "Sisa Jam",
      align: "right",
      sortable: true,
      sortValue: (row) => row.remainingHours || 0,
      render: (row) => <span className="text-sm tabular-nums text-amber-200">{formatHours(row.remainingHours)}</span>,
    },
    {
      key: "deadline",
      label: "Deadline",
      sortable: true,
      sortValue: (row) => row.deadlineDate || "",
      render: (row) => <span className="text-[11px] tabular-nums text-white/45">{formatDateLabel(row.deadlineDate)}</span>,
    },
    {
      key: "actions",
      label: "",
      align: "right",
      render: (row) => (
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setSubmitTarget({ item: row, action: "tidak_lolos" })}
            className="rounded-md border border-orange-500/20 bg-orange-500/10 px-2.5 py-1.5 text-[10px] text-orange-200 transition hover:bg-orange-500/15"
          >
            Tidak Lolos
          </button>
          <button
            type="button"
            onClick={() => setSubmitTarget({ item: row, action: "lolos" })}
            className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1.5 text-[10px] text-emerald-200 transition hover:bg-emerald-500/15"
          >
            Lolos
          </button>
        </div>
      ),
    },
  ], []);

  const totalUnits = new Set(items.map((item) => item.unitId)).size;
  const totalWov = items.filter((item) => item.JobType === "WOV").length;
  const overdueItems = items.filter((item) => item.deadlineDate && new Date(item.deadlineDate) < new Date()).length;

  async function refreshAll() {
    await Promise.all([mutateDivisions(), mutateItems()]);
  }

  async function handleSubmitSuccess(message: string) {
    setSubmitTarget(null);
    await refreshAll();
    setNotice({ tone: "success", message });
  }

  if (!user) return null;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h2 className="flex items-center gap-2.5 text-xl font-light tracking-wide text-white/90" style={SERIF_STYLE}>
            <span className="text-white/30"><CheckSquare className="h-5 w-5" /></span>
            Quality Check
          </h2>
          <p className="mt-1 text-[11px] uppercase tracking-[0.15em] text-white/30">
            Queue QC berbasis divisi, unit, dan level approval aktual.
          </p>
        </div>

        <button
          type="button"
          onClick={refreshAll}
          className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm text-white/70 transition hover:border-white/[0.14] hover:text-white"
        >
          <RefreshCcw className="h-4 w-4 text-white/45" />
          Refresh
        </button>
      </div>

      {notice ? <NoticeBar notice={notice} onDismiss={() => setNotice(null)} /> : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <DarkCard className="p-4">
          <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">Queue Item</p>
          <p className="mt-3 text-3xl font-light tracking-tight text-white/90" style={SERIF_STYLE}>{items.length}</p>
        </DarkCard>
        <DarkCard className="p-4">
          <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">Unit Terlihat</p>
          <p className="mt-3 text-3xl font-light tracking-tight text-white/90" style={SERIF_STYLE}>{totalUnits}</p>
        </DarkCard>
        <DarkCard className="p-4">
          <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">Item WOV</p>
          <p className="mt-3 text-3xl font-light tracking-tight text-white/90" style={SERIF_STYLE}>{totalWov}</p>
        </DarkCard>
        <DarkCard className="p-4">
          <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">Overdue</p>
          <p className="mt-3 text-3xl font-light tracking-tight text-rose-300" style={SERIF_STYLE}>{overdueItems}</p>
        </DarkCard>
      </div>

      <DarkCard className="p-4">
        {divisionLoading ? (
          <div className="flex items-center gap-3 text-sm text-white/40">
            <Loader2 className="h-4 w-4 animate-spin text-amber-400/70" />
            Mengambil daftar divisi QC...
          </div>
        ) : (
          <div className="grid gap-3 xl:grid-cols-[280px_280px_1fr] xl:items-end">
            <SelectField
              label="Divisi"
              value={effectiveDivisionId}
              onChange={(value) => {
                setSelectedDivisionId(value);
                setSelectedUnitId("all");
              }}
              options={divisions.map((division) => ({
                value: division.divisionId,
                label: `${division.divisionName} (${division.totalItem})`,
              }))}
            />
            <SelectField
              label="Unit"
              value={selectedUnitId}
              onChange={setSelectedUnitId}
              options={unitOptions}
              disabled={!effectiveDivisionId || unitOptions.length <= 1}
            />
            <div className="text-xs text-white/40">
              <p>Role: <span className="text-white/70">{divisionData?.role || "—"}</span></p>
              <p className="mt-1">Data QC otomatis mengikuti hierarchy backend per role.</p>
            </div>
          </div>
        )}
      </DarkCard>

      {itemLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-5 w-5 animate-spin text-amber-500/40" />
        </div>
      ) : (
        <DataTable
          data={items}
          columns={columns}
          rowKey={(row) => `${row.JobType}-${row.coreId}-${row.refId || "core"}`}
          searchable
          searchPlaceholder="Cari unit, panel, job, vendor, atau WO..."
          searchFn={(row, query) => {
            const haystack = [
              row.unitName,
              row.divisionName,
              row.panelName || "",
              row.jobName || "",
              row.taskCategory,
              row.vendorName || "",
              row.woNumber || "",
            ].join(" ").toLowerCase();
            return haystack.includes(query);
          }}
          emptyMessage={effectiveDivisionId ? "Tidak ada item QC untuk filter saat ini." : "Pilih divisi untuk memuat antrean QC."}
        />
      )}

      {submitTarget ? (
        <SubmitQcModal
          item={submitTarget.item}
          action={submitTarget.action}
          userId={user.userId}
          onClose={() => setSubmitTarget(null)}
          onSuccess={handleSubmitSuccess}
        />
      ) : null}
    </div>
  );
}
