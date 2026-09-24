import type { GridQueryState } from "@smsystem/contracts/grid";
import type {
  CreateMonitoringActualRequest,
  MonitoringDivisionDetailSummary,
  MonitoringDivisionLoadRecord,
  MonitoringDivisionMemberRecord,
  MonitoringDivisionUnitRecord,
  MonitoringReferences,
  MonitoringQuery,
  MonitoringSummary,
  MonitoringTaskRecord,
} from "@smsystem/contracts/monitoring";
import { buildGridMeta } from "@/services/grid/paginate";
import {
  MySqlMonitoringRepository,
  type MonitoringRepository,
} from "@/repositories/monitoring.repo";
import {
  HttpJobPlanRuntimeReadModel,
  type JobPlanRuntimeReadModel,
} from "@/services/job-plan-runtime-read-model";
import type { WebSession } from "@/services/auth/session.service";
import { applyDefaultDivisionIdFilter } from "@/services/grid/division-default";
import { TtlCache } from "@/lib/ttl-cache";
import { notifyMobileEmployees } from "@/services/mobile-notification.service";

interface MonitoringGridResult {
  data: MonitoringTaskRecord[];
  meta: ReturnType<typeof buildGridMeta>;
  query: MonitoringQuery;
  references: Awaited<ReturnType<MonitoringRepository["listReferences"]>>;
  summary: MonitoringSummary;
}

type MonitoringFilterMode = "all" | "normal" | "overtime";

interface MonitoringDivisionDetailResult {
  divisionId: number;
  divisionName: string | null;
  summary: MonitoringDivisionDetailSummary;
  units: MonitoringDivisionUnitRecord[];
  members: MonitoringDivisionMemberRecord[];
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function sanitizeMonitoringQuery(query: GridQueryState, date?: string, dateTo?: string): MonitoringQuery {
  const allowedSorts = new Set([
    "taskDate",
    "unitName",
    "divisionName",
    "employeeName",
    "progressPercent",
    "remainingHours",
    "planStatus",
    "actualStatus",
  ]);
  const allowedFilters = new Set([
    "divisionId",
    "carId",
    "employeeId",
    "planStatus",
    "actualStatus",
  ]);

  const resolvedDate = date?.trim() || todayIsoDate();
  const resolvedDateTo = dateTo?.trim();

  return {
    page: query.page,
    limit: query.limit,
    search: query.search,
    sortBy: allowedSorts.has(query.sortBy) ? query.sortBy : "taskDate",
    sortDirection: query.sortDirection,
    view: query.view,
    filters: query.filters.filter((filter) => allowedFilters.has(filter.field)),
    date: resolvedDate,
    dateTo: resolvedDateTo && resolvedDateTo !== resolvedDate
      ? resolvedDateTo < resolvedDate ? resolvedDate : resolvedDateTo
      : undefined,
  };
}

export interface MonitoringService {
  listToday(session: WebSession, query: GridQueryState, date?: string, mode?: MonitoringFilterMode, dateTo?: string): Promise<MonitoringGridResult>;
  listOvertime(session: WebSession, query: GridQueryState, date?: string, dateTo?: string): Promise<MonitoringGridResult>;
  listNoStart(session: WebSession, date?: string, dateTo?: string): Promise<MonitoringTaskRecord[]>;
  listNoSubmit(session: WebSession, date?: string, dateTo?: string): Promise<MonitoringTaskRecord[]>;
  listDivisionLoad(session: WebSession, date?: string, mode?: MonitoringFilterMode, span?: "daily" | "weekly", dateTo?: string): Promise<MonitoringDivisionLoadRecord[]>;
  getDivisionDetail(session: WebSession, divisionId: number, date?: string, mode?: MonitoringFilterMode, span?: "daily" | "weekly", dateTo?: string): Promise<MonitoringDivisionDetailResult>;
  listUnitLoad(session: WebSession, date?: string, mode?: MonitoringFilterMode, span?: "daily" | "weekly", dateTo?: string): Promise<import("@smsystem/contracts/monitoring").MonitoringUnitTimesheetRecord[]>;
  listEmployeeTimesheet(session: WebSession, date: string, dateTo: string): Promise<Array<{
    employeeId: string | null;
    employeeName: string | null;
    carId: string;
    unitName: string;
    isOvertime: boolean;
    totalActualHours: number;
  }>>;
  listReferences(session: WebSession): Promise<MonitoringReferences>;
  createActual(session: WebSession, input: CreateMonitoringActualRequest): Promise<{
    planId: string;
    actualId: string;
  }>;
  submitActualToLedger(session: WebSession, actualId: string): Promise<{ ledgerId: string; alreadySubmitted: boolean }>;
}

const MONITORING_REFERENCE_CACHE_TTL_MS = 60_000;
const monitoringReferenceCache = new TtlCache<MonitoringReferences>(
  MONITORING_REFERENCE_CACHE_TTL_MS,
);

function monitoringScopeCacheKey(session: WebSession): string {
  return JSON.stringify({
    employeeId: session.user.employeeId,
    scope: session.user.scope,
  });
}

export class DefaultMonitoringService implements MonitoringService {
  constructor(
    private readonly repository: MonitoringRepository = new MySqlMonitoringRepository(),
    private readonly jobPlanRuntimeReadModel: JobPlanRuntimeReadModel = new HttpJobPlanRuntimeReadModel(),
  ) {}

  async listToday(
    session: WebSession,
    query: GridQueryState,
    date?: string,
    mode: MonitoringFilterMode = "normal",
    dateTo?: string,
  ): Promise<MonitoringGridResult> {
    return this.listByMode(session, query, mode === "overtime" ? "overtime" : mode === "all" ? "all" : "today", date, dateTo);
  }

  async listOvertime(
    session: WebSession,
    query: GridQueryState,
    date?: string,
    dateTo?: string,
  ): Promise<MonitoringGridResult> {
    return this.listByMode(session, query, "overtime", date, dateTo);
  }

  async listNoStart(session: WebSession, date?: string, dateTo?: string): Promise<MonitoringTaskRecord[]> {
    const normalized = applyDefaultDivisionIdFilter(
      session,
      sanitizeMonitoringQuery(
        {
          page: 1,
          limit: 100,
          search: "",
          sortBy: "taskDate",
          sortDirection: "desc",
          view: null,
          filters: [],
        },
        date,
        dateTo,
      ),
    );

    const payload = await this.repository.listTasks({
      employeeId: session.user.employeeId,
      scope: session.user.scope,
      query: normalized,
      mode: "no-start",
    });

    return this.enrichRows(session, payload.rows);
  }

  async listNoSubmit(session: WebSession, date?: string, dateTo?: string): Promise<MonitoringTaskRecord[]> {
    const normalized = applyDefaultDivisionIdFilter(
      session,
      sanitizeMonitoringQuery(
        {
          page: 1,
          limit: 100,
          search: "",
          sortBy: "taskDate",
          sortDirection: "desc",
          view: null,
          filters: [],
        },
        date,
        dateTo,
      ),
    );

    const payload = await this.repository.listTasks({
      employeeId: session.user.employeeId,
      scope: session.user.scope,
      query: normalized,
      mode: "no-submit",
    });

    return this.enrichRows(session, payload.rows);
  }

  async listDivisionLoad(
    session: WebSession,
    date?: string,
    mode: MonitoringFilterMode = "normal",
    span: "daily" | "weekly" = "daily",
    dateTo?: string,
  ): Promise<MonitoringDivisionLoadRecord[]> {
    return this.repository.listDivisionLoad({
      employeeId: session.user.employeeId,
      scope: session.user.scope,
      date: date?.trim() || todayIsoDate(),
      mode,
      span,
      dateTo: dateTo?.trim() || date?.trim() || todayIsoDate(),
    });
  }

  async getDivisionDetail(
    session: WebSession,
    divisionId: number,
    date?: string,
    mode: MonitoringFilterMode = "normal",
    span: "daily" | "weekly" = "daily",
    dateTo?: string,
  ): Promise<MonitoringDivisionDetailResult> {
    const result = await this.repository.getDivisionDetail({
      employeeId: session.user.employeeId,
      scope: session.user.scope,
      divisionId,
      date: date?.trim() || todayIsoDate(),
      mode,
      span,
      dateTo: dateTo?.trim() || date?.trim() || todayIsoDate(),
    });

    return {
      divisionId,
      divisionName: result.divisionName,
      summary: result.summary,
      units: result.units,
      members: result.members,
    };
  }

  async listUnitLoad(
    session: WebSession,
    date?: string,
    mode: MonitoringFilterMode = "normal",
    span: "daily" | "weekly" = "daily",
    dateTo?: string,
  ): Promise<import("@smsystem/contracts/monitoring").MonitoringUnitTimesheetRecord[]> {
    return this.repository.listUnitLoad({
      employeeId: session.user.employeeId,
      scope: session.user.scope,
      date: date?.trim() || todayIsoDate(),
      mode,
      span,
      dateTo: dateTo?.trim() || date?.trim() || todayIsoDate(),
    });
  }

  async listEmployeeTimesheet(session: WebSession, date: string, dateTo: string) {
    return this.repository.listEmployeeTimesheet({
      employeeId: session.user.employeeId,
      scope: session.user.scope,
      date,
      dateTo,
    });
  }

  async listReferences(session: WebSession): Promise<MonitoringReferences> {
    return monitoringReferenceCache.getOrCreate(monitoringScopeCacheKey(session), () =>
      this.repository.listReferences({
        employeeId: session.user.employeeId,
        scope: session.user.scope,
      }),
    );
  }

  async createActual(session: WebSession, input: CreateMonitoringActualRequest) {
    const result = await this.repository.createActual(
      {
        employeeId: session.user.employeeId,
        scope: session.user.scope,
        actorId: session.user.employeeId,
      },
      input,
    );
    monitoringReferenceCache.delete(monitoringScopeCacheKey(session));
    await notifyMobileEmployees([input.employeeId], {
      title: "Update Task",
      body: `${session.user.fullName} memperbarui task ${input.jobDescription} menjadi ${input.taskStatus}.`,
      data: {
        module: "task",
        taskId: result.planId,
        plandailyId: result.planId,
        actualId: result.actualId,
        status: input.taskStatus,
      },
    }, "sm_tasks");
    return result;
  }

  async submitActualToLedger(session: WebSession, actualId: string) {
    return this.repository.submitActualToLedger({
      employeeId: session.user.employeeId,
      scope: session.user.scope,
      actorId: session.user.employeeId,
      actorName: session.user.fullName,
    }, actualId);
  }

  private async listByMode(
    session: WebSession,
    query: GridQueryState,
    mode: "all" | "today" | "overtime",
    date?: string,
    dateTo?: string,
  ): Promise<MonitoringGridResult> {
    const normalized = applyDefaultDivisionIdFilter(
      session,
      sanitizeMonitoringQuery(query, date, dateTo),
    );
    const [payload, references, summary] = await Promise.all([
      this.repository.listTasks({
        employeeId: session.user.employeeId,
        scope: session.user.scope,
        query: normalized,
        mode,
      }),
      monitoringReferenceCache.getOrCreate(monitoringScopeCacheKey(session), () =>
        this.repository.listReferences({
          employeeId: session.user.employeeId,
          scope: session.user.scope,
        }),
      ),
      this.repository.getSummary({
        employeeId: session.user.employeeId,
        scope: session.user.scope,
        date: normalized.date,
        dateTo: normalized.dateTo,
      }),
    ]);

    return {
      data: await this.enrichRows(session, payload.rows),
      meta: buildGridMeta(payload.total, normalized.page, normalized.limit),
      query: normalized,
      references,
      summary,
    };
  }

  private legacyOnlyRows(rows: MonitoringTaskRecord[]): MonitoringTaskRecord[] {
    return rows.map((row) => ({
      ...row,
      countdownId: row.countdownId ?? row.coreId,
      syncStatus: "UNAVAILABLE",
      dataSource: "LEGACY_ONLY",
      approvalState: row.approvalState ?? null,
      executionState: row.executionState ?? null,
      ledgerState: row.ledgerState ?? null,
      version: row.version ?? null,
      actualMinutes: row.actualMinutes ?? null,
      inputSource: row.inputSource ?? (row.actualId ? "LEGACY_ACTUAL" : null),
      manualExecution: row.manualExecution ?? null,
    }));
  }

  private async enrichRows(session: WebSession, rows: MonitoringTaskRecord[]): Promise<MonitoringTaskRecord[]> {
    if (rows.length === 0) return rows;

    try {
      const runtimeItems = await this.jobPlanRuntimeReadModel.listByCoreIds(
        session.user.employeeId,
        rows.map((row) => row.coreId),
      );
      const byPlanId = new Map(runtimeItems.map((item) => [item.plan_id, item]));

      return rows.map((row) => {
        const item = byPlanId.get(row.planId);
        if (!item) return this.legacyOnlyRows([row])[0]!;

        const syncStatus = item.live_state_available === false || item.read_only
          ? "UNAVAILABLE"
          : item.projection_ready === false
            ? "SYNCING"
            : "SYNCED";

        return {
          ...row,
          countdownId: row.countdownId ?? row.coreId,
          approvalState: item.approval_state,
          executionState: item.execution_state,
          ledgerState: item.ledger_state,
          version: item.version ?? null,
          syncStatus,
          dataSource: item.source,
          actualMinutes: item.accumulated_work_minutes,
          inputSource: row.actualId ? "LEGACY_ACTUAL" : row.inputSource ?? null,
          manualExecution: row.manualExecution ?? null,
        };
      });
    } catch {
      return this.legacyOnlyRows(rows);
    }
  }
}
