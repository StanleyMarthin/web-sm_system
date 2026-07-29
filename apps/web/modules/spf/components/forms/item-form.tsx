"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { mutateSpf } from "@/shared/api/spf";
import type { SpfItem } from "@/shared/api/spf-contracts";
import {
  ActionButton,
  CompactInput,
  CompactTextarea,
  FieldLabel,
  Toast,
} from "@/shared/ui/compact";
import { useState } from "react";

// ─── Form schemas ────────────────────────────────────────────────────────────
// Batas sama persis dengan backend: positive car_id, 1..5000 desc, 1..100 work_type.
const createSchema = z.object({
  car_id: z
    .string()
    .trim()
    .min(1, "Nama mobil wajib diisi"),
  description: z
    .string()
    .trim()
    .min(1, "Deskripsi wajib diisi")
    .max(5000, "Deskripsi maksimal 5000 karakter"),
  work_type: z
    .string()
    .trim()
    .min(1, "Jenis pekerjaan wajib diisi")
    .max(100, "Jenis pekerjaan maksimal 100 karakter"),
});

const updateSchema = z.object({
  description: z
    .string()
    .trim()
    .min(1, "Deskripsi tidak boleh kosong jika diisi")
    .max(5000, "Deskripsi maksimal 5000 karakter")
    .optional()
    .or(z.literal("")),
  work_type: z
    .string()
    .trim()
    .min(1, "Jenis pekerjaan tidak boleh kosong jika diisi")
    .max(100, "Jenis pekerjaan maksimal 100 karakter")
    .optional()
    .or(z.literal("")),
});

type CreateValues = z.infer<typeof createSchema>;
type UpdateValues = z.infer<typeof updateSchema>;

// ─── Props ───────────────────────────────────────────────────────────────────
type ItemFormProps =
  | {
      mode: "CREATE";
      item?: undefined;
      onSuccess?: () => void;
      onError?: (message: string) => void;
    }
  | {
      mode: "UPDATE";
      item: Readonly<SpfItem>;
      onSuccess?: () => void;
      onError?: (message: string) => void;
    };

// ─── CREATE form ──────────────────────────────────────────────────────────────
function ItemCreateForm({
  onSuccess,
  onError,
}: {
  onSuccess?: () => void;
  onError?: (message: string) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverSuccess, setServerSuccess] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setFocus,
    formState: { errors },
  } = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { car_id: "", description: "", work_type: "" },
  });

  function onSubmit(values: CreateValues) {
    setServerError(null);
    setServerSuccess(null);

    startTransition(async () => {
      const parsedCarId = /^\d+$/.test(values.car_id.trim())
        ? Number.parseInt(values.car_id.trim(), 10)
        : (values.car_id.trim() as unknown as number);

      const result = await mutateSpf("item", {
        mode: "CREATE",
        car_id: parsedCarId,
        description: values.description,
        work_type: values.work_type,
      });

      if (!result.success) {
        const msg = result.message ?? "Gagal membuat item.";
        setServerError(msg);
        onError?.(msg);
        return;
      }

      setServerSuccess("Item berhasil dibuat.");
      onSuccess?.();
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      {/* Nama Mobil */}
      <div>
        <FieldLabel required>Nama Mobil</FieldLabel>
        <CompactInput
          id="item-car-id"
          type="text"
          placeholder="Contoh: PORSCHE930_ADRIAN"
          aria-describedby={errors.car_id ? "item-car-id-err" : undefined}
          {...register("car_id")}
        />
        {errors.car_id && (
          <p id="item-car-id-err" className="mt-1 text-[12px] text-destructive">
            {errors.car_id.message}
          </p>
        )}
      </div>

      {/* Work Type */}
      <div>
        <FieldLabel required>Jenis Pekerjaan</FieldLabel>
        <CompactInput
          id="item-work-type"
          type="text"
          placeholder="Maks. 100 karakter"
          aria-describedby={errors.work_type ? "item-work-type-err" : undefined}
          {...register("work_type")}
        />
        {errors.work_type && (
          <p id="item-work-type-err" className="mt-1 text-[12px] text-destructive">
            {errors.work_type.message}
          </p>
        )}
      </div>

      {/* Description */}
      <div>
        <FieldLabel required>Deskripsi</FieldLabel>
        <CompactTextarea
          id="item-description"
          rows={5}
          placeholder="Maks. 5000 karakter"
          aria-describedby={
            errors.description ? "item-description-err" : undefined
          }
          {...register("description")}
        />
        {errors.description && (
          <p
            id="item-description-err"
            className="mt-1 text-[12px] text-destructive"
          >
            {errors.description.message}
          </p>
        )}
      </div>

      {/* Feedback */}
      <Toast message={serverError} variant="err" />
      <Toast message={serverSuccess} variant="ok" />

      {/* Submit */}
      <div className="flex justify-end">
        <ActionButton
          type="submit"
          variant="primary"
          disabled={isPending}
        >
          {isPending ? "Menyimpan…" : "Buat Item"}
        </ActionButton>
      </div>
    </form>
  );
}

// ─── UPDATE form ──────────────────────────────────────────────────────────────
function ItemUpdateForm({
  item,
  onSuccess,
  onError,
}: {
  item: Readonly<SpfItem>;
  onSuccess?: () => void;
  onError?: (message: string) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverSuccess, setServerSuccess] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UpdateValues>({
    resolver: zodResolver(updateSchema),
    defaultValues: {
      description: item.description,
      work_type: item.work_type,
    },
  });

  function onSubmit(values: UpdateValues) {
    setServerError(null);
    setServerSuccess(null);

    // Delta update: hanya kirim field yang benar-benar berubah.
    const trimmedDesc = values.description?.trim() ?? "";
    const trimmedWork = values.work_type?.trim() ?? "";
    const changedDesc =
      trimmedDesc !== item.description.trim() ? trimmedDesc : undefined;
    const changedWork =
      trimmedWork !== item.work_type.trim() ? trimmedWork : undefined;

    // No-op guard: tidak ada yang berubah → blokir di client.
    if (changedDesc === undefined && changedWork === undefined) {
      setServerError("Tidak ada perubahan yang terdeteksi.");
      return;
    }

    startTransition(async () => {
      const result = await mutateSpf("item", {
        mode: "UPDATE",
        item_id: item.id,
        ...(changedDesc !== undefined ? { description: changedDesc } : {}),
        ...(changedWork !== undefined ? { work_type: changedWork } : {}),
      });

      if (!result.success) {
        const msg = result.message ?? "Gagal memperbarui item.";
        setServerError(msg);
        onError?.(msg);
        return;
      }

      setServerSuccess("Item berhasil diperbarui.");
      onSuccess?.();
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      {/* Work Type */}
      <div>
        <FieldLabel>Jenis Pekerjaan</FieldLabel>
        <CompactInput
          id="item-update-work-type"
          type="text"
          placeholder="Maks. 100 karakter"
          aria-describedby={
            errors.work_type ? "item-update-work-type-err" : undefined
          }
          {...register("work_type")}
        />
        {errors.work_type && (
          <p
            id="item-update-work-type-err"
            className="mt-1 text-[12px] text-destructive"
          >
            {errors.work_type.message}
          </p>
        )}
      </div>

      {/* Description */}
      <div>
        <FieldLabel>Deskripsi</FieldLabel>
        <CompactTextarea
          id="item-update-description"
          rows={5}
          placeholder="Maks. 5000 karakter"
          aria-describedby={
            errors.description ? "item-update-description-err" : undefined
          }
          {...register("description")}
        />
        {errors.description && (
          <p
            id="item-update-description-err"
            className="mt-1 text-[12px] text-destructive"
          >
            {errors.description.message}
          </p>
        )}
      </div>

      {/* Feedback */}
      <Toast message={serverError} variant="err" />
      <Toast message={serverSuccess} variant="ok" />

      {/* Submit */}
      <div className="flex justify-end">
        <ActionButton
          type="submit"
          variant="primary"
          disabled={isPending}
        >
          {isPending ? "Menyimpan…" : "Simpan Perubahan"}
        </ActionButton>
      </div>
    </form>
  );
}

// ─── Public export: ItemForm (mode switch) ────────────────────────────────────
export function ItemForm(props: ItemFormProps) {
  if (props.mode === "CREATE") {
    return (
      <ItemCreateForm
        onSuccess={props.onSuccess}
        onError={props.onError}
      />
    );
  }
  return (
    <ItemUpdateForm
      item={props.item}
      onSuccess={props.onSuccess}
      onError={props.onError}
    />
  );
}
