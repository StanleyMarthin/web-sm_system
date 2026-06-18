"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, PackagePlus, Pencil } from "lucide-react";

const locationSchema = z.object({
  storageLocationId: z.number().nullable(),
  locationType: z.enum(["GUDANG", "WORKSHOP", "UNIT"]),
  label: z.string().min(1, "Label wajib diisi"),
  zone: z.string().optional(),
  rack: z.string().optional(),
  shelf: z.string().optional(),
  isActive: z.boolean(),
});

export type LocationFormValues = z.infer<typeof locationSchema>;

interface WarehouseLocationFormProps {
  initialValues?: LocationFormValues | null;
  isPending: boolean;
  onSubmit: (data: LocationFormValues) => void;
}

export function WarehouseLocationForm({ initialValues, isPending, onSubmit }: WarehouseLocationFormProps) {
  const isEditing = initialValues?.storageLocationId != null;

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<LocationFormValues>({
    resolver: zodResolver(locationSchema),
    defaultValues: initialValues || {
      storageLocationId: null,
      locationType: "GUDANG",
      label: "",
      zone: "",
      rack: "",
      shelf: "",
      isActive: true,
    },
    mode: "onChange",
  });

  const inputCls =
    "h-9 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 text-[12px] text-foreground outline-none transition-colors focus:border-primary/30 [color-scheme:dark]";

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm text-foreground/75">
          <span>Tipe lokasi</span>
          <select {...register("locationType")} className={inputCls}>
            <option value="GUDANG">Gudang</option>
            <option value="WORKSHOP">Workshop</option>
            <option value="UNIT">Unit</option>
          </select>
          {errors.locationType && <span className="text-xs text-destructive">{errors.locationType.message}</span>}
        </label>
        
        <label className="grid gap-2 text-sm text-foreground/75">
          <span>Label</span>
          <input {...register("label")} className={inputCls} />
          {errors.label && <span className="text-xs text-destructive">{errors.label.message}</span>}
        </label>
        
        <label className="grid gap-2 text-sm text-foreground/75">
          <span>Zona</span>
          <input {...register("zone")} className={inputCls} />
        </label>
        
        <label className="grid gap-2 text-sm text-foreground/75">
          <span>Rak</span>
          <input {...register("rack")} className={inputCls} />
        </label>
        
        <label className="grid gap-2 text-sm text-foreground/75">
          <span>Shelf</span>
          <input {...register("shelf")} className={inputCls} />
        </label>
        
        <label className="flex h-9 items-center gap-2 self-end rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-foreground/75">
          <input type="checkbox" {...register("isActive")} />
          Aktif
        </label>
      </div>
      
      <div className="mt-5 flex justify-end">
        <button
          type="submit"
          disabled={isPending || !isValid}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary-foreground disabled:opacity-50"
        >
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : isEditing ? <Pencil className="h-3.5 w-3.5" /> : <PackagePlus className="h-3.5 w-3.5" />}
          {isPending ? "Menyimpan..." : isEditing ? "Simpan Perubahan" : "Simpan Lokasi"}
        </button>
      </div>
    </form>
  );
}
