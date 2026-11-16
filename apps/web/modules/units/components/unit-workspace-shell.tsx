"use client";

import type { UnitBoardRow, UnitWorkspace } from "@smsystem/contracts/unit";
import type { UnitBomWorkspace } from "@smsystem/contracts/unit-bom";
import type { UnitPanelCollection } from "@smsystem/contracts/unit-panel";
import type { CountdownBoardRow } from "@smsystem/contracts/countdown";
import type { GridQueryState } from "@smsystem/contracts/grid";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Gauge,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BomTrackerTab } from "@/modules/units/components/bom-tracker-tab";
import { CountdownBoardShell } from "@/modules/countdown/components/countdown-board-shell";
import { MasterPanelManager } from "@/modules/units/components/master-panel-manager";
import { UnitCatalogTab } from "@/modules/units/components/unit-catalog-tab";
import { UnitDocumentationPanel } from "@/modules/units/components/unit-documentation-panel";
import { UnitVehicleDetailsPanel } from "@/modules/units/components/unit-vehicle-details-panel";
import { humanizeCodeLabel } from "@/shared/format/humanize";

interface UnitWorkspaceShellProps {
  unit: UnitBoardRow;
  workspace: UnitWorkspace;
  bom: UnitBomWorkspace | null;
  masterPanels: UnitPanelCollection | null;
  canManagePhotos: boolean;
  canDownloadPhotos: boolean;
  canManageUnit: boolean;
  canManagePanels: boolean;
  canCreateWo: boolean;
  canCreatePr: boolean;
  canCreateVendor: boolean;
  canUseCatalog: boolean;
  canManageCatalog: boolean;
  countdownBoard: {
    rows: CountdownBoardRow[];
    references: {
      divisions: Array<{ label: string; value: string; code?: string | null; parentId?: number | null; parentName?: string | null; parentCode?: string | null }>;
      units: Array<{ label: string; value: string }>;
      panels: Array<{ label: string; value: string; carId?: string | null; section?: string | null; category?: string | null }>;
      sections?: Array<{ label: string; value: string }>;
      jobTypes: Array<{ label: string; value: string; divisionId?: number | null; divisionName?: string | null; divisionParentId?: number | null; divisionParentName?: string | null; divisionParentCode?: string | null }>;
      taskCategories?: Array<{ label: string; value: string }>;
    };
    canManage: boolean;
    meta: { page: number; limit: number; total: number; totalPages: number; hasNext: boolean; hasPrev: boolean };
    state: GridQueryState;
  } | null;
}

type UnitStatusKey = "TOP_URGENT" | "URGENT" | "NORMAL" | "SLOW" | "HOLD";

type UnitBoardRowExtended = UnitBoardRow & {
  unitStatus?: UnitStatusKey | string | null;
};

type UnitWorkspaceExtended = UnitWorkspace & {
  qcIssueSummary?: {
    pembahasan?: number | null;
    onProgress?: number | null;
    done?: number | null;
    pending?: number | null;
  } | null;
  woSummary: UnitWorkspace["woSummary"] & {
    done?: number | null;
  };
};

type DivisionStat = {
  divisionId: number | null;
  divisionName: string;
  totalItems: number;
  doneItems: number;
  withActual: number;
  rawActualHours: number;
  targetHours: number;
  targetKnownCount: number;
  remainingHours: number | null;
  progressPercent: number;
  completionRate: number;
};

type UnitWorkspaceTab = "summary" | "catalog" | "parts-panels" | "master-panel" | "countdown";

const UNIT_STATUS_CONFIG: Record<UnitStatusKey, { label: string; cls: string }> = {
  TOP_URGENT: {
    label: "Sangat Mendesak",
    cls: "border-destructive/30 bg-destructive/10 text-destructive",
  },
  URGENT: {
    label: "Perlu Perhatian",
    cls: "border-primary/30 bg-primary/10 text-primary",
  },
  NORMAL: {
    label: "Aman",
    cls: "border-success/30 bg-success/10 text-success",
  },
  SLOW: {
    label: "Lambat",
    cls: "border-info/30 bg-info/10 text-info",
  },
  HOLD: {
    label: "Tertahan",
    cls: "border-border bg-muted/40 text-muted-foreground",
  },
};

const summaryLinkClass = "text-foreground transition-colors hover:text-primary";

function gridHref(
  path: string,
  filters: Record<string, string | number | null | undefined>,
  extras?: Record<string, string>,
) {
  const params = new URLSearchParams(extras);

  for (const [field, value] of Object.entries(filters)) {
    if (value == null || value === "") continue;
    params.append("filter", `${field}:eq:${String(value)}`);
  }

  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

function resolveTab(value: string | null): UnitWorkspaceTab {
  if (value === "catalog" || value === "parts-panels" || value === "master-panel" || value === "countdown") return value;
  return "summary";
}

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

function hoursProgress(actualHours: number, targetHours: number): number | null {
  if (targetHours <= 0) return null;
  return clampPercent((actualHours / targetHours) * 100);
}

function formatCount(value: number): string {
  return new Intl.NumberFormat("id-ID").format(value);
}

function formatHours(value: number | null): string {
  if (value == null) return "Belum ditetapkan";
  return `${value.toFixed(1)} jam`;
}

function formatDate(value: string | null): string {
  if (!value) return "-";
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

function diffDays(from: string | null, to: string | null): number | null {
  if (!from || !to) return null;
  const fromDate = new Date(`${from}T00:00:00`);
  const toDate = new Date(`${to}T00:00:00`);
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) return null;
  return Math.round((toDate.getTime() - fromDate.getTime()) / 86_400_000);
}

function buildDivisionStats(workspace: UnitWorkspace): DivisionStat[] {
  if ((workspace.divisionProgress?.length ?? 0) > 0) {
    return [...(workspace.divisionProgress ?? [])]
      .map((division) => ({
        divisionId: division.divisionId,
        divisionName: division.divisionName,
        totalItems: division.total,
        doneItems: division.done,
        withActual: division.withActual,
        rawActualHours: division.rawActualHours,
        targetHours: division.targetHours,
        targetKnownCount: division.targetKnownCount,
        remainingHours: division.remainingHours,
        progressPercent: division.progressPercent,
        completionRate: division.completionRate,
      }))
      .sort((a, b) => {
        const aIncomplete = a.completionRate < 100 ? 1 : 0;
        const bIncomplete = b.completionRate < 100 ? 1 : 0;
        if (aIncomplete !== bIncomplete) return bIncomplete - aIncomplete;
        if ((a.remainingHours ?? -1) !== (b.remainingHours ?? -1)) return (b.remainingHours ?? -1) - (a.remainingHours ?? -1);
        return a.completionRate - b.completionRate;
      });
  }

  const countdownItems = workspace.countdownItems ?? [];
  return Object.values(
    countdownItems.reduce<Record<string, DivisionStat>>((acc, item) => {
      const key = `${item.divisionId ?? "none"}:${item.divisionName}`;
      if (!acc[key]) {
        acc[key] = {
          divisionId: item.divisionId,
          divisionName: item.divisionName,
          totalItems: 0,
          doneItems: 0,
          withActual: 0,
          rawActualHours: 0,
          targetHours: 0,
          targetKnownCount: 0,
          remainingHours: null,
          progressPercent: 0,
          completionRate: 0,
        };
      }
      acc[key].totalItems += 1;
      acc[key].doneItems += item.status.toUpperCase() === "DONE" ? 1 : 0;
      acc[key].withActual += item.totalActualHours > 0 ? 1 : 0;
      acc[key].rawActualHours += item.totalActualHours;
      acc[key].targetHours += item.targetHoursRevised;
      acc[key].targetKnownCount += item.targetHoursRevised > 0 ? 1 : 0;
      if (item.targetHoursRevised <= 0 || item.remainingHours == null) {
        acc[key].remainingHours = null;
      } else if (acc[key].remainingHours != null) {
        acc[key].remainingHours += item.remainingHours;
      }
      acc[key].progressPercent += item.actualProgressPercent;
      acc[key].completionRate += item.status.toUpperCase() === "DONE" ? 100 : 0;
      return acc;
    }, {}),
  )
    .map((division) => ({
      ...division,
      progressPercent: division.totalItems > 0 ? division.progressPercent / division.totalItems : 0,
      completionRate: division.totalItems > 0 ? division.completionRate / division.totalItems : 0,
    }))
    .sort((a, b) => {
        const aIncomplete = a.completionRate < 100 ? 1 : 0;
        const bIncomplete = b.completionRate < 100 ? 1 : 0;
      if (aIncomplete !== bIncomplete) return bIncomplete - aIncomplete;
        if ((a.remainingHours ?? -1) !== (b.remainingHours ?? -1)) return (b.remainingHours ?? -1) - (a.remainingHours ?? -1);
        return a.completionRate - b.completionRate;
    });
}

function buildDeliveryBadge(unit: UnitBoardRow, workspace: UnitWorkspace, unitStatus: string) {
  const target = unit.targetDeliveryDate;
  const eta = unit.etaDate;

  if (clampPercent(workspace.countdownSummary.completionRate) === 100 && workspace.countdownSummary.remainingHours === 0) {
    return {
      label: "Selesai",
      cls: "border-success/30 bg-success/10 text-success",
    };
  }

  if (!target) {
    return {
      label: "Target belum ditetapkan",
      cls: "border-primary/30 bg-primary/10 text-primary",
    };
  }

  if (eta && eta > target) {
    return {
      label: "Lewat target",
      cls: "border-destructive/30 bg-destructive/10 text-destructive",
    };
  }

  if (workspace.deliveryRisk.level === "RED" || workspace.deliveryRisk.level === "ORANGE") {
    return {
      label: humanizeCodeLabel(unitStatus),
      cls: "border-destructive/30 bg-destructive/10 text-destructive",
    };
  }

  if (workspace.deliveryRisk.level === "YELLOW") {
    return {
      label: "Perlu perhatian",
      cls: "border-primary/30 bg-primary/10 text-primary",
    };
  }

  return {
    label: "Aman",
    cls: "border-success/30 bg-success/10 text-success",
  };
}

function buildScheduleHealth(unit: UnitBoardRow, deliveryBadgeLabel: string) {
  const delta = diffDays(unit.targetDeliveryDate, unit.etaDate);

  if (!unit.targetDeliveryDate) {
    return {
      label: "Target belum ada",
      helper: "Tanggal kontrak belum ditetapkan.",
      tone: "warning" as const,
    };
  }

  if (!unit.etaDate) {
    return {
      label: "ETA belum ada",
      helper: "Belum ada perkiraan selesai kerja.",
      tone: "warning" as const,
    };
  }

  if ((delta ?? 0) > 0) {
    return {
      label: `Mundur ${delta} hari`,
      helper: `ETA ${formatDate(unit.etaDate)} lewat dari target ${formatDate(unit.targetDeliveryDate)}.`,
      tone: "danger" as const,
    };
  }

  if ((delta ?? 0) < 0) {
    return {
      label: `Lebih cepat ${Math.abs(delta ?? 0)} hari`,
      helper: `ETA ${formatDate(unit.etaDate)} masih di depan target ${formatDate(unit.targetDeliveryDate)}.`,
      tone: "success" as const,
    };
  }

  return {
    label: deliveryBadgeLabel === "Selesai" ? "Selesai sesuai target" : "Sesuai target",
    helper: `ETA ${formatDate(unit.etaDate)} sama dengan target ${formatDate(unit.targetDeliveryDate)}.`,
    tone: deliveryBadgeLabel === "Selesai" ? ("success" as const) : ("default" as const),
  };
}

function buildPriorityCards(
  unit: UnitBoardRow,
  workspace: UnitWorkspace,
  divisions: DivisionStat[],
  deliveryBadgeLabel: string,
) {
  const topDivision = divisions.find((division) => clampPercent(division.completionRate) < 100);

  return [
    buildScheduleHealth(unit, deliveryBadgeLabel),
    unit.qcIssueOpenCount > 0
      ? {
          label: `${formatCount(unit.qcIssueOpenCount)} temuan QC aktif`,
          helper: "Perlu pembahasan atau penyelesaian dari tim terkait.",
          tone: "danger" as const,
        }
      : workspace.issueSummary.open > 0
        ? {
            label: `${formatCount(workspace.issueSummary.open)} pembahasan masih terbuka`,
            helper: "Cek issue yang menahan progres unit.",
            tone: "warning" as const,
          }
        : {
            label: "QC dan pembahasan aman",
            helper: "Belum ada temuan aktif yang menahan progres.",
            tone: "success" as const,
          },
    topDivision
      ? {
          label: `${topDivision.divisionName} paling berat`,
          helper: topDivision.remainingHours == null
            ? `Target belum lengkap. ${formatCount(topDivision.doneItems)}/${formatCount(topDivision.totalItems)} jobdesc selesai.`
            : `${formatHours(topDivision.remainingHours)} tersisa, ${formatCount(topDivision.doneItems)}/${formatCount(topDivision.totalItems)} jobdesc selesai.`,
          tone: topDivision.remainingHours != null && topDivision.remainingHours > 0 ? ("warning" as const) : ("default" as const),
        }
      : {
          label: "Semua divisi tuntas",
          helper: "Tidak ada divisi dengan pekerjaan tersisa.",
          tone: "success" as const,
        },
  ];
}

function MetricCard({
  icon: Icon,
  label,
  value,
  helper,
  tone = "default",
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  helper: string;
  tone?: "default" | "warning" | "danger" | "success";
}) {
  const toneClass = {
    default: "border-border",
    warning: "border-primary/20",
    danger: "border-destructive/20",
    success: "border-success/20",
  }[tone];

  const iconClass = {
    default: "text-primary",
    warning: "text-primary",
    danger: "text-destructive",
    success: "text-success",
  }[tone];

  return (
    <section className={`border bg-card px-4 py-4 ${toneClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
          <p className="mt-3 text-[2rem] font-semibold tracking-tight text-foreground">{value}</p>
          <p className="mt-2 text-sm text-muted-foreground">{helper}</p>
        </div>
        <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${iconClass}`} />
      </div>
    </section>
  );
}

function SectionTitle({
  icon: Icon,
  title,
  helper,
}: {
  icon: typeof Activity;
  title: string;
  helper?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 h-4 w-4 text-primary" />
      <div>
        <h2 className="text-[11px] font-mono uppercase tracking-[0.18em] text-muted-foreground">{title}</h2>
        {helper ? <p className="mt-1 text-sm text-muted-foreground">{helper}</p> : null}
      </div>
    </div>
  );
}

export function UnitWorkspaceShell({
  unit,
  workspace,
  bom,
  masterPanels,
  canManagePhotos,
  canDownloadPhotos,
  canManageUnit,
  canManagePanels,
  canCreateWo,
  canCreatePr,
  canCreateVendor,
  canUseCatalog,
  canManageCatalog,
  countdownBoard,
}: UnitWorkspaceShellProps) {
  const searchParams = useSearchParams();
  const requestedTab = resolveTab(searchParams.get("tab"));
  const activeTab = requestedTab === "catalog" && !canUseCatalog ? "summary" : requestedTab;
  const unitDetails = unit as UnitBoardRowExtended;
  const workspaceDetails = workspace as UnitWorkspaceExtended;
  const woOpenCount = workspaceDetails.woSummary.open;
  const unitStatus = String(unitDetails.unitStatus ?? unit.riskLevel);
  const statusConfig = UNIT_STATUS_CONFIG[unitStatus as UnitStatusKey];
  const deliveryBadge = buildDeliveryBadge(unit, workspace, unitStatus);
  const divisionStats = buildDivisionStats(workspace);
  const overallCompletionRate = clampPercent(workspace.countdownSummary.completionRate);
  const workHoursProgress = hoursProgress(
    workspace.countdownSummary.rawActualHours,
    workspace.countdownSummary.targetHours,
  );
  const hasJobdesc = workspace.countdownSummary.total > 0;
  const totalCountdown = Math.max(workspace.countdownSummary.total, 1);
  const workflowSegments = [
    {
      label: "Sudah selesai",
      count: workspace.countdownSummary.done,
      width: (workspace.countdownSummary.done / totalCountdown) * 100,
      barClass: "bg-success",
      textClass: "text-success",
    },
    {
      label: "Sedang dikerjakan",
      count: workspace.countdownSummary.proses,
      width: (workspace.countdownSummary.proses / totalCountdown) * 100,
      barClass: "bg-primary",
      textClass: "text-primary",
    },
    {
      label: "Siap QC",
      count: workspace.countdownSummary.qcReady,
      width: (workspace.countdownSummary.qcReady / totalCountdown) * 100,
      barClass: "bg-warning",
      textClass: "text-warning",
    },
    {
      label: "Belum dikerjakan",
      count: workspace.countdownSummary.planWithoutActual,
      width: (workspace.countdownSummary.planWithoutActual / totalCountdown) * 100,
      barClass: "bg-info",
      textClass: "text-info",
    },
    {
      label: "Riwayat kerja ada",
      count: workspace.countdownSummary.planWithActual,
      width: (workspace.countdownSummary.planWithActual / totalCountdown) * 100,
      barClass: "bg-primary/60",
      textClass: "text-primary",
    },
  ].filter((segment) => segment.count > 0);
  const priorityCards = buildPriorityCards(unit, workspace, divisionStats, deliveryBadge.label);
  const visibleDivisionStats = divisionStats;
  const scheduleDeltaDays = diffDays(unit.targetDeliveryDate, unit.etaDate);

  return (
    <div className="space-y-6">
      <section className="border border-border bg-card px-4 py-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-2">
            <div className="space-y-1">
              <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
                Ringkasan Unit
              </p>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">{unit.unitName}</h1>
              <p className="text-sm text-muted-foreground">
                {unit.customerName ?? "-"} · {unit.unitId}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="border border-border px-2.5 py-1 text-muted-foreground">
                Kepala project: {unit.kpName || "-"}
              </span>
              <span className="border border-border px-2.5 py-1 text-muted-foreground">
                QA: {unit.advisorName || "-"}
              </span>
              <span className="border border-border px-2.5 py-1 text-muted-foreground">
                Kepala divisi: {unit.kdName || "-"}
              </span>
              <span className={`border px-2.5 py-1 font-medium ${deliveryBadge.cls}`}>
                {deliveryBadge.label}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <UnitVehicleDetailsPanel unit={unit} canManage={canManageUnit} />
            <Link
              href="/units"
              className="inline-flex h-10 items-center gap-2 border border-border px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Kembali ke daftar unit
            </Link>
          </div>
        </div>
      </section>

      {activeTab === "summary" ? (
        <div className="space-y-4">
          <UnitDocumentationPanel unitId={unit.unitId} canManage={canManagePanels} />
          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <MetricCard
              icon={Gauge}
              label="Status selesai"
              value={`${overallCompletionRate}%`}
              helper={`${formatCount(workspace.countdownSummary.done)} dari ${formatCount(workspace.countdownSummary.total)} status DONE`}
              tone={overallCompletionRate >= 100 ? "success" : "default"}
            />
            <MetricCard
              icon={Clock3}
              label="Total Jam Aktual"
              value={formatHours(workspace.countdownSummary.rawActualHours)}
              helper={workHoursProgress == null
                ? `${formatCount(workspace.countdownSummary.withActual)} jobdesc memiliki riwayat kerja`
                : `${workHoursProgress}% dari total target jam`}
              tone="default"
            />
            <MetricCard
              icon={Clock3}
              label="Total Target Jam"
              value={workspace.countdownSummary.targetKnownCount > 0
                ? formatHours(workspace.countdownSummary.targetHours)
                : "Belum ditetapkan"}
              helper={`Target tersedia pada ${formatCount(workspace.countdownSummary.targetKnownCount)} dari ${formatCount(workspace.countdownSummary.total)} jobdesc`}
              tone={workspace.countdownSummary.targetKnownCount > 0 ? "default" : "warning"}
            />
            <MetricCard
              icon={Clock3}
              label="Sisa Jam Terukur"
              value={formatHours(workspace.countdownSummary.remainingHours)}
              helper={workspace.countdownSummary.remainingHours == null
                ? `Target tersedia pada ${formatCount(workspace.countdownSummary.targetKnownCount)} dari ${formatCount(workspace.countdownSummary.total)} jobdesc`
                : workspace.countdownSummary.overrunHours > 0
                  ? `Dihitung per jobdesc · overrun ${formatHours(workspace.countdownSummary.overrunHours)}`
                  : `Dihitung dari ${formatCount(workspace.countdownSummary.targetKnownCount)} pekerjaan bertarget`}
              tone={workspace.countdownSummary.remainingHours != null && workspace.countdownSummary.remainingHours > 0 ? "warning" : "default"}
            />
            <section className="border border-border bg-card px-4 py-4 md:col-span-2 xl:col-span-2">
              <SectionTitle
                icon={CircleAlert}
                title="Status Target"
                helper="Bahasa singkat untuk keputusan cepat."
              />
              <div className="mt-4 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`border px-2.5 py-1 text-sm font-medium ${deliveryBadge.cls}`}>
                    {deliveryBadge.label}
                  </span>
                  <span className="border border-border px-2.5 py-1 text-sm text-muted-foreground">
                    {scheduleDeltaDays == null
                      ? "Selisih belum ada"
                      : scheduleDeltaDays > 0
                        ? `Mundur ${scheduleDeltaDays} hari`
                        : scheduleDeltaDays < 0
                          ? `Lebih cepat ${Math.abs(scheduleDeltaDays)} hari`
                          : "Pas target"}
                  </span>
                </div>
                <p className="text-sm leading-6 text-foreground">{workspace.deliveryRisk.reason}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="border border-border px-3 py-2">
                    <p className="text-[11px] text-muted-foreground">Target</p>
                    <p className="mt-1 text-sm font-medium text-foreground">{formatDate(unit.targetDeliveryDate)}</p>
                  </div>
                  <div className="border border-border px-3 py-2">
                    <p className="text-[11px] text-muted-foreground">ETA</p>
                    <p className="mt-1 text-sm font-medium text-foreground">{formatDate(unit.etaDate)}</p>
                  </div>
                </div>
              </div>
            </section>
          </section>

          <section className="grid gap-4 xl:min-h-0 xl:grid-cols-[minmax(0,1.45fr)_360px]">
            <div className="border border-border bg-card px-4 py-4 xl:min-h-0">
              <SectionTitle
                icon={Activity}
                title="Pekerjaan Unit"
              />

              {!hasJobdesc ? (
                <div className="mt-4 border border-border px-4 py-3">
                  <p className="text-sm font-medium text-foreground">Belum ada pekerjaan</p>
                  <p className="mt-1 text-sm text-muted-foreground">Tambahkan jobdesc untuk mulai catat pekerjaan unit ini.</p>
                </div>
              ) : <div className="mt-4 space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-muted-foreground">Status selesai</span>
                    <span className="font-medium text-foreground">{overallCompletionRate}%</span>
                  </div>
                  <div className="h-3 bg-muted">
                    <div className="h-3 bg-primary" style={{ width: `${overallCompletionRate}%` }} />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-muted-foreground">Realisasi jam kerja</span>
                    <span className="font-medium text-foreground">
                      {workHoursProgress == null ? "-" : `${workHoursProgress}%`}
                    </span>
                  </div>
                  <div className="h-3 bg-muted">
                    <div className="h-3 bg-primary/70" style={{ width: `${workHoursProgress ?? 0}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatHours(workspace.countdownSummary.rawActualHours)} aktual dari {formatHours(workspace.countdownSummary.targetHours)} target.
                  </p>
                </div>

                <div className="border border-border px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-foreground">Posisi pekerjaan</p>
                    <p className="text-sm text-muted-foreground">
                      {formatCount(workspace.countdownSummary.total)} jobdesc · {formatHours(workspace.countdownSummary.rawActualHours)} aktual
                    </p>
                  </div>
                  <div className="mt-3 flex h-4 overflow-hidden bg-muted">
                    {workflowSegments.map((segment) => (
                      <div
                        key={segment.label}
                        className={segment.barClass}
                        style={{ width: `${segment.width}%` }}
                        title={`${segment.label}: ${formatCount(segment.count)}`}
                      />
                    ))}
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                    {workflowSegments.map((segment) => (
                      <div key={segment.label} className="flex items-center justify-between gap-2 text-sm">
                        <div className="flex items-center gap-2">
                          <span className={`h-2.5 w-2.5 ${segment.barClass}`} />
                          <span className="text-muted-foreground">{segment.label}</span>
                        </div>
                        <span className={`font-medium ${segment.textClass}`}>{formatCount(segment.count)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border border-border">
                  <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                    <p className="text-sm font-medium text-foreground">Kerja per divisi</p>
                    <span className="border border-border px-2.5 py-1 text-xs text-muted-foreground">
                      {formatCount(divisionStats.length)} divisi
                    </span>
                  </div>

                  {visibleDivisionStats.length === 0 ? (
                    <p className="px-4 py-4 text-sm text-muted-foreground">Semua pekerjaan sudah selesai.</p>
                  ) : (
                    <div className="divide-y divide-border">
                      {visibleDivisionStats.map((division) => {
                        const progress = hoursProgress(division.rawActualHours, division.targetHours);
                        return (
                          <div
                            key={`${division.divisionId ?? "none"}:${division.divisionName}`}
                            className="grid gap-3 px-4 py-3 lg:grid-cols-[minmax(180px,1fr)_minmax(0,1.4fr)_110px] lg:items-center"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-foreground">{division.divisionName}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatCount(division.doneItems)}/{formatCount(division.totalItems)} selesai · {formatCount(division.withActual)} ada riwayat
                              </p>
                            </div>
                            <div>
                              <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                                <span className="text-muted-foreground">Realisasi jam</span>
                                <span className="font-medium text-primary">{progress == null ? "-" : `${progress}%`}</span>
                              </div>
                              <div className="h-2 bg-muted">
                                <div className="h-2 bg-primary" style={{ width: `${progress ?? 0}%` }} />
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-[11px] text-muted-foreground">Aktual</p>
                              <p className="text-sm font-medium text-primary">{formatHours(division.rawActualHours)}</p>
                              <p className="mt-1 text-[11px] text-muted-foreground">Sisa kerja</p>
                              <p className="text-sm font-medium text-primary">{formatHours(division.remainingHours)}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>}
            </div>

            <div className="grid gap-4 xl:min-h-0 xl:grid-rows-[auto_auto_1fr]">
              <div className="border border-border bg-card px-4 py-4">
                <SectionTitle
                  icon={AlertTriangle}
                  title="Catatan Lapangan"
                  helper="Tiga fokus yang paling perlu dibereskan."
                />
                <div className="mt-3 divide-y divide-border">
                  {priorityCards.map((card) => (
                    <div key={card.label} className="flex flex-col gap-1 py-2 first:pt-0 last:pb-0">
                      <p
                        className={`text-sm font-semibold ${
                          card.tone === "danger"
                            ? "text-destructive"
                            : card.tone === "warning"
                              ? "text-warning"
                              : card.tone === "success"
                                ? "text-success"
                                : "text-foreground"
                        }`}
                      >
                        {card.label}
                      </p>
                      <p className="text-sm text-muted-foreground">{card.helper}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border border-border bg-card px-4 py-4">
                <SectionTitle
                  icon={Wrench}
                  title="Masuk Detail"
                  helper="Buka daftar kerja kalau perlu tindak lanjut."
                />
                <div className="mt-3 space-y-2 text-sm">
                  <Link
                    href={gridHref("/wo", { carId: unit.unitId, status: "OPEN" })}
                    className={`flex items-center justify-between gap-4 border border-border px-3 py-2 ${summaryLinkClass}`}
                  >
                    <span>WO terbuka</span>
                    <span>{formatCount(woOpenCount)}</span>
                  </Link>
                  <Link
                    href={gridHref("/issues", { carId: unit.unitId, status: "OPEN" })}
                    className={`flex items-center justify-between gap-4 border border-border px-3 py-2 ${summaryLinkClass}`}
                  >
                    <span>Pembahasan terbuka</span>
                    <span>{formatCount(workspace.issueSummary.open)}</span>
                  </Link>
                  <Link
                    href={gridHref("/qc/dashboard", { carId: unit.unitId, status: "OPEN" })}
                    className={`flex items-center justify-between gap-4 border border-border px-3 py-2 ${summaryLinkClass}`}
                  >
                    <span>Temuan QC aktif</span>
                    <span>{formatCount(workspaceDetails.qcIssueSummary?.pembahasan ?? unit.qcIssueOpenCount)}</span>
                  </Link>
                  <span
                    className={`inline-flex border px-2.5 py-1 text-[11px] font-mono uppercase tracking-[0.16em] ${
                      statusConfig?.cls ?? "border-border bg-muted/40 text-muted-foreground"
                    }`}
                  >
                    {statusConfig?.label ?? humanizeCodeLabel(unitStatus)}
                  </span>
                </div>
              </div>
            </div>
          </section>
        </div>
      ) : activeTab === "catalog" ? (
        <UnitCatalogTab unitId={unit.unitId} unitName={unit.unitName} canManageCatalog={canManageCatalog} />
      ) : activeTab === "parts-panels" ? (
        <BomTrackerTab
          carId={unit.unitId}
          unitName={unit.unitName}
          bom={bom}
          canManagePhotos={canManagePhotos}
          canDownloadPhotos={canDownloadPhotos}
          canManagePanels={canManagePanels}
        />
      ) : activeTab === "countdown" ? (
        countdownBoard ? (
          <CountdownBoardShell
            rows={countdownBoard.rows}
            references={{
              ...countdownBoard.references,
              units: [{ value: unit.unitId, label: unit.unitName }],
            }}
            canManage={countdownBoard.canManage}
            meta={countdownBoard.meta}
            state={countdownBoard.state}
          />
        ) : (
          <section className="border border-border bg-card px-4 py-4 text-sm text-muted-foreground">
            Countdown unit belum bisa dimuat.
          </section>
        )
      ) : (
        <MasterPanelManager
          key={`${unit.unitId}:master-panel:${masterPanels?.tree.length ?? "client"}`}
          unitId={unit.unitId}
          canManage={canManagePanels}
          canCreateWo={canCreateWo}
          canCreatePr={canCreatePr}
          canCreateVendor={canCreateVendor}
          initialRows={masterPanels?.tree}
        />
      )}
    </div>
  );
}
