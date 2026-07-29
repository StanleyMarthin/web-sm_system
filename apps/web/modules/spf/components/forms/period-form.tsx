"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { mutateSpf } from "@/shared/api/spf";
import type { SpfPeriod } from "@/shared/api/spf-contracts";
import {
  ActionButton,
  CompactInput,
  CompactTextarea,
  FieldLabel,
  Toast,
} from "@/shared/ui/compact";
import { useSweetAlert } from "@/shared/ui/sweet-alert";

// ─── Form schema ──────────────────────────────────────────────────────────────
const periodFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Judul wajib diisi")
    .max(255, "Judul maksimal 255 karakter"),
  description: z
    .string()
    .trim()
    .max(5000, "Deskripsi maksimal 5000 karakter")
    .optional()
    .or(z.literal("")),
  date_start: z.string().optional().or(z.literal("")),
  date_end: z.string().optional().or(z.literal("")),
  division: z.string().optional().or(z.literal("")),
  attach_item_ids_raw: z
    .string()
    .optional()
    .or(z.literal("")),
});

type PeriodFormValues = z.infer<typeof periodFormSchema>;

// ─── Helper: parse comma-separated IDs ───────────────────────────────────────
function parseItemIds(raw: string | undefined): number[] | undefined {
  if (!raw || raw.trim() === "") return undefined;
  const ids = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => Number.parseInt(s, 10))
    .filter((n) => n > 0);
  return ids.length > 0 ? ids : undefined;
}

// ─── Props ────────────────────────────────────────────────────────────────────
type PeriodFormProps =
  | {
      mode: "CREATE";
      period?: undefined;
      onClose?: () => void;
      onSuccess?: (message: string) => void;
      onError?: (message: string) => void;
    }
  | {
      mode: "UPDATE";
      period: Readonly<SpfPeriod>;
      onClose?: () => void;
      onSuccess?: (message: string) => void;
      onError?: (message: string) => void;
    };

// ─── PeriodForm ───────────────────────────────────────────────────────────────
export function PeriodForm(props: PeriodFormProps) {
  const { mode, onClose, onSuccess, onError } = props;
  const period = props.mode === "UPDATE" ? props.period : undefined;

  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const { alertElement, confirm, notifySuccess, notifyError } = useSweetAlert();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PeriodFormValues>({
    resolver: zodResolver(periodFormSchema),
    defaultValues: {
      title: period?.title ?? "",
      description: period?.description ?? "",
      date_start: "",
      date_end: "",
      division: "",
      attach_item_ids_raw: "",
    },
  });

  async function handleDeletePeriod() {
    if (!period) return;

    const confirmed = await confirm({
      title: `Hapus Periode #${period.id}`,
      description: "Apakah kamu ingin menghapus draft ini?",
      tone: "warning",
      confirmLabel: "Ya, Hapus",
      cancelLabel: "Batal",
    });

    if (!confirmed) return;

    startTransition(async () => {
      const result = await mutateSpf("period", {
        mode: "DELETE",
        period_id: period.id,
      });

      if (!result.success) {
        const msg = result.message ?? "Gagal menghapus periode.";
        setServerError(msg);
        onError?.(msg);
        return;
      }

      notifySuccess("Berhasil", "Draft periode berhasil dihapus.");
      onClose?.();
      onSuccess?.("Draft periode berhasil dihapus.");
      router.replace("/spf/periods");
      router.refresh();
    });
  }

  function onSubmit(values: PeriodFormValues) {
    setServerError(null);
    const itemIds = parseItemIds(values.attach_item_ids_raw);

    if (mode === "CREATE") {
      startTransition(async () => {
        const result = await mutateSpf("period", {
          mode: "CREATE",
          title: values.title,
          ...(values.description ? { description: values.description } : {}),
          ...(itemIds ? { attach_item_ids: itemIds } : {}),
        });

        if (!result.success) {
          const msg = result.message ?? "Gagal membuat periode.";
          setServerError(msg);
          onError?.(msg);
          return;
        }

        const msg = "Periode berhasil dibuat.";
        onSuccess?.(msg);
        onClose?.();
        router.refresh();
      });
      return;
    }

    // ── UPDATE ────────────────────────────────────────────────────────────────
    if (!period) return;

    const trimmedTitle = values.title.trim();
    const trimmedDesc = values.description?.trim() ?? "";

    const changedTitle =
      trimmedTitle !== period.title.trim() ? trimmedTitle : undefined;
    const changedDesc =
      trimmedDesc !== (period.description?.trim() ?? "")
        ? trimmedDesc
        : undefined;

    const hasChangedTitle = changedTitle !== undefined;
    const hasChangedDesc = changedDesc !== undefined;
    const hasItemIds = itemIds !== undefined && itemIds.length > 0;
    const hasDateFilter = Boolean(values.date_start || values.date_end);
    const hasDivision = Boolean(values.division);

    if (!hasChangedTitle && !hasChangedDesc && !hasItemIds && !hasDateFilter && !hasDivision) {
      setServerError("Tidak ada perubahan yang terdeteksi.");
      return;
    }

    startTransition(async () => {
      const result = await mutateSpf("period", {
        mode: "UPDATE",
        period_id: period.id,
        ...(hasChangedTitle ? { title: changedTitle! } : {}),
        ...(hasChangedDesc ? { description: changedDesc! } : {}),
        ...(hasItemIds ? { attach_item_ids: itemIds! } : {}),
      });

      if (!result.success) {
        const msg = result.message ?? "Gagal memperbarui periode.";
        setServerError(msg);
        onError?.(msg);
        return;
      }

      const msg = "Periode berhasil diperbarui.";
      onSuccess?.(msg);
      onClose?.();
      router.refresh();
    });
  }

  const isCreate = mode === "CREATE";

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      {alertElement}

      {/* Title */}
      <div>
        <FieldLabel required>Judul Periode</FieldLabel>
        <CompactInput
          id="period-title"
          type="text"
          placeholder="Maks. 255 karakter"
          aria-describedby={errors.title ? "period-title-err" : undefined}
          disabled={isPending}
          {...register("title")}
        />
        {errors.title && (
          <p id="period-title-err" className="mt-1 text-[12px] text-destructive">
            {errors.title.message}
          </p>
        )}
      </div>

      {/* Description */}
      <div>
        <FieldLabel>Deskripsi (opsional)</FieldLabel>
        <CompactTextarea
          id="period-description"
          rows={4}
          placeholder="Maks. 5000 karakter"
          aria-describedby={
            errors.description ? "period-description-err" : undefined
          }
          disabled={isPending}
          {...register("description")}
        />
        {errors.description && (
          <p
            id="period-description-err"
            className="mt-1 text-[12px] text-destructive"
          >
            {errors.description.message}
          </p>
        )}
      </div>

      {/* Date Filter Range (Filter Tanggal & Bulan) */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <FieldLabel>Filter Tanggal Mulai</FieldLabel>
          <CompactInput
            id="period-date-start"
            type="date"
            disabled={isPending}
            {...register("date_start")}
          />
        </div>
        <div>
          <FieldLabel>Filter Tanggal Selesai</FieldLabel>
          <CompactInput
            id="period-date-end"
            type="date"
            disabled={isPending}
            {...register("date_end")}
          />
        </div>
      </div>

      {/* Pilih Divisi */}
      <div>
        <FieldLabel>Pilih Divisi Pekerjaan</FieldLabel>
        <select
          id="period-division"
          disabled={isPending}
          className="w-full rounded border border-border bg-background px-3 py-2 text-[13px] font-medium text-foreground transition-colors focus:border-primary focus:outline-none dark:border-white/[0.1] dark:bg-popover"
          {...register("division")}
        >
          <option value="">Semua Divisi</option>
          <option value="BODYWORK">Bodywork</option>
          <option value="PAINTING">Paintwork / Painting</option>
          <option value="ENGINE">Engine & Mechanical</option>
          <option value="INTERIOR">Interior & Trim</option>
          <option value="ELEKTRIKAL">Elektrikal & Wiring</option>
        </select>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Pilih divisi pekerjaan yang akan difokuskan dalam periode progress ini.
        </p>
      </div>

      {/* Server error — dialog tetap terbuka saat ada error */}
      <Toast message={serverError} variant="err" />

      {/* Action buttons */}
      <div className="flex items-center justify-between border-t border-border pt-4 dark:border-white/[0.05]">
        {mode === "UPDATE" && period ? (
          <ActionButton
            type="button"
            variant="danger"
            disabled={isPending}
            onClick={handleDeletePeriod}
          >
            Hapus Draft
          </ActionButton>
        ) : (
          <div />
        )}

        <div className="flex items-center gap-2">
          {onClose && (
            <ActionButton
              type="button"
              variant="default"
              disabled={isPending}
              onClick={onClose}
            >
              Batal
            </ActionButton>
          )}
          <ActionButton
            type="submit"
            variant="primary"
            disabled={isPending}
          >
            {isPending
              ? "Menyimpan…"
              : isCreate
                ? "Buat Periode"
                : "Simpan Perubahan"}
          </ActionButton>
        </div>
      </div>
    </form>
  );
}
