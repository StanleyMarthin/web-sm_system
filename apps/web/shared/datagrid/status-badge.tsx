import type { SmartDataGridCellValue } from "@/shared/datagrid/types";
import { humanizeCodeLabel } from "@/shared/format/humanize";

interface StatusBadgeProps {
  value: SmartDataGridCellValue;
}

export function DataGridStatusBadge({ value }: StatusBadgeProps) {
  const normalizedValue = String(value ?? "").toUpperCase();
  const label = humanizeCodeLabel(value);
  const isSuccess = [
    "ACTIVE",
    "APPROVED",
    "DONE",
    "DONE_VENDOR",
    "READY",
    "GOOD",
    "STORED",
    "TRUE",
    "YES",
    "GREEN",
    "QC_READY",
    "RESOLVED",
  ].includes(normalizedValue);
  const isDanger = [
    "INACTIVE",
    "REJECTED",
    "CANCELLED",
    "CANCEL",
    "BAD",
    "FALSE",
    "NO",
    "RED",
    "HIGH",
    "TIDAK_LOLOS",
    "OVERDUE",
  ].includes(normalizedValue);
  const className =
    isSuccess
      ? "border-emerald-700/25 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-transparent dark:text-emerald-300"
      : isDanger
        ? "border-red-600/25 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-transparent dark:text-red-300"
        : "border-amber-600/25 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-transparent dark:text-amber-300";

  return (
    <span
      className={`inline-flex items-center justify-center border px-2.5 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] ${className}`}
    >
      {label}
    </span>
  );
}
