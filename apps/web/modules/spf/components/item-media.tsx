"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { SpfMedia } from "@/shared/api/spf-contracts";
import { ActionButton, EmptyRow, Toast } from "@/shared/ui/compact";
import { useSweetAlert } from "@/shared/ui/sweet-alert";
import { mutateSpf } from "@/shared/api/spf";

function resolveMediaUrl(url: string): string {
  if (url.includes("drive.google.com/file/d/")) {
    const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      return `https://drive.google.com/uc?export=view&id=${match[1]}`;
    }
  }
  return url;
}

interface ItemMediaProps {
  itemId: string;
  media: readonly SpfMedia[];
  editable: boolean;
}

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
] as const;

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export function ItemMedia({ itemId, media, editable }: ItemMediaProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { alertElement, confirm, notifySuccess, notifyError } = useSweetAlert();
  const [isUploading, startUploadTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setUploadError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_MIME_TYPES.includes(file.type as (typeof ALLOWED_MIME_TYPES)[number])) {
      setUploadError(
        `Tipe file tidak didukung (${file.type}). Gunakan JPG, PNG, WebP, atau MP4.`,
      );
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setUploadError(
        `Ukuran file melebihi batas 5MB (${(file.size / 1024 / 1024).toFixed(1)}MB).`,
      );
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64Data = dataUrl.split(",")[1];
      if (!base64Data) {
        setUploadError("Gagal membaca file sebagai Base64.");
        return;
      }

      startUploadTransition(async () => {
        const result = await mutateSpf("item", {
          mode: "UPLOAD_MEDIA",
          item_id: itemId,
          file_name: file.name,
          mime_type: file.type as (typeof ALLOWED_MIME_TYPES)[number],
          file_data: base64Data,
        });

        if (fileInputRef.current) fileInputRef.current.value = "";

        if (!result.success) {
          setUploadError(result.message);
          notifyError("Gagal Unggah", result.message);
          return;
        }

        notifySuccess("Berhasil", "Media berhasil diunggah.");
        router.refresh();
      });
    };
    reader.readAsDataURL(file);
  }

  async function handleDeleteMedia(mediaItem: SpfMedia) {
    const confirmed = await confirm({
      title: `Hapus Media #${mediaItem.id}`,
      description: `Apakah Anda yakin ingin menghapus media "${mediaItem.filename}"?`,
      tone: "warning",
      confirmLabel: "Hapus Media",
      cancelLabel: "Batal",
    });

    if (!confirmed) return;

    setDeletingId(mediaItem.id);
    startDeleteTransition(async () => {
      const result = await mutateSpf("item", {
        mode: "DELETE_MEDIA",
        media_id: mediaItem.id,
      });

      setDeletingId(null);

      if (!result.success) {
        notifyError("Gagal Hapus Media", result.message);
        return;
      }

      notifySuccess("Berhasil", "Media telah dihapus.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {alertElement}

      {/* Upload button for editable ADMIN */}
      {editable && (
        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept={ALLOWED_MIME_TYPES.join(",")}
            onChange={handleFileChange}
            disabled={isUploading}
            className="hidden"
            id={`file-upload-${itemId}`}
          />
          <label htmlFor={`file-upload-${itemId}`}>
            <ActionButton
              type="button"
              variant="primary"
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {isUploading ? "Mengunggah…" : "+ Unggah Media"}
            </ActionButton>
          </label>
          <span className="font-mono text-[11px] text-muted-foreground dark:text-foreground/45">
            JPG, PNG, WebP, MP4 (Maks 5MB)
          </span>
        </div>
      )}

      <Toast message={uploadError} variant="err" />

      {/* Media Grid / List */}
      {media.length === 0 ? (
        <EmptyRow message="Belum ada media yang terlampir pada item ini." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {media.map((m) => {
            const isImage = m.mime_type.startsWith("image/");
            return (
              <div
                key={m.id}
                className="group relative border border-border bg-card p-2 dark:border-white/[0.05]"
              >
                {isImage ? (
                  <div className="aspect-video w-full overflow-hidden bg-muted">
                    {/* Native img tag with remote URL returned by API */}
                    <img
                      src={resolveMediaUrl(m.url)}
                      alt={m.filename}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      loading="lazy"
                    />
                  </div>
                ) : (
                  <video src={resolveMediaUrl(m.url)} controls preload="metadata" className="aspect-video w-full bg-muted object-contain">
                    Browser tidak mendukung video.
                  </video>
                )}

                <div className="mt-2 flex items-center justify-between font-mono text-[11px]">
                  <a
                    href={resolveMediaUrl(m.url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate text-app-accent-ink hover:underline dark:text-app-accent-ink/80"
                    title={m.filename}
                  >
                    {m.filename}
                  </a>
                  {editable && (
                    <button
                      type="button"
                      onClick={() => handleDeleteMedia(m)}
                      disabled={isDeleting && deletingId === m.id}
                      className="ml-2 shrink-0 text-destructive hover:underline disabled:opacity-50"
                    >
                      {isDeleting && deletingId === m.id ? "..." : "Hapus"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
