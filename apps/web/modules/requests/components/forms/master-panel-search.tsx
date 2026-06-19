"use client";

import type { UnitPanelRecord } from "@smsystem/contracts/unit-panel";
import { ChevronDown, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { fetchUnitPanels } from "@/shared/api/units";

export interface RequestPanelOption {
  value: string;
  label: string;
  detail: string;
  nodeType: "PANEL" | "PART";
  section: string;
  category: string | null;
  qty: number;
  defaultLocationType: UnitPanelRecord["defaultLocationType"];
  defaultStockStatus: UnitPanelRecord["defaultStockStatus"];
  defaultConditionType: UnitPanelRecord["defaultConditionType"];
}

interface SearchSelectProps {
  value: string;
  options: RequestPanelOption[];
  onChange: (value: string, option: RequestPanelOption | null) => void;
  placeholder: string;
  accent?: "amber" | "purple" | "sky";
  disabled?: boolean;
  isLoading?: boolean;
}

export interface StrictSearchOption {
  value: string;
  label: string;
  detail?: string;
}

interface StrictSearchSelectProps {
  value: string;
  options: StrictSearchOption[];
  onChange: (value: string, option: StrictSearchOption | null) => void;
  placeholder: string;
  accent?: SearchSelectProps["accent"];
  disabled?: boolean;
  isLoading?: boolean;
}

function flattenPanelTree(rows: UnitPanelRecord[]): RequestPanelOption[] {
  return rows.flatMap((row) => {
    const panelOption: RequestPanelOption = {
      value: row.name,
      label: row.name,
      detail: [row.category, row.section, "Panel"].filter(Boolean).join(" · "),
      nodeType: "PANEL",
      section: row.section,
      category: row.category,
      qty: row.qty ?? 1,
      defaultLocationType: row.defaultLocationType,
      defaultStockStatus: row.defaultStockStatus,
      defaultConditionType: row.defaultConditionType,
    };

    const partOptions = row.children.map((child) => ({
      value: child.name,
      label: child.name,
      detail: [row.category, row.section, row.name].filter(Boolean).join(" · "),
      nodeType: "PART" as const,
      section: row.section,
      category: row.category,
      qty: child.qty ?? 1,
      defaultLocationType: child.defaultLocationType,
      defaultStockStatus: child.defaultStockStatus,
      defaultConditionType: child.defaultConditionType,
    }));

    return [panelOption, ...partOptions];
  });
}

function focusClass(accent: SearchSelectProps["accent"]) {
  if (accent === "purple") return "focus-within:border-info/35";
  if (accent === "sky") return "focus-within:border-info/35";
  return "focus-within:border-primary/35";
}

function hoverClass(accent: SearchSelectProps["accent"]) {
  if (accent === "purple") return "hover:bg-info/[0.08] hover:text-info";
  if (accent === "sky") return "hover:bg-info/[0.08] hover:text-info";
  return "hover:bg-primary/[0.08] hover:text-app-accent-ink";
}

export function useMasterPanelOptions(unitId: string) {
  const [rows, setRows] = useState<UnitPanelRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!unitId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clear stale panel options immediately when unit is cleared.
      setRows([]);
      return;
    }

    let isAlive = true;
    setIsLoading(true);
    void fetchUnitPanels("", unitId)
      .then((result) => {
        if (!isAlive) return;
        setRows(result.payload?.data.tree ?? []);
      })
      .finally(() => {
        if (isAlive) setIsLoading(false);
      });

    return () => {
      isAlive = false;
    };
  }, [unitId]);

  return {
    options: useMemo(() => flattenPanelTree(rows), [rows]),
    isLoading,
  };
}

export function SearchSelect({
  value,
  options,
  onChange,
  placeholder,
  accent = "amber",
  disabled = false,
  isLoading = false,
}: SearchSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const normalizedValue = value.trim().toLowerCase();
  const filteredOptions = options.filter((option) => {
    const haystack = `${option.label} ${option.detail}`.toLowerCase();
    return !normalizedValue || haystack.includes(normalizedValue);
  });

  function selectOption(option: RequestPanelOption) {
    onChange(option.value, option);
    setIsOpen(false);
  }

  return (
    <div className="relative">
      <div className={`flex h-10 items-center border border-border bg-background transition-colors dark:border-border dark:bg-muted ${focusClass(accent)}`}>
        <Search className="ml-3 h-3.5 w-3.5 shrink-0 text-muted-foreground dark:text-muted-foreground" />
        <input
          value={value}
          disabled={disabled}
          onFocus={() => setIsOpen(true)}
          onBlur={() => window.setTimeout(() => setIsOpen(false), 120)}
          onChange={(event) => {
            onChange(event.target.value, null);
            setIsOpen(true);
          }}
          placeholder={isLoading ? "Memuat master panel..." : placeholder}
          className="h-full min-w-0 flex-1 bg-transparent px-2 text-sm text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-45 dark:placeholder:text-muted-foreground"
        />
        <button
          type="button"
          disabled={disabled}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setIsOpen((open) => !open)}
          className="flex h-full w-9 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 dark:text-muted-foreground dark:hover:text-foreground"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>

      {isOpen && !disabled && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-40 max-h-52 overflow-auto border border-border bg-popover py-1 shadow-lg dark:border-border dark:shadow-none">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => (
              <button
                key={`${option.nodeType}:${option.detail}:${option.value}`}
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  selectOption(option);
                }}
                className={`flex w-full items-start gap-3 px-3 py-2.5 text-left text-sm text-foreground transition-colors ${hoverClass(accent)}`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium leading-5 text-foreground">
                    {option.label}
                  </span>
                  <span className="mt-0.5 block truncate text-[14px] uppercase tracking-[0.08em] text-muted-foreground">
                    {option.detail}
                  </span>
                </span>
                <span className="mt-0.5 shrink-0 border border-border px-1.5 py-0.5 text-[15px] font-mono uppercase tracking-[0.08em] text-muted-foreground dark:border-border">
                  {option.nodeType === "PART" ? "Part" : "Panel"} · {option.qty}
                </span>
              </button>
            ))
          ) : (
            <div className="px-3 py-2.5 text-xs text-muted-foreground">Tidak ada master panel cocok.</div>
          )}
        </div>
      )}
    </div>
  );
}

export function StrictSearchSelect({
  value,
  options,
  onChange,
  placeholder,
  accent = "amber",
  disabled = false,
  isLoading = false,
}: StrictSearchSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selectedOption = options.find((option) => option.value === value) ?? null;
  const normalizedQuery = query.trim().toLowerCase();
  const filteredOptions = options.filter((option) => {
    const haystack = `${option.label} ${option.detail ?? ""}`.toLowerCase();
    return !normalizedQuery || haystack.includes(normalizedQuery);
  });

  function selectOption(option: StrictSearchOption) {
    onChange(option.value, option);
    setQuery("");
    setIsOpen(false);
  }

  return (
    <div className="relative">
      <div className={`flex h-10 items-center border border-border bg-background transition-colors dark:border-border dark:bg-muted ${focusClass(accent)}`}>
        <Search className="ml-3 h-3.5 w-3.5 shrink-0 text-muted-foreground dark:text-muted-foreground" />
        <input
          value={isOpen ? query : selectedOption?.label ?? ""}
          disabled={disabled}
          onFocus={() => {
            setQuery("");
            setIsOpen(true);
          }}
          onBlur={() => window.setTimeout(() => setIsOpen(false), 120)}
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
          }}
          placeholder={isLoading ? "Memuat data..." : placeholder}
          className="h-full min-w-0 flex-1 bg-transparent px-2 text-sm text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-45 dark:placeholder:text-muted-foreground"
        />
        <button
          type="button"
          disabled={disabled}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            setQuery("");
            setIsOpen((open) => !open);
          }}
          className="flex h-full w-9 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 dark:text-muted-foreground dark:hover:text-foreground"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>

      {isOpen && !disabled && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-40 max-h-52 overflow-auto border border-border bg-popover py-1 shadow-lg dark:border-border dark:shadow-none">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => (
              <button
                key={`${option.value}:${option.label}`}
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  selectOption(option);
                }}
                className={`flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm text-foreground transition-colors ${hoverClass(accent)}`}
              >
                <span className="min-w-0 truncate">{option.label}</span>
                {option.detail ? (
                  <span className="shrink-0 text-[14px] uppercase tracking-[0.12em] text-muted-foreground">{option.detail}</span>
                ) : null}
              </button>
            ))
          ) : (
            <div className="px-3 py-2.5 text-xs text-muted-foreground">Tidak ada data cocok.</div>
          )}
        </div>
      )}
    </div>
  );
}
