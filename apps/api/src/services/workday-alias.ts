function dailyCapacity(date: Date): number {
  const day = date.getDay();
  if (day === 0) return 0;
  if (day === 6) return 5;
  return 8;
}

function formatHourValue(hours: number): string {
  if (Number.isInteger(hours)) return String(hours);
  return hours.toFixed(2).replace(/\.?0+$/u, "");
}

export function _build_workday_alias(hours: number, startDate: Date = new Date()): string {
  const totalHours = Math.max(0, Number.isFinite(hours) ? hours : 0);
  const cursor = new Date(startDate);
  cursor.setHours(0, 0, 0, 0);

  if (totalHours <= 0) {
    return "0 Jam (0 hari kerja)";
  }

  let remaining = totalHours;
  let guard = 0;
  let workdays = 0;

  while (guard < 370) {
    const capacity = dailyCapacity(cursor);
    if (capacity > 0) {
      workdays += 1;
      remaining -= capacity;
      if (remaining <= 0.0001) {
        return `${formatHourValue(totalHours)} Jam (${workdays} hari kerja)`;
      }
    }

    cursor.setDate(cursor.getDate() + 1);
    guard += 1;
  }

  return `${formatHourValue(totalHours)} Jam`;
}
