/**
 * Shared compact UI primitives — konsisten dipakai di seluruh modul.
 * Tujuan: semua halaman terasa padat dan fokus pada data, bukan chrome UI.
 */

import { useState, useRef, useEffect, Children, isValidElement, type ReactNode } from "react";
import { ChevronDown, Search } from "lucide-react";

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
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/30">{eyebrow}</p>
            <span className="text-white/20">·</span>
          </>
        )}
        <h1 className="truncate text-[12px] font-medium text-white">{title}</h1>
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
    <div className="flex flex-wrap items-stretch border border-white/[0.05] bg-[#111114]">
      {items.map((item) => {
        const vc =
          item.tone === "down"  ? "text-red-400/90" :
          item.tone === "warn"  ? "text-amber-400/90" :
          item.tone === "up"    ? "text-emerald-400/90" :
          item.tone === "muted" ? "text-white/35" :
          "text-white";
        return (
          <div key={item.label}
            className="flex min-w-[88px] flex-1 flex-col gap-0.5 border-r border-white/[0.05] px-3 py-2 last:border-r-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/30">{item.label}</p>
            <p className={`font-mono text-[13px] font-medium leading-none tabular-nums ${vc}`}>{item.value}</p>
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
    <section className={`border border-white/[0.05] bg-[#111114] ${className}`}>
      <div className="flex items-center justify-between gap-2 border-b border-white/[0.05] px-3 py-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/30">{label}</p>
        {count !== undefined && (
          <span className="border border-white/[0.08] px-2 py-0.5 font-mono text-[10px] text-white/35">
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
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "default" | "primary" | "danger" | "success";
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
}) {
  const styles: Record<string, string> = {
    default:  "border border-white/[0.08] text-white/60 hover:text-white",
    primary:  "border border-amber-500/35 text-amber-300 hover:bg-amber-500/10",
    danger:   "border border-red-500/20 text-red-300/80 hover:border-red-500/40 hover:bg-red-500/10",
    success:  "border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10",
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-8 items-center gap-1.5 border px-2.5 font-mono text-[11px] uppercase tracking-[0.12em] transition-colors disabled:opacity-40 ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Compact form input / select                                         */
/* ------------------------------------------------------------------ */

const inputBase =
  "h-8 w-full border border-white/[0.05] bg-[#0a0a0c] px-2.5 font-mono text-[11px] text-white/80 outline-none transition-colors placeholder:text-white/20 focus:border-amber-500/30 disabled:opacity-50 [color-scheme:dark]";

export function CompactInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputBase} ${props.className ?? ""}`} />;
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
          props.onChange({ target: { value: v } } as unknown as React.ChangeEvent<HTMLSelectElement>);
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
  const filtered = options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()));

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(!open)}
        className="flex h-8 w-full items-center justify-between gap-2 border border-white/[0.05] bg-[#0a0a0c] px-2.5 font-mono text-[11px] text-white/80 outline-none transition-colors hover:bg-white/[0.04] focus:border-amber-500/30 disabled:opacity-50"
      >
        <span className="truncate">{selected ? selected.label : <span className="text-white/40">{placeholder}</span>}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-white/30" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[200px] max-w-[90vw] overflow-hidden border border-white/[0.05] bg-[#111114]">
          <div className="flex items-center gap-2 border-b border-white/[0.05] bg-[#0a0a0c] px-2.5 py-1.5">
            <Search className="h-3 w-3 text-white/30" />
            <input
              type="text"
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari..."
              className="w-full bg-transparent font-mono text-[11px] text-white outline-none placeholder:text-white/20"
            />
          </div>
          <div className="max-h-[200px] overflow-y-auto p-1">
            <button
              type="button"
              onClick={() => { onChange(""); setOpen(false); }}
              className={`w-full px-2.5 py-1.5 text-left text-[11px] transition-colors hover:bg-white/[0.05] ${!value ? "border border-amber-500/30 bg-transparent text-amber-300" : "text-white/60"}`}
            >
              {placeholder}
            </button>
            {filtered.length === 0 ? (
              <div className="px-2.5 py-2 text-center text-[10px] text-white/30">Tidak ada hasil</div>
            ) : (
              filtered.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => { onChange(o.value); setOpen(false); }}
                  className={`w-full truncate px-2.5 py-1.5 text-left text-[11px] transition-colors hover:bg-white/[0.05] ${value === o.value ? "border border-amber-500/30 bg-transparent text-amber-300" : "text-white/80"}`}
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
      className={`w-full border border-white/[0.05] bg-[#0a0a0c] px-2.5 py-2 font-mono text-[11px] text-white outline-none transition-colors placeholder:text-white/20 focus:border-amber-500/30 ${props.className ?? ""}`}
    />
  );
}

export function FieldLabel({ children, required }: { children: ReactNode; required?: boolean }) {
  return (
    <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.12em] text-white/30">
      {children}{required && <span className="ml-0.5 text-red-400/70">*</span>}
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
      ? "border-emerald-500/25 bg-emerald-500/8 text-emerald-200"
      : "border-red-500/25 bg-red-500/8 text-red-200";
  return (
    <div className={`rounded-lg border px-3 py-2 text-[12px] ${s}`}>{message}</div>
  );
}

/* ------------------------------------------------------------------ */
/*  Empty state                                                         */
/* ------------------------------------------------------------------ */

export function EmptyRow({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-white/[0.07] bg-white/[0.01] px-3 py-4 text-[11px] text-white/25">
      {message}
    </div>
  );
}
