"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { mutateSpf, uploadSpfItemMedia } from "@/shared/api/spf";
import type { SpfItem } from "@/shared/api/spf-contracts";
import { ActionButton, CompactInput, CompactTextarea, FieldLabel, Toast } from "@/shared/ui/compact";
import { Upload } from "lucide-react";

const manualJobdescSchema = z.object({
  car_id: z.string().trim().min(1, "Unit wajib diisi"),
  period_id: z.string().trim().optional(),
  customer_description: z.string().trim().min(1, "Isi laporan wajib diisi").max(5000),
  original_description: z.string().trim().max(5000).optional().or(z.literal("")),
  work_status: z.string().trim().min(1, "Status pekerjaan wajib diisi").max(100),
  progress: z.number().optional(),
  display_order: z.number().int().min(0).optional(),
});

type ManualJobdescValues = z.infer<typeof manualJobdescSchema>;

const WORK_STATUS_OPTIONS = ["PENDING", "ON_PROGRESS", "DONE", "REJECTED"] as const;
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "video/mp4"];
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 25 * 1024 * 1024;
const PROGRESS_BY_STATUS: Record<string, number> = {
  PENDING: 0,
  ON_PROGRESS: 50,
  DONE: 100,
  REJECTED: 0,
};

function workStatusOptions(current?: string) {
  const values = [...WORK_STATUS_OPTIONS];
  if (current && !values.includes(current as (typeof WORK_STATUS_OPTIONS)[number])) values.push(current as (typeof WORK_STATUS_OPTIONS)[number]);
  return values;
}

type ItemFormProps =
  | {
      mode: "CREATE";
      item?: undefined;
      carId?: string;
      periodId?: string;
      onClose?: () => void;
      onSuccess?: () => void;
      onCreated?: (itemId: string) => void;
      onError?: (message: string) => void;
    }
  | {
      mode: "UPDATE";
      item: Readonly<SpfItem>;
      carId?: string;
      periodId?: string;
      onClose?: () => void;
      onSuccess?: () => void;
      onCreated?: (itemId: string) => void;
      onError?: (message: string) => void;
    };

export function ManualJobdescForm(props: ItemFormProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverSuccess, setServerSuccess] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [mediaProgress, setMediaProgress] = useState<string | null>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkType, setLinkType] = useState<"PHOTO" | "VIDEO">("PHOTO");
  const [mediaLinks, setMediaLinks] = useState<Array<{ url: string; type: "PHOTO" | "VIDEO" }>>([]);
  const [linkError, setLinkError] = useState<string | null>(null);
  const item = props.mode === "UPDATE" ? props.item : undefined;
  const lockedCarId = props.carId ?? item?.car_id ?? "";
  const periodId = props.periodId ?? item?.period_id ?? "";

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ManualJobdescValues>({
    resolver: zodResolver(manualJobdescSchema),
    defaultValues: {
      car_id: lockedCarId,
      period_id: periodId ?? "",
      customer_description: item?.customer_description ?? "",
      original_description: item?.original_description ?? "",
      work_status: item?.work_status ?? "ON_PROGRESS",
      progress: item?.progress ?? 0,
      display_order: item?.display_order ?? 0,
    },
  });

  async function resolveNextDisplayOrder() {
    const result = await mutateSpf<{ items: SpfItem[] }>("item", {
      mode: "LIST",
      car_id: lockedCarId,
      period_id: periodId || undefined,
      limit: 100,
      offset: 0,
    });
    const rows = result.success ? result.data.items ?? [] : [];
    return rows.reduce((max, row) => Math.max(max, row.display_order ?? 0), -1) + 1;
  }

  function handleFiles(files: FileList | null) {
    setUploadError(null);
    const next: File[] = [];
    for (const file of Array.from(files ?? [])) {
      const isVideo = file.type.startsWith("video/");
      const limit = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        setUploadError(`Tipe file tidak didukung: ${file.name}`);
        continue;
      }
      if (file.size > limit) {
        setUploadError(`${file.name} melebihi batas ${isVideo ? "25" : "10"} MB.`);
        continue;
      }
      next.push(file);
    }
    setMediaFiles((current) => [...current, ...next]);
    if (inputRef.current) inputRef.current.value = "";
  }

  function addLink() {
    const url = linkUrl.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) {
      setLinkError("Link harus diawali http:// atau https://.");
      return;
    }
    setMediaLinks((current) => [...current, { url, type: linkType }]);
    setLinkUrl("");
    setLinkError(null);
  }

  function onSubmit(values: ManualJobdescValues) {
    setServerError(null);
    setServerSuccess(null);
    setUploadError(null);
    startTransition(async () => {
      const displayOrder = props.mode === "CREATE" ? await resolveNextDisplayOrder() : values.display_order;
      const workStatus = values.work_status.trim();
      const progress = PROGRESS_BY_STATUS[workStatus] ?? 0;
      const payload = {
        car_id: values.car_id.trim(),
        period_id: values.period_id?.trim() || undefined,
        customer_description: values.customer_description.trim(),
        original_description: values.original_description?.trim() || undefined,
        work_status: workStatus,
        progress,
        display_order: displayOrder,
      };

      const result = await mutateSpf<{ item_id?: string | number; id?: string | number }>("item", props.mode === "CREATE"
        ? { mode: "CREATE", source_type: "MANUAL", ...payload }
        : {
            mode: "UPDATE",
            item_id: item!.id,
            customer_description: values.customer_description.trim(),
            original_description: values.original_description?.trim() || undefined,
            work_status: workStatus,
            progress,
            display_order: values.display_order,
          });

      if (!result.success) {
        const message = result.status === 409 ? "Data telah berubah. Halaman akan diperbarui." : result.message;
        setServerError(message);
        props.onError?.(message);
        if (result.status === 409) router.refresh();
        return;
      }

      const itemId = String(result.data.item_id ?? result.data.id ?? (props.mode === "UPDATE" ? item!.id : ""));
      if (props.mode === "CREATE") {
        props.onCreated?.(itemId);
      }
      if (itemId && mediaFiles.length > 0) {
        for (const [index, file] of mediaFiles.entries()) {
          setMediaProgress(`Mengunggah ${file.name} (${index + 1}/${mediaFiles.length})...`);
          const upload = await uploadSpfItemMedia(itemId, file);
          if (!upload.success) {
            setUploadError(upload.message);
            break;
          }
        }
        setMediaProgress(null);
        setMediaFiles([]);
      }
      if (itemId && mediaLinks.length > 0) {
        for (const link of mediaLinks) {
          const attach = await mutateSpf<{ media_id?: string | number }>("item", {
            mode: "ADD_MEDIA_URL",
            item_id: itemId,
            media_url: link.url,
            media_type: link.type,
          });
          if (!attach.success) {
            setUploadError(attach.message);
            break;
          }
        }
        setMediaLinks([]);
      }
      setServerSuccess(props.mode === "CREATE" ? "Item manual berhasil disimpan." : "Item manual berhasil diperbarui.");
      props.onSuccess?.();
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <div>
        <FieldLabel required>Unit</FieldLabel>
        <CompactInput {...register("car_id")} disabled={Boolean(lockedCarId) || isPending} />
        {errors.car_id ? <p className="mt-1 text-[12px] text-destructive">{errors.car_id.message}</p> : null}
      </div>

      <div>
        <FieldLabel required>Isi Laporan</FieldLabel>
        <CompactTextarea rows={4} {...register("customer_description")} disabled={isPending} />
        {errors.customer_description ? <p className="mt-1 text-[12px] text-destructive">{errors.customer_description.message}</p> : null}
      </div>

      <div>
        <FieldLabel>Deskripsi Teknis</FieldLabel>
        <CompactTextarea rows={3} {...register("original_description")} disabled={isPending} />
      </div>

      <div>
        <FieldLabel required>Progress</FieldLabel>
        <select
          {...register("work_status")}
          disabled={isPending}
          className="h-9 w-full border border-border bg-background px-3 text-[13px] text-foreground outline-none focus:border-primary/55 dark:border-white/[0.08] dark:bg-muted"
        >
          {workStatusOptions(item?.work_status).map((status) => (
            <option key={status} value={status}>{status.replaceAll("_", " ")}</option>
          ))}
        </select>
        {errors.work_status ? <p className="mt-1 text-[12px] text-destructive">{errors.work_status.message}</p> : null}
      </div>

      <div className="space-y-2">
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ALLOWED_MIME_TYPES.join(",")}
          className="hidden"
          disabled={isPending}
          onChange={(event) => handleFiles(event.target.files)}
        />
        <div className="flex flex-wrap items-center gap-2">
          <ActionButton variant="default" disabled={isPending} onClick={() => inputRef.current?.click()}>
            <Upload className="h-3.5 w-3.5" />
            Upload Media
          </ActionButton>
          <span className="text-[12px] text-muted-foreground">JPG, PNG, WEBP, MP4 (opsional)</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CompactInput
            value={linkUrl}
            onChange={(event) => {
              setLinkUrl(event.target.value);
              setLinkError(null);
            }}
            placeholder="Link Google Drive / URL media"
            className="min-w-[260px] flex-1"
            disabled={isPending}
          />
          <select
            value={linkType}
            onChange={(event) => setLinkType(event.target.value as "PHOTO" | "VIDEO")}
            disabled={isPending}
            className="h-9 w-24 border border-border bg-background px-2 text-[13px] text-foreground outline-none focus:border-primary/55 dark:border-white/[0.08] dark:bg-muted"
          >
            <option value="PHOTO">Foto</option>
            <option value="VIDEO">Video</option>
          </select>
          <ActionButton variant="default" disabled={isPending} onClick={addLink}>Tambah Link</ActionButton>
        </div>
        {linkError ? <p className="text-[12px] text-destructive">{linkError}</p> : null}
        {mediaFiles.length > 0 ? (
          <ul className="space-y-1 border border-border px-3 py-2 text-[12px] text-muted-foreground dark:border-white/[0.06]">
            {mediaFiles.map((file) => <li key={`${file.name}:${file.lastModified}`}>{file.name}</li>)}
          </ul>
        ) : null}
        {mediaLinks.length > 0 ? (
          <ul className="space-y-1 border border-border px-3 py-2 text-[12px] text-muted-foreground dark:border-white/[0.06]">
            {mediaLinks.map((link, index) => (
              <li key={`${link.url}:${index}`}>{link.type === "PHOTO" ? "Foto" : "Video"} · {link.url}</li>
            ))}
          </ul>
        ) : null}
        {mediaProgress ? <p role="status" className="text-[12px] text-app-accent-ink">{mediaProgress}</p> : null}
      </div>

      <Toast message={serverError} variant="err" />
      {uploadError ? <Toast message={uploadError} variant="err" /> : null}
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
