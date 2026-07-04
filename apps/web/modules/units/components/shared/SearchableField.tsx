"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

export interface SearchOption {
  value: string;
  label?: string;
  dedupeKey?: string;
}

interface SearchableFieldProps {
  value: string;
  options: SearchOption[];
  onChange: (value: string) => void;
  onSelect?: (option: SearchOption) => void;
  placeholder?: string;
  disabled?: boolean;
  heightClassName?: string;
  menuZClassName?: string;
  iconStrokeWidth?: number;
  closeOnInputBlurDelay?: boolean;
  ariaLabel?: string;
  maxVisibleOptions?: number;
  minSearchLength?: number;
}

export function SearchableField({
  value,
  options,
  onChange,
  onSelect,
  placeholder,
  disabled = false,
  heightClassName = "h-9",
  menuZClassName = "z-50",
  iconStrokeWidth,
  closeOnInputBlurDelay = false,
  ariaLabel = "Buka pilihan",
  maxVisibleOptions,
  minSearchLength = 0,
}: SearchableFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const normalizedValue = value.trim().toLowerCase();
  const canShowOptions = normalizedValue.length >= minSearchLength;
  const filteredOptions = canShowOptions
    ? options.filter((option) => {
      const searchable = `${option.value} ${option.label ?? ""}`.toLowerCase();
      return !normalizedValue || searchable.includes(normalizedValue);
    })
    : [];
  const menuStyle = maxVisibleOptions
    ? { maxHeight: `${maxVisibleOptions * 36 + 8}px` }
    : undefined;

  function chooseOption(option: SearchOption) {
    onChange(option.value);
    onSelect?.(option);
    setIsOpen(false);
  }

  return (
    <div
      className="relative"
      onBlur={closeOnInputBlurDelay ? undefined : (event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setIsOpen(false);
        }
      }}
    >
      <div className={`flex ${heightClassName} items-center border border-border bg-card transition-colors focus-within:border-primary/40`}>
        <input
          value={value}
          disabled={disabled}
          onFocus={() => setIsOpen(true)}
          onBlur={closeOnInputBlurDelay ? () => window.setTimeout(() => setIsOpen(false), 120) : undefined}
          onChange={(event) => {
            onChange(event.target.value);
            setIsOpen(true);
          }}
          placeholder={placeholder}
          className="h-full min-w-0 flex-1 bg-transparent px-3 text-[15px] font-mono text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-40"
        />
        <button
          type="button"
          disabled={disabled}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setIsOpen((open) => !open)}
          className="flex h-full w-8 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-35"
          aria-label={ariaLabel}
        >
          <ChevronDown className="h-3 w-3" strokeWidth={iconStrokeWidth} />
        </button>
      </div>

      {isOpen && !disabled && canShowOptions ? (
        <div
          className={`absolute left-0 right-0 top-[calc(100%+4px)] ${menuZClassName} ${maxVisibleOptions ? "" : "max-h-44"} overflow-auto border border-border bg-card py-1 shadow-xl shadow-black/10 dark:shadow-black/40`}
          style={menuStyle}
        >
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => (
              <button
                key={option.dedupeKey ?? `${option.value}:${option.label ?? ""}`}
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  chooseOption(option);
                }}
                className="block w-full px-3 py-2 text-left font-mono transition-colors hover:bg-primary/[0.07] hover:text-app-accent-ink"
              >
                <span className="block whitespace-normal break-words text-[14px] leading-snug text-foreground">{option.value}</span>
                {option.label ? (
                  <span className="mt-0.5 block whitespace-normal break-words text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{option.label}</span>
                ) : null}
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-[14px] font-mono text-muted-foreground">
              Tidak ada data cocok. Tekan Simpan untuk memakai teks ini.
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
