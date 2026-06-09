import type { GridQueryState } from "@smsystem/contracts/grid";
import type {
  CalendarDayOverride,
  CalendarDayOverrideRequest,
  CapacityPreviewRecord,
  CapacityPreviewRequest,
  DeliveryRiskQuery,
  UnitEtaRecord,
  WeeklyWorkConfigRecord,
  WeeklyWorkConfigRequest,
  WorkingDay,
  WorkingDaysRequest,
} from "@smsystem/contracts/calendar";
import { buildGridMeta } from "@/services/grid/paginate";
import type { RedisClientType } from "redis";
import {
  MySqlCalendarRepository,
  type CalendarRepository,
  type UnitCapacitySnapshot,
} from "@/repositories/calendar.repo";
import { getRedisClient } from "@/redis/client";
import type { WebSession } from "@/services/auth/session.service";

const DEFAULT_CONFIG: WeeklyWorkConfigRecord = {
  configId: "default",
  weekStartDate: "1970-01-05",
  weekdayHours: 8,
  saturdayHours: 5,
  sundayHours: 0,
  weekdayOvertimeHours: 5,
  saturdayOvertimeHours: 3,
  sundayOvertimeHours: 0,
  efficiencyFactor: 1,
  qcBufferDays: 1,
  createdBy: null,
  createdAt: "1970-01-01 00:00:00",
  updatedAt: "1970-01-01 00:00:00",
};

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

function parseIsoDate(date: string): Date {
  const [year, month, day] = date.split("-").map((value) => Number.parseInt(value, 10));
  return new Date(Date.UTC(year, (month || 1) - 1, day || 1));
}

function formatIsoDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, amount: number): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + amount);
  return next;
}

function getWeekStartDate(date: Date): string {
  const day = date.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  return formatIsoDate(addDays(date, diff));
}

function resolveToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function sanitizeRiskQuery(query: GridQueryState, asOfDate?: string): DeliveryRiskQuery {
  const allowedSorts = new Set([
    "predictedDeliveryDate",
    "targetDeliveryDate",
    "riskLevel",
    "remainingHours",
    "unitName",
  ]);
  const allowedFilters = new Set(["riskLevel"]);

  return {
    page: query.page,
    limit: query.limit,
    search: query.search,
    sortBy: allowedSorts.has(query.sortBy) ? query.sortBy : "predictedDeliveryDate",
    sortDirection: query.sortDirection,
    view: query.view,
    filters: query.filters.filter((filter) => allowedFilters.has(filter.field)),
    asOfDate: asOfDate?.trim() || resolveToday(),
  };
}

function findConfigForDate(
  configs: WeeklyWorkConfigRecord[],
  date: string,
): WeeklyWorkConfigRecord {
  const weekStartDate = getWeekStartDate(parseIsoDate(date));
  return configs.find((config) => config.weekStartDate === weekStartDate) ?? DEFAULT_CONFIG;
}

function getDayCapacity(
  config: WeeklyWorkConfigRecord,
  date: Date,
  includeOvertime: boolean,
): { workingHours: number; overtimeHours: number; totalCapacityHours: number } {
  const day = date.getUTCDay();
  let workingHours = config.weekdayHours;
  let overtimeHours = includeOvertime ? config.weekdayOvertimeHours : 0;

  if (day === 6) {
    workingHours = config.saturdayHours;
    overtimeHours = includeOvertime ? config.saturdayOvertimeHours : 0;
  } else if (day === 0) {
    workingHours = config.sundayHours;
    overtimeHours = includeOvertime ? config.sundayOvertimeHours : 0;
  }

  return {
    workingHours,
    overtimeHours,
    totalCapacityHours: workingHours + overtimeHours,
  };
}

function applyDayOverride(
  capacity: { workingHours: number; overtimeHours: number; totalCapacityHours: number },
  override: CalendarDayOverride | undefined,
  includeOvertime: boolean,
): { workingHours: number; overtimeHours: number; totalCapacityHours: number } {
  if (!override) {
    return capacity;
  }

  const workingHours = override.workingHours;
  const overtimeHours = includeOvertime ? override.overtimeHours : 0;
  return {
    workingHours,
    overtimeHours,
    totalCapacityHours: workingHours + overtimeHours,
  };
}

function buildWorkingDays(
  startDate: string,
  endDate: string,
  configs: WeeklyWorkConfigRecord[],
  includeOvertime: boolean,
  overrides: CalendarDayOverride[] = [],
): WorkingDay[] {
  const start = parseIsoDate(startDate);
  const end = parseIsoDate(endDate);
  const days: WorkingDay[] = [];
  const overrideByDate = new Map(overrides.map((override) => [override.date, override]));

  for (let cursor = start; cursor <= end; cursor = addDays(cursor, 1)) {
    const date = formatIsoDate(cursor);
    const config = findConfigForDate(configs, date);
    const override = overrideByDate.get(date);
    const capacity = applyDayOverride(
      getDayCapacity(config, cursor, includeOvertime),
      override,
      includeOvertime,
    );
    days.push({
      date,
      dayName: DAY_NAMES[cursor.getUTCDay()],
      workingHours: capacity.workingHours,
      overtimeHours: capacity.overtimeHours,
      totalCapacityHours: capacity.totalCapacityHours,
      isWorkingDay: capacity.totalCapacityHours > 0,
      override: override
        ? {
            mode: override.mode,
            note: override.note ?? null,
          }
        : null,
    });
  }

  return days;
}

function addWorkingDays(
  startDate: string,
  daysToAdd: number,
  configs: WeeklyWorkConfigRecord[],
  overrides: CalendarDayOverride[] = [],
): string {
  if (daysToAdd <= 0) {
    return startDate;
  }

  let cursor = parseIsoDate(startDate);
  let added = 0;
  const overrideByDate = new Map(overrides.map((override) => [override.date, override]));

  while (added < daysToAdd) {
    cursor = addDays(cursor, 1);
    const date = formatIsoDate(cursor);
    const config = findConfigForDate(configs, date);
    const capacity = applyDayOverride(
      getDayCapacity(config, cursor, false),
      overrideByDate.get(date),
      false,
    );
    if (capacity.totalCapacityHours > 0) {
      added += 1;
    }
  }

  return formatIsoDate(cursor);
}

function diffCalendarDays(fromDate: string, toDate: string): number {
  const from = parseIsoDate(fromDate).getTime();
  const to = parseIsoDate(toDate).getTime();
  return Math.round((to - from) / 86_400_000);
}

export interface EtaCacheStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  deleteByPattern?(pattern: string): Promise<void>;
}

export interface CalendarOverrideStore {
  list(startDate: string, endDate: string): Promise<CalendarDayOverride[]>;
  upsert(input: CalendarDayOverrideRequest & { updatedBy: string }): Promise<CalendarDayOverride>;
}

class RedisEtaCacheStore implements EtaCacheStore {
  constructor(
    private readonly clientFactory: () => Promise<RedisClientType> = getRedisClient,
  ) {}

  async get(key: string): Promise<string | null> {
    const client = await this.clientFactory();
    return client.get(key);
  }

  async set(key: string, value: string): Promise<void> {
    const client = await this.clientFactory();
    await client.set(key, value, {
      expiration: {
        type: "EX",
        value: 300,
      },
    });
  }

  async deleteByPattern(pattern: string): Promise<void> {
    const client = await this.clientFactory();
    const keys = await client.keys(pattern);
    if (keys.length > 0) {
      await client.del(keys);
    }
  }
}

class RedisCalendarOverrideStore implements CalendarOverrideStore {
  constructor(
    private readonly clientFactory: () => Promise<RedisClientType> = getRedisClient,
  ) {}

  async list(startDate: string, endDate: string): Promise<CalendarDayOverride[]> {
    let client: RedisClientType;
    try {
      client = await this.clientFactory();
    } catch (error) {
      if (process.env.NODE_ENV === "production") {
        throw error;
      }
      return [];
    }

    const keys = await client.keys("planning:calendar:day-override:*");
    if (keys.length === 0) {
      return [];
    }

    const raws = await client.mGet(keys);
    return raws
      .filter((raw): raw is string => Boolean(raw))
      .map((raw) => JSON.parse(raw) as CalendarDayOverride)
      .filter((override) => override.date >= startDate && override.date <= endDate)
      .sort((left, right) => left.date.localeCompare(right.date));
  }

  async upsert(input: CalendarDayOverrideRequest & { updatedBy: string }): Promise<CalendarDayOverride> {
    const override: CalendarDayOverride = {
      date: input.date,
      mode: input.mode,
      workingHours: input.workingHours,
      overtimeHours: input.overtimeHours,
      note: input.note?.trim() || null,
      updatedBy: input.updatedBy,
      updatedAt: new Date().toISOString(),
    };
    let client: RedisClientType;
    try {
      client = await this.clientFactory();
    } catch (error) {
      if (process.env.NODE_ENV === "production") {
        throw error;
      }
      return override;
    }

    await client.set(`planning:calendar:day-override:${override.date}`, JSON.stringify(override));
    return override;
  }
}

export interface CalendarService {
  listWeeklyConfigs(session: WebSession): Promise<WeeklyWorkConfigRecord[]>;
  upsertWeeklyConfig(session: WebSession, input: WeeklyWorkConfigRequest): Promise<WeeklyWorkConfigRecord>;
  listDayOverrides(session: WebSession, input: { startDate: string; endDate: string }): Promise<CalendarDayOverride[]>;
  upsertDayOverride(session: WebSession, input: CalendarDayOverrideRequest): Promise<CalendarDayOverride>;
  getWorkingDays(session: WebSession, input: WorkingDaysRequest): Promise<{
    startDate: string;
    endDate: string;
    includeOvertime: boolean;
    days: WorkingDay[];
  }>;
  simulateCapacity(session: WebSession, input: CapacityPreviewRequest): Promise<CapacityPreviewRecord>;
  getUnitEta(session: WebSession, carId: string, options?: { asOfDate?: string }): Promise<UnitEtaRecord>;
  listDeliveryRisk(session: WebSession, query: GridQueryState, asOfDate?: string): Promise<{
    data: UnitEtaRecord[];
    meta: ReturnType<typeof buildGridMeta>;
    query: DeliveryRiskQuery;
    summary: {
      green: number;
      yellow: number;
      orange: number;
      red: number;
      black: number;
    };
  }>;
}

export class DefaultCalendarService implements CalendarService {
  constructor(
    private readonly repository: CalendarRepository = new MySqlCalendarRepository(),
    private readonly cache: EtaCacheStore = new RedisEtaCacheStore(),
    private readonly overrideStore: CalendarOverrideStore = new RedisCalendarOverrideStore(),
  ) {}

  async listWeeklyConfigs(): Promise<WeeklyWorkConfigRecord[]> {
    return this.repository.listWeeklyConfigs();
  }

  async upsertWeeklyConfig(
    session: WebSession,
    input: WeeklyWorkConfigRequest,
  ): Promise<WeeklyWorkConfigRecord> {
    return this.repository.upsertWeeklyConfig({
      ...input,
      createdBy: session.user.employeeId,
    });
  }

  async listDayOverrides(
    _session: WebSession,
    input: { startDate: string; endDate: string },
  ): Promise<CalendarDayOverride[]> {
    return this.overrideStore.list(input.startDate, input.endDate);
  }

  async upsertDayOverride(
    session: WebSession,
    input: CalendarDayOverrideRequest,
  ): Promise<CalendarDayOverride> {
    const override = await this.overrideStore.upsert({
      ...input,
      updatedBy: session.user.employeeId,
    });
    await this.cache.deleteByPattern?.("eta:*");
    return override;
  }

  async getWorkingDays(
    _session: WebSession,
    input: WorkingDaysRequest,
  ): Promise<{
    startDate: string;
    endDate: string;
    includeOvertime: boolean;
    days: WorkingDay[];
  }> {
    const [configs, overrides] = await Promise.all([
      this.repository.listWeeklyConfigs(input.startDate, input.endDate),
      this.overrideStore.list(input.startDate, input.endDate),
    ]);
    return {
      startDate: input.startDate,
      endDate: input.endDate,
      includeOvertime: input.includeOvertime,
      days: buildWorkingDays(
        input.startDate,
        input.endDate,
        configs,
        input.includeOvertime,
        overrides,
      ),
    };
  }

  async simulateCapacity(
    _session: WebSession,
    input: CapacityPreviewRequest,
  ): Promise<CapacityPreviewRecord> {
    const [configs, overrides, divisionName, activePicCount] = await Promise.all([
      this.repository.listWeeklyConfigs(input.date, input.date),
      this.overrideStore.list(input.date, input.date),
      this.repository.findDivisionName?.(input.divisionId) ?? Promise.resolve(`Division ${input.divisionId}`),
      input.activePicCount > 0
        ? Promise.resolve(input.activePicCount)
        : this.repository.countActivePicByDivision?.(input.divisionId, input.date) ?? Promise.resolve(0),
    ]);
    const config = findConfigForDate(configs, input.date);
    const dayCapacity = applyDayOverride(
      getDayCapacity(config, parseIsoDate(input.date), input.includeOvertime),
      overrides[0],
      input.includeOvertime,
    );
    const effectiveDailyCapacity =
      activePicCount * dayCapacity.totalCapacityHours * config.efficiencyFactor;

    return {
      divisionId: input.divisionId,
      divisionName,
      activePicCount,
      workingHours: dayCapacity.totalCapacityHours,
      efficiencyFactor: config.efficiencyFactor,
      effectiveDailyCapacity: Number(effectiveDailyCapacity.toFixed(2)),
    };
  }

  async getUnitEta(
    session: WebSession,
    carId: string,
    options?: { asOfDate?: string },
  ): Promise<UnitEtaRecord> {
    const asOfDate = options?.asOfDate?.trim() || resolveToday();
    const cacheKey = `eta:${carId}:${asOfDate}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as UnitEtaRecord;
    }

    const snapshot = await this.repository.getUnitCapacitySnapshot({
      employeeId: session.user.employeeId,
      scope: session.user.scope,
      carId,
    });
    if (!snapshot) {
      throw new Error("UNIT_NOT_FOUND");
    }

    const result = await this.buildEtaRecord(snapshot, asOfDate);
    await this.cache.set(cacheKey, JSON.stringify(result));
    return result;
  }

  async listDeliveryRisk(
    session: WebSession,
    query: GridQueryState,
    asOfDate?: string,
  ): Promise<{
    data: UnitEtaRecord[];
    meta: ReturnType<typeof buildGridMeta>;
    query: DeliveryRiskQuery;
    summary: {
      green: number;
      yellow: number;
      orange: number;
      red: number;
      black: number;
    };
  }> {
    const normalized = sanitizeRiskQuery(query, asOfDate);
    const snapshots = await this.repository.listDeliveryRiskRows({
      employeeId: session.user.employeeId,
      scope: session.user.scope,
    });

    const computed = await Promise.all(
      snapshots.map((snapshot) => this.buildEtaRecord(snapshot, normalized.asOfDate)),
    );

    let filtered = computed;
    if (normalized.search) {
      const keyword = normalized.search.toLowerCase();
      filtered = filtered.filter((row) =>
        [row.unitName, row.customerName ?? "", row.carId].some((value) =>
          value.toLowerCase().includes(keyword),
        ),
      );
    }

    for (const filter of normalized.filters) {
      if (filter.field === "riskLevel") {
        filtered = filtered.filter((row) => row.riskLevel === filter.value);
      }
    }

    const sortDirection = normalized.sortDirection === "asc" ? 1 : -1;
    filtered = [...filtered].sort((left, right) => {
      const compareByString = (a: string | null, b: string | null) =>
        (a ?? "").localeCompare(b ?? "");
      const compareByNumber = (a: number, b: number) => a - b;

      let comparison = 0;
      switch (normalized.sortBy) {
        case "targetDeliveryDate":
          comparison = compareByString(left.targetDeliveryDate, right.targetDeliveryDate);
          break;
        case "riskLevel":
          comparison = compareByString(left.riskLevel, right.riskLevel);
          break;
        case "remainingHours":
          comparison = compareByNumber(left.remainingHours, right.remainingHours);
          break;
        case "unitName":
          comparison = compareByString(left.unitName, right.unitName);
          break;
        default:
          comparison = compareByString(
            left.predictedDeliveryDate,
            right.predictedDeliveryDate,
          );
      }

      return comparison * sortDirection;
    });

    const offset = (normalized.page - 1) * normalized.limit;
    const pageRows = filtered.slice(offset, offset + normalized.limit);

    return {
      data: pageRows,
      meta: buildGridMeta(filtered.length, normalized.page, normalized.limit),
      query: normalized,
      summary: {
        green: filtered.filter((row) => row.riskLevel === "GREEN").length,
        yellow: filtered.filter((row) => row.riskLevel === "YELLOW").length,
        orange: filtered.filter((row) => row.riskLevel === "ORANGE").length,
        red: filtered.filter((row) => row.riskLevel === "RED").length,
        black: filtered.filter((row) => row.riskLevel === "BLACK").length,
      },
    };
  }

  private async buildEtaRecord(
    snapshot: UnitCapacitySnapshot,
    asOfDate: string,
    planContext?: {
      allocatedHoursThisWeek: number;
      netCapacityThisWeek: number;
    },
  ): Promise<UnitEtaRecord> {
    const horizonDate = formatIsoDate(addDays(parseIsoDate(asOfDate), 180));
    const [configs, overrides] = await Promise.all([
      this.repository.listWeeklyConfigs(asOfDate, horizonDate),
      this.overrideStore.list(asOfDate, horizonDate),
    ]);
    const config = findConfigForDate(configs, asOfDate);
    const dayCapacity = applyDayOverride(
      getDayCapacity(config, parseIsoDate(asOfDate), false),
      overrides.find((override) => override.date === asOfDate),
      false,
    );
    const baselineCapacity =
      snapshot.activePicCount * dayCapacity.totalCapacityHours * config.efficiencyFactor;
    const hasPlanContext =
      planContext !== undefined &&
      Number.isFinite(planContext.netCapacityThisWeek) &&
      planContext.netCapacityThisWeek > 0;
    const effectiveDailyCapacity = hasPlanContext
      ? planContext.netCapacityThisWeek / 5
      : baselineCapacity;
    const remainingHoursAfterPlan = hasPlanContext
      ? Math.max(0, snapshot.remainingHours - Math.max(0, planContext.allocatedHoursThisWeek))
      : snapshot.remainingHours;

    if (!snapshot.targetDeliveryDate || effectiveDailyCapacity <= 0) {
      return {
        carId: snapshot.carId,
        unitName: snapshot.unitName,
        customerName: snapshot.customerName,
        targetDeliveryDate: snapshot.targetDeliveryDate,
        predictedDeliveryDate: null,
        riskLevel: "BLACK",
        remainingHours: Number(remainingHoursAfterPlan.toFixed(2)),
        effectiveDailyCapacity: Number(effectiveDailyCapacity.toFixed(2)),
        etaDays: 0,
        blockerDelayDays: 0,
        qcBufferDays: config.qcBufferDays,
      };
    }

    const etaDays =
      remainingHoursAfterPlan > 0
        ? Math.ceil(remainingHoursAfterPlan / effectiveDailyCapacity)
        : 0;
    const blockerDelayDays =
      snapshot.highSeverityIssueCount > 0 || snapshot.openWoCount > 0 ? 1 : 0;
    const predictedDeliveryDate = addWorkingDays(
      asOfDate,
      etaDays + blockerDelayDays + config.qcBufferDays,
      configs,
      overrides,
    );

    const deltaDays = diffCalendarDays(snapshot.targetDeliveryDate, predictedDeliveryDate);
    let riskLevel: UnitEtaRecord["riskLevel"] = "GREEN";
    if (deltaDays === 0) {
      riskLevel = "YELLOW";
    } else if (deltaDays > 0 && deltaDays <= 2) {
      riskLevel = "ORANGE";
    } else if (deltaDays > 2) {
      riskLevel = "RED";
    }

    return {
      carId: snapshot.carId,
      unitName: snapshot.unitName,
      customerName: snapshot.customerName,
      targetDeliveryDate: snapshot.targetDeliveryDate,
      predictedDeliveryDate,
      riskLevel,
      remainingHours: Number(remainingHoursAfterPlan.toFixed(2)),
      effectiveDailyCapacity: Number(effectiveDailyCapacity.toFixed(2)),
      etaDays,
      blockerDelayDays,
      qcBufferDays: config.qcBufferDays,
    };
  }
}
