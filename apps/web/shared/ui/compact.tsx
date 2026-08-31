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
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground dark:text-foreground/45">{eyebrow}</p>
            <span className="text-muted-foreground dark:text-foreground/25">·</span>
          </>
        )}
        <h1 className="truncate text-[16px] font-semibold text-foreground dark:text-foreground">{title}</h1>
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
    <div className="flex flex-wrap items-stretch border border-border bg-card shadow-sm dark:border-white/[0.05] dark:bg-card dark:shadow-none">
      {items.map((item) => {
        const vc =
          item.tone === "down"  ? "text-destructive dark:text-destructive/90" :
          item.tone === "warn"  ? "text-app-accent-ink dark:text-app-accent-ink/90" :
          item.tone === "up"    ? "text-success dark:text-success/90" :
          item.tone === "muted" ? "text-muted-foreground dark:text-foreground/35" :
          "text-foreground dark:text-foreground";
        return (
          <div key={item.label}
            className="flex min-w-[88px] flex-1 flex-col gap-0.5 border-r border-border px-3 py-2 last:border-r-0 dark:border-white/[0.05]">
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground dark:text-foreground/45">{item.label}</p>
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
    <section className={`border border-border bg-card shadow-sm dark:border-white/[0.05] dark:bg-card dark:shadow-none ${className}`}>
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2 dark:border-white/[0.05]">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground dark:text-foreground/45">{label}</p>
        {count !== undefined && (
          <span className="border border-border px-2 py-0.5 font-mono text-[11px] text-muted-foreground dark:border-white/[0.08] dark:text-foreground/45">
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
    default:  "border border-border text-muted-foreground hover:border-border hover:bg-muted hover:text-foreground dark:border-white/[0.08] dark:text-foreground/60 dark:hover:text-foreground",
    primary:  "border border-primary/35 text-app-accent-ink hover:bg-primary/10 dark:border-primary/35 dark:text-app-accent-ink dark:hover:bg-primary/10",
    danger:   "border border-destructive/25 text-destructive hover:border-destructive/45 hover:bg-destructive/10 dark:border-destructive/20 dark:text-destructive/80 dark:hover:border-destructive/40 dark:hover:bg-destructive/10",
    success:  "border border-success/25 text-success hover:bg-success/10 dark:border-success/30 dark:text-success dark:hover:bg-success/10",
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
  "h-9 w-full border border-border bg-card px-3 text-[13px] text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/55 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground dark:border-white/[0.08] dark:bg-muted dark:text-foreground/90 dark:placeholder:text-foreground/35 dark:focus:border-primary/45 dark:disabled:opacity-50 dark:[color-scheme:dark]";

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
  const selectedLabel = formatCompactDate(value);

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
        <CalendarDays className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground dark:text-foreground/30" />
        <span className="truncate">{selectedLabel}</span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform dark:text-foreground/30 ${open ? "rotate-180" : ""}`} />
      </button>

      {open ? (
        <div
          className={`absolute right-0 z-50 mt-1 w-[320px] overflow-hidden border border-border bg-popover shadow-lg dark:border-white/[0.08] dark:bg-popover ${panelClassName}`}
        >
          <div className="border-b border-border bg-muted px-3 py-2 dark:border-white/[0.08] dark:bg-muted">
            <div className="flex items-center justify-between gap-3">
              <p className="font-mono text-[12px] font-semibold text-foreground">{monthLabel}</p>
              <p className="font-mono text-[11px] text-muted-foreground">1 hari</p>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">{selectedLabel}</p>
          </div>

          <div className="space-y-3 p-3">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setViewMonth((currentValue) => startOfUtcMonth(addUtcMonths(currentValue, -1)))}
                className="flex h-7 w-7 items-center justify-center border border-border text-muted-foreground hover:bg-muted hover:text-foreground dark:border-white/[0.08]"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <p className="font-mono text-[13px] font-semibold text-foreground">{monthLabel}</p>
              <button
                type="button"
                onClick={() => setViewMonth((currentValue) => startOfUtcMonth(addUtcMonths(currentValue, 1)))}
                className="flex h-7 w-7 items-center justify-center border border-border text-muted-foreground hover:bg-muted hover:text-foreground dark:border-white/[0.08]"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center">
              {["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"].map((label) => (
                <span key={label} className="py-1 text-[11px] text-muted-foreground">
                  {label}
                </span>
              ))}
              {monthCells.map((cell) => {
                const isActive = cell.iso === value;
                if (!cell.inMonth) {
                  return <div key={cell.iso} className="h-9" aria-hidden="true" />;
                }
                return (
                  <button
                    key={cell.iso}
                    type="button"
                    onClick={() => {
                      onChange(cell.iso);
                      setOpen(false);
                    }}
                    className={[
                      "flex h-9 items-center justify-center text-[13px] transition-colors hover:bg-muted",
                      "text-foreground",
                      isActive
                        ? "rounded-full bg-primary font-semibold text-primary-foreground hover:bg-primary"
                        : "",
                    ].join(" ")}
                  >
                    {cell.iso.slice(-2).replace(/^0/, "")}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-end border-t border-border pt-2 dark:border-white/[0.08]">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="font-mono text-[12px] uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground"
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

function formatCompactDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value || "-";
  }

  try {
    return new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(isoToUtcDate(value));
  } catch {
    return value;
  }
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
  const rangeLabel = `${formatCompactDate(activeRange.from)} - ${formatCompactDate(activeRange.to)}`;

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
        <CalendarDays className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground dark:text-foreground/30" />
        <span className="truncate">{rangeLabel}</span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform dark:text-foreground/30 ${open ? "rotate-180" : ""}`} />
      </button>

      {open ? (
        <div
          className={`absolute right-0 z-50 mt-1 w-[320px] overflow-hidden border border-border bg-popover shadow-lg dark:border-white/[0.08] dark:bg-popover ${panelClassName}`}
        >
          <div className="border-b border-border bg-muted px-3 py-2 dark:border-white/[0.08] dark:bg-muted">
            <div className="flex items-center justify-between gap-3">
              <p className="font-mono text-[12px] font-semibold text-foreground">{monthLabel}</p>
              <p className="font-mono text-[11px] text-muted-foreground">
                {selectedDays} hari
              </p>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {anchorDate ? `Mulai ${formatCompactDate(anchorDate)}, pilih tanggal akhir` : rangeLabel}
            </p>
          </div>

          <div className="space-y-3 p-3">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setViewMonth((value) => startOfUtcMonth(addUtcMonths(value, -1)))}
                className="flex h-7 w-7 items-center justify-center border border-border text-muted-foreground hover:bg-muted hover:text-foreground dark:border-white/[0.08]"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <p className="font-mono text-[13px] font-semibold text-foreground">{monthLabel}</p>
              <button
                type="button"
                onClick={() => setViewMonth((value) => startOfUtcMonth(addUtcMonths(value, 1)))}
                className="flex h-7 w-7 items-center justify-center border border-border text-muted-foreground hover:bg-muted hover:text-foreground dark:border-white/[0.08]"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center">
              {["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"].map((label) => (
                <span key={label} className="py-1 text-[11px] text-muted-foreground">
                  {label}
                </span>
              ))}
              {monthCells.map((cell) => {
                const isActive = isSelected(cell.iso);
                const isEdge = isRangeEdge(cell.iso);
                if (!cell.inMonth) {
                  return <div key={cell.iso} className="h-9" aria-hidden="true" />;
                }

                return (
                  <button
                    key={cell.iso}
                    type="button"
                    onClick={() => handleDayClick(cell.iso)}
                    className={[
                      "flex h-9 items-center justify-center text-[13px] transition-colors",
                      "text-foreground hover:bg-muted",
                      isActive && !isEdge
                        ? "bg-primary/15 text-app-accent-ink dark:bg-primary/20 dark:text-app-accent-ink"
                        : "",
                      isEdge
                        ? "rounded-full bg-primary font-semibold text-primary-foreground hover:bg-primary"
                        : "",
                      anchorDate === cell.iso && !isEdge
                        ? "rounded-full border border-primary text-app-accent-ink dark:text-app-accent-ink"
                        : "",
                    ].join(" ")}
                  >
                    {cell.iso.slice(-2).replace(/^0/, "")}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between border-t border-border pt-2 dark:border-white/[0.08]">
              <button
                type="button"
                onClick={() => {
                  setAnchorDate(null);
                  setViewMonth(startOfUtcMonth(from));
                }}
                className="font-mono text-[12px] uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="font-mono text-[12px] uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground"
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
  const showSearch = options.length > 3;
  const filtered = options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()));

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(!open)}
        className="flex h-9 w-full items-center justify-between gap-2 border border-border bg-card px-3 text-[13px] text-foreground outline-none transition-colors hover:bg-muted focus:border-primary/55 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground dark:border-white/[0.08] dark:bg-muted dark:text-foreground/90 dark:hover:bg-white/[0.04] dark:focus:border-primary/45 dark:disabled:opacity-50"
      >
        <span className="truncate">{selected ? selected.label : <span className="text-muted-foreground dark:text-foreground/40">{placeholder}</span>}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground dark:text-foreground/30" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[200px] max-w-[90vw] overflow-hidden border border-border bg-popover shadow-lg dark:border-white/[0.05] dark:bg-popover dark:shadow-none">
          {showSearch ? (
            <div className="flex items-center gap-2 border-b border-border bg-muted px-2.5 py-1.5 dark:border-white/[0.05] dark:bg-background">
              <Search className="h-3 w-3 text-muted-foreground dark:text-foreground/30" />
              <input
                type="text"
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari..."
                className="w-full bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground dark:text-foreground dark:placeholder:text-foreground/35"
              />
            </div>
          ) : null}
          <div className="max-h-[200px] overflow-y-auto p-1">
            <button
              type="button"
              onClick={() => { onChange(""); setOpen(false); }}
              className={`w-full px-3 py-2 text-left text-[13px] transition-colors hover:bg-muted dark:hover:bg-white/[0.05] ${!value ? "border border-primary/35 bg-transparent text-app-accent-ink dark:border-primary/30 dark:text-app-accent-ink" : "text-foreground dark:text-foreground/70"}`}
            >
              {placeholder}
            </button>
            {filtered.length === 0 ? (
              <div className="px-3 py-3 text-center text-[12px] text-muted-foreground dark:text-foreground/45">Tidak ada hasil</div>
            ) : (
              filtered.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => { onChange(o.value); setOpen(false); }}
                  className={`w-full truncate px-3 py-2 text-left text-[13px] transition-colors hover:bg-muted dark:hover:bg-white/[0.05] ${value === o.value ? "border border-primary/35 bg-transparent text-app-accent-ink dark:border-primary/30 dark:text-app-accent-ink" : "text-foreground dark:text-foreground/85"}`}
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
      className={`w-full border border-border bg-card px-3 py-2.5 text-[13px] leading-5 text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/55 dark:border-white/[0.08] dark:bg-muted dark:text-foreground dark:placeholder:text-foreground/35 dark:focus:border-primary/45 ${props.className ?? ""}`}
    />
  );
}

export function FieldLabel({ children, required }: { children: ReactNode; required?: boolean }) {
  return (
    <p className="mb-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground dark:text-foreground/50">
      {children}{required && <span className="ml-0.5 text-destructive/80 dark:text-destructive/70">*</span>}
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
      ? "border-success/20 bg-success/10 text-success dark:border-success/25 dark:bg-success/8 dark:text-success"
      : "border-destructive/20 bg-destructive/10 text-destructive dark:border-destructive/25 dark:bg-destructive/8 dark:text-destructive";
  return (
    <div className={`rounded-lg border px-3 py-2 text-[13px] ${s}`}>{message}</div>
  );
}

/* ------------------------------------------------------------------ */
/*  Empty state                                                         */
/* ------------------------------------------------------------------ */

export function EmptyRow({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-card px-3 py-4 text-[13px] text-muted-foreground dark:border-white/[0.08] dark:bg-muted/40 dark:text-foreground/45">
      {message}
    </div>
  );
}
