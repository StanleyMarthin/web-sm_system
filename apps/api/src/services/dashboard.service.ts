import type { GridQueryState } from "@smsystem/contracts/grid";
import type {
  DashboardDeliveryRiskSection,
  DashboardManhourSummary,
  DashboardMonitoringFlags,
  DashboardPendingActions,
  DashboardQcTrendPoint,
  DashboardSummaryPayload,
} from "@smsystem/contracts/dashboard";
import { hasAnyPermission, permissionCodes } from "@smsystem/permissions";
import {
  buildDashboardQueryParams,
  MySqlDashboardRepository,
  type DashboardRepository,
} from "@/repositories/dashboard.repo";
import {
  DefaultCalendarService,
  type CalendarService,
} from "@/services/calendar.service";
import { TtlCache } from "@/lib/ttl-cache";
import type { WebSession } from "@/services/auth/session.service";

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseIsoDate(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, amount: number): Date {
  const value = new Date(date.getTime());
  value.setUTCDate(value.getUTCDate() + amount);
  return value;
}

function buildTrendWindow(asOfDate: string): string[] {
  const dates: string[] = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    dates.push(formatIsoDate(addDays(parseIsoDate(asOfDate), -offset)));
  }
  return dates;
}

function fillTrendGaps(
  asOfDate: string,
  rows: DashboardQcTrendPoint[],
): DashboardQcTrendPoint[] {
  const rowMap = new Map(rows.map((row) => [row.date, row]));
  return buildTrendWindow(asOfDate).map((date) => {
    const row = rowMap.get(date);
    return {
      date,
      passCount: row?.passCount ?? 0,
      rejectCount: row?.rejectCount ?? 0,
    };
  });
}

function buildScopeNote(session: WebSession): string {
  if (session.user.scope.canViewAllUnits) {
    return "Anda sedang melihat seluruh unit aktif yang menjadi perhatian tim.";
  }

  if (session.user.scope.canViewAssignedUnits) {
    return "Dashboard ini difokuskan pada unit yang sedang Anda pegang.";
  }

  if (session.user.scope.divisionIds.length > 0) {
    return `Dashboard ini difokuskan pada pekerjaan divisi ${session.user.divisionName}.`;
  }

  return "Dashboard ini hanya menampilkan pekerjaan yang memang terkait dengan akun Anda.";
}

function buildHighlights(summary: {
  kpis: DashboardSummaryPayload["kpis"];
  pendingActions: DashboardPendingActions | null;
  monitoringFlags: DashboardMonitoringFlags | null;
  manhour: DashboardManhourSummary | null;
}): string[] {
  const items: string[] = [];

  if (summary.kpis.overdueUnits > 0) {
    items.push(
      `${summary.kpis.overdueUnits} unit sudah melewati target serah terima dan perlu diprioritaskan.`,
    );
  } else if (summary.kpis.deliveryThisWeek > 0) {
    items.push(
      `${summary.kpis.deliveryThisWeek} unit masuk target serah terima minggu ini.`,
    );
  }

  if ((summary.pendingActions?.total ?? 0) > 0) {
    items.push(
      `${summary.pendingActions?.total ?? 0} antrean masih menunggu keputusan dari tim terkait.`,
    );
  }

  if ((summary.monitoringFlags?.delayRisk ?? 0) > 0) {
    items.push(
      `${summary.monitoringFlags?.delayRisk ?? 0} pekerjaan harian terlihat berisiko melewati target.`,
    );
  } else if ((summary.monitoringFlags?.noStart ?? 0) > 0) {
    items.push(
      `${summary.monitoringFlags?.noStart ?? 0} pekerjaan hari ini belum mulai dikerjakan.`,
    );
  }

  const busiestDivision = summary.manhour?.byDivision
    .filter((row) => row.utilizationPercent !== null)
    .sort((left, right) => (right.utilizationPercent ?? 0) - (left.utilizationPercent ?? 0))[0];
  if (busiestDivision && (busiestDivision.utilizationPercent ?? 0) >= 90) {
    items.push(
      `${busiestDivision.divisionName} sudah memakai ${busiestDivision.utilizationPercent?.toFixed(0)}% dari rencana jam minggu ini.`,
    );
  }

  if (items.length === 0) {
    items.push("Pergerakan utama hari ini terlihat stabil dan belum ada lonjakan risiko besar.");
  }

  return items.slice(0, 4);
}

interface DashboardVisibility {
  deliveryRisk: boolean;
  unitProgress: boolean;
  qcTrend: boolean;
  urgentIssues: boolean;
  countdownOverdue: boolean;
  manhour: boolean;
  divisionKpis: boolean;
  pendingActions: boolean;
  monitoringFlags: boolean;
}

function resolveVisibility(permissions: readonly string[]): DashboardVisibility {
  return {
    deliveryRisk: hasAnyPermission(permissions, [
      permissionCodes.viewCountdown,
      permissionCodes.listCarProgress,
      permissionCodes.viewUnits,
    ]),
    unitProgress: hasAnyPermission(permissions, [
      permissionCodes.listCarProgress,
      permissionCodes.updatePlan,
      permissionCodes.viewCountdown,
    ]),
    qcTrend: permissions.includes(permissionCodes.profileView),
    urgentIssues: hasAnyPermission(permissions, [
      permissionCodes.qcView,
      permissionCodes.qcSubmit,
      permissionCodes.qcValidate,
      permissionCodes.listCarProgress,
    ]),
    countdownOverdue: hasAnyPermission(permissions, [
      permissionCodes.viewCountdown,
      permissionCodes.listCarProgress,
    ]),
    manhour: hasAnyPermission(permissions, [
      permissionCodes.listCarProgress,
      permissionCodes.updatePlan,
      permissionCodes.reportView,
    ]),
    divisionKpis: hasAnyPermission(permissions, [
      permissionCodes.listCarProgress,
      permissionCodes.updatePlan,
      permissionCodes.reportView,
    ]),
    pendingActions: hasAnyPermission(permissions, [
      permissionCodes.woView,
      permissionCodes.woApprove,
      permissionCodes.woApproveAdvisor,
      permissionCodes.woApprovePm,
      permissionCodes.prView,
      permissionCodes.prApprove,
      permissionCodes.vendorView,
      permissionCodes.vendorApprove,
      permissionCodes.warehouseView,
      permissionCodes.warehouseApprove,
    ]),
    monitoringFlags: hasAnyPermission(permissions, [
      permissionCodes.listCarProgress,
      permissionCodes.updatePlan,
    ]),
  };
}

function filterPendingActionsByPermission(
  permissions: readonly string[],
  pendingActions: DashboardPendingActions,
): DashboardPendingActions {
  const woApproval = hasAnyPermission(permissions, [
    permissionCodes.woView,
    permissionCodes.woApprove,
    permissionCodes.woApproveAdvisor,
    permissionCodes.woApprovePm,
  ])
    ? pendingActions.woApproval
    : null;

  const prApproval = hasAnyPermission(permissions, [
    permissionCodes.prView,
    permissionCodes.prApprove,
  ])
    ? pendingActions.prApproval
    : null;

  const vendorApproval = hasAnyPermission(permissions, [
    permissionCodes.vendorView,
    permissionCodes.vendorApprove,
  ])
    ? pendingActions.vendorApproval
    : null;

  const warehouseApproval = hasAnyPermission(permissions, [
    permissionCodes.warehouseView,
    permissionCodes.warehouseApprove,
    permissionCodes.warehouseReady,
  ])
    ? pendingActions.warehouseApproval
    : null;

  return {
    woApproval,
    prApproval,
    vendorApproval,
    warehouseApproval,
    total: [woApproval, prApproval, vendorApproval, warehouseApproval].reduce<number>(
      (sum, item) => sum + (item ?? 0),
      0,
    ),
  };
}

async function safeSection<T>(resolver: () => Promise<T>): Promise<T | null> {
  try {
    return await resolver();
  } catch {
    return null;
  }
}

const DASHBOARD_SUMMARY_CACHE_TTL_MS = 5_000;
const dashboardSummaryCache = new TtlCache<DashboardSummaryPayload>(
  DASHBOARD_SUMMARY_CACHE_TTL_MS,
);

function buildDashboardSummaryCacheKey(
  session: WebSession,
  options?: {
    date?: string;
    dateFrom?: string;
    dateTo?: string;
    divisionId?: string;
    unitId?: string;
  },
): string {
  return JSON.stringify({
    employeeId: session.user.employeeId,
    permissions: [...session.user.permissions].sort(),
    scope: session.user.scope,
    options: {
      date: options?.date?.trim() || "",
      dateFrom: options?.dateFrom?.trim() || "",
      dateTo: options?.dateTo?.trim() || "",
      divisionId: options?.divisionId?.trim() || "",
      unitId: options?.unitId?.trim() || "",
    },
  });
}

export interface DashboardRiskSource {
  listDeliveryRisk(
    session: WebSession,
    asOfDate: string,
  ): Promise<DashboardDeliveryRiskSection>;
}

export class CalendarDashboardRiskSource implements DashboardRiskSource {
  constructor(
    private readonly calendarService: CalendarService = new DefaultCalendarService(),
  ) {}

  async listDeliveryRisk(
    session: WebSession,
    asOfDate: string,
  ): Promise<DashboardDeliveryRiskSection> {
    const query: GridQueryState = {
      page: 1,
      limit: 1000,
      search: "",
      sortBy: "predictedDeliveryDate",
      sortDirection: "asc",
      view: null,
      filters: [],
    };

    const result = await this.calendarService.listDeliveryRisk(session, query, asOfDate);
    const severityOrder: Record<string, number> = {
      RED: 5,
      ORANGE: 4,
      YELLOW: 3,
      BLACK: 2,
      GREEN: 1,
    };

    const topUnits = [...result.data]
      .sort((left, right) => {
        const severityDelta =
          (severityOrder[right.riskLevel] ?? 0) - (severityOrder[left.riskLevel] ?? 0);
        if (severityDelta !== 0) {
          return severityDelta;
        }

        return (left.predictedDeliveryDate ?? "9999-12-31").localeCompare(
          right.predictedDeliveryDate ?? "9999-12-31",
        );
      })
      .slice(0, 5)
      .map((row) => ({
        carId: row.carId,
        unitName: row.unitName,
        customerName: row.customerName,
        targetDeliveryDate: row.targetDeliveryDate,
        predictedDeliveryDate: row.predictedDeliveryDate,
        riskLevel: row.riskLevel,
        remainingHours: row.remainingHours,
        effectiveDailyCapacity: row.effectiveDailyCapacity,
      }));

    return {
      summary: result.summary,
      topUnits,
    };
  }
}

export interface DashboardService {
  getSummary(
    session: WebSession,
    options?: {
      date?: string;
      dateFrom?: string;
      dateTo?: string;
      divisionId?: string;
      unitId?: string;
    },
  ): Promise<DashboardSummaryPayload>;
}

export class DefaultDashboardService implements DashboardService {
  constructor(
    private readonly repository: DashboardRepository = new MySqlDashboardRepository(),
    private readonly riskSource: DashboardRiskSource = new CalendarDashboardRiskSource(),
  ) {}

  async getSummary(
    session: WebSession,
    options?: {
      date?: string;
      dateFrom?: string;
      dateTo?: string;
      divisionId?: string;
      unitId?: string;
    },
  ): Promise<DashboardSummaryPayload> {
    return dashboardSummaryCache.getOrCreate(
      buildDashboardSummaryCacheKey(session, options),
      () => this.resolveSummary(session, options),
    );
  }

  private async resolveSummary(
    session: WebSession,
    options?: {
      date?: string;
      dateFrom?: string;
      dateTo?: string;
      divisionId?: string;
      unitId?: string;
    },
  ): Promise<DashboardSummaryPayload> {
    const asOfDate = options?.date?.trim() || todayIsoDate();
    const visibility = resolveVisibility(session.user.permissions);
    const queryParams = buildDashboardQueryParams(
      {
        employeeId: session.user.employeeId,
        scope: session.user.scope,
      },
      asOfDate,
      options,
    );

    const [
      kpis,
      deliveryRisk,
      unitProgress,
      qcTrend,
      urgentIssues,
      countdownOverdue,
      manhour,
      divisionKpis,
      pendingActions,
      monitoringFlags,
      unitWorkHours,
    ] = await Promise.all([
      this.repository.getKpis(queryParams),
      visibility.deliveryRisk
        ? safeSection(() => this.riskSource.listDeliveryRisk(session, asOfDate))
        : Promise.resolve(null),
      visibility.unitProgress
        ? safeSection(() => this.repository.listUnitProgress(queryParams))
        : Promise.resolve(null),
      visibility.qcTrend
        ? safeSection(() => this.repository.listQcTrend(queryParams))
        : Promise.resolve(null),
      visibility.urgentIssues
        ? safeSection(() => this.repository.listUrgentIssues(queryParams))
        : Promise.resolve(null),
      visibility.countdownOverdue
        ? safeSection(() => this.repository.listCountdownOverdue(queryParams))
        : Promise.resolve(null),
      visibility.manhour
        ? safeSection(() => this.repository.getManhourSummary(queryParams))
        : Promise.resolve(null),
      visibility.divisionKpis
        ? safeSection(() => this.repository.listDivisionKpis(queryParams))
        : Promise.resolve(null),
      visibility.pendingActions
        ? safeSection(() => this.repository.getPendingActions(queryParams))
        : Promise.resolve(null),
      visibility.monitoringFlags
        ? safeSection(() => this.repository.getMonitoringFlags(queryParams))
        : Promise.resolve(null),
      safeSection(() => this.repository.listUnitWorkHours(queryParams)),
    ]);

    const filteredPendingActions = pendingActions
      ? filterPendingActionsByPermission(session.user.permissions, pendingActions)
      : null;

    const normalizedQcTrend = qcTrend ? fillTrendGaps(asOfDate, qcTrend) : null;
    const headline = {
      title: "Ringkasan kerja hari ini",
      subtitle:
        "Prioritas utama sudah dirangkum dari pergerakan unit, hasil QC, dan antrean keputusan yang masih berjalan.",
      scopeNote: buildScopeNote(session),
      highlights: buildHighlights({
        kpis,
        pendingActions: filteredPendingActions,
        monitoringFlags,
        manhour,
      }),
    };

    return {
      generatedAt: new Date().toISOString(),
      asOfDate,
      headline,
      kpis,
      deliveryRisk,
      unitProgress,
      qcTrend: normalizedQcTrend,
      urgentIssues,
      countdownOverdue,
      manhour,
      divisionKpis,
      pendingActions: filteredPendingActions,
      monitoringFlags,
      unitWorkHours,
    };
  }
}
