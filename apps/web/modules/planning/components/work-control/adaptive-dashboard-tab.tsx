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
  if (status === "AMAN" || status === "SPK_READY") return "text-emerald-300 border-emerald-500/25 bg-emerald-500/[0.06]";
  if (status === "BUTUH_LEMBUR" || status === "SPK_WITH_SPL") return "text-amber-300 border-amber-500/25 bg-amber-500/[0.06]";
  if (status === "DIVISI_OVERLOAD" || status === "TARGET_PERLU_DIREVISI") return "text-red-300 border-red-500/25 bg-red-500/[0.06]";
  return "text-white/70 border-white/10 bg-[#0a0a0c]";
}

function SummaryStat({
  label,
  value,
  tone = "text-white",
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="border border-white/5 bg-[#111114] px-4 py-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/30">{label}</p>
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
          tone={selectedUnitCount > 0 ? "text-white" : "text-white/35"}
        />
        <SummaryStat
          label="Jam Siap Jalan"
          value={`${readyHours.toFixed(0)} jam`}
          tone="text-emerald-300"
        />
        <SummaryStat
          label="Jam Tertahan"
          value={`${blockedHours.toFixed(0)} jam`}
          tone={blockedHours > 0 ? "text-amber-300" : "text-white/35"}
        />
        <SummaryStat
          label="Butuh Aksi"
          value={needOvertimeCount > 0 ? `${needOvertimeCount} unit` : "Aman"}
          tone={needOvertimeCount > 0 || highRiskCount > 0 ? "text-amber-300" : "text-emerald-300"}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
        <div className="border border-white/5 bg-[#111114]">
          <div className="border-b border-white/5 px-4 py-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/30">Prediksi Delivery</p>
            <h3 className="mt-1 text-[14px] font-mono text-white">Status Delivery</h3>
          </div>
          <div className="divide-y divide-white/5">
            {predictions.length > 0 ? predictions.map((item) => (
              <div key={item.unitId} className="grid gap-3 px-4 py-3 lg:grid-cols-[minmax(0,1fr)_auto]">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-[13px] font-mono text-white">{item.unitName}</h4>
                    <span className={`border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] ${toneClass(item.decision.status)}`}>
                      {item.decision.status === "AMAN" ? "Aman" : item.decision.status === "BUTUH_LEMBUR" ? "Butuh Lembur" : item.decision.status === "MINTA_REVIEW_KD" ? "Minta Review KD" : "Perlu Cek"}
                    </span>
                  </div>
                  <p className="mt-2 text-[12px] leading-5 text-white/50">{item.decision.reason ?? "Belum ada catatan."}</p>
                </div>
                <div className="grid min-w-[250px] grid-cols-3 gap-2">
                  <div className="border border-white/5 bg-[#0a0a0c] px-3 py-2">
                    <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-white/25">P50</p>
                    <p className="mt-1 font-mono text-[12px] text-white/80">{formatDate(item.prediction.p50)}</p>
                  </div>
                  <div className="border border-white/5 bg-[#0a0a0c] px-3 py-2">
                    <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-white/25">P80</p>
                    <p className="mt-1 font-mono text-[12px] text-white/80">{formatDate(item.prediction.p80)}</p>
                  </div>
                  <div className="border border-white/5 bg-[#0a0a0c] px-3 py-2">
                    <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-white/25">P95</p>
                    <p className="mt-1 font-mono text-[12px] text-white/80">{formatDate(item.prediction.p95)}</p>
                  </div>
                </div>
              </div>
            )) : (
              <div className="px-4 py-10 text-center">
                <p className="text-[12px] text-white/45">Belum ada unit yang dipilih untuk minggu ini.</p>
                <button
                  type="button"
                  onClick={onStartPlanning}
                  className="mt-4 h-10 border border-amber-500/30 bg-amber-500/[0.08] px-4 font-mono text-[10px] uppercase tracking-[0.12em] text-amber-300"
                >
                  Pilih Unit Kerja
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <section className="border border-white/5 bg-[#111114]">
            <div className="border-b border-white/5 px-4 py-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/30">Impact Garansi</p>
              <h3 className="mt-1 text-[14px] font-mono text-white">Kapasitas Divisi</h3>
            </div>
            <div className="space-y-3 px-4 py-3">
              {capacitySnapshots.length > 0 ? capacitySnapshots.map((snapshot) => (
                <div key={snapshot.divisionId} className="border border-white/5 bg-[#0a0a0c] px-3 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-mono text-[12px] text-white/80">{snapshot.divisionName}</p>
                    </div>
                    <span className={`border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] ${toneClass(snapshot.status)}`}>
                      {snapshot.status.replaceAll("_", " ")}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-[1fr_auto] gap-3">
                    <label className="text-[11px] text-white/45">
                      Cadangan Garansi (jam)
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={String(warrantyInputs[snapshot.divisionId] ?? 0)}
                        onChange={(event) => onWarrantyChange(snapshot.divisionId, Number(event.target.value))}
                        className="mt-2 h-10 w-full border border-white/10 bg-[#111114] px-3 font-mono text-[12px] text-white outline-none focus:border-amber-500/40"
                      />
                    </label>
                    <div className="border border-white/5 px-3 py-2">
                      <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-white/25">Ready / Blocked</p>
                      <p className="mt-1 font-mono text-[12px] text-white/80">{snapshot.readyHours.toFixed(1)} / {snapshot.blockedHours.toFixed(1)}</p>
                    </div>
                  </div>
                </div>
              )) : (
                <div className="px-1 py-4 text-[12px] text-white/35">Kapasitas divisi akan muncul setelah progress unit dibaca.</div>
              )}
            </div>
          </section>

          <section className="border border-white/5 bg-[#111114]">
            <div className="border-b border-white/5 px-4 py-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/30">Recalculation Log</p>
              <h3 className="mt-1 text-[14px] font-mono text-white">Log Perubahan</h3>
            </div>
            <div className="space-y-2 px-4 py-3">
              {recalculationLogs.length > 0 ? recalculationLogs.slice(0, 8).map((log, index) => (
                <div key={`${log.unitId}:${log.triggerType}:${log.createdAt ?? index}`} className="border border-white/5 bg-[#0a0a0c] px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-white/55">{log.triggerType}</p>
                    <p className="font-mono text-[10px] text-white/35">{log.createdAt?.slice(0, 16).replace("T", " ") ?? "-"}</p>
                  </div>
                  <p className="mt-2 text-[12px] text-white/65">{log.reason}</p>
                  <p className="mt-2 font-mono text-[11px] text-white/45">
                    P80 {log.deltaP80Days >= 0 ? "+" : ""}{log.deltaP80Days} hari · P95 {log.deltaP95Days >= 0 ? "+" : ""}{log.deltaP95Days} hari
                  </p>
                </div>
              )) : (
                <div className="px-1 py-4 text-[12px] text-white/35">Belum ada perubahan yang memicu hitung ulang.</div>
              )}
            </div>
          </section>
        </div>
      </section>

      {warrantyImpacts.length > 0 && (
        <section className="border border-white/5 bg-[#111114] px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/30">Dampak Garansi</p>
          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            {warrantyImpacts.map((impact) => (
              <div key={impact.divisionId} className="border border-white/5 bg-[#0a0a0c] px-3 py-2">
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/30">Divisi {impact.divisionId}</p>
                <p className="mt-1 font-mono text-[12px] text-white/75">{impact.capacityBefore.toFixed(1)} → {impact.capacityAfter.toFixed(1)} jam</p>
                <p className="mt-1 text-[11px] text-amber-300">{impact.deltaHours.toFixed(1)} jam tersisih</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
