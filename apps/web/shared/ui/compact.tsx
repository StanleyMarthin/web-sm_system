/**
 * Shared compact UI primitives — konsisten dipakai di seluruh modul.
 * Tujuan: semua halaman terasa padat dan fokus pada data, bukan chrome UI.
 */

import { useState, useRef, useEffect, Children, isValidElement, type ReactNode } from "react";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Search } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Page header — satu baris kecil                                     */
/* ------------------------------------------------------------------ */

export function PageHeader({
  eyebrow,
  title,
  actions,
}: {
  eyebrow?: string;
  title: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2">
        {eyebrow && (
          <>
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-gray-600 dark:text-white/45">{eyebrow}</p>
            <span className="text-gray-300 dark:text-white/25">·</span>
          </>
        )}
        <h1 className="truncate text-[16px] font-semibold text-gray-950 dark:text-white">{title}</h1>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-1.5">{actions}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Metric bar — deretan angka ringkas di 1 baris                      */
/* ------------------------------------------------------------------ */

export function MetricBar({ items }: {
  items: { label: string; value: string | number; tone?: "warn" | "down" | "up" | "muted" }[];
}) {
  return (
    <div className="flex flex-wrap items-stretch border border-gray-200 bg-white shadow-sm dark:border-white/[0.05] dark:bg-[#111114] dark:shadow-none">
      {items.map((item) => {
        const vc =
          item.tone === "down"  ? "text-red-600 dark:text-red-400/90" :
          item.tone === "warn"  ? "text-amber-700 dark:text-amber-400/90" :
          item.tone === "up"    ? "text-emerald-700 dark:text-emerald-400/90" :
          item.tone === "muted" ? "text-gray-500 dark:text-white/35" :
          "text-gray-950 dark:text-white";
        return (
          <div key={item.label}
            className="flex min-w-[88px] flex-1 flex-col gap-0.5 border-r border-gray-200 px-3 py-2 last:border-r-0 dark:border-white/[0.05]">
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-gray-600 dark:text-white/45">{item.label}</p>
            <p className={`font-mono text-[16px] font-semibold leading-none tabular-nums ${vc}`}>{item.value}</p>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Section card                                                        */
/* ------------------------------------------------------------------ */

export function SectionCard({
  label,
  count,
  children,
  className = "",
}: {
  label: string;
  count?: number;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`border border-gray-200 bg-white shadow-sm dark:border-white/[0.05] dark:bg-[#111114] dark:shadow-none ${className}`}>
      <div className="flex items-center justify-between gap-2 border-b border-gray-200 px-3 py-2 dark:border-white/[0.05]">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-gray-600 dark:text-white/45">{label}</p>
        {count !== undefined && (
          <span className="border border-gray-200 px-2 py-0.5 font-mono text-[11px] text-gray-600 dark:border-white/[0.08] dark:text-white/45">
            {count}
          </span>
        )}
      </div>
      <div className="space-y-2 px-3 py-3">
        {children}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Compact action button                                               */
/* ------------------------------------------------------------------ */

export function ActionButton({
  children,
  onClick,
  variant = "default",
  type = "button",
  disabled,
  className = "",
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "default" | "primary" | "danger" | "success";
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
  title?: string;
}) {
  const styles: Record<string, string> = {
    default:  "border border-gray-300 text-gray-600 hover:border-gray-400 hover:bg-gray-50 hover:text-gray-950 dark:border-white/[0.08] dark:text-white/60 dark:hover:text-white",
    primary:  "border border-amber-600/35 text-amber-700 hover:bg-amber-50 dark:border-amber-500/35 dark:text-amber-300 dark:hover:bg-amber-500/10",
    danger:   "border border-red-600/25 text-red-700 hover:border-red-600/45 hover:bg-red-50 dark:border-red-500/20 dark:text-red-300/80 dark:hover:border-red-500/40 dark:hover:bg-red-500/10",
    success:  "border border-emerald-700/25 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-500/30 dark:text-emerald-300 dark:hover:bg-emerald-500/10",
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex h-9 items-center gap-1.5 border px-3 font-mono text-[12px] font-medium uppercase tracking-[0.08em] transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Compact form input / select                                         */
/* ------------------------------------------------------------------ */

const inputBase =
  "h-9 w-full border border-gray-300 bg-white px-3 text-[13px] text-gray-950 outline-none transition-colors placeholder:text-gray-400 focus:border-amber-600/55 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400 dark:border-white/[0.08] dark:bg-[#0f0f12] dark:text-white/90 dark:placeholder:text-white/35 dark:focus:border-amber-500/45 dark:disabled:opacity-50 dark:[color-scheme:dark]";

export function CompactInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputBase} ${props.className ?? ""}`} />;
}

export function CompactDateInput({
  value,
  onChange,
  className = "",
  panelClassName = "",
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  panelClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(startOfUtcMonth(value));
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const monthCells = buildMonthCells(viewMonth);
  const monthLabel = new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(isoToUtcDate(viewMonth));

  function toggleOpen() {
    setOpen((currentValue) => {
      const nextValue = !currentValue;
      if (nextValue) {
        setViewMonth(startOfUtcMonth(value));
      }
      return nextValue;
    });
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={toggleOpen}
        className={`${inputBase} flex items-center justify-between gap-2 pl-8 text-left`}
      >
        <CalendarDays className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500 dark:text-white/30" />
        <span className="truncate">{value}</span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-gray-500 transition-transform dark:text-white/30 ${open ? "rotate-180" : ""}`} />
      </button>

      {open ? (
        <div
          className={`absolute right-0 z-30 mt-1 w-[320px] overflow-hidden border border-gray-200 bg-white shadow-lg dark:border-white/[0.08] dark:bg-[#0a0a0c] ${panelClassName}`}
        >
          <div className="border-b border-gray-200 bg-gray-50 px-3 py-2 dark:border-white/[0.08] dark:bg-white/[0.03]">
            <div className="flex items-center justify-between gap-3">
              <p className="font-mono text-[12px] text-gray-800 dark:text-white/80">{monthLabel}</p>
              <p className="font-mono text-[11px] text-gray-600 dark:text-white/45">1 hari</p>
            </div>
            <p className="mt-1 text-[11px] text-gray-600 dark:text-white/45">{value}</p>
          </div>

          <div className="space-y-3 p-3">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setViewMonth((currentValue) => startOfUtcMonth(addUtcMonths(currentValue, -1)))}
                className="flex h-7 w-7 items-center justify-center border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-white/[0.08] dark:text-white/70 dark:hover:bg-white/[0.05]"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <p className="font-mono text-[13px] text-gray-900 dark:text-white/90">{monthLabel}</p>
              <button
                type="button"
                onClick={() => setViewMonth((currentValue) => startOfUtcMonth(addUtcMonths(currentValue, 1)))}
                className="flex h-7 w-7 items-center justify-center border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-white/[0.08] dark:text-white/70 dark:hover:bg-white/[0.05]"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label) => (
                <span key={label} className="py-1 text-[11px] text-gray-500 dark:text-white/45">
                  {label}
                </span>
              ))}
              {monthCells.map((cell) => {
                const isActive = cell.iso === value;
                return (
                  <button
                    key={cell.iso}
                    type="button"
                    onClick={() => {
                      onChange(cell.iso);
                      setOpen(false);
                    }}
                    className={[
                      "flex h-9 items-center justify-center text-[13px] transition-colors",
                      cell.inMonth
                        ? "text-gray-900 dark:text-white/85"
                        : "text-gray-300 dark:text-white/20",
                      isActive
                        ? "rounded-full bg-amber-500 text-white"
                        : "",
                    ].join(" ")}
                  >
                    {cell.iso.slice(-2).replace(/^0/, "")}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-end border-t border-gray-200 pt-2 dark:border-white/[0.08]">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-[12px] text-gray-600 hover:text-gray-900 dark:text-white/55 dark:hover:text-white/90"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function parseIsoDateParts(value: string): { year: number; month: number; day: number } {
  const [year, month, day] = value.split("-").map((item) => Number.parseInt(item, 10));
  return {
    year: year || 0,
    month: month || 1,
    day: day || 1,
  };
}

function isoToUtcDate(value: string): Date {
  const { year, month, day } = parseIsoDateParts(value);
  return new Date(Date.UTC(year, month - 1, day));
}

function utcDateToIso(value: Date): string {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addUtcDays(value: string, days: number): string {
  const next = isoToUtcDate(value);
  next.setUTCDate(next.getUTCDate() + days);
  return utcDateToIso(next);
}

function addUtcMonths(value: string, months: number): string {
  const next = isoToUtcDate(value);
  next.setUTCMonth(next.getUTCMonth() + months, 1);
  return utcDateToIso(next);
}

function startOfUtcMonth(value: string): string {
  const next = isoToUtcDate(value);
  next.setUTCDate(1);
  return utcDateToIso(next);
}

function endOfUtcMonth(value: string): string {
  const next = isoToUtcDate(startOfUtcMonth(value));
  next.setUTCMonth(next.getUTCMonth() + 1, 0);
  return utcDateToIso(next);
}

function differenceInUtcDaysInclusive(start: string, end: string): number {
  const startValue = isoToUtcDate(start).getTime();
  const endValue = isoToUtcDate(end).getTime();
  return Math.floor((endValue - startValue) / 86_400_000) + 1;
}

function normalizeIsoRange(start: string, end: string): { from: string; to: string } {
  if (end < start) {
    return { from: end, to: start };
  }

  return { from: start, to: end };
}

function buildMonthCells(value: string): Array<{ iso: string; inMonth: boolean }> {
  const monthStart = startOfUtcMonth(value);
  const monthEnd = endOfUtcMonth(value);
  const monthStartDate = isoToUtcDate(monthStart);
  const firstWeekday = monthStartDate.getUTCDay();
  const gridStart = addUtcDays(monthStart, -firstWeekday);
  const cells: Array<{ iso: string; inMonth: boolean }> = [];

  for (let index = 0; index < 42; index += 1) {
    const iso = addUtcDays(gridStart, index);
    cells.push({
      iso,
      inMonth: iso >= monthStart && iso <= monthEnd,
    });
  }

  return cells;
}

export function CompactDateRangeInput({
  from,
  to,
  onChange,
  selectionBehavior = "range-only",
  className = "",
  panelClassName = "",
}: {
  from: string;
  to: string;
  onChange: (range: { from: string; to: string }) => void;
  selectionBehavior?: "range-only" | "single-or-range";
  className?: string;
  panelClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(startOfUtcMonth(from));
  const [anchorDate, setAnchorDate] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const activeRange = normalizeIsoRange(from, to);
  const previewRange = anchorDate
    ? { from: anchorDate, to: anchorDate }
    : activeRange;
  const monthCells = buildMonthCells(viewMonth);
  const selectedDays = differenceInUtcDaysInclusive(previewRange.from, previewRange.to);
  const monthLabel = new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(isoToUtcDate(viewMonth));

  function applySelection(nextFrom: string, nextTo: string) {
    const normalized = normalizeIsoRange(nextFrom, nextTo);
    onChange(normalized);
    setAnchorDate(null);
    setOpen(false);
  }

  function handleDayClick(dayIso: string) {
    if (!anchorDate) {
      setAnchorDate(dayIso);
      return;
    }

    if (selectionBehavior === "single-or-range" && anchorDate === dayIso) {
      applySelection(dayIso, dayIso);
      return;
    }

    applySelection(anchorDate, dayIso);
  }

  function isSelected(dayIso: string): boolean {
    return dayIso >= previewRange.from && dayIso <= previewRange.to;
  }

  function isRangeEdge(dayIso: string): boolean {
    return dayIso === previewRange.from || dayIso === previewRange.to;
  }

  function toggleOpen() {
    setOpen((currentValue) => {
      const nextValue = !currentValue;
      if (nextValue) {
        setViewMonth(startOfUtcMonth(from));
        setAnchorDate(null);
      }
      return nextValue;
    });
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={toggleOpen}
        className={`${inputBase} flex items-center justify-between gap-2 pl-8 text-left`}
      >
        <CalendarDays className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500 dark:text-white/30" />
        <span className="truncate">{activeRange.from} - {activeRange.to}</span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-gray-500 transition-transform dark:text-white/30 ${open ? "rotate-180" : ""}`} />
      </button>

      {open ? (
        <div
          className={`absolute right-0 z-30 mt-1 w-[320px] overflow-hidden border border-gray-200 bg-white shadow-lg dark:border-white/[0.08] dark:bg-[#0a0a0c] ${panelClassName}`}
        >
          <div className="border-b border-gray-200 bg-gray-50 px-3 py-2 dark:border-white/[0.08] dark:bg-white/[0.03]">
            <div className="flex items-center justify-between gap-3">
              <p className="font-mono text-[12px] text-gray-800 dark:text-white/80">{monthLabel}</p>
              <p className="font-mono text-[11px] text-gray-600 dark:text-white/45">
                {selectedDays} hari
              </p>
            </div>
            <p className="mt-1 text-[11px] text-gray-600 dark:text-white/45">
              {anchorDate ? `Mulai ${anchorDate}, pilih tanggal akhir` : `${activeRange.from} - ${activeRange.to}`}
            </p>
          </div>

          <div className="space-y-3 p-3">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setViewMonth((value) => startOfUtcMonth(addUtcMonths(value, -1)))}
                className="flex h-7 w-7 items-center justify-center border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-white/[0.08] dark:text-white/70 dark:hover:bg-white/[0.05]"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <p className="font-mono text-[13px] text-gray-900 dark:text-white/90">{monthLabel}</p>
              <button
                type="button"
                onClick={() => setViewMonth((value) => startOfUtcMonth(addUtcMonths(value, 1)))}
                className="flex h-7 w-7 items-center justify-center border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-white/[0.08] dark:text-white/70 dark:hover:bg-white/[0.05]"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label) => (
                <span key={label} className="py-1 text-[11px] text-gray-500 dark:text-white/45">
                  {label}
                </span>
              ))}
              {monthCells.map((cell) => {
                const isActive = isSelected(cell.iso);
                const isEdge = isRangeEdge(cell.iso);

                return (
                  <button
                    key={cell.iso}
                    type="button"
                    onClick={() => handleDayClick(cell.iso)}
                    className={[
                      "flex h-9 items-center justify-center text-[13px] transition-colors",
                      cell.inMonth
                        ? "text-gray-900 dark:text-white/85"
                        : "text-gray-300 dark:text-white/20",
                      isActive && !isEdge
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200"
                        : "",
                      isEdge
                        ? "rounded-full bg-amber-500 text-white"
                        : "",
                      anchorDate === cell.iso && !isEdge
                        ? "rounded-full border border-amber-500 text-amber-600 dark:text-amber-300"
                        : "",
                    ].join(" ")}
                  >
                    {cell.iso.slice(-2).replace(/^0/, "")}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between border-t border-gray-200 pt-2 dark:border-white/[0.08]">
              <button
                type="button"
                onClick={() => {
                  setAnchorDate(null);
                  setViewMonth(startOfUtcMonth(from));
                }}
                className="text-[12px] text-gray-600 hover:text-gray-900 dark:text-white/55 dark:hover:text-white/90"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-[12px] text-gray-600 hover:text-gray-900 dark:text-white/55 dark:hover:text-white/90"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function CompactSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const options: { value: string; label: string }[] = [];
  let placeholder = "Pilih...";
  
  Children.forEach(props.children, (child: React.ReactNode) => {
    if (isValidElement(child) && child.type === "option") {
      const optionChild = child as React.ReactElement<{ value?: string | number; children?: React.ReactNode }>;
      if (optionChild.props.value === "" || optionChild.props.value == null) {
        placeholder = String(optionChild.props.children);
      } else {
        options.push({ value: String(optionChild.props.value), label: String(optionChild.props.children) });
      }
    }
  });

  return (
    <SearchableSelect
      value={String(props.value ?? "")}
      onChange={(v) => {
        if (props.onChange) {
          props.onChange({
            target: {
              name: props.name,
              value: v,
            },
          } as unknown as React.ChangeEvent<HTMLSelectElement>);
        }
      }}
      options={options}
      placeholder={placeholder}
      className={props.className}
      disabled={props.disabled}
    />
  );
}

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "Pilih...",
  className = "",
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const selected = options.find((o) => o.value === value);
  const showSearch = options.length > 4;
  const filtered = options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()));

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(!open)}
        className="flex h-9 w-full items-center justify-between gap-2 border border-gray-300 bg-white px-3 text-[13px] text-gray-950 outline-none transition-colors hover:bg-gray-50 focus:border-amber-600/55 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400 dark:border-white/[0.08] dark:bg-[#0f0f12] dark:text-white/90 dark:hover:bg-white/[0.04] dark:focus:border-amber-500/45 dark:disabled:opacity-50"
      >
        <span className="truncate">{selected ? selected.label : <span className="text-gray-400 dark:text-white/40">{placeholder}</span>}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-400 dark:text-white/30" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[200px] max-w-[90vw] overflow-hidden border border-gray-200 bg-white shadow-lg dark:border-white/[0.05] dark:bg-[#111114] dark:shadow-none">
          {showSearch ? (
            <div className="flex items-center gap-2 border-b border-gray-200 bg-gray-50 px-2.5 py-1.5 dark:border-white/[0.05] dark:bg-[#0a0a0c]">
              <Search className="h-3 w-3 text-gray-400 dark:text-white/30" />
              <input
                type="text"
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari..."
                className="w-full bg-transparent text-[13px] text-gray-950 outline-none placeholder:text-gray-400 dark:text-white dark:placeholder:text-white/35"
              />
            </div>
          ) : null}
          <div className="max-h-[200px] overflow-y-auto p-1">
            <button
              type="button"
              onClick={() => { onChange(""); setOpen(false); }}
              className={`w-full px-3 py-2 text-left text-[13px] transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.05] ${!value ? "border border-amber-600/35 bg-transparent text-amber-700 dark:border-amber-500/30 dark:text-amber-300" : "text-gray-700 dark:text-white/70"}`}
            >
              {placeholder}
            </button>
            {filtered.length === 0 ? (
              <div className="px-3 py-3 text-center text-[12px] text-gray-500 dark:text-white/45">Tidak ada hasil</div>
            ) : (
              filtered.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => { onChange(o.value); setOpen(false); }}
                  className={`w-full truncate px-3 py-2 text-left text-[13px] transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.05] ${value === o.value ? "border border-amber-600/35 bg-transparent text-amber-700 dark:border-amber-500/30 dark:text-amber-300" : "text-gray-800 dark:text-white/85"}`}
                >
                  {o.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function CompactTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full border border-gray-300 bg-white px-3 py-2.5 text-[13px] leading-5 text-gray-950 outline-none transition-colors placeholder:text-gray-400 focus:border-amber-600/55 dark:border-white/[0.08] dark:bg-[#0f0f12] dark:text-white dark:placeholder:text-white/35 dark:focus:border-amber-500/45 ${props.className ?? ""}`}
    />
  );
}

export function FieldLabel({ children, required }: { children: ReactNode; required?: boolean }) {
  return (
    <p className="mb-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-gray-600 dark:text-white/50">
      {children}{required && <span className="ml-0.5 text-red-600/80 dark:text-red-400/70">*</span>}
    </p>
  );
}

/* ------------------------------------------------------------------ */
/*  Inline toast / feedback                                             */
/* ------------------------------------------------------------------ */

export function Toast({ message, variant }: { message: string | null; variant: "ok" | "err" }) {
  if (!message) return null;
  const s =
    variant === "ok"
      ? "border-emerald-700/20 bg-emerald-50 text-emerald-800 dark:border-emerald-500/25 dark:bg-emerald-500/8 dark:text-emerald-200"
      : "border-red-600/20 bg-red-50 text-red-800 dark:border-red-500/25 dark:bg-red-500/8 dark:text-red-200";
  return (
    <div className={`rounded-lg border px-3 py-2 text-[13px] ${s}`}>{message}</div>
  );
}

/* ------------------------------------------------------------------ */
/*  Empty state                                                         */
/* ------------------------------------------------------------------ */

export function EmptyRow({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-gray-300 bg-white px-3 py-4 text-[13px] text-gray-600 dark:border-white/[0.08] dark:bg-white/[0.02] dark:text-white/45">
      {message}
    </div>
  );
}
