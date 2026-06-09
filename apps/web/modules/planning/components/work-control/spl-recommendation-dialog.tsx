"use client";

/* Hallmark · pre-emit critique: P4 H4 E4 S4 R4 V4 */
/* Hallmark · genre: modern-minimal · macrostructure: Workbench · design-system: design.md · designed-as-app */

import { useState } from "react";

interface OverloadDivision {
  divisionId: number;
  divisionName: string;
  shortageHours: number;
}

interface SplRecommendationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  planningTargetId: string;
  overloadDivisions: OverloadDivision[];
  onSubmit: (recommendations: { planningTargetId: string; divisionId: string; shortageHours: number; reason: string }[]) => Promise<{ success: boolean; message: string }>;
}

export function SplRecommendationDialog({
  isOpen,
  onClose,
  planningTargetId,
  overloadDivisions,
  onSubmit,
}: SplRecommendationDialogProps) {
  const [reasons, setReasons] = useState<Record<number, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || overloadDivisions.length === 0) return null;

  async function handleSubmit() {
    // Validasi semua alasan harus diisi
    const missingReasons = overloadDivisions.some((div) => !(reasons[div.divisionId]?.trim()));
    if (missingReasons) {
      setError("Mohon isi alasan rekomendasi lembur untuk semua divisi.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const payload = overloadDivisions.map((div) => ({
      planningTargetId,
      divisionId: String(div.divisionId),
      shortageHours: div.shortageHours,
      reason: reasons[div.divisionId] ?? "",
    }));

    try {
      const result = await onSubmit(payload);
      if (result.success) {
        onClose();
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-2xl overflow-hidden border border-white/10 bg-[#111114]">
        <div className="border-b border-white/5 px-5 py-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/30">
            Tindak Lanjut
          </p>
          <h3 className="mt-0.5 font-mono text-[13px] text-white/80">
            Rekomendasi tambahan jam (SPL)
          </h3>
        </div>

        {error && (
          <div className="mx-5 mt-4 border border-red-500/20 bg-red-500/[0.04] px-4 py-3 font-mono text-[11px] text-red-400">
            {error}
          </div>
        )}

        <div className="grid gap-2 border-b border-white/5 px-5 py-4 md:grid-cols-3">
          <div className="border border-white/5 bg-[#0a0a0c] px-4 py-3">
            <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-white/25">
              Divisi Perlu SPL
            </p>
            <p className="mt-2 font-mono text-[20px] font-semibold text-white/80">
              {overloadDivisions.length}
            </p>
          </div>
          <div className="border border-white/5 bg-[#0a0a0c] px-4 py-3">
            <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-white/25">
              Total Kekurangan
            </p>
            <p className="mt-2 font-mono text-[20px] font-semibold text-amber-500">
              {overloadDivisions.reduce((sum, div) => sum + div.shortageHours, 0).toFixed(0)} jam
            </p>
          </div>
          <div className="border border-white/5 bg-[#0a0a0c] px-4 py-3">
            <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-white/25">
              Tujuan
            </p>
            <p className="mt-2 text-[13px] font-medium text-white/55">
              Simpan alasan lembur per divisi
            </p>
          </div>
        </div>

        <div className="mt-4 max-h-[60vh] space-y-4 overflow-y-auto px-5 pb-1 pr-5">
          {overloadDivisions.map((div) => (
            <div key={div.divisionId} className="border border-white/5 bg-[#0a0a0c] p-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-white/60">
                  Divisi {div.divisionName}
                </span>
                <span className="border border-amber-500/30 bg-amber-500/[0.04] px-2 py-0.5 font-mono text-[10px] font-medium text-amber-400">
                  Kurang {div.shortageHours.toFixed(0)} Jam
                </span>
              </div>
              <div className="mt-2">
                <label className="mb-1 block font-mono text-[10px] text-white/30">Alasan Kebutuhan SPL *</label>
                <textarea
                  placeholder="Contoh: Target delivery mepet / Kejar tayang sebelum libur..."
                  value={reasons[div.divisionId] ?? ""}
                  onChange={(e) => setReasons((prev) => ({ ...prev, [div.divisionId]: e.target.value }))}
                  rows={2}
                  className="w-full resize-none border border-white/10 bg-[#111114] px-3 py-2 font-mono text-[11px] text-white/70 outline-none placeholder:text-white/20 focus:border-amber-500/40"
                />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 flex justify-end gap-2 border-t border-white/5 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="inline-flex h-8 items-center border border-white/10 px-4 font-mono text-[10px] uppercase tracking-[0.12em] text-white/40 transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
          >
            Nanti Saja
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={isSubmitting}
            className="inline-flex h-8 items-center border border-amber-500/30 bg-amber-500/[0.04] px-4 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-500 transition-colors hover:bg-amber-500/10 disabled:cursor-not-allowed disabled:opacity-30"
          >
            {isSubmitting ? "Menyimpan..." : "Buat Rekomendasi SPL"}
          </button>
        </div>
      </div>
    </div>
  );
}
