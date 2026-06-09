"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState } from "react";
import {
  ClipboardList,
  ShoppingBag,
  Truck,
  AlertTriangle,
  Calendar,
  Clock,
  CheckCircle2,
  TrendingUp,
  Activity,
  ArrowRight,
  Filter,
  RotateCcw,
  Sparkles,
  Inbox,
  Award,
  CheckCircle
} from "lucide-react";
import { useRouter } from "next/navigation";

interface RequestsDashboardShellProps {
  user: any;
  woPayload: any;
  prPayload: any;
  vendorPayload: any;
}

function uniqueOptions(options: any[]): any[] {
  const seen = new Set<string>();
  return options.filter((option) => {
    const label = String(option?.label ?? option?.value ?? "").trim();
    const key = label.toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function RequestsDashboardShell({
  user,
  woPayload,
  prPayload,
  vendorPayload
}: RequestsDashboardShellProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"ALL" | "WO" | "PR" | "WOV">("ALL");

  const isDivisionLeadScope =
    !user?.scope?.canViewAllUnits &&
    user?.roleProfile?.scopeBasis === "ASSIGNED_DIVISIONS" &&
    user?.roleProfile?.approvalRank === 1;

  // Filter States
  const [filterUnit, setFilterUnit] = useState<string>("");
  const [filterDivision, setFilterDivision] = useState<string>(
    isDivisionLeadScope ? user?.divisionName || "" : "",
  );

  // Date Filters
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const rawWos = woPayload?.data || [];
  const rawPrs = prPayload?.data || [];
  const rawWovs = vendorPayload?.data || [];

  // References
  const unitsList = uniqueOptions([
    ...(woPayload?.references?.units || []),
    ...(prPayload?.references?.units || []),
    ...(vendorPayload?.references?.units || []),
  ]);
  const divisionsList = uniqueOptions([
    ...(woPayload?.references?.divisions || []),
    ...(prPayload?.references?.divisions || []),
    ...(vendorPayload?.references?.divisions || []),
    ...rawWos.flatMap((w: any) => [
      w.fromDivisionName ? { value: w.fromDivisionName, label: w.fromDivisionName } : null,
      w.toDivisionName ? { value: w.toDivisionName, label: w.toDivisionName } : null,
    ]).filter(Boolean),
    ...rawPrs.map((p: any) =>
      p.divisionName ? { value: p.divisionName, label: p.divisionName } : null,
    ).filter(Boolean),
    ...rawWovs.map((v: any) =>
      v.divisionName ? { value: v.divisionName, label: v.divisionName } : null,
    ).filter(Boolean),
  ]);
  const hasDateFilter = Boolean(startDate || endDate);
  const terminalStatuses = ["DONE", "CLOSED", "REJECTED", "CANCEL", "CANCELLED", "CANCELED", "ARRIVED", "RECEIVED"];

  // Helper to match date ranges
  const matchesDateRange = (dateStr: string) => {
    if (!dateStr) return true;
    const actualDate = dateStr.includes("T") ? dateStr.split("T")[0] : dateStr;
    if (startDate && actualDate < startDate) return false;
    if (endDate && actualDate > endDate) return false;
    return true;
  };

  // Filter datasets dynamically in real time (with case-insensitive division matches)
  const filteredWos = rawWos.filter((w: any) => {
    if (activeTab !== "ALL" && activeTab !== "WO") return false;
    if (filterUnit && w.carId !== filterUnit && w.unitName !== filterUnit) return false;
    if (filterDivision &&
      w.fromDivisionName?.toLowerCase() !== filterDivision.toLowerCase() &&
      w.toDivisionName?.toLowerCase() !== filterDivision.toLowerCase()) return false;
    if (!matchesDateRange(w.requestDate || w.createdAt)) return false;
    return true;
  });

  const filteredPrs = rawPrs.filter((p: any) => {
    if (activeTab !== "ALL" && activeTab !== "PR") return false;
    if (filterUnit && p.carId !== filterUnit && p.unitName !== filterUnit) return false;
    if (filterDivision && p.divisionName?.toLowerCase() !== filterDivision.toLowerCase()) return false;
    if (!matchesDateRange(p.createdAt)) return false;
    return true;
  });

  const filteredWovs = rawWovs.filter((v: any) => {
    if (activeTab !== "ALL" && activeTab !== "WOV") return false;
    if (filterUnit && v.carId !== filterUnit && v.unitName !== filterUnit) return false;
    if (filterDivision && v.divisionName?.toLowerCase() !== filterDivision.toLowerCase()) return false;
    if (!matchesDateRange(v.createdAt)) return false;
    return true;
  });

  // Calculate Metrics based on filtered data
  const activeWo = filteredWos.filter((w: any) => !terminalStatuses.includes(w.status));
  const activePr = filteredPrs.filter((p: any) => !terminalStatuses.includes(p.status));
  const activeWov = filteredWovs.filter((v: any) => !terminalStatuses.includes(v.status));

  // COMPLETED (Selesai) requests metrics
  const completedWo = hasDateFilter ? filteredWos.filter((w: any) => ["DONE", "CLOSED"].includes(w.status)) : [];
  const completedPr = hasDateFilter ? filteredPrs.filter((p: any) => ["RECEIVED", "ARRIVED"].includes(p.status)) : [];
  const completedWov = hasDateFilter ? filteredWovs.filter((v: any) => ["RECEIVED"].includes(v.status)) : [];

  const totalActiveCount = activeWo.length + activePr.length + activeWov.length;

  const urgentWo = activeWo.filter((w: any) => w.isPriority).length;
  const urgentPr = activePr.filter((p: any) => p.priority === "HIGH").length;
  const urgentWov = activeWov.filter((v: any) => v.isPriority || false).length;

  // Estimated values
  const totalWoHours = activeWo.reduce((acc: number, cur: any) => acc + Number(cur.estimatedHours || 0), 0);
  const totalPrValue = activePr.reduce((acc: number, cur: any) => acc + Number(cur.totalEstimatedPrice || 0), 0);
  const totalWovValue = activeWov.reduce((acc: number, cur: any) => acc + Number(cur.totalEstimatedPrice || 0), 0);

  // Status breakdown (includes active and completed items for the visual funnel)
  const statusCounts: Record<string, number> = {};
  [...filteredWos, ...filteredPrs, ...filteredWovs]
    .filter((r: any) => hasDateFilter || !terminalStatuses.includes(r.status))
    .forEach((r: any) => {
    statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
  });

  // Division load breakdown
  const divisionLoad: Record<string, number> = {};
  activeWo.forEach((w: any) => {
    const div = w.toDivisionName || "Lainnya";
    divisionLoad[div] = (divisionLoad[div] || 0) + 1;
  });

  // Global division load breakdown (Fallback reference so screen is never barren!)
  const globalDivisionLoad: Record<string, number> = {};
  rawWos
    .filter((w: any) => !terminalStatuses.includes(w.status))
    .forEach((w: any) => {
      const div = w.toDivisionName || "Lainnya";
      globalDivisionLoad[div] = (globalDivisionLoad[div] || 0) + 1;
    });

  // Critical items (Target date is close or urgent)
  const criticalItems: any[] = [];

  activeWo.forEach((w: any) => {
    if (w.isPriority) {
      criticalItems.push({
        id: w.woId,
        type: "WO",
        number: w.woNumber,
        unit: w.unitName || "Unit Umum",
        title: w.jobDetail,
        info: `Kategori: WO Urgent · Tujuan: ${w.toDivisionName}`,
        date: w.requestDate,
        isUrgent: true
      });
    }
  });

  activePr.forEach((p: any) => {
    if (p.priority === "HIGH" || p.targetDate) {
      criticalItems.push({
        id: p.prId,
        type: "PR",
        number: p.prNumber,
        unit: p.unitName || "Stock/Gudang",
        title: `Permintaan Belanja - ${p.notes || "Tanpa Keterangan"}`,
        info: `Target Tiba: ${p.targetDate || "-"} · Nilai: Rp ${Number(p.totalEstimatedPrice).toLocaleString("id-ID")}`,
        date: p.targetDate || p.createdAt?.split("T")[0],
        isUrgent: p.priority === "HIGH"
      });
    }
  });

  activeWov.forEach((v: any) => {
    if (v.targetDateReturn) {
      criticalItems.push({
        id: v.wovId,
        type: "WOV",
        number: v.wovNumber,
        unit: v.unitName || "Unit Rekanan",
        title: `Pekerjaan Luar - ${v.remarks || v.itemName}`,
        info: `Target Kembali: ${v.targetDateReturn} · Vendor: ${v.vendorName}`,
        date: v.targetDateReturn,
        isUrgent: false
      });
    }
  });

  // Fallback criticals from the whole workshop
  const globalCriticalItems: any[] = [];
  rawWos.filter((w: any) => w.isPriority && !terminalStatuses.includes(w.status)).forEach((w: any) => {
    globalCriticalItems.push({
      id: w.woId,
      type: "WO",
      number: w.woNumber,
      unit: w.unitName || "Unit Umum",
      title: w.jobDetail,
      info: `Global Urgent · Tujuan: ${w.toDivisionName}`,
      date: w.requestDate,
      isUrgent: true
    });
  });

  const displayCriticals = criticalItems.length > 0 ? criticalItems.slice(0, 4) : globalCriticalItems.slice(0, 4);

  const hasActiveFilters =
    (!isDivisionLeadScope ? filterUnit || filterDivision : filterUnit) ||
    startDate ||
    endDate;

  return (
    <div className="space-y-0 bg-slate-50 dark:bg-[#0a0a0c]">

      {/* ── FILTER BAR ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-gray-300 dark:border-white/5 px-0 py-2">
        <div className="relative">
          <select
            value={activeTab}
            onChange={(e) => setActiveTab(e.target.value as "ALL" | "WO" | "PR" | "WOV")}
            className="h-7 border border-gray-300 dark:border-white/10 bg-white dark:bg-[#111114] px-2 pr-6 text-[11px] font-mono uppercase tracking-[0.08em] text-gray-700 dark:text-white/60 outline-none focus:border-amber-500/40 appearance-none cursor-pointer"
          >
            <option value="ALL">SEMUA JENIS</option>
            <option value="WO">WORK ORDER</option>
            <option value="PR">PURCHASE REQUEST</option>
            <option value="WOV">VENDOR WO</option>
          </select>
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white/20 text-[10px]">▾</span>
        </div>

        <div className="relative">
          <select
            value={filterUnit}
            onChange={(e) => setFilterUnit(e.target.value)}
            className="h-7 border border-gray-300 dark:border-white/10 bg-white dark:bg-[#111114] px-2 pr-6 text-[11px] font-mono uppercase tracking-[0.08em] text-gray-700 dark:text-white/60 outline-none focus:border-amber-500/40 appearance-none cursor-pointer"
          >
            <option value="">SEMUA UNIT</option>
            {unitsList.map((u: any) => (
              <option key={u.value} value={u.value}>{u.label}</option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white/20 text-[10px]">▾</span>
        </div>

        <div className="relative">
          <select
            value={filterDivision}
            disabled={isDivisionLeadScope}
            onChange={(e) => setFilterDivision(e.target.value)}
            className="h-7 border border-gray-300 dark:border-white/10 bg-white dark:bg-[#111114] px-2 pr-6 text-[11px] font-mono uppercase tracking-[0.08em] text-gray-700 dark:text-white/60 outline-none focus:border-amber-500/40 appearance-none cursor-pointer disabled:opacity-40"
          >
            {isDivisionLeadScope ? (
              <option value={user.divisionName}>{user.divisionName?.toUpperCase()}</option>
            ) : (
              <>
                <option value="">SEMUA DIVISI</option>
                {divisionsList.map((d: any) => (
                  <option key={d.value} value={d.label}>{d.label}</option>
                ))}
              </>
            )}
          </select>
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white/20 text-[10px]">▾</span>
        </div>

        <div className="flex items-center gap-1 ml-auto">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="h-7 border border-gray-300 dark:border-white/10 bg-white dark:bg-[#111114] px-2 text-[11px] font-mono text-gray-700 dark:text-white/60 outline-none focus:border-amber-500/40 [color-scheme:dark] cursor-pointer"
          />
          <span className="text-gray-400 dark:text-white/20 text-[10px] font-mono">—</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="h-7 border border-gray-300 dark:border-white/10 bg-white dark:bg-[#111114] px-2 text-[11px] font-mono text-gray-700 dark:text-white/60 outline-none focus:border-amber-500/40 [color-scheme:dark] cursor-pointer"
          />
          {hasActiveFilters && (
            <button
              onClick={() => {
                setFilterUnit("");
                setStartDate("");
                setEndDate("");
                if (!isDivisionLeadScope) setFilterDivision("");
              }}
              title="Reset Filters"
              className="h-7 w-7 flex items-center justify-center border border-gray-300 dark:border-white/5 bg-white dark:bg-[#111114] text-gray-500 dark:text-white/30 hover:text-gray-800 dark:text-white/70 transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* ── STAT STRIP: WO / PR / WOV ──────────────────────────────────── */}
      <div className="grid grid-cols-3 border-b border-gray-300 dark:border-white/5">
        {/* WO */}
        {(activeTab === "ALL" || activeTab === "WO") && (
          <div className="flex flex-col justify-center px-5 py-3 h-16 border-r border-gray-300 dark:border-white/5 gap-0.5">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-mono text-gray-950 dark:text-white leading-none">{activeWo.length}</span>
              <span className="text-[10px] uppercase tracking-[0.12em] text-gray-500 dark:text-white/30 font-mono">WO AKTIF</span>
            </div>
            <div className="flex items-center gap-3 text-[10px] font-mono text-gray-500 dark:text-white/25">
              <span>
                Urgent:{" "}
                <span className={urgentWo > 0 ? "text-amber-500" : "text-gray-500 dark:text-white/30"}>
                  {urgentWo}
                </span>
              </span>
              <span className="text-white/10">·</span>
              <span>{totalWoHours} jam est.</span>
            </div>
          </div>
        )}
        {(activeTab !== "ALL" && activeTab !== "WO") && (
          <div className="h-16 border-r border-gray-300 dark:border-white/5" />
        )}

        {/* PR */}
        {(activeTab === "ALL" || activeTab === "PR") && (
          <div className="flex flex-col justify-center px-5 py-3 h-16 border-r border-gray-300 dark:border-white/5 gap-0.5">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-mono text-gray-950 dark:text-white leading-none">{activePr.length}</span>
              <span className="text-[10px] uppercase tracking-[0.12em] text-gray-500 dark:text-white/30 font-mono">PR AKTIF</span>
            </div>
            <div className="flex items-center gap-3 text-[10px] font-mono text-gray-500 dark:text-white/25">
              <span>
                Urgent:{" "}
                <span className={urgentPr > 0 ? "text-amber-500" : "text-gray-500 dark:text-white/30"}>
                  {urgentPr}
                </span>
              </span>
              <span className="text-white/10">·</span>
              <span className="truncate">Rp {totalPrValue.toLocaleString("id-ID")}</span>
            </div>
          </div>
        )}
        {(activeTab !== "ALL" && activeTab !== "PR") && (
          <div className="h-16 border-r border-gray-300 dark:border-white/5" />
        )}

        {/* WOV */}
        {(activeTab === "ALL" || activeTab === "WOV") && (
          <div className="flex flex-col justify-center px-5 py-3 h-16 gap-0.5">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-mono text-gray-950 dark:text-white leading-none">{activeWov.length}</span>
              <span className="text-[10px] uppercase tracking-[0.12em] text-gray-500 dark:text-white/30 font-mono">WOV AKTIF</span>
            </div>
            <div className="flex items-center gap-3 text-[10px] font-mono text-gray-500 dark:text-white/25">
              <span>
                Kembali:{" "}
                <span className={completedWov.length > 0 ? "text-gray-500 dark:text-white/50" : "text-gray-500 dark:text-white/30"}>
                  {completedWov.length}
                </span>
              </span>
              <span className="text-white/10">·</span>
              <span>{new Set(activeWov.map((v: any) => v.vendorName)).size} rekanan</span>
            </div>
          </div>
        )}
        {(activeTab !== "ALL" && activeTab !== "WOV") && (
          <div className="h-16" />
        )}
      </div>

      {/* ── ALUR STATUS: OPEN → DISTRIBUSI → DIPROSES → SELESAI ─────────── */}
      <div className="grid grid-cols-4 border-b border-gray-300 dark:border-white/5">
        <div className="flex flex-col justify-center items-center h-12 border-r border-gray-300 dark:border-white/5 gap-0.5">
          <span className="text-[9px] uppercase tracking-[0.14em] text-gray-500 dark:text-white/25 font-mono">OPEN / BARU</span>
          <span className="text-base font-mono font-light text-gray-950 dark:text-white leading-none">{statusCounts["OPEN"] || 0}</span>
        </div>
        <div className="flex flex-col justify-center items-center h-12 border-r border-gray-300 dark:border-white/5 gap-0.5">
          <span className="text-[9px] uppercase tracking-[0.14em] text-gray-500 dark:text-white/25 font-mono">DISTRIBUSI</span>
          <span className="text-base font-mono font-light text-amber-500/80 leading-none">{statusCounts["APPROVED"] || 0}</span>
        </div>
        <div className="flex flex-col justify-center items-center h-12 border-r border-gray-300 dark:border-white/5 gap-0.5">
          <span className="text-[9px] uppercase tracking-[0.14em] text-gray-500 dark:text-white/25 font-mono">DIPROSES</span>
          <span className="text-base font-mono font-light text-gray-950 dark:text-white leading-none">
            {(statusCounts["SUBMITTED"] || 0) +
              (statusCounts["PROSES_VENDOR"] || 0) +
              (statusCounts["HUNTING"] || 0) +
              (statusCounts["SENT"] || 0) +
              (statusCounts["ORDERED"] || 0)}
          </span>
        </div>
        <div className="flex flex-col justify-center items-center h-12 gap-0.5">
          <span className="text-[9px] uppercase tracking-[0.14em] text-gray-500 dark:text-white/25 font-mono">SELESAI</span>
          <span className="text-base font-mono font-light text-gray-700 dark:text-white/60 leading-none">
            {(statusCounts["DONE"] || 0) +
              (statusCounts["RECEIVED"] || 0) +
              (statusCounts["ARRIVED"] || 0)}
          </span>
        </div>
      </div>

      {/* ── MAIN BODY: TIMELINE + DIVISION LOAD ─────────────────────────── */}
      <div className="grid lg:grid-cols-12 border-b border-gray-300 dark:border-white/5">

        {/* Left: Division Load (8 cols) */}
        {(activeTab === "ALL" || activeTab === "WO") && (
          <div className="lg:col-span-8 border-r border-gray-300 dark:border-white/5">
            <div className="px-5 py-2.5 border-b border-gray-300 dark:border-white/5">
              <span className="text-[10px] uppercase tracking-[0.12em] text-gray-500 dark:text-white/30 font-mono">
                DISTRIBUSI BEBAN KERJA ANTAR DIVISI
              </span>
            </div>
            <div className="px-5 py-3 space-y-2.5">
              {Object.keys(divisionLoad).length === 0 ? (
                <p className="text-[11px] font-mono text-gray-400 dark:text-white/20 py-3">— Tidak ada antrean aktif</p>
              ) : (
                Object.entries(divisionLoad)
                  .sort((a, b) => b[1] - a[1])
                  .map(([div, count]) => {
                    const percentage = Math.round((count / activeWo.length) * 100);
                    return (
                      <div key={div} className="space-y-1">
                        <div className="flex items-center justify-between text-[10px] font-mono">
                          <span className="text-gray-800 dark:text-white/70">{div}</span>
                          <span className="text-amber-500">{count} · {percentage}%</span>
                        </div>
                        <div className="h-px w-full bg-white/[0.03] overflow-hidden">
                          <div
                            className="h-full bg-amber-500/60 transition-all duration-500"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        )}
        {(activeTab !== "ALL" && activeTab !== "WO") && (
          <div className="lg:col-span-8 border-r border-gray-300 dark:border-white/5" />
        )}

        {/* Right: Timeline Kritis (4 cols) */}
        <div className="lg:col-span-4">
          <div className="px-5 py-2.5 border-b border-gray-300 dark:border-white/5 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-[0.12em] text-gray-500 dark:text-white/30 font-mono">
              TIMELINE KRITIS &amp; TARGET
            </span>
            <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />
          </div>
          <div className="px-5 py-3 space-y-2 max-h-[260px] overflow-y-auto">
            {displayCriticals.length === 0 ? (
              <p className="text-[10px] font-mono text-gray-400 dark:text-white/20 py-2">— Tidak ada item kritis</p>
            ) : (
              displayCriticals.map((item) => (
                <div
                  key={item.id}
                  className={`py-2 px-3 border-l-2 space-y-1 ${
                    item.isUrgent ? "border-amber-500/60 bg-amber-500/[0.03]" : "border-gray-300 dark:border-white/10 bg-white/[0.01]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-[8px] font-mono font-extrabold uppercase px-1.5 py-px border ${
                      item.type === "WO"
                        ? "border-amber-500/30 text-amber-500"
                        : item.type === "PR"
                        ? "border-white/15 text-gray-500 dark:text-white/50"
                        : "border-gray-300 dark:border-white/10 text-gray-400 dark:text-white/40"
                    }`}>
                      {item.type}
                    </span>
                    <span className="text-[9px] text-gray-500 dark:text-white/25 font-mono">{item.number}</span>
                  </div>
                  <p className="text-[10px] font-mono text-gray-900 dark:text-white/80 truncate">{item.unit} · {item.title}</p>
                  <p className="text-[9px] font-mono text-gray-500 dark:text-white/30">{item.info}</p>
                  <div className="flex items-center gap-1 text-[8px] text-gray-400 dark:text-white/20 font-mono pt-0.5 border-t border-gray-300 dark:border-white/5">
                    <Calendar className="h-2 w-2" />
                    <span>Target: {item.date || "—"}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── REKAPITULASI STRIP ──────────────────────────────────────────── */}
      <div className="grid grid-cols-3">
        <div className="flex items-center gap-3 px-5 py-2.5 border-r border-gray-300 dark:border-white/5 h-10">
          <span className="text-[10px] uppercase tracking-[0.12em] text-gray-500 dark:text-white/25 font-mono">WD SELESAI</span>
          <span className="text-sm font-mono font-light text-gray-800 dark:text-white/70">{completedWo.length}</span>
        </div>
        <div className="flex items-center gap-3 px-5 py-2.5 border-r border-gray-300 dark:border-white/5 h-10">
          <span className="text-[10px] uppercase tracking-[0.12em] text-gray-500 dark:text-white/25 font-mono">PR TIBA</span>
          <span className="text-sm font-mono font-light text-gray-800 dark:text-white/70">{completedPr.length}</span>
        </div>
        <div className="flex items-center gap-3 px-5 py-2.5 h-10">
          <span className="text-[10px] uppercase tracking-[0.12em] text-gray-500 dark:text-white/25 font-mono">WOV KEMBALI</span>
          <span className="text-sm font-mono font-light text-gray-800 dark:text-white/70">{completedWov.length}</span>
        </div>
      </div>

    </div>
  );
}
