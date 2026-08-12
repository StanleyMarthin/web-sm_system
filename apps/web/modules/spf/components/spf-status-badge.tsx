import type { SpfPeriodStatus, SpfSourceStatus } from "@/shared/api/spf-contracts";

const PERIOD_STATUS_STYLES: Record<SpfPeriodStatus, string> = {
  DRAFT: "border-border bg-muted text-muted-foreground dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-foreground/55",
  WAITING_APPROVAL: "border-primary/30 bg-primary/8 text-app-accent-ink dark:border-primary/25 dark:bg-primary/10",
  APPROVED: "border-success/25 bg-success/8 text-success dark:border-success/30 dark:bg-success/10",
  PUBLISHED: "border-success/40 bg-success/15 text-success dark:border-success/40 dark:bg-success/20",
  REJECTED: "border-destructive/25 bg-destructive/8 text-destructive dark:border-destructive/20 dark:bg-destructive/10",
};

const SOURCE_STATUS_STYLES: Record<SpfSourceStatus, string> = {
  READY: "border-primary/25 bg-primary/8 text-app-accent-ink dark:border-primary/25 dark:bg-primary/10",
  INCLUDED: "border-success/25 bg-success/8 text-success dark:border-success/30 dark:bg-success/10",
  EXCLUDED: "border-border bg-muted text-muted-foreground dark:border-white/[0.08] dark:bg-white/[0.04]",
};

const PERIOD_STATUS_LABELS: Record<SpfPeriodStatus, string> = {
  DRAFT: "Draft",
  WAITING_APPROVAL: "Waiting Approval",
  APPROVED: "Approved",
  PUBLISHED: "Published",
  REJECTED: "Rejected",
};

const SOURCE_STATUS_LABELS: Record<SpfSourceStatus, string> = {
  READY: "Ready",
  INCLUDED: "Included",
  EXCLUDED: "Excluded",
};

export function SpfStatusBadge({ status }: { status: SpfPeriodStatus | string }) {
  const key = status as SpfPeriodStatus;
  const className = PERIOD_STATUS_STYLES[key] ?? PERIOD_STATUS_STYLES.DRAFT;
  return (
    <span className={`inline-flex h-6 items-center border px-2 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] ${className}`}>
      {PERIOD_STATUS_LABELS[key] ?? status.replaceAll("_", " ")}
    </span>
  );
}

export function SpfSourceStatusBadge({ status }: { status: SpfSourceStatus | string }) {
  const key = status as SpfSourceStatus;
  const className = SOURCE_STATUS_STYLES[key] ?? SOURCE_STATUS_STYLES.READY;
  return (
    <span className={`inline-flex h-6 items-center border px-2 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] ${className}`}>
      {SOURCE_STATUS_LABELS[key] ?? status}
    </span>
  );
}
