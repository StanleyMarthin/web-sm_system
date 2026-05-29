"use client";

import { Filter, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { SearchableSelect } from "@/shared/ui/compact";

export interface FilterBarDivision {
  id: number;
  name: string;
}

export interface FilterBarUnit {
  id: string;
  name: string;
}

interface DashboardFilterBarProps {
  divisions: FilterBarDivision[];
  units: FilterBarUnit[];
  /** divisionId yang sudah terkunci untuk user KD — tidak bisa diubah */
  lockedDivisionId?: number | null;
}

type DateMode = "single" | "range";

function today() {
  return new Date().toISOString().split("T")[0]!;
}

export function DashboardFilterBar({
  divisions,
  units,
  lockedDivisionId,
}: DashboardFilterBarProps) {
  const router      = useRouter();
  const searchParams = useSearchParams();

  const initMode = searchParams.get("dateFrom") ? "range" : "single";

  const [dateMode,    setDateMode]    = useState<DateMode>(initMode as DateMode);
  const [dateSingle,  setDateSingle]  = useState(searchParams.get("date") ?? today());
  const [dateFrom,    setDateFrom]    = useState(searchParams.get("dateFrom") ?? today());
  const [dateTo,      setDateTo]      = useState(searchParams.get("dateTo") ?? today());
  const [divisionId,  setDivisionId]  = useState(
    lockedDivisionId != null
      ? String(lockedDivisionId)
      : (searchParams.get("divisionId") ?? ""),
  );
  const [unitId,      setUnitId]      = useState(searchParams.get("unitId") ?? "");

  /* Filter units by selected division */
  const filteredUnits = divisionId ? units : units;

  const buildParams = useCallback(() => {
    const p = new URLSearchParams();
    if (dateMode === "single") {
      if (dateSingle) p.set("date", dateSingle);
    } else {
      if (dateFrom) p.set("dateFrom", dateFrom);
      if (dateTo)   p.set("dateTo",   dateTo);
    }
    if (divisionId) p.set("divisionId", divisionId);
    if (unitId)     p.set("unitId",     unitId);
    return p;
  }, [dateMode, dateSingle, dateFrom, dateTo, divisionId, unitId]);

  function reset() {
    setDateMode("single");
    setDateSingle(today());
    setDateFrom(today());
    setDateTo(today());
    setDivisionId(lockedDivisionId != null ? String(lockedDivisionId) : "");
    setUnitId("");
    router.push("/dashboard");
  }

  /* Auto-apply on every change (debounced 600ms) */
  useEffect(() => {
    const t = setTimeout(() => {
      const p = buildParams();
      router.push(`/dashboard?${p.toString()}`);
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateMode, dateSingle, dateFrom, dateTo, divisionId, unitId]);

  const hasFilter =
    dateSingle !== today() ||
    dateFrom !== today() ||
    dateTo !== today() ||
    Boolean(divisionId && !lockedDivisionId) ||
    Boolean(unitId);

  return (
    <div className="flex flex-wrap items-center gap-2 border border-gray-300 dark:border-white/5 bg-white dark:bg-[#111114] px-3 py-2">
      {/* Icon */}
      <Filter className="h-3.5 w-3.5 shrink-0 text-gray-500 dark:text-white/30" />

      {/* Date mode toggle */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => setDateMode("single")}
          className={dateMode === "single"
            ? "border border-amber-500/40 bg-amber-500/[0.06] px-3 py-1 text-[10px] font-mono uppercase tracking-[0.12em] text-amber-500"
            : "border border-gray-300 dark:border-white/10 px-3 py-1 text-[10px] font-mono uppercase tracking-[0.12em] text-gray-400 dark:text-white/40 hover:text-gray-700 dark:text-white/60 transition-colors"}
        >
          Hari
        </button>
        <button
          onClick={() => setDateMode("range")}
          className={dateMode === "range"
            ? "border border-amber-500/40 bg-amber-500/[0.06] px-3 py-1 text-[10px] font-mono uppercase tracking-[0.12em] text-amber-500"
            : "border border-gray-300 dark:border-white/10 px-3 py-1 text-[10px] font-mono uppercase tracking-[0.12em] text-gray-400 dark:text-white/40 hover:text-gray-700 dark:text-white/60 transition-colors"}
        >
          Rentang
        </button>
      </div>

      {/* Separator */}
      <div className="h-4 w-px bg-white/[0.08]" />

      {/* Date input(s) */}
      {dateMode === "single" ? (
        <input
          type="date"
          value={dateSingle}
          onChange={(e) => setDateSingle(e.target.value)}
          className="h-7 border border-gray-300 dark:border-white/10 bg-white dark:bg-[#111114] px-2 text-[11px] font-mono text-gray-700 dark:text-white/60 outline-none focus:border-amber-500/40 [color-scheme:dark] cursor-pointer"
        />
      ) : (
        <div className="flex items-center gap-1.5 text-[12px]">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-7 border border-gray-300 dark:border-white/10 bg-white dark:bg-[#111114] px-2 text-[11px] font-mono text-gray-700 dark:text-white/60 outline-none focus:border-amber-500/40 [color-scheme:dark] cursor-pointer"
          />
          <span className="text-gray-500 dark:text-white/30">–</span>
          <input
            type="date"
            value={dateTo}
            min={dateFrom}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-7 border border-gray-300 dark:border-white/10 bg-white dark:bg-[#111114] px-2 text-[11px] font-mono text-gray-700 dark:text-white/60 outline-none focus:border-amber-500/40 [color-scheme:dark] cursor-pointer"
          />
        </div>
      )}

      {/* Separator */}
      <div className="h-4 w-px bg-white/[0.08]" />

      {/* Division filter */}
      {lockedDivisionId != null ? (
        /* KD: show locked division as read-only badge */
        <span className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[11px] text-amber-400/80">
          {divisions.find((d) => d.id === lockedDivisionId)?.name ?? "Divisi saya"}
        </span>
      ) : (
        <SearchableSelect
          value={divisionId}
          onChange={(v) => { setDivisionId(v); setUnitId(""); }}
          placeholder="Semua divisi"
          options={divisions.map(d => ({ value: String(d.id), label: d.name }))}
          className="w-40"
        />
      )}

      {/* Unit filter */}
      <SearchableSelect
        value={unitId}
        onChange={setUnitId}
        placeholder="Semua unit"
        options={filteredUnits.map(u => ({ value: u.id, label: u.name }))}
        className="w-48"
      />

      {/* Reset */}
      {hasFilter && (
        <>
          <div className="h-4 w-px bg-white/[0.08]" />
          <button
            onClick={reset}
            className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-white/35 hover:text-gray-700 dark:text-white/60"
          >
            <X className="h-3 w-3" />
            Reset
          </button>
        </>
      )}
    </div>
  );
}
