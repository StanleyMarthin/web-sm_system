"use client";

import { useState } from "react";
import { PeriodList } from "./period-list";
import { PeriodForm } from "./forms/period-form";
import type { SpfPeriod, SpfPagination } from "@/shared/api/spf-contracts";
import type { SpfRole } from "@/shared/auth/admin-session";
import { ActionButton, PageHeader } from "@/shared/ui/compact";
import { useSweetAlert } from "@/shared/ui/sweet-alert";

interface PeriodListShellProps {
  rows: readonly SpfPeriod[];
  meta: SpfPagination;
  role: SpfRole;
}

const MONTH_OPTIONS = [
  { value: "01", label: "Januari" },
  { value: "02", label: "Februari" },
  { value: "03", label: "Maret" },
  { value: "04", label: "April" },
  { value: "05", label: "Mei" },
  { value: "06", label: "Juni" },
  { value: "07", label: "Juli" },
  { value: "08", label: "Agustus" },
  { value: "09", label: "September" },
  { value: "10", label: "Oktober" },
  { value: "11", label: "November" },
  { value: "12", label: "Desember" },
];

export function PeriodListShell({ rows, meta, role }: PeriodListShellProps) {
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    "DRAFT_REJECT" | "ALL" | "WAITING_APPROVAL" | "APPROVED" | "PUBLISHED"
  >("DRAFT_REJECT");
  const [selectedUnit, setSelectedUnit] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const { alertElement } = useSweetAlert();

  // Extract unique vehicle units dynamically from period titles
  const uniqueUnits = Array.from(
    new Set(
      rows
        .map((p) => {
          const match = p.title.match(/^([A-Z0-9_]+)/i);
          return match ? match[1] : undefined;
        })
        .filter((u): u is string => Boolean(u)),
    ),
  );

  // Extract available years from rows
  const uniqueYears = Array.from(
    new Set(
      rows.map((p) => String(new Date(p.created_at).getFullYear())),
    ),
  ).sort((a, b) => Number(b) - Number(a));
  if (!uniqueYears.includes("2026")) uniqueYears.unshift("2026");

  // Tab count stats
  const draftRejectCount = rows.filter(
    (p) => p.status === "DRAFT" || p.status === "REJECTED",
  ).length;
  const waitingCount = rows.filter((p) => p.status === "WAITING_APPROVAL").length;
  const approvedCount = rows.filter((p) => p.status === "APPROVED").length;
  const publishedCount = rows.filter((p) => p.status === "PUBLISHED").length;

  // Filter rows based on status, unit, month, year, and search
  const filteredRows = rows.filter((period) => {
    // 1. Status Tab
    if (activeTab === "DRAFT_REJECT" && period.status !== "DRAFT" && period.status !== "REJECTED") {
      return false;
    }
    if (activeTab === "WAITING_APPROVAL" && period.status !== "WAITING_APPROVAL") {
      return false;
    }
    if (activeTab === "APPROVED" && period.status !== "APPROVED") {
      return false;
    }
    if (activeTab === "PUBLISHED" && period.status !== "PUBLISHED") {
      return false;
    }

    // 2. Unit Kendaraan
    if (selectedUnit && !period.title.toLowerCase().includes(selectedUnit.toLowerCase())) {
      return false;
    }

    // 3. Bulan (dibuat)
    if (selectedMonth) {
      const createdDate = new Date(period.created_at);
      const monthNum = String(createdDate.getMonth() + 1).padStart(2, "0");
      if (monthNum !== selectedMonth) return false;
    }

    // 4. Tahun (dibuat)
    if (selectedYear) {
      const createdDate = new Date(period.created_at);
      const yearStr = String(createdDate.getFullYear());
      if (yearStr !== selectedYear) return false;
    }

    // 5. Search Title / Description
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const titleMatch = period.title.toLowerCase().includes(q);
      const descMatch = period.description?.toLowerCase().includes(q);
      if (!titleMatch && !descMatch) return false;
    }

    return true;
  });

  const hasActiveFilters = Boolean(selectedUnit || selectedMonth || selectedYear || searchQuery);

  function handleResetFilters() {
    setSelectedUnit("");
    setSelectedMonth("");
    setSelectedYear("");
    setSearchQuery("");
  }

  return (
    <section aria-labelledby="spf-period-title" className="space-y-4">
      {alertElement}

      <PageHeader
        eyebrow="SPF Admin"
        title="Daftar Periode Progress"
        actions={
          role === "ADMIN" ? (
            <ActionButton
              variant="primary"
              onClick={() => {
                setCreateOpen(true);
                setNotice(null);
              }}
            >
              + Buat Periode Baru
            </ActionButton>
          ) : undefined
        }
      />

      {/* Accessible notice */}
      {notice && (
        <p
          role="status"
          aria-live="polite"
          className="border border-success/20 bg-success/8 px-3 py-2 text-[13px] text-success dark:border-success/25 dark:bg-success/8"
        >
          {notice}
        </p>
      )}

      {/* Filter Bar (Status, Unit Kendaraan, Bulan, Tahun, Search Periode) */}
      <div className="flex flex-wrap items-center gap-2.5 rounded border border-border bg-muted/30 p-2.5 dark:border-white/[0.06] dark:bg-white/[0.02]">
        {/* Filter Status */}
        <div className="flex flex-col gap-1">
          <label htmlFor="filter-status" className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground dark:text-foreground/50">
            Status
          </label>
          <select
            id="filter-status"
            value={activeTab}
            onChange={(e) => setActiveTab(e.target.value as any)}
            className="h-8 rounded border border-border bg-background px-2.5 font-mono text-[11px] font-semibold text-foreground outline-none transition-colors focus:border-primary dark:border-white/[0.1] dark:bg-popover"
          >
            <option value="DRAFT_REJECT">Draft & Reject ({draftRejectCount})</option>
            <option value="ALL">Semua Status ({rows.length})</option>
            <option value="WAITING_APPROVAL">Waiting Approval ({waitingCount})</option>
            <option value="APPROVED">Approved ({approvedCount})</option>
            <option value="PUBLISHED">Published ({publishedCount})</option>
          </select>
        </div>

        {/* Filter Unit Kendaraan */}
        <div className="flex flex-col gap-1">
          <label htmlFor="filter-unit" className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground dark:text-foreground/50">
            Unit Kendaraan
          </label>
          <select
            id="filter-unit"
            value={selectedUnit}
            onChange={(e) => setSelectedUnit(e.target.value)}
            className="h-8 rounded border border-border bg-background px-2.5 font-mono text-[11px] text-foreground outline-none transition-colors focus:border-primary dark:border-white/[0.1] dark:bg-popover"
          >
            <option value="">Semua Unit Kendaraan</option>
            {uniqueUnits.map((unit) => (
              <option key={unit} value={unit}>
                {unit}
              </option>
            ))}
          </select>
        </div>

        {/* Filter Bulan */}
        <div className="flex flex-col gap-1">
          <label htmlFor="filter-month" className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground dark:text-foreground/50">
            Bulan
          </label>
          <select
            id="filter-month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="h-8 rounded border border-border bg-background px-2.5 font-mono text-[11px] text-foreground outline-none transition-colors focus:border-primary dark:border-white/[0.1] dark:bg-popover"
          >
            <option value="">Semua Bulan</option>
            {MONTH_OPTIONS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        {/* Filter Tahun */}
        <div className="flex flex-col gap-1">
          <label htmlFor="filter-year" className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground dark:text-foreground/50">
            Tahun
          </label>
          <select
            id="filter-year"
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="h-8 rounded border border-border bg-background px-2.5 font-mono text-[11px] text-foreground outline-none transition-colors focus:border-primary dark:border-white/[0.1] dark:bg-popover"
          >
            <option value="">Semua Tahun</option>
            {uniqueYears.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        {/* Search Input Periode */}
        <div className="flex flex-1 flex-col gap-1 min-w-[200px]">
          <label htmlFor="filter-search" className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground dark:text-foreground/50">
            Cari Judul / Periode
          </label>
          <input
            id="filter-search"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Ketik judul periode..."
            className="h-8 rounded border border-border bg-background px-2.5 text-[12px] text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary dark:border-white/[0.1] dark:bg-popover"
          />
        </div>

        {/* Reset Filter Button */}
        {hasActiveFilters && (
          <div className="flex items-end self-end">
            <button
              type="button"
              onClick={handleResetFilters}
              className="h-8 rounded border border-border bg-muted px-3 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground dark:border-white/[0.08] dark:bg-white/[0.04]"
            >
              Reset
            </button>
          </div>
        )}
      </div>

      <PeriodList
        rows={filteredRows}
        meta={{
          ...meta,
          total: filteredRows.length,
        }}
        role={role}
      />

      {/* Create dialog */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/35 p-4 backdrop-blur-[1px] dark:bg-background/80">
          <div className="w-full max-w-lg border border-border bg-white p-6 shadow-2xl dark:border-white/[0.08] dark:bg-popover">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground dark:text-foreground/50">
                Buat Periode Baru
              </h2>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="text-muted-foreground hover:text-foreground dark:text-foreground/50 dark:hover:text-foreground"
                aria-label="Tutup dialog"
              >
                ✕
              </button>
            </div>
            <PeriodForm
              mode="CREATE"
              onClose={() => setCreateOpen(false)}
              onSuccess={(msg) => {
                setCreateOpen(false);
                setNotice(msg);
              }}
              onError={() => {
                // Dialog tetap terbuka saat error — ditangani di dalam PeriodForm
              }}
            />
          </div>
        </div>
      )}
    </section>
  );
}
