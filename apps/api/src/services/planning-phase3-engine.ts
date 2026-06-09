export interface MonteCarloConfig {
  iterations: number;
  seed?: number;
}

export interface MonteCarloJobInput {
  jobId: string;
  optimisticDays: number;
  mostLikelyDays: number;
  pessimisticDays: number;
  dependsOn: string[];
}

export interface MonteCarloInput {
  planningStartDate: Date;
  jobs: MonteCarloJobInput[];
}

export interface MonteCarloResult {
  p50Date: Date;
  p80Date: Date;
  p95Date: Date;
  meanDays: number;
  stdDev: number;
  histogram: { bucket: number; frequency: number }[];
  ranAt: Date;
}

export interface UtilizationPeriodInput {
  divisionId: string;
  actualHours: number;
  availableHours: number;
  currentSafeUtilization: number;
}

export interface UtilizationCalibration {
  divisionId: string;
  observedPeriods: number;
  avgActualUtilization: number;
  suggestedSafeUtilization: number;
  currentSafeUtilization: number;
  delta: number;
  recommendation: "increase" | "decrease" | "keep";
  lastCalibratedAt: Date;
}

export interface HistoricalFactorInput {
  divisionId: string;
  jobTypeId: string;
  estimatedHours: number;
  actualHours: number;
}

export interface HistoricalFactor {
  divisionId: string;
  jobTypeId: string;
  sampleSize: number;
  avgEstimatedHours: number;
  avgActualHours: number;
  calibratedFactor: number;
  defaultFactor: number;
  confidence: "low" | "medium" | "high";
  lastCalibratedAt: Date;
}

export interface WarrantyHistoryInput {
  divisionId: string;
  completedUnits: number;
  warrantyCases: number;
  actualReworkHours: number;
  unitScheduledNextPeriod: number;
}

export interface WarrantyRatePrediction {
  divisionId: string;
  historicalReturnRate: number;
  avgReworkHours: number;
  predictedLoadNextPeriod: number;
  confidence: "low" | "medium" | "high";
}

export interface PriorityInput {
  unitId: string;
  deadlineDaysRemaining: number;
  deliveryRiskScore: number;
  blockerCount: number;
  lockedPanelCount: number;
  remainingHours: number;
  incomeMarker: number;
  historicalDelayRate?: number;
  customerSlaLevel?: number;
}

export interface PriorityResult {
  unitId: string;
  score: number;
  rank: 1 | 2 | 3;
  dominantFactor: string;
  scoreBreakdown: Record<string, number>;
}

const DEFAULT_MONTE_CARLO_ITERATIONS = 10_000;
const DEFAULT_HISTORICAL_FACTOR = 1.15;
const PERT_LAMBDA = 4;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, digits = 4): number {
  return Number(value.toFixed(digits));
}

function addDays(date: Date, days: number): Date {
  const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  next.setUTCDate(next.getUTCDate() + Math.max(0, Math.ceil(days)));
  return next;
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state / 4_294_967_296;
  };
}

function normalSample(random: () => number): number {
  const u1 = Math.max(Number.EPSILON, random());
  const u2 = Math.max(Number.EPSILON, random());
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function gammaSample(shape: number, random: () => number): number {
  if (shape < 1) {
    return gammaSample(shape + 1, random) * (random() ** (1 / shape));
  }

  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);

  while (true) {
    const x = normalSample(random);
    const v = (1 + c * x) ** 3;
    if (v <= 0) {
      continue;
    }
    const u = random();
    if (u < 1 - 0.0331 * x ** 4) {
      return d * v;
    }
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) {
      return d * v;
    }
  }
}

function betaSample(alpha: number, beta: number, random: () => number): number {
  const x = gammaSample(alpha, random);
  const y = gammaSample(beta, random);
  return x / Math.max(Number.EPSILON, x + y);
}

function samplePertDays(job: MonteCarloJobInput, random: () => number): number {
  const optimistic = Math.max(0, job.optimisticDays);
  const pessimistic = Math.max(optimistic, job.pessimisticDays);
  const mostLikely = clamp(job.mostLikelyDays, optimistic, pessimistic);
  const range = pessimistic - optimistic;
  if (range <= 0) {
    return optimistic;
  }

  const alpha = 1 + PERT_LAMBDA * ((mostLikely - optimistic) / range);
  const beta = 1 + PERT_LAMBDA * ((pessimistic - mostLikely) / range);
  return optimistic + betaSample(alpha, beta, random) * range;
}

function calculateFinishDays(jobs: MonteCarloJobInput[], durations: Map<string, number>): number {
  const byId = new Map(jobs.map((job) => [job.jobId, job]));
  const finishById = new Map<string, number>();
  const visiting = new Set<string>();

  function finish(jobId: string): number {
    const cached = finishById.get(jobId);
    if (cached !== undefined) {
      return cached;
    }

    const job = byId.get(jobId);
    if (!job) {
      return 0;
    }
    if (visiting.has(jobId)) {
      throw new Error(`Circular dependency detected at ${jobId}`);
    }

    visiting.add(jobId);
    const dependencyFinish = job.dependsOn
      .filter((dependencyId) => byId.has(dependencyId))
      .reduce((max, dependencyId) => Math.max(max, finish(dependencyId)), 0);
    visiting.delete(jobId);

    const value = dependencyFinish + Math.max(0, durations.get(jobId) ?? job.mostLikelyDays);
    finishById.set(jobId, value);
    return value;
  }

  return jobs.reduce((max, job) => Math.max(max, finish(job.jobId)), 0);
}

function percentile(sorted: number[], percentileRank: number): number {
  if (sorted.length === 0) {
    return 0;
  }
  const index = clamp(Math.ceil((percentileRank / 100) * sorted.length) - 1, 0, sorted.length - 1);
  return sorted[index] ?? 0;
}

function buildHistogram(values: number[]): { bucket: number; frequency: number }[] {
  const buckets = new Map<number, number>();
  for (const value of values) {
    const bucket = Math.ceil(value);
    buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1);
  }
  return [...buckets.entries()]
    .sort(([left], [right]) => left - right)
    .map(([bucket, frequency]) => ({ bucket, frequency }));
}

export function runMonteCarloSimulation(
  input: MonteCarloInput,
  config: Partial<MonteCarloConfig> = {},
): MonteCarloResult {
  const iterations = Math.max(1, Math.trunc(config.iterations ?? DEFAULT_MONTE_CARLO_ITERATIONS));
  const random = config.seed === undefined ? Math.random : seededRandom(config.seed);
  const finishDays: number[] = [];

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const durations = new Map<string, number>();
    for (const job of input.jobs) {
      durations.set(job.jobId, samplePertDays(job, random));
    }
    finishDays.push(calculateFinishDays(input.jobs, durations));
  }

  const sorted = [...finishDays].sort((left, right) => left - right);
  const meanDays = finishDays.reduce((sum, value) => sum + value, 0) / finishDays.length;
  const variance = finishDays.reduce((sum, value) => sum + (value - meanDays) ** 2, 0) / finishDays.length;

  return {
    p50Date: addDays(input.planningStartDate, percentile(sorted, 50)),
    p80Date: addDays(input.planningStartDate, percentile(sorted, 80)),
    p95Date: addDays(input.planningStartDate, percentile(sorted, 95)),
    meanDays: round(meanDays),
    stdDev: round(Math.sqrt(variance)),
    histogram: buildHistogram(finishDays),
    ranAt: new Date(),
  };
}

export function calibrateUtilization(
  rows: UtilizationPeriodInput[],
  safetyMargin = 0.9,
): UtilizationCalibration[] {
  const grouped = new Map<string, UtilizationPeriodInput[]>();
  for (const row of rows) {
    if (row.availableHours <= 0) {
      continue;
    }
    grouped.set(row.divisionId, [...(grouped.get(row.divisionId) ?? []), row]);
  }

  return [...grouped.entries()].map(([divisionId, divisionRows]) => {
    const avgActualUtilization = divisionRows.reduce(
      (sum, row) => sum + row.actualHours / Math.max(1, row.availableHours),
      0,
    ) / divisionRows.length;
    const currentSafeUtilization = divisionRows.at(-1)?.currentSafeUtilization ?? 0.85;
    const suggestedSafeUtilization = clamp(avgActualUtilization * safetyMargin, 0.1, 1);
    const delta = suggestedSafeUtilization - currentSafeUtilization;

    return {
      divisionId,
      observedPeriods: divisionRows.length,
      avgActualUtilization: round(avgActualUtilization),
      suggestedSafeUtilization: round(suggestedSafeUtilization),
      currentSafeUtilization: round(currentSafeUtilization),
      delta: round(delta),
      recommendation: Math.abs(delta) < 0.03 ? "keep" : delta > 0 ? "increase" : "decrease",
      lastCalibratedAt: new Date(),
    };
  });
}

function confidenceFromSampleSize(sampleSize: number): "low" | "medium" | "high" {
  if (sampleSize > 20) {
    return "high";
  }
  if (sampleSize >= 5) {
    return "medium";
  }
  return "low";
}

export function calculateHistoricalFactors(rows: HistoricalFactorInput[]): HistoricalFactor[] {
  const grouped = new Map<string, HistoricalFactorInput[]>();
  for (const row of rows) {
    if (row.estimatedHours <= 0 || row.actualHours <= 0) {
      continue;
    }
    const key = `${row.divisionId}:${row.jobTypeId}`;
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }

  return [...grouped.values()].map((group) => {
    const first = group[0];
    const sampleSize = group.length;
    const avgEstimatedHours = group.reduce((sum, row) => sum + row.estimatedHours, 0) / sampleSize;
    const avgActualHours = group.reduce((sum, row) => sum + row.actualHours, 0) / sampleSize;
    const rawFactor = avgActualHours / Math.max(0.01, avgEstimatedHours);

    return {
      divisionId: first?.divisionId ?? "",
      jobTypeId: first?.jobTypeId ?? "",
      sampleSize,
      avgEstimatedHours: round(avgEstimatedHours, 2),
      avgActualHours: round(avgActualHours, 2),
      calibratedFactor: round(Math.max(1, rawFactor)),
      defaultFactor: DEFAULT_HISTORICAL_FACTOR,
      confidence: confidenceFromSampleSize(sampleSize),
      lastCalibratedAt: new Date(),
    };
  });
}

export function predictWarrantyLoad(rows: WarrantyHistoryInput[]): WarrantyRatePrediction[] {
  return rows.map((row) => {
    const historicalReturnRate =
      row.completedUnits <= 0 ? 0 : row.warrantyCases / row.completedUnits;
    const avgReworkHours =
      row.warrantyCases <= 0 ? 0 : row.actualReworkHours / row.warrantyCases;
    const predictedLoadNextPeriod =
      row.unitScheduledNextPeriod * historicalReturnRate * avgReworkHours;

    return {
      divisionId: row.divisionId,
      historicalReturnRate: round(historicalReturnRate),
      avgReworkHours: round(avgReworkHours, 2),
      predictedLoadNextPeriod: round(predictedLoadNextPeriod, 2),
      confidence: confidenceFromSampleSize(row.warrantyCases),
    };
  });
}

function normalizePriorityInput(input: PriorityInput): Record<string, number> {
  return {
    deadline: clamp(input.deadlineDaysRemaining < 0 ? 100 : 100 - input.deadlineDaysRemaining * 8, 0, 100),
    risk: clamp(input.deliveryRiskScore, 0, 100),
    blocker: clamp(input.blockerCount * 20, 0, 100),
    panel: clamp(input.lockedPanelCount * 25, 0, 100),
    hours: clamp(input.remainingHours / 2, 0, 100),
    income: clamp(input.incomeMarker, 0, 100),
    historicalDelay: clamp((input.historicalDelayRate ?? 0) * 100, 0, 100),
    sla: clamp((input.customerSlaLevel ?? 0) * 25, 0, 100),
  };
}

export function optimizePriority(input: PriorityInput): PriorityResult {
  const normalized = normalizePriorityInput(input);
  const highDelay = normalized.historicalDelay >= 50;
  const weights = {
    deadline: highDelay ? 0.32 : 0.3,
    risk: highDelay ? 0.28 : 0.22,
    blocker: 0.13,
    panel: 0.09,
    hours: 0.08,
    income: highDelay ? 0.03 : 0.05,
    historicalDelay: 0.08,
    sla: 0.07,
  };

  const scoreBreakdown = Object.fromEntries(
    Object.entries(weights).map(([key, weight]) => [
      key,
      round((normalized[key] ?? 0) * weight, 2),
    ]),
  );
  const score = round(
    Object.values(scoreBreakdown).reduce((sum, value) => sum + value, 0),
    2,
  );
  const [dominantFactor = "deadline"] = Object.entries(scoreBreakdown)
    .sort((left, right) => right[1] - left[1])[0] ?? [];

  return {
    unitId: input.unitId,
    score: clamp(score, 0, 100),
    rank: score >= 70 ? 1 : score >= 40 ? 2 : 3,
    dominantFactor,
    scoreBreakdown,
  };
}
