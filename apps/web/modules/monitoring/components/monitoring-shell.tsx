"use client";

import { useMemo } from "react";
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
import { ActionButton, EmptyRow, MetricBar, PageHeader, SectionCard } from "@/shared/ui/compact";

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
            <div key={row.planId} className="border-b border-gray-300 dark:border-white/[0.05] px-2 py-2 last:border-b-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[12px] text-gray-950 dark:text-white">{row.unitName}</p>
                  <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-gray-500 dark:text-white/30">
                    {row.divisionName ?? "—"} · {row.panelName ?? row.jobDescription}
                  </p>
                  <p className="mt-0.5 text-[11px] text-gray-400 dark:text-white/40">
                    {row.employeeName ?? "Belum ada PIC"} · {row.taskDate}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-mono text-[11px] text-gray-700 dark:text-white/60">{row.remainingHours.toFixed(1)}j</p>
                  <p className="font-mono text-[10px] text-gray-500 dark:text-white/30">{row.progressPercent.toFixed(0)}%</p>
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
  { id: "delay-risk",     label: "Delay Risk",    sortBy: "remainingHours", sortDirection: "desc",
    filters: [{ field: "actualStatus", operator: "eq", value: "onprogress" } satisfies GridFilter] },
  { id: "pending-submit", label: "Pending Submit", sortBy: "taskDate", sortDirection: "desc",
    filters: [{ field: "actualStatus", operator: "eq", value: "onprogress" } satisfies GridFilter] },
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

  const columns = useMemo<SmartDataGridColumn[]>(
    () => [
      {
        key: "unitName",
        label: "Unit",
        sticky: true,
        filterKey: "carId",
        filterOptions: references.units,
        renderCell: (value, row) => (
          <Link href={`/units/${String(row.carId)}`} className="text-amber-400 hover:text-amber-300">
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
      { key: "panelName", label: "Panel" },
      { key: "jobDescription", label: "Job Desc" },
      { key: "progressPercent", label: "Progress", kind: "number", align: "right" },
      { key: "remainingHours", label: "Sisa Jam", kind: "number", align: "right" },
      { key: "planStatus", label: "Plan", kind: "status" },
      {
        key: "actualStatus",
        label: "Actual",
        kind: "status",
        filterKey: "actualStatus",
        filterOptions: [
          { label: "Pending", value: "pending" },
          { label: "Onprogress", value: "onprogress" },
          { label: "Done", value: "done" },
          { label: "Cancel", value: "cancel" },
        ],
      },
    ],
    [references],
  );

  const filters: SmartDataGridFilterDefinition[] = [
    { field: "divisionId",   label: "Divisi",  options: references.divisions },
    { field: "carId",        label: "Unit",    options: references.units },
    { field: "employeeId",   label: "PIC",     options: references.employees },
    { field: "actualStatus", label: "Actual",  options: [
      { label: "Pending",    value: "pending"    },
      { label: "Onprogress", value: "onprogress" },
      { label: "Done",       value: "done"       },
      { label: "Cancel",     value: "cancel"     },
    ]},
  ];

  function pushDate(value: string) {
    const p = new URLSearchParams(searchParams.toString());
    p.set("date", value); p.set("page", "1");
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
              onClick={() => pushMode("all")}
              className={[
                "border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors",
                activeMode === "all"
                  ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                  : "border-gray-300 dark:border-white/[0.08] text-gray-500 dark:text-white/50 hover:text-gray-950 dark:text-white",
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
                  ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                  : "border-gray-300 dark:border-white/[0.08] text-gray-500 dark:text-white/50 hover:text-gray-950 dark:text-white",
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
                  ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                  : "border-gray-300 dark:border-white/[0.08] text-gray-500 dark:text-white/50 hover:text-gray-950 dark:text-white",
              ].join(" ")}
            >
              Lembur
            </button>
            <input type="date" value={state.date}
              onChange={(e) => pushDate(e.target.value)}
              className="h-8 border border-gray-300 dark:border-white/[0.05] bg-slate-50 dark:bg-[#0a0a0c] px-2.5 font-mono text-[11px] text-gray-900 dark:text-white/80 outline-none focus:border-amber-500/30 [color-scheme:dark]" />
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
        { label: "Delay Risk",    value: summary.delayRisk, tone: summary.delayRisk > 0 ? "down" : undefined },
        { label: "Lembur Aktif",  value: summary.overtimeCount, tone: summary.overtimeCount > 0 ? "warn" : undefined },
      ]} />

      {/* ── Grid ── */}
      <SmartDataGrid
        title={title}
        description="Grid server-side task dari job actual, countdown, dan job plan."
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
