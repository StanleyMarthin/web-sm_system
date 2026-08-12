"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, PackagePlus, Pencil } from "lucide-react";
import { ActionButton, CompactInput, CompactSelect, FieldLabel } from "@/shared/ui/compact";

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
    watch,
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
  const locationType = watch("locationType");

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <label><FieldLabel>Tipe lokasi</FieldLabel><CompactSelect {...register("locationType")} value={locationType}>
            <option value="GUDANG">Gudang</option>
            <option value="WORKSHOP">Workshop</option>
            <option value="UNIT">Unit</option>
          </CompactSelect>
          {errors.locationType && <span className="text-xs text-destructive">{errors.locationType.message}</span>}
        </label>
        
        <label><FieldLabel required>Label</FieldLabel><CompactInput {...register("label")} />
          {errors.label && <span className="text-xs text-destructive">{errors.label.message}</span>}
        </label>
        
        <label className="grid gap-2 text-sm text-foreground/75">
          <FieldLabel>Zona</FieldLabel><CompactInput {...register("zone")} />
        </label>
        
        <label className="grid gap-2 text-sm text-foreground/75">
          <FieldLabel>Rak</FieldLabel><CompactInput {...register("rack")} />
        </label>
        
        <label className="grid gap-2 text-sm text-foreground/75">
          <FieldLabel>Shelf</FieldLabel><CompactInput {...register("shelf")} />
        </label>
        
        <label className="flex h-9 items-center gap-2 self-end rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-foreground/75">
          <input type="checkbox" {...register("isActive")} />
          Aktif
        </label>
      </div>
      
      <div className="mt-5 flex justify-end">
        <ActionButton variant="success"
          type="submit"
          disabled={isPending || !isValid}
        >
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : isEditing ? <Pencil className="h-3.5 w-3.5" /> : <PackagePlus className="h-3.5 w-3.5" />}
          {isPending ? "Menyimpan..." : isEditing ? "Simpan Perubahan" : "Simpan Lokasi"}
        </ActionButton>
      </div>
    </form>
  );
}
