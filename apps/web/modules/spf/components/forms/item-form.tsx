"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { mutateSpf } from "@/shared/api/spf";
import type { SpfItem } from "@/shared/api/spf-contracts";
import { ActionButton, CompactInput, CompactTextarea, FieldLabel, Toast } from "@/shared/ui/compact";

const manualJobdescSchema = z.object({
  car_id: z.string().trim().min(1, "Unit wajib diisi"),
  period_id: z.string().trim().optional(),
  panel_id: z.string().trim().optional(),
  panel_name: z.string().trim().max(255).optional().or(z.literal("")),
  customer_description: z.string().trim().min(1, "Deskripsi customer wajib diisi").max(5000),
  original_description: z.string().trim().max(5000).optional().or(z.literal("")),
  work_status: z.string().trim().min(1, "Status pekerjaan wajib diisi").max(100),
  progress: z.coerce.number().min(0, "Progress minimal 0").max(100, "Progress maksimal 100"),
  divisi: z.string().trim().max(100).optional().or(z.literal("")),
  pic: z.string().trim().max(255).optional().or(z.literal("")),
  work_date: z.string().optional(),
  display_order: z.coerce.number().int().min(0).optional(),
});

type ManualJobdescValues = z.infer<typeof manualJobdescSchema>;

type ItemFormProps =
  | {
      mode: "CREATE";
      item?: undefined;
      carId?: string;
      periodId?: string;
      onClose?: () => void;
      onSuccess?: () => void;
      onError?: (message: string) => void;
    }
  | {
      mode: "UPDATE";
      item: Readonly<SpfItem>;
      carId?: string;
      periodId?: string;
      onClose?: () => void;
      onSuccess?: () => void;
      onError?: (message: string) => void;
    };

export function ManualJobdescForm(props: ItemFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverSuccess, setServerSuccess] = useState<string | null>(null);
  const item = props.mode === "UPDATE" ? props.item : undefined;
  const lockedCarId = props.carId ?? item?.car_id ?? "";
  const periodId = props.periodId ?? item?.period_id ?? "";

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ManualJobdescValues>({
    resolver: zodResolver(manualJobdescSchema) as any,
    defaultValues: {
      car_id: lockedCarId,
      period_id: periodId ?? "",
      panel_id: item?.panel_id ?? "",
      panel_name: item?.panel_name ?? item?.panel ?? "",
      customer_description: item?.customer_description ?? "",
      original_description: item?.original_description ?? "",
      work_status: item?.work_status ?? "",
      progress: item?.progress ?? 0,
      divisi: item?.divisi ?? "",
      pic: item?.pic ?? "",
      work_date: item?.work_date ?? "",
      display_order: item?.display_order ?? 0,
    },
  });

  function onSubmit(values: ManualJobdescValues) {
    setServerError(null);
    setServerSuccess(null);
    startTransition(async () => {
      const payload = {
        car_id: values.car_id.trim(),
        period_id: values.period_id?.trim() || undefined,
        panel_id: values.panel_id?.trim() || undefined,
        panel_name: values.panel_name?.trim() || undefined,
        customer_description: values.customer_description.trim(),
        original_description: values.original_description?.trim() || undefined,
        work_status: values.work_status.trim(),
        progress: values.progress,
        divisi: values.divisi?.trim() || undefined,
        pic: values.pic?.trim() || undefined,
        work_date: values.work_date || undefined,
        display_order: values.display_order,
      };

      const result = await mutateSpf("item", props.mode === "CREATE"
        ? { mode: "CREATE", source_type: "MANUAL", ...payload }
        : { mode: "UPDATE", item_id: item!.id, ...payload });

      if (!result.success) {
        const message = result.status === 409 ? "Data telah berubah. Halaman akan diperbarui." : result.message;
        setServerError(message);
        props.onError?.(message);
        if (result.status === 409) router.refresh();
        return;
      }

      setServerSuccess(props.mode === "CREATE" ? "Item manual berhasil disimpan." : "Item manual berhasil diperbarui.");
      props.onSuccess?.();
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <FieldLabel required>car_id</FieldLabel>
          <CompactInput {...register("car_id")} disabled={Boolean(lockedCarId) || isPending} />
          {errors.car_id ? <p className="mt-1 text-[12px] text-destructive">{errors.car_id.message}</p> : null}
        </div>
        <div>
          <FieldLabel>Panel/Part</FieldLabel>
          <CompactInput placeholder="Nama panel/part bila panel_id belum ada" {...register("panel_name")} disabled={isPending} />
        </div>
      </div>

      <div>
        <FieldLabel required>Customer Description</FieldLabel>
        <CompactTextarea rows={4} {...register("customer_description")} disabled={isPending} />
        {errors.customer_description ? <p className="mt-1 text-[12px] text-destructive">{errors.customer_description.message}</p> : null}
      </div>

      <div>
        <FieldLabel>Original Description</FieldLabel>
        <CompactTextarea rows={3} {...register("original_description")} disabled={isPending} />
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div>
          <FieldLabel required>Work Status</FieldLabel>
          <CompactInput {...register("work_status")} disabled={isPending} />
          {errors.work_status ? <p className="mt-1 text-[12px] text-destructive">{errors.work_status.message}</p> : null}
        </div>
        <div>
          <FieldLabel required>Progress</FieldLabel>
          <CompactInput type="number" min={0} max={100} {...register("progress")} disabled={isPending} />
          {errors.progress ? <p className="mt-1 text-[12px] text-destructive">{errors.progress.message}</p> : null}
        </div>
        <div>
          <FieldLabel>Tanggal</FieldLabel>
          <CompactInput type="date" {...register("work_date")} disabled={isPending} />
        </div>
        <div>
          <FieldLabel>Urutan</FieldLabel>
          <CompactInput type="number" min={0} {...register("display_order")} disabled={isPending} />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <FieldLabel>Divisi</FieldLabel>
          <CompactInput {...register("divisi")} disabled={isPending} />
        </div>
        <div>
          <FieldLabel>PIC</FieldLabel>
          <CompactInput {...register("pic")} disabled={isPending} />
        </div>
      </div>

      <Toast message={serverError} variant="err" />
      <Toast message={serverSuccess} variant="ok" />

      <div className="flex justify-end gap-2 border-t border-border pt-4 dark:border-white/[0.05]">
        {props.onClose ? <ActionButton onClick={props.onClose} disabled={isPending}>Batal</ActionButton> : null}
        <ActionButton type="submit" variant="primary" disabled={isPending}>
          {isPending ? "Menyimpan..." : props.mode === "CREATE" ? "Simpan Manual" : "Simpan Perubahan"}
        </ActionButton>
      </div>
    </form>
  );
}

export function ItemForm(props: ItemFormProps) {
  return <ManualJobdescForm {...props} />;
}
