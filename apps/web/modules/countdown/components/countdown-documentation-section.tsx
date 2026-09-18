"use client";

import type { CountdownDetail } from "@smsystem/contracts/countdown";
import { Camera, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { SectionCard } from "@/shared/ui/compact";
import { resolveCountdownPhotoUrl } from "../countdown-dialog";

const photoLabels = {
  BEFORE: "Sebelum",
  PROCESS: "Proses",
  AFTER: "Selesai",
  DEFECT: "Temuan",
} as const;

type PhotoType = keyof typeof photoLabels;

// Dokumentasi pekerjaan: foto dikelompokkan Sebelum / Proses / Selesai dan tetap
// di halaman countdown (bukan modul baru) karena foto adalah bukti restorasi.
export function CountdownDocumentationSection({ countdown }: { countdown: CountdownDetail }) {
  const photos = countdown.details
    .flatMap((detail) => detail.photos.map((photo) => ({
      ...photo,
      workDate: detail.workDate,
      employeeName: detail.employeeName,
    })))
    .filter((photo) => resolveCountdownPhotoUrl(photo.url));
  const [activeType, setActiveType] = useState<PhotoType>("BEFORE");
  const [activeIndex, setActiveIndex] = useState(0);

  const buckets = (Object.keys(photoLabels) as PhotoType[]).map((type) => ({
    type,
    label: photoLabels[type],
    photos: photos.filter((photo) => photo.type === type),
  }));
  const visiblePhotos = buckets.find((bucket) => bucket.type === activeType)?.photos ?? [];
  const activePhoto = visiblePhotos[activeIndex];
  const activeUrl = activePhoto ? resolveCountdownPhotoUrl(activePhoto.url) : null;

  function move(delta: number) {
    setActiveIndex((current) => (current + delta + visiblePhotos.length) % visiblePhotos.length);
  }

  return (
    <div id="dokumentasi">
      <SectionCard label="Dokumentasi" count={photos.length} collapsible defaultOpen>
        {photos.length === 0 ? (
          <p className="text-[12px] text-muted-foreground">Belum ada foto pekerjaan.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-1.5">
              {buckets.map((bucket) => (
                <button
                  key={bucket.type}
                  type="button"
                  onClick={() => {
                    setActiveType(bucket.type);
                    setActiveIndex(0);
                  }}
                  aria-pressed={bucket.type === activeType}
                  className={`inline-flex items-center gap-1 border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] transition-colors ${
                    bucket.type === activeType
                      ? "border-primary/40 bg-primary/10 text-app-accent-ink"
                      : "border-border text-muted-foreground hover:bg-muted hover:text-foreground dark:border-white/[0.08]"
                  }`}
                >
                  {bucket.label}
                  <span className="tabular-nums">{bucket.photos.length}</span>
                </button>
              ))}
            </div>

            {activePhoto && activeUrl ? (
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_9rem]">
                <div className="relative flex min-h-[16rem] items-center justify-center overflow-hidden bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element -- URL dokumentasi berasal dari storage dinamis. */}
                  <img
                    src={activeUrl}
                    alt={activePhoto.caption || `Dokumentasi ${photoLabels[activePhoto.type]}`}
                    className="max-h-[28rem] w-full object-contain"
                  />
                  {visiblePhotos.length > 1 ? (
                    <>
                      <button type="button" onClick={() => move(-1)} className="absolute left-2 inline-flex h-8 w-8 items-center justify-center border border-white/30 bg-black/45 text-white hover:bg-black/65" aria-label="Foto sebelumnya"><ChevronLeft className="h-4 w-4" /></button>
                      <button type="button" onClick={() => move(1)} className="absolute right-2 inline-flex h-8 w-8 items-center justify-center border border-white/30 bg-black/45 text-white hover:bg-black/65" aria-label="Foto berikutnya"><ChevronRight className="h-4 w-4" /></button>
                    </>
                  ) : null}
                </div>
                <div className="flex gap-2 overflow-x-auto lg:block lg:space-y-2 lg:overflow-y-auto">
                  {visiblePhotos.map((photo, index) => {
                    const url = resolveCountdownPhotoUrl(photo.url);
                    if (!url) return null;
                    return (
                      <button
                        key={photo.photoId}
                        type="button"
                        onClick={() => setActiveIndex(index)}
                        className={`block shrink-0 overflow-hidden border text-left ${index === activeIndex ? "border-primary" : "border-border hover:border-primary/50"}`}
                        aria-label={`Pilih foto ${index + 1}`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element -- URL dokumentasi berasal dari storage dinamis. */}
                        <img src={url} alt="" className="h-16 w-20 object-cover lg:h-20 lg:w-full" />
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className="flex items-center gap-2 text-[12px] text-muted-foreground">
                <Camera className="h-3.5 w-3.5 text-app-accent-ink" />
                Belum ada foto {photoLabels[activeType].toLowerCase()}.
              </p>
            )}

            {activePhoto ? (
              <p className="border-t border-border pt-2 text-[12px] text-muted-foreground dark:border-white/[0.06]">
                <span className="font-medium text-foreground">{photoLabels[activePhoto.type]}</span>
                {activePhoto.caption ? ` · ${activePhoto.caption}` : ""}
                {activePhoto.workDate ? ` · ${activePhoto.workDate}` : ""}
              </p>
            ) : null}
          </>
        )}
      </SectionCard>
    </div>
  );
}
