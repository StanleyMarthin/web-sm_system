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
  searchMinLength?: number;
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
  "h-9 rounded-lg border border-gray-300 bg-white px-3 text-[13px] text-gray-950 outline-none transition-colors placeholder:text-gray-400 focus:border-amber-600/55 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white dark:placeholder:text-white/35 dark:focus:border-amber-500/45 dark:[color-scheme:dark]";

function getCellAlignment(column: SmartDataGridColumn): string {
  if (column.align === "center") return "text-center";
  if (column.align === "right")  return "text-right";
  return "text-left";
}

function renderCellValue(column: SmartDataGridColumn, value: SmartDataGridCellValue) {
  if (column.kind === "status") return <DataGridStatusBadge value={value} />;
  if (value === null || value === "") return <span className="text-gray-400 dark:text-white/35">-</span>;
  if (column.kind === "mono")   return <span className="font-mono text-[12px] text-amber-700 dark:text-amber-400">{String(value)}</span>;
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
      className="h-8 w-full rounded border border-gray-300 bg-white px-2.5 py-1 text-[12px] text-gray-950 outline-none placeholder:text-gray-400 focus:border-amber-600/55 dark:border-white/[0.08] dark:bg-[#0f0f12] dark:text-white dark:placeholder:text-white/35 dark:focus:border-amber-500/45"
    />
  );
}

export function SmartDataGrid({
  title, description, columns, rows, meta, state,
  searchPlaceholder = "Cari data...",
  searchMinLength = 0,
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
    <div className="rounded-[10px] border border-gray-200 bg-white shadow-sm dark:border-white/[0.08] dark:bg-[#0d0d10] dark:shadow-none">

      {/* ── Grid header: title + view tabs ── */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-3 py-2 dark:border-white/[0.05]">
        <div className="flex items-center gap-2">
          <Table2 className="h-4 w-4 shrink-0 text-amber-700/70 dark:text-amber-500/70" />
          <p className="text-[14px] font-semibold text-gray-950 dark:text-white">{title}</p>
          {description.trim() ? <span className="text-[12px] text-gray-600 dark:text-white/45">{description}</span> : null}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {headerActions}
          {savedViews.map((view) => (
            <button key={view.id} type="button"
              onClick={() => gridState.applySavedView(view)}
              className={[
                "rounded-lg px-2.5 py-1.5 text-[11px] uppercase tracking-wider transition-colors",
                state.view === view.id
                  ? "bg-amber-100 text-amber-800 ring-1 ring-amber-600/25 dark:bg-amber-500/12 dark:text-amber-300 dark:ring-amber-500/30"
                  : "bg-gray-50 text-gray-500 ring-1 ring-gray-200 hover:text-gray-900 dark:bg-white/[0.03] dark:text-white/35 dark:ring-white/[0.05] dark:hover:text-white/60",
              ].join(" ")}
            >
              {view.label}
            </button>
          ))}
          {bulkInsert && (
            <button type="button"
              onClick={() => setBulkModeOpen((v) => !v)}
              className="rounded-lg bg-gray-50 px-2.5 py-1.5 text-[11px] uppercase tracking-wider text-gray-600 ring-1 ring-gray-200 hover:text-gray-950 dark:bg-white/[0.04] dark:text-white/55 dark:ring-white/[0.08] dark:hover:text-white/80"
            >
              Input Banyak
            </button>
          )}
          {exportHref && (
            <Link href={exportHref}
              className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-white hover:bg-amber-500 dark:bg-amber-500 dark:text-black dark:hover:bg-amber-400"
            >
              <Download className="h-3 w-3" />CSV
            </Link>
          )}
        </div>
      </div>

      {/* ── Filter + search row ── */}
      {showControls ? (
      <div className="border-b border-gray-200 px-3 py-2 dark:border-white/[0.05]">
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <form className="relative"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const kw = fd.get("search");
              const nextSearch = typeof kw === "string" ? kw.trim() : "";
              if (nextSearch && nextSearch.length < searchMinLength) {
                return;
              }
              gridState.setSearch(nextSearch);
            }}
          >
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400 dark:text-white/35" />
            <input key={state.search} name="search" defaultValue={state.search}
              placeholder={searchPlaceholder}
              className={`${inputCls} w-64 pl-8 pr-3`}
            />
          </form>

          <button
            type="button"
            onClick={() => setShowFilterRow(!showFilterRow)}
            className={`flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[12px] transition-colors ${
              showFilterRow
                ? "border-amber-600/30 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-500"
                : "border-gray-300 bg-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-950 dark:border-white/[0.08] dark:text-white/40 dark:hover:bg-white/[0.03] dark:hover:text-white/70"
            }`}
          >
            <Filter className="h-3.5 w-3.5" />
            <span>Filter Tabel</span>
          </button>
        </div>

        {/* Meta info */}
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-gray-600 dark:text-white/45">
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
        <div className="border-b border-gray-200 px-3 py-3 dark:border-white/[0.05]">
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,0.9fr)]">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <Database className="h-3.5 w-3.5 text-gray-500 dark:text-white/40" />
                <p className="text-[12px] font-semibold text-gray-950 dark:text-white">{bulkInsert.title}</p>
                <p className="text-[11px] text-gray-500 dark:text-white/30">{bulkInsert.description}</p>
              </div>
              <textarea value={bulkInput} onChange={(e) => setBulkInput(e.target.value)}
                placeholder={bulkInsert.template}
                className="min-h-32 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-[12px] leading-5 text-gray-950 outline-none placeholder:text-gray-400 focus:border-amber-600/55 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white dark:placeholder:text-white/35 dark:focus:border-amber-500/45"
              />
            </div>

            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-white/[0.06] dark:bg-white/[0.02]">
              <p className="text-[11px] uppercase tracking-wider text-amber-700 dark:text-amber-500/70">Pratinjau</p>
              <pre className="mt-2 overflow-x-auto rounded-lg bg-white p-2 text-[11px] leading-5 text-gray-700 ring-1 ring-gray-200 dark:bg-black/40 dark:text-white/65 dark:ring-0">
                {bulkInsert.template}
              </pre>

              {bulkValidation ? (
                <div className="mt-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 dark:border-white/[0.05] dark:bg-black/30">
                      <p className="text-[10px] uppercase tracking-wider text-gray-600 dark:text-white/45">Baris</p>
                      <p className="mt-1 text-[14px] text-gray-950 dark:text-white">{bulkValidation.rowCount}</p>
                    </div>
                    <div className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 dark:border-white/[0.05] dark:bg-black/30">
                      <p className="text-[10px] uppercase tracking-wider text-gray-600 dark:text-white/45">Status</p>
                      <p className={`mt-1 text-[14px] ${bulkValidation.isValid ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"}`}>
                        {bulkValidation.isValid ? "Siap" : "Cek"}
                      </p>
                    </div>
                  </div>

                  {bulkValidation.issues.length > 0 && (
                    <div className="space-y-1 rounded-lg border border-red-600/20 bg-red-50 p-2 text-[12px] text-red-800 dark:border-red-500/15 dark:bg-red-500/6 dark:text-red-200/90">
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
                      className="w-full rounded-lg bg-amber-600 px-3 py-2 text-[12px] font-semibold text-white hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-amber-500 dark:text-black dark:hover:bg-amber-400"
                    >
                      {isBulkSubmitting ? "Menyimpan..." : bulkSubmitLabel}
                    </button>
                  )}
                </div>
              ) : (
                <p className="mt-3 text-[12px] text-gray-600 dark:text-white/45">Tempel data dari spreadsheet untuk melihat validasi.</p>
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
                  <th className="sticky left-0 top-0 z-30 w-[44px] border-b border-gray-200 bg-white px-3 py-3 dark:border-white/[0.06] dark:bg-[#0d0d10]">
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
                    className="h-3.5 w-3.5 rounded border-gray-300 bg-white accent-amber-600 dark:border-white/20 dark:bg-white/5 dark:accent-amber-500"
                  />
                </th>
              )}
              {columns.map((column, index) => (
                <th key={column.key}
                  className={[
                    "sticky top-0 z-20 border-b border-gray-200 bg-white px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-600 dark:border-white/[0.06] dark:bg-[#0d0d10] dark:text-white/50",
                    getCellAlignment(column),
                    column.widthClassName ?? "",
                    (column.sticky || index === 0) && !selectionEnabled ? "left-0 z-30" : "",
                  ].join(" ")}
                >
                  <div className="flex flex-col gap-1.5">
                    <div className={`flex items-center gap-1.5 ${column.sortable ? "cursor-pointer transition-colors hover:text-gray-950 dark:hover:text-white/85" : ""}`}
                         onClick={() => {
                           if (column.sortable && column.sortKey) {
                             const newDir = state.sortBy === column.sortKey && state.sortDirection === "asc" ? "desc" : "asc";
                             gridState.setSort(column.sortKey, newDir);
                           }
                         }}>
                      <span>{column.hideHeader ? <span className="sr-only">{column.label}</span> : column.label}</span>
                      {column.sortable && (
                        <div className="flex text-[10px] leading-none opacity-50 ml-1">
                          <span className={state.sortBy === column.sortKey && state.sortDirection === "asc" ? "text-amber-700 font-bold dark:text-amber-400" : ""}>↑</span>
                          <span className={state.sortBy === column.sortKey && state.sortDirection === "desc" ? "text-amber-700 font-bold dark:text-amber-400" : ""}>↓</span>
                        </div>
                      )}
                    </div>
                  </div>
                </th>
              ))}
            </tr>
            {showFilterRow && (
              <tr className="bg-gray-50 dark:bg-[#111]">
                {selectionEnabled && (
                <th className="sticky left-0 z-30 border-b border-gray-200 bg-gray-50 p-2 dark:border-white/[0.06] dark:bg-[#111]" />
                )}
                 {columns.map((column, index) => (
                  <th key={`filter-${column.key}`}
                    className={[
                      "border-b border-gray-200 bg-gray-50 p-2 dark:border-white/[0.06] dark:bg-[#111]",
                      (column.sticky || index === 0) && !selectionEnabled ? "sticky left-0 z-30" : "",
                    ].join(" ")}
                  >
                    {column.filterKey ? (
                      column.filterOptions ? (
                        <SearchableSelect
                          value={state.filters.find(f => f.field === column.filterKey)?.value ?? ""}
                          onChange={(value) => gridState.setFilter(column.filterKey!, value)}
                          options={column.filterOptions}
                          placeholder={column.label}
                        />
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
                      isSelected ? "bg-amber-50 dark:bg-amber-500/5" : "",
                      rowClickable ? "cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.03]" : "hover:bg-gray-50/70 dark:hover:bg-white/[0.02]",
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
                      <td className="sticky left-0 border-b border-gray-100 bg-white px-3 py-3 dark:border-white/[0.05] dark:bg-[#0d0d10]">
                        <input type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (!onSelectionChange) return;
                            const next = new Set(selectedKeys);
                            if (e.target.checked) next.add(rKey);
                            else next.delete(rKey);
                            onSelectionChange(next);
                          }}
                          className="h-3.5 w-3.5 rounded border-gray-300 bg-white accent-amber-600 dark:border-white/20 dark:bg-white/5 dark:accent-amber-500"
                        />
                      </td>
                    )}
                    {columns.map((column, colIndex) => (
                      <td key={column.key}
                        className={[
                          "border-b border-gray-100 px-3 py-3 text-[13.5px] leading-5 text-gray-800 dark:border-white/[0.05] dark:text-white/82",
                          getCellAlignment(column),
                          (column.sticky || colIndex === 0) && !selectionEnabled
                            ? rowClickable
                              ? "sticky left-0 bg-gray-50 dark:bg-[#101013]"
                              : "sticky left-0 bg-white dark:bg-[#0d0d10]"
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
                  className="px-4 py-8 text-center text-[13px] text-gray-600 dark:text-white/45"
                >
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ── */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 p-3 dark:border-white/[0.05]">
        <p className="text-[12px] text-gray-600 dark:text-white/50">
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
          <div className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-white/[0.08] dark:bg-white/[0.03]">
            <button type="button" disabled={!meta.hasPrev || gridState.isPending}
              onClick={() => gridState.setPage(meta.page - 1)}
              className="rounded px-3 py-1.5 text-[12px] text-gray-600 transition-colors hover:bg-white hover:text-gray-950 disabled:pointer-events-none disabled:opacity-30 dark:text-white/60 dark:hover:bg-white/[0.08] dark:hover:text-white"
            >
              ← Sebelumnya
            </button>
            <button type="button" disabled={!meta.hasNext || gridState.isPending}
              onClick={() => gridState.setPage(meta.page + 1)}
              className="rounded bg-amber-100 px-3 py-1.5 text-[12px] font-semibold text-amber-800 transition-colors hover:bg-amber-200 disabled:pointer-events-none disabled:opacity-30 dark:bg-amber-500/12 dark:text-amber-300 dark:hover:bg-amber-500/20"
            >
              Berikutnya →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
