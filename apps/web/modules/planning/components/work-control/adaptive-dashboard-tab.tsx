"use client";

/* Hallmark · pre-emit critique: P5 H5 E4 S5 R5 V4 */
/* Hallmark · genre: modern-minimal · macrostructure: Workbench · design-system: design.md · designed-as-app */

import type { DeliveryPrediction, PlanningCapacitySnapshot, RecalculationLog, SpkSplDecision, WarrantyImpact } from "@/modules/planning/types/planning.types";

interface AdaptiveDashboardTabProps {
  selectedUnitCount: number;
  readyHours: number;
  blockedHours: number;
  predictions: Array<{
    unitId: string;
    unitName: string;
    prediction: DeliveryPrediction;
    decision: SpkSplDecision;
  }>;
  capacitySnapshots: PlanningCapacitySnapshot[];
  warrantyImpacts: WarrantyImpact[];
  recalculationLogs: RecalculationLog[];
  warrantyInputs: Record<string, number>;
  onWarrantyChange: (divisionId: string, hours: number) => void;
  onStartPlanning: () => void;
}

export function buildPlanningNarrative(input: {
  selectedUnitCount: number;
  readyHours: number;
  blockedHours: number;
  needOvertimeCount: number;
  highRiskCount: number;
}) {
  if (input.selectedUnitCount === 0) {
    return {
      title: "Belum ada rencana minggu ini",
      explanation: "Pilih unit untuk mulai.",
      action: "Pilih unit kerja",
      tone: "muted" as const,
    };
  }
  if (input.blockedHours > 0) {
    return {
      title: "Sebagian pekerjaan belum bisa dimulai",
      explanation: `${input.blockedHours.toFixed(0)} jam masih tertahan.`,
      action: "Cek hambatan",
      tone: "warning" as const,
    };
  }
  if (input.needOvertimeCount > 0) {
    return {
      title: "Rencana membutuhkan tambahan waktu kerja",
      explanation: `${input.needOvertimeCount} unit perlu lembur.`,
      action: "Cek lembur",
      tone: "warning" as const,
    };
  }
  if (input.highRiskCount > 0) {
    return {
      title: "Rencana bisa berjalan, tetapi ada unit berisiko",
      explanation: `${input.highRiskCount} unit perlu dipantau.`,
      action: "Cek unit",
      tone: "warning" as const,
    };
  }
  return {
      title: "Rencana minggu ini siap dijalankan",
      explanation: "Kapasitas cukup.",
      action: "Lihat rencana",
    tone: "success" as const,
  };
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function decisionCopy(status: string) {
  if (status === "AMAN" || status === "SPK_READY") return { label: "Siap dikerjakan", detail: "Kapasitas cukup untuk target saat ini.", tone: "text-success border-success/30 bg-success/[0.06]" };
  if (status === "BUTUH_LEMBUR" || status === "SPK_WITH_SPL") return { label: "Perlu tambahan jam", detail: "Target melebihi kapasitas kerja normal.", tone: "text-app-accent-ink border-primary/30 bg-primary/[0.06]" };
  if (status === "MINTA_REVIEW_KD") return { label: "Perlu diperiksa", detail: "Data pekerjaan belum cukup untuk mengambil keputusan.", tone: "text-app-accent-ink border-primary/30 bg-primary/[0.06]" };
  return { label: "Target perlu diperbaiki", detail: "Sesuaikan target atau kapasitas sebelum dirilis.", tone: "text-destructive border-destructive/30 bg-destructive/[0.06]" };
}

export function AdaptiveDashboardTab({
  selectedUnitCount,
  readyHours,
  blockedHours,
  predictions,
  capacitySnapshots,
  warrantyImpacts,
  recalculationLogs,
  warrantyInputs,
  onWarrantyChange,
  onStartPlanning,
}: AdaptiveDashboardTabProps) {
  const highRiskCount = predictions.filter((item) => item.prediction.riskLevel === "HIGH" || item.prediction.riskLevel === "CRITICAL").length;
  const needOvertimeCount = predictions.filter((item) => item.decision.status === "BUTUH_LEMBUR").length;
  const narrative = buildPlanningNarrative({ selectedUnitCount, readyHours, blockedHours, needOvertimeCount, highRiskCount });
  const totalHours = readyHours + blockedHours;
  const readyPercent = totalHours > 0 ? Math.round((readyHours / totalHours) * 100) : 0;

  return (
    <div className="space-y-4">
      <section className={[
        "border px-5 py-5",
        narrative.tone === "success" ? "border-success/30 bg-success/[0.05]" : narrative.tone === "warning" ? "border-primary/30 bg-primary/[0.05]" : "border-border bg-card",
      ].join(" ")}>
        <h3 className="text-[20px] font-semibold text-foreground">{narrative.title}</h3>
        <p className="mt-1 text-[15px] text-muted-foreground">{narrative.explanation}</p>
        <button
          type="button"
          onClick={onStartPlanning}
          className="mt-4 h-10 whitespace-nowrap border border-primary/30 bg-primary/[0.08] px-4 font-mono text-[14px] uppercase tracking-[0.12em] text-app-accent-ink"
        >
          {narrative.action}
        </button>
      </section>

      {selectedUnitCount > 0 && (
        <>
          <section className="border border-border bg-card px-5 py-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div><p className="font-mono text-[24px] text-foreground">{selectedUnitCount}</p><p className="text-[14px] text-muted-foreground">Unit</p></div>
              <div><p className="font-mono text-[24px] text-success">{readyHours.toFixed(0)}j</p><p className="text-[14px] text-muted-foreground">Siap</p></div>
              <div><p className={`font-mono text-[24px] ${blockedHours > 0 ? "text-app-accent-ink" : "text-muted-foreground"}`}>{blockedHours.toFixed(0)}j</p><p className="text-[14px] text-muted-foreground">Tertahan</p></div>
            </div>
            <div className="mt-4 h-2 overflow-hidden bg-muted" aria-label={`${readyPercent}% pekerjaan siap`}>
              <div className="h-full bg-success" style={{ width: `${readyPercent}%` }} />
            </div>
          </section>

          <section className="border border-border bg-card">
            <div className="border-b border-border px-5 py-4">
              <h3 className="font-mono text-[15px] text-foreground">Status unit</h3>
            </div>
            <div className="divide-y divide-border">
              {predictions.map((item) => {
                const status = decisionCopy(item.decision.status);
                return (
                  <article key={item.unitId} className="grid gap-3 px-5 py-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-mono text-[15px] text-foreground">{item.unitName}</h4>
                        <span className={`border px-2 py-1 font-mono text-[14px] ${status.tone}`}>{status.label}</span>
                      </div>
                      <p className="mt-1 text-[14px] text-muted-foreground">{status.detail}</p>
                    </div>
                    <div className="md:text-right">
                      <p className="text-[14px] text-muted-foreground">Estimasi selesai</p>
                      <p className="mt-1 font-mono text-[15px] text-foreground">{formatDate(item.prediction.p80)}</p>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="flex flex-wrap items-center gap-2 border border-border bg-card px-5 py-4">
            <span className="font-mono text-[14px] text-muted-foreground">Berikutnya:</span>
            {blockedHours > 0 && <span className="border border-primary/30 px-3 py-1.5 text-[14px] text-app-accent-ink">Cek hambatan</span>}
            {needOvertimeCount > 0 && <span className="border border-primary/30 px-3 py-1.5 text-[14px] text-app-accent-ink">Cek lembur</span>}
            <span className="border border-success/30 px-3 py-1.5 text-[14px] text-success">Review lalu rilis</span>
          </section>

          <details className="border border-border bg-card px-5 py-4">
            <summary className="cursor-pointer font-mono text-[14px] uppercase tracking-[0.12em] text-muted-foreground">Dasar perhitungan</summary>
            <div className="mt-4 space-y-4">
              <p className="text-[14px] leading-5 text-muted-foreground">Bagian ini untuk pengguna yang perlu memeriksa kapasitas, cadangan garansi, dan riwayat hitung ulang.</p>
              {capacitySnapshots.map((snapshot) => (
                <div key={snapshot.divisionId} className="border border-border bg-background px-4 py-3">
                  <p className="font-mono text-[14px] text-foreground">{snapshot.divisionName}</p>
                  <p className="mt-1 text-[14px] text-muted-foreground">Kapasitas tersedia {snapshot.availableHours.toFixed(0)} jam · siap {snapshot.readyHours.toFixed(0)} jam · tertahan {snapshot.blockedHours.toFixed(0)} jam</p>
                  <label className="mt-3 block text-[14px] text-muted-foreground">
                    Cadangan untuk pekerjaan garansi (jam)
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={String(warrantyInputs[snapshot.divisionId] ?? 0)}
                      onChange={(event) => onWarrantyChange(snapshot.divisionId, Number(event.target.value))}
                      className="mt-2 h-10 w-full max-w-48 border border-border bg-card px-3 font-mono text-[14px] text-foreground outline-none focus:border-primary/40"
                    />
                  </label>
                </div>
              ))}
              <p className="text-[14px] text-muted-foreground">Dampak garansi tercatat: {warrantyImpacts.length} · Perubahan perhitungan: {recalculationLogs.length}</p>
            </div>
          </details>
        </>
      )}
    </div>
  );
}
