"use client";

import { useEffect, useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
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
  sectionName: z.string().min(1, "Bagian wajib diisi"),
  jobTypeId: z.string().optional(),
  targetHoursInitial: z.string().regex(/^\d+:[0-5]\d$/, "Format jam harus HHH:MM (contoh: 120:30)"),
  startDate: z.string().optional(),
  deadlineDate: z.string().min(1, "Deadline wajib diisi"),
  prerequisiteCoreId: z.string().optional(),
  refWoId: z.string().optional(),
  note: z.string().optional(),
  temuanAwal: z.string().optional(),
  keterangan: z.string().optional(),
  status: z.string().min(1, "Status wajib diisi"),
});

export type CountdownFormValues = z.infer<typeof countdownFormSchema>;

interface ReferenceOption {
  label: string;
  value: string;
  code?: string | null;
  carId?: string | null;
  section?: string | null;
  category?: string | null;
  parentId?: number | null;
  parentName?: string | null;
  parentCode?: string | null;
  divisionId?: number | null;
  divisionName?: string | null;
  divisionParentId?: number | null;
  divisionParentName?: string | null;
  divisionParentCode?: string | null;
}

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

const emptyCountdownFormValues: CountdownFormValues = {
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
  temuanAwal: "",
  keterangan: "",
  status: "PLAN",
};

export function CountdownBoardForm({ initialValues, editorMode, references, isSaving, onCancel, onSubmit }: CountdownBoardFormProps) {
  const { register, control, handleSubmit, setValue, reset } = useForm<CountdownFormValues>({
    resolver: zodResolver(countdownFormSchema),
    defaultValues: initialValues || emptyCountdownFormValues,
    mode: "onChange",
  });
  const [
    selectedDivisionId = "",
    selectedCarId = "",
    selectedSectionName = "",
    selectedPanelId = "",
    selectedJobTypeId = "",
    selectedTaskCategory = "",
    selectedStatus = "",
  ] = useWatch({
    control,
    name: ["divisionId", "carId", "sectionName", "panelId", "jobTypeId", "taskCategory", "status"],
  });
  const selectedDivision = references.divisions.find((division) => division.value === selectedDivisionId);
  const selectedParentId = selectedDivision?.parentId ?? null;
  const selectedParentCode = (selectedDivision?.parentCode ?? selectedDivision?.parentName ?? "").trim().toUpperCase();
  const includeMechanicParent = selectedParentId !== null && selectedParentCode === "MECHANIC";
  const visibleJobTypes = useMemo(() => references.jobTypes.filter((jobType) => {
    if (!selectedDivisionId) return true;
    if (jobType.divisionId === null || jobType.divisionId === undefined) return true;
    if (String(jobType.divisionId) === selectedDivisionId) return true;
    return includeMechanicParent && jobType.divisionId === selectedParentId;
  }), [includeMechanicParent, references.jobTypes, selectedDivisionId, selectedParentId]);
  const visiblePanels = useMemo(() => references.panels.filter((panel) => {
    const matchesUnit = !selectedCarId || !panel.carId || panel.carId === selectedCarId;
    const matchesSection = !selectedSectionName || panel.section === selectedSectionName;
    return matchesUnit && matchesSection;
  }), [references.panels, selectedCarId, selectedSectionName]);

  useEffect(() => {
    if (selectedPanelId && !visiblePanels.some((panel) => panel.value === selectedPanelId)) {
      setValue("panelId", "");
    }
  }, [selectedPanelId, setValue, visiblePanels]);

  useEffect(() => {
    if (selectedJobTypeId && !visibleJobTypes.some((jobType) => jobType.value === selectedJobTypeId)) {
      setValue("jobTypeId", "");
    }
  }, [selectedJobTypeId, setValue, visibleJobTypes]);

  useEffect(() => {
    reset(initialValues || emptyCountdownFormValues);
  }, [initialValues, reset]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* ── Grup 1: Identitas Unit ── */}
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-foreground/25">Identitas Unit</p>
        <div className="grid gap-2 lg:grid-cols-5">
          <div>
            <FieldLabel required>Unit</FieldLabel>
            <CompactSelect {...register("carId")} value={selectedCarId}>
              <option value="">Pilih unit</option>
              {references.units.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
            </CompactSelect>
          </div>
          <div>
            <FieldLabel required>Tipe</FieldLabel>
            <CompactSelect {...register("taskCategory")} value={selectedTaskCategory}>
              <option value="MAIN">Main</option>
              <option value="ADDITIONAL">Additional</option>
            </CompactSelect>
          </div>
          <div>
            <FieldLabel required>Divisi</FieldLabel>
            <CompactSelect {...register("divisionId")} value={selectedDivisionId}>
              <option value="">Pilih divisi</option>
              {references.divisions.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
            </CompactSelect>
          </div>
          <div>
            <FieldLabel required>Bagian</FieldLabel>
            <CompactSelect {...register("sectionName")} value={selectedSectionName}>
              <option value="">Pilih bagian</option>
              {(references.sections ?? []).map((section) => (
                <option key={section.value} value={section.value}>{section.label}</option>
              ))}
            </CompactSelect>
          </div>
          <div>
            <FieldLabel>Panel</FieldLabel>
            <CompactSelect {...register("panelId")} value={selectedPanelId}>
              <option value="">Pilih panel</option>
              {visiblePanels.map((panel) => <option key={panel.value} value={panel.value}>{panel.label}</option>)}
            </CompactSelect>
          </div>
        </div>
      </div>

      {/* ── Grup 2: Detail Pekerjaan ── */}
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-foreground/25">Detail Job Description</p>
        <div className="grid gap-2 lg:grid-cols-4">
          <div>
            <FieldLabel required>Status</FieldLabel>
            {editorMode === "create" ? (
              <div className="flex h-[30px] items-center rounded-lg border border-success/20 bg-success/[0.06] px-2.5">
                <span className="text-[11px] font-semibold tracking-wider text-success">PLAN</span>
                <input type="hidden" {...register("status")} value="PLAN" />
              </div>
            ) : (
              <CompactSelect {...register("status")} value={selectedStatus}>
                <option value="PLAN">PLAN</option>
                <option value="PROSES">PROSES</option>
                <option value="QC_READY">QC_READY</option>
                <option value="DONE">DONE</option>
              </CompactSelect>
            )}
          </div>
          <div>
            <FieldLabel required>Jobdesc</FieldLabel>
            <CompactSelect {...register("jobTypeId")} value={selectedJobTypeId}>
              <option value="">Pilih jobdesc</option>
              {visibleJobTypes.map((jobType) => (
                <option key={jobType.value} value={jobType.value}>{jobType.label}</option>
              ))}
            </CompactSelect>
          </div>
          <div>
            <FieldLabel>Temuan Awal</FieldLabel>
            <CompactTextarea rows={2} {...register("temuanAwal")} />
          </div>
          <div>
            <FieldLabel>Keterangan</FieldLabel>
            <CompactTextarea rows={2} {...register("keterangan")} />
          </div>
        </div>
      </div>

      {/* ── Grup 3: Jadwal & Referensi ── */}
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-foreground/25">Jadwal &amp; Referensi</p>
        <div className="grid gap-2 lg:grid-cols-4">
          <div>
            <FieldLabel required>Target Awal</FieldLabel>
            <CompactInput type="text" placeholder="000:00" {...register("targetHoursInitial")} />
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
        <p className="text-[11px] text-foreground/35">
          {editorMode === "edit" ? "Edit Jobdesc" : "Form baru"}
        </p>
        <div className="flex gap-1.5">
          <ActionButton onClick={onCancel} type="button" disabled={isSaving}><X className="h-3 w-3" />Batal</ActionButton>
          <ActionButton variant="success" type="submit" disabled={isSaving}>
            <Save className="h-3 w-3" />
            {isSaving ? "Menyimpan..." : editorMode === "edit" ? "Update" : "Simpan"}
          </ActionButton>
        </div>
      </div>
    </form>
  );
}
