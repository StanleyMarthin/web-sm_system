"use client";

import type {
  ReportColumn,
  ReportDefinition,
  ReportQuery,
  ReportRow,
  ReportSummaryItem,
  ReportType,
} from "@smsystem/contracts/reports";
import { reportTypeOptions } from "@smsystem/contracts/reports";
import { BarChart3, Download, RefreshCcw } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { SmartDataGrid } from "@/shared/datagrid/smart-data-grid";
import type { SmartDataGridColumn } from "@/shared/datagrid/types";
import { CompactDateRangeInput } from "@/shared/ui/compact";

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
  pathname: string,
  searchParams: URLSearchParams,
  activeType: ReportType,
  format: "csv" | "xlsx",
) {
  const params = new URLSearchParams(searchParams.toString());
  params.set("format", format);
  const suffix = params.toString();
  return `/api/reports/${activeType}/export${suffix ? `?${suffix}` : ""}`;
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
  const [isRefreshing, startRefresh] = useTransition();
  const [dateFrom, setDateFrom] = useState(query.dateFrom ?? "");
  const [dateTo, setDateTo] = useState(query.dateTo ?? "");

  function applyDateRange() {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", "1");

    if (dateFrom) {
      params.set("dateFrom", dateFrom);
    } else {
      params.delete("dateFrom");
    }

    if (dateTo) {
      params.set("dateTo", dateTo);
    } else {
      params.delete("dateTo");
    }

    startRefresh(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }

  function clearDateRange() {
    setDateFrom("");
    setDateTo("");
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", "1");
    params.delete("dateFrom");
    params.delete("dateTo");
    startRefresh(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }

  return (
    <div className="space-y-3">
      <section className="border border-border dark:border-white/[0.05] bg-white dark:bg-card px-4 py-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center border border-border dark:border-white/[0.08] bg-muted dark:bg-background">
                <BarChart3 className="h-5 w-5 text-app-accent-ink" />
              </div>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground dark:text-foreground/30">
                  Laporan
                </p>
                <h2 className="mt-1 text-[13px] font-medium text-foreground dark:text-foreground">{definition.title}</h2>
              </div>
            </div>
            <p className="mt-2 text-[12px] text-muted-foreground dark:text-foreground/45">{definition.description}</p>
          </div>

          <button
            type="button"
            onClick={() => {
              startRefresh(() => {
                router.refresh();
              });
            }}
            className="inline-flex h-8 items-center gap-2 border border-border dark:border-white/[0.08] bg-transparent px-3 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground dark:text-foreground/55 hover:text-foreground dark:text-foreground/80"
          >
            <RefreshCcw className="h-3.5 w-3.5" />
            {isRefreshing ? "Memuat..." : "Muat Ulang"}
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5 border-y border-border dark:border-white/[0.05] py-2">
          {reportTypeOptions.map((option) => (
            <Link
              key={option.value}
              href={`/reports/${option.value}`}
              className={[
                "border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors",
                activeType === option.value
                  ? "border-primary/30 bg-transparent text-app-accent-ink"
                  : "border-border dark:border-white/[0.08] bg-transparent text-muted-foreground dark:text-foreground/40 hover:text-foreground dark:text-foreground/70",
              ].join(" ")}
            >
              {option.label}
            </Link>
          ))}
        </div>

        <div className="mt-3 grid gap-2 xl:grid-cols-[minmax(0,280px)_auto_auto]">
          <label className="space-y-1">
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground dark:text-foreground/30">
              Rentang Tanggal
            </span>
            <CompactDateRangeInput
              from={dateFrom}
              to={dateTo}
              onChange={(range) => {
                setDateFrom(range.from);
                setDateTo(range.to);
              }}
            />
          </label>

          <div className="flex items-end gap-2 xl:justify-end">
            <button
              type="button"
              onClick={applyDateRange}
              className="h-8 border border-primary/40 px-3 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-app-accent-ink transition-colors hover:bg-primary/10"
            >
              Terapkan
            </button>
            <button
              type="button"
              onClick={clearDateRange}
              className="h-8 border border-border dark:border-white/[0.08] bg-transparent px-3 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground dark:text-foreground/55 hover:text-foreground dark:text-foreground/80"
            >
              Reset
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-2 xl:grid-cols-[repeat(4,minmax(0,1fr))]">
        {summary.map((item) => (
          <SummaryCard key={item.label} {...item} />
        ))}
      </section>

      <SmartDataGrid
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
        headerActions={
          canExport ? (
            <>
              <Link
                href={buildExportHref(pathname, searchParams, activeType, "xlsx")}
                className="inline-flex h-8 items-center gap-2 border border-primary/40 px-3 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-app-accent-ink transition-colors hover:bg-primary/10"
              >
                <Download className="h-3.5 w-3.5" />
                Unduh XLSX
              </Link>
              <Link
                href={buildExportHref(pathname, searchParams, activeType, "csv")}
                className="inline-flex h-8 items-center gap-2 border border-border dark:border-white/[0.08] bg-transparent px-3 font-mono text-[10px] uppercase tracking-[0.12em] text-foreground/65 hover:text-foreground/85"
                >
                <Download className="h-3.5 w-3.5" />
                Unduh CSV
              </Link>
            </>
          ) : null
        }
      />
    </div>
  );
}
