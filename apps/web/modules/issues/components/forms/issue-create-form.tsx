"use client";

import type { IssueReferences } from "@smsystem/contracts/issue";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { SearchableSelect } from "@/shared/ui/compact";

const schema = z.object({
  planId: z.string().optional(), carId: z.string().min(1, "Unit wajib diisi"), divisionId: z.string().optional(),
  countdownId: z.string().optional(), issueType: z.string().min(1), severity: z.string().min(1),
  title: z.string().min(1, "Ringkasan wajib diisi"), description: z.string().min(1, "Detail wajib diisi"),
});
export type IssueCreateFormValues = z.infer<typeof schema>;

interface Props { references: IssueReferences; isSubmitting: boolean; message: string | null; error: string | null; onSubmit: (data: IssueCreateFormValues) => void; }
const input = "h-9 w-full border border-border bg-background px-3 text-[13px] text-foreground outline-none focus:border-primary/50 dark:border-white/[0.08]";

export function IssueCreateForm({ references, isSubmitting, message, error, onSubmit }: Props) {
  const [fromJobdesc, setFromJobdesc] = useState(true);
  const [selectedUnit, setSelectedUnit] = useState("");
  const [selectedPanel, setSelectedPanel] = useState("");
  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<IssueCreateFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { planId: "", countdownId: "", carId: "", divisionId: "", issueType: "HAMBATAN", severity: "MEDIUM", title: "", description: "" },
  });

  function selectJobdesc(planId: string) {
    const row = references.jobdescs.find((item) => item.value === planId);
    setValue("planId", planId); setValue("countdownId", row?.countdownId ?? "");
    if (!row) return;
    setValue("carId", row.carId); setValue("divisionId", row.divisionId === null ? "" : String(row.divisionId));
    setValue("title", row.title); setValue("description", row.description, { shouldValidate: true });
  }

  const panelOptions = useMemo(() => references.jobdescs
    .filter((row) => row.carId === selectedUnit)
    .filter((row, index, all) => all.findIndex((item) => item.panelValue === row.panelValue) === index), [references.jobdescs, selectedUnit]);
  const jobdescOptions = references.jobdescs.filter((row) => row.carId === selectedUnit && row.panelValue === selectedPanel);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-3">
      <div className="grid grid-cols-2 border border-border p-1 dark:border-white/[0.08]">
        <button type="button" onClick={() => setFromJobdesc(true)} className={`h-8 text-[12px] ${fromJobdesc ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Dari Jobdesc</button>
        <button type="button" onClick={() => { setFromJobdesc(false); selectJobdesc(""); }} className={`h-8 text-[12px] ${!fromJobdesc ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Pembahasan Umum</button>
      </div>
      {fromJobdesc ? (
        <div className="grid gap-2">
          <SearchableSelect value={selectedUnit} onChange={(value) => { setSelectedUnit(value); setSelectedPanel(""); selectJobdesc(""); setValue("carId", value); }} options={references.units} placeholder="1. Pilih unit" />
          <SearchableSelect value={selectedPanel} disabled={!selectedUnit} onChange={(value) => { setSelectedPanel(value); selectJobdesc(""); }} options={panelOptions.map((row) => ({ value: row.panelValue, label: row.panelLabel }))} placeholder="2. Pilih panel / part" />
          <SearchableSelect value={watch("planId") ?? ""} disabled={!selectedPanel} onChange={selectJobdesc} options={jobdescOptions.map((row) => ({ value: row.value, label: row.description }))} placeholder="3. Pilih jobdesc" />
        </div>
      ) : null}
      <input type="hidden" {...register("planId")} /><input type="hidden" {...register("countdownId")} />
      {fromJobdesc ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <div className={`${input} flex items-center text-muted-foreground`}>{references.units.find((row) => row.value === watch("carId"))?.label ?? "Unit mengikuti jobdesc"}</div>
          <div className={`${input} flex items-center text-muted-foreground`}>{references.divisions.find((row) => row.value === watch("divisionId"))?.label ?? "Divisi mengikuti jobdesc"}</div>
          <input type="hidden" {...register("carId")} /><input type="hidden" {...register("divisionId")} />
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          <SearchableSelect value={watch("carId")} onChange={(value) => setValue("carId", value, { shouldValidate: true })} options={references.units} placeholder="Pilih unit" />
          <SearchableSelect value={watch("divisionId") ?? ""} onChange={(value) => setValue("divisionId", value)} options={references.divisions} placeholder="Pilih divisi" />
          <input type="hidden" {...register("carId")} /><input type="hidden" {...register("divisionId")} />
        </div>
      )}
      {errors.carId ? <p className="text-[11px] text-destructive">{errors.carId.message}</p> : null}
      <div className="grid gap-2 sm:grid-cols-2">
        <select {...register("issueType")} className={input}><option value="HAMBATAN">Hambatan</option><option value="KUALITAS">Kualitas</option><option value="KOORDINASI">Koordinasi</option><option value="LAINNYA">Lainnya</option></select>
        <select {...register("severity")} className={input}><option value="LOW">Biasa</option><option value="MEDIUM">Perlu segera</option><option value="HIGH">Mendesak</option></select>
      </div>
      <input {...register("title")} placeholder="Apa yang perlu dibahas?" className={input} />
      <textarea {...register("description")} rows={4} placeholder="Jelaskan masalahnya" className={`${input} h-auto py-2`} />
      {errors.title || errors.description ? <p className="text-[11px] text-destructive">Lengkapi ringkasan dan detail pembahasan.</p> : null}
      {message ? <p className="text-[12px] text-success">{message}</p> : null}{error ? <p className="text-[12px] text-destructive">{error}</p> : null}
      <button type="submit" disabled={isSubmitting || (fromJobdesc && !watch("planId"))} className="inline-flex h-9 items-center gap-2 bg-primary px-4 text-[12px] font-semibold text-primary-foreground disabled:opacity-40"><Plus className="h-4 w-4" />{isSubmitting ? "Menyimpan..." : "Buat Pembahasan"}</button>
    </form>
  );
}
