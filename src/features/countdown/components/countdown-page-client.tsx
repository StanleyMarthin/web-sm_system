"use client";

import { type ReactNode, useDeferredValue, useEffect, useState } from "react";
import useSWR from "swr";
import {
  AlarmClockCheck,
  CheckCircle2,
  Clock3,
  FileClock,
  FolderKanban,
  HelpCircle,
  Loader2,
  RefreshCcw,
  Search,
  ShieldCheck,
  TriangleAlert,
  X,
} from "lucide-react";

import { DarkCard } from "@/components/ui/dark-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuthStore } from "@/features/auth/stores/auth-store";
import { SERIF_STYLE } from "@/lib/constants";
import { cn } from "@/lib/utils";

import {
  getCountdownDetails,
  getCountdownPlanAssignees,
  getCountdownRevisions,
  getCountdownTableRows,
  getCountdownUnits,
  markCountdownQcReady,
  processCountdownRevision,
  requestCountdownRevision,
  saveCountdownPlanDraft,
  type CountdownDetailItem,
  type CountdownDraftItem,
  type CountdownEmployeeOption,
  type CountdownJobdesc,
  type CountdownRevision,
  type CountdownUnit,
} from "@/features/countdown/services/countdown-service";

type NoticeTone = "success" | "error";
type SectionFilter = "all" | "plan" | "proses" | "qcready" | "done";

interface NoticeState {
  tone: NoticeTone;
  message: string;
}

function normalizeRole(role: string): string {
  return role.trim().toLowerCase();
}

function hasRevisionApprovalAccess(role: string): boolean {
  return new Set([
    "pm",
    "kp",
    "manager_produksi",
    "kepala_produksi",
    "kepala_project",
  ]).has(normalizeRole(role));
}

function isPmActualRole(role: string): boolean {
  return normalizeRole(role) === "pm";
}

function effectiveCountdownStatus(item: CountdownJobdesc): string {
  const raw = normalizeRole(item.status);
  if (raw === "done") return "DONE";
  if (raw === "qcready" || raw === "qc_ready" || raw === "ready_qc") {
    return "QC READY";
  }
  if (normalizeRole(item.qcLastStatus || "") === "lolos") return "DONE";
  if (raw === "proses") return "PROSES";
  return item.status.toUpperCase();
}

function isWorkCompleted(item: CountdownJobdesc): boolean {
  const effectiveStatus = effectiveCountdownStatus(item);
  return effectiveStatus === "DONE" || effectiveStatus === "QC READY" || item.progress >= 100;
}

function getStatusTone(status: string) {
  switch (status.toUpperCase()) {
    case "DONE":
      return {
        label: "Done",
        icon: CheckCircle2,
        className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
      };
    case "QC READY":
    case "QC_READY":
    case "READY_QC":
    case "QCREADY":
      return {
        label: "QC Ready",
        icon: ShieldCheck,
        className: "border-amber-500/30 bg-amber-500/10 text-amber-300",
      };
    case "PROSES":
      return {
        label: "Proses",
        icon: Clock3,
        className: "border-sky-500/30 bg-sky-500/10 text-sky-300",
      };
    case "PLAN":
      return {
        label: "Plan",
        icon: FileClock,
        className: "border-white/10 bg-white/5 text-white/55",
      };
    case "REQUESTED":
      return {
        label: "Requested",
        icon: TriangleAlert,
        className: "border-orange-500/30 bg-orange-500/10 text-orange-300",
      };
    case "REJECTED":
      return {
        label: "Rejected",
        icon: X,
        className: "border-rose-500/30 bg-rose-500/10 text-rose-300",
      };
    default:
      return {
        label: status || "Unknown",
        icon: HelpCircle,
        className: "border-white/10 bg-white/5 text-white/55",
      };
  }
}

function getRevisionBanner(item: CountdownJobdesc) {
  const status = item.revisionRequestStatus?.toUpperCase();
  if (status === "REQUESTED") {
    return {
      title: "Menunggu Persetujuan Revisi",
      detail: `Permintaan +${formatHours(item.requestedRevisionHours || 0)}${item.requestedRevisionDeadline ? ` • DL ${formatDateLabel(item.requestedRevisionDeadline)}` : ""}`,
      className: "border-orange-500/30 bg-orange-500/10 text-orange-200",
    };
  }
  if (status === "APPROVED") {
    return {
      title: "Revisi Disetujui",
      detail: `+${formatHours(item.approvedRevisionHours || 0)}${item.approvedRevisionDeadline ? ` • DL baru ${formatDateLabel(item.approvedRevisionDeadline)}` : ""}`,
      className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
    };
  }
  if (status === "REJECTED") {
    return {
      title: "Revisi Ditolak",
      detail: `Diproses oleh ${item.rejectedRevisionByName || "PM"}`,
      className: "border-rose-500/30 bg-rose-500/10 text-rose-200",
    };
  }
  return null;
}

function statusWeight(status: string): number {
  switch (status.toUpperCase()) {
    case "PLAN":
      return 1;
    case "PROSES":
      return 2;
    case "READY_QC":
    case "QC READY":
    case "QC_READY":
    case "QCREADY":
      return 3;
    case "DONE":
      return 4;
    default:
      return 99;
  }
}

function sortJobs(items: CountdownJobdesc[]): CountdownJobdesc[] {
  return [...items].sort((left, right) => {
    const statusCompare = statusWeight(effectiveCountdownStatus(left)) - statusWeight(effectiveCountdownStatus(right));
    if (statusCompare !== 0) return statusCompare;

    const leftDeadline = new Date(left.deadlineDate || "2099-12-31").getTime();
    const rightDeadline = new Date(right.deadlineDate || "2099-12-31").getTime();
    return leftDeadline - rightDeadline;
  });
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

function formatDateTimeLabel(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatWeekdayLabel(value: string | null | undefined): string {
  if (!value) return "Tanpa tanggal";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
  }).format(date);
}

function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

function formatHours(value: number): string {
  return `${value.toFixed(1)} jam`;
}

function formatHourCell(value: number): string {
  const text = formatDurationInput(value);
  if (text.startsWith("0") && text.length > 4) {
    return text.slice(1);
  }
  return text;
}

function estimateActualHours(item: CountdownJobdesc): number {
  return Math.max(0, item.targetHoursRevised - item.remainingHours);
}

function buildJobNote(item: CountdownJobdesc): string {
  const notes: string[] = [];
  if (item.revisionRequestStatus?.toUpperCase() === "REQUESTED") {
    notes.push("Menunggu ACC revisi");
  }
  if (item.isLockedByOtherDivision) {
    notes.push("Locked divisi lain");
  }
  if (!notes.length) {
    notes.push(effectiveCountdownStatus(item) === "QC READY" ? "Menunggu QC" : "—");
  }
  return notes.join(" • ");
}

function formatDurationInput(hours: number): string {
  const safe = Number.isFinite(hours) ? Math.max(0, hours) : 0;
  const wholeHours = Math.floor(safe);
  const minutes = Math.round((safe - wholeHours) * 60);
  const carryHour = minutes === 60 ? 1 : 0;
  const finalMinutes = minutes === 60 ? 0 : minutes;
  return `${String(wholeHours + carryHour).padStart(2, "0")}:${String(finalMinutes).padStart(2, "0")}`;
}

function parseDurationInput(value: string): number | null {
  const raw = value.trim();
  if (!raw) return null;
  if (raw.includes(":")) {
    const [hoursPart, minutesPart = "0"] = raw.split(":");
    const hours = Number(hoursPart);
    const minutes = Number(minutesPart);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes) || minutes < 0 || minutes >= 60) {
      return null;
    }
    return hours + (minutes / 60);
  }
  const numeric = Number(raw.replace(",", "."));
  return Number.isFinite(numeric) ? numeric : null;
}

function toInputDate(value: string | null | undefined): string {
  if (!value) return currentDateInput();
  if (value.length >= 10) return value.slice(0, 10);
  return value;
}

function currentDateInput(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function tomorrowInput(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function breakMinutesForDate(dateString: string): number {
  const date = new Date(`${dateString}T00:00:00`);
  const weekday = date.getDay();
  if (weekday === 5) return 90;
  if (weekday === 0) return 0;
  return 60;
}

function breakStartMinutesForDate(dateString: string): number {
  const date = new Date(`${dateString}T00:00:00`);
  return date.getDay() === 5 ? (11 * 60) + 30 : 12 * 60;
}

function calculateFinishTime(dateString: string, startTime: string, durationHours: number): string {
  const [hourPart = "08", minutePart = "00"] = startTime.split(":");
  const startMinutes = (Number(hourPart) * 60) + Number(minutePart);
  const workMinutes = Math.round(durationHours * 60);
  const breakStart = breakStartMinutesForDate(dateString);
  const breakEnd = 13 * 60;
  const breakDuration = breakMinutesForDate(dateString);

  const extraMinutes = breakDuration > 0 && startMinutes < breakEnd && (startMinutes + workMinutes) > breakStart
    ? breakDuration
    : 0;

  const totalMinutes = startMinutes + workMinutes + extraMinutes;
  const finishHours = String(Math.floor(totalMinutes / 60) % 24).padStart(2, "0");
  const finishMinutes = String(totalMinutes % 60).padStart(2, "0");
  return `${finishHours}:${finishMinutes}`;
}

function isOvertimeByTime(time: string): boolean {
  const [hourPart = "0", minutePart = "0"] = time.split(":");
  const hour = Number(hourPart);
  const minute = Number(minutePart);
  return hour > 17 || (hour === 17 && minute > 0);
}

function averageProgress(units: CountdownUnit[]): number {
  if (!units.length) return 0;
  return units.reduce((sum, unit) => sum + unit.overallProgress, 0) / units.length;
}

function countCompletedUnits(units: CountdownUnit[]): number {
  return units.filter((unit) => unit.overallProgress >= 100 || unit.status.toUpperCase() === "DONE").length;
}

function PageNotice({ notice, onDismiss }: { notice: NoticeState; onDismiss: () => void }) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm",
        notice.tone === "success"
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
          : "border-rose-500/30 bg-rose-500/10 text-rose-100",
      )}
    >
      <div className="flex items-start gap-2">
        {notice.tone === "success" ? (
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
        ) : (
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
        )}
        <span>{notice.message}</span>
      </div>
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

function PanelCard({
  title,
  subtitle,
  extra,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  extra?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <DarkCard className={cn("overflow-hidden", className)}>
      <div className="flex flex-col gap-3 border-b border-white/[0.06] px-4 py-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white/90">{title}</h3>
          {subtitle ? <p className="mt-1 text-xs text-white/40">{subtitle}</p> : null}
        </div>
        {extra ? <div className="shrink-0">{extra}</div> : null}
      </div>
      <div className="px-4 py-4">{children}</div>
    </DarkCard>
  );
}

function StatusChip({ status }: { status: string }) {
  const tone = getStatusTone(status);
  const Icon = tone.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium",
        tone.className,
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {tone.label}
    </span>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string;
  hint: string;
  icon: ReactNode;
}) {
  return (
    <DarkCard className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">{label}</p>
          <p className="mt-3 text-3xl font-light tracking-tight text-white/90 tabular-nums" style={SERIF_STYLE}>
            {value}
          </p>
          <p className="mt-2 text-xs text-white/40">{hint}</p>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.04] p-2.5 text-amber-300">
          {icon}
        </div>
      </div>
    </DarkCard>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  disabled,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  options: Array<{ value: string; label: string }>;
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

function InfoBadge({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "accent" | "muted" | "danger" | "success";
}) {
  const toneClassName = {
    default: "border-white/10 bg-white/[0.03] text-white/75",
    accent: "border-amber-500/25 bg-amber-500/10 text-amber-200",
    muted: "border-white/[0.06] bg-white/[0.02] text-white/45",
    danger: "border-rose-500/25 bg-rose-500/10 text-rose-200",
    success: "border-emerald-500/25 bg-emerald-500/10 text-emerald-200",
  } satisfies Record<string, string>;

  return (
    <div className={cn("rounded-xl border px-3 py-2", toneClassName[tone])}>
      <p className="text-[10px] uppercase tracking-[0.14em] opacity-70">{label}</p>
      <p className="mt-1 text-sm font-medium tabular-nums">{value}</p>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-10 text-center text-sm text-white/40">
      {message}
    </div>
  );
}

function LoaderBlock({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-12 text-sm text-white/35">
      <Loader2 className="h-4 w-4 animate-spin text-amber-400/70" />
      <span>{message}</span>
    </div>
  );
}

function ModalShell({
  title,
  subtitle,
  onClose,
  children,
  widthClassName = "max-w-xl",
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  widthClassName?: string;
}) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className={cn("max-h-[92vh] w-full overflow-hidden rounded-2xl border border-white/10 bg-[#0d0d0d] shadow-2xl", widthClassName)}>
        <div className="flex items-start justify-between gap-4 border-b border-white/[0.06] px-5 py-4">
          <div>
            <h3 className="text-lg font-medium text-white/90" style={SERIF_STYLE}>
              {title}
            </h3>
            {subtitle ? <p className="mt-1 text-sm text-white/35">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 p-2 text-white/45 transition hover:border-white/20 hover:text-white/80"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[calc(92vh-84px)] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

function JobDetailDrawer({
  open,
  role,
  unit,
  item,
  details,
  detailsLoading,
  onClose,
  onOpenDraft,
  onOpenRevision,
  onDeclareComplete,
}: {
  open: boolean;
  role: string;
  unit: CountdownUnit | null;
  item: CountdownJobdesc | null;
  details: CountdownDetailItem[];
  detailsLoading: boolean;
  onClose: () => void;
  onOpenDraft: (item: CountdownJobdesc) => void;
  onOpenRevision: (item: CountdownJobdesc) => void;
  onDeclareComplete: (item: CountdownJobdesc) => void;
}) {
  if (!open || !item) return null;

  const actualOnly = isPmActualRole(role);
  const banner = getRevisionBanner(item);
  const completed = isWorkCompleted(item);

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/55 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside className="ml-auto flex h-full w-full max-w-2xl flex-col border-l border-white/10 bg-[#090909] shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-white/[0.06] px-5 py-5">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/35">
              {actualOnly ? "Aktual Countdown" : "Detail Countdown"}
            </p>
            <h3 className="mt-2 text-xl font-medium text-white/90" style={SERIF_STYLE}>
              {item.jobName}
            </h3>
            <p className="mt-2 text-sm text-white/45">
              {(unit?.unitName || "Unit tidak dikenal")} • {item.panelName} • {item.sectionName}
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

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <div className="grid gap-3 md:grid-cols-2">
            <DarkCard className="p-4">
              <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">Status</p>
              <div className="mt-3">
                <StatusChip status={effectiveCountdownStatus(item)} />
              </div>
              <div className="mt-4 space-y-2 text-sm text-white/55">
                <div className="flex items-center justify-between gap-3">
                  <span>Progress</span>
                  <span className="font-medium tabular-nums text-white/80">{formatPercent(item.progress)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Sisa Jam</span>
                  <span className="font-medium tabular-nums text-white/80">{formatHours(item.remainingHours)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Deadline</span>
                  <span className="font-medium text-white/80">{formatDateLabel(item.deadlineDate)}</span>
                </div>
              </div>
            </DarkCard>

            <DarkCard className="p-4">
              <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">Pengerjaan</p>
              <div className="mt-4 space-y-2 text-sm text-white/55">
                <div className="flex items-center justify-between gap-3">
                  <span>Kategori</span>
                  <span className="font-medium text-white/80">{item.taskCategory}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Target Revisi</span>
                  <span className="font-medium tabular-nums text-white/80">{formatHours(item.targetHoursRevised)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Panel Lock</span>
                  <span className={cn("font-medium", item.isLockedByOtherDivision ? "text-orange-300" : "text-white/80")}>
                    {item.isLockedByOtherDivision ? "Terkunci divisi lain" : "Bebas"}
                  </span>
                </div>
              </div>
            </DarkCard>
          </div>

          {banner ? (
            <div className={cn("mt-4 rounded-xl border px-4 py-3", banner.className)}>
              <p className="text-sm font-semibold">{banner.title}</p>
              <p className="mt-1 text-sm opacity-90">{banner.detail}</p>
            </div>
          ) : null}

          {!actualOnly ? (
            <div className="mt-5 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-sm font-semibold text-white/90">Aksi Countdown</h4>
                  <p className="mt-1 text-xs text-white/40">
                    Alur ini mengikuti tindakan yang tersedia di mobile untuk item countdown.
                  </p>
                </div>
                {completed ? <StatusChip status={effectiveCountdownStatus(item)} /> : null}
              </div>

              {completed ? (
                <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                  Pekerjaan ini sudah selesai atau menunggu QC. Aksi pembuatan plan dan deklarasi selesai tidak ditampilkan.
                </div>
              ) : (
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => onOpenDraft(item)}
                    className="rounded-xl border border-amber-500/30 bg-amber-500/12 px-4 py-3 text-left transition hover:bg-amber-500/18"
                  >
                    <p className="text-sm font-semibold text-amber-200">Buat Draft Plan</p>
                    <p className="mt-1 text-xs text-amber-100/70">Simpan ke draft planning dari item countdown ini.</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => onDeclareComplete(item)}
                    className="rounded-xl border border-emerald-500/30 bg-emerald-500/12 px-4 py-3 text-left transition hover:bg-emerald-500/18"
                  >
                    <p className="text-sm font-semibold text-emerald-200">Nyatakan Selesai</p>
                    <p className="mt-1 text-xs text-emerald-100/70">Ubah status menjadi QC Ready setelah pekerjaan selesai.</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => onOpenRevision(item)}
                    disabled={item.revisionRequestStatus?.toUpperCase() === "REQUESTED"}
                    className="rounded-xl border border-orange-500/30 bg-orange-500/12 px-4 py-3 text-left transition hover:bg-orange-500/18 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <p className="text-sm font-semibold text-orange-200">Ajukan Revisi</p>
                    <p className="mt-1 text-xs text-orange-100/70">Usulkan tambahan jam atau pergeseran deadline.</p>
                  </button>
                </div>
              )}
            </div>
          ) : null}

          <div className="mt-6">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-semibold text-white/90">Aktual Pengerjaan</h4>
                <p className="mt-1 text-xs text-white/40">Riwayat detail countdown per pelaksana.</p>
              </div>
            </div>

            {detailsLoading ? (
              <LoaderBlock message="Mengambil aktual countdown..." />
            ) : details.length === 0 ? (
              <EmptyState message="Belum ada aktual countdown untuk job ini." />
            ) : (
              <DarkCard className="overflow-hidden">
                <Table className="min-w-[760px]">
                  <TableHeader>
                    <TableRow className="border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.02]">
                      <TableHead className="text-xs uppercase tracking-[0.16em] text-white/35">Pelaksana</TableHead>
                      <TableHead className="text-xs uppercase tracking-[0.16em] text-white/35">Tanggal</TableHead>
                      <TableHead className="text-xs uppercase tracking-[0.16em] text-white/35">Jam</TableHead>
                      <TableHead className="text-right text-xs uppercase tracking-[0.16em] text-white/35">Durasi</TableHead>
                      <TableHead className="text-right text-xs uppercase tracking-[0.16em] text-white/35">Progress</TableHead>
                      <TableHead className="text-xs uppercase tracking-[0.16em] text-white/35">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {details.map((detail) => (
                      <TableRow key={detail.id} className="border-white/[0.06] hover:bg-white/[0.03]">
                        <TableCell className="text-sm text-white/85">{detail.employeeName}</TableCell>
                        <TableCell className="text-sm text-white/60">{formatDateLabel(detail.workDate)}</TableCell>
                        <TableCell className="text-sm tabular-nums text-white/60">
                          {detail.startTime} - {detail.finishTime}
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums text-white/70">{formatHours(detail.billedHours)}</TableCell>
                        <TableCell className="text-right text-sm tabular-nums text-white/70">{formatPercent(detail.progressPercent)}</TableCell>
                        <TableCell className="text-sm text-white/60">{detail.taskStatus}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </DarkCard>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

function PlanDraftModal({
  userId,
  unit,
  item,
  allItems,
  onClose,
  onSuccess,
}: {
  userId: string;
  unit: CountdownUnit;
  item: CountdownJobdesc;
  allItems: CountdownJobdesc[];
  onClose: () => void;
  onSuccess: (message: string) => void;
}) {
  const availablePlanHours = item.remainingHours > 0 ? item.remainingHours : item.targetHoursRevised;
  const comboCandidates = allItems.filter((candidate) => (
    candidate.id !== item.id &&
    candidate.carId === item.carId &&
    candidate.divisionId === item.divisionId &&
    candidate.panelName === item.panelName &&
    candidate.targetHoursRevised > 0
  ));

  const [searchAssignee, setSearchAssignee] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [hoursInput, setHoursInput] = useState(formatDurationInput(availablePlanHours > 0 ? availablePlanHours : item.targetHoursRevised));
  const [taskDate, setTaskDate] = useState(currentDateInput());
  const [startTime, setStartTime] = useState("08:00");
  const [finishTime, setFinishTime] = useState(calculateFinishTime(currentDateInput(), "08:00", availablePlanHours > 0 ? availablePlanHours : item.targetHoursRevised));
  const [finishEdited, setFinishEdited] = useState(false);
  const [isOvertime, setIsOvertime] = useState(false);
  const [note, setNote] = useState("");
  const [selectedComboIds, setSelectedComboIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: assignees = [], isLoading: assigneesLoading } = useSWR<CountdownEmployeeOption[]>(
    ["countdown-plan-assignees", item.divisionId],
    () => getCountdownPlanAssignees(item.divisionId),
    { revalidateOnFocus: false },
  );

  const filteredAssignees = assignees.filter((assignee) => (
    assignee.name.toLowerCase().includes(searchAssignee.toLowerCase())
  ));

  const selectedCombos = comboCandidates.filter((candidate) => selectedComboIds.includes(candidate.id));
  const maxHours = availablePlanHours + selectedCombos.reduce((sum, candidate) => sum + candidate.targetHoursRevised, 0);

  function toggleCombo(id: string) {
    setSelectedComboIds((current) => {
      const exists = current.includes(id);
      const next = exists ? current.filter((value) => value !== id) : [...current, id];
      const nextItems = comboCandidates.filter((candidate) => next.includes(candidate.id));
      const nextMaxHours = availablePlanHours + nextItems.reduce((sum, candidate) => sum + candidate.targetHoursRevised, 0);
      setHoursInput(formatDurationInput(nextMaxHours));
      if (!finishEdited) {
        const computedFinish = calculateFinishTime(taskDate, startTime, nextMaxHours);
        setFinishTime(computedFinish);
        setIsOvertime(isOvertimeByTime(computedFinish));
      }
      setError(null);
      return next;
    });
  }

  async function handleSave() {
    const inputHours = parseDurationInput(hoursInput);
    if (!selectedEmployeeId) {
      setError("Pilih pelaksana terlebih dahulu.");
      return;
    }
    if (!inputHours || inputHours <= 0) {
      setError("Target jam wajib diisi dengan format yang valid.");
      return;
    }
    if (inputHours > maxHours) {
      setError(`Target melebihi sisa alokasi. Maksimum ${formatDurationInput(maxHours)}.`);
      return;
    }

    const selectedEmployee = assignees.find((assignee) => assignee.id === selectedEmployeeId);
    if (!selectedEmployee) {
      setError("Pelaksana tidak ditemukan.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      let remaining = inputHours;
      const draftSourceItems = [item, ...selectedCombos];
      const draftItems: CountdownDraftItem[] = [];

      for (const draftItem of draftSourceItems) {
        if (remaining <= 0) break;
        const cap = draftItem.id === item.id ? availablePlanHours : draftItem.targetHoursRevised;
        const allocation = Math.min(remaining, cap);

        draftItems.push({
          sourceType: "COUNTDOWN",
          coreId: draftItem.id,
          carId: draftItem.carId,
          divisionId: item.divisionId,
          unitName: unit.unitName,
          panelName: draftItem.panelName,
          assignedUserId: selectedEmployee.id,
          assignedTo: selectedEmployee.name,
          jobDescription: draftItem.jobName,
          targetHours: allocation,
          taskDate,
          startTime,
          finishTime,
          isOvertime,
          note: [
            `Sumber: Countdown ${draftItem.id}`,
            draftSourceItems.length > 1 ? "Combo Jobdesc" : null,
            isOvertime ? "Lembur: Ya" : "Lembur: Tidak",
            note.trim() ? `POK: ${note.trim()}` : null,
          ].filter(Boolean).join(" | "),
        });

        remaining -= allocation;
      }

      await saveCountdownPlanDraft({
        userId,
        items: draftItems,
      });
      onSuccess("Draft countdown berhasil disimpan. Lanjutkan submit dari modul planning.");
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Gagal menyimpan draft countdown.");
      setSaving(false);
      return;
    }

    setSaving(false);
  }

  return (
    <ModalShell
      title="Buat Draft Job Plan"
      subtitle={`${unit.unitName} • ${item.panelName} • ${item.jobName}`}
      onClose={onClose}
      widthClassName="max-w-3xl"
    >
      <div className="space-y-5 px-5 py-5">
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Sisa alokasi awal: <span className="font-semibold tabular-nums">{formatDurationInput(availablePlanHours)}</span>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.16em] text-white/40">
                Pelaksana
              </label>
              <input
                value={searchAssignee}
                onChange={(event) => setSearchAssignee(event.target.value)}
                placeholder="Cari nama pelaksana..."
                className="mb-2 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white/80 outline-none transition focus:border-amber-500/40"
              />
              <select
                value={selectedEmployeeId}
                onChange={(event) => {
                  setSelectedEmployeeId(event.target.value);
                  setError(null);
                }}
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white/80 outline-none transition focus:border-amber-500/40"
              >
                <option value="">Pilih pelaksana</option>
                {filteredAssignees.map((assignee) => (
                  <option key={assignee.id} value={assignee.id}>
                    {assignee.name}{assignee.grade ? ` • ${assignee.grade}` : ""}
                  </option>
                ))}
              </select>
              {assigneesLoading ? <p className="mt-2 text-xs text-white/35">Mengambil daftar pelaksana...</p> : null}
            </div>

            <div>
              <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.16em] text-white/40">
                Target Jam
              </label>
              <input
                value={hoursInput}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setHoursInput(nextValue);
                  const parsedHours = parseDurationInput(nextValue);
                  if (!finishEdited && parsedHours && parsedHours > 0) {
                    const computedFinish = calculateFinishTime(taskDate, startTime, parsedHours);
                    setFinishTime(computedFinish);
                    setIsOvertime(isOvertimeByTime(computedFinish));
                  }
                  setError(null);
                }}
                placeholder="08:00 atau 8.5"
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-lg font-semibold tracking-wide text-white/90 outline-none transition focus:border-amber-500/40"
              />
              <p className="mt-2 text-xs text-white/35">Maksimum {formatDurationInput(maxHours)} dengan kombinasi yang dipilih.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.16em] text-white/40">
                  Tanggal
                </label>
                <input
                  type="date"
                  value={taskDate}
                  onChange={(event) => {
                    const nextDate = event.target.value;
                    setTaskDate(nextDate);
                    const parsedHours = parseDurationInput(hoursInput);
                    if (!finishEdited && parsedHours && parsedHours > 0) {
                      const computedFinish = calculateFinishTime(nextDate, startTime, parsedHours);
                      setFinishTime(computedFinish);
                      setIsOvertime(isOvertimeByTime(computedFinish));
                    }
                    setError(null);
                  }}
                  style={{ colorScheme: "dark" }}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white/80 outline-none transition focus:border-amber-500/40"
                />
              </div>
              <div>
                <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.16em] text-white/40">
                  Mulai
                </label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(event) => {
                    const nextStartTime = event.target.value;
                    setStartTime(nextStartTime);
                    setFinishEdited(false);
                    const parsedHours = parseDurationInput(hoursInput);
                    if (parsedHours && parsedHours > 0) {
                      const computedFinish = calculateFinishTime(taskDate, nextStartTime, parsedHours);
                      setFinishTime(computedFinish);
                      setIsOvertime(isOvertimeByTime(computedFinish));
                    }
                    setError(null);
                  }}
                  style={{ colorScheme: "dark" }}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white/80 outline-none transition focus:border-amber-500/40"
                />
              </div>
              <div>
                <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.16em] text-white/40">
                  Selesai
                </label>
                <input
                  type="time"
                  value={finishTime}
                  onChange={(event) => {
                    const nextFinishTime = event.target.value;
                    setFinishTime(nextFinishTime);
                    setFinishEdited(true);
                    setIsOvertime(isOvertimeByTime(nextFinishTime));
                    setError(null);
                  }}
                  style={{ colorScheme: "dark" }}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white/80 outline-none transition focus:border-amber-500/40"
                />
              </div>
            </div>

            <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/75">
              <input
                type="checkbox"
                checked={isOvertime}
                onChange={(event) => setIsOvertime(event.target.checked)}
                className="h-4 w-4 accent-amber-400"
              />
              <span>Dikerjakan saat lembur</span>
            </label>

            <div>
              <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.16em] text-white/40">
                Instruksi / POK
              </label>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={4}
                placeholder="Catatan tambahan untuk planning..."
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white/80 outline-none transition focus:border-amber-500/40"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-white/40">Ringkasan</p>
              <div className="mt-4 space-y-3 text-sm text-white/60">
                <div className="flex items-center justify-between gap-3">
                  <span>Job utama</span>
                  <span className="text-right text-white/85">{item.jobName}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Sisa dasar</span>
                  <span className="tabular-nums text-white/85">{formatDurationInput(availablePlanHours)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Gabungan</span>
                  <span className="tabular-nums text-white/85">{selectedCombos.length} item</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Target masuk draft</span>
                  <span className="tabular-nums text-amber-200">{hoursInput}</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-white/40">
                Gabungkan Job Panel Sama
              </p>
              <div className="mt-4 space-y-2">
                {comboCandidates.length === 0 ? (
                  <p className="text-sm text-white/40">Tidak ada job lain pada panel yang sama.</p>
                ) : (
                  comboCandidates.map((candidate) => {
                    const checked = selectedComboIds.includes(candidate.id);
                    return (
                      <label
                        key={candidate.id}
                        className={cn(
                          "flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 text-sm transition",
                          checked
                            ? "border-amber-500/35 bg-amber-500/10 text-amber-100"
                            : "border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.05]",
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleCombo(candidate.id)}
                          className="mt-0.5 h-4 w-4 accent-amber-400"
                        />
                        <span className="min-w-0">
                          <span className="block font-medium">{candidate.jobName}</span>
                          <span className="mt-1 block text-xs opacity-75">
                            Target {formatDurationInput(candidate.targetHoursRevised)}
                          </span>
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          </div>
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
          {saving ? "Menyimpan..." : "Simpan ke Draft"}
        </button>
      </div>
    </ModalShell>
  );
}

function RevisionRequestModal({
  userId,
  item,
  onClose,
  onSuccess,
}: {
  userId: string;
  item: CountdownJobdesc;
  onClose: () => void;
  onSuccess: (message: string) => void;
}) {
  const [hoursInput, setHoursInput] = useState("");
  const [deadline, setDeadline] = useState(item.deadlineDate ? toInputDate(item.deadlineDate) : tomorrowInput());
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    const requestedHours = hoursInput.trim() ? parseDurationInput(hoursInput) : 0;
    const isDeadlineChanged = deadline !== toInputDate(item.deadlineDate);

    if (requestedHours == null || requestedHours < 0) {
      setError("Format tambahan jam kerja tidak valid.");
      return;
    }
    if (requestedHours === 0 && !isDeadlineChanged) {
      setError("Ubah deadline atau isi tambahan jam kerja terlebih dahulu.");
      return;
    }
    if (!reason.trim()) {
      setError("Alasan revisi wajib diisi.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await requestCountdownRevision({
        userId,
        countdownId: item.id,
        requestedHours,
        requestedDeadline: deadline,
        reason: reason.trim(),
      });
      onSuccess("Pengajuan revisi countdown berhasil dikirim.");
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Gagal mengirim pengajuan revisi.");
      setSaving(false);
      return;
    }

    setSaving(false);
  }

  return (
    <ModalShell
      title="Ajukan Revisi Countdown"
      subtitle={`${item.panelName} • ${item.jobName}`}
      onClose={onClose}
    >
      <div className="space-y-5 px-5 py-5">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/65">
          Deadline saat ini <span className="font-semibold text-white/85">{formatDateLabel(item.deadlineDate)}</span> •
          Target saat ini <span className="font-semibold text-white/85"> {formatHours(item.targetHoursRevised)}</span>
        </div>

        <div>
          <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.16em] text-white/40">
            Tambahan Jam Kerja
          </label>
          <input
            value={hoursInput}
            onChange={(event) => {
              setHoursInput(event.target.value);
              setError(null);
            }}
            placeholder="Opsional, contoh 02:30 atau 2.5"
            className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white/80 outline-none transition focus:border-orange-500/40"
          />
        </div>

        <div>
          <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.16em] text-white/40">
            Deadline Baru
          </label>
          <input
            type="date"
            value={deadline}
            onChange={(event) => {
              setDeadline(event.target.value);
              setError(null);
            }}
            style={{ colorScheme: "dark" }}
            className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white/80 outline-none transition focus:border-orange-500/40"
          />
        </div>

        <div>
          <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.16em] text-white/40">
            Alasan Revisi
          </label>
          <textarea
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
              setError(null);
            }}
            rows={4}
            placeholder="Jelaskan kebutuhan revisi deadline dan/atau tambahan jam kerja."
            className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white/80 outline-none transition focus:border-orange-500/40"
          />
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
          onClick={handleSubmit}
          disabled={saving}
          className="flex-1 rounded-xl border border-orange-500/30 bg-orange-500/15 px-4 py-3 text-sm font-medium text-orange-200 transition hover:bg-orange-500/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Mengirim..." : "Ajukan Revisi"}
        </button>
      </div>
    </ModalShell>
  );
}

function RevisionApproveModal({
  userId,
  revision,
  onClose,
  onSuccess,
}: {
  userId: string;
  revision: CountdownRevision;
  onClose: () => void;
  onSuccess: (message: string) => void;
}) {
  const [approvedHours, setApprovedHours] = useState(formatDurationInput(revision.requestedHours));
  const [approvedDeadline, setApprovedDeadline] = useState(toInputDate(revision.requestedDeadline || revision.currentDeadline));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleApprove() {
    const parsedHours = parseDurationInput(approvedHours);
    if (parsedHours == null || parsedHours < 0) {
      setError("Jam disetujui tidak valid.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await processCountdownRevision({
        userId,
        countdownId: revision.countdownId,
        approved: true,
        approvedHours: parsedHours,
        approvedDeadline,
      });
      onSuccess("Pengajuan revisi countdown berhasil disetujui.");
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Gagal menyetujui pengajuan revisi.");
      setSaving(false);
      return;
    }

    setSaving(false);
  }

  return (
    <ModalShell
      title="ACC Revisi Countdown"
      subtitle={`${revision.unitName} • ${revision.panelName} • ${revision.jobName}`}
      onClose={onClose}
    >
      <div className="space-y-5 px-5 py-5">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/65">
          Pengaju: <span className="font-semibold text-white/85">{revision.requestedByName || "—"}</span> •
          Diajukan: <span className="font-semibold text-white/85"> {formatDateTimeLabel(revision.requestedAt)}</span>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-white/40">Saat Ini</p>
            <p className="mt-3 text-sm text-white/70">Jam: {formatHours(revision.currentHours)}</p>
            <p className="mt-1 text-sm text-white/70">Deadline: {formatDateLabel(revision.currentDeadline)}</p>
          </div>
          <div className="rounded-xl border border-orange-500/20 bg-orange-500/10 p-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-orange-200/75">Diajukan</p>
            <p className="mt-3 text-sm text-orange-100">Jam: {formatHours(revision.requestedHours)}</p>
            <p className="mt-1 text-sm text-orange-100">Deadline: {formatDateLabel(revision.requestedDeadline)}</p>
          </div>
        </div>

        <div>
          <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.16em] text-white/40">
            Jam Disetujui
          </label>
          <input
            value={approvedHours}
            onChange={(event) => {
              setApprovedHours(event.target.value);
              setError(null);
            }}
            className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white/80 outline-none transition focus:border-emerald-500/40"
          />
        </div>

        <div>
          <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.16em] text-white/40">
            Deadline Disetujui
          </label>
          <input
            type="date"
            value={approvedDeadline}
            onChange={(event) => {
              setApprovedDeadline(event.target.value);
              setError(null);
            }}
            style={{ colorScheme: "dark" }}
            className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white/80 outline-none transition focus:border-emerald-500/40"
          />
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/65">
          Alasan: {revision.reason || "Tidak ada alasan tambahan."}
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
          onClick={handleApprove}
          disabled={saving}
          className="flex-1 rounded-xl border border-emerald-500/30 bg-emerald-500/15 px-4 py-3 text-sm font-medium text-emerald-200 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Memproses..." : "Setujui Revisi"}
        </button>
      </div>
    </ModalShell>
  );
}

function ConfirmModal({
  title,
  description,
  confirmLabel,
  confirmClassName,
  onClose,
  onConfirm,
  loading,
}: {
  title: string;
  description: ReactNode;
  confirmLabel: string;
  confirmClassName: string;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
}) {
  return (
    <ModalShell title={title} onClose={onClose} widthClassName="max-w-md">
      <div className="space-y-5 px-5 py-5">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm leading-6 text-white/70">
          {description}
        </div>
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
          onClick={onConfirm}
          disabled={loading}
          className={cn(
            "flex-1 rounded-xl border px-4 py-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
            confirmClassName,
          )}
        >
          {loading ? "Memproses..." : confirmLabel}
        </button>
      </div>
    </ModalShell>
  );
}

export function CountdownPageClient() {
  const user = useAuthStore((state) => state.user);
  const [tab, setTab] = useState<"countdown" | "approval">("countdown");
  const [selectedDivisionId, setSelectedDivisionId] = useState("all");
  const [sectionFilter, setSectionFilter] = useState<SectionFilter>("all");
  const [sectionSearch, setSectionSearch] = useState("");
  const deferredSectionSearch = useDeferredValue(sectionSearch);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [planTarget, setPlanTarget] = useState<CountdownJobdesc | null>(null);
  const [revisionTarget, setRevisionTarget] = useState<CountdownJobdesc | null>(null);
  const [declareTarget, setDeclareTarget] = useState<CountdownJobdesc | null>(null);
  const [declareLoading, setDeclareLoading] = useState(false);
  const [approvalTarget, setApprovalTarget] = useState<CountdownRevision | null>(null);
  const [rejectTarget, setRejectTarget] = useState<CountdownRevision | null>(null);
  const [rejectLoading, setRejectLoading] = useState(false);

  const role = normalizeRole(String(user?.role || ""));
  const showApprovalTab = hasRevisionApprovalAccess(role);
  const searchQuery = deferredSectionSearch.trim().length >= 3 ? deferredSectionSearch.trim() : "";

  const {
    data: units = [],
    mutate: mutateUnits,
  } = useSWR<CountdownUnit[]>(
    user ? ["countdown-units", user.userId] : null,
    () => getCountdownUnits(user!.userId),
    { revalidateOnFocus: false },
  );

  const {
    data: allCountdownRows = [],
    isLoading: countdownRowsLoading,
    mutate: mutateTableRows,
  } = useSWR(
    user ? ["countdown-table", user.userId] : null,
    () => getCountdownTableRows(user!.userId),
    { revalidateOnFocus: false },
  );

  const divisionCatalog = Array.from(
    new Map(
      allCountdownRows.map((row) => [row.divisionId, { divisionId: row.divisionId, divisionName: row.divisionName || row.divisionId }]),
    ).values(),
  ).sort((left, right) => left.divisionName.localeCompare(right.divisionName));

  const selectedDivision = selectedDivisionId === "all"
    ? null
    : divisionCatalog.find((division) => division.divisionId === selectedDivisionId) || null;

  const scopeRows = selectedDivisionId === "all"
    ? allCountdownRows
    : allCountdownRows.filter((row) => row.divisionId === selectedDivisionId);

  const filteredJobs = scopeRows.filter((job) => {
    const statusMatch = (() => {
      if (sectionFilter === "all") return true;
      const effective = effectiveCountdownStatus(job).toUpperCase();
      switch (sectionFilter) {
        case "plan":
          return effective === "PLAN";
        case "proses":
          return effective === "PROSES";
        case "qcready":
          return effective === "QC READY" || effective === "QCREADY" || effective === "QC_READY" || effective === "READY_QC";
        case "done":
          return effective === "DONE";
        default:
          return true;
      }
    })();

    if (!statusMatch) return false;
    if (!searchQuery) return true;

    const haystack = [
      job.unitName,
      job.divisionName,
      job.sectionName,
      job.panelName,
      job.jobName,
      job.taskCategory,
    ].join(" ").toLowerCase();

    return haystack.includes(searchQuery.toLowerCase());
  });

  const jobs = sortJobs(filteredJobs);
  const selectedJob = jobs.find((job) => job.id === selectedJobId) || null;
  const unitByCarId = new Map(units.map((unit) => [unit.carId, unit]));

  function resolveUnitFromJob(job: CountdownJobdesc | null): CountdownUnit | null {
    if (!job) return null;
    const matchedUnit = unitByCarId.get(job.carId);
    if (matchedUnit) return matchedUnit;

    return {
      carId: job.carId,
      unitName: job.unitName || "-",
      customerName: job.customerName || null,
      status: "PLAN",
      contractDeliveryDate: job.contractDeliveryDate || null,
      overallProgress: job.overallProgress || 0,
    };
  }

  const detailUnit = resolveUnitFromJob(selectedJob);
  const planUnit = resolveUnitFromJob(planTarget);

  const {
    data: jobDetails = [],
    isLoading: jobDetailsLoading,
    mutate: mutateJobDetails,
  } = useSWR<CountdownDetailItem[]>(
    user && drawerOpen && selectedJob
      ? ["countdown-details", user.userId, selectedJob.id]
      : null,
    () => getCountdownDetails(user!.userId, selectedJob!.id),
    { revalidateOnFocus: false },
  );

  const {
    data: revisions = [],
    isLoading: revisionsLoading,
    mutate: mutateRevisions,
  } = useSWR<CountdownRevision[]>(
    user && showApprovalTab ? ["countdown-revisions", user.userId] : null,
    () => getCountdownRevisions(user!.userId),
    { revalidateOnFocus: false },
  );

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(null), 5000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!showApprovalTab && tab === "approval") {
      setTab("countdown");
    }
  }, [showApprovalTab, tab]);

  useEffect(() => {
    if (selectedDivisionId !== "all" && !divisionCatalog.some((division) => division.divisionId === selectedDivisionId)) {
      setSelectedDivisionId("all");
    }
  }, [divisionCatalog, selectedDivisionId]);

  useEffect(() => {
    if (!jobs.length && selectedJobId) {
      setSelectedJobId(null);
      setDrawerOpen(false);
      return;
    }
    if (selectedJobId && !jobs.some((job) => job.id === selectedJobId)) {
      setSelectedJobId(null);
      setDrawerOpen(false);
    }
  }, [jobs, selectedJobId]);

  async function refreshAll() {
    setRefreshing(true);
    try {
      await Promise.all([
        mutateUnits(),
        mutateTableRows(),
        drawerOpen && selectedJob ? mutateJobDetails() : Promise.resolve(),
        showApprovalTab ? mutateRevisions() : Promise.resolve(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }

  function closeDetailDrawer() {
    setDrawerOpen(false);
    setSelectedJobId(null);
  }

  function resetSectionControls() {
    setSelectedDivisionId("all");
    setSectionFilter("all");
    setSectionSearch("");
  }

  function closeAllActionModals() {
    setPlanTarget(null);
    setRevisionTarget(null);
    setDeclareTarget(null);
    setApprovalTarget(null);
    setRejectTarget(null);
  }

  async function handleActionSuccess(message: string) {
    closeAllActionModals();
    await refreshAll();
    setNotice({ tone: "success", message });
  }

  async function handleRejectRevision() {
    if (!user || !rejectTarget) return;
    setRejectLoading(true);
    try {
      await processCountdownRevision({
        userId: user.userId,
        countdownId: rejectTarget.countdownId,
        approved: false,
        approvedHours: 0,
        approvedDeadline: rejectTarget.currentDeadline || rejectTarget.requestedDeadline,
      });
      await handleActionSuccess("Pengajuan revisi countdown berhasil ditolak.");
    } catch (actionError) {
      setNotice({
        tone: "error",
        message: actionError instanceof Error ? actionError.message : "Gagal menolak pengajuan revisi.",
      });
    } finally {
      setRejectLoading(false);
    }
  }

  async function handleDeclareComplete() {
    if (!user || !declareTarget) return;
    setDeclareLoading(true);
    try {
      await markCountdownQcReady({
        userId: user.userId,
        countdownId: declareTarget.id,
      });
      setDrawerOpen(false);
      setSelectedJobId(null);
      await handleActionSuccess("Status countdown berhasil diubah ke QC Ready.");
    } catch (actionError) {
      setNotice({
        tone: "error",
        message: actionError instanceof Error ? actionError.message : "Gagal mengubah status countdown.",
      });
    } finally {
      setDeclareLoading(false);
    }
  }

  const pendingRevisions = revisions.filter((revision) => revision.status === "REQUESTED");
  const revisionHistory = revisions.filter((revision) => revision.status !== "REQUESTED");
  const divisionOptions = [{ value: "all", label: "Semua Divisi" }, ...divisionCatalog.map((division) => ({ value: division.divisionId, label: division.divisionName }))];
  const countdownScopeLabel = selectedDivision?.divisionName || "Semua Divisi";
  const completedJobs = jobs.filter((job) => isWorkCompleted(job)).length;
  const pendingJobRevisions = jobs.filter((job) => job.revisionRequestStatus?.toUpperCase() === "REQUESTED").length;
  const lockedJobs = jobs.filter((job) => job.isLockedByOtherDivision).length;
  const remainingHoursTotal = jobs.reduce((sum, job) => sum + job.remainingHours, 0);
  const activeFilterCount = [
    selectedDivisionId !== "all",
    sectionFilter !== "all",
    Boolean(sectionSearch.trim()),
  ].filter(Boolean).length;

  if (!user) return null;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/35">Countdown Workspace</p>
          <h2 className="mt-2 text-2xl font-light tracking-wide text-white/90" style={SERIF_STYLE}>
            Countdown Monitor
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/45">
            Mapping dari alur mobile ke web dengan navigasi bertingkat berbasis tabel, termasuk approval revisi,
            draft planning, dan tindakan QC Ready.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {showApprovalTab ? (
            <div className="flex rounded-xl border border-white/[0.06] bg-white/[0.03] p-1">
              <button
                type="button"
                onClick={() => setTab("countdown")}
                className={cn(
                  "rounded-lg px-4 py-2 text-sm transition",
                  tab === "countdown" ? "bg-amber-500/15 text-amber-200" : "text-white/35 hover:text-white/70",
                )}
              >
                Countdown
              </button>
              <button
                type="button"
                onClick={() => setTab("approval")}
                className={cn(
                  "rounded-lg px-4 py-2 text-sm transition",
                  tab === "approval" ? "bg-amber-500/15 text-amber-200" : "text-white/35 hover:text-white/70",
                )}
              >
                Approval Revisi
              </button>
            </div>
          ) : null}

          <button
            type="button"
            onClick={refreshAll}
            className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm text-white/70 transition hover:border-white/[0.14] hover:text-white"
          >
            <RefreshCcw className={cn("h-4 w-4", refreshing ? "animate-spin text-amber-300" : "text-white/45")} />
            Refresh
          </button>
        </div>
      </div>

      {notice ? <PageNotice notice={notice} onDismiss={() => setNotice(null)} /> : null}

      {tab === "approval" && showApprovalTab ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            label="Unit Terlihat"
            value={String(units.length)}
            hint="Jumlah unit countdown yang bisa diakses user saat ini."
            icon={<FolderKanban className="h-5 w-5" />}
          />
          <SummaryCard
            label="Rata-rata Progress"
            value={formatPercent(averageProgress(units))}
            hint="Rata-rata overall progress seluruh unit yang tampil."
            icon={<AlarmClockCheck className="h-5 w-5" />}
          />
          <SummaryCard
            label="Unit Selesai"
            value={String(countCompletedUnits(units))}
            hint="Unit dengan progress penuh atau status selesai."
            icon={<CheckCircle2 className="h-5 w-5" />}
          />
          <SummaryCard
            label="Revisi Pending"
            value={String(pendingRevisions.length)}
            hint="Permintaan revisi yang masih menunggu keputusan."
            icon={<ShieldCheck className="h-5 w-5" />}
          />
        </div>
      ) : null}

      {tab === "approval" && showApprovalTab ? (
        <div className="space-y-5">
          <PanelCard
            title="Menunggu Persetujuan"
            subtitle="PM dapat meninjau dan memproses pengajuan revisi countdown dari web."
            extra={(
              <div className="flex flex-wrap gap-2">
                <InfoBadge label="Pending" value={String(pendingRevisions.length)} tone={pendingRevisions.length > 0 ? "accent" : "muted"} />
                <InfoBadge label="History" value={String(revisionHistory.length)} tone="default" />
              </div>
            )}
          >
            {revisionsLoading ? (
              <LoaderBlock message="Mengambil pengajuan revisi..." />
            ) : pendingRevisions.length === 0 ? (
              <EmptyState message="Tidak ada pengajuan revisi yang menunggu persetujuan." />
            ) : (
              <DarkCard className="overflow-hidden">
                <Table className="min-w-[1080px]">
                  <TableHeader>
                    <TableRow className="border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.02]">
                      <TableHead className="text-xs uppercase tracking-[0.16em] text-white/35">Unit / Panel</TableHead>
                      <TableHead className="text-xs uppercase tracking-[0.16em] text-white/35">Job</TableHead>
                      <TableHead className="text-xs uppercase tracking-[0.16em] text-white/35">Pengaju</TableHead>
                      <TableHead className="text-xs uppercase tracking-[0.16em] text-white/35">Saat Ini</TableHead>
                      <TableHead className="text-xs uppercase tracking-[0.16em] text-white/35">Usulan</TableHead>
                      <TableHead className="text-xs uppercase tracking-[0.16em] text-white/35">Alasan</TableHead>
                      <TableHead className="text-right text-xs uppercase tracking-[0.16em] text-white/35">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingRevisions.map((revision) => (
                      <TableRow key={revision.id} className="border-white/[0.06] hover:bg-white/[0.03]">
                        <TableCell className="align-top">
                          <p className="text-sm font-medium text-white/85">{revision.unitName}</p>
                          <p className="mt-1 text-xs text-white/40">{revision.panelName}</p>
                        </TableCell>
                        <TableCell className="max-w-[240px] whitespace-normal text-sm text-white/70">
                          {revision.jobName}
                        </TableCell>
                        <TableCell className="align-top">
                          <p className="text-sm text-white/75">{revision.requestedByName || "—"}</p>
                          <p className="mt-1 text-xs text-white/40">{formatDateTimeLabel(revision.requestedAt)}</p>
                        </TableCell>
                        <TableCell className="align-top text-sm text-white/65">
                          <p>{formatHours(revision.currentHours)}</p>
                          <p className="mt-1 text-xs text-white/40">{formatDateLabel(revision.currentDeadline)}</p>
                        </TableCell>
                        <TableCell className="align-top text-sm text-orange-200">
                          <p>{formatHours(revision.requestedHours)}</p>
                          <p className="mt-1 text-xs text-orange-100/70">{formatDateLabel(revision.requestedDeadline)}</p>
                        </TableCell>
                        <TableCell className="max-w-[320px] whitespace-normal text-sm text-white/60">
                          {revision.reason || "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setRejectTarget(revision)}
                              className="rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-200 transition hover:bg-rose-500/15"
                            >
                              Tolak
                            </button>
                            <button
                              type="button"
                              onClick={() => setApprovalTarget(revision)}
                              className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-200 transition hover:bg-emerald-500/15"
                            >
                              Setujui
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </DarkCard>
            )}
          </PanelCard>

          <PanelCard
            title="Riwayat Pengajuan"
            subtitle="Jika backend mengembalikan status final, riwayat akan tampil di sini."
            extra={(
              <div className="flex flex-wrap gap-2">
                <InfoBadge label="Rows" value={String(revisionHistory.length)} tone="default" />
                <InfoBadge label="Approved" value={String(revisionHistory.filter((item) => item.status === "APPROVED").length)} tone="success" />
              </div>
            )}
          >
            {revisionsLoading ? (
              <LoaderBlock message="Mengambil riwayat revisi..." />
            ) : revisionHistory.length === 0 ? (
              <EmptyState message="Belum ada riwayat revisi yang bisa ditampilkan oleh endpoint saat ini." />
            ) : (
              <DarkCard className="overflow-hidden">
                <Table className="min-w-[920px]">
                  <TableHeader>
                    <TableRow className="border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.02]">
                      <TableHead className="text-xs uppercase tracking-[0.16em] text-white/35">Unit / Panel</TableHead>
                      <TableHead className="text-xs uppercase tracking-[0.16em] text-white/35">Job</TableHead>
                      <TableHead className="text-xs uppercase tracking-[0.16em] text-white/35">Status</TableHead>
                      <TableHead className="text-xs uppercase tracking-[0.16em] text-white/35">Keputusan</TableHead>
                      <TableHead className="text-xs uppercase tracking-[0.16em] text-white/35">Waktu</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {revisionHistory.map((revision) => (
                      <TableRow key={revision.id} className="border-white/[0.06] hover:bg-white/[0.03]">
                        <TableCell className="align-top">
                          <p className="text-sm font-medium text-white/85">{revision.unitName}</p>
                          <p className="mt-1 text-xs text-white/40">{revision.panelName}</p>
                        </TableCell>
                        <TableCell className="max-w-[280px] whitespace-normal text-sm text-white/70">
                          {revision.jobName}
                        </TableCell>
                        <TableCell>
                          <StatusChip status={revision.status} />
                        </TableCell>
                        <TableCell className="text-sm text-white/65">
                          {revision.status === "APPROVED" ? (
                            <>
                              <p>{formatHours(revision.approvedHours || 0)}</p>
                              <p className="mt-1 text-xs text-white/40">{formatDateLabel(revision.approvedDeadline)}</p>
                            </>
                          ) : (
                            <p>{revision.rejectedByName || "Diproses"}</p>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-white/55">
                          {revision.status === "APPROVED"
                            ? formatDateTimeLabel(revision.approvedAt)
                            : formatDateTimeLabel(revision.rejectedAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </DarkCard>
            )}
          </PanelCard>
        </div>
      ) : (
        <div className="space-y-5">
          <PanelCard
            title="Filter Divisi"
            subtitle="Default tanpa filter. Area utama difokuskan ke list countdown."
            extra={activeFilterCount > 0 ? (
              <button
                type="button"
                onClick={resetSectionControls}
                className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/60 transition hover:border-white/20 hover:text-white/85"
              >
                Reset Filter
              </button>
            ) : null}
          >
            {countdownRowsLoading && allCountdownRows.length === 0 ? (
              <LoaderBlock message="Mengambil list countdown..." />
            ) : allCountdownRows.length === 0 ? (
              <EmptyState message="Belum ada data countdown untuk ditampilkan." />
            ) : (
              <div className="grid gap-3 xl:grid-cols-[260px_1fr_320px] xl:items-end">
                <FilterSelect
                  label="Divisi"
                  value={selectedDivisionId}
                  onChange={setSelectedDivisionId}
                  disabled={countdownRowsLoading || divisionOptions.length <= 1}
                  options={divisionOptions}
                />

                <div>
                  <span className="mb-1.5 block text-[10px] uppercase tracking-[0.16em] text-white/35">Status</span>
                  <div className="flex flex-wrap gap-2">
                    {([
                      ["all", "Semua"],
                      ["plan", "Plan"],
                      ["proses", "Proses"],
                      ["qcready", "QC Ready"],
                      ["done", "Done"],
                    ] as Array<[SectionFilter, string]>).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setSectionFilter(value)}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-xs transition",
                          sectionFilter === value
                            ? "border-amber-500/30 bg-amber-500/12 text-amber-200"
                            : "border-white/10 bg-white/[0.03] text-white/45 hover:text-white/70",
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="block">
                  <span className="mb-1.5 block text-[10px] uppercase tracking-[0.16em] text-white/35">Cari Panel / Part</span>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/25" />
                    <input
                      value={sectionSearch}
                      onChange={(event) => setSectionSearch(event.target.value)}
                      placeholder="Cari nama panel / part..."
                      className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2.5 pl-9 pr-3 text-sm text-white/80 outline-none transition focus:border-amber-500/40"
                    />
                  </div>
                  {sectionSearch.trim().length > 0 && sectionSearch.trim().length < 3 ? (
                    <p className="mt-1.5 text-xs text-white/35">Ketik minimal 3 karakter untuk memfilter list.</p>
                  ) : null}
                </label>

                {drawerOpen ? (
                  <div className="xl:col-span-3 flex justify-end">
                    <button
                      type="button"
                      onClick={closeDetailDrawer}
                      className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-200 transition hover:bg-amber-500/15"
                    >
                      Tutup Detail
                    </button>
                  </div>
                ) : null}
              </div>
            )}
          </PanelCard>

          <PanelCard
            title="List Countdown"
            subtitle={`${countdownScopeLabel} • ${jobs.length} job • klik baris atau tombol detail untuk membuka countdown detail.`}
          >
            {countdownRowsLoading ? (
              <LoaderBlock message="Mengambil list countdown..." />
            ) : jobs.length === 0 ? (
              <EmptyState message="Belum ada jobdesc countdown yang cocok dengan filter saat ini." />
            ) : (
              <DarkCard className="overflow-hidden">
                <div className="border-b border-white/[0.06] bg-[#131313] px-4 py-3">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-amber-200/80">
                        Countdown Progress Sheet
                      </p>
                      <p className="mt-1 text-xs text-white/40">
                        Tampilan countdown difokuskan ke lembar kerja tabel agar lebih dekat ke pola monitor spreadsheet.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-[11px]">
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-white/70">
                        Job {jobs.length}
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-white/70">
                        Selesai {completedJobs}
                      </span>
                      <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-amber-200">
                        Revisi {pendingJobRevisions}
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-white/60">
                        Locked {lockedJobs}
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-white/70">
                        Sisa {formatHourCell(remainingHoursTotal)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="max-h-[70vh] overflow-auto">
                  <Table className="min-w-[1360px] border-separate border-spacing-0">
                    <TableHeader>
                      <TableRow className="border-0 bg-[#1f1f1f] hover:bg-[#1f1f1f]">
                        <TableHead rowSpan={2} className="h-12 border-b border-r border-white/10 px-3 text-center text-[10px] uppercase tracking-[0.18em] text-white/62">
                          Deadline
                        </TableHead>
                        <TableHead rowSpan={2} className="h-12 border-b border-r border-white/10 px-3 text-center text-[10px] uppercase tracking-[0.18em] text-white/62">
                          Part / Panel
                        </TableHead>
                        <TableHead rowSpan={2} className="h-12 border-b border-r border-white/10 px-3 text-center text-[10px] uppercase tracking-[0.18em] text-white/62">
                          Job Description
                        </TableHead>
                        <TableHead colSpan={3} className="h-12 border-b border-r border-white/10 px-3 text-center text-[10px] uppercase tracking-[0.2em] text-white/62">
                          Estimasi Jam Kerja
                        </TableHead>
                        <TableHead colSpan={2} className="h-12 border-b border-r border-white/10 px-3 text-center text-[10px] uppercase tracking-[0.2em] text-white/62">
                          Progress
                        </TableHead>
                        <TableHead colSpan={2} className="h-12 border-b px-3 text-center text-[10px] uppercase tracking-[0.2em] text-white/62">
                          Catatan
                        </TableHead>
                      </TableRow>
                      <TableRow className="border-0 bg-[#2a2418] hover:bg-[#2a2418]">
                        <TableHead className="h-10 border-r border-white/10 px-3 text-right text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-100/85">
                          Plan
                        </TableHead>
                        <TableHead className="h-10 border-r border-white/10 px-3 text-right text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-100/85">
                          Aktual
                        </TableHead>
                        <TableHead className="h-10 border-r border-white/10 px-3 text-right text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-100/85">
                          Sisa
                        </TableHead>
                        <TableHead className="h-10 border-r border-white/10 px-3 text-right text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-100/85">
                          Persen
                        </TableHead>
                        <TableHead className="h-10 border-r border-white/10 px-3 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-100/85">
                          Status
                        </TableHead>
                        <TableHead className="h-10 border-r border-white/10 px-3 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-100/85">
                          Keterangan
                        </TableHead>
                        <TableHead className="h-10 px-3 text-right text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-100/85">
                          Detail
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {jobs.map((job) => (
                        <TableRow
                          key={job.id}
                          onClick={() => {
                            setSelectedJobId(job.id);
                            setDrawerOpen(true);
                          }}
                          className={cn(
                            "border-0",
                            selectedJobId === job.id && drawerOpen
                              ? "cursor-pointer bg-amber-500/12"
                              : job.revisionRequestStatus?.toUpperCase() === "REQUESTED"
                                ? "cursor-pointer bg-amber-500/[0.05] hover:bg-amber-500/[0.09]"
                                : job.isLockedByOtherDivision
                                  ? "cursor-pointer bg-white/[0.04] hover:bg-white/[0.06]"
                                  : "cursor-pointer odd:bg-[#0d0d0d] even:bg-[#121212] hover:bg-white/[0.05]",
                          )}
                        >
                          <TableCell className="border-b border-r border-white/[0.05] px-3 py-3 align-top">
                            <p className="text-[10px] uppercase tracking-[0.14em] text-white/30">
                              {formatWeekdayLabel(job.deadlineDate)}
                            </p>
                            <p className="mt-1 text-sm font-medium text-white/82">
                              {formatDateLabel(job.deadlineDate)}
                            </p>
                          </TableCell>
                          <TableCell className="max-w-[250px] whitespace-normal border-b border-r border-white/[0.05] px-3 py-3 align-top">
                            <p className="text-sm font-medium text-white/80">{job.panelName}</p>
                            <p className="mt-1 text-xs text-white/35">
                              {(job.unitName || "-")} • {(job.divisionName || job.divisionId)}
                            </p>
                          </TableCell>
                          <TableCell className="max-w-[320px] whitespace-normal border-b border-r border-white/[0.05] px-3 py-3 align-top">
                            <p className="text-sm font-medium text-white/85">{job.jobName}</p>
                            <p className="mt-1 text-xs text-white/35">{job.taskCategory} • {job.sectionName}</p>
                            {job.isLockedByOtherDivision || job.revisionRequestStatus?.toUpperCase() === "REQUESTED" ? (
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {job.revisionRequestStatus?.toUpperCase() === "REQUESTED" ? (
                                  <span className="rounded-full border border-orange-500/25 bg-orange-500/10 px-2 py-0.5 text-[10px] font-medium text-orange-200">
                                    Menunggu ACC Revisi
                                  </span>
                                ) : null}
                                {job.isLockedByOtherDivision ? (
                                  <span className="rounded-full border border-rose-500/25 bg-rose-500/10 px-2 py-0.5 text-[10px] font-medium text-rose-200">
                                    Locked Divisi Lain
                                  </span>
                                ) : null}
                              </div>
                            ) : null}
                          </TableCell>
                          <TableCell className="border-b border-r border-white/[0.05] px-3 py-3 text-right text-sm font-medium tabular-nums text-amber-200">
                            {formatHourCell(job.targetHoursRevised)}
                          </TableCell>
                          <TableCell className="border-b border-r border-white/[0.05] px-3 py-3 text-right text-sm font-medium tabular-nums text-white/78">
                            {formatHourCell(estimateActualHours(job))}
                          </TableCell>
                          <TableCell className="border-b border-r border-white/[0.05] px-3 py-3 text-right text-sm font-medium tabular-nums text-amber-100/85">
                            {formatHourCell(job.remainingHours)}
                          </TableCell>
                          <TableCell className="border-b border-r border-white/[0.05] px-3 py-3 text-right text-sm font-medium tabular-nums text-white/72">
                            {formatPercent(job.progress)}
                          </TableCell>
                          <TableCell className="border-b border-r border-white/[0.05] px-3 py-3 align-top">
                            <div className="flex flex-wrap items-center gap-2">
                              <StatusChip status={effectiveCountdownStatus(job)} />
                              {job.revisionRequestStatus?.toUpperCase() === "REQUESTED" ? <StatusChip status="REQUESTED" /> : null}
                            </div>
                          </TableCell>
                          <TableCell className="max-w-[280px] whitespace-normal border-b border-r border-white/[0.05] px-3 py-3 align-top text-sm text-white/55">
                            {buildJobNote(job)}
                          </TableCell>
                          <TableCell className="border-b border-white/[0.05] px-3 py-3 text-right align-top">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                setSelectedJobId(job.id);
                                setDrawerOpen(true);
                              }}
                              className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/60 transition hover:border-amber-500/30 hover:text-amber-200"
                            >
                              Buka
                            </button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </DarkCard>
            )}
          </PanelCard>
        </div>
      )}

      <JobDetailDrawer
        open={drawerOpen}
        role={role}
        unit={detailUnit}
        item={selectedJob}
        details={jobDetails}
        detailsLoading={jobDetailsLoading}
        onClose={closeDetailDrawer}
        onOpenDraft={(item) => setPlanTarget(item)}
        onOpenRevision={(item) => setRevisionTarget(item)}
        onDeclareComplete={(item) => setDeclareTarget(item)}
      />

      {planTarget && planUnit ? (
        <PlanDraftModal
          userId={user.employeeId || user.userId}
          unit={planUnit}
          item={planTarget}
          allItems={jobs}
          onClose={() => setPlanTarget(null)}
          onSuccess={handleActionSuccess}
        />
      ) : null}

      {revisionTarget ? (
        <RevisionRequestModal
          userId={user.userId}
          item={revisionTarget}
          onClose={() => setRevisionTarget(null)}
          onSuccess={handleActionSuccess}
        />
      ) : null}

      {approvalTarget ? (
        <RevisionApproveModal
          userId={user.userId}
          revision={approvalTarget}
          onClose={() => setApprovalTarget(null)}
          onSuccess={handleActionSuccess}
        />
      ) : null}

      {declareTarget ? (
        <ConfirmModal
          title="Nyatakan Selesai?"
          description={(
            <>
              <p className="font-medium text-white/85">{declareTarget.panelName} • {declareTarget.jobName}</p>
              <p className="mt-3">
                Pekerjaan ini akan dinyatakan selesai dan status countdown berubah menjadi <span className="font-semibold text-emerald-200">QC Ready</span>.
              </p>
            </>
          )}
          confirmLabel="Ya, ubah ke QC Ready"
          confirmClassName="border-emerald-500/30 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/20"
          onClose={() => setDeclareTarget(null)}
          onConfirm={handleDeclareComplete}
          loading={declareLoading}
        />
      ) : null}

      {rejectTarget ? (
        <ConfirmModal
          title="Tolak Pengajuan Revisi?"
          description={(
            <>
              <p className="font-medium text-white/85">{rejectTarget.unitName} • {rejectTarget.panelName}</p>
              <p className="mt-3">
                Pengajuan revisi untuk <span className="font-semibold text-white/85">{rejectTarget.jobName}</span> akan ditolak.
              </p>
            </>
          )}
          confirmLabel="Ya, tolak revisi"
          confirmClassName="border-rose-500/30 bg-rose-500/15 text-rose-200 hover:bg-rose-500/20"
          onClose={() => setRejectTarget(null)}
          onConfirm={handleRejectRevision}
          loading={rejectLoading}
        />
      ) : null}
    </div>
  );
}
