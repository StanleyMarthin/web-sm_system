export type JobPlanScheduleMode = "normal" | "overtime";

export interface JobPlanScheduleSegment {
  mode: JobPlanScheduleMode;
  targetHours: number;
  startTime: string;
  finishTime: string;
}

export interface JobPlanAllocationLimitExceeded {
  referenceId: string;
  requestedHours: number;
  availableHours: number;
}

export function findExceededJobPlanAllocation(
  rows: Array<{ referenceId: string; targetHours: number }>,
  availableHoursByReference: ReadonlyMap<string, number>,
): JobPlanAllocationLimitExceeded | null {
  const requestedHoursByReference = new Map<string, number>();

  for (const row of rows) {
    if (!row.referenceId || !Number.isFinite(row.targetHours) || row.targetHours <= 0) {
      continue;
    }

    requestedHoursByReference.set(
      row.referenceId,
      Number(((requestedHoursByReference.get(row.referenceId) ?? 0) + row.targetHours).toFixed(2)),
    );
  }

  for (const [referenceId, requestedHours] of requestedHoursByReference) {
    const availableHours = availableHoursByReference.get(referenceId);
    if (availableHours !== undefined && requestedHours > availableHours + 0.0001) {
      return { referenceId, requestedHours, availableHours };
    }
  }

  return null;
}

const START_MINUTES_NORMAL = 8 * 60;
const START_MINUTES_SUNDAY = 8 * 60;
const OVERTIME_START_WEEKDAY = 17 * 60;
const OVERTIME_START_SATURDAY = 14 * 60;

function parseIsoDate(taskDate: string): Date {
  return new Date(`${taskDate}T00:00:00`);
}

function toTimeString(totalMinutes: number): string {
  const normalized = ((totalMinutes % (24 * 60)) + (24 * 60)) % (24 * 60);
  const hour = String(Math.floor(normalized / 60)).padStart(2, "0");
  const minute = String(normalized % 60).padStart(2, "0");
  return `${hour}:${minute}`;
}

function addMinutes(time: string, minutesToAdd: number): string {
  const [hourRaw, minuteRaw] = time.split(":");
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  return toTimeString((hour * 60) + minute + minutesToAdd);
}

export function parseDurationHHMM(value: string): number | null {
  const normalized = value.trim();
  if (!/^\d{1,3}:\d{2}$/u.test(normalized)) {
    return null;
  }

  const [hoursRaw, minutesRaw] = normalized.split(":");
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || minutes >= 60) {
    return null;
  }

  return hours + (minutes / 60);
}

export function formatDurationHHMM(hours: number): string {
  const totalMinutes = Math.max(0, Math.round(hours * 60));
  const wholeHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(wholeHours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function breakMinutesForJobPlanDate(taskDate: string): number {
  const date = parseIsoDate(taskDate);
  if (date.getDay() === 0) {
    return 0;
  }

  return date.getDay() === 5 ? 90 : 60;
}

export function breakStartMinutesForJobPlanDate(taskDate: string): number {
  const date = parseIsoDate(taskDate);
  return date.getDay() === 5 ? (11 * 60) + 30 : 12 * 60;
}

export function calculateJobPlanFinishTime(
  taskDate: string,
  startTime: string,
  durationHours: number,
): string {
  const [hourRaw, minuteRaw] = startTime.split(":");
  const startMinutes = (Number(hourRaw) * 60) + Number(minuteRaw);
  const workMinutes = Math.max(0, Math.round(durationHours * 60));
  const breakStart = breakStartMinutesForJobPlanDate(taskDate);
  const breakEnd = breakStart + breakMinutesForJobPlanDate(taskDate);
  const effectiveStart = startMinutes >= breakStart && startMinutes < breakEnd
    ? breakEnd
    : startMinutes;
  const finishWithoutBreak = effectiveStart + workMinutes;
  const finishMinutes = effectiveStart < breakStart && finishWithoutBreak > breakStart
    ? finishWithoutBreak + (breakEnd - breakStart)
    : finishWithoutBreak;

  return toTimeString(finishMinutes);
}

export function getNormalThresholdTime(taskDate: string): string {
  const date = parseIsoDate(taskDate);
  if (date.getDay() === 6) {
    return "14:00";
  }

  if (date.getDay() === 0) {
    return "08:00";
  }

  return "17:00";
}

export function getOvertimeStartTime(taskDate: string): string {
  const date = parseIsoDate(taskDate);
  if (date.getDay() === 0) {
    return "08:00";
  }

  return date.getDay() === 6 ? "14:00" : "17:00";
}

export function isSundayJobPlan(taskDate: string): boolean {
  return parseIsoDate(taskDate).getDay() === 0;
}

export function calculateNormalFinishTime(taskDate: string, durationHours: number): string {
  return calculateJobPlanFinishTime(taskDate, toTimeString(START_MINUTES_NORMAL), durationHours);
}

export function calculateOvertimeFinishTime(taskDate: string, durationHours: number): string {
  const workMinutes = Math.round(durationHours * 60);
  const startTime = getOvertimeStartTime(taskDate);
  const [hourRaw, minuteRaw] = startTime.split(":");
  const startMinutes = (Number(hourRaw) * 60) + Number(minuteRaw);
  return toTimeString(startMinutes + workMinutes);
}

export function getNormalCapacityHours(taskDate: string): number {
  const date = parseIsoDate(taskDate);

  if (date.getDay() === 0) {
    return 0;
  }

  if (date.getDay() === 6) {
    return 5;
  }

  if (date.getDay() === 5) {
    return 7.5;
  }

  return 8;
}

export function buildJobPlanScheduleSegments(input: {
  taskDate: string;
  requestedMode: JobPlanScheduleMode;
  targetHours: number;
}): JobPlanScheduleSegment[] {
  const requestedHours = Math.max(0, Number(input.targetHours.toFixed(2)));
  if (requestedHours <= 0) {
    return [];
  }

  if (input.requestedMode === "overtime") {
    const startTime = getOvertimeStartTime(input.taskDate);
    return [
      {
        mode: "overtime",
        targetHours: requestedHours,
        startTime,
        finishTime: addMinutes(startTime, Math.round(requestedHours * 60)),
      },
    ];
  }

  if (isSundayJobPlan(input.taskDate)) {
    const startTime = START_MINUTES_SUNDAY;
    return [
      {
        mode: "overtime",
        targetHours: requestedHours,
        startTime: toTimeString(startTime),
        finishTime: toTimeString(startTime + Math.round(requestedHours * 60)),
      },
    ];
  }

  const normalCapacityHours = getNormalCapacityHours(input.taskDate);
  const normalHours = Math.min(requestedHours, normalCapacityHours);
  const overtimeHours = Math.max(0, Number((requestedHours - normalHours).toFixed(2)));
  const segments: JobPlanScheduleSegment[] = [];

  if (normalHours > 0) {
    segments.push({
      mode: "normal",
      targetHours: normalHours,
      startTime: "08:00",
      finishTime: calculateNormalFinishTime(input.taskDate, normalHours),
    });
  }

  if (overtimeHours > 0) {
    const startTime = getOvertimeStartTime(input.taskDate);
    segments.push({
      mode: "overtime",
      targetHours: overtimeHours,
      startTime,
      finishTime: addMinutes(startTime, Math.round(overtimeHours * 60)),
    });
  }

  return segments;
}
