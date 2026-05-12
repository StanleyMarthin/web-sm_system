"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { FileText, Loader2, Plus, RefreshCcw, X } from "lucide-react";

import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { DarkCard } from "@/components/ui/dark-card";
import { useAuthStore } from "@/features/auth/stores/auth-store";
import { getJobPlanDropdowns } from "@/features/operational/services/job-plan-service";
import {
  approveWorkOrder,
  createWorkOrder,
  getWorkOrders,
  rejectWorkOrder,
  type WorkOrder,
} from "@/features/operational/services/wo-service";
import { SERIF_STYLE } from "@/lib/constants";
import { cn } from "@/lib/utils";

type NoticeTone = "success" | "error";

interface NoticeState {
  tone: NoticeTone;
  message: string;
}

interface WorkOrderDropdowns {
  cars: Array<{ id: string; unit_name: string }>;
  divisions: Array<{ id: string; name: string }>;
}

function normalizeRole(role: string): string {
  return role.trim().toLowerCase();
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

function stageLabel(value: string | null | undefined): string {
  switch ((value || "").toUpperCase()) {
    case "PENDING_KD_TARGET":
      return "Menunggu Estimasi KD";
    case "PENDING_ADVISOR":
      return "Menunggu Advisor";
    case "PENDING_KP":
      return "Menunggu KP";
    case "PENDING_MP":
      return "Menunggu MP";
    case "APPROVED":
      return "Approved";
    case "DONE":
      return "Done";
    case "REJECTED":
      return "Rejected";
    case "OPEN":
      return "Open";
    default:
      return value || "—";
  }
}

function stageTone(value: string | null | undefined): string {
  switch ((value || "").toUpperCase()) {
    case "PENDING_KD_TARGET":
    case "PENDING_ADVISOR":
    case "PENDING_KP":
    case "PENDING_MP":
      return "border-amber-500/20 bg-amber-500/10 text-amber-200";
    case "APPROVED":
    case "DONE":
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-200";
    case "REJECTED":
      return "border-rose-500/20 bg-rose-500/10 text-rose-200";
    default:
      return "border-white/10 bg-white/[0.04] text-white/60";
  }
}

function canEstimateStage(stage: string | null | undefined): boolean {
  return (stage || "").toUpperCase() === "PENDING_KD_TARGET";
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] uppercase tracking-[0.16em] text-white/35">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white/80 outline-none transition focus:border-amber-500/40"
      >
        <option value="">Pilih {label}</option>
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

function CreateWoModal({
  userId,
  dropdowns,
  onClose,
  onSuccess,
}: {
  userId: string;
  dropdowns: WorkOrderDropdowns;
  onClose: () => void;
  onSuccess: (message: string) => void;
}) {
  const [carId, setCarId] = useState("");
  const [targetDivId, setTargetDivId] = useState("");
  const [sectionName, setSectionName] = useState("");
  const [jobDetail, setJobDetail] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [addPanelToMaster, setAddPanelToMaster] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const carOptions = (dropdowns?.cars || []).map((car: { id: string; unit_name: string }) => ({
    value: String(car.id),
    label: car.unit_name,
  }));
  const divisionOptions = (dropdowns?.divisions || []).map((division: { id: string; name: string }) => ({
    value: String(division.id),
    label: division.name,
  }));

  async function handleSave() {
    if (!carId || !targetDivId || !sectionName.trim() || !jobDetail.trim() || !targetDate) {
      setError("Unit, divisi tujuan, panel/section, detail pekerjaan, dan target date wajib diisi.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await createWorkOrder({
        userId,
        carId,
        targetDivId,
        sectionName: sectionName.trim(),
        jobDetail: jobDetail.trim(),
        targetDate,
        addPanelToMaster,
      });
      onSuccess("Work Order berhasil dibuat.");
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Gagal membuat Work Order.");
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
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-[#0d0d0d] shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-white/[0.06] px-5 py-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/35">Create Work Order</p>
            <h3 className="mt-2 text-lg font-medium text-white/90" style={SERIF_STYLE}>
              Buat WO Baru
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 p-2 text-white/45 transition hover:border-white/20 hover:text-white/80"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          <div className="grid gap-4 md:grid-cols-2">
            <SelectField label="Unit" value={carId} onChange={setCarId} options={carOptions} />
            <SelectField label="Divisi Tujuan" value={targetDivId} onChange={setTargetDivId} options={divisionOptions} />
          </div>

          <div>
            <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.16em] text-white/40">
              Panel / Section
            </label>
            <input
              value={sectionName}
              onChange={(event) => setSectionName(event.target.value)}
              placeholder="Contoh: Quarter Panel Kiri"
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white/80 outline-none transition focus:border-amber-500/40"
            />
          </div>

          <div>
            <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.16em] text-white/40">
              Detail Pekerjaan
            </label>
            <textarea
              value={jobDetail}
              onChange={(event) => setJobDetail(event.target.value)}
              rows={4}
              placeholder="Deskripsi detail pekerjaan..."
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white/80 outline-none transition focus:border-amber-500/40"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.16em] text-white/40">
                Target Date
              </label>
              <input
                type="date"
                value={targetDate}
                onChange={(event) => setTargetDate(event.target.value)}
                style={{ colorScheme: "dark" }}
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white/80 outline-none transition focus:border-amber-500/40"
              />
            </div>
            <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/75">
              <input
                type="checkbox"
                checked={addPanelToMaster}
                onChange={(event) => setAddPanelToMaster(event.target.checked)}
                className="h-4 w-4 accent-amber-400"
              />
              <span>Tambahkan panel ke master</span>
            </label>
          </div>

          {error ? (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
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
            onClick={handleSave}
            disabled={saving}
            className="flex-1 rounded-xl border border-amber-500/30 bg-amber-500/15 px-4 py-3 text-sm font-medium text-amber-200 transition hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Menyimpan..." : "Buat Work Order"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ProcessWoModal({
  userId,
  role,
  item,
  onClose,
  onSuccess,
}: {
  userId: string;
  role: string;
  item: WorkOrder;
  onClose: () => void;
  onSuccess: (message: string) => void;
}) {
  const [notes, setNotes] = useState("");
  const [estimatedHours, setEstimatedHours] = useState(item.estimatedHours ? item.estimatedHours.toString() : "");
  const [rejectReason, setRejectReason] = useState("");
  const [submitting, setSubmitting] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stage = item.currentStage || item.status;
  const needsHours = canEstimateStage(stage);
  const normalizedRole = normalizeRole(role);

  async function handleApprove() {
    if (needsHours && (!estimatedHours || Number(estimatedHours) <= 0)) {
      setError("Estimasi jam wajib diisi pada tahap KD target.");
      return;
    }

    setSubmitting("approve");
    setError(null);

    try {
      await approveWorkOrder({
        userId,
        reqId: item.reqId,
        notes: notes.trim() || undefined,
        estimatedHours: needsHours ? Number(estimatedHours) : undefined,
      });
      onSuccess("Proses approval Work Order berhasil dijalankan.");
    } catch (approveError) {
      setError(approveError instanceof Error ? approveError.message : "Gagal approve Work Order.");
      setSubmitting(null);
      return;
    }

    setSubmitting(null);
  }

  async function handleReject() {
    if (!rejectReason.trim()) {
      setError("Alasan penolakan wajib diisi.");
      return;
    }

    setSubmitting("reject");
    setError(null);

    try {
      await rejectWorkOrder({
        userId,
        reqId: item.reqId,
        rejectReason: rejectReason.trim(),
      });
      onSuccess("Work Order berhasil ditolak.");
    } catch (rejectError) {
      setError(rejectError instanceof Error ? rejectError.message : "Gagal menolak Work Order.");
      setSubmitting(null);
      return;
    }

    setSubmitting(null);
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-white/10 bg-[#0d0d0d] shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-white/[0.06] px-5 py-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/35">Work Order Process</p>
            <h3 className="mt-2 text-lg font-medium text-white/90" style={SERIF_STYLE}>
              {item.woNumber}
            </h3>
            <p className="mt-2 text-sm text-white/45">
              {item.unitName} • {item.toDivName} • Role Anda: {normalizedRole || "-"}
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
          <div className="grid gap-3 md:grid-cols-2">
            <DarkCard className="p-4">
              <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">Stage Aktif</p>
              <div className="mt-3">
                <span className={cn("inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium", stageTone(stage))}>
                  {stageLabel(stage)}
                </span>
              </div>
            </DarkCard>
            <DarkCard className="p-4">
              <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">Estimasi Saat Ini</p>
              <p className="mt-3 text-sm font-medium text-white/85">{formatHours(item.estimatedHours)}</p>
            </DarkCard>
          </div>

          <div className="mt-5 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 text-sm text-white/70">
            <p className="font-medium text-white/85">{item.jobDetail}</p>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              <p>Panel: {item.panelName || "-"}</p>
              <p>Tgl Request: {formatDateLabel(item.requestDate)}</p>
              <p>Dari: {item.fromDivName}</p>
              <p>Ke: {item.toDivName}</p>
            </div>
          </div>

          {needsHours ? (
            <div className="mt-5">
              <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.16em] text-white/40">
                Estimasi Jam KD Target
              </label>
              <input
                value={estimatedHours}
                onChange={(event) => setEstimatedHours(event.target.value)}
                placeholder="Contoh 6 atau 6.5"
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white/80 outline-none transition focus:border-amber-500/40"
              />
            </div>
          ) : null}

          <div className="mt-5">
            <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.16em] text-white/40">
              Catatan Approval
            </label>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              placeholder="Catatan untuk approval..."
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white/80 outline-none transition focus:border-amber-500/40"
            />
          </div>

          <div className="mt-5">
            <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.16em] text-white/40">
              Alasan Penolakan
            </label>
            <textarea
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              rows={3}
              placeholder="Isi jika ingin menolak WO..."
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white/80 outline-none transition focus:border-rose-500/40"
            />
          </div>

          {item.stagesDone && item.stagesDone.length > 0 ? (
            <div className="mt-6 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
              <h4 className="text-sm font-semibold text-white/90">Riwayat Stage</h4>
              <div className="mt-4 space-y-3">
                {item.stagesDone.map((stageDone, index) => (
                  <div key={`${stageDone.role || "stage"}-${index}`} className="rounded-xl border border-white/10 bg-black/10 px-3 py-3 text-sm text-white/65">
                    <p className="font-medium text-white/80">{stageDone.name || stageDone.role || "Tahap"}</p>
                    <p className="mt-1 text-xs text-white/35">{formatDateLabel(stageDone.action_at)}</p>
                    {stageDone.estimated_hours != null ? (
                      <p className="mt-2 text-xs text-white/45">Estimasi: {formatHours(stageDone.estimated_hours)}</p>
                    ) : null}
                    {stageDone.notes ? <p className="mt-2">{stageDone.notes}</p> : null}
                  </div>
                ))}
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
            Tutup
          </button>
          <button
            type="button"
            onClick={handleReject}
            disabled={submitting !== null}
            className="flex-1 rounded-xl border border-rose-500/30 bg-rose-500/15 px-4 py-3 text-sm font-medium text-rose-200 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting === "reject" ? "Menolak..." : "Tolak WO"}
          </button>
          <button
            type="button"
            onClick={handleApprove}
            disabled={submitting !== null}
            className="flex-1 rounded-xl border border-emerald-500/30 bg-emerald-500/15 px-4 py-3 text-sm font-medium text-emerald-200 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting === "approve" ? "Memproses..." : "Setujui / Lanjutkan"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function WoPageClient() {
  const user = useAuthStore((state) => state.user);
  const [view, setView] = useState<"ACTIVE" | "DONE">("ACTIVE");
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedItem, setSelectedItem] = useState<WorkOrder | null>(null);
  const [dropdowns, setDropdowns] = useState<WorkOrderDropdowns | null>(null);

  useEffect(() => {
    getJobPlanDropdowns().then((data) => setDropdowns(data?.data ?? data));
  }, []);

  const {
    data: items = [],
    isLoading,
    mutate,
  } = useSWR(
    user ? ["op-wo", user.userId, view] : null,
    () => getWorkOrders({ userId: user!.userId, view, limit: 200 }),
    { revalidateOnFocus: false },
  );

  const columns = useMemo<DataTableColumn<WorkOrder>[]>(() => [
    {
      key: "number",
      label: "No. WO",
      sortable: true,
      sortValue: (row) => row.woNumber,
      render: (row) => <span className="font-mono text-[11px] text-amber-200/85">{row.woNumber || "—"}</span>,
    },
    {
      key: "unit",
      label: "Unit",
      sortable: true,
      sortValue: (row) => row.unitName,
      render: (row) => (
        <div>
          <p className="text-[12px] font-medium text-white/85">{row.unitName}</p>
          <p className="text-[10px] text-white/35">{row.ownerName}</p>
        </div>
      ),
    },
    {
      key: "division",
      label: "Divisi",
      render: (row) => (
        <div>
          <p className="text-[12px] text-white/70">Ke: {row.toDivName}</p>
          <p className="text-[10px] text-white/35">Dari: {row.fromDivName}</p>
        </div>
      ),
    },
    {
      key: "detail",
      label: "Panel / Pekerjaan",
      render: (row) => (
        <div>
          <p className="text-[12px] text-white/75">{row.panelName || "-"}</p>
          <p className="text-[10px] text-white/35 line-clamp-2">{row.jobDetail || "—"}</p>
        </div>
      ),
    },
    {
      key: "estimate",
      label: "Estimasi",
      align: "right",
      sortable: true,
      sortValue: (row) => row.estimatedHours || 0,
      render: (row) => <span className="text-sm tabular-nums text-white/70">{formatHours(row.estimatedHours)}</span>,
    },
    {
      key: "stage",
      label: "Stage",
      sortable: true,
      sortValue: (row) => row.currentStage || row.status,
      render: (row) => (
        <span className={cn("inline-flex rounded-full border px-2 py-1 text-[10px] font-medium", stageTone(row.currentStage || row.status))}>
          {stageLabel(row.currentStage || row.status)}
        </span>
      ),
    },
    {
      key: "request",
      label: "Tgl Request",
      sortable: true,
      sortValue: (row) => row.requestDate,
      render: (row) => <span className="text-[11px] tabular-nums text-white/45">{formatDateLabel(row.requestDate)}</span>,
    },
    {
      key: "actions",
      label: "",
      align: "right",
      render: (row) => (
        <button
          type="button"
          onClick={() => setSelectedItem(row)}
          className="rounded-md border border-white/10 px-2.5 py-1.5 text-[10px] text-white/60 transition hover:border-amber-500/30 hover:text-amber-200"
        >
          {view === "ACTIVE" ? "Proses" : "Detail"}
        </button>
      ),
    },
  ], [view]);

  const activeCount = items.filter((item) => (item.currentStage || item.status).toUpperCase() !== "REJECTED").length;
  const rejectedCount = items.filter((item) => item.status.toUpperCase() === "REJECTED").length;
  const pendingEstimate = items.filter((item) => canEstimateStage(item.currentStage || item.status)).length;

  async function refreshAll() {
    await mutate();
  }

  async function handleSuccess(message: string) {
    setShowCreate(false);
    setSelectedItem(null);
    await refreshAll();
    setNotice({ tone: "success", message });
  }

  if (!user) return null;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h2 className="flex items-center gap-2.5 text-xl font-light tracking-wide text-white/90" style={SERIF_STYLE}>
            <span className="text-white/30"><FileText className="h-5 w-5" /></span>
            Work Order
          </h2>
          <p className="mt-1 text-[11px] uppercase tracking-[0.15em] text-white/30">
            Approval bertahap dan monitoring WO operasional.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-lg border border-white/[0.06] bg-white/[0.03] p-1">
            {(["ACTIVE", "DONE"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setView(value)}
                className={cn(
                  "rounded-md px-4 py-1.5 text-[11px] font-medium transition-all",
                  view === value ? "bg-amber-500/15 text-amber-200" : "text-white/30 hover:text-white/50",
                )}
              >
                {value === "ACTIVE" ? "WO Aktif" : "Riwayat"}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={refreshAll}
            className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm text-white/70 transition hover:border-white/[0.14] hover:text-white"
          >
            <RefreshCcw className="h-4 w-4 text-white/45" />
            Refresh
          </button>

          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/15 px-4 py-2.5 text-sm text-amber-200 transition hover:bg-amber-500/20"
          >
            <Plus className="h-4 w-4" />
            Buat WO
          </button>
        </div>
      </div>

      {notice ? <NoticeBar notice={notice} onDismiss={() => setNotice(null)} /> : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <DarkCard className="p-4">
          <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">Rows</p>
          <p className="mt-3 text-3xl font-light tracking-tight text-white/90" style={SERIF_STYLE}>{items.length}</p>
        </DarkCard>
        <DarkCard className="p-4">
          <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">Aktif</p>
          <p className="mt-3 text-3xl font-light tracking-tight text-white/90" style={SERIF_STYLE}>{activeCount}</p>
        </DarkCard>
        <DarkCard className="p-4">
          <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">Pending Estimasi KD</p>
          <p className="mt-3 text-3xl font-light tracking-tight text-amber-200" style={SERIF_STYLE}>{pendingEstimate}</p>
        </DarkCard>
        <DarkCard className="p-4">
          <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">Rejected</p>
          <p className="mt-3 text-3xl font-light tracking-tight text-rose-300" style={SERIF_STYLE}>{rejectedCount}</p>
        </DarkCard>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-5 w-5 animate-spin text-amber-500/40" />
        </div>
      ) : (
        <DataTable
          data={items}
          columns={columns}
          rowKey={(row) => row.reqId}
          searchable
          searchPlaceholder="Cari nomor WO, unit, panel, atau divisi..."
          searchFn={(row, query) => {
            const haystack = [
              row.woNumber,
              row.unitName,
              row.ownerName,
              row.toDivName,
              row.fromDivName,
              row.panelName || "",
              row.jobDetail || "",
            ].join(" ").toLowerCase();
            return haystack.includes(query);
          }}
          emptyMessage={`Belum ada data Work Order untuk view ${view === "ACTIVE" ? "aktif" : "riwayat"}.`}
        />
      )}

      {showCreate && dropdowns ? (
        <CreateWoModal
          userId={user.userId}
          dropdowns={dropdowns}
          onClose={() => setShowCreate(false)}
          onSuccess={handleSuccess}
        />
      ) : null}

      {selectedItem ? (
        <ProcessWoModal
          userId={user.userId}
          role={user.role}
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onSuccess={handleSuccess}
        />
      ) : null}
    </div>
  );
}
