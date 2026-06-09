import type { RedisClientType } from "redis";
import { getRedisClient } from "@/redis/client";
import type {
  HistoricalFactor,
  MonteCarloResult,
  PriorityResult,
  UtilizationCalibration,
  WarrantyRatePrediction,
} from "@/services/planning-phase3-engine";

export type PlanningPhase3CacheKind =
  | "monte-carlo"
  | "utilization-calibration"
  | "historical-factor"
  | "warranty-prediction"
  | "priority-result";

export interface PlanningPhase3CacheStore {
  getMonteCarlo(unitId: string): Promise<MonteCarloResult | null>;
  setMonteCarlo(unitId: string, result: MonteCarloResult): Promise<void>;
  getUtilizationCalibration(scopeId: string): Promise<UtilizationCalibration[] | null>;
  setUtilizationCalibration(scopeId: string, result: UtilizationCalibration[]): Promise<void>;
  getHistoricalFactors(scopeId: string): Promise<HistoricalFactor[] | null>;
  setHistoricalFactors(scopeId: string, result: HistoricalFactor[]): Promise<void>;
  getWarrantyPrediction(scopeId: string): Promise<WarrantyRatePrediction[] | null>;
  setWarrantyPrediction(scopeId: string, result: WarrantyRatePrediction[]): Promise<void>;
  getPriorityResult(unitId: string): Promise<PriorityResult | null>;
  setPriorityResult(unitId: string, result: PriorityResult): Promise<void>;
}

const DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 7;

function buildKey(kind: PlanningPhase3CacheKind, id: string): string {
  return `planning:phase3:${kind}:${id}`;
}

function reviveDates<T>(value: T): T {
  if (!value || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => reviveDates(item)) as T;
  }

  const next: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (
      typeof raw === "string" &&
      (key.endsWith("Date") || key.endsWith("At")) &&
      !Number.isNaN(Date.parse(raw))
    ) {
      next[key] = new Date(raw);
    } else {
      next[key] = reviveDates(raw);
    }
  }
  return next as T;
}

export class RedisPlanningPhase3CacheStore implements PlanningPhase3CacheStore {
  constructor(
    private readonly clientFactory: () => Promise<RedisClientType> = getRedisClient,
    private readonly ttlSeconds: number = DEFAULT_TTL_SECONDS,
  ) {}

  async getMonteCarlo(unitId: string): Promise<MonteCarloResult | null> {
    return this.getJson<MonteCarloResult>(buildKey("monte-carlo", unitId));
  }

  async setMonteCarlo(unitId: string, result: MonteCarloResult): Promise<void> {
    await this.setJson(buildKey("monte-carlo", unitId), result);
  }

  async getUtilizationCalibration(scopeId: string): Promise<UtilizationCalibration[] | null> {
    return this.getJson<UtilizationCalibration[]>(buildKey("utilization-calibration", scopeId));
  }

  async setUtilizationCalibration(
    scopeId: string,
    result: UtilizationCalibration[],
  ): Promise<void> {
    await this.setJson(buildKey("utilization-calibration", scopeId), result);
  }

  async getHistoricalFactors(scopeId: string): Promise<HistoricalFactor[] | null> {
    return this.getJson<HistoricalFactor[]>(buildKey("historical-factor", scopeId));
  }

  async setHistoricalFactors(scopeId: string, result: HistoricalFactor[]): Promise<void> {
    await this.setJson(buildKey("historical-factor", scopeId), result);
  }

  async getWarrantyPrediction(scopeId: string): Promise<WarrantyRatePrediction[] | null> {
    return this.getJson<WarrantyRatePrediction[]>(buildKey("warranty-prediction", scopeId));
  }

  async setWarrantyPrediction(
    scopeId: string,
    result: WarrantyRatePrediction[],
  ): Promise<void> {
    await this.setJson(buildKey("warranty-prediction", scopeId), result);
  }

  async getPriorityResult(unitId: string): Promise<PriorityResult | null> {
    return this.getJson<PriorityResult>(buildKey("priority-result", unitId));
  }

  async setPriorityResult(unitId: string, result: PriorityResult): Promise<void> {
    await this.setJson(buildKey("priority-result", unitId), result);
  }

  private async getJson<T>(key: string): Promise<T | null> {
    const client = await this.clientFactory();
    const raw = await client.get(key);
    if (!raw) {
      return null;
    }
    return reviveDates(JSON.parse(raw) as T);
  }

  private async setJson(key: string, value: unknown): Promise<void> {
    const client = await this.clientFactory();
    await client.set(key, JSON.stringify(value), {
      expiration: {
        type: "EX",
        value: this.ttlSeconds,
      },
    });
  }
}
