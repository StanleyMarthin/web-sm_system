"use client";

import type { CountdownDetail } from "@smsystem/contracts/countdown";
import type { ReactNode } from "react";
import { SectionCard } from "@/shared/ui/compact";
import { formatCountdownStatusLabel, hasCountdownTargetRevision } from "../countdown-copy";

function DetailRow({ label, value, tone }: { label: string; value: string; tone?: "danger" | "success" }) {
  const valueTone = tone === "danger" ? "text-destructive" : tone === "success" ? "text-success" : "text-foreground";
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border px-3 py-2 last:border-b-0 dark:border-white/[0.06]">
      <dt className="shrink-0 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">{label}</dt>
      <dd className={`min-w-0 text-right text-[13px] ${valueTone}`}>{value || "-"}</dd>
    </div>
  );
}

/** Detail pekerjaan: satu sumber konteks countdown (divisi, jobdesc, target, PIC, jadwal, status). */
export function CountdownMasterPanel({
  countdown,
  revisionAction,
}: {
  countdown: CountdownDetail;
  /** Aksi Ajukan Perubahan deadline, dirender sebaris dengan nilai deadline. */
  revisionAction?: ReactNode;
}) {
  const statusLabel = formatCountdownStatusLabel({
    status: countdown.status,
    isOverdue: countdown.isOverdue,
    progressPercent: countdown.actualProgressPercent,
  });
  const targetRevised = hasCountdownTargetRevision(countdown);
  const notes = countdown.keterangan ?? countdown.note ?? null;

  return (
    <SectionCard label="Detail pekerjaan" collapsible defaultOpen>
      <dl className="border border-border dark:border-white/[0.06]">
        <DetailRow label="Divisi" value={countdown.divisionName ?? "Tanpa divisi"} />
        <DetailRow label="Temuan awal" value={countdown.temuanAwal ?? "-"} />
        <DetailRow label="Jobdesc" value={countdown.jobTypeName ?? countdown.sectionName ?? "-"} />
        <DetailRow label="Grade" value={countdown.requiredGrade ?? "-"} />
        <DetailRow label="Target awal" value={`${countdown.targetHoursInitial.toFixed(2)} jam`} />
        <DetailRow
          label={targetRevised ? "Target aktif (direvisi)" : "Target aktif"}
          value={`${countdown.targetHoursRevised.toFixed(2)} jam`}
        />
        <DetailRow label="Aktual" value={`${countdown.totalActualHours.toFixed(2)} jam`} />
        <DetailRow label="Sisa" value={`${countdown.remainingHours.toFixed(2)} jam`} />
        <DetailRow label="PIC" value={countdown.picName ?? countdown.picPlan ?? "-"} />
        <DetailRow label="Mulai" value={countdown.startDate ?? "-"} />
        <div className="flex items-center justify-between gap-4 border-b border-border px-3 py-2 dark:border-white/[0.06]">
          <dt className="shrink-0 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Deadline</dt>
          <dd className="flex min-w-0 items-center gap-2 text-right text-[13px] text-foreground">
            <span>{countdown.deadlineDate ?? "-"}</span>
            {revisionAction}
          </dd>
        </div>
        <DetailRow
          label="Status"
          value={statusLabel}
          tone={statusLabel === "Terlambat" ? "danger" : statusLabel === "Selesai" ? "success" : undefined}
        />
      </dl>

      {notes ? (
        <div className="border-t border-border pt-2 text-[12px] dark:border-white/[0.06]">
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Keterangan</p>
          <p className="mt-1 whitespace-pre-line text-foreground">{notes}</p>
        </div>
      ) : null}
    </SectionCard>
  );
}
