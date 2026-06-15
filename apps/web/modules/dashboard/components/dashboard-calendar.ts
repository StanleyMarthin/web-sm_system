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
    "relative flex aspect-square min-h-16 flex-col items-center justify-center overflow-hidden border border-transparent px-1 text-[11px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/80 active:scale-[0.99] after:absolute after:bottom-1 after:left-1/2 after:h-1 after:w-5 after:-translate-x-1/2 after:content-['']";

  const tone = isSelected
    ? "border-amber-500/45 bg-amber-500/[0.16] text-amber-200 shadow-[inset_0_0_0_1px_rgba(245,158,11,0.25)]"
    : hasScheduledUnits
      ? "bg-white text-emerald-700 hover:bg-emerald-500/[0.06] dark:bg-[#111114] dark:text-emerald-300 dark:hover:bg-emerald-500/[0.08]"
      : "bg-white text-gray-400 hover:bg-gray-50 dark:bg-[#111114] dark:text-white/32 dark:hover:bg-white/[0.04]";

  const today =
    isToday
      ? "font-bold text-gray-950 ring-1 ring-inset ring-amber-400/70 after:bg-amber-400 dark:text-white"
      : "after:bg-transparent";

  return {
    isSelected,
    isToday,
    hasScheduledUnits,
    dayClassName: `${base} ${tone} ${today}`,
  };
}
