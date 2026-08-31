/* Hallmark · pre-emit critique: P5 H5 E4 S5 R5 V4 */
/* Hallmark · component: report toolbar · genre: editorial · theme: existing project tokens
 * states: default · hover · focus · active · disabled · loading · error · success
 * contrast: existing application token contract
 */
"use client";

import type {
  ReportColumn,
  ReportDefinition,
  ReportQuery,
  ReportRow,
  ReportSummaryItem,
  ReportType,
} from "@smsystem/contracts/reports";
import { encodeGridFilterToken } from "@smsystem/contracts/grid";
import { BarChart3, Download, RefreshCcw } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { SmartDataGrid } from "@/shared/datagrid/smart-data-grid";
import type { SmartDataGridColumn } from "@/shared/datagrid/types";
import { useDataGridState } from "@/shared/datagrid/use-data-grid-state";
import { CompactDateInput, CompactDateRangeInput, SearchableSelect } from "@/shared/ui/compact";

interface ReportsShellProps {
  activeType: ReportType;
  canExport: boolean;
  rows: ReportRow[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  query: ReportQuery;
  definition: ReportDefinition;
  summary: ReportSummaryItem[];
}

function SummaryCard({
  label,
  value,
  helper,
}: ReportSummaryItem) {
  return (
    <div className="border border-border dark:border-white/[0.05] bg-white dark:bg-card px-3 py-2">
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground dark:text-foreground/30">{label}</p>
      <p className="mt-1 font-mono text-[13px] text-foreground dark:text-foreground">{value}</p>
      <p className="mt-1 text-[11px] text-muted-foreground dark:text-foreground/40">{helper}</p>
    </div>
  );
}

function buildExportHref(
  activeType: ReportType,
  dateFrom: string,
  dateTo: string,
  filters: Record<string, string>,
) {
  const params = new URLSearchParams({ format: "xlsx", dateFrom, dateTo });
  for (const [field, value] of Object.entries(filters)) {
    if (value) params.append("filter", encodeGridFilterToken({ field, operator: "eq", value }));
  }
  return `/api/reports/${activeType}/export?${params.toString()}`;
}

function mapColumns(columns: ReportColumn[]): SmartDataGridColumn[] {
  return columns.map((column) => ({
    key: column.key,
    label: column.label,
    kind: column.kind,
    align: column.align,
    sticky: column.sticky,
  }));
}

function addDaysIso(baseDate: string, days: number): string {
  const date = new Date(`${baseDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function ReportsShell({
  activeType,
  canExport,
  rows,
  meta,
  query,
  definition,
  summary,
}: ReportsShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const gridState = useDataGridState(query);
  const [isRefreshing, startRefresh] = useTransition();
  const [exportOpen, setExportOpen] = useState(false);
  const dateFrom = query.dateFrom ?? new Date().toISOString().slice(0, 10);
  const dateTo = query.dateTo ?? dateFrom;
  const activeSpan = searchParams.get("span") === "weekly" || dateFrom !== dateTo ? "weekly" : "daily";
  const [exportDateFrom, setExportDateFrom] = useState(dateFrom);
  const [exportDateTo, setExportDateTo] = useState(dateTo);
  const [exportFilters, setExportFilters] = useState<Record<string, string>>({});

  function openExport() {
    setExportDateFrom(dateFrom);
    setExportDateTo(dateTo);
    setExportFilters(Object.fromEntries(query.filters.map((filter) => [filter.field, filter.value])));
    setExportOpen(true);
  }

  function setPeriod(from: string, to: string, span: "daily" | "weekly") {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", "1");
    params.set("dateFrom", from);
    params.set("dateTo", to);
    params.set("span", span);
    startRefresh(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }

  return (
    <div className="space-y-3">
      <section className="border border-border bg-white dark:border-white/[0.05] dark:bg-card">
        <div className="flex flex-col gap-3 border-b border-border px-3 py-3 dark:border-white/[0.05] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <BarChart3 className="h-4 w-4 shrink-0 text-app-accent-ink" />
            <h1 className="truncate text-[14px] font-semibold text-foreground">Rekapan</h1>
            <span className="hidden text-[12px] text-muted-foreground sm:inline">{meta.total} pekerjaan</span>
          </div>
          <div className="flex items-center gap-2">
            <button
            type="button"
            aria-label="Muat ulang rekapan"
            onClick={() => {
              startRefresh(() => {
                router.refresh();
              });
            }}
            className="inline-flex h-8 items-center gap-2 border border-border bg-transparent px-3 text-[11px] text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:opacity-50 dark:border-white/[0.08]"
          >
            <RefreshCcw className="h-3.5 w-3.5" />
            {isRefreshing ? "Memuat" : "Segarkan"}
          </button>
          {canExport ? (
            <button type="button" onClick={openExport} className="inline-flex h-8 items-center gap-2 whitespace-nowrap border border-primary/40 px-3 text-[11px] font-semibold text-app-accent-ink hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50">
              <Download className="h-3.5 w-3.5" />Unduh
            </button>
          ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-2 px-3 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex h-9 items-center border border-border p-1 dark:border-white/[0.08]">
              {(["daily", "weekly"] as const).map((span) => (
                <button key={span} type="button" onClick={() => setPeriod(dateFrom, span === "weekly" ? addDaysIso(dateFrom, 6) : dateFrom, span)} className={[
                  "h-7 px-3 text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                  activeSpan === span ? "bg-primary/10 font-semibold text-app-accent-ink" : "text-muted-foreground hover:text-foreground",
                ].join(" ")}>{span === "daily" ? "Harian" : "Mingguan"}</button>
              ))}
            </div>
            {activeSpan === "weekly" ? (
              <CompactDateRangeInput from={dateFrom} to={dateTo} onChange={(range) => setPeriod(range.from, range.to, range.from === range.to ? "daily" : "weekly")} selectionBehavior="single-or-range" className="w-full sm:w-64" />
            ) : (
              <CompactDateInput value={dateFrom} onChange={(value) => setPeriod(value, value, "daily")} className="w-full sm:w-64" />
            )}
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-5">
            {definition.filters.map((filter) => (
              <SearchableSelect key={filter.field} value={query.filters.find((item) => item.field === filter.field)?.value ?? ""} onChange={(value) => gridState.setFilter(filter.field, value)} options={filter.options} placeholder={filter.label} />
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-2 xl:grid-cols-[repeat(4,minmax(0,1fr))]">
        {summary.map((item) => (
          <SummaryCard key={item.label} {...item} />
        ))}
      </section>

      <SmartDataGrid
        showHeader={false}
        viewportClassName="max-h-[calc(100svh-260px)]"
        title={definition.title}
        description={definition.description}
        columns={mapColumns(definition.columns)}
        rows={rows}
        meta={meta}
        state={query}
        searchPlaceholder="Cari laporan..."
        filters={definition.filters}
        sortOptions={definition.sortOptions}
        emptyMessage="Belum ada data untuk filter yang sedang dipakai."
      />

      {exportOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4 backdrop-blur-[1px]">
          <div role="dialog" aria-modal="true" aria-labelledby="rekapan-export-title" className="w-full max-w-lg border border-border bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <p id="rekapan-export-title" className="text-sm font-semibold text-foreground">Unduh Rekapan</p>
              <button type="button" onClick={() => setExportOpen(false)} className="border border-border px-3 py-1 text-[11px] text-muted-foreground">Tutup</button>
            </div>
            <div className="space-y-3 p-4">
              <label className="block space-y-1 text-[11px] text-muted-foreground">
                Periode
                <CompactDateRangeInput from={exportDateFrom} to={exportDateTo} onChange={(range) => { setExportDateFrom(range.from); setExportDateTo(range.to); }} selectionBehavior="single-or-range" />
              </label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {definition.filters.map((filter) => (
                  <SearchableSelect key={filter.field} value={exportFilters[filter.field] ?? ""} onChange={(value) => setExportFilters((current) => ({ ...current, [filter.field]: value }))} options={filter.options} placeholder={filter.label} />
                ))}
              </div>
              <button type="button" onClick={() => setExportFilters({})} className="text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">Kosongkan filter</button>
            </div>
            <div className="flex justify-end border-t border-border px-4 py-3">
              <Link href={buildExportHref(activeType, exportDateFrom, exportDateTo, exportFilters)} onClick={() => setExportOpen(false)} className="inline-flex h-8 items-center gap-2 border border-primary/40 px-3 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-app-accent-ink hover:bg-primary/10">
                <Download className="h-3.5 w-3.5" />Unduh XLSX
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
