"use client";

import type { CountdownDetail } from "@smsystem/contracts/countdown";
import Link from "next/link";
import { fmtDateTime, humanizeCodeLabel } from "@/shared/format/humanize";
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
    <SectionCard label="Unit & master panel">
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <DetailField label="Unit" value={`${countdown.unitName} · ${countdown.carId}`} />
        <DetailField label="Pelanggan" value={countdown.customerName ?? "-"} />
        <DetailField label="Divisi" value={countdown.divisionName ?? "Tanpa divisi"} />
        <DetailField label="Panel" value={countdown.panelName ?? "Panel belum ditentukan"} />
        <DetailField label="Bagian" value={countdown.sectionName ?? "Bagian belum ditentukan"} />
        <DetailField label="Jobdesc" value={countdown.jobTypeName ?? humanizeCodeLabel(countdown.taskCategory)} />
        <DetailField label="Kategori" value={humanizeCodeLabel(countdown.taskCategory)} />
        <DetailField label="Mulai" value={countdown.startDate ?? "-"} />
        <DetailField label="Deadline" value={countdown.deadlineDate ?? "-"} />
        <DetailField label="Diperbarui" value={countdown.updatedAt ? fmtDateTime(countdown.updatedAt) : "-"} />
        <DetailField label="Temuan awal" value={countdown.temuanAwal ?? "-"} />
        <DetailField label="Keterangan" value={countdown.keterangan ?? countdown.note ?? "-"} />
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
