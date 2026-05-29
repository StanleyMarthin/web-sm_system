"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { MapPinned, Loader2 } from "lucide-react";
import type { WarehouseStorageLocationRecord } from "@smsystem/contracts/warehouse";
import { useEffect } from "react";

const storeSchema = z.object({
  storageLocationId: z.string().min(1, "Lokasi wajib dipilih"),
  locationDetail: z.string().optional(),
  notes: z.string().optional(),
});

export type StoreFormValues = z.infer<typeof storeSchema>;

interface WarehouseStoreFormProps {
  initialValues: { storageLocationId?: string | null; locationDetail?: string | null; notes?: string | null } | null;
  locations: WarehouseStorageLocationRecord[];
  isPending: boolean;
  onSubmit: (data: StoreFormValues) => void;
}

function buildStorageLocationDetail(location: WarehouseStorageLocationRecord): string {
  const segments: string[] = [];
  if (location.zone) segments.push(location.zone);
  if (location.rack) segments.push(`Rak ${location.rack}`);
  if (location.shelf) segments.push(`Shelf ${location.shelf}`);
  return segments.join(" · ");
}

export function WarehouseStoreForm({ initialValues, locations, isPending, onSubmit }: WarehouseStoreFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isValid },
  } = useForm<StoreFormValues>({
    resolver: zodResolver(storeSchema),
    defaultValues: {
      storageLocationId: initialValues?.storageLocationId ?? "",
      locationDetail: initialValues?.locationDetail ?? "",
      notes: initialValues?.notes ?? "",
    },
    mode: "onChange",
  });

  const selectedLocationId = watch("storageLocationId");

  useEffect(() => {
    if (selectedLocationId) {
      const selectedLocation = locations.find((loc) => String(loc.storageLocationId) === selectedLocationId);
      if (selectedLocation) {
        setValue("locationDetail", buildStorageLocationDetail(selectedLocation), { shouldValidate: true });
      } else {
        setValue("locationDetail", "");
      }
    } else {
      setValue("locationDetail", "");
    }
  }, [selectedLocationId, locations, setValue]);

  const inputCls =
    "h-9 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 text-[12px] text-white outline-none transition-colors focus:border-amber-500/30 [color-scheme:dark]";

  const darkSelectStyle = {
    backgroundColor: "#111111",
    color: "#ffffff",
  } as const;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm text-white/75">
          <span>Lokasi</span>
          <select
            {...register("storageLocationId")}
            className={inputCls}
            style={darkSelectStyle}
          >
            <option value="" style={darkSelectStyle}>Pilih lokasi</option>
            {locations.map((location) => (
              <option
                key={location.storageLocationId}
                value={String(location.storageLocationId)}
                style={darkSelectStyle}
              >
                {location.label}
              </option>
            ))}
          </select>
          {errors.storageLocationId && <span className="text-xs text-red-400">{errors.storageLocationId.message}</span>}
        </label>
        
        <label className="grid gap-2 text-sm text-white/75">
          <span>Detail lokasi</span>
          <input {...register("locationDetail")} className={inputCls} />
        </label>
        
        <label className="grid gap-2 text-sm text-white/75 md:col-span-2">
          <span>Catatan</span>
          <textarea
            {...register("notes")}
            className="min-h-24 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white outline-none focus:border-amber-500/30"
          />
        </label>
      </div>
      
      <div className="mt-5 flex justify-end">
        <button
          type="submit"
          disabled={isPending || !isValid}
          className="inline-flex items-center gap-2 rounded-full bg-amber-500 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-black disabled:opacity-50"
        >
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MapPinned className="h-3.5 w-3.5" />}
          {isPending ? "Menyimpan..." : "Konfirmasi tersimpan"}
        </button>
      </div>
    </form>
  );
}
