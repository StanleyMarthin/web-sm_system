"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, PackagePlus, Pencil } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

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

const inputCls =
  "h-9 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 text-[12px] text-foreground outline-none transition-colors focus:border-primary/30 [color-scheme:dark]";

const darkSelectStyle = {
  backgroundColor: "var(--card)",
  color: "var(--card-foreground)",
} as const;

export function WarehouseItemForm({
  initialValues,
  isPending,
  onSubmit,
}: WarehouseItemFormProps) {
  const isEditing = initialValues?.itemId != null;
  const {
    register,
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

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm text-foreground/75">
          <span>Kategori</span>
          <select {...register("itemCategory")} className={inputCls} style={darkSelectStyle}>
            <option value="BAHAN" style={darkSelectStyle}>Bahan</option>
            <option value="TOOLS" style={darkSelectStyle}>Tools</option>
          </select>
        </label>

        <label className="grid gap-2 text-sm text-foreground/75">
          <span>Kode</span>
          <input {...register("itemCode")} className={inputCls} />
        </label>

        <label className="grid gap-2 text-sm text-foreground/75 md:col-span-2">
          <span>Nama barang</span>
          <input {...register("itemName")} className={inputCls} />
          {errors.itemName ? <span className="text-xs text-destructive">{errors.itemName.message}</span> : null}
        </label>

        <label className="grid gap-2 text-sm text-foreground/75">
          <span>Satuan</span>
          <input {...register("uom")} className={inputCls} />
        </label>

        <label className="flex h-9 items-center gap-2 self-end rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-foreground/75">
          <input type="checkbox" {...register("isActive")} />
          Aktif
        </label>

        <label className="grid gap-2 text-sm text-foreground/75 md:col-span-2">
          <span>Keterangan</span>
          <input {...register("description")} className={inputCls} />
        </label>
      </div>

      <div className="mt-5 flex justify-end">
        <button
          type="submit"
          disabled={isPending || !isValid}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary-foreground disabled:opacity-50"
        >
          {isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : isEditing ? (
            <Pencil className="h-3.5 w-3.5" />
          ) : (
            <PackagePlus className="h-3.5 w-3.5" />
          )}
          {isEditing ? "Simpan barang" : "Tambah barang"}
        </button>
      </div>
    </form>
  );
}
