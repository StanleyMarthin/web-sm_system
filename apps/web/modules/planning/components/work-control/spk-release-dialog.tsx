"use client";

/* Hallmark · pre-emit critique: P4 H4 E4 S4 R4 V4 */
/* Hallmark · genre: modern-minimal · macrostructure: Workbench · design-system: design.md · designed-as-app */

interface SpkReleaseDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isReleasing: boolean;
  unitCount: number;
  anyOverload: boolean;
}

export function SpkReleaseDialog({
  isOpen,
  onClose,
  onConfirm,
  isReleasing,
  unitCount,
  anyOverload,
}: SpkReleaseDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-lg overflow-hidden border border-white/10 bg-[#111114]">
        <div className="border-b border-white/5 px-5 py-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/30">
            Konfirmasi
          </p>
          <h3 className="mt-0.5 font-mono text-[13px] text-white/80">
            Rilis SPK dari hasil planning
          </h3>
        </div>

        <div className="grid gap-2 border-b border-white/5 px-5 py-4 md:grid-cols-2">
          <div className="border border-white/5 bg-[#0a0a0c] px-4 py-3">
            <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-white/25">
              Unit Dirilis
            </p>
            <p className="mt-2 font-mono text-[20px] font-semibold text-white/80">
              {unitCount}
            </p>
          </div>
          <div className="border border-white/5 bg-[#0a0a0c] px-4 py-3">
            <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-white/25">
              Tindak Lanjut
            </p>
            <p className="mt-2 text-[13px] font-medium text-white/55">
              {anyOverload ? "SPK rilis lalu lanjut rekomendasi SPL" : "SPK siap dipakai di modul SPK"}
            </p>
          </div>
        </div>

        {anyOverload && (
          <div className="mx-5 mt-4 border border-amber-500/20 bg-amber-500/[0.03] px-4 py-3 font-mono text-[11px] text-amber-400">
            Terdapat target yang melebihi kapasitas jam normal. Setelah SPK dirilis, sistem akan
            melanjutkan ke rekomendasi lembur (SPL) per divisi yang kekurangan jam.
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2 border-t border-white/5 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isReleasing}
            className="inline-flex h-8 items-center border border-white/10 px-4 font-mono text-[10px] uppercase tracking-[0.12em] text-white/40 transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={() => void onConfirm()}
            disabled={isReleasing}
            className="inline-flex h-8 items-center border border-amber-500/30 bg-amber-500/[0.04] px-4 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-500 transition-colors hover:bg-amber-500/10 disabled:cursor-not-allowed disabled:opacity-30"
          >
            {isReleasing ? "Merilis..." : "Ya, Rilis SPK"}
          </button>
        </div>
      </div>
    </div>
  );
}
