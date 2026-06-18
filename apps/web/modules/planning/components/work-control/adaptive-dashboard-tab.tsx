"use client";

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

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function toneClass(status: string): string {
  if (status === "AMAN" || status === "SPK_READY") return "text-success border-success/25 bg-success/[0.06]";
  if (status === "BUTUH_LEMBUR" || status === "SPK_WITH_SPL") return "text-app-accent-ink border-primary/25 bg-primary/[0.06]";
  if (status === "DIVISI_OVERLOAD" || status === "TARGET_PERLU_DIREVISI") return "text-destructive border-destructive/25 bg-destructive/[0.06]";
  return "text-foreground border-border bg-background";
}

function SummaryStat({
  label,
  value,
  tone = "text-foreground",
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="border border-border bg-card px-4 py-3">
      <p className="font-mono text-[14px] uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className={`mt-1 font-mono text-[20px] ${tone}`}>{value}</p>
    </div>
  );
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

  return (
    <div className="space-y-4">
      <section className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        <SummaryStat
          label="Unit Aktif"
          value={selectedUnitCount > 0 ? String(selectedUnitCount) : "0"}
          tone={selectedUnitCount > 0 ? "text-foreground" : "text-muted-foreground"}
        />
        <SummaryStat
          label="Jam Siap Jalan"
          value={`${readyHours.toFixed(0)} jam`}
          tone="text-success"
        />
        <SummaryStat
          label="Jam Tertahan"
          value={`${blockedHours.toFixed(0)} jam`}
          tone={blockedHours > 0 ? "text-app-accent-ink" : "text-muted-foreground"}
        />
        <SummaryStat
          label="Butuh Aksi"
          value={needOvertimeCount > 0 ? `${needOvertimeCount} unit` : "Aman"}
          tone={needOvertimeCount > 0 || highRiskCount > 0 ? "text-app-accent-ink" : "text-success"}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
        <div className="border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <p className="font-mono text-[14px] uppercase tracking-[0.12em] text-muted-foreground">Prediksi Delivery</p>
            <h3 className="mt-1 text-[14px] font-mono text-foreground">Status Delivery</h3>
          </div>
          <div className="divide-y divide-border">
            {predictions.length > 0 ? predictions.map((item) => (
              <div key={item.unitId} className="grid gap-3 px-4 py-3 lg:grid-cols-[minmax(0,1fr)_auto]">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-[15px] font-mono text-foreground">{item.unitName}</h4>
                    <span className={`border px-2 py-1 font-mono text-[14px] uppercase tracking-[0.12em] ${toneClass(item.decision.status)}`}>
                      {item.decision.status === "AMAN" ? "Aman" : item.decision.status === "BUTUH_LEMBUR" ? "Butuh Lembur" : item.decision.status === "MINTA_REVIEW_KD" ? "Minta Review KD" : "Perlu Cek"}
                    </span>
                  </div>
                  <p className="mt-2 text-[14px] leading-5 text-muted-foreground">{item.decision.reason ?? "Belum ada catatan."}</p>
                </div>
                <div className="grid min-w-[250px] grid-cols-3 gap-2">
                  <div className="border border-border bg-background px-3 py-2">
                    <p className="font-mono text-[15px] uppercase tracking-[0.12em] text-muted-foreground">P50</p>
                    <p className="mt-1 font-mono text-[14px] text-foreground">{formatDate(item.prediction.p50)}</p>
                  </div>
                  <div className="border border-border bg-background px-3 py-2">
                    <p className="font-mono text-[15px] uppercase tracking-[0.12em] text-muted-foreground">P80</p>
                    <p className="mt-1 font-mono text-[14px] text-foreground">{formatDate(item.prediction.p80)}</p>
                  </div>
                  <div className="border border-border bg-background px-3 py-2">
                    <p className="font-mono text-[15px] uppercase tracking-[0.12em] text-muted-foreground">P95</p>
                    <p className="mt-1 font-mono text-[14px] text-foreground">{formatDate(item.prediction.p95)}</p>
                  </div>
                </div>
              </div>
            )) : (
              <div className="px-4 py-10 text-center">
                <p className="text-[14px] text-muted-foreground">Belum ada unit yang dipilih untuk minggu ini.</p>
                <button
                  type="button"
                  onClick={onStartPlanning}
                  className="mt-4 h-10 border border-primary/30 bg-primary/[0.08] px-4 font-mono text-[14px] uppercase tracking-[0.12em] text-app-accent-ink"
                >
                  Pilih Unit Kerja
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <section className="border border-border bg-card">
            <div className="border-b border-border px-4 py-3">
              <p className="font-mono text-[14px] uppercase tracking-[0.12em] text-muted-foreground">Impact Garansi</p>
              <h3 className="mt-1 text-[14px] font-mono text-foreground">Kapasitas Divisi</h3>
            </div>
            <div className="space-y-3 px-4 py-3">
              {capacitySnapshots.length > 0 ? capacitySnapshots.map((snapshot) => (
                <div key={snapshot.divisionId} className="border border-border bg-background px-3 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-mono text-[14px] text-foreground">{snapshot.divisionName}</p>
                    </div>
                    <span className={`border px-2 py-1 font-mono text-[14px] uppercase tracking-[0.12em] ${toneClass(snapshot.status)}`}>
                      {snapshot.status.replaceAll("_", " ")}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-[1fr_auto] gap-3">
                    <label className="text-[15px] text-muted-foreground">
                      Cadangan Garansi (jam)
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={String(warrantyInputs[snapshot.divisionId] ?? 0)}
                        onChange={(event) => onWarrantyChange(snapshot.divisionId, Number(event.target.value))}
                        className="mt-2 h-10 w-full border border-border bg-card px-3 font-mono text-[14px] text-foreground outline-none focus:border-primary/40"
                      />
                    </label>
                    <div className="border border-border px-3 py-2">
                      <p className="font-mono text-[15px] uppercase tracking-[0.12em] text-muted-foreground">Ready / Blocked</p>
                      <p className="mt-1 font-mono text-[14px] text-foreground">{snapshot.readyHours.toFixed(1)} / {snapshot.blockedHours.toFixed(1)}</p>
                    </div>
                  </div>
                </div>
              )) : (
                <div className="px-1 py-4 text-[14px] text-muted-foreground">Kapasitas divisi akan muncul setelah progress unit dibaca.</div>
              )}
            </div>
          </section>

          <section className="border border-border bg-card">
            <div className="border-b border-border px-4 py-3">
              <p className="font-mono text-[14px] uppercase tracking-[0.12em] text-muted-foreground">Recalculation Log</p>
              <h3 className="mt-1 text-[14px] font-mono text-foreground">Log Perubahan</h3>
            </div>
            <div className="space-y-2 px-4 py-3">
              {recalculationLogs.length > 0 ? recalculationLogs.slice(0, 8).map((log, index) => (
                <div key={`${log.unitId}:${log.triggerType}:${log.createdAt ?? index}`} className="border border-border bg-background px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-mono text-[15px] uppercase tracking-[0.12em] text-muted-foreground">{log.triggerType}</p>
                    <p className="font-mono text-[14px] text-muted-foreground">{log.createdAt?.slice(0, 16).replace("T", " ") ?? "-"}</p>
                  </div>
                  <p className="mt-2 text-[14px] text-foreground">{log.reason}</p>
                  <p className="mt-2 font-mono text-[15px] text-muted-foreground">
                    P80 {log.deltaP80Days >= 0 ? "+" : ""}{log.deltaP80Days} hari · P95 {log.deltaP95Days >= 0 ? "+" : ""}{log.deltaP95Days} hari
                  </p>
                </div>
              )) : (
                <div className="px-1 py-4 text-[14px] text-muted-foreground">Belum ada perubahan yang memicu hitung ulang.</div>
              )}
            </div>
          </section>
        </div>
      </section>

      {warrantyImpacts.length > 0 && (
        <section className="border border-border bg-card px-4 py-3">
          <p className="font-mono text-[14px] uppercase tracking-[0.12em] text-muted-foreground">Dampak Garansi</p>
          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            {warrantyImpacts.map((impact) => (
              <div key={impact.divisionId} className="border border-border bg-background px-3 py-2">
                <p className="font-mono text-[14px] uppercase tracking-[0.12em] text-muted-foreground">Divisi {impact.divisionId}</p>
                <p className="mt-1 font-mono text-[14px] text-foreground">{impact.capacityBefore.toFixed(1)} → {impact.capacityAfter.toFixed(1)} jam</p>
                <p className="mt-1 text-[15px] text-app-accent-ink">{impact.deltaHours.toFixed(1)} jam tersisih</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
