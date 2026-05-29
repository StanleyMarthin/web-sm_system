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
      ? "border-emerald-500/30 text-emerald-300"
      : isDanger
        ? "border-red-500/30 text-red-300"
        : "border-amber-500/30 text-amber-300";

  return (
    <span
      className={`inline-flex items-center justify-center border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] ${className}`}
    >
      {label}
    </span>
  );
}
