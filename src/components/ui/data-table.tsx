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

import { useState, useMemo, useCallback, useEffect, useRef, type ReactNode } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { DarkCard } from "@/components/ui/dark-card";
import {
  Search, ChevronUp, ChevronDown, ChevronsUpDown,
  ChevronLeft, ChevronRight, Printer, Download, Pencil, Trash2,
  Filter, X
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
  /** Filter value extractor — returns a string for filtering */
  filterValue?: (row: T) => string;
  /** Whether the cell can be edited inline (double click) */
  editable?: boolean;
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
  /** Callback when an inline cell is edited and saved */
  onCellChange?: (row: T, colKey: string, newValue: string) => void;
  /** Enable column-specific filters toggle (spreadsheet style) */
  enableColumnFilter?: boolean;
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
  onCellChange,
  enableColumnFilter = true,
}: DataTableProps<T>) {
  // ── State ──
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  
  // Spreadsheet Column Filters
  const [showColFilters, setShowColFilters] = useState(false);
  const [colFilters, setColFilters] = useState<Record<string, string>>({});

  // ── Filtered data ──
  const filtered = useMemo(() => {
    let result = data;
    // 1. Global Search
    if (search.trim() && searchFn) {
      const q = search.toLowerCase();
      result = result.filter((row) => searchFn(row, q));
    }
    // 2. Column Filters
    const activeFilters = Object.entries(colFilters).filter(([_, v]) => v.trim() !== "");
    if (activeFilters.length > 0) {
      result = result.filter((row) => {
        return activeFilters.every(([key, value]) => {
          const col = columns.find((c) => c.key === key);
          if (!col) return true;
          const cellValue = col.filterValue 
            ? col.filterValue(row) 
            : col.sortValue 
              ? col.sortValue(row) 
              : (row as any)[key];
          if (cellValue == null) return false;
          return String(cellValue).toLowerCase().includes(value.toLowerCase());
        });
      });
    }
    return result;
  }, [data, search, searchFn, colFilters, columns]);

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

  // ── Editable Cell Component ──
  function EditableCell({ row, col, renderNode }: { row: T; col: DataTableColumn<T>; renderNode: ReactNode }) {
    const [isEditing, setIsEditing] = useState(false);
    const [value, setValue] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
      if (isEditing && inputRef.current) {
        inputRef.current.focus();
      }
    }, [isEditing]);

    const handleDoubleClick = () => {
      if (!col.editable || !onCellChange) return;
      // Extract raw text or just use a placeholder text if it's a complex render
      // In a real scenario, you might want `col.getRawValue(row)`
      // For now, we assume standard string casting
      setValue(String(col.sortValue ? col.sortValue(row) : (row as any)[col.key] ?? ""));
      setIsEditing(true);
    };

    const commitChange = () => {
      setIsEditing(false);
      if (onCellChange) {
        onCellChange(row, col.key, value);
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === "Enter") commitChange();
      if (e.key === "Escape") setIsEditing(false);
    };

    if (isEditing) {
      return (
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commitChange}
          onKeyDown={handleKeyDown}
          className="w-full h-full bg-[#111] border border-amber-500/50 text-amber-400 outline-none px-1 py-0.5 text-[11px] font-mono rounded-sm"
        />
      );
    }

    return (
      <div 
        className={cn("w-full h-full min-h-[20px] flex items-center", col.align === "right" && "justify-end", col.align === "center" && "justify-center")}
        onDoubleClick={handleDoubleClick}
      >
        {renderNode}
      </div>
    );
  }

  return (
    <DarkCard className={cn("overflow-hidden", className)}>
      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/[0.06]">
        {/* Search & Filter Toggle */}
        <div className="flex items-center gap-2 flex-1">
          {searchable && (
            <div className="relative max-w-xs w-full">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white/70 placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-amber-500/30 focus:border-amber-500/30 transition-colors"
              />
            </div>
          )}
          {enableColumnFilter && (
            <button
              onClick={() => {
                setShowColFilters(!showColFilters);
                if (showColFilters) setColFilters({});
              }}
              className={cn(
                "p-1.5 rounded-lg border transition-colors",
                showColFilters 
                  ? "bg-amber-500/10 border-amber-500/30 text-amber-400" 
                  : "bg-white/[0.02] border-white/[0.08] text-white/40 hover:text-white/70 hover:bg-white/[0.06]"
              )}
              title="Filter Kolom"
            >
              <Filter className="w-4 h-4" />
            </button>
          )}
        </div>

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

      {/* ── Table (Spreadsheet Style) ── */}
      <div className="border-x border-t border-white/[0.08] overflow-x-auto bg-[#0a0a0a] scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        <Table className="w-full text-left border-collapse">
          <TableHeader className="bg-white/[0.03] sticky top-0 z-10">
            <TableRow className="border-b border-white/[0.08] hover:bg-transparent">
              {selectable && (
                <TableHead className="w-10 px-3 border-r border-white/[0.08] py-2 h-auto text-center">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                    onChange={toggleAll}
                    className="w-3.5 h-3.5 rounded border-white/20 bg-white/[0.04] accent-amber-500 cursor-pointer outline-none"
                  />
                </TableHead>
              )}
            {columns.map((col) => (
              <TableHead
                key={col.key}
                className={cn(
                  "border-r border-white/[0.08] last:border-r-0 text-white/40 text-[10px] font-semibold uppercase tracking-wider py-2 px-3 h-auto align-middle whitespace-nowrap",
                  col.align === "right" && "text-right",
                  col.align === "center" && "text-center",
                  col.sortable && "cursor-pointer select-none hover:text-white/70 hover:bg-white/[0.04] transition-colors",
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

          {/* Spreadsheet Column Filter Row */}
          {showColFilters && (
            <TableRow className="border-b border-white/[0.08] hover:bg-transparent bg-white/[0.01]">
              {selectable && (
                <TableHead className="w-10 px-3 border-r border-white/[0.08] py-1 h-auto text-center" />
              )}
              {columns.map((col) => (
                <TableHead
                  key={`filter-${col.key}`}
                  className={cn(
                    "border-r border-white/[0.08] last:border-r-0 py-1.5 px-1.5 h-auto align-middle",
                    col.headerClassName
                  )}
                >
                  {col.key !== "actions" && col.key !== "photo" && col.key !== "labeled" && col.key !== "overdue" ? (
                    <div className="relative w-full">
                      <input
                        type="text"
                        placeholder="Filter..."
                        value={colFilters[col.key] || ""}
                        onChange={(e) => setColFilters(prev => ({ ...prev, [col.key]: e.target.value }))}
                        className="w-full bg-[#111] border border-white/[0.1] rounded pl-2 pr-5 py-0.5 text-[10px] text-white/70 placeholder:text-white/20 focus:outline-none focus:border-amber-500/50"
                      />
                      {colFilters[col.key] && (
                        <button
                          onClick={() => setColFilters(prev => ({ ...prev, [col.key]: "" }))}
                          className="absolute right-1 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      )}
                    </div>
                  ) : null}
                </TableHead>
              ))}
            </TableRow>
          )}
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
                    "border-b border-white/[0.06] last:border-b-0 hover:bg-white/[0.06] even:bg-white/[0.015] transition-none cursor-default group",
                    isRowSelected && "bg-amber-500/[0.1] hover:bg-amber-500/[0.12]"
                  )}
                >
                  {selectable && (
                    <TableCell className="w-10 px-3 border-r border-white/[0.06] py-1.5 align-middle text-center">
                      <input
                        type="checkbox"
                        checked={isRowSelected}
                        onChange={() => toggleRow(key)}
                        className="w-3.5 h-3.5 rounded border-white/20 bg-white/[0.04] accent-amber-500 cursor-pointer outline-none opacity-0 group-hover:opacity-100 data-[state=selected]:opacity-100 transition-opacity"
                        data-state={isRowSelected ? "selected" : undefined}
                      />
                    </TableCell>
                  )}
                  {columns.map((col) => (
                    <TableCell
                      key={col.key}
                      className={cn(
                        "border-r border-white/[0.06] last:border-r-0 py-1 px-3 align-middle text-[12px] text-white/80 tabular-nums whitespace-nowrap",
                        col.align === "right" && "text-right",
                        col.align === "center" && "text-center",
                        col.editable && "cursor-text hover:bg-white/[0.04]",
                        col.cellClassName
                      )}
                    >
                      {col.editable ? (
                        <EditableCell row={row} col={col} renderNode={col.render(row, idx)} />
                      ) : (
                        col.render(row, idx)
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
      </div>

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
