export interface CalendarDayStateInput {
  dateStr: string;
  selectedDate: string;
  todayStr: string;
  scheduledUnitCount: number;
}

export function getCalendarDayState({
  dateStr,
  selectedDate,
  todayStr,
  scheduledUnitCount,
}: CalendarDayStateInput) {
  const isSelected = dateStr === selectedDate;
  const isToday = dateStr === todayStr;
  const hasScheduledUnits = scheduledUnitCount > 0;

  const base =
    "relative flex aspect-square min-h-24 flex-col items-stretch justify-start overflow-hidden border border-transparent p-1.5 text-left text-[13px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/80 active:scale-[0.99] after:absolute after:bottom-1 after:left-1/2 after:h-1 after:w-5 after:-translate-x-1/2 after:content-['']";

  const tone = isSelected
    ? "border-primary/45 bg-primary/[0.16] text-app-accent-ink ring-1 ring-inset ring-primary/45"
    : hasScheduledUnits
      ? "bg-card text-success hover:bg-success/[0.06] dark:text-success dark:hover:bg-success/[0.08]"
      : "bg-card text-muted-foreground hover:bg-muted dark:hover:bg-accent";

  const today =
    isToday
      ? "font-bold text-foreground ring-1 ring-inset ring-primary/70 after:bg-primary dark:text-foreground"
      : "after:bg-transparent";

  return {
    isSelected,
    isToday,
    hasScheduledUnits,
    dayClassName: `${base} ${tone} ${today}`,
  };
}
