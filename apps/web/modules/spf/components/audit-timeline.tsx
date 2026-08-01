import type { SpfPeriod } from "@/shared/api/spf-contracts";

const EVENTS: Array<{
  key: keyof SpfPeriod;
  by?: keyof SpfPeriod;
  label: string;
  tone: "default" | "success" | "danger" | "warn";
}> = [
  { key: "created_at", by: "created_by", label: "Created", tone: "default" },
  { key: "submitted_at", by: "submitted_by", label: "Submitted", tone: "warn" },
  { key: "approved_at", by: "approved_by", label: "Approved", tone: "success" },
  { key: "rejected_at", by: "rejected_by", label: "Rejected", tone: "danger" },
  { key: "published_at", by: "published_by", label: "Published", tone: "success" },
  { key: "unpublished_at", by: "unpublished_by", label: "Unpublished", tone: "warn" },
];

const DOT_STYLES = {
  default: "bg-muted text-muted-foreground",
  success: "bg-success/10 text-success",
  danger: "bg-destructive/10 text-destructive",
  warn: "bg-primary/10 text-app-accent-ink",
};

function formatDateTime(value: unknown) {
  if (!value || typeof value !== "string") return null;
  return new Date(value).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

export function AuditTimeline({ period }: { period: SpfPeriod }) {
  const rows = EVENTS.map((event) => {
    const time = formatDateTime(period[event.key]);
    if (!time) return null;
    const actor = event.by ? period[event.by] : null;
    return {
      ...event,
      time,
      actor: typeof actor === "string" && actor.trim() ? actor : "-",
    };
  }).filter((row): row is NonNullable<typeof row> => Boolean(row));

  if (rows.length === 0) {
    return <p className="text-[13px] text-muted-foreground">Audit belum tersedia dari backend.</p>;
  }

  return (
    <div className="space-y-3">
      {rows.map((row, index) => (
        <div key={`${row.label}:${row.time}`} className="flex gap-3 border-b border-border pb-3 last:border-b-0 dark:border-white/[0.05]">
          <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-[11px] font-bold ${DOT_STYLES[row.tone]}`}>
            {index + 1}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-mono text-[12px] font-semibold uppercase tracking-[0.08em] text-foreground">{row.label}</p>
              <p className="font-mono text-[11px] text-muted-foreground">{row.time}</p>
            </div>
            <p className="mt-1 text-[12px] text-muted-foreground">Oleh {row.actor}</p>
          </div>
        </div>
      ))}
      {period.rejection_reason ? (
        <div className="border border-destructive/20 bg-destructive/5 px-3 py-2 text-[13px] text-destructive">
          Reject reason: {period.rejection_reason}
        </div>
      ) : null}
      {period.unpublish_reason ? (
        <div className="border border-primary/25 bg-primary/8 px-3 py-2 text-[13px] text-app-accent-ink">
          Unpublish reason: {period.unpublish_reason}
        </div>
      ) : null}
    </div>
  );
}
