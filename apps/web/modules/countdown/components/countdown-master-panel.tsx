"use client";

import type { CountdownDetail } from "@smsystem/contracts/countdown";
import Link from "next/link";
import { SectionCard } from "@/shared/ui/compact";

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words text-[13px] text-foreground">{value || "-"}</dd>
    </div>
  );
}

export function CountdownMasterPanel({ countdown }: { countdown: CountdownDetail }) {
  return (
    <SectionCard label="Informasi panel" collapsible defaultOpen>
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <DetailField label="Panel" value={countdown.panelName ?? "Panel belum ditentukan"} />
        <DetailField label="Grade" value={countdown.requiredGrade ?? "-"} />
        <DetailField label="Target awal" value={`${countdown.targetHoursInitial.toFixed(2)} jam`} />
        <DetailField label="Deadline" value={countdown.deadlineDate ?? "-"} />
        <DetailField label="Temuan awal" value={countdown.temuanAwal ?? "-"} />
        <DetailField label="Instruksi" value={countdown.keterangan ?? countdown.note ?? countdown.jobTypeName ?? "-"} />
      </dl>

      {countdown.refWoId ? (
        <div className="border-t border-border pt-2 dark:border-white/[0.06]">
          <Link
            href={`/wo/${encodeURIComponent(countdown.refWoId)}`}
            className="inline-flex items-center gap-2 text-[12px] text-foreground transition-colors hover:text-app-accent-ink"
          >
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Work Order</span>
            <span className="font-medium">{countdown.refWoId}</span>
          </Link>
        </div>
      ) : null}
    </SectionCard>
  );
}
