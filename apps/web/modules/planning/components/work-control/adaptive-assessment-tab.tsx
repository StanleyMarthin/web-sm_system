"use client";

import type { AssessmentCase, AssessmentItemKey } from "@/modules/planning/types/planning.types";

interface AdaptiveAssessmentTabProps {
  assessments: AssessmentCase[];
  selectedUnitId: string | null;
  onSelectUnit: (unitId: string) => void;
  onToggleItem: (unitId: string, key: AssessmentItemKey, value: boolean) => void;
  onMarkKdReview: (unitId: string) => void;
  onLockTarget: (unitId: string) => void;
}

function statusTone(status: AssessmentCase["status"]): string {
  switch (status) {
    case "LOCKED":
      return "border-emerald-500/25 bg-emerald-500/[0.06] text-emerald-300";
    case "CALCULATED":
    case "READY_TO_CALCULATE":
      return "border-amber-500/25 bg-amber-500/[0.06] text-amber-300";
    case "NEED_REVIEW_KD":
      return "border-red-500/25 bg-red-500/[0.06] text-red-300";
    default:
      return "border-white/10 bg-[#0a0a0c] text-white/70";
  }
}

const STEP_LABELS: Array<{ key: AssessmentItemKey; title: string; helper: string }> = [
  { key: "identity", title: "1. Data dasar unit", helper: "Identitas unit dan customer sudah lengkap." },
  { key: "bom", title: "2. BOM awal", helper: "BOM pokok unit sudah ada." },
  { key: "panelWorkflow", title: "3. Alur panel", helper: "Jalur kerja panel utama sudah jelas." },
  { key: "materials", title: "4. Material utama", helper: "Material utama sudah tersedia atau on order." },
  { key: "vendorWork", title: "5. Pekerjaan vendor", helper: "Pekerjaan vendor sudah dicatat." },
  { key: "labourEstimate", title: "6. Estimasi jam", helper: "Estimasi jam kerja sudah ada." },
  { key: "riskReview", title: "7. Review risiko", helper: "PM/KP sudah review titik risiko." },
  { key: "kdReview", title: "8. Review KD", helper: "Kepala Divisi sudah review." },
];

export function AdaptiveAssessmentTab({
  assessments,
  selectedUnitId,
  onSelectUnit,
  onToggleItem,
  onMarkKdReview,
  onLockTarget,
}: AdaptiveAssessmentTabProps) {
  const selectedAssessment = assessments.find((item) => item.unitId === selectedUnitId) ?? assessments[0] ?? null;

  return (
    <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="border border-white/5 bg-[#111114]">
        <div className="border-b border-white/5 px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/30">Assessment Unit Baru</p>
          <h3 className="mt-1 text-[14px] font-mono text-white">Checklist Unit</h3>
        </div>
        <div className="divide-y divide-white/5">
          {assessments.length > 0 ? assessments.map((assessment) => (
            <button
              key={assessment.unitId}
              type="button"
              onClick={() => onSelectUnit(assessment.unitId)}
              className={`w-full px-4 py-3 text-left transition-colors ${selectedAssessment?.unitId === assessment.unitId ? "bg-white/[0.04]" : "hover:bg-white/[0.02]"}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-mono text-[12px] text-white">{assessment.unitName}</p>
                <span className={`border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] ${statusTone(assessment.status)}`}>
                  {assessment.gateLabel}
                </span>
              </div>
              <p className="mt-2 text-[11px] text-white/45">{assessment.progressPercent}% checklist selesai</p>
            </button>
          )) : (
            <div className="px-4 py-8 text-[12px] text-white/35">Pilih unit di Planner dulu agar assessment bisa dibaca.</div>
          )}
        </div>
      </aside>

      <section className="border border-white/5 bg-[#111114]">
        {selectedAssessment ? (
          <>
            <div className="border-b border-white/5 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/30">Assessment</p>
                  <h3 className="mt-1 text-[14px] font-mono text-white">{selectedAssessment.unitName}</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className={`border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] ${statusTone(selectedAssessment.status)}`}>
                    {selectedAssessment.gateLabel}
                  </span>
                  {selectedAssessment.canCalculate && (
                    <button
                      type="button"
                      onClick={() => onMarkKdReview(selectedAssessment.unitId)}
                      className="border border-amber-500/30 bg-amber-500/[0.08] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-amber-300 transition-colors hover:bg-amber-500/[0.14]"
                    >
                      Tandai Review KD
                    </button>
                  )}
                  {selectedAssessment.canLockTarget && (
                    <button
                      type="button"
                      onClick={() => onLockTarget(selectedAssessment.unitId)}
                      className="border border-emerald-500/30 bg-emerald-500/[0.08] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-emerald-300 transition-colors hover:bg-emerald-500/[0.14]"
                    >
                      Kunci Target
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="grid gap-3 px-4 py-4 md:grid-cols-2">
              {STEP_LABELS.map((step) => {
                const item = selectedAssessment.items.find((entry) => entry.key === step.key);
                if (!item) {
                  return null;
                }
                return (
                  <div key={item.key} className="border border-white/5 bg-[#0a0a0c] px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-white/60">{step.title}</p>
                        <p className="mt-1 text-[11px] text-white/35">{step.helper}</p>
                        <p className={`mt-3 text-[11px] ${item.isComplete ? "text-emerald-300" : "text-amber-300"}`}>
                          {item.isComplete ? "✓ OK" : item.blockerLabel ?? "Belum"}
                        </p>
                      </div>
                      <label className="flex shrink-0 items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-white/55">
                        <input
                          type="checkbox"
                          checked={item.isComplete}
                          onChange={(event) => onToggleItem(selectedAssessment.unitId, item.key, event.target.checked)}
                          className="h-4 w-4 rounded border-white/15 bg-[#111114] accent-amber-500"
                        />
                        {item.isComplete ? "OK" : "Cek"}
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-white/5 px-4 py-3">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="border border-white/5 bg-[#0a0a0c] px-3 py-2">
                  <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-white/25">Checklist Wajib</p>
                  <p className="mt-1 font-mono text-[16px] text-white/80">
                    {selectedAssessment.items.filter((item) => item.isRequired && item.isComplete).length} / {selectedAssessment.items.filter((item) => item.isRequired).length}
                  </p>
                </div>
                <div className="border border-white/5 bg-[#0a0a0c] px-3 py-2">
                  <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-white/25">Status Sekarang</p>
                  <p className="mt-1 font-mono text-[16px] text-white/80">{selectedAssessment.gateLabel}</p>
                </div>
                <div className="border border-white/5 bg-[#0a0a0c] px-3 py-2">
                  <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-white/25">Target Resmi</p>
                  <p className="mt-1 font-mono text-[12px] text-white/80">
                    {selectedAssessment.canLockTarget ? "Siap dikunci" : "Tunggu assessment"}
                  </p>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="px-4 py-10 text-center text-[12px] text-white/35">
            Belum ada unit yang bisa dibaca untuk assessment.
          </div>
        )}
      </section>
    </div>
  );
}
