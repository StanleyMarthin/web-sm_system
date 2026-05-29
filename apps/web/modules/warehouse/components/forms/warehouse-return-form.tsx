"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTransition } from "react";
import { CheckCheck, Loader2 } from "lucide-react";

const returnSchema = z.object({
  qtyReturned: z.string().min(1, "Wajib diisi"),
  itemCondition: z.enum(["GOOD", "DAMAGED", "SCRAP"]),
  notes: z.string().optional(),
});

export type ReturnFormValues = z.infer<typeof returnSchema>;

interface WarehouseReturnFormProps {
  initialValues: { qtyReturned: string; itemCondition?: "GOOD" | "DAMAGED" | "SCRAP" | null; notes?: string | null } | null;
  isPending: boolean;
  onSubmit: (data: ReturnFormValues) => void;
}

export function WarehouseReturnForm({ initialValues, isPending, onSubmit }: WarehouseReturnFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<ReturnFormValues>({
    resolver: zodResolver(returnSchema),
    defaultValues: {
      qtyReturned: initialValues?.qtyReturned ?? "1",
      itemCondition: initialValues?.itemCondition ?? "GOOD",
      notes: initialValues?.notes ?? "",
    },
    mode: "onChange",
  });

  const inputCls =
    "h-9 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 text-[12px] text-white outline-none transition-colors focus:border-amber-500/30 [color-scheme:dark]";

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm text-white/75">
          <span>Qty kembali</span>
          <input {...register("qtyReturned")} className={inputCls} />
          {errors.qtyReturned && <span className="text-xs text-red-400">{errors.qtyReturned.message}</span>}
        </label>
        
        <label className="grid gap-2 text-sm text-white/75">
          <span>Kondisi</span>
          <select {...register("itemCondition")} className={inputCls}>
            <option value="GOOD">Baik</option>
            <option value="DAMAGED">Rusak</option>
            <option value="SCRAP">Afkir</option>
          </select>
          {errors.itemCondition && <span className="text-xs text-red-400">{errors.itemCondition.message}</span>}
        </label>
        
        <label className="grid gap-2 text-sm text-white/75 md:col-span-2">
          <span>Catatan</span>
          <textarea
            {...register("notes")}
            className="min-h-24 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white outline-none focus:border-amber-500/30"
          />
        </label>
      </div>
      
      <div className="mt-5 flex justify-end">
        <button
          type="submit"
          disabled={isPending || !isValid}
          className="inline-flex items-center gap-2 rounded-full bg-amber-500 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-black disabled:opacity-50"
        >
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
          {isPending ? "Menyimpan..." : "Simpan pengembalian"}
        </button>
      </div>
    </form>
  );
}
