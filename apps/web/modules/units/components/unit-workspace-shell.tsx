"use client";

import type { UnitBoardRow, UnitWorkspace } from "@smsystem/contracts/unit";
import type { UnitBomWorkspace } from "@smsystem/contracts/unit-bom";
import type { UnitPanelCollection } from "@smsystem/contracts/unit-panel";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  ClipboardList,
  Clock3,
  Gauge,
  ShieldAlert,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BomTrackerTab } from "@/modules/units/components/bom-tracker-tab";
import { MasterPanelManager } from "@/modules/units/components/master-panel-manager";
import { UnitCatalogTab } from "@/modules/units/components/unit-catalog-tab";
import { humanizeCodeLabel } from "@/shared/format/humanize";

interface UnitWorkspaceShellProps {
  unit: UnitBoardRow;
  workspace: UnitWorkspace;
  bom: UnitBomWorkspace | null;
  masterPanels: UnitPanelCollection | null;
  canManagePhotos: boolean;
  canDownloadPhotos: boolean;
  canManagePanels: boolean;
  canUseCatalog: boolean;
  canManageCatalog: boolean;
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
  remainingHours: number;
  progressPercent: number;
};

type UnitWorkspaceTab = "summary" | "catalog" | "parts-panels" | "master-panel";

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
  if (value === "catalog" || value === "parts-panels" || value === "master-panel") return value;
  return "summary";
}

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

function formatCount(value: number): string {
  return new Intl.NumberFormat("id-ID").format(value);
}

function formatHours(value: number): string {
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
        remainingHours: division.remainingHours,
        progressPercent: division.progressPercent,
      }))
      .sort((a, b) => {
        const aIncomplete = a.progressPercent < 100 ? 1 : 0;
        const bIncomplete = b.progressPercent < 100 ? 1 : 0;
        if (aIncomplete !== bIncomplete) return bIncomplete - aIncomplete;
        if (a.remainingHours !== b.remainingHours) return b.remainingHours - a.remainingHours;
        return a.progressPercent - b.progressPercent;
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
          remainingHours: 0,
          progressPercent: 0,
        };
      }
      acc[key].totalItems += 1;
      acc[key].doneItems += item.status.toUpperCase() === "DONE" ? 1 : 0;
      acc[key].remainingHours += item.remainingHours;
      acc[key].progressPercent += item.actualProgressPercent;
      return acc;
    }, {}),
  )
    .map((division) => ({
      ...division,
      progressPercent: division.totalItems > 0 ? division.progressPercent / division.totalItems : 0,
    }))
    .sort((a, b) => {
      const aIncomplete = a.progressPercent < 100 ? 1 : 0;
      const bIncomplete = b.progressPercent < 100 ? 1 : 0;
      if (aIncomplete !== bIncomplete) return bIncomplete - aIncomplete;
      if (a.remainingHours !== b.remainingHours) return b.remainingHours - a.remainingHours;
      return a.progressPercent - b.progressPercent;
    });
}

function buildDeliveryBadge(unit: UnitBoardRow, workspace: UnitWorkspace, unitStatus: string) {
  const target = unit.targetDeliveryDate;
  const eta = unit.etaDate;

  if (clampPercent(unit.progressPercent) === 100 && unit.remainingHours <= 0) {
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
  const topDivision = divisions.find((division) => clampPercent(division.progressPercent) < 100);

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
          helper: `${formatHours(topDivision.remainingHours)} tersisa dengan progres ${clampPercent(topDivision.progressPercent)}%.`,
          tone: topDivision.remainingHours > 0 ? ("warning" as const) : ("default" as const),
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
  canManagePanels,
  canUseCatalog,
  canManageCatalog,
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
  const incompleteDivisions = divisionStats.filter((division) => clampPercent(division.progressPercent) < 100);
  const overallProgress = clampPercent(unit.progressPercent);
  const totalCountdown = Math.max(workspace.countdownSummary.total, 1);
  const workflowSegments = [
    {
      label: "Selesai",
      count: workspace.countdownSummary.done,
      width: (workspace.countdownSummary.done / totalCountdown) * 100,
      barClass: "bg-success",
      textClass: "text-success",
    },
    {
      label: "Dikerjakan",
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
      label: "Terjadwal",
      count: workspace.countdownSummary.plan,
      width: (workspace.countdownSummary.plan / totalCountdown) * 100,
      barClass: "bg-info",
      textClass: "text-info",
    },
  ].filter((segment) => segment.count > 0 || workspace.countdownSummary.total === 0);
  const totalDivisionRemainingHours = divisionStats.reduce((sum, division) => sum + division.remainingHours, 0);
  const priorityCards = buildPriorityCards(unit, workspace, divisionStats, deliveryBadge.label);
  const scheduleHealth = buildScheduleHealth(unit, deliveryBadge.label);
  const activeDivisionStats = incompleteDivisions.length > 0 ? incompleteDivisions : divisionStats;
  const completedDivisionCount = Math.max(divisionStats.length - incompleteDivisions.length, 0);
  const visibleDivisionStats = activeDivisionStats.slice(0, 4);
  const hiddenActiveDivisionCount = Math.max(activeDivisionStats.length - visibleDivisionStats.length, 0);
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
                Advisor: {unit.advisorName || "-"}
              </span>
              <span className={`border px-2.5 py-1 font-medium ${deliveryBadge.cls}`}>
                {deliveryBadge.label}
              </span>
            </div>
          </div>
          <Link
            href="/units"
            className="inline-flex h-10 items-center gap-2 border border-border px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali ke daftar unit
          </Link>
        </div>
      </section>

      {activeTab === "summary" ? (
        <div className="space-y-4 xl:h-[calc(100vh-250px)] xl:overflow-hidden">
          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <MetricCard
              icon={Gauge}
              label="Progres"
              value={`${overallProgress}%`}
              helper={`${formatCount(workspace.countdownSummary.done)} selesai`}
              tone={overallProgress >= 100 ? "success" : "default"}
            />
            <MetricCard
              icon={CalendarClock}
              label="ETA"
              value={formatDate(unit.etaDate)}
              helper={scheduleHealth.label}
              tone={scheduleHealth.tone}
            />
            <MetricCard
              icon={CalendarClock}
              label="Target"
              value={formatDate(unit.targetDeliveryDate)}
              helper={unit.targetDeliveryDate ? "Jadwal kontrak" : "Belum ditetapkan"}
              tone={unit.targetDeliveryDate ? "default" : "warning"}
            />
            <MetricCard
              icon={Clock3}
              label="Sisa Jam"
              value={formatHours(unit.remainingHours)}
              helper={`${formatCount(incompleteDivisions.length)} divisi aktif`}
              tone={unit.remainingHours > 0 ? "warning" : "success"}
            />
            <MetricCard
              icon={ClipboardList}
              label="Siap QC"
              value={formatCount(workspace.countdownSummary.qcReady)}
              helper="Jobdesc menunggu QA"
              tone={workspace.countdownSummary.qcReady > 0 ? "warning" : "success"}
            />
            <MetricCard
              icon={ShieldAlert}
              label="Kendala"
              value={formatCount(unit.qcIssueOpenCount + unit.woOpenCount + workspace.issueSummary.open)}
              helper="QC, WO, pembahasan"
              tone={unit.qcIssueOpenCount + unit.woOpenCount + workspace.issueSummary.open > 0 ? "danger" : "success"}
            />
          </section>

          <section className="grid gap-4 xl:min-h-0 xl:grid-cols-[minmax(0,1.45fr)_360px]">
            <div className="border border-border bg-card px-4 py-4 xl:min-h-0">
              <SectionTitle
                icon={Activity}
                title="Peta Kerja"
                helper="Sekali lihat: posisi progres, tahap kerja, dan divisi penahan utama."
              />

              <div className="mt-4 space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-muted-foreground">Progres keseluruhan</span>
                    <span className="font-medium text-foreground">{overallProgress}%</span>
                  </div>
                  <div className="h-3 bg-muted">
                    <div className="h-3 bg-primary" style={{ width: `${overallProgress}%` }} />
                  </div>
                </div>

                <div className="border border-border px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] font-mono uppercase tracking-[0.16em] text-muted-foreground">
                      Sebaran Tahap Kerja
                    </p>
                    <p className="text-sm text-muted-foreground">{formatCount(workspace.countdownSummary.total)} jobdesc</p>
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
                    <div>
                      <p className="text-[11px] font-mono uppercase tracking-[0.16em] text-muted-foreground">
                        Divisi yang Masih Menahan
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">Hanya divisi aktif yang ditampilkan di ringkasan.</p>
                    </div>
                    <span className="border border-border px-2.5 py-1 text-xs text-muted-foreground">
                      {formatCount(activeDivisionStats.length)} divisi
                    </span>
                  </div>

                  {visibleDivisionStats.length === 0 ? (
                    <p className="px-4 py-4 text-sm text-muted-foreground">Semua divisi sudah tuntas.</p>
                  ) : (
                    <div className="divide-y divide-border">
                      {visibleDivisionStats.map((division) => {
                        const progress = clampPercent(division.progressPercent);
                        const remainingShare =
                          totalDivisionRemainingHours > 0
                            ? Math.round((division.remainingHours / totalDivisionRemainingHours) * 100)
                            : 0;
                        return (
                          <div
                            key={`${division.divisionId ?? "none"}:${division.divisionName}`}
                            className="grid gap-3 px-4 py-3 lg:grid-cols-[minmax(180px,1fr)_minmax(0,1.4fr)_110px_70px] lg:items-center"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-foreground">{division.divisionName}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatCount(division.doneItems)}/{formatCount(division.totalItems)} selesai
                              </p>
                            </div>
                            <div>
                              <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                                <span className="text-muted-foreground">Progres</span>
                                <span className="font-medium text-primary">{progress}%</span>
                              </div>
                              <div className="h-2 bg-muted">
                                <div className="h-2 bg-primary" style={{ width: `${progress}%` }} />
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-[11px] text-muted-foreground">Sisa Jam</p>
                              <p className="text-sm font-medium text-primary">{formatHours(division.remainingHours)}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[11px] text-muted-foreground">Porsi</p>
                              <p className="text-sm font-medium text-primary">{remainingShare}%</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="grid gap-4 xl:min-h-0 xl:grid-rows-[auto_auto_1fr]">
              <div className="border border-border bg-card px-4 py-4">
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
              </div>

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
                  {(hiddenActiveDivisionCount > 0 || completedDivisionCount > 0) ? (
                    <p className="pt-2 text-xs text-muted-foreground">
                      {hiddenActiveDivisionCount > 0
                        ? `${formatCount(hiddenActiveDivisionCount)} divisi aktif lain tidak ditampilkan. `
                        : ""}
                      {completedDivisionCount > 0
                        ? `${formatCount(completedDivisionCount)} divisi selesai disembunyikan dari ringkasan.`
                        : ""}
                    </p>
                  ) : null}
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
