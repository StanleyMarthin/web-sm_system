"use client";

import { GRID_LIMIT_OPTIONS, validateBulkGridInput } from "@smsystem/contracts/grid";
import type { GridQueryState } from "@smsystem/contracts/grid";
import { Database, Download, Filter, Search, Table2 } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useDeferredValue, useState, useEffect } from "react";
import { DataGridStatusBadge } from "@/shared/datagrid/status-badge";
import type {
  SmartDataGridBulkInsertConfig,
  SmartDataGridCellValue,
  SmartDataGridColumn,
  SmartDataGridFilterDefinition,
  SmartDataGridRow,
  SmartDataGridSavedView,
  SmartDataGridSortOption,
} from "@/shared/datagrid/types";
import { SearchableSelect } from "@/shared/ui/compact";
import { useDataGridState } from "@/shared/datagrid/use-data-grid-state";

interface SmartDataGridProps {
  title: string;
  description: string;
  columns: SmartDataGridColumn[];
  rows: Array<Record<string, SmartDataGridCellValue>>;
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  state: GridQueryState;
  searchPlaceholder?: string;
  filters?: SmartDataGridFilterDefinition[];
  sortOptions?: SmartDataGridSortOption[];
  savedViews?: SmartDataGridSavedView[];
  exportHref?: string;
  bulkInsert?: SmartDataGridBulkInsertConfig;
  onBulkSubmit?: (input: string, rows: Array<Record<string, string>>) => void | Promise<void>;
  isBulkSubmitting?: boolean;
  bulkSubmitLabel?: string;
  emptyMessage?: string;
  headerActions?: ReactNode;
  selectionEnabled?: boolean;
  selectedKeys?: Set<string>;
  onSelectionChange?: (keys: Set<string>) => void;
  rowKeyField?: string;
  prependRow?: ReactNode;
  topContent?: ReactNode;
  viewportClassName?: string;
  onRowClick?: (row: SmartDataGridRow) => void;
  getRowAriaLabel?: (row: SmartDataGridRow) => string;
  showControls?: boolean;
}

const inputCls =
  "h-8 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 text-[12px] text-white outline-none transition-colors focus:border-amber-500/30 [color-scheme:dark]";

function getCellAlignment(column: SmartDataGridColumn): string {
  if (column.align === "center") return "text-center";
  if (column.align === "right")  return "text-right";
  return "text-left";
}

function renderCellValue(column: SmartDataGridColumn, value: SmartDataGridCellValue) {
  if (column.kind === "status") return <DataGridStatusBadge value={value} />;
  if (value === null || value === "") return <span className="text-white/25">-</span>;
  if (column.kind === "mono")   return <span className="font-mono text-[11px] text-amber-500/90">{String(value)}</span>;
  if (column.kind === "number") return <span className="tabular-nums">{String(value)}</span>;
  return <span>{String(value)}</span>;
}

function isInteractiveTarget(target: EventTarget | null, currentTarget?: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false;
  }

  const closest = target.closest("button, a, input, select, textarea, [role='button']");
  if (!closest) {
    return false;
  }

  // If the interactive element found is the row itself (currentTarget), allow the click
  if (currentTarget && closest === currentTarget) {
    return false;
  }

  return true;
}

interface TableFilterInputProps {
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
  listId?: string;
}

function TableFilterInput({ value, onChange, placeholder, listId }: TableFilterInputProps) {
  const [localValue, setLocalValue] = useState(value);
  const [timeoutId, setTimeoutId] = useState<ReturnType<typeof setTimeout> | null>(null);

  // Sync when parent value changes
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [timeoutId]);

  const triggerChange = (val: string) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      setTimeoutId(null);
    }
    onChange(val);
  };

  const handleInputChange = (val: string) => {
    setLocalValue(val);

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    const nextTimeout = setTimeout(() => {
      onChange(val);
      setTimeoutId(null);
    }, 300);

    setTimeoutId(nextTimeout);
  };

  return (
    <input
      type="text"
      list={listId}
      value={localValue}
      onChange={(e) => handleInputChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          triggerChange(localValue);
        }
      }}
      placeholder={placeholder}
      className="w-full rounded border border-white/[0.08] bg-[#0a0a0a] px-2 py-1 h-6 text-[10px] text-white outline-none focus:border-amber-500/30"
    />
  );
}

export function SmartDataGrid({
  title, description, columns, rows, meta, state,
  searchPlaceholder = "Cari data...",
  filters = [], sortOptions = [], savedViews = [],
  exportHref, bulkInsert, onBulkSubmit,
  isBulkSubmitting = false, bulkSubmitLabel = "Simpan Bulk",
  emptyMessage = "Belum ada data untuk query saat ini.",
  headerActions,
  selectionEnabled,
  selectedKeys = new Set(),
  onSelectionChange,
  rowKeyField = "id",
  prependRow,
  topContent,
  viewportClassName,
  onRowClick,
  getRowAriaLabel,
  showControls = true,
}: SmartDataGridProps) {
  const gridState = useDataGridState(state);
  void filters;
  void sortOptions;
  const [bulkModeOpen, setBulkModeOpen] = useState(false);
  const [bulkInput, setBulkInput] = useState("");
  const [showFilterRow, setShowFilterRow] = useState(false);
  const deferredBulkInput = useDeferredValue(bulkInput);

  const bulkValidation =
    bulkInsert && deferredBulkInput
      ? validateBulkGridInput(deferredBulkInput, { requiredColumns: bulkInsert.requiredColumns })
      : null;

  return (
    <div className="rounded-[14px] border border-white/[0.06] bg-[#0a0a0a]">

      {/* ── Grid header: title + view tabs ── */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.05] px-3 py-2">
        <div className="flex items-center gap-2">
          <Table2 className="h-3.5 w-3.5 shrink-0 text-amber-500/60" />
          <p className="text-[11px] font-medium text-white">{title}</p>
          {description.trim() ? <span className="text-[10px] text-white/25">{description}</span> : null}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {headerActions}
          {savedViews.map((view) => (
            <button key={view.id} type="button"
              onClick={() => gridState.applySavedView(view)}
              className={[
                "rounded-lg px-2 py-1 text-[10px] uppercase tracking-wider transition-colors",
                state.view === view.id
                  ? "bg-amber-500/12 text-amber-300 ring-1 ring-amber-500/30"
                  : "bg-white/[0.03] text-white/35 ring-1 ring-white/[0.05] hover:text-white/60",
              ].join(" ")}
            >
              {view.label}
            </button>
          ))}
          {bulkInsert && (
            <button type="button"
              onClick={() => setBulkModeOpen((v) => !v)}
              className="rounded-lg bg-white/[0.03] px-2 py-1 text-[10px] uppercase tracking-wider text-white/40 ring-1 ring-white/[0.05] hover:text-white/65"
            >
              Input Banyak
            </button>
          )}
          {exportHref && (
            <Link href={exportHref}
              className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-black hover:bg-amber-400"
            >
              <Download className="h-3 w-3" />CSV
            </Link>
          )}
        </div>
      </div>

      {/* ── Filter + search row ── */}
      {showControls ? (
      <div className="border-b border-white/[0.05] px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <form className="relative"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const kw = fd.get("search");
              gridState.setSearch(typeof kw === "string" ? kw.trim() : "");
            }}
          >
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-white/25" />
            <input key={state.search} name="search" defaultValue={state.search}
              placeholder={searchPlaceholder}
              className={`${inputCls} pl-7 pr-3 w-56`}
            />
          </form>

          <button
            type="button"
            onClick={() => setShowFilterRow(!showFilterRow)}
            className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-[11px] transition-colors ${
              showFilterRow
                ? "border-amber-500/30 bg-amber-500/10 text-amber-500"
                : "border-white/[0.08] bg-transparent text-white/40 hover:bg-white/[0.03] hover:text-white/70"
            }`}
          >
            <Filter className="h-3.5 w-3.5" />
            <span>Filter Tabel</span>
          </button>
        </div>

        {/* Meta info */}
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] text-white/25">
          <span>Total {meta.total} data</span>
          {meta.totalPages > 1 ? (
            <>
              <span>·</span>
              <span>Halaman {meta.page} / {meta.totalPages}</span>
            </>
          ) : null}
          {gridState.isPending ? (
            <>
              <span>·</span>
              <span>Memuat...</span>
            </>
          ) : null}
        </div>
      </div>
      ) : null}

      {/* ── Bulk insert panel ── */}
      {bulkModeOpen && bulkInsert ? (
        <div className="border-b border-white/[0.05] px-3 py-3">
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,0.9fr)]">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <Database className="h-3.5 w-3.5 text-white/40" />
                <p className="text-[11px] font-medium text-white">{bulkInsert.title}</p>
                <p className="text-[10px] text-white/30">{bulkInsert.description}</p>
              </div>
              <textarea value={bulkInput} onChange={(e) => setBulkInput(e.target.value)}
                placeholder={bulkInsert.template}
                className="min-h-32 w-full rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-2 font-mono text-[11px] leading-5 text-white outline-none placeholder:text-white/15 focus:border-amber-500/30"
              />
            </div>

            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
              <p className="text-[10px] uppercase tracking-wider text-amber-500/60">Pratinjau</p>
              <pre className="mt-2 overflow-x-auto rounded-lg bg-black/40 p-2 text-[10px] leading-5 text-white/50">
                {bulkInsert.template}
              </pre>

              {bulkValidation ? (
                <div className="mt-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg border border-white/[0.05] bg-black/30 px-2 py-1.5">
                      <p className="text-[9px] uppercase tracking-wider text-white/25">Baris</p>
                      <p className="mt-1 text-[14px] text-white">{bulkValidation.rowCount}</p>
                    </div>
                    <div className="rounded-lg border border-white/[0.05] bg-black/30 px-2 py-1.5">
                      <p className="text-[9px] uppercase tracking-wider text-white/25">Status</p>
                      <p className={`mt-1 text-[14px] ${bulkValidation.isValid ? "text-emerald-300" : "text-red-300"}`}>
                        {bulkValidation.isValid ? "Siap" : "Cek"}
                      </p>
                    </div>
                  </div>

                  {bulkValidation.issues.length > 0 && (
                    <div className="rounded-lg border border-red-500/15 bg-red-500/6 p-2 text-[10px] text-red-200/80 space-y-1">
                      {bulkValidation.issues.map((issue) => (
                        <p key={`${issue.rowNumber}-${issue.field}`}>
                          Baris {issue.rowNumber} · {issue.field} · {issue.message}
                        </p>
                      ))}
                    </div>
                  )}

                  {onBulkSubmit && (
                    <button type="button"
                      disabled={!bulkValidation.isValid || isBulkSubmitting}
                      onClick={() => { void onBulkSubmit(bulkInput, bulkValidation.rows); }}
                      className="w-full rounded-lg bg-amber-500 px-3 py-1.5 text-[11px] font-semibold text-black hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {isBulkSubmitting ? "Menyimpan..." : bulkSubmitLabel}
                    </button>
                  )}
                </div>
              ) : (
                <p className="mt-3 text-[11px] text-white/30">Tempel data dari spreadsheet untuk melihat validasi.</p>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {topContent ? topContent : null}

      {/* ── Table ── */}
      <div className={["overflow-auto", viewportClassName ?? ""].join(" ").trim()}>
        <table className="min-w-full border-separate border-spacing-0">
          <thead>
            <tr>
              {selectionEnabled && (
                <th className="sticky left-0 top-0 z-30 border-b border-white/[0.05] bg-[#0a0a0a] px-3 py-2 w-[40px]">
                  <input type="checkbox"
                    checked={rows.length > 0 && selectedKeys.size === rows.length}
                    onChange={(e) => {
                      if (!onSelectionChange) return;
                      if (e.target.checked) {
                        const all = new Set(rows.map(r => String(r[rowKeyField])));
                        onSelectionChange(all);
                      } else {
                        onSelectionChange(new Set());
                      }
                    }}
                    className="h-3.5 w-3.5 rounded border-white/20 bg-white/5 accent-amber-500"
                  />
                </th>
              )}
              {columns.map((column, index) => (
                <th key={column.key}
                  className={[
                    "sticky top-0 z-20 border-b border-white/[0.05] bg-[#0a0a0a] px-3 py-2 text-[10px] font-medium uppercase tracking-[0.14em] text-white/30",
                    getCellAlignment(column),
                    column.widthClassName ?? "",
                    (column.sticky || index === 0) && !selectionEnabled ? "left-0 z-30" : "",
                  ].join(" ")}
                >
                  <div className="flex flex-col gap-1.5">
                    <div className={`flex items-center gap-1.5 ${column.sortable ? "cursor-pointer hover:text-white/60 transition-colors" : ""}`}
                         onClick={() => {
                           if (column.sortable && column.sortKey) {
                             const newDir = state.sortBy === column.sortKey && state.sortDirection === "asc" ? "desc" : "asc";
                             gridState.setSort(column.sortKey, newDir);
                           }
                         }}>
                      <span>{column.hideHeader ? <span className="sr-only">{column.label}</span> : column.label}</span>
                      {column.sortable && (
                        <div className="flex text-[10px] leading-none opacity-50 ml-1">
                          <span className={state.sortBy === column.sortKey && state.sortDirection === "asc" ? "text-amber-500 font-bold" : ""}>↑</span>
                          <span className={state.sortBy === column.sortKey && state.sortDirection === "desc" ? "text-amber-500 font-bold" : ""}>↓</span>
                        </div>
                      )}
                    </div>
                  </div>
                </th>
              ))}
            </tr>
            {showFilterRow && (
              <tr className="bg-[#111]">
                {selectionEnabled && (
                  <th className="sticky left-0 z-30 border-b border-white/[0.05] bg-[#111] p-1.5" />
                )}
                 {columns.map((column, index) => (
                  <th key={`filter-${column.key}`}
                    className={[
                      "border-b border-white/[0.05] p-1.5 bg-[#111]",
                      (column.sticky || index === 0) && !selectionEnabled ? "sticky left-0 z-30" : "",
                    ].join(" ")}
                  >
                    {column.filterKey ? (
                      column.filterOptions ? (
                        <select
                          value={state.filters.find(f => f.field === column.filterKey)?.value ?? ""}
                          onChange={(e) => gridState.setFilter(column.filterKey!, e.target.value)}
                          className="w-full rounded border border-white/[0.08] bg-[#0a0a0a] px-2 py-1 h-6 text-[10px] text-white outline-none focus:border-amber-500/30"
                        >
                          <option value="">{column.label}</option>
                          {column.filterOptions.map((opt) => (
                            <option key={opt.value} value={opt.value} className="bg-[#0a0a0a] text-white">
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <TableFilterInput
                          value={state.filters.find(f => f.field === column.filterKey)?.value ?? ""}
                          onChange={(val) => gridState.setFilter(column.filterKey!, val)}
                          placeholder={column.label}
                        />
                      )
                    ) : null}
                  </th>
                ))}
              </tr>
            )}
          </thead>
          <tbody>
            {prependRow}
            {rows.length > 0 ? (
              rows.map((row, rowIndex) => {
                const rKey = String(row[rowKeyField] ?? rowIndex);
                const isSelected = selectedKeys.has(rKey);
                const rowClickable = typeof onRowClick === "function";
                return (
                  <tr
                    key={`${rowIndex}-${rKey}`}
                    className={[
                      isSelected ? "bg-amber-500/5" : "",
                      rowClickable ? "cursor-pointer transition-colors hover:bg-white/[0.03]" : "hover:bg-white/[0.02]",
                    ].join(" ").trim()}
                    onClick={(event) => {
                      if (!onRowClick || isInteractiveTarget(event.target, event.currentTarget)) {
                        return;
                      }

                      onRowClick(row);
                    }}
                    onKeyDown={(event) => {
                      if (!onRowClick || isInteractiveTarget(event.target, event.currentTarget)) {
                        return;
                      }

                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onRowClick(row);
                      }
                    }}
                    tabIndex={rowClickable ? 0 : undefined}
                    role={rowClickable ? "button" : undefined}
                    aria-label={rowClickable ? (getRowAriaLabel?.(row) ?? "Buka detail baris") : undefined}
                  >
                    {selectionEnabled && (
                      <td className="sticky left-0 border-b border-white/[0.04] bg-[#0a0a0a] px-3 py-2">
                        <input type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (!onSelectionChange) return;
                            const next = new Set(selectedKeys);
                            if (e.target.checked) next.add(rKey);
                            else next.delete(rKey);
                            onSelectionChange(next);
                          }}
                          className="h-3.5 w-3.5 rounded border-white/20 bg-white/5 accent-amber-500"
                        />
                      </td>
                    )}
                    {columns.map((column, colIndex) => (
                      <td key={column.key}
                        className={[
                          "border-b border-white/[0.04] px-3 py-2 text-[12px] text-white/70",
                          getCellAlignment(column),
                          (column.sticky || colIndex === 0) && !selectionEnabled
                            ? rowClickable
                              ? "sticky left-0 bg-[#0d0d0d]"
                              : "sticky left-0 bg-[#0a0a0a]"
                            : "",
                        ].join(" ")}
                      >
                        {column.renderCell
                          ? column.renderCell(row[column.key] ?? null, row)
                          : renderCellValue(column, row[column.key] ?? null)}
                      </td>
                    ))}
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={columns.length}
                  className="px-4 py-8 text-center text-[12px] text-white/30"
                >
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ── */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.05] p-3">
        <p className="text-[10px] text-white/25">
          {rows.length > 0
            ? `${(meta.page - 1) * meta.limit + 1} – ${Math.min(meta.page * meta.limit, meta.total)} dari ${meta.total} baris`
            : "0 – 0 dari 0 baris"}
          {selectionEnabled && selectedKeys.size > 0 && ` (${selectedKeys.size} terpilih)`}
        </p>
        <div className="flex items-center gap-2">
          <SearchableSelect
            value={String(state.limit)}
            onChange={(v) => gridState.setLimit(Number(v))}
            options={GRID_LIMIT_OPTIONS.map((l) => ({ value: String(l), label: `${l} / page` }))}
            className="w-28"
          />
          <div className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] p-1">
            <button type="button" disabled={!meta.hasPrev || gridState.isPending}
              onClick={() => gridState.setPage(meta.page - 1)}
              className="rounded px-3 py-1 text-[11px] text-white/50 transition-colors hover:bg-white/[0.08] hover:text-white disabled:pointer-events-none disabled:opacity-30"
            >
              ← Sebelumnya
            </button>
            <button type="button" disabled={!meta.hasNext || gridState.isPending}
              onClick={() => gridState.setPage(meta.page + 1)}
              className="rounded bg-amber-500/10 px-3 py-1 text-[11px] font-medium text-amber-400 transition-colors hover:bg-amber-500/20 disabled:pointer-events-none disabled:opacity-30"
            >
              Berikutnya →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
