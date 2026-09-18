"use client";

import type { QcQueueRecord } from "@smsystem/contracts/qc";
import { ShieldCheck } from "lucide-react";
import { DataGridStatusBadge } from "@/shared/datagrid/status-badge";
import { humanizeCodeLabel } from "@/shared/format/humanize";
import { SectionCard } from "@/shared/ui/compact";

function QcField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words text-[13px] text-foreground">{value || "-"}</dd>
    </div>
  );
}

export function CountdownQcSection({ qc, canViewQc }: { qc: QcQueueRecord | null; canViewQc: boolean }) {
  if (!canViewQc) {
    return (
      <SectionCard label="Pemeriksaan QC" collapsible defaultOpen={false}>
        <div className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <p className="text-[12px] text-muted-foreground">Status QC perlu akses modul QC.</p>
        </div>
      </SectionCard>
    );
  }

  if (!qc || (!qc.qcLastStatus && !qc.latestQcId)) {
    return (
      <SectionCard label="Pemeriksaan QC" collapsible defaultOpen={false}>
        <div className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="text-[13px] text-foreground">Belum ada pemeriksaan QC.</p>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              QC dijalankan setelah countdown berstatus QC READY dari modul QC.
            </p>
          </div>
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard label="Pemeriksaan QC" collapsible defaultOpen={false}>
      <dl className="grid gap-3 sm:grid-cols-2">
        <QcField label="Status" value={humanizeCodeLabel(qc.qcLastStatus ?? qc.countdownStatus)} />
        <QcField label="Level" value={qc.qcLevel ? humanizeCodeLabel(qc.qcLevel) : "-"} />
        <QcField label="Pemeriksaan terakhir" value={qc.latestInspectionDate ?? "-"} />
        <QcField label="Temuan terbuka" value={String(qc.openIssueCount)} />
        {qc.latestInspectionNotes ? <QcField label="Catatan" value={qc.latestInspectionNotes} /> : null}
        {qc.reworkTaskDate ? (
          <QcField
            label="Rework"
            value={`${qc.reworkTaskDate} · ${qc.reworkAssignedUserName ?? qc.reworkAssignedUserId ?? "Belum ada PIC"}`}
          />
        ) : null}
      </dl>
      {qc.qcLastStatus ? (
        <div className="border-t border-border pt-2 dark:border-white/[0.06]">
          <DataGridStatusBadge value={qc.qcLastStatus} />
        </div>
      ) : null}
    </SectionCard>
  );
}
