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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/50 px-4">
      <div className="w-full max-w-lg overflow-hidden border border-border bg-card">
        <div className="border-b border-border px-5 py-4">
          <p className="font-mono text-[14px] uppercase tracking-[0.12em] text-muted-foreground">
            Konfirmasi
          </p>
          <h3 className="mt-0.5 font-mono text-[15px] text-foreground">
            Rilis SPK dari hasil planning
          </h3>
        </div>

        <div className="grid gap-2 border-b border-border px-5 py-4 md:grid-cols-2">
          <div className="border border-border bg-background px-4 py-3">
            <p className="font-mono text-[15px] uppercase tracking-[0.12em] text-muted-foreground">
              Unit Dirilis
            </p>
            <p className="mt-2 font-mono text-[20px] font-semibold text-foreground">
              {unitCount}
            </p>
          </div>
          <div className="border border-border bg-background px-4 py-3">
            <p className="font-mono text-[15px] uppercase tracking-[0.12em] text-muted-foreground">
              Tindak Lanjut
            </p>
            <p className="mt-2 text-[15px] font-medium text-muted-foreground">
              {anyOverload ? "SPK rilis lalu lanjut rekomendasi SPL" : "SPK siap dipakai di modul SPK"}
            </p>
          </div>
        </div>

        {anyOverload && (
          <div className="mx-5 mt-4 border border-primary/20 bg-primary/[0.03] px-4 py-3 font-mono text-[15px] text-app-accent-ink">
            Terdapat target yang melebihi kapasitas jam normal. Setelah SPK dirilis, sistem akan
            melanjutkan ke rekomendasi lembur (SPL) per divisi yang kekurangan jam.
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2 border-t border-border px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isReleasing}
            className="inline-flex h-8 items-center border border-border px-4 font-mono text-[14px] uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={() => void onConfirm()}
            disabled={isReleasing}
            className="inline-flex h-8 items-center border border-primary/30 bg-primary/[0.04] px-4 font-mono text-[14px] font-semibold uppercase tracking-[0.12em] text-app-accent-ink transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-30"
          >
            {isReleasing ? "Merilis..." : "Ya, Rilis SPK"}
          </button>
        </div>
      </div>
    </div>
  );
}
