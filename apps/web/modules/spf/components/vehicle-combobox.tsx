"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { CompactInput, FieldLabel } from "@/shared/ui/compact";

export interface VehicleOption {
  value: string;
  label: string;
  customerName?: string | null;
}

interface VehicleComboboxProps {
  value: string;
  onChange: (value: string) => void;
  vehicles?: readonly VehicleOption[];
  disabled?: boolean;
  allowManual?: boolean;
  label?: string;
}

function mapUnitRow(row: unknown): VehicleOption | null {
  if (!row || typeof row !== "object") return null;
  const record = row as Record<string, unknown>;
  const value = String(record.unitId ?? record.carId ?? record.value ?? "").trim();
  if (!value) return null;
  const unitName = String(record.unitName ?? record.label ?? value);
  const customerName = record.customerName == null ? null : String(record.customerName);
  return {
    value,
    label: customerName ? `${unitName} · ${customerName}` : unitName,
    customerName,
  };
}

export function VehicleCombobox({
  value,
  onChange,
  vehicles,
  disabled = false,
  allowManual = false,
  label = "Unit",
}: VehicleComboboxProps) {
  const [loadedVehicles, setLoadedVehicles] = useState<VehicleOption[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(!vehicles);

  useEffect(() => {
    if (vehicles) return;
    let cancelled = false;
    setLoading(true);
    fetch("/api/units?limit=100", { credentials: "include", cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        if (cancelled) return;
        const data: unknown[] = Array.isArray(body?.data) ? body.data : [];
        setLoadedVehicles(data.map(mapUnitRow).filter((row: VehicleOption | null): row is VehicleOption => Boolean(row)));
      })
      .catch(() => {
        if (!cancelled) setLoadedVehicles([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [vehicles]);

  const options = useMemo(() => vehicles ?? loadedVehicles, [vehicles, loadedVehicles]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return options.slice(0, 30);
    return options.filter((option) => `${option.value} ${option.label}`.toLowerCase().includes(needle)).slice(0, 30);
  }, [options, query]);

  const selected = options.find((option) => option.value === value);

  return (
    <div className="space-y-2">
      <FieldLabel required>{label}</FieldLabel>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <CompactInput
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            if (allowManual) onChange(event.target.value.trim());
          }}
          disabled={disabled}
          placeholder={selected ? selected.label : loading ? "Memuat unit..." : "Cari unit atau customer"}
          className="pl-8"
        />
      </div>

      <div className="max-h-48 overflow-y-auto border border-border dark:border-white/[0.06]">
        {filtered.length > 0 ? (
          filtered.map((option) => (
            <button
              key={option.value}
              type="button"
              disabled={disabled}
              onClick={() => {
                onChange(option.value);
                setQuery("");
              }}
              className={`flex w-full flex-col px-3 py-2 text-left text-[13px] hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                value === option.value ? "bg-primary/10 text-app-accent-ink" : "text-foreground"
              }`}
            >
              <span className="font-mono text-[12px] font-semibold">{option.value}</span>
              <span className="text-[12px] text-muted-foreground">{option.label}</span>
            </button>
          ))
        ) : (
          <div className="px-3 py-3 text-[12px] text-muted-foreground">
            {allowManual ? "Tidak ada hasil. Nilai yang diketik akan dipakai sebagai car_id." : "Tidak ada unit dari endpoint kendaraan."}
          </div>
        )}
      </div>
    </div>
  );
}
