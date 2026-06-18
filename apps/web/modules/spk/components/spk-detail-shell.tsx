"use client";

import type { SpkDetailRecord, SpkHeaderRecord, SpkPlannerAllocation } from "@smsystem/contracts/spk";
import { ArrowLeft, Play, Save, CheckCircle2, User, Clock } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { activateSpk, updateSpkDraftDetails } from "@/shared/api/spk";

interface SpkDetailShellProps {
  header: SpkHeaderRecord;
  details: SpkDetailRecord[];
  canStart: boolean;
  canEditBreakdown: boolean;
}

function statusClassName(status: string) {
  if (status === "ACTIVE") return "border-success/25 bg-success/[0.06] text-success";
  if (status === "DONE") return "border-white/10 bg-white/[0.03] text-foreground/50";
  if (status === "REJECTED") return "border-destructive/25 bg-destructive/[0.06] text-destructive";
  return "border-primary/25 bg-primary/[0.06] text-app-accent-ink";
}

export function SpkDetailShell({ header, details, canStart, canEditBreakdown }: SpkDetailShellProps) {
  const router = useRouter();
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Derive unique Units and Divisions for the Matrix
  const allocations = header.plannerMeta?.allocations || [];
  
  // Create fallback allocations if plannerMeta is empty (legacy)
  const effectiveAllocations = allocations.length > 0 ? allocations : details.map(d => ({
    allocationKey: `${d.unitNameSnapshot}::${d.divisionNameSnapshot}`,
    carId: d.unitNameSnapshot,
    unitName: d.unitNameSnapshot,
    divisionId: 0,
    divisionName: d.divisionNameSnapshot,
    targetHours: d.targetHoursSnapshot
  }));

  const units = useMemo(() => Array.from(new Set(effectiveAllocations.map(a => a.unitName))), [effectiveAllocations]);
  const divisions = useMemo(() => Array.from(new Set(effectiveAllocations.map(a => a.divisionName))), [effectiveAllocations]);

  async function handleStartSpk() {
    setError(null);
    setIsStarting(true);
    try {
      const result = await activateSpk(header.spkId);
      if (!result.success) {
        setError(result.message);
        return;
      }
      router.refresh();
    } finally {
      setIsStarting(false);
    }
  }

  const isReadOnly = header.status === "ACTIVE" || header.status === "DONE";
  const canStartSpk = canStart && !isReadOnly && (header.status === "DRAFT" || header.status === "APPROVED");

  return (
    <div className="space-y-4">
      <section className="border border-white/5 bg-card">
        <div className="flex flex-wrap items-center justify-between border-b border-white/5 px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={`/spk?date=${header.spkDate}`}
              className="inline-flex items-center gap-2 border border-white/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-foreground/40 hover:text-foreground hover:border-white/30 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Kembali
            </Link>
            <span className={`inline-flex border px-3 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] ${statusClassName(header.status)}`}>
              {header.status}
            </span>
          </div>
          <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-foreground/30">
            {header.spkNumber} • {header.spkDate}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <h1 className="text-[13px] font-mono text-foreground/80">Matriks Pekerjaan SPK</h1>
          </div>
          
          {canStartSpk && (
            <button
              onClick={handleStartSpk}
              disabled={isStarting}
              className="inline-flex h-10 items-center justify-center gap-2 bg-primary px-4 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-primary-foreground hover:bg-primary disabled:opacity-50"
            >
              <Play className="h-4 w-4" />
              {isStarting ? "Memulai..." : "Mulai SPK"}
            </button>
          )}
        </div>
        
        {error && <div className="border-t border-destructive/20 bg-destructive/[0.04] px-4 py-2 text-[11px] font-mono text-destructive">{error}</div>}
      </section>

      {/* Spreadsheet / Matrix View */}
      <section className="overflow-x-auto border border-white/5 bg-card">
        <table className="w-full text-left text-sm text-foreground dark:text-foreground/70">
          <thead className="border-b border-white/5 bg-background">
            <tr>
              <th className="sticky left-0 border-r border-white/5 bg-background px-4 py-2 font-mono text-[11px] uppercase tracking-[0.1em]">
                UNIT \ DIVISI
              </th>
              {divisions.map(div => (
                <th key={div} className="border-r border-white/5 px-4 py-2 text-center font-mono text-[11px] uppercase tracking-[0.1em]">
                  {div}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {units.map((unit, idx) => (
              <tr key={unit} className="transition-colors hover:bg-white/[0.015]">
                <td className="sticky left-0 border-r border-white/5 bg-card px-4 py-2 font-semibold text-foreground">
                  <span className="mr-2 font-mono text-[10px] text-foreground/25">{idx + 1}.</span>
                  {unit}
                </td>
                {divisions.map(div => {
                  const allocation = effectiveAllocations.find(a => a.unitName === unit && a.divisionName === div);
                  const detailRecords = details.filter(d => d.unitNameSnapshot === unit && d.divisionNameSnapshot === div);
                  
                  return (
                    <td key={div} className="border-r border-white/5 px-3 py-2 align-top">
                      {allocation ? (
                        <div className="flex flex-col gap-2">
                          <div className="border-b border-white/5 pb-2">
                            <span className="font-mono text-[9px] uppercase tracking-wider text-app-accent-ink">
                              Target PM: {allocation.targetHours} Jam
                            </span>
                          </div>
                          
                          {detailRecords.length > 0 ? (
                            detailRecords.map((d, i) => (
                              <div key={i} className="border border-white/5 bg-background px-3 py-2">
                                <div className="flex items-center gap-1 font-mono text-[11px] text-foreground/70">
                                  <User className="h-3 w-3" /> <span>{d.picNameSnapshot || 'Mekanik'}</span>
                                </div>
                                <div className="mt-1 flex items-center gap-1 font-mono text-[10px] text-foreground/30">
                                  <Clock className="h-3 w-3" /> {d.targetHoursSnapshot} jam
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="flex flex-col items-center justify-center p-2 text-foreground/30">
                              <span className="mt-1 font-mono text-[9px] text-foreground/20">(Mekanik blm ditentukan)</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex h-full items-center justify-center text-foreground/10">-</div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
