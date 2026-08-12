"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { MapPinned, Loader2 } from "lucide-react";
import type { WarehouseStorageLocationRecord } from "@smsystem/contracts/warehouse";
import { useEffect } from "react";
import { ActionButton, CompactInput, CompactSelect, CompactTextarea, FieldLabel } from "@/shared/ui/compact";

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

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="grid gap-2 text-sm text-foreground/75">
          <FieldLabel required>Lokasi</FieldLabel><CompactSelect
            {...register("storageLocationId")}
            value={selectedLocationId}
          >
            <option value="">Pilih lokasi</option>
            {locations.map((location) => (
              <option
                key={location.storageLocationId}
                value={String(location.storageLocationId)}
              >
                {location.label}
              </option>
            ))}
          </CompactSelect>
          {errors.storageLocationId && <span className="text-xs text-destructive">{errors.storageLocationId.message}</span>}
        </label>
        
        <label className="grid gap-2 text-sm text-foreground/75">
          <FieldLabel>Detail lokasi</FieldLabel><CompactInput {...register("locationDetail")} />
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
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MapPinned className="h-3.5 w-3.5" />}
          {isPending ? "Menyimpan..." : "Konfirmasi tersimpan"}
        </ActionButton>
      </div>
    </form>
  );
}
