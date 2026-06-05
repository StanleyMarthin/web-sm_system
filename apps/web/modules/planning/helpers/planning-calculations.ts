/**
 * Planning Work Control — Kalkulasi helper
 *
 * Semua rumus prediksi dan kalkulasi ada di sini.
 * Jangan tampilkan rumus mentah ke UI — gunakan hasil output dari helper ini.
 */

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type PlanningRecommendation = "SPK" | "SPK_WITH_SPL" | "HOLD" | "REVISE_TARGET";

export interface CapacityInput {
  normalCapacityHours: number;
  absenceHours: number;
  scheduledHours: number;
}

export interface CapacityResult {
  normalCapacityHours: number;
  absenceHours: number;
  scheduledHours: number;
  availableCapacityHours: number;
}

export interface SafeFinishInput {
  remainingHours: number;
  /** Efisiensi historis divisi. Default 0.85 jika belum ada data historis. */
  efficiencyFactor?: number;
  /** Faktor risiko. Default berdasarkan riskLevel. */
  riskLevel: RiskLevel;
  /** P95 error historis. Default 0.30 jika belum ada data historis. */
  p95ErrorFactor?: number;
  /** Kapasitas harian divisi (jam/hari) */
  dailyCapacityHours: number;
  /** Tanggal mulai kerja (ISO string) */
  startDate: string;
  /** Daftar hari kerja dalam seminggu (0=Minggu, 1=Senin, ..., 6=Sabtu) */
  workingDayNumbers?: number[];
}

export interface SafeFinishResult {
  /** Estimasi normal tanpa buffer risiko (hari kerja) */
  normalDays: number;
  /** Hari aman dengan buffer risiko (hari kerja) */
  safeDays: number;
  /** Tanggal selesai aman (ISO string) */
  safeFinishDate: string;
  /** Nama hari selesai aman dalam bahasa Indonesia */
  safeFinishDayName: string;
}

const RISK_MULTIPLIER: Record<RiskLevel, number> = {
  LOW: 1.05,
  MEDIUM: 1.15,
  HIGH: 1.30,
  CRITICAL: 1.50,
};

const DEFAULT_EFFICIENCY = 0.85;
const DEFAULT_P95_ERROR = 0.30;
const DEFAULT_WORKING_DAYS = [1, 2, 3, 4, 5]; // Senin–Jumat

const DAY_NAMES_ID = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

/**
 * Hitung kapasitas real divisi.
 */
export function calculateCapacity(input: CapacityInput): CapacityResult {
  const available = Math.max(
    0,
    input.normalCapacityHours - input.absenceHours - input.scheduledHours,
  );
  return {
    normalCapacityHours: input.normalCapacityHours,
    absenceHours: input.absenceHours,
    scheduledHours: input.scheduledHours,
    availableCapacityHours: Number(available.toFixed(2)),
  };
}

/**
 * Hitung kebutuhan jam lembur (SPL).
 * Return 0 jika tidak butuh lembur.
 */
export function calculateOvertimeNeed(targetHours: number, availableCapacityHours: number): number {
  return Math.max(0, Number((targetHours - availableCapacityHours).toFixed(2)));
}

/**
 * Tambahkan hari kerja ke tanggal (skip hari libur).
 */
function addWorkingDays(
  startDate: string,
  daysToAdd: number,
  workingDayNumbers: number[],
): string {
  const [y, m, d] = startDate.split("-").map(Number);
  const date = new Date(Date.UTC(y ?? 2026, (m ?? 1) - 1, d ?? 1));
  let remaining = Math.max(0, Math.ceil(daysToAdd));

  while (remaining > 0) {
    date.setUTCDate(date.getUTCDate() + 1);
    if (workingDayNumbers.includes(date.getUTCDay())) {
      remaining--;
    }
  }

  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Prediksi tanggal selesai aman berdasarkan sisa pekerjaan, efisiensi, dan risiko.
 *
 * Rumus (backend only):
 *   correctedHours   = remainingHours / efficiencyFactor
 *   predictedHours   = correctedHours × riskMultiplier
 *   safeHours        = predictedHours × (1 + p95ErrorFactor)
 *   safeDays         = ceil(safeHours / dailyCapacityHours)
 *   safeFinishDate   = startDate + safeDays (hari kerja)
 */
export function calculateSafeFinishDate(input: SafeFinishInput): SafeFinishResult {
  const efficiency = input.efficiencyFactor ?? DEFAULT_EFFICIENCY;
  const p95Error = input.p95ErrorFactor ?? DEFAULT_P95_ERROR;
  const riskMultiplier = RISK_MULTIPLIER[input.riskLevel];
  const workingDays = input.workingDayNumbers ?? DEFAULT_WORKING_DAYS;

  const corrected = input.remainingHours / Math.max(0.01, efficiency);
  const predicted = corrected * riskMultiplier;
  const safe = predicted * (1 + p95Error);

  const normalDays = Math.ceil(input.remainingHours / Math.max(0.01, input.dailyCapacityHours));
  const safeDays = Math.ceil(safe / Math.max(0.01, input.dailyCapacityHours));

  const safeFinishDate = addWorkingDays(input.startDate, safeDays, workingDays);
  const [fy, fm, fd] = safeFinishDate.split("-").map(Number);
  const finishDateObj = new Date(Date.UTC(fy ?? 2026, (fm ?? 1) - 1, fd ?? 1));
  const safeFinishDayName = DAY_NAMES_ID[finishDateObj.getUTCDay()] ?? "";

  return {
    normalDays,
    safeDays,
    safeFinishDate,
    safeFinishDayName,
  };
}

/**
 * Tentukan rekomendasi SPK/SPL berdasarkan target vs kapasitas.
 */
export function resolvePlanningRecommendation(
  targetHours: number,
  availableCapacityHours: number,
  isHold = false,
): PlanningRecommendation {
  if (isHold) return "HOLD";
  if (targetHours <= availableCapacityHours) return "SPK";
  return "SPK_WITH_SPL";
}

/**
 * Format label status rekomendasi ke bahasa sederhana.
 */
export function formatPlanningStatusLabel(recommendation: PlanningRecommendation): string {
  switch (recommendation) {
    case "SPK":
      return "Aman dikerjakan jam normal";
    case "SPK_WITH_SPL":
      return "Butuh tambahan jam lembur";
    case "HOLD":
      return "Belum bisa dikerjakan";
    case "REVISE_TARGET":
      return "Target perlu direvisi";
  }
}

/**
 * Format label risiko ke bahasa sederhana.
 */
export function formatRiskLabel(risk: RiskLevel): string {
  switch (risk) {
    case "LOW":
      return "Rendah";
    case "MEDIUM":
      return "Sedang";
    case "HIGH":
      return "Tinggi";
    case "CRITICAL":
      return "Kritis";
  }
}

/**
 * Format label badge kapasitas divisi.
 */
export function formatCapacityStatusLabel(
  targetHours: number,
  availableHours: number,
): "Aman" | "Hampir Penuh" | "Overload" {
  if (availableHours <= 0) return "Overload";
  const ratio = targetHours / availableHours;
  if (ratio <= 0.85) return "Aman";
  if (ratio <= 1.0) return "Hampir Penuh";
  return "Overload";
}

/**
 * Format jam dalam bentuk ringkas: "80 jam" atau "80.5 jam"
 */
export function formatHoursShort(hours: number): string {
  const rounded = Number(hours.toFixed(1));
  return `${rounded} jam`;
}
