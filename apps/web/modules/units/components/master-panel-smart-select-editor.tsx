"use client";

import type { ICellEditorParams } from "ag-grid-community";
import type { CustomCellEditorProps } from "ag-grid-react";
import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";

export interface SmartSelectOption {
  label: string;
  value: string;
  code?: string | null;
}

type SmartSelectCellEditorProps<TData> = ICellEditorParams<TData, string> & Partial<CustomCellEditorProps<TData, string>> & {
  values?: SmartSelectOption[];
  inline?: boolean;
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
  const datalistId = useRef(`sms-smart-select-${Math.random().toString(36).slice(2)}`);
  const valueRef = useRef(initialValue);
  const compactListRef = useRef<HTMLDivElement | null>(null);
  const [value, setValue] = useState(initialValue);
  const [query, setQuery] = useState(options.find((option) => option.value === initialValue)?.label ?? "");
  const [activeIndex, setActiveIndex] = useState(0);
  const visibleOptions = useMemo(() => {
    const source = query.trim() ? options.filter((option) => matchesOption(option, query)) : options;
    return source.slice(0, query.trim() ? 20 : 3);
  }, [options, query]);

  function resolveInputValue(input: string): string {
    const trimmed = input.trim();
    const exact = options.find((option) =>
      option.value.toLowerCase() === trimmed.toLowerCase()
      || option.label.toLowerCase() === trimmed.toLowerCase()
      || (option.code ?? "").toLowerCase() === trimmed.toLowerCase()
    );
    if (exact) return exact.value;
    const matches = options.filter((option) => matchesOption(option, trimmed));
    return matches.length === 1 ? matches[0].value : valueRef.current;
  }

  useImperativeHandle(ref, () => ({
    getValue: () => props.inline ? resolveInputValue(query) : valueRef.current,
    isPopup: () => !props.inline,
    getPopupPosition: () => "under",
  }));

  useEffect(() => {
    if (options.length > 0 && options.length <= 3) compactListRef.current?.focus();
  }, [options.length]);

  function selectOption(option: SmartSelectOption) {
    valueRef.current = option.value;
    props.onValueChange?.(option.value);
    setValue(option.value);
    setQuery(option.label);
    props.stopEditing();
  }

  if (props.inline) {
    return (
      <div className="h-full w-full">
        <input
          autoFocus
          list={datalistId.current}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onBlur={() => {
            valueRef.current = resolveInputValue(query);
            props.onValueChange?.(valueRef.current);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === "Tab") {
              valueRef.current = resolveInputValue(query);
              props.onValueChange?.(valueRef.current);
              props.stopEditing();
            }
            if (event.key === "Escape") props.stopEditing(true);
          }}
          className="h-full w-full border-0 bg-transparent px-2 text-[13px] text-foreground outline-none"
        />
        <datalist id={datalistId.current}>
          {options.slice(0, 80).map((option) => (
            <option key={option.value} value={option.label} />
          ))}
        </datalist>
      </div>
    );
  }

  if (options.length === 0) {
    return (
      <div className="ag-custom-component-popup z-[9999] flex w-[280px] items-center border border-border bg-card px-3 py-2 text-[13px] text-muted-foreground shadow-xl dark:border-white/[0.08] dark:bg-muted">
        Tidak ada pilihan
      </div>
    );
  }

  if (options.length <= 3) {
    return (
      <div
        ref={compactListRef}
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActiveIndex((current) => Math.min(current + 1, options.length - 1));
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex((current) => Math.max(current - 1, 0));
          }
          if (event.key === "Enter") {
            event.preventDefault();
            const option = options[activeIndex];
            if (option) selectOption(option);
          }
          if (event.key === "Escape") {
            props.stopEditing(true);
          }
        }}
        className="ag-custom-component-popup z-[9999] w-[280px] border border-border bg-card p-1 shadow-xl outline-none dark:border-white/[0.08] dark:bg-muted"
      >
        {options.map((option, index) => (
          <button
            key={option.value}
            type="button"
            onMouseDown={(event) => {
              event.preventDefault();
              selectOption(option);
            }}
            className={`block w-full px-2 py-1.5 text-left text-[13px] ${
              index === activeIndex || option.value === value ? "bg-primary/[0.08] text-app-accent-ink" : "text-foreground hover:bg-muted"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="ag-custom-component-popup z-[9999] w-[280px] border border-border bg-card p-2 shadow-xl dark:border-white/[0.08] dark:bg-muted">
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
      <div className="mt-2 max-h-44 overflow-auto">
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
