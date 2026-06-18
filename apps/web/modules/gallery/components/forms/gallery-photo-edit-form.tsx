"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { GalleryPhotoType } from "@smsystem/contracts/gallery";
import { Pencil } from "lucide-react";

const editSchema = z.object({
  photoType: z.enum(["BEFORE", "PROCESS", "AFTER", "DEFECT"]),
  caption: z.string().optional(),
});

export type EditFormValues = z.infer<typeof editSchema>;

interface GalleryPhotoEditFormProps {
  initialPhotoType: GalleryPhotoType;
  initialCaption: string;
  isBusy: boolean;
  onSave: (data: EditFormValues) => void;
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

export function GalleryPhotoEditForm({ initialPhotoType, initialCaption, isBusy, onSave }: GalleryPhotoEditFormProps) {
  const { register, handleSubmit } = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      photoType: initialPhotoType,
      caption: initialCaption,
    },
    mode: "onChange",
  });

  return (
    <form id="edit-photo-form" onSubmit={handleSubmit(onSave)} className="flex flex-col gap-2">
      <select {...register("photoType")} className={`${inputCls} w-full`}>
        {photoTypes.map((photoType) => (
          <option key={photoType} value={photoType}>
            {humanizePhotoType(photoType)}
          </option>
        ))}
      </select>
      <input
        type="text"
        {...register("caption")}
        placeholder="Keterangan foto"
        className={`${inputCls} w-full`}
      />
      <div className="mt-1">
        <button
          type="submit"
          disabled={isBusy}
          className="inline-flex items-center gap-1 rounded-full bg-primary/12 px-2.5 py-1 text-[11px] text-app-accent-ink ring-1 ring-primary/20 disabled:opacity-35"
        >
          <Pencil className="h-3 w-3" />
          Simpan
        </button>
      </div>
    </form>
  );
}
