"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { GalleryPhotoType } from "@smsystem/contracts/gallery";

const uploadSchema = z.object({
  photoType: z.enum(["BEFORE", "PROCESS", "AFTER", "DEFECT"]),
  caption: z.string().optional(),
  fileList: z.any().optional(),
});

export type UploadFormValues = z.infer<typeof uploadSchema>;

interface GalleryUploadFormProps {
  isUploading: boolean;
  isDisabled: boolean;
  defaultCaption: string;
  onSubmit: (data: UploadFormValues & { file: File }) => void;
}

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

const inputCls =
  "h-9 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 text-[12px] text-foreground outline-none transition-colors focus:border-primary/30 [color-scheme:dark]";

export function GalleryUploadForm({ isUploading, isDisabled, defaultCaption, onSubmit }: GalleryUploadFormProps) {
  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<UploadFormValues>({
    resolver: zodResolver(uploadSchema),
    defaultValues: {
      photoType: "PROCESS",
      caption: defaultCaption,
    },
    mode: "onChange",
  });

  const fileList = watch("fileList");
  const hasFile = fileList && fileList.length > 0;

  const handleFormSubmit = (data: UploadFormValues) => {
    if (!hasFile) return;
    onSubmit({ ...data, file: data.fileList[0] });
    reset({ photoType: "PROCESS", caption: defaultCaption, fileList: undefined });
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="mt-4 grid gap-3 md:grid-cols-[180px_minmax(0,1fr)_minmax(0,1fr)_auto]">
      <select
        {...register("photoType")}
        className={inputCls}
        disabled={isDisabled || isUploading}
      >
        {photoTypes.map((photoType) => (
          <option key={photoType} value={photoType}>
            {humanizePhotoType(photoType)}
          </option>
        ))}
      </select>
      <input
        type="text"
        {...register("caption")}
        placeholder="Keterangan foto (opsional)"
        className={inputCls}
        disabled={isDisabled || isUploading}
      />
      <input
        type="file"
        accept="image/*"
        {...register("fileList")}
        className={`${inputCls} py-1.5`}
        disabled={isDisabled || isUploading}
      />
      <button
        type="submit"
        disabled={!hasFile || isDisabled || isUploading}
        className="rounded-lg bg-primary px-4 py-2 text-[12px] font-semibold text-primary-foreground hover:bg-primary disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isUploading ? "Mengirim..." : "Tambah Foto"}
      </button>
    </form>
  );
}
