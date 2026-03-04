"use client";

// ============================================================
// DataTable — Reusable spreadsheet-style table component
//
// Features:
//  • Checkbox row selection + select all
//  • Bulk action toolbar (appears when rows selected)
//  • Column sorting (↕ toggle)
//  • Search/filter bar
//  • Pagination with page size
//  • Row count display
//  • Empty state
// ============================================================

import { useState, useMemo, useCallback, type ReactNode } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { DarkCard } from "@/components/ui/dark-card";
import {
  Search, ChevronUp, ChevronDown, ChevronsUpDown,
  ChevronLeft, ChevronRight, Printer, Download, Pencil, Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ──

export interface DataTableColumn<T> {
  /** Unique key for the column */
  key: string;
  /** Header label */
  label: string;
  /** Whether the column is sortable (default: false) */
  sortable?: boolean;
  /** Text alignment */
  align?: "left" | "right" | "center";
  /** Custom render function for the cell */
  render: (row: T, index: number) => ReactNode;
  /** Optional header className override */
  headerClassName?: string;
  /** Optional cell className */
  cellClassName?: string;
  /** Sort value extractor — returns a string or number for comparison */
  sortValue?: (row: T) => string | number;
}

export interface BulkAction {
  label: string;
  icon?: ReactNode;
  variant?: "default" | "danger";
  onClick: (selectedKeys: string[]) => void;
}

export interface DataTableProps<T> {
  /** Data array */
  data: T[];
  /** Column definitions */
  columns: DataTableColumn<T>[];
  /** Unique key extractor per row */
  rowKey: (row: T) => string;
  /** Enable checkbox selection (default: false) */
  selectable?: boolean;
  /** Bulk actions (shown when rows are selected) */
  bulkActions?: BulkAction[];
  /** Enable search bar (default: true) */
  searchable?: boolean;
  /** Search placeholder */
  searchPlaceholder?: string;
  /** Search function — return true if row matches query */
  searchFn?: (row: T, query: string) => boolean;
  /** Page size (default: 15) */
  pageSize?: number;
  /** Show pagination (default: true if data.length > pageSize) */
  paginated?: boolean;
  /** Empty state message */
  emptyMessage?: string;
  /** Optional className for the outer DarkCard */
  className?: string;
}

type SortDir = "asc" | "desc" | null;

// ── Component ──

export function DataTable<T>({
  data,
  columns,
  rowKey,
  selectable = false,
  bulkActions,
  searchable = true,
  searchPlaceholder = "Cari...",
  searchFn,
  pageSize = 15,
  paginated = true,
  emptyMessage = "Tidak ada data.",
  className,
}: DataTableProps<T>) {
  // ── State ──
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);

  // ── Filtered data ──
  const filtered = useMemo(() => {
    if (!search.trim() || !searchFn) return data;
    const q = search.toLowerCase();
    return data.filter((row) => searchFn(row, q));
  }, [data, search, searchFn]);

  // ── Sorted data ──
  const sorted = useMemo(() => {
    if (!sortKey || !sortDir) return filtered;
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sortValue) return filtered;
    const extract = col.sortValue;
    return [...filtered].sort((a, b) => {
      const va = extract(a);
      const vb = extract(b);
      const cmp = typeof va === "number" && typeof vb === "number"
        ? va - vb
        : String(va).localeCompare(String(vb));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir, columns]);

  // ── Pagination ──
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const showPagination = paginated && sorted.length > pageSize;

  const pageData = useMemo(() => {
    if (!paginated) return sorted;
    const start = (safePage - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, safePage, pageSize, paginated]);

  // Reset page when search/sort changes
  const prevSearch = search;
  const prevSort = `${sortKey}-${sortDir}`;
  useMemo(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prevSearch, prevSort]);

  // ── Selection ──
  const allPageKeys = useMemo(() => pageData.map(rowKey), [pageData, rowKey]);
  const allSelected = allPageKeys.length > 0 && allPageKeys.every((k) => selected.has(k));
  const someSelected = allPageKeys.some((k) => selected.has(k));

  const toggleAll = useCallback(() => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        for (const k of allPageKeys) next.delete(k);
      } else {
        for (const k of allPageKeys) next.add(k);
      }
      return next;
    });
  }, [allSelected, allPageKeys]);

  const toggleRow = useCallback((key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  // ── Sort toggle ──
  const handleSort = useCallback((key: string) => {
    if (sortKey === key) {
      if (sortDir === "asc") setSortDir("desc");
      else if (sortDir === "desc") { setSortKey(null); setSortDir(null); }
      else setSortDir("asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }, [sortKey, sortDir]);

  // ── Render sort icon ──
  function SortIcon({ colKey }: { colKey: string }) {
    if (sortKey !== colKey || !sortDir) {
      return <ChevronsUpDown className="w-3 h-3 text-white/20 ml-1 inline-block" />;
    }
    return sortDir === "asc"
      ? <ChevronUp className="w-3 h-3 text-amber-400 ml-1 inline-block" />
      : <ChevronDown className="w-3 h-3 text-amber-400 ml-1 inline-block" />;
  }

  const selectedKeys = Array.from(selected);

  // Default bulk actions
  const defaultBulkActions: BulkAction[] = bulkActions ?? [
    { label: "Print", icon: <Printer className="w-3.5 h-3.5" />, onClick: () => {} },
    { label: "Export", icon: <Download className="w-3.5 h-3.5" />, onClick: () => {} },
  ];

  return (
    <DarkCard className={cn("overflow-hidden", className)}>
      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/[0.06]">
        {/* Search */}
        {searchable ? (
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white/70 placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-amber-500/30 focus:border-amber-500/30 transition-colors"
            />
          </div>
        ) : (
          <div />
        )}

        {/* Row count */}
        <span className="text-[11px] text-white/25 tabular-nums whitespace-nowrap">
          {sorted.length} / {data.length} rows
        </span>
      </div>

      {/* ── Bulk Action Bar ── */}
      {selectable && selected.size > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/[0.06] border-b border-amber-500/10">
          <span className="text-xs text-amber-400 font-medium tabular-nums">
            {selected.size} selected
          </span>
          <div className="h-4 w-px bg-white/[0.08]" />
          {defaultBulkActions.map((action) => (
            <button
              key={action.label}
              onClick={() => action.onClick(selectedKeys)}
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] tracking-wide transition-colors",
                action.variant === "danger"
                  ? "text-red-400 hover:bg-red-500/10"
                  : "text-white/50 hover:bg-white/[0.06] hover:text-white/70"
              )}
            >
              {action.icon}
              {action.label}
            </button>
          ))}
          <button
            onClick={() => setSelected(new Set())}
            className="ml-auto text-[11px] text-white/30 hover:text-white/50 transition-colors"
          >
            Clear
          </button>
        </div>
      )}

      {/* ── Table ── */}
      <Table>
        <TableHeader>
          <TableRow className="border-white/[0.06] hover:bg-transparent">
            {selectable && (
              <TableHead className="w-10 px-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                  onChange={toggleAll}
                  className="w-3.5 h-3.5 rounded border-white/20 bg-white/[0.04] accent-amber-500 cursor-pointer"
                />
              </TableHead>
            )}
            {columns.map((col) => (
              <TableHead
                key={col.key}
                className={cn(
                  "text-white/35 text-[11px] tracking-wider uppercase",
                  col.align === "right" && "text-right",
                  col.align === "center" && "text-center",
                  col.sortable && "cursor-pointer select-none hover:text-white/50 transition-colors",
                  col.headerClassName
                )}
                onClick={col.sortable ? () => handleSort(col.key) : undefined}
              >
                <span className="inline-flex items-center">
                  {col.label}
                  {col.sortable && <SortIcon colKey={col.key} />}
                </span>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {pageData.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell
                colSpan={columns.length + (selectable ? 1 : 0)}
                className="text-center py-12 text-white/25 text-sm"
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            pageData.map((row, idx) => {
              const key = rowKey(row);
              const isRowSelected = selected.has(key);
              return (
                <TableRow
                  key={key}
                  data-state={isRowSelected ? "selected" : undefined}
                  className={cn(
                    "border-white/[0.04] hover:bg-white/[0.03] transition-colors",
                    isRowSelected && "bg-amber-500/[0.04]"
                  )}
                >
                  {selectable && (
                    <TableCell className="w-10 px-3">
                      <input
                        type="checkbox"
                        checked={isRowSelected}
                        onChange={() => toggleRow(key)}
                        className="w-3.5 h-3.5 rounded border-white/20 bg-white/[0.04] accent-amber-500 cursor-pointer"
                      />
                    </TableCell>
                  )}
                  {columns.map((col) => (
                    <TableCell
                      key={col.key}
                      className={cn(
                        col.align === "right" && "text-right",
                        col.align === "center" && "text-center",
                        col.cellClassName
                      )}
                    >
                      {col.render(row, idx)}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      {/* ── Pagination ── */}
      {showPagination && (
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-white/[0.06]">
          <span className="text-[11px] text-white/25 tabular-nums">
            Page {safePage} / {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <button
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] text-white/40 hover:text-white/60 hover:bg-white/[0.04] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Prev
            </button>
            <button
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] text-white/40 hover:text-white/60 hover:bg-white/[0.04] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Next
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </DarkCard>
  );
}
