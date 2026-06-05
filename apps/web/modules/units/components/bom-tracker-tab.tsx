"use client";

import type { UnitBomNode, UnitBomWorkspace } from "@smsystem/contracts/unit-bom";
import {
  Archive,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  MapPin,
  PackageCheck,
  PackageSearch,
  Wrench,
  XCircle,
} from "lucide-react";
import { Fragment, useCallback, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

interface BomTrackerTabProps {
  carId: string;
  bom: UnitBomWorkspace | null;
  canManagePhotos: boolean;
  canDownloadPhotos: boolean;
}

type TriageTone = "good" | "repair" | "replace" | "unknown";

interface TriageMeta {
  label: string;
  tone: TriageTone;
  className: string;
  icon: typeof CheckCircle2;
}

const cellCls = "px-3 py-3 align-middle text-sm text-white/75";

function collectExpandableNodeIds(nodes: UnitBomNode[]): string[] {
  const ids: string[] = [];
  for (const node of nodes) {
    if (node.children.length > 0) {
      ids.push(node.nodeId);
      ids.push(...collectExpandableNodeIds(node.children));
    }
  }
  return ids;
}

function triageMeta(node: UnitBomNode): TriageMeta {
  if (node.physicalStatus === "INSTALLED" || node.logisticStatus === "READY_GUDANG") {
    return {
      label: "BAGUS",
      tone: "good",
      className: "border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-300",
      icon: CheckCircle2,
    };
  }

  if (node.physicalStatus === "IN_DIVISION" || node.logisticStatus === "AT_VENDOR") {
    return {
      label: "REPAIR",
      tone: "repair",
      className: "border-amber-500/20 bg-amber-500/[0.06] text-amber-400",
      icon: Wrench,
    };
  }

  if (node.physicalStatus === "DISASSEMBLED" || node.logisticStatus === "ORDER_PR") {
    return {
      label: "REPLACE",
      tone: "replace",
      className: "border-red-500/20 bg-red-500/[0.06] text-red-300",
      icon: XCircle,
    };
  }

  return {
    label: "PERLU CEK",
    tone: "unknown",
    className: "border-white/10 bg-white/[0.03] text-white/40",
    icon: PackageSearch,
  };
}

function hierarchyText(node: UnitBomNode): string {
  const parts = [node.category, node.section].filter(Boolean);
  if (node.nodeType === "CATEGORY") return "Kelompok utama";
  if (node.nodeType === "SECTION") return node.category ? `Bagian dari ${node.category}` : "Sub kelompok";
  return parts.length > 0 ? parts.join(" > ") : "Belum masuk kelompok";
}

function hasOperationalTrace(node: UnitBomNode): boolean {
  if (node.actualId) return true;
  if (node.logisticStatus || node.logisticReference || node.logisticPath) return true;
  if ((node.detail?.timeline.length ?? 0) > 0) return true;
  if ((node.detail?.documents.length ?? 0) > 0) return true;
  if ((node.detail?.photos ?? []).some((slot) => slot.photoCount > 0)) return true;
  if (Number(node.progressPercent ?? 0) > 0) return true;
  if (Number(node.remainingHours ?? 0) > 0) return true;
  return Boolean(node.divisionId || node.divisionName);
}

function panelDetailKey(node: UnitBomNode): string | null {
  if (node.actualId) return node.actualId;
  if (node.panelId && hasOperationalTrace(node)) return `panel-${node.panelId}`;
  return null;
}

function ProgressBar({ value, tone }: { value: number | null; tone: TriageTone }) {
  const safeValue = Math.max(0, Math.min(100, Number(value ?? 0)));
  const barClass = tone === "replace" ? "bg-rose-400" : tone === "repair" ? "bg-amber-400" : "bg-white/35";

  return (
    <div className="mt-2 max-w-[160px]">
      <div className="h-1.5 overflow-hidden bg-white/[0.06]">
        <div className={`h-full transition-[width] ${barClass}`} style={{ width: `${safeValue}%` }} />
      </div>
      <p className="mt-1 text-[10px] tabular-nums text-white/35">{safeValue.toFixed(0)}% selesai</p>
    </div>
  );
}

function SummaryMetric({ label, value, tone, icon: Icon }: { label: string; value: number; tone?: string; icon: typeof Archive }) {
  return (
    <div className="border border-white/5 bg-[#111114] px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] uppercase tracking-[0.12em] text-white/30">{label}</p>
        <Icon className={`h-4 w-4 ${tone ?? "text-white/35"}`} />
      </div>
      <p className={`mt-2 text-[18px] font-mono tabular-nums ${tone ?? "text-white"}`}>{value}</p>
    </div>
  );
}

export function BomTrackerTab({
  carId,
  bom,
  canManagePhotos,
  canDownloadPhotos,
}: BomTrackerTabProps) {
  const router = useRouter();
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(
    () => new Set(bom ? bom.tree.map((node) => node.nodeId) : []),
  );

  const allExpandableNodeIds = useMemo(() => (bom ? collectExpandableNodeIds(bom.tree) : []), [bom]);

  const toggleNode = useCallback((nodeId: string) => {
    setExpandedNodeIds((current) => {
      const next = new Set(current);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  function renderRows(nodes: UnitBomNode[], depth = 0): ReactNode {
    return nodes.map((node) => {
      const isExpanded = expandedNodeIds.has(node.nodeId);
      const canExpand = node.children.length > 0;
      const indent = depth * 20;
      const isPart = node.nodeType === "PART";
      const triage = triageMeta(node);
      const TriageIcon = triage.icon;
      const location = triage.tone === "good" ? "Gudang" : node.divisionName ?? "Belum ditentukan";
      const detailKey = panelDetailKey(node);

      return (
        <Fragment key={node.nodeId}>
          <tr className={`border-t border-white/[0.05] ${isPart ? "bg-transparent hover:bg-white/[0.025]" : "bg-white/[0.02]"}`}>
            <td className={`${cellCls} min-w-[340px]`}>
              <div className="flex items-center gap-2" style={{ paddingLeft: `${indent}px` }}>
                {canExpand ? (
                  <button
                    type="button"
                    onClick={() => toggleNode(node.nodeId)}
                    className="p-1 text-white/40 hover:text-white transition-colors"
                    aria-label={isExpanded ? "Tutup kelompok" : "Buka kelompok"}
                  >
                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>
                ) : (
                  <span className="w-6" />
                )}
                {canExpand ? (
                  isExpanded ? <FolderOpen className="h-4 w-4 text-amber-400" /> : <Folder className="h-4 w-4 text-white/45" />
                ) : (
                  <PackageSearch className="h-4 w-4 text-white/45" />
                )}
                <div className="min-w-0">
                  <p className={isPart ? "truncate text-white" : "truncate text-white/85"}>{node.label}</p>
                  <p className="mt-0.5 truncate text-[11px] text-white/38">{hierarchyText(node)}</p>
                </div>
              </div>
            </td>

            <td className={`${cellCls} min-w-[140px]`}>
              {isPart ? (
                <span className={`inline-flex items-center gap-1.5 border px-2 py-0.5 text-[10px] font-mono uppercase tracking-[0.12em] ${triage.className}`}>
                  <TriageIcon className="h-3.5 w-3.5" />
                  {triage.label}
                </span>
              ) : (
                <span className="text-white/25">Kelompok</span>
              )}
            </td>

            <td className={`${cellCls} min-w-[220px]`}>
              {isPart ? (
                triage.tone === "good" ? (
                  <span className="inline-flex items-center gap-1.5 border border-emerald-500/20 bg-emerald-500/[0.04] px-2 py-0.5 text-[11px] font-medium text-emerald-300">
                    <PackageCheck className="h-3.5 w-3.5" />
                    Gudang
                  </span>
                ) : (
                  <div>
                    <div className="flex items-center gap-1.5 text-sm text-white/65">
                      <MapPin className="h-3.5 w-3.5 text-white/35" />
                      <span className="truncate">{location}</span>
                    </div>
                    <ProgressBar value={node.progressPercent} tone={triage.tone} />
                  </div>
                )
              ) : (
                <span className="text-white/20">-</span>
              )}
            </td>

            <td className={`${cellCls} min-w-[160px] text-right`}>
              {isPart ? (
                detailKey ? (
                  <button
                    type="button"
                    onClick={() => router.push(`/units/${carId}/panels/${detailKey}`)}
                    className="inline-flex items-center gap-2 border border-white/10 px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.08em] text-white/50 hover:border-white/30 hover:text-white transition-colors"
                  >
                    Riwayat & Detail
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <span className="border border-white/5 px-2.5 py-1 font-mono text-[10px] text-white/20">
                    Belum ada rekam
                  </span>
                )
              ) : (
                <span className="text-white/25">-</span>
              )}
            </td>

          </tr>
          {canExpand && isExpanded ? renderRows(node.children, depth + 1) : null}
        </Fragment>
      );
    });
  }

  if (!bom) {
    return (
      <section className="border border-white/5 bg-[#111114] px-4 py-3">
        <p className="text-[11px] uppercase tracking-[0.2em] text-amber-500/70">Katalog Part</p>
        <h2 className="mt-3 text-xl font-light text-white">Data BOM belum bisa dimuat</h2>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryMetric label="Total Part" value={bom.summary.totalParts} icon={Archive} />
        <SummaryMetric label="Bagus" value={bom.summary.installedParts} tone="text-emerald-300" icon={CheckCircle2} />
        <SummaryMetric label="Repair" value={bom.summary.inDivisionParts} tone="text-amber-300" icon={Wrench} />
        <SummaryMetric label="Replace" value={bom.summary.disassembledParts} tone="text-rose-300" icon={XCircle} />
      </div>

      <section className="border border-white/5 bg-[#111114]">
        <div className="flex flex-col gap-3 border-b border-white/5 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-[0.12em] text-white/30">Katalog Inventaris Unit</p>
            <h3 className="mt-0.5 text-[13px] font-mono text-white/80">Hierarki Komponen</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setExpandedNodeIds(new Set(allExpandableNodeIds))}
              className="border border-white/10 px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.12em] text-white/50 hover:text-white transition-colors"
            >
              Buka semua
            </button>
            <button
              type="button"
              onClick={() => setExpandedNodeIds(new Set())}
              className="border border-white/10 px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.12em] text-white/50 hover:text-white transition-colors"
            >
              Tutup semua
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0">
            <thead>
              <tr className="text-left text-[10px] font-mono uppercase tracking-[0.12em] text-white/30">
                <th className="px-3 py-3">Hierarki Komponen</th>
                <th className="px-3 py-3">Kondisi</th>
                <th className="px-3 py-3">Lokasi & Progress</th>
                <th className="px-3 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>{renderRows(bom.tree)}</tbody>
          </table>
        </div>
      </section>

    </div>
  );
}
