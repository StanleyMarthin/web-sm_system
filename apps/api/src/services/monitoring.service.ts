import type { GridQueryState } from "@smsystem/contracts/grid";
import type {
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
import type { WebSession } from "@/services/auth/session.service";
import { applyDefaultDivisionIdFilter } from "@/services/grid/division-default";
import { TtlCache } from "@/lib/ttl-cache";

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

function sanitizeMonitoringQuery(query: GridQueryState, date?: string): MonitoringQuery {
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

  return {
    page: query.page,
    limit: query.limit,
    search: query.search,
    sortBy: allowedSorts.has(query.sortBy) ? query.sortBy : "taskDate",
    sortDirection: query.sortDirection,
    view: query.view,
    filters: query.filters.filter((filter) => allowedFilters.has(filter.field)),
    date: date?.trim() || todayIsoDate(),
  };
}

export interface MonitoringService {
  listToday(session: WebSession, query: GridQueryState, date?: string, mode?: MonitoringFilterMode): Promise<MonitoringGridResult>;
  listOvertime(session: WebSession, query: GridQueryState, date?: string): Promise<MonitoringGridResult>;
  listNoStart(session: WebSession, date?: string): Promise<MonitoringTaskRecord[]>;
  listNoSubmit(session: WebSession, date?: string): Promise<MonitoringTaskRecord[]>;
  listDivisionLoad(session: WebSession, date?: string, mode?: MonitoringFilterMode, span?: "daily" | "weekly", dateTo?: string): Promise<MonitoringDivisionLoadRecord[]>;
  getDivisionDetail(session: WebSession, divisionId: number, date?: string, mode?: MonitoringFilterMode, span?: "daily" | "weekly", dateTo?: string): Promise<MonitoringDivisionDetailResult>;
  listEmployeeTimesheet(session: WebSession, date: string, dateTo: string): Promise<Array<{
    employeeId: string | null;
    employeeName: string | null;
    carId: string;
    unitName: string;
    isOvertime: boolean;
    totalActualHours: number;
  }>>;
  listReferences(session: WebSession): Promise<MonitoringReferences>;
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
  ) {}

  async listToday(
    session: WebSession,
    query: GridQueryState,
    date?: string,
    mode: MonitoringFilterMode = "normal",
  ): Promise<MonitoringGridResult> {
    return this.listByMode(session, query, mode === "overtime" ? "overtime" : mode === "all" ? "all" : "today", date);
  }

  async listOvertime(
    session: WebSession,
    query: GridQueryState,
    date?: string,
  ): Promise<MonitoringGridResult> {
    return this.listByMode(session, query, "overtime", date);
  }

  async listNoStart(session: WebSession, date?: string): Promise<MonitoringTaskRecord[]> {
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
      ),
    );

    const payload = await this.repository.listTasks({
      employeeId: session.user.employeeId,
      scope: session.user.scope,
      query: normalized,
      mode: "no-start",
    });

    return payload.rows;
  }

  async listNoSubmit(session: WebSession, date?: string): Promise<MonitoringTaskRecord[]> {
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
      ),
    );

    const payload = await this.repository.listTasks({
      employeeId: session.user.employeeId,
      scope: session.user.scope,
      query: normalized,
      mode: "no-submit",
    });

    return payload.rows;
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

  private async listByMode(
    session: WebSession,
    query: GridQueryState,
    mode: "all" | "today" | "overtime",
    date?: string,
  ): Promise<MonitoringGridResult> {
    const normalized = applyDefaultDivisionIdFilter(
      session,
      sanitizeMonitoringQuery(query, date),
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
      }),
    ]);

    return {
      data: payload.rows,
      meta: buildGridMeta(payload.total, normalized.page, normalized.limit),
      query: normalized,
      references,
      summary,
    };
  }
}
