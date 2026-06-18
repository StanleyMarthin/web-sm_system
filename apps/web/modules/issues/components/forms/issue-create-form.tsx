"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus } from "lucide-react";
import type { IssueSeverity } from "@smsystem/contracts/issue";

const issueCreateSchema = z.object({
  carId: z.string().min(1, "Unit wajib diisi"),
  divisionId: z.string().optional(),
  issueType: z.string().min(1, "Jenis issue wajib diisi"),
  severity: z.string().min(1, "Tingkat prioritas wajib diisi"),
  title: z.string().min(1, "Judul issue wajib diisi"),
  description: z.string().min(1, "Deskripsi issue wajib diisi"),
});

export type IssueCreateFormValues = z.infer<typeof issueCreateSchema>;

interface IssueCreateFormProps {
  references: {
    units: { label: string; value: string }[];
    divisions: { label: string; value: string }[];
  };
  isSubmitting: boolean;
  message: string | null;
  error: string | null;
  onSubmit: (data: IssueCreateFormValues) => void;
}

export function IssueCreateForm({ references, isSubmitting, message, error, onSubmit }: IssueCreateFormProps) {
  const { register, handleSubmit, formState: { errors }, reset } = useForm<IssueCreateFormValues>({
    resolver: zodResolver(issueCreateSchema),
    defaultValues: {
      carId: "",
      divisionId: "",
      issueType: "HAMBATAN",
      severity: "MEDIUM",
      title: "",
      description: "",
    },
    mode: "onChange",
  });

  const onSubmitForm = (data: IssueCreateFormValues) => {
    onSubmit(data);
    // Reset handled outside after success
  };

  return (
    <form onSubmit={handleSubmit(onSubmitForm)} className="mt-5 space-y-4">
      <div>
        <select
          {...register("carId")}
          className="h-11 w-full rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 text-sm text-foreground outline-none focus:border-primary/30"
        >
          <option value="">Pilih unit</option>
          {references.units.map((unit) => (
            <option key={unit.value} value={unit.value}>
              {unit.label}
            </option>
          ))}
        </select>
        {errors.carId && <p className="mt-1 text-xs text-destructive">{errors.carId.message}</p>}
      </div>

      <div>
        <select
          {...register("divisionId")}
          className="h-11 w-full rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 text-sm text-foreground outline-none focus:border-primary/30"
        >
          <option value="">Auto dari scope/divisi</option>
          {references.divisions.map((division) => (
            <option key={division.value} value={division.value}>
              {division.label}
            </option>
          ))}
        </select>
        {errors.divisionId && <p className="mt-1 text-xs text-destructive">{errors.divisionId.message}</p>}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <input
            {...register("issueType")}
            placeholder="Jenis issue"
            className="h-11 w-full rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 text-sm text-foreground outline-none placeholder:text-foreground/20 focus:border-primary/30"
          />
          {errors.issueType && <p className="mt-1 text-xs text-destructive">{errors.issueType.message}</p>}
        </div>
        <div>
          <select
            {...register("severity")}
            className="h-11 w-full rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 text-sm text-foreground outline-none focus:border-primary/30"
          >
            <option value="LOW">LOW</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="HIGH">HIGH</option>
          </select>
          {errors.severity && <p className="mt-1 text-xs text-destructive">{errors.severity.message}</p>}
        </div>
      </div>

      <div>
        <input
          {...register("title")}
          placeholder="Judul issue"
          className="h-11 w-full rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 text-sm text-foreground outline-none placeholder:text-foreground/20 focus:border-primary/30"
        />
        {errors.title && <p className="mt-1 text-xs text-destructive">{errors.title.message}</p>}
      </div>

      <div>
        <textarea
          {...register("description")}
          placeholder="Deskripsi issue"
          rows={4}
          className="w-full rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 py-3 text-sm text-foreground outline-none placeholder:text-foreground/20 focus:border-primary/30"
        />
        {errors.description && <p className="mt-1 text-xs text-destructive">{errors.description.message}</p>}
      </div>

      {message ? <p className="text-sm text-success">{message}</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex h-11 items-center gap-2 rounded-2xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary disabled:opacity-60"
      >
        <Plus className="h-4 w-4" />
        {isSubmitting ? "Menyimpan..." : "Buat Issue"}
      </button>
    </form>
  );
}
