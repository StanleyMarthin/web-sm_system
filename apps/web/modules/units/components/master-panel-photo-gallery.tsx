"use client";

import type { UnitPanelDetail } from "@smsystem/contracts/unit-panel";
import { ChevronLeft, ChevronRight, Maximize2, X } from "lucide-react";
import { useState } from "react";
import { getProxiedImageUrl } from "@/shared/api/config";

const ICON_STROKE_WIDTH = 2.4;

function imageSrc(url: string | null | undefined): string | undefined {
  return getProxiedImageUrl(url) ?? undefined;
}

export function MasterPanelPhotoGallery({ detail, onClose }: { detail: UnitPanelDetail; onClose?: () => void }) {
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const activeImage = detail.images[activeImageIndex] ?? null;

  function moveImage(direction: -1 | 1) {
    setActiveImageIndex((current) => {
      const total = detail.images.length;
      if (total === 0) return 0;
      return (current + direction + total) % total;
    });
  }

  return (
    <section className="border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-[13px] font-mono uppercase tracking-[0.12em] text-muted-foreground">Foto</h2>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[12px] text-muted-foreground">{detail.images.length}</span>
          {onClose ? (
            <button type="button" onClick={onClose} className="catalog-icon-button" title="Tutup foto">
              <X className="h-4 w-4" strokeWidth={ICON_STROKE_WIDTH} />
            </button>
          ) : null}
        </div>
      </div>
      {activeImage ? (
        <div className="p-4">
          <div className="relative flex h-[30rem] items-center justify-center overflow-hidden border border-border bg-background">
            <img src={imageSrc(activeImage.fileUrl)} alt={activeImage.caption ?? detail.panel.name} className="h-full w-full object-contain" />
            {detail.images.length > 1 ? (
              <>
                <button type="button" onClick={() => moveImage(-1)} className="absolute left-3 top-1/2 -translate-y-1/2 catalog-icon-button" title="Foto sebelumnya">
                  <ChevronLeft className="h-4 w-4" strokeWidth={ICON_STROKE_WIDTH} />
                </button>
                <button type="button" onClick={() => moveImage(1)} className="absolute right-3 top-1/2 -translate-y-1/2 catalog-icon-button" title="Foto berikutnya">
                  <ChevronRight className="h-4 w-4" strokeWidth={ICON_STROKE_WIDTH} />
                </button>
              </>
            ) : null}
            <button type="button" onClick={() => setIsFullscreen(true)} className="absolute right-3 top-3 catalog-icon-button" title="Perbesar foto">
              <Maximize2 className="h-4 w-4" strokeWidth={ICON_STROKE_WIDTH} />
            </button>
          </div>
          {activeImage.caption ? <p className="mt-2 text-[13px] text-muted-foreground">{activeImage.caption}</p> : null}
          {detail.images.length > 1 ? (
            <div className="mt-3 flex gap-2 overflow-x-auto">
              {detail.images.map((image, index) => (
                <button
                  key={image.id}
                  type="button"
                  onClick={() => setActiveImageIndex(index)}
                  className={`h-16 w-24 shrink-0 border bg-background ${index === activeImageIndex ? "border-primary" : "border-border"}`}
                  title={image.caption ?? `Foto ${index + 1}`}
                >
                  <img src={imageSrc(image.fileUrl)} alt={image.caption ?? `Foto ${index + 1}`} className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="px-4 py-6 text-[14px] text-muted-foreground">Belum ada foto.</div>
      )}

      {isFullscreen && activeImage ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-6">
          <button type="button" onClick={() => setIsFullscreen(false)} className="absolute right-5 top-5 catalog-icon-button" title="Tutup foto">
            <X className="h-4 w-4" strokeWidth={ICON_STROKE_WIDTH} />
          </button>
          <img src={imageSrc(activeImage.fileUrl)} alt={activeImage.caption ?? detail.panel.name} className="max-h-full max-w-full object-contain" />
        </div>
      ) : null}
    </section>
  );
}
