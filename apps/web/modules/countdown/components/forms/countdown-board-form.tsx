"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ActionButton, CompactInput, CompactSelect, CompactTextarea, FieldLabel } from "@/shared/ui/compact";
import { Save, X } from "lucide-react";

const countdownFormSchema = z.object({
  countdownId: z.string().optional(),
  carId: z.string().min(1, "Unit wajib diisi"),
  divisionId: z.string().min(1, "Divisi wajib diisi"),
  panelId: z.string().optional(),
  taskCategory: z.string().min(1, "Kategori wajib diisi"),
  sectionName: z.string().min(1, "Section wajib diisi"),
  jobTypeId: z.string().optional(),
  targetHoursInitial: z.string().regex(/^\d+:[0-5]\d$/, "Format jam harus HH:MM (contoh: 04:30)"),
  startDate: z.string().optional(),
  deadlineDate: z.string().min(1, "Deadline wajib diisi"),
  prerequisiteCoreId: z.string().optional(),
  refWoId: z.string().optional(),
  note: z.string().optional(),
  status: z.string().min(1, "Status wajib diisi"),
});

export type CountdownFormValues = z.infer<typeof countdownFormSchema>;

interface ReferenceOption { label: string; value: string; }

interface CountdownReferences {
  divisions: ReferenceOption[];
  units: ReferenceOption[];
  panels: ReferenceOption[];
  sections?: ReferenceOption[];
  jobTypes: ReferenceOption[];
  taskCategories?: ReferenceOption[];
}

interface CountdownBoardFormProps {
  initialValues: CountdownFormValues | null;
  editorMode: "create" | "edit";
  references: CountdownReferences;
  isSaving: boolean;
  onCancel: () => void;
  onSubmit: (data: CountdownFormValues) => void;
}

export function CountdownBoardForm({ initialValues, editorMode, references, isSaving, onCancel, onSubmit }: CountdownBoardFormProps) {
  const { register, handleSubmit, watch, formState: { errors } } = useForm<CountdownFormValues>({
    resolver: zodResolver(countdownFormSchema),
    defaultValues: initialValues || {
      countdownId: "",
      carId: "",
      divisionId: "",
      panelId: "",
      taskCategory: "ADDITIONAL",
      sectionName: "",
      jobTypeId: "",
      targetHoursInitial: "",
      startDate: "",
      deadlineDate: "",
      prerequisiteCoreId: "",
      refWoId: "",
      note: "",
      status: "PLAN",
    },
    mode: "onChange",
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* ── Grup 1: Identitas Unit ── */}
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-white/25">Identitas Unit</p>
        <div className="grid gap-2 lg:grid-cols-4">
          <div>
            <FieldLabel required>Unit</FieldLabel>
            <CompactSelect {...register("carId")} value={watch("carId")}>
              <option value="">Pilih unit</option>
              {references.units.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
            </CompactSelect>
          </div>
          <div>
            <FieldLabel required>Divisi</FieldLabel>
            <CompactSelect {...register("divisionId")} value={watch("divisionId")}>
              <option value="">Pilih divisi</option>
              {references.divisions.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
            </CompactSelect>
          </div>
          <div>
            <FieldLabel>Panel</FieldLabel>
            <CompactSelect {...register("panelId")} value={watch("panelId")}>
              <option value="">Pilih panel</option>
              {references.panels.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </CompactSelect>
          </div>
          <div>
            <FieldLabel required>Kategori</FieldLabel>
            <CompactSelect {...register("taskCategory")} value={watch("taskCategory")}>
              <option value="ADDITIONAL">Additional</option>
              <option value="MAIN">Main</option>
            </CompactSelect>
          </div>
        </div>
      </div>

      {/* ── Grup 2: Detail Pekerjaan ── */}
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-white/25">Detail Pekerjaan</p>
        <div className="grid gap-2 lg:grid-cols-4">
          <div>
            <FieldLabel required>Status</FieldLabel>
            {editorMode === "create" ? (
              <div className="flex h-[30px] items-center rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] px-2.5">
                <span className="text-[11px] font-semibold tracking-wider text-emerald-400">PLAN</span>
                <input type="hidden" {...register("status")} value="PLAN" />
              </div>
            ) : (
              <CompactSelect {...register("status")} value={watch("status")}>
                <option value="PLAN">PLAN</option>
                <option value="PROSES">PROSES</option>
                <option value="QC_READY">QC_READY</option>
                <option value="DONE">DONE</option>
              </CompactSelect>
            )}
          </div>
          <div className="lg:col-span-2">
            <FieldLabel required>Section / Pekerjaan</FieldLabel>
            <CompactSelect {...register("sectionName")} value={watch("sectionName")}>
              <option value="">Pilih section</option>
              {(references.sections ?? []).map((section) => (
                <option key={section.value} value={section.value}>{section.label}</option>
              ))}
            </CompactSelect>
          </div>
          <div>
            <FieldLabel>Job Type</FieldLabel>
            <CompactSelect {...register("jobTypeId")} value={watch("jobTypeId")}>
              <option value="">Pilih job type</option>
              {references.jobTypes.map((j) => <option key={j.value} value={j.value}>{j.label}</option>)}
            </CompactSelect>
          </div>
        </div>
      </div>

      {/* ── Grup 3: Jadwal & Referensi ── */}
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-white/25">Jadwal &amp; Referensi</p>
        <div className="grid gap-2 lg:grid-cols-4">
          <div>
            <FieldLabel required>Target Jam</FieldLabel>
            <CompactInput type="text" placeholder="00:00" {...register("targetHoursInitial")} />
          </div>
          <div>
            <FieldLabel>Start Date</FieldLabel>
            <CompactInput type="date" {...register("startDate")} />
          </div>
          <div>
            <FieldLabel required>Deadline</FieldLabel>
            <CompactInput type="date" {...register("deadlineDate")} />
          </div>
          <div className="lg:col-span-1">
            <FieldLabel>Catatan</FieldLabel>
            <CompactTextarea rows={2} {...register("note")} />
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.05] bg-white/[0.01] px-3 py-2">
        <p className="text-[11px] text-white/35">
          {editorMode === "edit" ? "Edit Jobdesc" : "Form baru"}
        </p>
        <div className="flex gap-1.5">
          <ActionButton onClick={onCancel} type="button"><X className="h-3 w-3" />Batal</ActionButton>
          <ActionButton variant="success" type="submit" disabled={isSaving}>
            <Save className="h-3 w-3" />
            {isSaving ? "Menyimpan..." : editorMode === "edit" ? "Update" : "Simpan"}
          </ActionButton>
        </div>
      </div>
    </form>
  );
}
