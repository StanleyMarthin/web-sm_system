"use client";

import { useMemo, useState } from "react";
import type {
  MonitoringQuery,
  MonitoringReferences,
  MonitoringSummary,
  MonitoringTaskRecord,
} from "@smsystem/contracts/monitoring";
import type { GridFilter } from "@smsystem/contracts/grid";
import { RefreshCcw } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SmartDataGrid } from "@/shared/datagrid/smart-data-grid";
import type {
  SmartDataGridColumn,
  SmartDataGridFilterDefinition,
  SmartDataGridSavedView,
  SmartDataGridSortOption,
} from "@/shared/datagrid/types";
import { ActionButton, CompactDateInput, CompactDateRangeInput, EmptyRow, MetricBar, PageHeader, SectionCard } from "@/shared/ui/compact";
import { fmtTime } from "@/shared/format/humanize";
import { submitMonitoringActualToLedger } from "@/shared/api/monitoring";

interface MonitoringShellProps {
  activeMode: "all" | "normal" | "overtime";
  title: string;
  description: string;
  rows: MonitoringTaskRecord[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  state: MonitoringQuery;
  references: MonitoringReferences;
  summary: MonitoringSummary;
  noStartRows: MonitoringTaskRecord[];
  noSubmitRows: MonitoringTaskRecord[];
}

function addDaysIso(baseDate: string, days: number): string {
  const [year, month, day] = baseDate.split("-").map((value) => Number.parseInt(value, 10));
  const nextDate = new Date(Date.UTC(year, (month || 1) - 1, day || 1));
  nextDate.setUTCDate(nextDate.getUTCDate() + days);
  const nextYear = nextDate.getUTCFullYear();
  const nextMonth = String(nextDate.getUTCMonth() + 1).padStart(2, "0");
  const nextDay = String(nextDate.getUTCDate()).padStart(2, "0");
  return `${nextYear}-${nextMonth}-${nextDay}`;
}

/* ------------------------------------------------------------------ */
/*  Board list — compact task rows                                      */
/* ------------------------------------------------------------------ */

function BoardList({ title, rows, emptyMessage }: {
  title: string; rows: MonitoringTaskRecord[]; emptyMessage: string;
}) {
  return (
    <SectionCard label={title} count={rows.length}>
      <div className="space-y-0">
        {rows.length === 0
          ? <EmptyRow message={emptyMessage} />
          : rows.slice(0, 6).map((row) => (
            <div key={row.planId} className="border-b border-white/5 px-2 py-2 last:border-b-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[12px] text-foreground dark:text-foreground">{row.unitName}</p>
                  <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground dark:text-foreground/30">
                    {row.divisionName ?? "—"} · {row.panelName ?? row.jobDescription}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground dark:text-foreground/40">
                    {row.employeeName ?? "Belum ada PIC"} · {row.taskDate}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-mono text-[11px] text-foreground dark:text-foreground/60">{row.remainingHours.toFixed(1)}j</p>
                  <p className="font-mono text-[10px] text-muted-foreground dark:text-foreground/30">{row.progressPercent.toFixed(0)}%</p>
                </div>
              </div>
            </div>
          ))}
      </div>
    </SectionCard>
  );
}

/* ------------------------------------------------------------------ */
/*  Grid config                                                         */
/* ------------------------------------------------------------------ */

const sortOptions: SmartDataGridSortOption[] = [
  { label: "Tanggal",     value: "taskDate"        },
  { label: "Unit",        value: "unitName"         },
  { label: "Divisi",      value: "divisionName"     },
  { label: "PIC",         value: "employeeName"     },
  { label: "Progress",    value: "progressPercent"  },
  { label: "Remaining",   value: "remainingHours"   },
  { label: "Plan Status", value: "planStatus"       },
  { label: "Actual",      value: "actualStatus"     },
];

const savedViews: SmartDataGridSavedView[] = [
  { id: "all-tasks",      label: "All",           sortBy: "taskDate", sortDirection: "desc", filters: [] },
  { id: "pending-submit", label: "Pending Submit", sortBy: "taskDate", sortDirection: "desc",
    filters: [{ field: "actualStatus", operator: "eq", value: "SUBMITTED" } satisfies GridFilter] },
];

/* ------------------------------------------------------------------ */
/*  Main export                                                         */
/* ------------------------------------------------------------------ */

export function MonitoringShell({
  activeMode, title, rows, meta, state, references, summary, noStartRows, noSubmitRows,
}: MonitoringShellProps) {
  const router       = useRouter();
  const pathname     = usePathname();
  const searchParams = useSearchParams();
  const activeDateTo = state.dateTo ?? state.date;
  const isRangeMode = Boolean(state.dateTo && state.dateTo !== state.date);
  const [ledgerSubmittingId, setLedgerSubmittingId] = useState<string | null>(null);

  const columns = useMemo<SmartDataGridColumn[]>(
    () => [
      {
        key: "unitName",
        label: "Unit",
        sticky: true,
        filterKey: "carId",
        filterOptions: references.units,
        renderCell: (value, row) => (
          <Link href={`/units/${String(row.carId)}`} className="text-app-accent-ink hover:text-app-accent-ink">
            {String(value)}
          </Link>
        ),
      },
      { key: "taskDate", label: "Tanggal", kind: "mono" },
      {
        key: "divisionName",
        label: "Divisi",
        filterKey: "divisionId",
        filterOptions: references.divisions,
      },
      {
        key: "employeeName",
        label: "PIC",
        filterKey: "employeeId",
        filterOptions: references.employees,
      },
      { key: "panelName", label: "Panel / Part" },
      { key: "masterJobName", label: "Job Description",
        renderCell: (_value, row) => String(row.masterJobName ?? row.jobDescription ?? row.panelName ?? "-") },
      { key: "jobDescription", label: "Instruksi Kerja",
        renderCell: (_value, row) => String(row.instructionText || row.jobDescription || "-") },
      { key: "targetDailyHours", label: "Target Hari Ini", align: "right",
        renderCell: (_value, row) => {
          const value = row.targetDailyHours as number | null | undefined;
          return value === null || value === undefined ? "-" : Number(value).toFixed(1);
        } },
      { key: "targetTotalHours", label: "Target Total", align: "right",
        renderCell: (_value, row) => {
          const value = row.targetTotalHours as number | null | undefined;
          return value === null || value === undefined ? "-" : Number(value).toFixed(1);
        } },
      { key: "progressPercent", label: "% Progress", kind: "number", align: "right" },

      {
        key: "remainingHours",
        label: "Sisa Target",
        kind: "number",
        align: "right",
      },
      {
        key: "actualTimeRange",
        label: "Waktu Aktual",
        widthClassName: "min-w-[200px]",
        renderCell: (_, row) => {
          const actualStart = row.actualStartTime ?? row.latestStartTime;
          const actualFinish = row.actualFinishTime ?? row.latestFinishTime;
          const start = actualStart
            ? fmtTime(actualStart)
            : "-";
          const finish = actualFinish
            ? fmtTime(actualFinish)
            : "-";
          const breakMins = Number(row.actualBreakMinutes ?? row.latestBreakDurationMinutes ?? 0);
          const actualDuration = row.actualDurationHours as number | null | undefined;
          const totalHours = actualDuration ?? Number(row.totalActualHours ?? 0);

          if (start === "-" && finish === "-") {
            return <span className="text-[11px] text-foreground/20">Belum ada aktual</span>;
          }

          return (
            <div className="flex flex-col gap-1 text-[11px]">
              <span className="font-mono text-foreground/80">
                {start} — {finish}
              </span>
              <div className="flex gap-3 text-foreground/45">
                <span>Total: <span className="font-mono text-app-accent-ink/80">{totalHours}j</span></span>
                {breakMins > 0 && (
                  <span>Istirahat: <span className="font-mono text-app-accent-ink/80">{breakMins}m</span></span>
                )}
              </div>
            </div>
          );
        },
      },
      {
        key: "executionStatus",
        label: "Status Kerja",
        kind: "status",
        filterKey: "actualStatus",
        filterOptions: [
          { label: "Plan", value: "PLAN" },
          { label: "Onprogress", value: "ONPROGRESS" },
          { label: "Submitted", value: "SUBMITTED" },
          { label: "Done", value: "DONE" },
          { label: "Cancel", value: "CANCEL" },
        ],
      },
      {
        key: "submittedToLedger",
        label: "Rekapan",
        align: "center",
        renderCell: (_value, row) => row.submittedToLedger ? (
          <span className="border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-600">Sudah masuk</span>
        ) : (
          <span className="border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[10px] font-semibold text-amber-600">Belum masuk</span>
        ),
      },
      {
        key: "ledgerAction", label: "Aksi Rekapan", align: "center",
        renderCell: (_value, row) => {
          const actualId = String(row.actualId ?? "");
          if (row.submittedToLedger || !actualId) return "-";
          return <button type="button" disabled={ledgerSubmittingId === actualId} onClick={async () => {
            if (!window.confirm("Masukkan actual ini ke work ledger dan report AR? Data akan dikunci.")) return;
            setLedgerSubmittingId(actualId);
            const result = await submitMonitoringActualToLedger(actualId);
            setLedgerSubmittingId(null);
            if (!result.success) { window.alert(result.message); return; }
            router.refresh();
          }} className="border border-primary/40 px-2 py-1 text-[10px] font-semibold text-app-accent-ink disabled:opacity-40">{ledgerSubmittingId === actualId ? "Memproses..." : "Masukkan Rekapan"}</button>;
        },
      },
      { key: "monitoringStatus", label: "Monitoring", kind: "status",
        renderCell: (_value, row) => String(row.monitoringStatus ?? "-") },
      { key: "monitoringResult", label: "Catatan Monitoring", widthClassName: "min-w-[180px]" },
    ],
    [ledgerSubmittingId, references, router],
  );

  const filters: SmartDataGridFilterDefinition[] = [
    { field: "divisionId",   label: "Divisi",  options: references.divisions },
    { field: "carId",        label: "Unit",    options: references.units },
    { field: "employeeId",   label: "PIC",     options: references.employees },
    { field: "actualStatus", label: "Actual",  options: [
      { label: "Plan",       value: "PLAN"       },
      { label: "Onprogress", value: "ONPROGRESS" },
      { label: "Submitted",  value: "SUBMITTED"  },
      { label: "Done",       value: "DONE"       },
      { label: "Cancel",     value: "CANCEL"     },
    ]},
  ];

  function pushDate(value: string) {
    const p = new URLSearchParams(searchParams.toString());
    p.set("date", value);
    if (isRangeMode) {
      p.set("dateTo", activeDateTo < value ? value : activeDateTo);
    } else {
      p.delete("dateTo");
    }
    p.set("page", "1");
    router.push(`${pathname}?${p.toString()}`);
  }

  function pushDateRange(range: { from: string; to: string }) {
    const p = new URLSearchParams(searchParams.toString());
    const start = range.from;
    const end = range.to < start ? start : range.to;
    p.set("date", start);
    p.set("dateTo", end);
    p.set("page", "1");
    router.push(`${pathname}?${p.toString()}`);
  }

  function applyDateSelection(range: { from: string; to: string }) {
    if (range.from === range.to) {
      const p = new URLSearchParams(searchParams.toString());
      p.set("date", range.from);
      p.delete("dateTo");
      p.set("page", "1");
      router.push(`${pathname}?${p.toString()}`);
      return;
    }

    pushDateRange(range);
  }

  function pushDateMode(value: "daily" | "range") {
    const p = new URLSearchParams(searchParams.toString());
    if (value === "range") {
      p.set("dateTo", state.dateTo && state.dateTo !== state.date ? state.dateTo : addDaysIso(state.date, 1));
    } else {
      p.delete("dateTo");
    }
    p.set("page", "1");
    router.push(`${pathname}?${p.toString()}`);
  }

  function pushMode(value: "all" | "normal" | "overtime") {
    const p = new URLSearchParams(searchParams.toString());
    p.set("mode", value);
    p.set("page", "1");
    router.push(`${pathname}?${p.toString()}`);
  }

  return (
    <div className="space-y-2">
      {/* ── Header ── */}
      <PageHeader
        eyebrow="Job Monitoring"
        title={title}
        actions={
          <>
            <button
              type="button"
              onClick={() => pushDateMode("daily")}
              className={[
                "border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors",
                !isRangeMode
                  ? "border-primary/30 bg-primary/10 text-app-accent-ink"
                  : "border-white/10 text-foreground/40 hover:text-foreground",
              ].join(" ")}
            >
              Harian
            </button>
            <button
              type="button"
              onClick={() => pushDateMode("range")}
              className={[
                "border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors",
                isRangeMode
                  ? "border-primary/30 bg-primary/10 text-app-accent-ink"
                  : "border-white/10 text-foreground/40 hover:text-foreground",
              ].join(" ")}
            >
              Rentang
            </button>
            {isRangeMode ? (
              <CompactDateRangeInput
                from={state.date}
                to={activeDateTo}
                onChange={applyDateSelection}
                selectionBehavior="single-or-range"
                className="w-64"
              />
            ) : (
              <CompactDateInput
                value={state.date}
                onChange={pushDate}
                className="w-40"
              />
            )}
            <span className="mx-1 h-5 w-px bg-white/10" />
            <button
              type="button"
              onClick={() => pushMode("all")}
              className={[
                "border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors",
                activeMode === "all"
                  ? "border-primary/30 bg-primary/10 text-app-accent-ink"
                  : "border-white/10 text-foreground/40 hover:text-foreground",
              ].join(" ")}
            >
              Semua
            </button>
            <button
              type="button"
              onClick={() => pushMode("normal")}
              className={[
                "border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors",
                activeMode === "normal"
                  ? "border-primary/30 bg-primary/10 text-app-accent-ink"
                  : "border-white/10 text-foreground/40 hover:text-foreground",
              ].join(" ")}
            >
              Normal
            </button>
            <button
              type="button"
              onClick={() => pushMode("overtime")}
              className={[
                "border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors",
                activeMode === "overtime"
                  ? "border-primary/30 bg-primary/10 text-app-accent-ink"
                  : "border-white/10 text-foreground/40 hover:text-foreground",
              ].join(" ")}
            >
              Lembur
            </button>
            <ActionButton onClick={() => router.refresh()}>
              <RefreshCcw className="h-3 w-3" />Refresh
            </ActionButton>
          </>
        }
      />

      {/* ── Metrics ── */}
      <MetricBar items={[
        { label: "Aktif",         value: summary.activeWork, tone: "up" },
        { label: "No Start",      value: summary.noStart,   tone: summary.noStart  > 0 ? "warn" : undefined },
        { label: "No Submit",     value: summary.noSubmit,  tone: summary.noSubmit > 0 ? "warn" : undefined },
        { label: "Lembur Aktif",  value: summary.overtimeCount, tone: summary.overtimeCount > 0 ? "warn" : undefined },
      ]} />

      {/* ── Grid ── */}
      <SmartDataGrid
        viewportClassName="max-h-[calc(100svh-260px)]"
        title={title}
        description=""
        rows={rows} columns={columns} meta={meta} state={state}
        filters={filters} sortOptions={sortOptions} savedViews={savedViews}
        searchPlaceholder="Cari unit, panel, PIC, atau job desc..."
      />

      {/* ── Board lists ── */}
      <div className="grid gap-3 xl:grid-cols-2">
        <BoardList title="No Start"  rows={noStartRows}  emptyMessage="Semua plan sudah mulai." />
        <BoardList title="No Submit" rows={noSubmitRows} emptyMessage="Tidak ada task tertahan." />
      </div>
    </div>
  );
}
