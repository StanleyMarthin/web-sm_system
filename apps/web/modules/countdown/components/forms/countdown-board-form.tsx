"use client";

import { useEffect, useMemo, useRef } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ActionButton, CompactInput, CompactSelect, CompactTextarea, FieldLabel } from "@/shared/ui/compact";
import { Save, X } from "lucide-react";
import { formatCountdownStatus } from "../../countdown-copy";
import { mergeCountdownGradeOptions } from "../../countdown-dialog";
import {
  collectMissingCountdownFields,
  countdownTaskCategoryLabels,
  resolveCountdownFormSummary,
  resolveSectionFromPanel,
} from "../../countdown-form";

const countdownFormSchema = z.object({
  countdownId: z.string().optional(),
  carId: z.string().min(1, "Unit wajib dipilih"),
  divisionId: z.string().min(1, "Divisi wajib dipilih"),
  panelId: z.string().optional(),
  taskCategory: z.string().min(1, "Tipe wajib dipilih"),
  sectionName: z.string().min(1, "Bagian wajib dipilih dari master"),
  jobTypeId: z.string().min(1, "Jobdesc wajib dipilih dari master jobdesc"),
  targetHoursInitial: z.string().regex(/^\d+:[0-5]\d$/, "Format jam harus HHH:MM (contoh: 8:30)"),
  startDate: z.string().optional(),
  deadlineDate: z.string().min(1, "Deadline wajib diisi"),
  prerequisiteCoreId: z.string().optional(),
  refWoId: z.string().optional(),
  picPlan: z.string().optional(),
  requiredGrade: z.string().optional(),
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
  grade?: string | null;
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
  employees?: ReferenceOption[];
  grades?: ReferenceOption[];
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

export const emptyCountdownFormValues: CountdownFormValues = {
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
  picPlan: "",
  requiredGrade: "",
  note: "",
  temuanAwal: "",
  keterangan: "",
  status: "PLAN",
};

const taskCategoryOptions = Object.entries(countdownTaskCategoryLabels)
  .filter(([value]) => value === "MAIN" || value === "ADDITIONAL")
  .map(([value, label]) => ({ value, label }));

const statusOptions = ["PLAN", "PROSES", "QC_READY", "DONE"];

const requiredFieldLabels: Record<string, string> = {
  carId: "Unit",
  divisionId: "Divisi",
  sectionName: "Bagian",
  jobTypeId: "Jobdesc",
  targetHoursInitial: "Target jam",
  deadlineDate: "Deadline",
  taskCategory: "Tipe",
  status: "Status",
};

function SectionHeading({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-2 flex flex-wrap items-baseline gap-2">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-foreground/40">{title}</p>
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-[11px] text-destructive">{message}</p>;
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words text-[13px] text-foreground">{value || "-"}</dd>
    </div>
  );
}

export function CountdownBoardForm({ initialValues, editorMode, references, isSaving, onCancel, onSubmit }: CountdownBoardFormProps) {
  const { register, control, handleSubmit, setValue, reset, formState: { errors } } = useForm<CountdownFormValues>({
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
    selectedRequiredGrade = "",
    selectedPicPlan = "",
    selectedTargetHours = "",
    selectedStartDate = "",
    selectedDeadline = "",
    selectedTemuanAwal = "",
    selectedKeterangan = "",
  ] = useWatch({
    control,
    name: [
      "divisionId",
      "carId",
      "sectionName",
      "panelId",
      "jobTypeId",
      "taskCategory",
      "status",
      "requiredGrade",
      "picPlan",
      "targetHoursInitial",
      "startDate",
      "deadlineDate",
      "temuanAwal",
      "keterangan",
    ],
  });
  const selectedDivision = references.divisions.find((division) => division.value === selectedDivisionId);
  const selectedParentId = selectedDivision?.parentId ?? null;
  const visibleJobTypes = useMemo(() => references.jobTypes.filter((jobType) => {
    if (!selectedDivisionId) return true;
    if (jobType.divisionId === null || jobType.divisionId === undefined) return true;
    if (String(jobType.divisionId) === selectedDivisionId) return true;
    return jobType.divisionId === selectedParentId;
  }), [references.jobTypes, selectedDivisionId, selectedParentId]);
  const visiblePanels = useMemo(() => references.panels.filter((panel) => {
    const matchesUnit = !selectedCarId || !panel.carId || panel.carId === selectedCarId;
    const matchesSection = !selectedSectionName || panel.section === selectedSectionName;
    return matchesUnit && matchesSection;
  }), [references.panels, selectedCarId, selectedSectionName]);
  const gradeOptions = useMemo(() => {
    return mergeCountdownGradeOptions(references.grades, selectedRequiredGrade);
  }, [references.grades, selectedRequiredGrade]);

  const labels = useMemo(() => resolveCountdownFormSummary({
      carId: selectedCarId,
      panelId: selectedPanelId,
      divisionId: selectedDivisionId,
      picPlan: selectedPicPlan,
      jobTypeId: selectedJobTypeId,
      taskCategory: selectedTaskCategory,
    }, references), [references, selectedCarId, selectedDivisionId, selectedJobTypeId, selectedPanelId, selectedPicPlan, selectedTaskCategory]);

  const missingFields = collectMissingCountdownFields(errors, requiredFieldLabels);

  // Nilai lama tidak dibersihkan saat form dibuka, hanya saat user mengubah unit/bagian/divisi.
  const previousScopeRef = useRef({
    carId: selectedCarId,
    sectionName: selectedSectionName,
    divisionId: selectedDivisionId,
  });
  const previousPanelRef = useRef(selectedPanelId);

  useEffect(() => {
    const previous = previousScopeRef.current;
    const scopeChanged = previous.carId !== selectedCarId
      || previous.sectionName !== selectedSectionName
      || previous.divisionId !== selectedDivisionId;
    previousScopeRef.current = {
      carId: selectedCarId,
      sectionName: selectedSectionName,
      divisionId: selectedDivisionId,
    };
    if (!scopeChanged) return;

    if (selectedPanelId && !visiblePanels.some((panel) => panel.value === selectedPanelId)) {
      setValue("panelId", "");
    }
    if (selectedJobTypeId && !visibleJobTypes.some((jobType) => jobType.value === selectedJobTypeId)) {
      setValue("jobTypeId", "");
    }
  }, [
    selectedCarId,
    selectedDivisionId,
    selectedJobTypeId,
    selectedPanelId,
    selectedSectionName,
    setValue,
    visibleJobTypes,
    visiblePanels,
  ]);

  // Bagian mengikuti panel yang baru dipilih user, bukan saat form dibuka dengan data lama.
  useEffect(() => {
    const previousPanelId = previousPanelRef.current;
    previousPanelRef.current = selectedPanelId;
    if (!selectedPanelId || selectedPanelId === previousPanelId) return;

    const section = resolveSectionFromPanel(references.panels, selectedPanelId);
    if (section) setValue("sectionName", section, { shouldValidate: true });
  }, [references.panels, selectedPanelId, setValue]);

  useEffect(() => {
    reset(initialValues || emptyCountdownFormValues);
  }, [initialValues, reset]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="border border-border bg-background">
      <div className="space-y-5 p-4 sm:p-5">
        {/* ── Bagian 1: Unit & Panel ── */}
        <div>
          <SectionHeading title="1 · Unit & Panel" hint="Pilih unit, lalu bagian dan panel yang dikerjakan." />
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <div>
              <FieldLabel required>Unit</FieldLabel>
              <CompactSelect {...register("carId")} value={selectedCarId}>
                <option value="">Pilih unit</option>
                {references.units.map((unit) => <option key={unit.value} value={unit.value}>{unit.label}</option>)}
              </CompactSelect>
              <FieldError message={errors.carId?.message} />
            </div>
            <div>
              <FieldLabel required>Bagian</FieldLabel>
              <CompactSelect {...register("sectionName")} value={selectedSectionName}>
                <option value="">Pilih bagian</option>
                {(references.sections ?? []).map((section) => (
                  <option key={section.value} value={section.value}>{section.label}</option>
                ))}
              </CompactSelect>
              <FieldError message={errors.sectionName?.message} />
            </div>
            <div>
              <FieldLabel>Panel</FieldLabel>
              <CompactSelect {...register("panelId")} value={selectedPanelId}>
                <option value="">Pilih panel</option>
                {visiblePanels.map((panel) => <option key={panel.value} value={panel.value}>{panel.label}</option>)}
              </CompactSelect>
              {selectedSectionName && visiblePanels.length === 0 ? (
                <p className="mt-1 text-[11px] text-muted-foreground">Belum ada master panel untuk bagian ini.</p>
              ) : null}
            </div>
          </div>
        </div>

        {/* ── Bagian 2: Temuan & Instruksi ── */}
        <div>
          <SectionHeading title="2 · Temuan Awal & Instruksi" hint="Konteks pekerjaan yang dibaca operator di lapangan." />
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <FieldLabel>Temuan Awal</FieldLabel>
              <CompactTextarea rows={3} placeholder="Contoh: cat mengelupas di pilar kiri" {...register("temuanAwal")} />
            </div>
            <div>
              <FieldLabel>Instruksi</FieldLabel>
              <CompactTextarea
                rows={3}
                placeholder="Contoh: lepas trim, cat ulang, pasang kembali"
                {...register("keterangan", {
                  // note dan keterangan memakai kolom yang sama; keduanya dikirim agar isi tidak hilang saat dikosongkan.
                  onChange: (event) => setValue("note", event.target.value),
                })}
              />
            </div>
          </div>
        </div>

        {/* ── Bagian 3: Penanggung Jawab ── */}
        <div>
          <SectionHeading title="3 · Penanggung Jawab" hint="Divisi menentukan pilihan jobdesc dan PIC." />
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <div>
              <FieldLabel required>Divisi</FieldLabel>
              <CompactSelect {...register("divisionId")} value={selectedDivisionId}>
                <option value="">Pilih divisi</option>
                {references.divisions.map((division) => <option key={division.value} value={division.value}>{division.label}</option>)}
              </CompactSelect>
              <FieldError message={errors.divisionId?.message} />
            </div>
            <div>
              <FieldLabel>PIC</FieldLabel>
              <CompactSelect {...register("picPlan")} value={selectedPicPlan}>
                <option value="">Belum ditentukan</option>
                {(references.employees ?? []).map((employee) => (
                  <option key={employee.value} value={employee.value}>
                    {employee.grade ? `${employee.label} · ${employee.grade}` : employee.label}
                  </option>
                ))}
              </CompactSelect>
            </div>
            <div>
              <FieldLabel>Grade</FieldLabel>
              <CompactSelect {...register("requiredGrade")} value={selectedRequiredGrade}>
                <option value="">Tanpa grade</option>
                {gradeOptions.map((grade) => (
                  <option key={grade.value} value={grade.value}>{grade.label}</option>
                ))}
              </CompactSelect>
            </div>
          </div>
        </div>

        {/* ── Bagian 4: Perencanaan ── */}
        <div>
          <SectionHeading title="4 · Perencanaan" hint="Target jam dan deadline dipakai untuk menghitung sisa pekerjaan." />
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <div>
              <FieldLabel required>Jobdesc</FieldLabel>
              <CompactSelect {...register("jobTypeId")} value={selectedJobTypeId}>
                <option value="">Pilih jobdesc</option>
                {visibleJobTypes.map((jobType) => (
                  <option key={jobType.value} value={jobType.value}>{jobType.label}</option>
                ))}
              </CompactSelect>
              <FieldError message={errors.jobTypeId?.message} />
            </div>
            <div>
              <FieldLabel required>Tipe</FieldLabel>
              <CompactSelect {...register("taskCategory")} value={selectedTaskCategory}>
                {taskCategoryOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </CompactSelect>
              <FieldError message={errors.taskCategory?.message} />
            </div>
            <div>
              <FieldLabel required>Target jam</FieldLabel>
              <CompactInput type="text" placeholder="8:30" {...register("targetHoursInitial")} />
              <FieldError message={errors.targetHoursInitial?.message} />
            </div>
            <div>
              <FieldLabel>Tanggal mulai</FieldLabel>
              <CompactInput type="date" {...register("startDate")} />
            </div>
            <div>
              <FieldLabel required>Deadline</FieldLabel>
              <CompactInput type="date" {...register("deadlineDate")} />
              <FieldError message={errors.deadlineDate?.message} />
            </div>
            {editorMode === "edit" ? (
              <div>
                <FieldLabel required>Status</FieldLabel>
                <CompactSelect {...register("status")} value={selectedStatus}>
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>{formatCountdownStatus(status)}</option>
                  ))}
                </CompactSelect>
                <FieldError message={errors.status?.message} />
              </div>
            ) : (
              <div>
                <FieldLabel>Status awal</FieldLabel>
                <div className="flex h-9 items-center border border-success/20 bg-success/[0.06] px-3">
                  <span className="font-mono text-[11px] tracking-wider text-muted-foreground">
                    {formatCountdownStatus("PLAN")}
                  </span>
                </div>
                <input type="hidden" {...register("status")} />
              </div>
            )}
          </div>
        </div>

        {/* ── Bagian 5: Konfirmasi ── */}
        <div className="border border-border bg-muted/20 p-3">
          <SectionHeading
            title="5 · Konfirmasi"
            hint={editorMode === "edit"
              ? "Periksa perubahan sebelum memperbarui countdown."
              : "Periksa ringkasan sebelum menyimpan countdown baru."}
          />
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <SummaryItem label="Unit" value={labels.unit} />
            <SummaryItem label="Bagian" value={selectedSectionName} />
            <SummaryItem label="Panel" value={labels.panel} />
            <SummaryItem label="Divisi" value={labels.division} />
            <SummaryItem label="PIC" value={labels.employee} />
            <SummaryItem label="Grade" value={selectedRequiredGrade} />
            <SummaryItem label="Jobdesc" value={labels.jobType} />
            <SummaryItem label="Tipe" value={labels.taskCategory} />
            <SummaryItem label="Target jam" value={selectedTargetHours} />
            <SummaryItem label="Tanggal mulai" value={selectedStartDate} />
            <SummaryItem label="Deadline" value={selectedDeadline} />
            <SummaryItem label="Status" value={formatCountdownStatus(selectedStatus || "PLAN")} />
          </dl>
          <div className="mt-2 border-t border-border pt-2 text-[12px] dark:border-white/[0.06]">
            {missingFields.length > 0 ? (
              <p className="text-destructive">Lengkapi dulu: {missingFields.join(", ")}.</p>
            ) : (
              <p className="text-muted-foreground">
                Ringkasan temuan: {selectedTemuanAwal.trim() || "-"} · Instruksi: {selectedKeterangan.trim() || "-"}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border bg-card px-4 py-3 sm:px-5">
        <p className="text-[11px] text-foreground/35">
          {editorMode === "edit"
            ? "Perubahan tersimpan pada countdown ini."
            : "Countdown baru dibuat berstatus Rencana dan tetap di halaman Countdown."}
        </p>
        <div className="flex gap-1.5">
          <ActionButton onClick={onCancel} type="button" disabled={isSaving}><X className="h-3 w-3" />Batal</ActionButton>
          <ActionButton variant="success" type="submit" disabled={isSaving}>
            <Save className="h-3 w-3" />
            {isSaving ? "Menyimpan…" : editorMode === "edit" ? "Perbarui Countdown" : "Simpan Countdown"}
          </ActionButton>
        </div>
      </div>
    </form>
  );
}
