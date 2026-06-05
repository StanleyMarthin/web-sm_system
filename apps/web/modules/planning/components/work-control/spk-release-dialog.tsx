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
      <div className="w-full max-w-lg overflow-hidden border border-gray-200 bg-white dark:border-white/[0.06] dark:bg-[#111114]">
        <div className="border-b border-gray-200 px-5 py-4 dark:border-white/[0.06]">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-gray-400 dark:text-white/30">
            Konfirmasi
          </p>
          <h3 className="mt-1 text-[16px] font-semibold tracking-[-0.02em] text-gray-900 dark:text-white">
            Rilis SPK dari hasil planning
          </h3>
          <p className="mt-2 text-[12px] leading-5 text-gray-500 dark:text-white/45">
            Anda akan merilis SPK untuk <strong>{unitCount} unit</strong>. Setelah dirilis, target
            ini menjadi acuan resmi untuk kepala divisi menyusun dan menjalankan pekerjaan.
          </p>
        </div>

        <div className="grid gap-2 border-b border-gray-200 px-5 py-4 md:grid-cols-2 dark:border-white/[0.06]">
          <div className="border border-gray-200 bg-gray-50 px-4 py-3 dark:border-white/[0.06] dark:bg-[#0a0a0c]">
            <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-gray-400 dark:text-white/20">
              Unit Dirilis
            </p>
            <p className="mt-2 font-mono text-[20px] font-semibold text-gray-900 dark:text-white">
              {unitCount}
            </p>
          </div>
          <div className="border border-gray-200 bg-gray-50 px-4 py-3 dark:border-white/[0.06] dark:bg-[#0a0a0c]">
            <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-gray-400 dark:text-white/20">
              Tindak Lanjut
            </p>
            <p className="mt-2 text-[13px] font-medium text-gray-700 dark:text-white/70">
              {anyOverload ? "SPK rilis lalu lanjut rekomendasi SPL" : "SPK siap dipakai di modul SPK"}
            </p>
          </div>
        </div>

        {anyOverload && (
          <div className="mx-5 mt-4 border border-amber-500/20 bg-amber-500/[0.05] px-4 py-3 text-[12px] text-amber-700 dark:text-amber-300">
            Terdapat target yang melebihi kapasitas jam normal. Setelah SPK dirilis, sistem akan
            melanjutkan ke rekomendasi lembur (SPL) per divisi yang kekurangan jam.
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2 border-t border-gray-200 px-5 py-4 dark:border-white/[0.06]">
          <button
            type="button"
            onClick={onClose}
            disabled={isReleasing}
            className="inline-flex h-10 items-center border border-gray-300 px-4 font-mono text-[10px] uppercase tracking-[0.12em] text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-white/[0.08] dark:text-white/50 dark:hover:bg-white/[0.04]"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={() => void onConfirm()}
            disabled={isReleasing}
            className="inline-flex h-10 items-center border border-amber-500/30 bg-amber-500/[0.08] px-4 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-700 transition-colors hover:bg-amber-500/[0.14] disabled:opacity-50 disabled:cursor-not-allowed dark:text-amber-300"
          >
            {isReleasing ? "Merilis..." : "Ya, Rilis SPK"}
          </button>
        </div>
      </div>
    </div>
  );
}
