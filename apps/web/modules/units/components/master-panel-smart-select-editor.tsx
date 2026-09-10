"use client";

import type { ICellEditorParams } from "ag-grid-community";
import React, { forwardRef, useImperativeHandle, useMemo, useState } from "react";

export interface SmartSelectOption {
  label: string;
  value: string;
  code?: string | null;
}

type SmartSelectCellEditorProps<TData> = ICellEditorParams<TData, string> & {
  values?: SmartSelectOption[];
};

function matchesOption(option: SmartSelectOption, query: string): boolean {
  const text = `${option.label} ${option.code ?? ""} ${option.value}`.toLowerCase();
  return text.includes(query.toLowerCase());
}

export const SmartSelectCellEditor = forwardRef(function SmartSelectCellEditor<TData>(
  props: SmartSelectCellEditorProps<TData>,
  ref: React.ForwardedRef<unknown>,
) {
  const options = props.values ?? [];
  const initialValue = options.length === 1 ? options[0].value : String(props.value ?? "");
  const [value, setValue] = useState(initialValue);
  const [query, setQuery] = useState(options.find((option) => option.value === initialValue)?.label ?? "");
  const [activeIndex, setActiveIndex] = useState(0);
  const visibleOptions = useMemo(() => {
    const source = query.trim() ? options.filter((option) => matchesOption(option, query)) : options;
    return source.slice(0, query.trim() ? 20 : 3);
  }, [options, query]);

  useImperativeHandle(ref, () => ({
    getValue: () => value,
    isPopup: () => options.length > 3,
    getPopupPosition: () => "under",
  }));

  if (options.length === 0) {
    return (
      <div className="flex h-full items-center bg-card px-2 text-[13px] text-muted-foreground">
        Tidak ada pilihan
      </div>
    );
  }

  if (options.length <= 3) {
    return (
      <select
        autoFocus
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="h-full w-full bg-card px-2 text-[13px] text-foreground outline-none"
      >
        {options.length === 1 ? null : <option value="">Pilih</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    );
  }

  function selectOption(option: SmartSelectOption) {
    setValue(option.value);
    setQuery(option.label);
    props.stopEditing();
  }

  return (
    <div className="w-72 border border-border bg-card p-2 shadow-xl">
      <input
        autoFocus
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setActiveIndex(0);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActiveIndex((current) => Math.min(current + 1, Math.max(visibleOptions.length - 1, 0)));
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex((current) => Math.max(current - 1, 0));
          }
          if (event.key === "Enter") {
            event.preventDefault();
            const option = visibleOptions[activeIndex];
            if (option) selectOption(option);
          }
          if (event.key === "Escape") {
            props.stopEditing(true);
          }
        }}
        className="h-8 w-full border border-border bg-background px-2 text-[13px] text-foreground outline-none focus:border-primary/45"
        placeholder="Cari..."
      />
      <p className="mt-2 text-[11px] font-mono uppercase tracking-[0.08em] text-muted-foreground">
        {query.trim() ? "Hasil" : "Rekomendasi"}
      </p>
      <div className="mt-1 max-h-44 overflow-auto">
        {visibleOptions.length === 0 ? (
          <div className="px-2 py-2 text-[13px] text-muted-foreground">Tidak ada pilihan</div>
        ) : visibleOptions.map((option, index) => (
          <button
            key={option.value}
            type="button"
            onMouseDown={(event) => {
              event.preventDefault();
              selectOption(option);
            }}
            className={`block w-full px-2 py-1.5 text-left text-[13px] ${
              index === activeIndex ? "bg-primary/[0.08] text-app-accent-ink" : "text-foreground hover:bg-muted"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
});
