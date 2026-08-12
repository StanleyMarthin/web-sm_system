"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { EyeOff, Trash2, Upload } from "lucide-react";
import type { SpfMedia } from "@/shared/api/spf-contracts";
import { mutateSpf, uploadSpfItemMedia } from "@/shared/api/spf";
import { ActionButton, EmptyRow, Toast } from "@/shared/ui/compact";
import { useSweetAlert } from "@/shared/ui/sweet-alert";
import { SpfSourceBadge } from "./spf-source-badge";

interface DocumentationManagerProps {
  itemId: string | number;
  media: readonly SpfMedia[];
  editable: boolean;
}

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
];

export function DocumentationManager({ itemId, media, editable }: DocumentationManagerProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const { alertElement, notifyError, notifySuccess } = useSweetAlert();
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [progressText, setProgressText] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleFiles(files: FileList | null) {
    setUploadError(null);
    const file = files?.[0];
    if (!file) return;
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      setUploadError(`Tipe file tidak didukung (${file.type || "tidak dikenal"}).`);
      return;
    }

    setProgressText(`Mengunggah ${file.name}...`);
    startTransition(async () => {
      const result = await uploadSpfItemMedia(String(itemId), file);
      if (inputRef.current) inputRef.current.value = "";
      setProgressText(null);
      if (!result.success) {
        setUploadError(result.message);
        notifyError("Gagal unggah", result.message);
        return;
      }
      notifySuccess("Berhasil", "Media manual berhasil diunggah.");
      router.refresh();
    });
  }

  function updateMedia(mediaItem: SpfMedia, mode: "DELETE_MEDIA" | "HIDE_MEDIA") {
    startTransition(async () => {
      const result = await mutateSpf("item", mode === "DELETE_MEDIA"
        ? { mode, media_id: mediaItem.id }
        : { mode, media_id: mediaItem.id, hidden: !mediaItem.hidden });
      if (!result.success) {
        notifyError(result.status === 409 ? "Data telah berubah" : "Gagal memperbarui media", result.message);
        if (result.status === 409) router.refresh();
        return;
      }
      notifySuccess("Tersimpan", mode === "DELETE_MEDIA" ? "Media manual dihapus." : "Tampilan media diperbarui.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {alertElement}
      {editable ? (
        <div className="flex flex-wrap items-center gap-2 border border-border bg-card px-3 py-2 dark:border-white/[0.05]">
          <input
            ref={inputRef}
            type="file"
            accept={ALLOWED_MIME_TYPES.join(",")}
            className="hidden"
            disabled={isPending}
            onChange={(event) => handleFiles(event.target.files)}
          />
          <ActionButton variant="primary" disabled={isPending} onClick={() => inputRef.current?.click()}>
            <Upload className="h-3.5 w-3.5" />
            Upload Manual
          </ActionButton>
          <span className="text-[12px] text-muted-foreground">JPG, PNG, WEBP, MP4.</span>
        </div>
      ) : null}

      <Toast message={uploadError} variant="err" />
      {progressText ? <p role="status" className="text-[12px] text-app-accent-ink">{progressText}</p> : null}

      {media.length === 0 ? (
        <EmptyRow message="Belum ada dokumentasi pada item ini." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {media.map((item) => {
            const isImage = item.mime_type.startsWith("image/");
            const isVideo = item.mime_type.startsWith("video/");
            return (
              <figure key={item.id} className={`border border-border bg-card p-2 dark:border-white/[0.05] ${item.hidden ? "opacity-50" : ""}`}>
                <div className="aspect-video overflow-hidden bg-muted">
                  {isImage ? (
                    <img src={item.url} alt={item.caption ?? item.filename} className="h-full w-full object-cover" loading="lazy" />
                  ) : isVideo ? (
                    <video src={item.url} className="h-full w-full object-cover" controls preload="metadata" />
                  ) : (
                    <div className="flex h-full items-center justify-center p-3 text-center font-mono text-[12px] text-muted-foreground">
                      PDF · {item.filename}
                    </div>
                  )}
                </div>
                <figcaption className="mt-2 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <SpfSourceBadge value={item.source_type} />
                    {item.hidden ? <span className="font-mono text-[11px] text-muted-foreground">Disembunyikan</span> : null}
                  </div>
                  <a href={item.url} target="_blank" rel="noopener noreferrer" className="block truncate text-[12px] text-app-accent-ink hover:underline">
                    {item.filename}
                  </a>
                  {item.caption ? <p className="text-[12px] text-muted-foreground">{item.caption}</p> : null}
                  {editable ? (
                    <div className="flex flex-wrap gap-1.5">
                      <ActionButton disabled={isPending} onClick={() => updateMedia(item, "HIDE_MEDIA")}>
                        <EyeOff className="h-3.5 w-3.5" />
                        {item.hidden ? "Tampilkan" : "Sembunyikan"}
                      </ActionButton>
                      {item.source_type === "MANUAL" ? (
                        <ActionButton variant="danger" disabled={isPending} onClick={() => updateMedia(item, "DELETE_MEDIA")}>
                          <Trash2 className="h-3.5 w-3.5" />
                          Hapus
                        </ActionButton>
                      ) : null}
                    </div>
                  ) : null}
                </figcaption>
              </figure>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function ItemMedia(props: DocumentationManagerProps) {
  return <DocumentationManager {...props} />;
}
