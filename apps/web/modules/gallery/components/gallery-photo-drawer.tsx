"use client";

import type {
  GalleryPhotoRecord,
  GalleryPhotoType,
} from "@smsystem/contracts/gallery";
import { Download, Eye, LoaderCircle, Trash2, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createGalleryPhoto,
  deleteGalleryPhoto,
  fetchGalleryPhotos,
  requestGalleryUploadTicket,
  updateGalleryPhoto,
} from "@/shared/api/gallery";
import { getProxiedImageUrl } from "@/shared/api/config";
import { fmtDateTime } from "@/shared/format/humanize";
import { GalleryUploadForm, type UploadFormValues } from "./forms/gallery-upload-form";
import { GalleryPhotoEditForm, type EditFormValues } from "./forms/gallery-photo-edit-form";

const inputCls =
  "h-9 border border-white/[0.08] bg-white/[0.03] px-2.5 text-[12px] font-mono text-foreground outline-none transition-colors focus:border-primary/30 [color-scheme:dark]";

const photoTypes: GalleryPhotoType[] = ["BEFORE", "PROCESS", "AFTER", "DEFECT"];

function humanizePhotoType(photoType: GalleryPhotoType): string {
  switch (photoType) {
    case "BEFORE":
      return "Sebelum";
    case "AFTER":
      return "Sesudah";
    case "DEFECT":
      return "Temuan";
    default:
      return "Proses";
  }
}

function buildDownloadFileName(
  unitName: string,
  jobName: string,
  photo: GalleryPhotoRecord,
  index?: number,
) {
  const originalName = decodeURIComponent(photo.photoUrl.split("/").pop() ?? "foto.jpg");

  if ((photo.source as string) !== "WEB") {
    return typeof index === "number" && index > 0 ? `${index}_${originalName}` : originalName;
  }

  const extension = originalName.includes(".")
    ? originalName.split(".").pop()
    : "jpg";
  const safeUnit = unitName.replace(/[^\w\- ]/gu, "_").trim();
  const safeJob = jobName.replace(/[^\w\- ]/gu, "_").trim();
  const structuredName = `${safeUnit}_${safeJob}_${photo.photoType.toLowerCase()}.${extension}`;
  
  return typeof index === "number" && index > 0 ? `${index}_${structuredName}` : structuredName;
}

async function downloadUrl(url: string, fileName: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("DOWNLOAD_FAILED");
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(objectUrl);
}

interface GalleryPhotoDrawerProps {
  actualId: string | null;
  isOpen: boolean;
  canManagePhotos: boolean;
  canDownloadPhotos: boolean;
  onClose: () => void;
}

export function GalleryPhotoDrawer({
  actualId,
  isOpen,
  canManagePhotos,
  canDownloadPhotos,
  onClose,
}: GalleryPhotoDrawerProps) {
  const router = useRouter();
  const replaceInputRef = useRef<HTMLInputElement | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof fetchGalleryPhotos>>["payload"] | null>(null);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([]);
  const [replaceTarget, setReplaceTarget] = useState<GalleryPhotoRecord | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [rowSavingId, setRowSavingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !actualId) {
      return;
    }

    let cancelled = false;

    async function loadDetail() {
      const targetActualId = actualId;
      if (!targetActualId) {
        return;
      }

      setIsLoading(true);
      setError(null);
      const result = await fetchGalleryPhotos("", targetActualId);

      if (cancelled) {
        return;
      }

      if (!result.payload) {
        setDetail(null);
        setError("Foto jobdesc belum bisa dimuat saat ini.");
        setIsLoading(false);
        return;
      }

      setDetail(result.payload);
      setSelectedPhotoIds([]);
      setIsLoading(false);
    }

    void loadDetail();

    return () => {
      cancelled = true;
    };
  }, [actualId, isOpen]);

  const selectedPhotos = useMemo(() => {
    const photoRows = detail?.data.photos ?? [];
    return photoRows.filter((photo) => selectedPhotoIds.includes(photo.photoId));
  }, [detail, selectedPhotoIds]);

  async function refreshDetail() {
    const targetActualId = actualId;
    if (!targetActualId) {
      return;
    }

    const result = await fetchGalleryPhotos("", targetActualId);
    if (!result.payload) {
      setError("Data foto belum bisa dimuat ulang.");
      return;
    }

    setDetail(result.payload);
  }

  async function uploadFileToR2(params: {
    actualId: string;
    photoType: GalleryPhotoType;
    file: File;
  }) {
    const ticketResult = await requestGalleryUploadTicket({
      actualId: params.actualId,
      photoType: params.photoType,
      filename: params.file.name,
      contentType: params.file.type || "image/jpeg",
    });

    if (!ticketResult.success) {
      throw new Error(ticketResult.message);
    }

    const uploadResponse = await fetch(ticketResult.result.uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": params.file.type || "image/jpeg",
      },
      body: params.file,
    });

    if (!uploadResponse.ok) {
      throw new Error("Upload ke penyimpanan foto gagal.");
    }

    return ticketResult.result.publicUrl;
  }

  async function handleUpload(data: UploadFormValues & { file: File }) {
    if (!detail?.data.actual) {
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const photoUrl = await uploadFileToR2({
        actualId: detail.data.actual.actualId,
        photoType: data.photoType,
        file: data.file,
      });

      const createResult = await createGalleryPhoto({
        actualId: detail.data.actual.actualId,
        photoType: data.photoType,
        photoUrl,
        caption: data.caption?.trim() || null,
      });

      if (!createResult.success) {
        throw new Error(createResult.message);
      }

      await refreshDetail();
      router.refresh();
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Upload foto gagal.",
      );
    } finally {
      setIsUploading(false);
    }
  }

  async function handleSavePhoto(photoId: string, data: EditFormValues) {
    setRowSavingId(photoId);
    setError(null);

    try {
      const updateResult = await updateGalleryPhoto(photoId, {
        photoType: data.photoType,
        caption: data.caption?.trim() || null,
      });

      if (!updateResult.success) {
        throw new Error(updateResult.message);
      }

      await refreshDetail();
      router.refresh();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Foto belum bisa diperbarui.",
      );
    } finally {
      setRowSavingId(null);
    }
  }

  async function handleDeletePhoto(photoId: string) {
    setRowSavingId(photoId);
    setError(null);

    try {
      const deleteResult = await deleteGalleryPhoto(photoId);
      if (!deleteResult.success) {
        throw new Error(deleteResult.message);
      }

      await refreshDetail();
      router.refresh();
      setSelectedPhotoIds((current) => current.filter((id) => id !== photoId));
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Foto belum bisa dihapus.",
      );
    } finally {
      setRowSavingId(null);
    }
  }

  async function handleReplaceFile(file: File) {
    if (!detail?.data.actual || !replaceTarget) {
      return;
    }

    setRowSavingId(replaceTarget.photoId);
    setError(null);

    try {
      const draft = {
        photoType: replaceTarget.photoType,
        caption: replaceTarget.caption ?? "",
      };
      const photoUrl = await uploadFileToR2({
        actualId: detail.data.actual.actualId,
        photoType: draft.photoType,
        file,
      });

      const updateResult = await updateGalleryPhoto(replaceTarget.photoId, {
        photoType: draft.photoType,
        caption: draft.caption.trim() || null,
        photoUrl,
      });

      if (!updateResult.success) {
        throw new Error(updateResult.message);
      }

      await refreshDetail();
      router.refresh();
      setReplaceTarget(null);
    } catch (replaceError) {
      setError(
        replaceError instanceof Error
          ? replaceError.message
          : "File foto belum bisa diganti.",
      );
    } finally {
      setRowSavingId(null);
    }
  }

  async function handleDownloadSelected() {
    if (!detail?.data.actual || selectedPhotos.length === 0) {
      return;
    }

    setError(null);

    for (const [index, photo] of selectedPhotos.entries()) {
      try {
        await downloadUrl(
          getProxiedImageUrl(photo.photoUrl) as string,
          buildDownloadFileName(
            detail.data.actual.unitName,
            detail.data.actual.jobName,
            photo,
            index
          ),
        );
      } catch {
        setError("Sebagian foto tidak bisa diunduh. Coba lagi satu per satu.");
        break;
      }
    }
  }

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-[1px]">
      <button
        type="button"
        aria-label="Tutup galeri foto"
        className="flex-1 cursor-default"
        onClick={onClose}
      />

      <div className="h-full w-full max-w-[980px] overflow-y-auto border-l border-white/[0.08] bg-background p-6 shadow-2xl">
        <div className="flex flex-col gap-4 border-b border-white/[0.08] pb-6 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-app-accent-ink">
              Foto Pengerjaan
            </p>
            <h2 className="mt-2 text-[15px] font-mono text-foreground">
              {detail?.data.actual.unitName ?? "Memuat foto..."}
            </h2>
            <p className="mt-2 text-sm text-foreground/45">
              {detail?.data.actual.panelName ?? "-"} · {detail?.data.actual.partName ?? "-"} ·{" "}
              {detail?.data.actual.jobName ?? "-"}
            </p>
            
            {detail?.data.actual ? (
              <div className="mt-3 flex flex-wrap items-center gap-4 text-[12px] text-foreground/50">
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 bg-white/20"></span>
                  {detail.data.actual.workDate}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 bg-white/20"></span>
                  {detail.data.actual.divisionName}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 bg-white/20"></span>
                  {detail.data.actual.employeeName}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 bg-primary"></span>
                  {detail.data.actual.actualStatus}
                </span>
              </div>
            ) : null}

          </div>
          <button
            type="button"
            onClick={onClose}
            className="border border-white/[0.08] px-4 py-2 text-[11px] font-mono uppercase tracking-[0.12em] text-foreground/50 transition-colors hover:border-white/20 hover:text-foreground"
          >
            Tutup
          </button>
        </div>

        {isLoading ? (
          <div className="mt-8 flex items-center gap-3 border border-white/[0.06] bg-white/[0.03] px-4 py-5 text-[12px] font-mono text-foreground/50">
            <LoaderCircle className="h-4 w-4 animate-spin text-app-accent-ink" />
            Memuat foto pengerjaan...
          </div>
        ) : null}

        {error ? (
          <div className="mt-6 border border-destructive/20 bg-destructive/[0.06] px-4 py-3 text-[12px] font-mono text-destructive">
            {error}
          </div>
        ) : null}

        {detail ? (
          <div className="mt-6 space-y-6">

            {canManagePhotos ? (
              <div className="border border-white/[0.06] bg-white/[0.03] p-4">
                <div className="flex items-center gap-2">
                  <Upload className="h-4 w-4 text-app-accent-ink" />
                  <h3 className="text-[10px] font-mono uppercase tracking-[0.12em] text-foreground/50">Tambah Foto</h3>
                </div>

                <GalleryUploadForm
                  isUploading={isUploading}
                  isDisabled={detail.data.actual.submittedToLedger}
                  defaultCaption={detail.data.actual.jobDescription ?? ""}
                  onSubmit={(data) => {
                    void handleUpload(data);
                  }}
                />

                {detail.data.actual.submittedToLedger ? null : null}
              </div>
            ) : null}

            <div className="border border-white/[0.06] bg-white/[0.03] p-4">
              {detail.data.actual.jobDescription ? (
                <div className="mb-4 border border-white/[0.06] bg-black/20 px-3 py-2.5">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-foreground/30">Keterangan / PR / WO</p>
                  <p className="mt-1 text-[12px] text-foreground/80 leading-relaxed">{detail.data.actual.jobDescription}</p>
                </div>
              ) : null}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-[10px] font-mono uppercase tracking-[0.12em] text-foreground/50">Daftar Foto</h3>
                </div>
                {canDownloadPhotos ? (
                  <button
                    type="button"
                    onClick={() => {
                      void handleDownloadSelected();
                    }}
                    disabled={selectedPhotos.length === 0}
                    className="border border-white/[0.08] px-3 py-2 text-[11px] font-mono uppercase tracking-[0.1em] text-foreground/60 hover:text-foreground hover:border-white/20 disabled:cursor-not-allowed disabled:opacity-35 transition-colors"
                  >
                    Unduh Terpilih ({selectedPhotos.length})
                  </button>
                ) : null}
              </div>

              {detail.data.photos.length === 0 ? (
                <div className="mt-4 border border-white/[0.06] bg-black/20 px-4 py-8 text-center text-[12px] font-mono text-foreground/35">
                  Belum ada foto di jobdesc ini.
                </div>
              ) : (
                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {detail.data.photos.map((photo) => {
                    const isBusy = rowSavingId === photo.photoId;
                    const isMutable = canManagePhotos && photo.canEdit;
                    const isSelected = selectedPhotoIds.includes(photo.photoId);

                    return (
                      <div
                        key={photo.photoId}
                        className={`relative flex flex-col overflow-hidden border transition-colors ${
                          isSelected ? "border-primary/40 bg-primary/[0.04]" : "border-white/[0.07] bg-black/20"
                        }`}
                      >
                        {/* Checkbox pojok kiri atas */}
                        <label className="absolute left-2.5 top-2.5 z-10 flex h-5 w-5 cursor-pointer items-center justify-center border border-white/20 bg-black/50 backdrop-blur-sm">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(event) => {
                              setSelectedPhotoIds((current) =>
                                event.target.checked
                                  ? [...current, photo.photoId]
                                  : current.filter((id) => id !== photo.photoId),
                              );
                            }}
                            className="h-3 w-3 accent-primary"
                          />
                        </label>

                        {/* Badge jenis pojok kanan atas */}
                        <span className="absolute right-2.5 top-2.5 z-10 border border-white/[0.12] bg-black/70 px-2 py-0.5 text-[10px] font-mono uppercase tracking-[0.12em] text-foreground/60 backdrop-blur-sm">
                          {humanizePhotoType(photo.photoType)}
                        </span>

                        {/* Gambar */}
                        <button
                          type="button"
                          onClick={() => window.open(getProxiedImageUrl(photo.photoUrl), "_blank", "noopener,noreferrer")}
                          className="group block aspect-video w-full overflow-hidden bg-black/40"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={getProxiedImageUrl(photo.photoUrl)}
                            alt={photo.caption ?? photo.photoType}
                            loading="lazy"
                            decoding="async"
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        </button>

                        {/* Body card */}
                        <div className="flex flex-1 flex-col gap-3 p-3">
                          {isMutable ? (
                            <GalleryPhotoEditForm
                              initialPhotoType={photo.photoType}
                              initialCaption={photo.caption ?? ""}
                              isBusy={isBusy}
                              onSave={(data) => {
                                void handleSavePhoto(photo.photoId, data);
                              }}
                            />
                          ) : (
                            <p className="text-[12px] text-foreground/55">
                              {photo.caption ? photo.caption : <span className="italic text-foreground/25">Tidak ada keterangan</span>}
                            </p>
                          )}

                          {/* Meta info */}
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-foreground/35">
                            <span>{photo.uploadedByName || photo.uploadedBy || "-"}</span>
                            <span>·</span>
                            <span>{fmtDateTime(photo.uploadedAt)}</span>
                            <span>·</span>
                            <span>{photo.source}</span>
                          </div>

                          {/* Tombol aksi */}
                          <div className="mt-auto flex flex-wrap gap-1.5 border-t border-white/[0.06] pt-3">
                            <button
                              type="button"
                              onClick={() => window.open(getProxiedImageUrl(photo.photoUrl), "_blank", "noopener,noreferrer")}
                              className="inline-flex items-center gap-1 border border-white/[0.08] px-2.5 py-1 text-[11px] font-mono text-foreground/60 hover:text-foreground transition-colors"
                            >
                              <Eye className="h-3 w-3" />
                              Lihat
                            </button>

                            {canDownloadPhotos ? (
                              <button
                                type="button"
                                onClick={() => {
                                  void downloadUrl(
                                    getProxiedImageUrl(photo.photoUrl) as string,
                                    buildDownloadFileName(
                                      detail.data.actual.unitName,
                                      detail.data.actual.jobName,
                                      photo,
                                    ),
                                  );
                                }}
                                className="inline-flex items-center gap-1 border border-white/[0.08] px-2.5 py-1 text-[11px] font-mono text-foreground/60 hover:text-foreground transition-colors"
                              >
                                <Download className="h-3 w-3" />
                                Unduh
                              </button>
                            ) : null}

                            {isMutable ? (
                              <>
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => {
                                    setReplaceTarget(photo);
                                    replaceInputRef.current?.click();
                                  }}
                                  className="inline-flex items-center gap-1 border border-white/[0.08] px-2.5 py-1 text-[11px] font-mono text-foreground/60 hover:text-foreground transition-colors disabled:opacity-35"
                                >
                                  Ganti
                                </button>
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => { void handleDeletePhoto(photo.photoId); }}
                                  className="inline-flex items-center gap-1 border border-destructive/20 bg-destructive/[0.06] px-2.5 py-1 text-[11px] font-mono text-destructive transition-colors hover:border-destructive/40 disabled:opacity-35"
                                >
                                  <Trash2 className="h-3 w-3" />
                                  Hapus
                                </button>
                              </>
                            ) : (
                              <span className="border border-white/[0.06] px-2.5 py-1 text-[11px] font-mono uppercase tracking-[0.1em] text-foreground/25">
                                Foto final
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <input
              ref={replaceInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void handleReplaceFile(file);
                }
                event.currentTarget.value = "";
              }}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
