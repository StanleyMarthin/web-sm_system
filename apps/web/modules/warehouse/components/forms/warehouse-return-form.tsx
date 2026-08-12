"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTransition } from "react";
import { CheckCheck, Loader2 } from "lucide-react";
import { ActionButton, CompactInput, CompactSelect, CompactTextarea, FieldLabel } from "@/shared/ui/compact";

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
    watch,
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
  const itemCondition = watch("itemCondition");

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <label><FieldLabel required>Qty kembali</FieldLabel><CompactInput {...register("qtyReturned")} />
          {errors.qtyReturned && <span className="text-xs text-destructive">{errors.qtyReturned.message}</span>}
        </label>
        
        <label className="grid gap-2 text-sm text-foreground/75">
          <FieldLabel>Kondisi</FieldLabel><CompactSelect {...register("itemCondition")} value={itemCondition}>
            <option value="GOOD">Baik</option>
            <option value="DAMAGED">Rusak</option>
            <option value="SCRAP">Afkir</option>
          </CompactSelect>
          {errors.itemCondition && <span className="text-xs text-destructive">{errors.itemCondition.message}</span>}
        </label>
        
        <label className="grid gap-2 text-sm text-foreground/75 md:col-span-2">
          <FieldLabel>Catatan</FieldLabel><CompactTextarea
            {...register("notes")}
            rows={3}
          />
        </label>
      </div>
      
      <div className="mt-5 flex justify-end">
        <ActionButton variant="success"
          type="submit"
          disabled={isPending || !isValid}
        >
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
          {isPending ? "Menyimpan..." : "Simpan pengembalian"}
        </ActionButton>
      </div>
    </form>
  );
}
