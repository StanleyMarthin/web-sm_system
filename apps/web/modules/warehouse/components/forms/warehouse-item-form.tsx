"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, PackagePlus, Pencil } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ActionButton, CompactInput, CompactSelect, FieldLabel } from "@/shared/ui/compact";

const warehouseItemFormSchema = z.object({
  itemId: z.string().nullable(),
  itemCode: z.string().optional(),
  itemName: z.string().min(1, "Nama barang wajib diisi"),
  itemCategory: z.enum(["BAHAN", "TOOLS"]),
  uom: z.string().optional(),
  description: z.string().optional(),
  isActive: z.boolean(),
});

export type WarehouseItemFormValues = z.infer<typeof warehouseItemFormSchema>;

interface WarehouseItemFormProps {
  initialValues?: WarehouseItemFormValues | null;
  isPending: boolean;
  onSubmit: (data: WarehouseItemFormValues) => void;
}

export function WarehouseItemForm({
  initialValues,
  isPending,
  onSubmit,
}: WarehouseItemFormProps) {
  const isEditing = initialValues?.itemId != null;
  const {
    register,
    watch,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<WarehouseItemFormValues>({
    resolver: zodResolver(warehouseItemFormSchema),
    defaultValues: initialValues || {
      itemId: null,
      itemCode: "",
      itemName: "",
      itemCategory: "BAHAN",
      uom: "pcs",
      description: "",
      isActive: true,
    },
    mode: "onChange",
  });
  const itemCategory = watch("itemCategory");

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <label><FieldLabel>Kategori</FieldLabel><CompactSelect {...register("itemCategory")} value={itemCategory}>
          <option value="BAHAN">Bahan</option><option value="TOOLS">Tools</option>
        </CompactSelect></label>

        <label><FieldLabel>Kode</FieldLabel><CompactInput {...register("itemCode")} /></label>

        <label className="md:col-span-2"><FieldLabel required>Nama barang</FieldLabel><CompactInput {...register("itemName")} />
          {errors.itemName ? <span className="text-xs text-destructive">{errors.itemName.message}</span> : null}
        </label>

        <label><FieldLabel>Satuan</FieldLabel><CompactInput {...register("uom")} /></label>

        <label className="flex h-9 items-center gap-2 self-end rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-foreground/75">
          <input type="checkbox" {...register("isActive")} />
          Aktif
        </label>

        <label className="md:col-span-2"><FieldLabel>Keterangan</FieldLabel><CompactInput {...register("description")} /></label>
      </div>

      <div className="mt-5 flex justify-end">
        <ActionButton variant="success"
          type="submit"
          disabled={isPending || !isValid}
        >
          {isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : isEditing ? (
            <Pencil className="h-3.5 w-3.5" />
          ) : (
            <PackagePlus className="h-3.5 w-3.5" />
          )}
          {isEditing ? "Simpan barang" : "Tambah barang"}
        </ActionButton>
      </div>
    </form>
  );
}
