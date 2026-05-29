import type {
  BubutInvoiceMaterialLine,
  BubutInvoiceType,
  BubutInvoiceWorkingHourLine,
} from "@smsystem/contracts/bubut-invoice";

const DEFAULT_POWER_WATT = 7500;
const DEFAULT_POWER_COST_KWH = 1444;
const DEFAULT_MARKUP_PERCENT = 235;
const DEFAULT_MARKUP_MULTIPLIER = 3.35;

export function minutesToHourText(totalMinutes: number): string {
  const safeMinutes = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function decimalHoursToMinutes(decimalHours: number): number {
  if (!Number.isFinite(decimalHours) || decimalHours <= 0) {
    return 0;
  }

  return Math.round(decimalHours * 60);
}

export function calculateWorkingHourTotal(
  workingHourDecimal: number,
  powerWatt = DEFAULT_POWER_WATT,
  powerCostKwh = DEFAULT_POWER_COST_KWH,
): number {
  if (!Number.isFinite(workingHourDecimal) || workingHourDecimal <= 0) {
    return 0;
  }

  return Math.round(((powerWatt * workingHourDecimal * powerCostKwh) / 1000) * 2);
}

export function ceilToStep(value: number, step: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }

  const safeStep = Number.isFinite(step) && step > 0 ? step : 1000;
  return Math.ceil(value / safeStep) * safeStep;
}

export function buildBubutInvoiceTotals(params: {
  invoiceType: BubutInvoiceType;
  workingHours: BubutInvoiceWorkingHourLine[];
  materials: BubutInvoiceMaterialLine[];
  roundingStep?: number;
}) {
  const totalWorkMinutes = params.workingHours.reduce(
    (sum, line) => sum + decimalHoursToMinutes(line.workingHourDecimal),
    0,
  );
  const totalWorkHourDecimal = totalWorkMinutes / 60;
  const workingHourTotal = params.workingHours.reduce(
    (sum, line) => sum + line.total,
    0,
  );
  const materialTotal = params.materials.reduce((sum, line) => sum + line.total, 0);
  const totalPriceBubut = workingHourTotal + materialTotal;
  const priceAfterMarkup =
    params.invoiceType === "CUSTOMER"
      ? Math.round(totalPriceBubut * DEFAULT_MARKUP_MULTIPLIER)
      : null;
  const roundingStep = params.roundingStep ?? 1000;
  const priceRounding =
    params.invoiceType === "CUSTOMER" && priceAfterMarkup !== null
      ? ceilToStep(priceAfterMarkup, roundingStep)
      : null;

  return {
    totalWorkMinutes,
    totalWorkHourText: minutesToHourText(totalWorkMinutes),
    totalWorkHourDecimal,
    workingHourTotal,
    materialTotal,
    totalPriceBubut,
    markupPercent: DEFAULT_MARKUP_PERCENT,
    markupMultiplier: DEFAULT_MARKUP_MULTIPLIER,
    priceAfterMarkup,
    roundingStep,
    priceRounding,
  };
}
