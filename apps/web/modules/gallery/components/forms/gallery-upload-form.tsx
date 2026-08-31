"use client";

import type { GalleryPhotoType } from "@smsystem/contracts/gallery";
import { zodResolver } from "@hookform/resolvers/zod";
import { FileUp, Link2, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const uploadSchema = z.object({
  photoType: z.enum(["BEFORE", "PROCESS", "AFTER", "DEFECT"]),
  caption: z.string().optional(),
});

export type UploadFormValues = z.infer<typeof uploadSchema>;

interface GalleryUploadFormProps {
  isUploading: boolean;
  isDisabled: boolean;
  defaultCaption: string;
  onSubmit: (data: UploadFormValues & { file: File }) => void;
  onSubmitLink?: (data: { photoType: GalleryPhotoType; caption: string; url: string }) => void;
}

const photoTypes: GalleryPhotoType[] = ["BEFORE", "PROCESS", "AFTER", "DEFECT"];
const inputCls = "h-9 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 text-[12px] text-foreground outline-none focus:border-primary/30";

function humanizePhotoType(type: GalleryPhotoType): string {
  return type === "BEFORE" ? "Sebelum" : type === "AFTER" ? "Sesudah" : type === "DEFECT" ? "Temuan" : "Proses";
}

export function GalleryUploadForm({ isUploading, isDisabled, defaultCaption, onSubmit, onSubmitLink }: GalleryUploadFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
  const { register, handleSubmit, watch, reset } = useForm<UploadFormValues>({
    resolver: zodResolver(uploadSchema),
    defaultValues: { photoType: "PROCESS", caption: defaultCaption },
  });

  function close() {
    if (isUploading) return;
    setIsOpen(false);
    setSelectedFile(null);
    setLinkUrl("");
    setLinkError(null);
    reset({ photoType: "PROCESS", caption: defaultCaption });
  }

  function submitFile(values: UploadFormValues) {
    if (!selectedFile) return;
    onSubmit({ ...values, file: selectedFile });
    setIsOpen(false);
    setSelectedFile(null);
  }

  function submitDriveLink() {
    const parsed = URL.canParse(linkUrl.trim()) ? new URL(linkUrl.trim()) : null;
    if (!parsed || parsed.protocol !== "https:" || !["drive.google.com", "docs.google.com"].includes(parsed.hostname.toLowerCase())) {
      setLinkError("Masukkan link Google Drive yang valid.");
      return;
    }
    onSubmitLink?.({ photoType: watch("photoType"), caption: watch("caption") ?? "", url: parsed.toString() });
    setIsOpen(false);
    setLinkUrl("");
    setLinkError(null);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        disabled={isDisabled}
        title={isDisabled ? "Media sudah masuk Rekapan dan tidak dapat diubah." : undefined}
        className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-[12px] font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Upload className="h-4 w-4" />
        Tambah Media
      </button>
      {isDisabled ? <p className="mt-2 text-[11px] text-foreground/40">Media sudah masuk Rekapan sehingga tidak dapat ditambah lagi.</p> : null}

      {isOpen ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
          <div role="dialog" aria-modal="true" aria-labelledby="gallery-upload-title" className="w-full max-w-xl overflow-hidden border border-border bg-card shadow-2xl dark:border-white/[0.08]">
            <div className="flex items-center justify-between border-b border-border px-4 py-3 dark:border-white/[0.06]">
              <div>
                <h3 id="gallery-upload-title" className="text-[14px] font-semibold text-foreground">Tambah Media</h3>
                <p className="mt-0.5 text-[11px] text-muted-foreground">Upload file atau tempel link Google Drive.</p>
              </div>
              <button type="button" onClick={close} disabled={isUploading} aria-label="Tutup" className="p-2 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>

            <form onSubmit={handleSubmit(submitFile)} className="space-y-4 p-4">
              <div className="grid gap-3 sm:grid-cols-[140px_minmax(0,1fr)]">
                <select {...register("photoType")} className={inputCls} disabled={isUploading}>
                  {photoTypes.map((type) => <option key={type} value={type}>{humanizePhotoType(type)}</option>)}
                </select>
                <input {...register("caption")} className={inputCls} placeholder="Keterangan (opsional)" disabled={isUploading} />
              </div>

              <input ref={fileInputRef} type="file" accept={onSubmitLink ? "image/jpeg,image/png,image/webp,video/mp4" : "image/*"} className="hidden" onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)} />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }}
                onDragOver={(event) => event.preventDefault()}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(event) => { event.preventDefault(); setIsDragging(false); setSelectedFile(event.dataTransfer.files[0] ?? null); }}
                className={`flex min-h-36 w-full flex-col items-center justify-center gap-2 border border-dashed p-5 text-center transition-colors ${isDragging ? "border-primary bg-primary/10" : "border-border bg-background/40 hover:border-primary/50 dark:border-white/[0.12]"}`}
              >
                <FileUp className="h-7 w-7 text-app-accent-ink" />
                <span className="text-[13px] text-foreground">{selectedFile ? selectedFile.name : "Klik atau tarik file ke sini"}</span>
                <span className="text-[11px] text-muted-foreground">JPG/PNG/WEBP maks. 10 MB · MP4 maks. 25 MB</span>
              </button>
              <button type="submit" disabled={!selectedFile || isUploading} className="h-9 w-full rounded-lg bg-primary px-4 text-[12px] font-semibold text-primary-foreground disabled:opacity-40">
                {isUploading ? "Mengunggah..." : "Upload File"}
              </button>

              {onSubmitLink ? (
                <div className="space-y-2 border-t border-border pt-4 dark:border-white/[0.06]">
                  <div className="flex items-center gap-2 text-[12px] text-foreground/60"><Link2 className="h-4 w-4" /> Atau tempel link Google Drive</div>
                  <div className="flex gap-2">
                    <input type="url" value={linkUrl} onChange={(event) => { setLinkUrl(event.target.value); setLinkError(null); }} placeholder="https://drive.google.com/..." className={`${inputCls} min-w-0 flex-1`} disabled={isUploading} />
                    <button type="button" onClick={submitDriveLink} disabled={!linkUrl.trim() || isUploading} className="rounded-lg border border-border px-4 text-[12px] text-foreground disabled:opacity-40 dark:border-white/[0.08]">Simpan Link</button>
                  </div>
                  {linkError ? <p className="text-[11px] text-destructive">{linkError}</p> : null}
                </div>
              ) : null}
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
