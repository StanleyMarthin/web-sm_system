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
      <section className="border border-white/5 bg-[#111114] px-4 py-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/30">Critical Path</p>
        <p className="mt-2 text-[12px] text-white/40">Pilih unit dan muat progress untuk melihat rantai pekerjaan kritis.</p>
      </section>
    );
  }

  const criticalNodes = result.nodes.filter((node) => node.isCritical);
  const riskyNode = criticalNodes.find((node) => node.blockedBy.length > 0) ?? criticalNodes.at(-1);

  return (
    <section className="border border-white/5 bg-[#111114]">
      <div className="border-b border-white/5 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/30">Critical Path</p>
            <h3 className="mt-1 font-mono text-[14px] text-white">Rantai pekerjaan penentu delivery</h3>
          </div>
          <div className="grid grid-cols-3 gap-2 text-right">
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-white/25">P50</p>
              <p className="font-mono text-[12px] text-white/75">{formatDate(result.p50Date)}</p>
            </div>
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-white/25">P80</p>
              <p className="font-mono text-[12px] text-amber-300">{formatDate(result.p80Date)}</p>
            </div>
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-white/25">P95</p>
              <p className="font-mono text-[12px] text-red-300">{formatDate(result.p95Date)}</p>
            </div>
          </div>
        </div>
        {riskyNode ? (
          <p className="mt-2 text-[12px] text-white/45">
            Titik paling perlu dijaga: {jobNames[riskyNode.jobId] ?? riskyNode.jobId}.
          </p>
        ) : null}
      </div>

      <div className="max-h-[300px] overflow-y-auto divide-y divide-white/5">
        {result.nodes.map((node) => (
          <div
            key={node.jobId}
            className={[
              "grid gap-3 px-4 py-3 lg:grid-cols-[minmax(0,1fr)_auto]",
              node.isCritical ? "bg-amber-500/[0.035]" : "",
            ].join(" ")}
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className={node.isCritical ? "font-mono text-[12px] text-amber-200" : "font-mono text-[12px] text-white/65"}>
                  {jobNames[node.jobId] ?? node.jobId}
                </span>
                <span className="border border-white/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-white/35">
                  {divisionNames[node.divisionId] ?? `Divisi ${node.divisionId}`}
                </span>
                {node.blockedBy.map((blocker) => (
                  <span key={blocker} className="border border-amber-500/25 bg-amber-500/[0.06] px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-amber-300">
                    {blockerLabel(blocker)}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-white/35">
                Mulai {formatDate(node.earliestStart)} · selesai {formatDate(node.finishDate)}
                {node.dependsOn.length > 0 ? ` · menunggu ${node.dependsOn.length} pekerjaan` : ""}
              </p>
            </div>
            <div className="grid min-w-[120px] grid-cols-2 gap-2">
              <div className="border border-white/5 bg-[#0a0a0c] px-3 py-2">
                <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-white/25">Durasi</p>
                <p className="mt-1 font-mono text-[12px] text-white/75">{node.duration} hari</p>
              </div>
              <div className="border border-white/5 bg-[#0a0a0c] px-3 py-2">
                <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-white/25">Status</p>
                <p className={node.isCritical ? "mt-1 font-mono text-[12px] text-amber-300" : "mt-1 font-mono text-[12px] text-white/45"}>
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
