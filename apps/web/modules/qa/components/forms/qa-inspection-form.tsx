"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  qaFollowupStatusSchema,
  qaIssueAreaSchema,
  qaIssueTypeSchema,
  qaPriorityLevelSchema,
  type QaUpdateInspectionRequest,
  type QaReferences,
} from "@smsystem/contracts/qa";

const qaInspectionSchema = z.object({
  issueType: z.union([qaIssueTypeSchema, z.literal("")]).nullable().optional(),
  issueArea: z.union([qaIssueAreaSchema, z.literal("")]).nullable().optional(),
  priorityLevel: z.union([qaPriorityLevelSchema, z.literal("")]).nullable().optional(),
  followupStatus: z.union([qaFollowupStatusSchema, z.literal("")]).nullable().optional(),
  issueCause: z.string().nullable().optional(),
  recommendation: z.string().nullable().optional(),
});

type QaInspectionFormValues = z.infer<typeof qaInspectionSchema>;

interface QaInspectionFormProps {
  initialValues: QaUpdateInspectionRequest | null;
  references: QaReferences;
  canEdit: boolean;
  isPending: boolean;
  onSubmit: (data: QaUpdateInspectionRequest) => void;
}

const inputCls =
  "h-10 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-foreground outline-none transition-colors focus:border-primary/30 [color-scheme:dark]";

export function QaInspectionForm({ initialValues, references, canEdit, isPending, onSubmit }: QaInspectionFormProps) {
  const { register, handleSubmit } = useForm<QaInspectionFormValues>({
    resolver: zodResolver(qaInspectionSchema),
    defaultValues: {
      issueType: initialValues?.issueType ?? "",
      issueArea: initialValues?.issueArea ?? "",
      priorityLevel: initialValues?.priorityLevel ?? "",
      followupStatus: initialValues?.followupStatus ?? "",
      issueCause: initialValues?.issueCause ?? "",
      recommendation: initialValues?.recommendation ?? "",
    },
    mode: "onChange",
  });

  const handleFormSubmit = (data: QaInspectionFormValues) => {
    onSubmit({
      issueType: data.issueType || null,
      issueArea: data.issueArea || null,
      priorityLevel: data.priorityLevel || null,
      followupStatus: data.followupStatus || null,
      issueCause: data.issueCause || null,
      recommendation: data.recommendation || null,
    });
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="grid gap-3 md:grid-cols-2">
      <label className="grid gap-1.5 text-sm text-foreground/70">
        <span>Jenis masalah</span>
        <select {...register("issueType")} disabled={!canEdit || isPending} className={inputCls}>
          <option className="bg-background text-foreground" value="">Pilih</option>
          {references.issueTypes.map((option) => (
            <option className="bg-background text-foreground" key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-1.5 text-sm text-foreground/70">
        <span>Area masalah</span>
        <select {...register("issueArea")} disabled={!canEdit || isPending} className={inputCls}>
          <option className="bg-background text-foreground" value="">Pilih</option>
          {references.issueAreas.map((option) => (
            <option className="bg-background text-foreground" key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-1.5 text-sm text-foreground/70">
        <span>Prioritas</span>
        <select {...register("priorityLevel")} disabled={!canEdit || isPending} className={inputCls}>
          <option className="bg-background text-foreground" value="">Pilih</option>
          {references.priorityLevels.map((option) => (
            <option className="bg-background text-foreground" key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-1.5 text-sm text-foreground/70">
        <span>Status follow-up</span>
        <select {...register("followupStatus")} disabled={!canEdit || isPending} className={inputCls}>
          <option className="bg-background text-foreground" value="">Pilih</option>
          {references.followupStatuses.map((option) => (
            <option className="bg-background text-foreground" key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-1.5 text-sm text-foreground/70 md:col-span-2">
        <span>Penyebab masalah</span>
        <textarea
          {...register("issueCause")}
          disabled={!canEdit || isPending}
          className="min-h-28 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary/30"
        />
      </label>

      <label className="grid gap-1.5 text-sm text-foreground/70 md:col-span-2">
        <span>Rekomendasi perbaikan</span>
        <textarea
          {...register("recommendation")}
          disabled={!canEdit || isPending}
          className="min-h-28 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary/30"
        />
      </label>

      <div className="mt-5 flex justify-end md:col-span-2">
        <button
          type="submit"
          disabled={!canEdit || isPending}
          className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Menyimpan..." : "Simpan Analisa QA"}
        </button>
      </div>
    </form>
  );
}
