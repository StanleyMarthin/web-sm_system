"use client";

/**
 * Step 3 — Cek Kapasitas Divisi
 * Tampilkan kapasitas per divisi yang terlibat.
 * Tombol "Muat Absensi Terbaru" memanggil snapshotWeeklyPlanAbsence() yang sudah ada.
 */

import { useState } from "react";
import { RefreshCcw, ChevronDown, ChevronUp } from "lucide-react";
import { EmptyRow } from "@/shared/ui/compact";
import {
  formatCapacityStatusLabel,
} from "@/modules/planning/helpers/planning-calculations";

export interface DivisionCapacityData {
  divisionId: number;
  divisionName: string;
  activeMembers: number;
  absentMembers: number;
  normalCapacityHours: number;
  absenceHours: number;
  scheduledHours: number;
  availableCapacityHours: number;
  /** Anggota yang cuti/izin (nama + alasan) */
  absentMemberDetails: { name: string; reason: string }[];
}

interface DivisionCapacityStepProps {
  divisions: DivisionCapacityData[];
  periodLabel: string;
  onSnapshotAbsence: () => Promise<void>;
  onNext: () => void;
  onBack: () => void;
  isSnapshoting?: boolean;
  isLoading?: boolean;
  /** Target jam yang sudah diisi (untuk hitung status capacity) */
  targetHoursPerDivision?: Record<number, number>;
}

function capacityBadgeStyle(status: "Aman" | "Hampir Penuh" | "Overload"): string {
  switch (status) {
    case "Aman":
      return "border-success/30 bg-success/[0.05] text-success";
    case "Hampir Penuh":
      return "border-primary/30 bg-primary/[0.05] text-app-accent-ink";
    case "Overload":
      return "border-destructive/30 bg-destructive/[0.05] text-destructive";
  }
}

function DivisionCapacityCard({
  division,
  targetHours,
}: {
  division: DivisionCapacityData;
  targetHours: number;
}) {
  const [showDetail, setShowDetail] = useState(false);
  const status = formatCapacityStatusLabel(targetHours, division.availableCapacityHours);

  return (
    <div className="border border-border bg-card">
      <div className="px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[14px] font-mono text-foreground">
            {division.divisionName}
          </p>
          <span
            className={`border px-2 py-0.5 font-mono text-[15px] uppercase tracking-[0.1em] ${capacityBadgeStyle(status)}`}
          >
            {status}
          </span>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: "Anggota aktif", value: `${division.activeMembers} orang` },
            {
              label: "Ada cuti/izin",
              value:
                division.absentMembers > 0
                  ? `${division.absentMembers} orang`
                  : "Tidak ada",
              warn: division.absentMembers > 0,
            },
            {
              label: "Kapasitas normal",
              value: `${division.normalCapacityHours.toFixed(0)} jam`,
            },
            {
              label: "Kapasitas tersedia",
              value: `${division.availableCapacityHours.toFixed(0)} jam`,
              highlight: true,
            },
          ].map((m) => (
            <div
              key={m.label}
              className={[
                "border px-3 py-2",
                m.highlight
                  ? "border-primary/25 bg-primary/[0.03]"
                  : "border-border bg-background",
              ].join(" ")}
            >
              <p className="font-mono text-[15px] uppercase text-muted-foreground">
                {m.label}
              </p>
              <p
                className={[
                  "mt-0.5 font-mono text-[14px] font-medium",
                  m.warn
                    ? "text-app-accent-ink"
                    : m.highlight
                      ? "text-app-accent-ink"
                      : "text-foreground",
                ].join(" ")}
              >
                {m.value}
              </p>
            </div>
          ))}
        </div>

        {division.absentMembers > 0 && (
          <div className="mt-2.5 border border-primary/20 bg-primary/[0.03] px-3 py-2 text-[15px] text-app-accent-ink">
            Kapasitas berkurang karena ada {division.absentMembers} anggota cuti/izin
          </div>
        )}
      </div>

      {/* Toggle detail perhitungan */}
      <button
        type="button"
        onClick={() => setShowDetail((v) => !v)}
        className="flex w-full items-center justify-between border-t border-border px-4 py-2 text-[15px] text-muted-foreground transition-colors hover:bg-muted"
      >
        <span>{showDetail ? "Sembunyikan perhitungan" : "Lihat Perhitungan"}</span>
        {showDetail ? (
          <ChevronUp className="h-3.5 w-3.5" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5" />
        )}
      </button>

      {showDetail && (
        <div className="border-t border-border px-4 py-3">
          <p className="mb-2 font-mono text-[15px] uppercase tracking-[0.1em] text-muted-foreground">
            Detail perhitungan kapasitas
          </p>
          <div className="space-y-1.5 text-[15px]">
            {[
              {
                label: "Kapasitas normal",
                value: `${division.normalCapacityHours.toFixed(1)} jam`,
              },
              {
                label: "Dikurangi absensi",
                value: `− ${division.absenceHours.toFixed(1)} jam`,
                neg: true,
              },
              {
                label: "Dikurangi jadwal existing",
                value: `− ${division.scheduledHours.toFixed(1)} jam`,
                neg: true,
              },
              {
                label: "Kapasitas tersedia",
                value: `= ${division.availableCapacityHours.toFixed(1)} jam`,
                bold: true,
              },
            ].map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between border-b border-border pb-1"
              >
                <span className="text-muted-foreground">{row.label}</span>
                <span
                  className={[
                    "font-mono",
                    row.neg
                      ? "text-destructive"
                      : row.bold
                        ? "font-semibold text-foreground"
                        : "text-muted-foreground",
                  ].join(" ")}
                >
                  {row.value}
                </span>
              </div>
            ))}
          </div>

          {/* Daftar anggota absen */}
          {division.absentMemberDetails.length > 0 && (
            <div className="mt-3">
              <p className="mb-1.5 font-mono text-[15px] uppercase tracking-[0.1em] text-muted-foreground">
                Anggota cuti / izin
              </p>
              <div className="space-y-1">
                {division.absentMemberDetails.map((m, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-[15px]"
                  >
                    <span className="text-muted-foreground">{m.name}</span>
                    <span className="font-mono text-muted-foreground">
                      {m.reason}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function DivisionCapacityStep({
  divisions,
  periodLabel,
  onSnapshotAbsence,
  onNext,
  onBack,
  isSnapshoting,
  isLoading,
  targetHoursPerDivision = {},
}: DivisionCapacityStepProps) {
  const [snapshotError, setSnapshotError] = useState<string | null>(null);

  async function handleSnapshot() {
    setSnapshotError(null);
    try {
      await onSnapshotAbsence();
    } catch {
      setSnapshotError("Gagal memuat data absensi. Coba lagi.");
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="border border-border bg-card px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono text-[14px] uppercase tracking-[0.12em] text-muted-foreground">
              Langkah 3 · {periodLabel}
            </p>
            <h2 className="mt-1 text-[15px] font-mono text-foreground">
              Cek Tenaga Kerja Minggu Depan
            </h2>
          </div>
          <button
            type="button"
            onClick={() => void handleSnapshot()}
            disabled={isSnapshoting}
            className="inline-flex h-8 items-center gap-2 border border-border px-3 font-mono text-[14px] uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            <RefreshCcw className={`h-3.5 w-3.5 ${isSnapshoting ? "animate-spin" : ""}`} />
            {isSnapshoting ? "Memuat..." : "Muat Absensi Terbaru"}
          </button>
        </div>
        {snapshotError && (
          <p className="mt-2 border border-destructive/25 bg-destructive/[0.04] px-3 py-2 text-[15px] text-destructive">
            {snapshotError}
          </p>
        )}
      </div>

      {/* Capacity cards */}
      {isLoading ? (
        <div className="border border-border bg-card px-4 py-10 text-center text-[14px] text-muted-foreground">
          Memuat data kapasitas divisi...
        </div>
      ) : divisions.length === 0 ? (
        <EmptyRow message="Data kapasitas divisi belum lengkap. Lengkapi data anggota atau jadwal kerja terlebih dahulu." />
      ) : (
        <div className="space-y-3">
          {divisions.map((div) => (
            <DivisionCapacityCard
              key={div.divisionId}
              division={div}
              targetHours={targetHoursPerDivision[div.divisionId] ?? 0}
            />
          ))}
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex h-8 items-center gap-2 border border-border px-4 font-mono text-[14px] uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-foreground"
        >
          ← Kembali
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={divisions.length === 0}
          className="inline-flex h-8 items-center gap-2 border border-primary/30 bg-primary/[0.04] px-4 font-mono text-[14px] font-semibold uppercase tracking-[0.12em] text-app-accent-ink transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Lanjut ke Target →
        </button>
      </div>
    </div>
  );
}
