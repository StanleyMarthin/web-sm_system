import { parseGridQueryParams } from "@smsystem/contracts/grid";
import {
  jobPlanGridQuerySchema,
  jobPlanModeSchema,
  jobPlanWindowSchema,
  type JobPlanGridQuery,
  type JobPlanMode,
} from "@smsystem/contracts/job-plan";

const DEFAULT_DATE = "2026-01-01";
const VALID_SORT_FIELDS = new Set([
  "taskDate",
  "unitName",
  "divisionName",
  "assignedUserName",
  "targetHours",
  "status",
  "availablePlanHours",
  "remainingHours",
  "progressPercent",
  "createdAt",
]);

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function formatUtcDate(value: Date): string {
  return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`;
}

function parseIsoDate(value: string | null | undefined): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/u.test(value.trim())) {
    return DEFAULT_DATE;
  }

  return value.trim();
}

function getUtcDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function differenceInDaysInclusive(start: string, end: string): number {
  const startUtc = getUtcDate(start).getTime();
  const endUtc = getUtcDate(end).getTime();
  return Math.floor((endUtc - startUtc) / 86_400_000) + 1;
}

function resolveEditableWeekRange(
  date: string,
  dateStartInput: string,
  dateEndInput: string,
): { dateStart: string; dateEnd: string } {
  let dateStart = dateStartInput || date;
  let dateEnd = dateEndInput || dateStart;

  if (getUtcDate(dateEnd).getTime() < getUtcDate(dateStart).getTime()) {
    dateEnd = dateStart;
  }

  const currentSpan = differenceInDaysInclusive(dateStart, dateEnd);
  if (currentSpan < 2) {
    const nextDay = getUtcDate(dateStart);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    dateEnd = formatUtcDate(nextDay);
  } else if (currentSpan > 7) {
    const limitedEnd = getUtcDate(dateStart);
    limitedEnd.setUTCDate(limitedEnd.getUTCDate() + 6);
    dateEnd = formatUtcDate(limitedEnd);
  }

  return {
    dateStart,
    dateEnd,
  };
}

export function sanitizeJobPlanGridQuery(
  searchParams: URLSearchParams,
  defaultMode: JobPlanMode = "all",
): JobPlanGridQuery {
  const gridQuery = parseGridQueryParams(searchParams);
  const date = parseIsoDate(searchParams.get("date"));
  const dateStartInput = parseIsoDate(searchParams.get("dateStart"));
  const dateEndInput = parseIsoDate(searchParams.get("dateEnd"));
  const window = jobPlanWindowSchema.parse(searchParams.get("window") ?? "daily");
  const mode = jobPlanModeSchema.parse(searchParams.get("mode") ?? defaultMode);
  const dateRange =
    window === "weekly"
      ? resolveEditableWeekRange(date, dateStartInput, dateEndInput)
      : { dateStart: date, dateEnd: date };

  const sortBy = VALID_SORT_FIELDS.has(gridQuery.sortBy)
    ? gridQuery.sortBy
    : "taskDate";

  return jobPlanGridQuerySchema.parse({
    ...gridQuery,
    sortBy,
    date,
    window,
    mode,
    dateStart: dateRange.dateStart,
    dateEnd: dateRange.dateEnd,
  });
}
