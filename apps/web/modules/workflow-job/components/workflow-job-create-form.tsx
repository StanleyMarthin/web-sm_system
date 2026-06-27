"use client";

import Image from "next/image";
import { ChevronDown, Search, UploadCloud, X } from "lucide-react";
import { useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import {
  createWorkflowJobForm,
  submitWorkflowJobCreate,
  visibleWorkflowJobTypes,
  type CreatedWorkflowJob,
  type WorkflowCreateType,
  type WorkflowJobCreateContext,
  type WorkflowJobCreateFormState,
  type WorkflowJobCreateReferences,
} from "@/modules/workflow-job/workflow-job-create";
import { requestPrUploadTicket } from "@/shared/api/pr";

interface WorkflowJobCreateFormProps {
  context: WorkflowJobCreateContext;
  references: WorkflowJobCreateReferences;
  allowedTypes: WorkflowCreateType[];
  defaultType?: WorkflowCreateType;
  initialForm?: WorkflowJobCreateFormState;
  submitLabel?: string;
  isSaving: boolean;
  onSavingChange: (isSaving: boolean) => void;
  onCancel: () => void;
  onCreated?: (created: CreatedWorkflowJob, form: WorkflowJobCreateFormState) => void;
  onSubmit?: (form: WorkflowJobCreateFormState) => Promise<string | null> | string | null;
}

const createTypeLabels: Record<WorkflowCreateType, string> = {
  COUNTDOWN: "Countdown",
  WO: "WO",
  PR: "PR",
  WOV: "WOV",
};

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <span className="block text-[15px] font-mono uppercase tracking-[0.12em] text-muted-foreground">
      {children}
    </span>
  );
}

function updateItem<T extends keyof WorkflowJobCreateFormState>(
  setter: Dispatch<SetStateAction<WorkflowJobCreateFormState>>,
  key: T,
  value: WorkflowJobCreateFormState[T],
) {
  setter((current) => ({ ...current, [key]: value }));
}

interface AdaptiveSelectOption {
  value: string;
  label: string;
}

interface AdaptiveSelectProps {
  value: string;
  options: AdaptiveSelectOption[];
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}

function AdaptiveSelect({ value, options, onChange, placeholder, className = "" }: AdaptiveSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selectedOption = options.find((option) => option.value === value) ?? null;
  const normalizedQuery = query.trim().toLowerCase();
  const filteredOptions = options.filter((option) => {
    const haystack = `${option.label} ${option.value}`.toLowerCase();
    return !normalizedQuery || haystack.includes(normalizedQuery);
  });

  if (options.length <= 3) {
    return (
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`h-10 w-full border border-border bg-card px-3 text-[15px] text-foreground outline-none focus:border-primary/45 ${className}`}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <div className="flex h-10 items-center border border-border bg-card focus-within:border-primary/45">
        <Search className="ml-3 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <input
          value={isOpen ? query : selectedOption?.label ?? ""}
          onFocus={() => {
            setQuery("");
            setIsOpen(true);
          }}
          onBlur={() => window.setTimeout(() => setIsOpen(false), 120)}
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
          }}
          placeholder={placeholder}
          className="h-full min-w-0 flex-1 bg-transparent px-2 text-[15px] text-foreground outline-none placeholder:text-muted-foreground"
        />
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setIsOpen((open) => !open)}
          className="flex h-full w-9 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>
      {isOpen ? (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-[90] max-h-56 overflow-auto border border-border bg-popover py-1 shadow-lg">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  onChange(option.value);
                  setQuery("");
                  setIsOpen(false);
                }}
                className="flex w-full px-3 py-2 text-left text-[14px] text-foreground hover:bg-muted"
              >
                {option.label}
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-[14px] text-muted-foreground">Tidak ada data cocok.</div>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function WorkflowJobCreateForm({
  context,
  references,
  allowedTypes,
  defaultType: defaultTypeProp,
  initialForm,
  submitLabel = "Buat",
  isSaving,
  onSavingChange,
  onCancel,
  onCreated,
  onSubmit,
}: WorkflowJobCreateFormProps) {
  const defaultType = defaultTypeProp && allowedTypes.includes(defaultTypeProp) ? defaultTypeProp : allowedTypes[0] ?? "COUNTDOWN";
  const [form, setForm] = useState<WorkflowJobCreateFormState>(() => initialForm ?? createWorkflowJobForm(context, defaultType));
  const [error, setError] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const visibleJobTypes = useMemo(
    () => visibleWorkflowJobTypes(references, form.divisionId),
    [form.divisionId, references],
  );
  const sectionOptions = useMemo(() => {
    const options = references.sections.map((section) => ({ value: section.value, label: section.label }));
    if (context.sectionName && !options.some((section) => section.value === context.sectionName)) {
      return [...options, { value: context.sectionName, label: context.sectionName }];
    }
    return options;
  }, [context.sectionName, references.sections]);

  useEffect(() => {
    setForm(initialForm ?? createWorkflowJobForm(context, defaultType));
    setError(null);
    setIsUploadingPhoto(false);
  }, [context, defaultType, initialForm]);

  async function handlePrPhotoUpload(file: File) {
    setError(null);
    setIsUploadingPhoto(true);
    try {
      const ticketResult = await requestPrUploadTicket({
        filename: file.name,
        contentType: file.type,
        size: file.size,
      });
      if (!ticketResult.success) {
        setError(ticketResult.message || "Gagal mendapatkan upload ticket.");
        return;
      }
      const uploadResult = await fetch(ticketResult.result.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!uploadResult.ok) {
        setError("Gagal mengunggah foto PR.");
        return;
      }
      updateItem(setForm, "photoUrl", ticketResult.result.publicUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengunggah foto PR.");
    } finally {
      setIsUploadingPhoto(false);
    }
  }

  async function handleSubmit() {
    setError(null);
    onSavingChange(true);
    try {
      if (onSubmit) {
        const message = await onSubmit(form);
        if (message) setError(message);
        return;
      }
      const result = await submitWorkflowJobCreate({ form, context, references });
      if (!result.success) {
        setError(result.message);
        return;
      }
      onCreated?.(result.created, form);
      setForm(createWorkflowJobForm(context, defaultType));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sumber job belum bisa dibuat.");
    } finally {
      onSavingChange(false);
    }
  }

  return (
    <>
      <div className="grid flex-1 gap-3 overflow-y-auto px-4 py-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <FieldLabel>Jenis</FieldLabel>
          <div className="grid grid-cols-2 gap-1 border border-border bg-card p-1 sm:grid-cols-4">
            {allowedTypes.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => updateItem(setForm, "type", type)}
                className={[
                  "h-9 text-[14px] font-mono uppercase tracking-[0.1em] transition-colors",
                  form.type === type
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                ].join(" ")}
              >
                {createTypeLabels[type]}
              </button>
            ))}
          </div>
        </div>

        <label className="space-y-1.5">
          <FieldLabel>Unit</FieldLabel>
          <input
            value={context.carId}
            readOnly
            className="h-10 w-full border border-border bg-muted px-3 text-[15px] text-foreground outline-none"
          />
        </label>
        <label className="space-y-1.5">
          <FieldLabel>Panel / Part</FieldLabel>
          <input
            value={context.panelName}
            readOnly
            className="h-10 w-full border border-border bg-muted px-3 text-[15px] text-foreground outline-none"
          />
        </label>
        <label className="space-y-1.5">
          <FieldLabel>Section</FieldLabel>
          <input
            value={context.sectionName ?? ""}
            readOnly
            className="h-10 w-full border border-border bg-muted px-3 text-[15px] text-foreground outline-none"
          />
        </label>
        <label className="space-y-1.5">
          <FieldLabel>Kategori</FieldLabel>
          <input
            value={context.panelCategory ?? ""}
            readOnly
            className="h-10 w-full border border-border bg-muted px-3 text-[15px] text-foreground outline-none"
          />
        </label>

        {form.type !== "WOV" ? (
          <label className="space-y-1.5">
            <FieldLabel>Divisi</FieldLabel>
            <AdaptiveSelect
              value={form.divisionId}
              options={references.divisions}
              onChange={(value) => updateItem(setForm, "divisionId", value)}
              placeholder={context.divisionName ?? "Pilih divisi"}
            />
          </label>
        ) : null}

        <label className="space-y-1.5 sm:col-span-2">
          <FieldLabel>{form.type === "PR" ? "Deskripsi Item" : form.type === "WOV" ? "Item / Pekerjaan Vendor" : "Pekerjaan"}</FieldLabel>
          <input
            value={form.title}
            onChange={(event) => updateItem(setForm, "title", event.target.value)}
            className="h-10 w-full border border-border bg-card px-3 text-[15px] text-foreground outline-none focus:border-primary/45"
          />
        </label>

        {form.type === "COUNTDOWN" ? (
          <>
            <label className="space-y-1.5">
              <FieldLabel>Tipe</FieldLabel>
              <AdaptiveSelect
                value={form.taskCategory}
                options={[
                  { value: "MAIN", label: "Main" },
                  { value: "ADDITIONAL", label: "Additional" },
                ]}
                onChange={(value) => updateItem(setForm, "taskCategory", value as WorkflowJobCreateFormState["taskCategory"])}
                placeholder="Pilih tipe"
              />
            </label>
            <label className="space-y-1.5">
              <FieldLabel>Section</FieldLabel>
              <AdaptiveSelect
                value={form.sectionName}
                options={sectionOptions}
                onChange={(value) => updateItem(setForm, "sectionName", value)}
                placeholder="Pilih section"
              />
            </label>
            <label className="space-y-1.5 sm:col-span-2">
              <FieldLabel>Jobdesc</FieldLabel>
              <AdaptiveSelect
                value={form.jobTypeId}
                options={visibleJobTypes}
                onChange={(value) => updateItem(setForm, "jobTypeId", value)}
                placeholder="Pilih jobdesc"
              />
            </label>
            <label className="space-y-1.5">
              <FieldLabel>Target Awal</FieldLabel>
              <input
                value={form.targetHours}
                onChange={(event) => updateItem(setForm, "targetHours", event.target.value)}
                placeholder="001:00"
                className="h-10 w-full border border-border bg-card px-3 text-[15px] text-foreground outline-none focus:border-primary/45"
              />
            </label>
            <label className="space-y-1.5">
              <FieldLabel>Start Date</FieldLabel>
              <input
                type="date"
                value={form.startDate}
                onChange={(event) => updateItem(setForm, "startDate", event.target.value)}
                className="h-10 w-full border border-border bg-card px-3 text-[15px] text-foreground outline-none focus:border-primary/45 dark:[color-scheme:dark]"
              />
            </label>
            <label className="space-y-1.5 sm:col-span-2">
              <FieldLabel>Temuan Awal</FieldLabel>
              <textarea
                value={form.temuanAwal}
                onChange={(event) => updateItem(setForm, "temuanAwal", event.target.value)}
                rows={2}
                className="w-full resize-none border border-border bg-card px-3 py-2 text-[15px] text-foreground outline-none focus:border-primary/45"
              />
            </label>
            <label className="space-y-1.5 sm:col-span-2">
              <FieldLabel>Keterangan</FieldLabel>
              <textarea
                value={form.keterangan}
                onChange={(event) => updateItem(setForm, "keterangan", event.target.value)}
                rows={2}
                className="w-full resize-none border border-border bg-card px-3 py-2 text-[15px] text-foreground outline-none focus:border-primary/45"
              />
            </label>
          </>
        ) : null}

        {form.type === "WO" ? (
          <>
            <label className="space-y-1.5">
              <FieldLabel>Estimasi Jam</FieldLabel>
              <input
                type="number"
                min="0"
                step="0.25"
                value={form.estimatedHours}
                onChange={(event) => updateItem(setForm, "estimatedHours", event.target.value)}
                className="h-10 w-full border border-border bg-card px-3 text-[15px] text-foreground outline-none focus:border-primary/45"
              />
            </label>
            <label className="flex h-10 items-center gap-2 self-end border border-border bg-card px-3 text-[14px] font-semibold text-foreground">
              <input
                type="checkbox"
                checked={form.isPriority}
                onChange={(event) => updateItem(setForm, "isPriority", event.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              Urgent / Prioritas
            </label>
          </>
        ) : null}

        {form.type === "PR" || form.type === "WOV" ? (
          <>
            <label className="space-y-1.5">
              <FieldLabel>Qty</FieldLabel>
              <input
                type="number"
                min="1"
                step="1"
                value={form.qty}
                onChange={(event) => updateItem(setForm, "qty", event.target.value)}
                className="h-10 w-full border border-border bg-card px-3 text-[15px] text-foreground outline-none focus:border-primary/45"
              />
            </label>
            <label className="space-y-1.5">
              <FieldLabel>Satuan</FieldLabel>
              <input
                value={form.uom}
                onChange={(event) => updateItem(setForm, "uom", event.target.value)}
                className="h-10 w-full border border-border bg-card px-3 text-[15px] text-foreground outline-none focus:border-primary/45"
              />
            </label>
          </>
        ) : null}

        {form.type === "PR" ? (
          <>
            <label className="space-y-1.5">
              <FieldLabel>Prioritas</FieldLabel>
              <AdaptiveSelect
                value={form.priority}
                options={[
                  { value: "NORMAL", label: "NORMAL" },
                  { value: "URGENT", label: "URGENT" },
                ]}
                onChange={(value) => updateItem(setForm, "priority", value as WorkflowJobCreateFormState["priority"])}
                placeholder="Pilih prioritas"
              />
            </label>
            <label className="space-y-1.5">
              <FieldLabel>Estimasi Harga</FieldLabel>
              <input
                type="number"
                min="0"
                value={form.estimatedPrice}
                onChange={(event) => updateItem(setForm, "estimatedPrice", event.target.value)}
                className="h-10 w-full border border-border bg-card px-3 text-[15px] text-foreground outline-none focus:border-primary/45"
              />
            </label>
            <div className="space-y-1.5 sm:col-span-2">
              <FieldLabel>Foto PR</FieldLabel>
              <div className="flex min-h-12 items-center justify-between gap-3 border border-border bg-card px-3 py-2">
                {form.photoUrl ? (
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="relative h-9 w-9 shrink-0 overflow-hidden border border-border">
                      <Image src={form.photoUrl} alt="Foto PR" fill sizes="36px" className="object-cover" />
                    </div>
                    <span className="truncate text-[14px] text-foreground">{form.photoUrl.split("/").pop()}</span>
                  </div>
                ) : (
                  <span className="text-[14px] text-muted-foreground">{isUploadingPhoto ? "Uploading..." : "Belum ada foto"}</span>
                )}
                <div className="flex shrink-0 items-center gap-2">
                  {form.photoUrl ? (
                    <button
                      type="button"
                      onClick={() => updateItem(setForm, "photoUrl", "")}
                      className="flex h-8 w-8 items-center justify-center border border-border text-muted-foreground hover:text-destructive"
                      title="Hapus foto"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                  <label className="flex h-8 cursor-pointer items-center gap-1.5 border border-border px-2.5 text-[13px] font-mono uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground">
                    <UploadCloud className="h-3.5 w-3.5" />
                    {isUploadingPhoto ? "Upload..." : "Upload"}
                    <input
                      type="file"
                      accept="image/*"
                      disabled={isUploadingPhoto}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.target.value = "";
                        if (file) void handlePrPhotoUpload(file);
                      }}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>
          </>
        ) : null}

        {form.type === "WOV" ? (
          <>
            <label className="space-y-1.5">
              <FieldLabel>Vendor</FieldLabel>
              <input
                value={form.vendorName}
                onChange={(event) => updateItem(setForm, "vendorName", event.target.value)}
                className="h-10 w-full border border-border bg-card px-3 text-[15px] text-foreground outline-none focus:border-primary/45"
              />
            </label>
            <label className="space-y-1.5">
              <FieldLabel>Estimasi Biaya</FieldLabel>
              <input
                type="number"
                min="0"
                value={form.estimatedCost}
                onChange={(event) => updateItem(setForm, "estimatedCost", event.target.value)}
                className="h-10 w-full border border-border bg-card px-3 text-[15px] text-foreground outline-none focus:border-primary/45"
              />
            </label>
            <label className="space-y-1.5 sm:col-span-2">
              <FieldLabel>Kondisi Barang Keluar</FieldLabel>
              <textarea
                value={form.goodsConditionOut}
                onChange={(event) => updateItem(setForm, "goodsConditionOut", event.target.value)}
                rows={2}
                className="w-full resize-none border border-border bg-card px-3 py-2 text-[15px] text-foreground outline-none focus:border-primary/45"
              />
            </label>
          </>
        ) : null}

        <label className="space-y-1.5">
          <FieldLabel>{form.type === "WOV" ? "Target Kembali" : form.type === "WO" ? "Tanggal WO" : "Deadline"}</FieldLabel>
          <input
            type="date"
            value={form.targetDate}
            onChange={(event) => updateItem(setForm, "targetDate", event.target.value)}
            className="h-10 w-full border border-border bg-card px-3 text-[15px] text-foreground outline-none focus:border-primary/45 dark:[color-scheme:dark]"
          />
        </label>
        <label className="space-y-1.5 sm:col-span-2">
          <FieldLabel>{form.type === "WOV" ? "Remarks" : "Catatan"}</FieldLabel>
          <textarea
            value={form.notes}
            onChange={(event) => updateItem(setForm, "notes", event.target.value)}
            rows={2}
            className="w-full resize-none border border-border bg-card px-3 py-2 text-[15px] text-foreground outline-none focus:border-primary/45"
          />
        </label>
      </div>

      {error ? (
        <div className="mx-4 mb-3 border border-destructive/20 bg-destructive/[0.04] px-3 py-2 text-[15px] text-destructive">
          {error}
        </div>
      ) : null}

      <div className="flex shrink-0 justify-end gap-2 border-t border-border bg-card px-4 py-3">
        <button
          type="button"
          onClick={onCancel}
          className="border border-border px-4 py-2 text-[15px] font-mono uppercase tracking-[0.12em] text-foreground hover:text-foreground"
        >
          Batal
        </button>
        <button
          type="button"
          disabled={isSaving}
          onClick={() => {
            void handleSubmit();
          }}
          className="border border-primary/35 bg-primary px-5 py-2 text-[15px] font-mono uppercase tracking-[0.12em] text-primary-foreground disabled:cursor-not-allowed disabled:opacity-45"
        >
          {isSaving ? "Menyimpan..." : submitLabel}
        </button>
      </div>
    </>
  );
}
