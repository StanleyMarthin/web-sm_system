"use client";

import type { UnitBoardRow, UnitWorkspace } from "@smsystem/contracts/unit";
import type { UnitBomWorkspace } from "@smsystem/contracts/unit-bom";
import type { UnitPanelCollection } from "@smsystem/contracts/unit-panel";
import { AlertTriangle, ArrowLeft, FileText, Wrench } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { BomTrackerTab } from "@/modules/units/components/bom-tracker-tab";
import { MasterPanelManager } from "@/modules/units/components/master-panel-manager";
import { humanizeCodeLabel } from "@/shared/format/humanize";

interface UnitWorkspaceShellProps {
  unit: UnitBoardRow;
  workspace: UnitWorkspace;
  bom: UnitBomWorkspace | null;
  masterPanels: UnitPanelCollection | null;
  canManagePhotos: boolean;
  canDownloadPhotos: boolean;
  canManagePanels: boolean;
}

function SummaryCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper?: string;
}) {
  return (
    <div className="border border-white/5 bg-[#111114] px-4 py-3">
      <p className="text-[10px] font-mono uppercase tracking-[0.12em] text-white/30">{label}</p>
      <p className="mt-1 text-[14px] font-mono text-white">{value}</p>
      {helper ? <p className="mt-0.5 text-[10px] text-white/30">{helper}</p> : null}
    </div>
  );
}

type UnitWorkspaceTab = "summary" | "parts-panels" | "master-panel";

function resolveTab(value: string | null): UnitWorkspaceTab {
  if (value === "parts-panels" || value === "master-panel") return value;
  return "summary";
}

export function UnitWorkspaceShell({
  unit,
  workspace,
  bom,
  masterPanels,
  canManagePhotos,
  canDownloadPhotos,
  canManagePanels,
}: UnitWorkspaceShellProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = resolveTab(searchParams.get("tab"));
  const countdownItems = workspace.countdownItems ?? [];

  // Aggregate countdownItems per divisi teknis
  const divisionStats = Object.values(
    countdownItems.reduce<Record<string, {
      divisionName: string;
      totalItems: number;
      doneItems: number;
      totalHours: number;
      remainingHours: number;
      progressSum: number;
    }>>((acc, item) => {
      const key = item.divisionName;
      if (!acc[key]) {
        acc[key] = {
          divisionName: item.divisionName,
          totalItems: 0,
          doneItems: 0,
          totalHours: 0,
          remainingHours: 0,
          progressSum: 0,
        };
      }
      acc[key].totalItems += 1;
      if (item.status === "DONE" || item.status === "done") acc[key].doneItems += 1;
      acc[key].remainingHours += item.remainingHours;
      acc[key].totalHours += item.remainingHours + (item.actualProgressPercent / 100) * (item.remainingHours / Math.max(1 - item.actualProgressPercent / 100, 0.001));
      acc[key].progressSum += item.actualProgressPercent;
      return acc;
    }, {})
  ).map((div) => ({
    ...div,
    avgProgress: div.progressSum / Math.max(div.totalItems, 1),
  })).sort((a, b) => b.avgProgress - a.avgProgress);

  function updateTab(nextTab: UnitWorkspaceTab) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", nextTab);
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="space-y-6">
      <div className="border border-white/5 bg-[#111114] px-4 py-3">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="mt-0.5 text-[14px] font-mono text-white">{unit.unitName}</h1>
            <p className="mt-0.5 text-[11px] font-mono text-white/40">
              {unit.customerName ?? "-"} · {unit.unitId}
            </p>
          </div>
          <Link
            href="/units"
            className="inline-flex items-center gap-2 border border-white/10 px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.12em] text-white/40 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali ke Daftar Unit
          </Link>
        </div>
      </div>

      <div className="border-b border-white/5">
        <div className="flex flex-wrap items-center gap-2">
          {([
            { id: "summary", label: "Summary" },
            { id: "parts-panels", label: "Parts & Panels" },
            { id: "master-panel", label: "Master Panel" },
          ] as const).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => updateTab(tab.id)}
              className={`px-4 py-2 text-[10px] font-mono uppercase tracking-[0.12em] transition-colors ${
                activeTab === tab.id
                  ? "border-b-2 border-amber-500 text-amber-500"
                  : "border-b-2 border-transparent text-white/40 hover:text-white/70"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "summary" ? (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard label="Target Delivery" value={unit.targetDeliveryDate ?? "-"} />
            <SummaryCard label="ETA" value={unit.etaDate ?? "-"} />
            <SummaryCard
              label="Risk"
              value={humanizeCodeLabel(unit.riskLevel)}
              helper={workspace.deliveryRisk.reason}
            />
            <SummaryCard label="Progress" value={`${Math.round(unit.progressPercent)}%`} />
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard label="Remaining Hours" value={`${unit.remainingHours.toFixed(2)} jam`} />
            <SummaryCard label="WO Open" value={String(unit.woOpenCount)} />
            <SummaryCard label="Issue Open" value={String(unit.issueOpenCount)} />
            <SummaryCard label="QC Issue Open" value={String(unit.qcIssueOpenCount)} />
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <section className="border border-white/5 bg-[#111114] px-4 py-3">
              <div className="flex items-center gap-3">
                <FileText className="h-3.5 w-3.5 text-amber-500" />
                <h2 className="text-[10px] font-mono uppercase tracking-[0.12em] text-white/30">
                  Ringkasan Countdown
                </h2>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-y-1 gap-x-3 text-[11px] font-mono text-white/60">
                <p>Total: {workspace.countdownSummary.total}</p>
                <p>Plan: {workspace.countdownSummary.plan}</p>
                <p>Proses: {workspace.countdownSummary.proses}</p>
                <p>Siap QC: {workspace.countdownSummary.qcReady}</p>
                <p>Selesai: {workspace.countdownSummary.done}</p>
                <p>Progress: {Math.round(workspace.countdownSummary.progressPercent)}%</p>
              </div>
            </section>

            <section className="border border-white/5 bg-[#111114] px-4 py-3">
              <div className="flex items-center gap-3">
                <FileText className="h-3.5 w-3.5 text-amber-500" />
                <h2 className="text-[10px] font-mono uppercase tracking-[0.12em] text-white/30">
                  Ringkasan WO
                </h2>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-y-1 gap-x-3 text-[11px] font-mono text-white/60">
                <p>Diajukan: {workspace.woSummary.submitted}</p>
                <p>Disetujui: {workspace.woSummary.approved}</p>
                <p>Ditolak: {workspace.woSummary.rejected}</p>
                <p>Open: {workspace.woSummary.open}</p>
              </div>
            </section>

            <section className="border border-white/5 bg-[#111114] px-4 py-3">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                <h2 className="text-[10px] font-mono uppercase tracking-[0.12em] text-white/30">
                  Ringkasan Issue
                </h2>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-y-1 gap-x-3 text-[11px] font-mono text-white/60">
                <p>Open: {workspace.issueSummary.open}</p>
                <p>Selesai: {workspace.issueSummary.resolved}</p>
                <p>High: {workspace.issueSummary.highSeverityOpen}</p>
                <p>Risk: {humanizeCodeLabel(workspace.deliveryRisk.level)}</p>
              </div>
            </section>
          </div>

          <div className="border border-white/5 bg-[#111114] px-4 py-3">
            <div className="flex items-center gap-3">
              <Wrench className="h-3.5 w-3.5 text-amber-500" />
              <h2 className="text-[10px] font-mono uppercase tracking-[0.12em] text-white/30">
                Ringkasan Risiko Pengiriman
              </h2>
            </div>
            <p className="mt-2 text-[11px] text-white/50">{workspace.deliveryRisk.reason}</p>
          </div>

          {/* Progress per Divisi Teknis */}
          <section className="border border-white/5 bg-[#111114]">
            <div className="flex items-center justify-between gap-2 border-b border-white/5 px-4 py-2">
              <div className="flex items-center gap-3">
                <Wrench className="h-3.5 w-3.5 text-amber-500" />
                <h2 className="text-[10px] font-mono uppercase tracking-[0.12em] text-white/30">
                  Progress per Divisi
                </h2>
              </div>
              <span className="text-xs text-white/35">{divisionStats.length} divisi</span>
            </div>

            {divisionStats.length === 0 ? (
              <p className="px-4 py-5 text-sm text-white/40">Belum ada data countdown untuk unit ini.</p>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {divisionStats.map((div) => (
                  <div key={div.divisionName} className="flex items-center gap-4 px-4 py-3">
                    <div className="min-w-[140px]">
                      <p className="text-sm font-medium text-white">{div.divisionName}</p>
                      <p className="mt-0.5 text-[11px] text-white/35">{div.totalItems} item</p>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2 text-[11px] text-white/45 mb-1">
                        <span>Progress</span>
                        <span className="tabular-nums font-medium text-white/70">{Math.round(div.avgProgress)}%</span>
                      </div>
                      <div className="h-1.5 bg-white/[0.06]">
                        <div
                          className="h-1.5 bg-amber-500 transition-[width]"
                          style={{ width: `${Math.round(div.avgProgress)}%` }}
                        />
                      </div>
                    </div>
                    <div className="text-right min-w-[110px]">
                      <p className="text-[11px] text-white/35">Sisa</p>
                      <p className="mt-0.5 tabular-nums text-sm text-white/80">{div.remainingHours.toFixed(1)} jam</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      ) : activeTab === "parts-panels" ? (
        <BomTrackerTab
          carId={unit.unitId}
          unitName={unit.unitName}
          bom={bom}
          canManagePhotos={canManagePhotos}
          canDownloadPhotos={canDownloadPhotos}
          canManagePanels={canManagePanels}
        />
      ) : (
        <MasterPanelManager
          key={`${unit.unitId}:master-panel:${masterPanels?.tree.length ?? "client"}`}
          unitId={unit.unitId}
          canManage={canManagePanels}
          initialRows={masterPanels?.tree}
        />
      )}
    </div>
  );
}
