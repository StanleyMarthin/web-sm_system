import type { SpfItem, SpfMedia, SpfSource } from "@/shared/api/spf-contracts";

type SourceCarrier = Pick<SpfItem | SpfSource | SpfMedia, "source_type">;

export function SpfSourceBadge({ value }: { value: SourceCarrier["source_type"] | string | undefined }) {
  const source = value === "MANUAL" ? "MANUAL" : value === "EXCEL" ? "EXCEL" : "SYSTEM";
  const label = value === "MANUAL" ? "Manual" : value === "EXCEL" ? "Excel" : "Sistem";
  const styles =
    source === "MANUAL"
      ? "border-primary/30 bg-primary/10 text-app-accent-ink dark:border-primary/30"
      : source === "EXCEL"
        ? "border-info/30 bg-info/10 text-info dark:border-info/30"
        : "border-border bg-muted text-muted-foreground dark:border-white/[0.08] dark:bg-white/[0.04]";

  return (
    <span className={`inline-flex h-6 items-center border px-2 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] ${styles}`}>
      {label}
    </span>
  );
}
