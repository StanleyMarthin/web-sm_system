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

type RequestType = "WO" | "PR" | "WOV";

interface NormalizedRequestRow {
  type: RequestType;
  id: string | number;
  number: string;
  status: string;
  carId: string | null;
  unitName: string | null;
  dateForFilter: string;
  divisionNames: string[];
  toDivisionName: string | null;
  isPriority: boolean;
  priority: string | null;
  estimatedHours: number;
  totalEstimatedPrice: number;
  vendorName: string | null;
  targetDate: string | null;
  targetDateReturn: string | null;
  title: string;
  notes: string | null;
  remarks: string | null;
  itemName: string | null;
  createdAt: string | null;
  requestDate: string | null;
}

function normalizeRequestRows(input: { wos: any[]; prs: any[]; wovs: any[] }): NormalizedRequestRow[] {
  return [
    ...input.wos.map((w): NormalizedRequestRow => ({
      type: "WO",
      id: w.woId,
      number: w.woNumber,
      status: w.status,
      carId: w.carId ?? null,
      unitName: w.unitName ?? null,
      dateForFilter: w.requestDate || w.createdAt || "",
      divisionNames: [w.fromDivisionName, w.toDivisionName].filter(Boolean),
      toDivisionName: w.toDivisionName ?? null,
      isPriority: Boolean(w.isPriority),
      priority: null,
      estimatedHours: Number(w.estimatedHours || 0),
      totalEstimatedPrice: 0,
      vendorName: null,
      targetDate: null,
      targetDateReturn: null,
      title: w.jobDetail,
      notes: null,
      remarks: null,
      itemName: null,
      createdAt: w.createdAt ?? null,
      requestDate: w.requestDate ?? null,
    })),
    ...input.prs.map((p): NormalizedRequestRow => ({
      type: "PR",
      id: p.prId,
      number: p.prNumber,
      status: p.status,
      carId: p.carId ?? null,
      unitName: p.unitName ?? null,
      dateForFilter: p.createdAt || "",
      divisionNames: [p.divisionName].filter(Boolean),
      toDivisionName: null,
      isPriority: p.priority === "HIGH",
      priority: p.priority ?? null,
      estimatedHours: 0,
      totalEstimatedPrice: Number(p.totalEstimatedPrice || 0),
      vendorName: null,
      targetDate: p.targetDate ?? null,
      targetDateReturn: null,
      title: `Permintaan Belanja - ${p.notes || "Tanpa Keterangan"}`,
      notes: p.notes ?? null,
      remarks: null,
      itemName: null,
      createdAt: p.createdAt ?? null,
      requestDate: null,
    })),
    ...input.wovs.map((v): NormalizedRequestRow => ({
      type: "WOV",
      id: v.wovId,
      number: v.wovNumber,
      status: v.status,
      carId: v.carId ?? null,
      unitName: v.unitName ?? null,
      dateForFilter: v.createdAt || "",
      divisionNames: [v.divisionName].filter(Boolean),
      toDivisionName: null,
      isPriority: Boolean(v.isPriority || false),
      priority: null,
      estimatedHours: 0,
      totalEstimatedPrice: Number(v.totalEstimatedPrice || 0),
      vendorName: v.vendorName ?? null,
      targetDate: null,
      targetDateReturn: v.targetDateReturn ?? null,
      title: `Pekerjaan Luar - ${v.remarks || v.itemName}`,
      notes: null,
      remarks: v.remarks ?? null,
      itemName: v.itemName ?? null,
      createdAt: v.createdAt ?? null,
      requestDate: null,
    })),
  ];
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
  const allRows = normalizeRequestRows({ wos: rawWos, prs: rawPrs, wovs: rawWovs });

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
    ...allRows.flatMap((row) => row.divisionNames.map((division) => ({ value: division, label: division }))),
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

  const filteredRows = allRows.filter((row) => {
    if (activeTab !== "ALL" && activeTab !== row.type) return false;
    if (filterUnit && row.carId !== filterUnit && row.unitName !== filterUnit) return false;
    if (filterDivision && !row.divisionNames.some((division) => division.toLowerCase() === filterDivision.toLowerCase())) return false;
    if (!matchesDateRange(row.dateForFilter)) return false;
    return true;
  });

  const activeRows = filteredRows.filter((row) => !terminalStatuses.includes(row.status));
  const activeWo = activeRows.filter((row) => row.type === "WO");
  const activePr = activeRows.filter((row) => row.type === "PR");
  const activeWov = activeRows.filter((row) => row.type === "WOV");

  const completedWo = hasDateFilter ? filteredRows.filter((row) => row.type === "WO" && ["DONE", "CLOSED"].includes(row.status)) : [];
  const completedPr = hasDateFilter ? filteredRows.filter((row) => row.type === "PR" && ["RECEIVED", "ARRIVED"].includes(row.status)) : [];
  const completedWov = hasDateFilter ? filteredRows.filter((row) => row.type === "WOV" && row.status === "RECEIVED") : [];

  const urgentWo = activeWo.filter((row) => row.isPriority).length;
  const urgentPr = activePr.filter((row) => row.priority === "HIGH").length;

  const totalWoHours = activeWo.reduce((acc, row) => acc + row.estimatedHours, 0);
  const totalPrValue = activePr.reduce((acc, row) => acc + row.totalEstimatedPrice, 0);

  // Status breakdown (includes active and completed items for the visual funnel)
  const statusCounts: Record<string, number> = {};
  filteredRows
    .filter((row) => hasDateFilter || !terminalStatuses.includes(row.status))
    .forEach((row) => {
    statusCounts[row.status] = (statusCounts[row.status] || 0) + 1;
  });

  // Division load breakdown
  const divisionLoad: Record<string, number> = {};
  activeWo.forEach((row) => {
    const div = row.toDivisionName || "Lainnya";
    divisionLoad[div] = (divisionLoad[div] || 0) + 1;
  });

  // Global division load breakdown (Fallback reference so screen is never barren!)
  const globalDivisionLoad: Record<string, number> = {};
  allRows
    .filter((row) => row.type === "WO" && !terminalStatuses.includes(row.status))
    .forEach((row) => {
      const div = row.toDivisionName || "Lainnya";
      globalDivisionLoad[div] = (globalDivisionLoad[div] || 0) + 1;
    });

  // Critical items (Target date is close or urgent)
  const criticalItems: any[] = [];

  activeWo.forEach((row) => {
    if (row.isPriority) {
      criticalItems.push({
        id: row.id,
        type: "WO",
        number: row.number,
        unit: row.unitName || "Unit Umum",
        title: row.title,
        info: `Kategori: WO Urgent · Tujuan: ${row.toDivisionName}`,
        date: row.requestDate,
        isUrgent: true
      });
    }
  });

  activePr.forEach((row) => {
    if (row.priority === "HIGH" || row.targetDate) {
      criticalItems.push({
        id: row.id,
        type: "PR",
        number: row.number,
        unit: row.unitName || "Stock/Gudang",
        title: row.title,
        info: `Target Tiba: ${row.targetDate || "-"} · Nilai: Rp ${row.totalEstimatedPrice.toLocaleString("id-ID")}`,
        date: row.targetDate || row.createdAt?.split("T")[0],
        isUrgent: row.priority === "HIGH"
      });
    }
  });

  activeWov.forEach((row) => {
    if (row.targetDateReturn) {
      criticalItems.push({
        id: row.id,
        type: "WOV",
        number: row.number,
        unit: row.unitName || "Unit Rekanan",
        title: row.title,
        info: `Target Kembali: ${row.targetDateReturn} · Vendor: ${row.vendorName}`,
        date: row.targetDateReturn,
        isUrgent: false
      });
    }
  });

  // Fallback criticals from the whole workshop
  const globalCriticalItems: any[] = [];
  allRows.filter((row) => row.type === "WO" && row.isPriority && !terminalStatuses.includes(row.status)).forEach((row) => {
    globalCriticalItems.push({
      id: row.id,
      type: "WO",
      number: row.number,
      unit: row.unitName || "Unit Umum",
      title: row.title,
      info: `Global Urgent · Tujuan: ${row.toDivisionName}`,
      date: row.requestDate,
      isUrgent: true
    });
  });

  const displayCriticals = criticalItems.length > 0 ? criticalItems.slice(0, 4) : globalCriticalItems.slice(0, 4);

  const hasActiveFilters =
    (!isDivisionLeadScope ? filterUnit || filterDivision : filterUnit) ||
    startDate ||
    endDate;

  return (
    <div className="space-y-0 bg-muted dark:bg-background">

      {/* ── FILTER BAR ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end gap-2 border-b border-border bg-card px-3 py-3 shadow-sm">
        <div className="relative">
          <span className="mb-1 block font-mono text-[12px] uppercase tracking-[0.12em] text-muted-foreground">Jenis</span>
          <select
            value={activeTab}
            onChange={(e) => setActiveTab(e.target.value as "ALL" | "WO" | "PR" | "WOV")}
            className="h-10 border border-border bg-background px-3 pr-8 text-[15px] font-mono uppercase tracking-[0.08em] text-foreground outline-none focus:border-primary/50 appearance-none cursor-pointer"
          >
            <option value="ALL">SEMUA JENIS</option>
            <option value="WO">WORK ORDER</option>
            <option value="PR">PURCHASE REQUEST</option>
            <option value="WOV">VENDOR WO</option>
          </select>
          <span className="pointer-events-none absolute bottom-2.5 right-2 text-[14px] text-muted-foreground">▾</span>
        </div>

        <div className="relative">
          <span className="mb-1 block font-mono text-[12px] uppercase tracking-[0.12em] text-muted-foreground">Unit</span>
          <select
            value={filterUnit}
            onChange={(e) => setFilterUnit(e.target.value)}
            className="h-10 border border-border bg-background px-3 pr-8 text-[15px] font-mono uppercase tracking-[0.08em] text-foreground outline-none focus:border-primary/50 appearance-none cursor-pointer"
          >
            <option value="">SEMUA UNIT</option>
            {unitsList.map((u: any) => (
              <option key={u.value} value={u.value}>{u.label}</option>
            ))}
          </select>
          <span className="pointer-events-none absolute bottom-2.5 right-2 text-[14px] text-muted-foreground">▾</span>
        </div>

        <div className="relative">
          <span className="mb-1 block font-mono text-[12px] uppercase tracking-[0.12em] text-muted-foreground">Divisi</span>
          <select
            value={filterDivision}
            disabled={isDivisionLeadScope}
            onChange={(e) => setFilterDivision(e.target.value)}
            className="h-10 border border-border bg-background px-3 pr-8 text-[15px] font-mono uppercase tracking-[0.08em] text-foreground outline-none focus:border-primary/50 appearance-none cursor-pointer disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
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
          <span className="pointer-events-none absolute bottom-2.5 right-2 text-[14px] text-muted-foreground">▾</span>
        </div>

        <div className="ml-auto flex flex-wrap items-end gap-2">
          <label className="grid gap-1">
            <span className="font-mono text-[12px] uppercase tracking-[0.12em] text-muted-foreground">Dari</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-10 border border-border bg-background px-3 text-[15px] font-mono text-foreground outline-none focus:border-primary/50 dark:[color-scheme:dark] cursor-pointer"
            />
          </label>
          <label className="grid gap-1">
            <span className="font-mono text-[12px] uppercase tracking-[0.12em] text-muted-foreground">Sampai</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-10 border border-border bg-background px-3 text-[15px] font-mono text-foreground outline-none focus:border-primary/50 dark:[color-scheme:dark] cursor-pointer"
            />
          </label>
          {hasActiveFilters && (
            <button
              onClick={() => {
                setFilterUnit("");
                setStartDate("");
                setEndDate("");
                if (!isDivisionLeadScope) setFilterDivision("");
              }}
              title="Reset Filters"
              className="flex h-10 w-10 items-center justify-center border border-border bg-background text-muted-foreground transition-colors hover:border-primary/35 hover:text-foreground"
            >
              <RotateCcw className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* ── STAT STRIP: WO / PR / WOV ──────────────────────────────────── */}
      <div className="grid grid-cols-3 border-b border-border dark:border-border">
        {/* WO */}
        {(activeTab === "ALL" || activeTab === "WO") && (
          <div className="flex flex-col justify-center px-5 py-3 h-16 border-r border-border dark:border-border gap-0.5">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-mono text-foreground dark:text-foreground leading-none">{activeWo.length}</span>
              <span className="text-[14px] uppercase tracking-[0.12em] text-muted-foreground dark:text-muted-foreground font-mono">WO AKTIF</span>
            </div>
            <div className="flex items-center gap-3 text-[14px] font-mono text-muted-foreground dark:text-muted-foreground">
              <span>
                Urgent:{" "}
                <span className={urgentWo > 0 ? "text-app-accent-ink" : "text-muted-foreground dark:text-muted-foreground"}>
                  {urgentWo}
                </span>
              </span>
              <span className="text-muted-foreground">·</span>
              <span>{totalWoHours} jam est.</span>
            </div>
          </div>
        )}
        {(activeTab !== "ALL" && activeTab !== "WO") && (
          <div className="h-16 border-r border-border dark:border-border" />
        )}

        {/* PR */}
        {(activeTab === "ALL" || activeTab === "PR") && (
          <div className="flex flex-col justify-center px-5 py-3 h-16 border-r border-border dark:border-border gap-0.5">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-mono text-foreground dark:text-foreground leading-none">{activePr.length}</span>
              <span className="text-[14px] uppercase tracking-[0.12em] text-muted-foreground dark:text-muted-foreground font-mono">PR AKTIF</span>
            </div>
            <div className="flex items-center gap-3 text-[14px] font-mono text-muted-foreground dark:text-muted-foreground">
              <span>
                Urgent:{" "}
                <span className={urgentPr > 0 ? "text-app-accent-ink" : "text-muted-foreground dark:text-muted-foreground"}>
                  {urgentPr}
                </span>
              </span>
              <span className="text-muted-foreground">·</span>
              <span className="truncate">Rp {totalPrValue.toLocaleString("id-ID")}</span>
            </div>
          </div>
        )}
        {(activeTab !== "ALL" && activeTab !== "PR") && (
          <div className="h-16 border-r border-border dark:border-border" />
        )}

        {/* WOV */}
        {(activeTab === "ALL" || activeTab === "WOV") && (
          <div className="flex flex-col justify-center px-5 py-3 h-16 gap-0.5">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-mono text-foreground dark:text-foreground leading-none">{activeWov.length}</span>
              <span className="text-[14px] uppercase tracking-[0.12em] text-muted-foreground dark:text-muted-foreground font-mono">WOV AKTIF</span>
            </div>
            <div className="flex items-center gap-3 text-[14px] font-mono text-muted-foreground dark:text-muted-foreground">
              <span>
                Kembali:{" "}
                <span className={completedWov.length > 0 ? "text-muted-foreground dark:text-muted-foreground" : "text-muted-foreground dark:text-muted-foreground"}>
                  {completedWov.length}
                </span>
              </span>
              <span className="text-muted-foreground">·</span>
              <span>{new Set(activeWov.map((v: any) => v.vendorName)).size} rekanan</span>
            </div>
          </div>
        )}
        {(activeTab !== "ALL" && activeTab !== "WOV") && (
          <div className="h-16" />
        )}
      </div>

      {/* ── ALUR STATUS: OPEN → DISTRIBUSI → DIPROSES → SELESAI ─────────── */}
      <div className="grid grid-cols-4 border-b border-border dark:border-border">
        <div className="flex flex-col justify-center items-center h-12 border-r border-border dark:border-border gap-0.5">
          <span className="text-[15px] uppercase tracking-[0.14em] text-muted-foreground dark:text-muted-foreground font-mono">OPEN / BARU</span>
          <span className="text-base font-mono font-light text-foreground dark:text-foreground leading-none">{statusCounts["OPEN"] || 0}</span>
        </div>
        <div className="flex flex-col justify-center items-center h-12 border-r border-border dark:border-border gap-0.5">
          <span className="text-[15px] uppercase tracking-[0.14em] text-muted-foreground dark:text-muted-foreground font-mono">DISTRIBUSI</span>
          <span className="text-base font-mono font-light text-app-accent-ink/80 leading-none">{statusCounts["APPROVED"] || 0}</span>
        </div>
        <div className="flex flex-col justify-center items-center h-12 border-r border-border dark:border-border gap-0.5">
          <span className="text-[15px] uppercase tracking-[0.14em] text-muted-foreground dark:text-muted-foreground font-mono">DIPROSES</span>
          <span className="text-base font-mono font-light text-foreground dark:text-foreground leading-none">
            {(statusCounts["SUBMITTED"] || 0) +
              (statusCounts["PROSES_VENDOR"] || 0) +
              (statusCounts["HUNTING"] || 0) +
              (statusCounts["SENT"] || 0) +
              (statusCounts["ORDERED"] || 0)}
          </span>
        </div>
        <div className="flex flex-col justify-center items-center h-12 gap-0.5">
          <span className="text-[15px] uppercase tracking-[0.14em] text-muted-foreground dark:text-muted-foreground font-mono">SELESAI</span>
          <span className="text-base font-mono font-light text-foreground dark:text-foreground leading-none">
            {(statusCounts["DONE"] || 0) +
              (statusCounts["RECEIVED"] || 0) +
              (statusCounts["ARRIVED"] || 0)}
          </span>
        </div>
      </div>

      {/* ── MAIN BODY: TIMELINE + DIVISION LOAD ─────────────────────────── */}
      <div className="grid lg:grid-cols-12 border-b border-border dark:border-border">

        {/* Left: Division Load (8 cols) */}
        {(activeTab === "ALL" || activeTab === "WO") && (
          <div className="lg:col-span-8 border-r border-border dark:border-border">
            <div className="px-5 py-2.5 border-b border-border dark:border-border">
              <span className="text-[14px] uppercase tracking-[0.12em] text-muted-foreground dark:text-muted-foreground font-mono">
                DISTRIBUSI BEBAN KERJA ANTAR DIVISI
              </span>
            </div>
            <div className="px-5 py-3 space-y-2.5">
              {Object.keys(divisionLoad).length === 0 ? (
                <p className="text-[15px] font-mono text-muted-foreground dark:text-muted-foreground py-3">— Tidak ada antrean aktif</p>
              ) : (
                Object.entries(divisionLoad)
                  .sort((a, b) => b[1] - a[1])
                  .map(([div, count]) => {
                    const percentage = Math.round((count / activeWo.length) * 100);
                    return (
                      <div key={div} className="space-y-1">
                        <div className="flex items-center justify-between text-[14px] font-mono">
                          <span className="text-foreground dark:text-foreground">{div}</span>
                          <span className="text-app-accent-ink">{count} · {percentage}%</span>
                        </div>
                        <div className="h-px w-full bg-muted overflow-hidden">
                          <div
                            className="h-full bg-primary/60 transition-all duration-500"
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
          <div className="lg:col-span-8 border-r border-border dark:border-border" />
        )}

        {/* Right: Timeline Kritis (4 cols) */}
        <div className="lg:col-span-4">
          <div className="px-5 py-2.5 border-b border-border dark:border-border flex items-center justify-between">
            <span className="text-[14px] uppercase tracking-[0.12em] text-muted-foreground dark:text-muted-foreground font-mono">
              TIMELINE KRITIS &amp; TARGET
            </span>
            <AlertTriangle className="h-3 w-3 text-app-accent-ink shrink-0" />
          </div>
          <div className="px-5 py-3 space-y-2 max-h-[260px] overflow-y-auto">
            {displayCriticals.length === 0 ? (
              <p className="text-[14px] font-mono text-muted-foreground dark:text-muted-foreground py-2">— Tidak ada item kritis</p>
            ) : (
              displayCriticals.map((item) => (
                <div
                  key={item.id}
                  className={`py-2 px-3 border-l-2 space-y-1 ${
                    item.isUrgent ? "border-primary/60 bg-primary/[0.03]" : "border-border dark:border-border bg-muted"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-[14px] font-mono font-extrabold uppercase px-1.5 py-px border ${
                      item.type === "WO"
                        ? "border-primary/30 text-app-accent-ink"
                        : item.type === "PR"
                        ? "border-border text-muted-foreground dark:text-muted-foreground"
                        : "border-border dark:border-border text-muted-foreground dark:text-muted-foreground"
                    }`}>
                      {item.type}
                    </span>
                    <span className="text-[15px] text-muted-foreground dark:text-muted-foreground font-mono">{item.number}</span>
                  </div>
                  <p className="text-[14px] font-mono text-foreground dark:text-foreground truncate">{item.unit} · {item.title}</p>
                  <p className="text-[15px] font-mono text-muted-foreground dark:text-muted-foreground">{item.info}</p>
                  <div className="flex items-center gap-1 text-[14px] text-muted-foreground dark:text-muted-foreground font-mono pt-0.5 border-t border-border dark:border-border">
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
        <div className="flex items-center gap-3 px-5 py-2.5 border-r border-border dark:border-border h-10">
          <span className="text-[14px] uppercase tracking-[0.12em] text-muted-foreground dark:text-muted-foreground font-mono">WD SELESAI</span>
          <span className="text-sm font-mono font-light text-foreground dark:text-foreground">{completedWo.length}</span>
        </div>
        <div className="flex items-center gap-3 px-5 py-2.5 border-r border-border dark:border-border h-10">
          <span className="text-[14px] uppercase tracking-[0.12em] text-muted-foreground dark:text-muted-foreground font-mono">PR TIBA</span>
          <span className="text-sm font-mono font-light text-foreground dark:text-foreground">{completedPr.length}</span>
        </div>
        <div className="flex items-center gap-3 px-5 py-2.5 h-10">
          <span className="text-[14px] uppercase tracking-[0.12em] text-muted-foreground dark:text-muted-foreground font-mono">WOV KEMBALI</span>
          <span className="text-sm font-mono font-light text-foreground dark:text-foreground">{completedWov.length}</span>
        </div>
      </div>

    </div>
  );
}
