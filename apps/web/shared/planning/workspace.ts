export interface PlanningWorkspaceState {
  asOfDate: string;
  startDate: string;
  endDate: string;
  includeOvertime: boolean;
  weekStartDate: string;
}

function formatIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseIsoDate(date: string): Date {
  const [year, month, day] = date.split("-").map((value) => Number.parseInt(value, 10));
  return new Date(Date.UTC(year, (month || 1) - 1, day || 1));
}

function addDays(baseDate: string, amount: number): string {
  const date = parseIsoDate(baseDate);
  date.setUTCDate(date.getUTCDate() + amount);
  return formatIsoDate(date);
}

function resolveWeekStart(isoDate: string): string {
  const utcDate = parseIsoDate(isoDate);
  const day = utcDate.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  utcDate.setUTCDate(utcDate.getUTCDate() + diff);
  return formatIsoDate(utcDate);
}

function readStringParam(
  input: Record<string, string | string[] | undefined>,
  key: string,
): string | null {
  const value = input[key];
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  return null;
}

export function resolvePlanningWorkspaceState(
  searchParams: Record<string, string | string[] | undefined>,
  todayIsoDate: string = formatIsoDate(new Date()),
): PlanningWorkspaceState {
  const asOfDate = readStringParam(searchParams, "asOfDate") ?? todayIsoDate;
  const startDate = readStringParam(searchParams, "startDate") ?? asOfDate;
  const endDate = readStringParam(searchParams, "endDate") ?? addDays(startDate, 6);
  const includeOvertime = readStringParam(searchParams, "includeOvertime") === "true";
  const weekStartDate =
    readStringParam(searchParams, "weekStart") ?? resolveWeekStart(asOfDate);

  return {
    asOfDate,
    startDate,
    endDate,
    includeOvertime,
    weekStartDate,
  };
}

export function buildPlanningWorkspaceHref(
  searchParams: Record<string, string | string[] | undefined>,
): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === "string" && value.trim().length > 0) {
      params.set(key, value);
      continue;
    }

    for (const item of value ?? []) {
      if (item.trim().length > 0) {
        params.append(key, item);
      }
    }
  }

  const query = params.toString();
  return query ? `/planning?${query}` : "/planning";
}
