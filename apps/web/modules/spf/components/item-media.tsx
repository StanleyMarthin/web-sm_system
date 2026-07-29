"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { SpfMedia } from "@/shared/api/spf-contracts";
import { ActionButton, EmptyRow, Toast } from "@/shared/ui/compact";
import { useSweetAlert } from "@/shared/ui/sweet-alert";
import { mutateSpf } from "@/shared/api/spf";

interface ItemMediaProps {
  itemId: number;
  media: readonly SpfMedia[];
  editable: boolean;
}

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export function ItemMedia({ itemId, media, editable }: ItemMediaProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { alertElement, confirm, notifySuccess, notifyError } = useSweetAlert();
  const [isUploading, startUploadTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setUploadError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      setUploadError(
        `Tipe file tidak didukung (${file.type}). Gunakan JPG, PNG, WEBP, atau PDF.`,
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
          filename: file.name,
          mime_type: file.type,
          data: base64Data,
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
        item_id: itemId,
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
            JPG, PNG, WEBP, PDF (Maks 5MB)
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
                      src={m.url}
                      alt={m.filename}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      loading="lazy"
                    />
                  </div>
                ) : (
                  <div className="flex aspect-video w-full items-center justify-center bg-muted p-2 text-center">
                    <span className="font-mono text-[11px] text-muted-foreground">
                      📄 PDF: {m.filename}
                    </span>
                  </div>
                )}

                <div className="mt-2 flex items-center justify-between font-mono text-[11px]">
                  <a
                    href={m.url}
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
