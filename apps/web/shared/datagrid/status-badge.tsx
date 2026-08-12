import type { SmartDataGridCellValue } from "@/shared/datagrid/types";
import { humanizeCodeLabel } from "@/shared/format/humanize";

interface StatusBadgeProps {
  value: SmartDataGridCellValue;
}

export function DataGridStatusBadge({ value }: StatusBadgeProps) {
  const normalizedValue = String(value ?? "").toUpperCase();
  const label = humanizeCodeLabel(value);
  const isMuted = [
    "PLAN",
    "DRAFT",
    "PENDING_APPROVAL",
    "NONE",
    "BELUM",
    "NOT_SET",
    "",
  ].includes(normalizedValue);
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
    "PENDING",
    "PENDING_REVIEW",
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
    isMuted
      ? "border-border bg-muted/40 text-muted-foreground dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-muted-foreground"
      : isSuccess
      ? "border-success/25 bg-success/15 text-success dark:border-success/30 dark:bg-success/18 dark:text-success"
      : isDanger
        ? "border-destructive/25 bg-destructive/15 text-destructive dark:border-destructive/30 dark:bg-destructive/18 dark:text-destructive"
        : "border-warning/25 bg-warning/15 text-warning dark:border-warning/30 dark:bg-warning/18 dark:text-warning";

  return (
    <span
      className={`inline-flex items-center justify-center border px-2.5 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] ${className}`}
    >
      {label}
    </span>
  );
}
