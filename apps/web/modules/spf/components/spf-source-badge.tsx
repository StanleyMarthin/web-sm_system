import type { SpfItem, SpfMedia, SpfSource } from "@/shared/api/spf-contracts";

type SourceCarrier = Pick<SpfItem | SpfSource | SpfMedia, "source_type">;

export function SpfSourceBadge({ value }: { value: SourceCarrier["source_type"] | string | undefined }) {
  const source = value === "MANUAL" ? "MANUAL" : "SYSTEM";
  const styles =
    source === "MANUAL"
      ? "border-primary/30 bg-primary/10 text-app-accent-ink dark:border-primary/30"
      : "border-border bg-muted text-muted-foreground dark:border-white/[0.08] dark:bg-white/[0.04]";

  return (
    <span className={`inline-flex h-6 items-center border px-2 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] ${styles}`}>
      {source}
    </span>
  );
}
