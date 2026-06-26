"use client";

import type {
  WarehouseStockCardPanelReference,
  WarehouseStockCardUnitReference,
  WarehouseStorageLocationRecord,
} from "@smsystem/contracts/warehouse";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, PackagePlus, Pencil } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { humanizeCodeLabel } from "@/shared/format/humanize";
import { SearchableField, type SearchOption } from "@/modules/units/components/shared/SearchableField";
import { SearchableSelect } from "@/shared/ui/compact";

const stockCardStatusValues = ["IN_STORAGE", "RETRIEVED", "INSTALLED", "LOST"] as const;
const stockCardStatusOptions = stockCardStatusValues.map((value) => ({
  value,
  label: humanizeCodeLabel(value),
}));

const stockCardSchema = z.object({
  stockCardId: z.string().nullable(),
  carId: z.string().min(1, "Unit wajib dipilih"),
  panelId: z.string().optional(),
  parentPanelId: z.string().optional(),
  panelName: z.string().min(1, "Panel wajib diisi"),
  panelCategory: z.string().optional(),
  partCode: z.string().optional(),
  panelSection: z.string().min(1, "Section wajib diisi"),
  usePart: z.boolean(),
  partName: z.string().optional(),
  conditionType: z.enum(["BARU", "RESTORE", "BEKAS"]),
  qty: z.number().min(0, "Qty tidak boleh negatif").max(100_000),
  uom: z.string().min(1, "Satuan wajib diisi"),
  storageLocationId: z.string().optional(),
  locationDetail: z.string().optional(),
  dateIn: z.string().optional(),
  dateOut: z.string().optional(),
  takenByName: z.string().optional(),
  status: z.enum(stockCardStatusValues),
  isLabeled: z.boolean(),
}).superRefine((data, context) => {
  if (data.usePart && !data.partName?.trim()) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["partName"],
      message: "Part wajib diisi jika opsi part dipilih",
    });
  }
});

export type StockCardFormValues = z.infer<typeof stockCardSchema>;

interface WarehouseStockCardFormProps {
  initialValues?: StockCardFormValues | null;
  units: WarehouseStockCardUnitReference[];
  panels: WarehouseStockCardPanelReference[];
  locations: WarehouseStorageLocationRecord[];
  isPending: boolean;
  onUnitChange: (unitId: string) => void | Promise<void>;
  onSubmit: (data: StockCardFormValues) => void;
}

const inputCls =
  "h-9 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 text-[12px] text-foreground outline-none transition-colors focus:border-primary/30 [color-scheme:dark]";

const darkSelectStyle = {
  backgroundColor: "var(--card)",
  color: "var(--card-foreground)",
} as const;

export function WarehouseStockCardForm({
  initialValues,
  units,
  panels,
  locations,
  isPending,
  onUnitChange,
  onSubmit,
}: WarehouseStockCardFormProps) {
  const isEditing = initialValues?.stockCardId != null;
  const today = new Date().toISOString().slice(0, 10);
  const {
    register,
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isValid },
  } = useForm<StockCardFormValues>({
    resolver: zodResolver(stockCardSchema),
    defaultValues: initialValues || {
      stockCardId: null,
      carId: "",
      panelId: "",
      parentPanelId: "",
      panelName: "",
      panelCategory: "",
      partCode: "",
      panelSection: "",
      usePart: false,
      partName: "",
      conditionType: "BEKAS",
      qty: 1,
      uom: "pcs",
      storageLocationId: "",
      locationDetail: "",
      dateIn: today,
      dateOut: "",
      takenByName: "",
      status: "IN_STORAGE",
      isLabeled: false,
    },
    mode: "onChange",
  });
  const selectedSection = watch("panelSection");
  const selectedParentPanelId = watch("parentPanelId");
  const selectedPanelName = watch("panelName");
  const selectedCategory = watch("panelCategory");
  const usePart = watch("usePart");
  const unitOptions = units.map((unit) => ({ value: unit.value, label: unit.label }));
  const rootPanels = panels.filter((panel) => panel.parentPanelId === null);
  const categoryOptions: SearchOption[] = Array.from(
    new Set(rootPanels.flatMap((panel) => panel.category ? [panel.category] : [])),
  ).map((category) => ({ value: category }));
  const sectionOptions: SearchOption[] = Array.from(
    new Set(rootPanels
      .filter((panel) => !selectedCategory || panel.category === selectedCategory)
      .map((panel) => panel.section)
      .filter(Boolean)),
  ).map((section) => ({ value: section }));
  const panelOptions: SearchOption[] = rootPanels
    .filter((panel) =>
      (!selectedCategory || panel.category === selectedCategory) &&
      (!selectedSection || panel.section === selectedSection)
    )
    .map((panel) => ({
      value: panel.name,
      label: [panel.category, panel.partCode].filter(Boolean).join(" · "),
    }));
  const partOptions: SearchOption[] = panels
    .filter((panel) => panel.parentPanelId !== null && String(panel.parentPanelId) === selectedParentPanelId)
    .map((panel) => ({
      value: panel.name,
      label: panel.partCode,
    }));

  function clearPart() {
    setValue("panelId", "", { shouldValidate: true });
    setValue("partCode", "", { shouldValidate: true });
  }

  function findRootPanel(value: string) {
    const normalized = value.trim().toLowerCase();
    return rootPanels.find((panel) =>
      panel.name.trim().toLowerCase() === normalized &&
      (!selectedCategory || panel.category === selectedCategory) &&
      (!selectedSection || panel.section === selectedSection)
    ) ?? null;
  }

  function applyRootPanel(panel: WarehouseStockCardPanelReference) {
    setValue("parentPanelId", String(panel.panelId), { shouldValidate: true });
    setValue("panelName", panel.name, { shouldValidate: true });
    setValue("panelCategory", panel.category ?? "", { shouldValidate: true });
    setValue("panelSection", panel.section, { shouldValidate: true });
    clearPart();
    setValue("partName", "", { shouldValidate: true });
  }

  function toggleUsePart(enabled: boolean) {
    setValue("usePart", enabled, { shouldValidate: true });
    if (!enabled) {
      clearPart();
      setValue("partName", "", { shouldValidate: true });
    }
  }

  function changeCategory(value: string) {
    setValue("panelCategory", value, { shouldValidate: true });
    setValue("panelSection", "", { shouldValidate: true });
    setValue("parentPanelId", "", { shouldValidate: true });
    setValue("panelName", "", { shouldValidate: true });
    setValue("usePart", false, { shouldValidate: true });
    setValue("partName", "", { shouldValidate: true });
    clearPart();
  }

  function changeSection(value: string) {
    setValue("panelSection", value, { shouldValidate: true });
    setValue("parentPanelId", "", { shouldValidate: true });
    setValue("panelName", "", { shouldValidate: true });
    setValue("usePart", false, { shouldValidate: true });
    setValue("partName", "", { shouldValidate: true });
    clearPart();
  }

  function changePanel(value: string) {
    setValue("panelName", value, { shouldValidate: true });
    const exactPanel = findRootPanel(value);
    if (exactPanel) {
      applyRootPanel(exactPanel);
      return;
    }

    setValue("parentPanelId", "", { shouldValidate: true });
    setValue("usePart", false, { shouldValidate: true });
    setValue("partName", "", { shouldValidate: true });
    clearPart();
  }

  function applyPart(partId: string) {
    const part = panels.find((item) => String(item.panelId) === partId);
    if (!part) {
      setValue("panelId", "", { shouldValidate: true });
      setValue("partCode", "", { shouldValidate: true });
      return;
    }

    setValue("panelId", String(part.panelId), { shouldValidate: true });
    setValue("parentPanelId", part.parentPanelId ? String(part.parentPanelId) : "", { shouldValidate: true });
    setValue("partCode", part.partCode, { shouldValidate: true });
    setValue("panelSection", part.section, { shouldValidate: true });
    setValue("partName", part.name, { shouldValidate: true });
  }

  function changePart(value: string) {
    setValue("partName", value, { shouldValidate: true });
    const normalized = value.trim().toLowerCase();
    const exactPart = panels.find((panel) =>
      panel.parentPanelId !== null &&
      String(panel.parentPanelId) === selectedParentPanelId &&
      panel.name.trim().toLowerCase() === normalized
    );

    if (exactPart) {
      applyPart(String(exactPart.panelId));
      return;
    }

    clearPart();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <input type="hidden" {...register("panelId")} />
      <input type="hidden" {...register("parentPanelId")} />
      <input type="hidden" {...register("partCode")} />
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm text-foreground/75">
          <span>Nama unit</span>
          <Controller
            control={control}
            name="carId"
            render={({ field }) => (
              <SearchableSelect
                value={field.value}
                onChange={(value) => {
                  field.onChange(value);
                  setValue("panelSection", "", { shouldValidate: true });
                  setValue("parentPanelId", "", { shouldValidate: true });
                  setValue("panelName", "", { shouldValidate: true });
                  setValue("panelCategory", "", { shouldValidate: true });
                  setValue("usePart", false, { shouldValidate: true });
                  setValue("partName", "", { shouldValidate: true });
                  clearPart();
                  if (value) {
                    void onUnitChange(value);
                  }
                }}
                options={unitOptions}
                placeholder="Pilih unit"
              />
            )}
          />
          {errors.carId && <span className="text-xs text-destructive">{errors.carId.message}</span>}
        </label>

        <label className="grid gap-2 text-sm text-foreground/75">
          <span>Kategori</span>
          <Controller
            control={control}
            name="panelCategory"
            render={({ field }) => (
              <SearchableField
                value={field.value ?? ""}
                onChange={changeCategory}
                options={categoryOptions}
                placeholder="Pilih kategori"
                heightClassName="h-9"
                closeOnInputBlurDelay
              />
            )}
          />
        </label>

        <label className="grid gap-2 text-sm text-foreground/75">
          <span>Section</span>
          <Controller
            control={control}
            name="panelSection"
            render={({ field }) => (
              <SearchableField
                value={field.value ?? ""}
                onChange={changeSection}
                options={sectionOptions}
                placeholder="Pilih section"
                heightClassName="h-9"
                closeOnInputBlurDelay
              />
            )}
          />
          {errors.panelSection && <span className="text-xs text-destructive">{errors.panelSection.message}</span>}
        </label>

        <label className="grid gap-2 text-sm text-foreground/75">
          <span>Panel</span>
          <Controller
            control={control}
            name="panelName"
            render={({ field }) => (
              <SearchableField
                value={field.value}
                onChange={changePanel}
                onSelect={(option) => {
                  const panel = findRootPanel(option.value);
                  if (panel) applyRootPanel(panel);
                }}
                options={panelOptions}
                placeholder={selectedSection ? "Pilih panel" : "Pilih section dulu"}
                disabled={!selectedSection}
                heightClassName="h-9"
                closeOnInputBlurDelay
              />
            )}
          />
          {errors.panelName && <span className="text-xs text-destructive">{errors.panelName.message}</span>}
        </label>

        <label className="flex h-9 items-center gap-2 self-end rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-foreground/75">
          <input
            type="checkbox"
            checked={usePart}
            disabled={!selectedPanelName}
            onChange={(event) => toggleUsePart(event.target.checked)}
          />
          Pakai part
        </label>

        {usePart ? (
          <label className="grid gap-2 text-sm text-foreground/75 md:col-span-2">
            <span>Part</span>
            <Controller
              control={control}
              name="partName"
              render={({ field }) => (
                <SearchableField
                  value={field.value ?? ""}
                  onChange={changePart}
                  onSelect={(option) => {
                    const part = panels.find((item) =>
                      item.parentPanelId !== null &&
                      String(item.parentPanelId) === selectedParentPanelId &&
                      item.name === option.value
                    );
                    if (part) applyPart(String(part.panelId));
                  }}
                  options={partOptions}
                  placeholder="Pilih atau isi part"
                  disabled={!selectedPanelName}
                  heightClassName="h-9"
                  closeOnInputBlurDelay
                />
              )}
            />
            {errors.partName && <span className="text-xs text-destructive">{errors.partName.message}</span>}
          </label>
        ) : null}

        <label className="grid gap-2 text-sm text-foreground/75">
          <span>Kondisi</span>
          <select {...register("conditionType")} className={inputCls} style={darkSelectStyle}>
            <option value="BARU" style={darkSelectStyle}>Baru</option>
            <option value="RESTORE" style={darkSelectStyle}>Restore</option>
            <option value="BEKAS" style={darkSelectStyle}>Bekas</option>
          </select>
        </label>

        <label className="grid gap-2 text-sm text-foreground/75">
          <span>Status</span>
          <select {...register("status")} className={inputCls} style={darkSelectStyle}>
            {stockCardStatusOptions.map((option) => (
              <option key={option.value} value={option.value} style={darkSelectStyle}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-2 text-sm text-foreground/75">
          <span>Qty</span>
          <input type="number" step="0.01" {...register("qty", { valueAsNumber: true })} className={inputCls} />
          {errors.qty && <span className="text-xs text-destructive">{errors.qty.message}</span>}
        </label>

        <label className="grid gap-2 text-sm text-foreground/75">
          <span>Satuan</span>
          <input {...register("uom")} className={inputCls} />
          {errors.uom && <span className="text-xs text-destructive">{errors.uom.message}</span>}
        </label>

        <label className="grid gap-2 text-sm text-foreground/75">
          <span>Lokasi</span>
          <select {...register("storageLocationId")} className={inputCls} style={darkSelectStyle}>
            <option value="" style={darkSelectStyle}>Belum ada lokasi</option>
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
        </label>

        <label className="grid gap-2 text-sm text-foreground/75">
          <span>Detail lokasi</span>
          <input {...register("locationDetail")} className={inputCls} />
        </label>

        <label className="grid gap-2 text-sm text-foreground/75">
          <span>Tanggal masuk</span>
          <input type="date" {...register("dateIn")} className={inputCls} />
        </label>

        <label className="grid gap-2 text-sm text-foreground/75">
          <span>Tanggal keluar</span>
          <input type="date" {...register("dateOut")} className={inputCls} />
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
          {isPending ? "Menyimpan..." : isEditing ? "Simpan perubahan" : "Simpan stock card"}
        </button>
      </div>
    </form>
  );
}
