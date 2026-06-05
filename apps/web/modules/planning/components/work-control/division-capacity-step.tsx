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
  totalMembers: number;
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
      return "border-emerald-500/30 bg-emerald-500/[0.05] text-emerald-600 dark:text-emerald-300";
    case "Hampir Penuh":
      return "border-amber-500/30 bg-amber-500/[0.05] text-amber-600 dark:text-amber-300";
    case "Overload":
      return "border-red-500/30 bg-red-500/[0.05] text-red-600 dark:text-red-300";
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
    <div className="border border-white/5 bg-[#111114]">
      <div className="px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[12px] font-mono text-white/80">
            {division.divisionName}
          </p>
          <span
            className={`border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] ${capacityBadgeStyle(status)}`}
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
                  ? "border-amber-500/25 bg-amber-500/[0.03]"
                  : "border-white/5 bg-[#0a0a0c]",
              ].join(" ")}
            >
              <p className="font-mono text-[9px] uppercase text-white/25">
                {m.label}
              </p>
              <p
                className={[
                  "mt-0.5 font-mono text-[12px] font-medium",
                  m.warn
                    ? "text-amber-600 dark:text-amber-300"
                    : m.highlight
                      ? "text-amber-700 dark:text-amber-400"
                      : "text-white/60",
                ].join(" ")}
              >
                {m.value}
              </p>
            </div>
          ))}
        </div>

        {division.absentMembers > 0 && (
          <div className="mt-2.5 border border-amber-500/20 bg-amber-500/[0.03] px-3 py-2 text-[11px] text-amber-400">
            Kapasitas berkurang karena ada {division.absentMembers} anggota cuti/izin
          </div>
        )}
      </div>

      {/* Toggle detail perhitungan */}
      <button
        type="button"
        onClick={() => setShowDetail((v) => !v)}
        className="flex w-full items-center justify-between border-t border-white/5 px-4 py-2 text-[11px] text-gray-500 transition-colors hover:bg-white/[0.02]"
      >
        <span>{showDetail ? "Sembunyikan perhitungan" : "Lihat Perhitungan"}</span>
        {showDetail ? (
          <ChevronUp className="h-3.5 w-3.5" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5" />
        )}
      </button>

      {showDetail && (
        <div className="border-t border-white/5 px-4 py-3">
          <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.1em] text-white/25">
            Detail perhitungan kapasitas
          </p>
          <div className="space-y-1.5 text-[11px]">
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
                className="flex items-center justify-between border-b border-white/[0.03] pb-1"
              >
                <span className="text-white/35">{row.label}</span>
                <span
                  className={[
                    "font-mono",
                    row.neg
                      ? "text-red-400"
                      : row.bold
                        ? "font-semibold text-white/80"
                        : "text-white/50",
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
              <p className="mb-1.5 font-mono text-[9px] uppercase tracking-[0.1em] text-white/25">
                Anggota cuti / izin
              </p>
              <div className="space-y-1">
                {division.absentMemberDetails.map((m, i) => (
                  <div
                    // eslint-disable-next-line react/no-array-index-key
                    key={i}
                    className="flex items-center justify-between text-[11px]"
                  >
                    <span className="text-white/55">{m.name}</span>
                    <span className="font-mono text-white/30">
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
      <div className="border border-gray-200 bg-white px-4 py-4 dark:border-white/[0.06] dark:bg-[#111114]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-gray-400 dark:text-white/30">
              Langkah 3 · {periodLabel}
            </p>
            <h2 className="mt-1 text-[15px] font-semibold tracking-[-0.02em] text-gray-950 dark:text-white">
              Cek Tenaga Kerja Minggu Depan
            </h2>
            <p className="mt-2 text-[12px] leading-5 text-gray-500 dark:text-white/40">
              Baca kapasitas real per divisi sebelum menetapkan target. Kalau tenaga tidak cukup,
              keputusan lembur atau revisi target harus terlihat dari sini.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleSnapshot()}
            disabled={isSnapshoting}
            className="inline-flex h-10 items-center gap-2 border border-gray-200 px-3 font-mono text-[10px] uppercase tracking-[0.12em] text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/[0.08] dark:text-white/50 dark:hover:bg-white/[0.04]"
          >
            <RefreshCcw className={`h-3.5 w-3.5 ${isSnapshoting ? "animate-spin" : ""}`} />
            {isSnapshoting ? "Memuat..." : "Muat Absensi Terbaru"}
          </button>
        </div>
        {snapshotError && (
          <p className="mt-2 border border-red-500/25 bg-red-500/[0.04] px-3 py-2 text-[11px] text-red-600 dark:text-red-300">
            {snapshotError}
          </p>
        )}
      </div>

      {/* Capacity cards */}
      {isLoading ? (
        <div className="border border-gray-200 bg-white px-4 py-10 text-center text-[12px] text-gray-400 dark:border-white/[0.06] dark:bg-[#111114] dark:text-white/25">
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
          className="inline-flex h-10 items-center gap-2 border border-gray-200 px-4 font-mono text-[10px] uppercase tracking-[0.12em] text-gray-600 transition-colors hover:bg-gray-50 dark:border-white/[0.08] dark:text-white/50 dark:hover:bg-white/[0.04]"
        >
          ← Kembali
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={divisions.length === 0}
          className="inline-flex h-10 items-center gap-2 border border-amber-500/40 bg-amber-500/[0.08] px-4 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-700 transition-colors hover:bg-amber-500/[0.14] disabled:cursor-not-allowed disabled:opacity-40 dark:text-amber-300"
        >
          Lanjut ke Target →
        </button>
      </div>
    </div>
  );
}
