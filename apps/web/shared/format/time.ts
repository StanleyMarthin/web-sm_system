export const PARSE_HHMM_STRICT_PRESERVES_WORKFLOW_VALIDATION =
  "strict keeps workflow-job validation; false keeps countdown grid leniency";

export function parseHHMMToDecimal(value: string, strict = false): number {
  if (strict) {
    if (!value.trim()) return 0;
    if (!value.includes(":")) {
      const numeric = Number(value);
      return Number.isFinite(numeric) ? numeric : Number.NaN;
    }
    const [hoursText, minutesText] = value.split(":");
    const hours = Number.parseInt(hoursText ?? "0", 10);
    const minutes = Number.parseInt(minutesText ?? "0", 10);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes) || minutes < 0 || minutes > 59) {
      return Number.NaN;
    }
    return hours + minutes / 60;
  }

  if (!value) return 0;
  const [hoursText, minutesText] = value.split(":");
  const hours = Number.parseInt(hoursText, 10) || 0;
  const minutes = Number.parseInt(minutesText, 10) || 0;
  return hours + minutes / 60;
}
