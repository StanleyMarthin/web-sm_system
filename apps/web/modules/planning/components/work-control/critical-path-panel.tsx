"use client";

import type { CriticalPathResult } from "@/modules/planning/types/planning.types";

interface CriticalPathPanelProps {
  result: CriticalPathResult | null;
  jobNames: Record<string, string>;
  divisionNames: Record<string, string>;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  }).format(date);
}

function blockerLabel(blocker: string): string {
  if (blocker === "HOLD_MATERIAL") return "Tunggu Material";
  if (blocker === "HOLD_VENDOR") return "Tunggu Vendor";
  if (blocker === "QC_REJECT") return "QC Reject";
  if (blocker === "WAITING_DIVISION") return "Tunggu Divisi Lain";
  if (blocker === "WAITING_APPROVAL") return "Menunggu Approval";
  return "Aman";
}

export function CriticalPathPanel({ result, jobNames, divisionNames }: CriticalPathPanelProps) {
  if (!result || result.nodes.length === 0) {
    return (
      <section className="border border-border bg-card px-4 py-4">
        <p className="font-mono text-[14px] uppercase tracking-[0.12em] text-muted-foreground">Critical Path</p>
        <p className="mt-2 text-[14px] text-muted-foreground">Pilih unit dan muat progress untuk melihat rantai pekerjaan kritis.</p>
      </section>
    );
  }

  const criticalNodes = result.nodes.filter((node) => node.isCritical);
  const riskyNode = criticalNodes.find((node) => node.blockedBy.length > 0) ?? criticalNodes.at(-1);

  return (
    <section className="border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono text-[14px] uppercase tracking-[0.12em] text-muted-foreground">Critical Path</p>
            <h3 className="mt-1 font-mono text-[14px] text-foreground">Rantai pekerjaan penentu delivery</h3>
          </div>
          <div className="grid grid-cols-3 gap-2 text-right">
            <div>
              <p className="font-mono text-[15px] uppercase tracking-[0.12em] text-muted-foreground">P50</p>
              <p className="font-mono text-[14px] text-foreground">{formatDate(result.p50Date)}</p>
            </div>
            <div>
              <p className="font-mono text-[15px] uppercase tracking-[0.12em] text-muted-foreground">P80</p>
              <p className="font-mono text-[14px] text-app-accent-ink">{formatDate(result.p80Date)}</p>
            </div>
            <div>
              <p className="font-mono text-[15px] uppercase tracking-[0.12em] text-muted-foreground">P95</p>
              <p className="font-mono text-[14px] text-destructive">{formatDate(result.p95Date)}</p>
            </div>
          </div>
        </div>
        {riskyNode ? (
          <p className="mt-2 text-[14px] text-muted-foreground">
            Titik paling perlu dijaga: {jobNames[riskyNode.jobId] ?? riskyNode.jobId}.
          </p>
        ) : null}
      </div>

      <div className="max-h-[300px] overflow-y-auto divide-y divide-border">
        {result.nodes.map((node) => (
          <div
            key={node.jobId}
            className={[
              "grid gap-3 px-4 py-3 lg:grid-cols-[minmax(0,1fr)_auto]",
              node.isCritical ? "bg-primary/[0.035]" : "",
            ].join(" ")}
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className={node.isCritical ? "font-mono text-[14px] text-app-accent-ink" : "font-mono text-[14px] text-foreground"}>
                  {jobNames[node.jobId] ?? node.jobId}
                </span>
                <span className="border border-border px-2 py-0.5 font-mono text-[15px] uppercase tracking-[0.12em] text-muted-foreground">
                  {divisionNames[node.divisionId] ?? `Divisi ${node.divisionId}`}
                </span>
                {node.blockedBy.map((blocker) => (
                  <span key={blocker} className="border border-primary/25 bg-primary/[0.06] px-2 py-0.5 font-mono text-[15px] uppercase tracking-[0.12em] text-app-accent-ink">
                    {blockerLabel(blocker)}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-[15px] text-muted-foreground">
                Mulai {formatDate(node.earliestStart)} · selesai {formatDate(node.finishDate)}
                {node.dependsOn.length > 0 ? ` · menunggu ${node.dependsOn.length} pekerjaan` : ""}
              </p>
            </div>
            <div className="grid min-w-[120px] grid-cols-2 gap-2">
              <div className="border border-border bg-background px-3 py-2">
                <p className="font-mono text-[15px] uppercase tracking-[0.12em] text-muted-foreground">Durasi</p>
                <p className="mt-1 font-mono text-[14px] text-foreground">{node.duration} hari</p>
              </div>
              <div className="border border-border bg-background px-3 py-2">
                <p className="font-mono text-[15px] uppercase tracking-[0.12em] text-muted-foreground">Status</p>
                <p className={node.isCritical ? "mt-1 font-mono text-[14px] text-app-accent-ink" : "mt-1 font-mono text-[14px] text-muted-foreground"}>
                  {node.isCritical ? "Kritis" : "Normal"}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

    </section>
  );
}
