import type { MonitoringTaskRecord } from "@smsystem/contracts/monitoring";

export function executionTime(value: string | null | undefined) {
  if (!value) return "-";
  if (!value.includes("T")) return value.slice(0, 5);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(date);
}

export function ExecutionHistory({ row }: { row: MonitoringTaskRecord }) {
  const segments = row.executionSegments ?? [];
  return (
    <section className="border border-border bg-card p-3 text-foreground" aria-label="Riwayat sesi kerja">
      <h3 className="text-sm font-semibold">Riwayat sesi kerja</h3>
      {segments.length === 0 && !row.activeSegmentStartedAt ? (
        <p className="mt-2 text-sm text-muted-foreground">Belum ada riwayat sesi kerja.</p>
      ) : (
        <ol className="mt-2 divide-y divide-border">
          {segments.map((segment, index) => (
            <li key={segment.segment_id} className="py-2 text-sm">
              <p className="font-medium">Sesi {index + 1} · {segment.close_reason === "HOLD" ? "Dijeda" : "Sesi ditutup"}</p>
              <dl className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-3">
                <div><dt className="text-muted-foreground">Mulai</dt><dd>{executionTime(segment.started_at)}</dd></div>
                <div><dt className="text-muted-foreground">{segment.close_reason === "HOLD" ? "Jeda" : "Tutup sesi"}</dt><dd>{executionTime(segment.finished_at)}</dd></div>
                <div><dt className="text-muted-foreground">Kerja aktif</dt><dd>{segment.worked_minutes} menit</dd></div>
              </dl>
            </li>
          ))}
          {row.activeSegmentStartedAt ? (
            <li className="py-2 text-sm"><p className="font-medium">Sesi {segments.length + 1} · Berjalan</p><p className="mt-1">Mulai {executionTime(row.activeSegmentStartedAt)}</p></li>
          ) : null}
        </ol>
      )}
      {row.executionNote ? <p className="mt-2 whitespace-pre-wrap break-words text-sm">Catatan: {row.executionNote}</p> : null}
    </section>
  );
}
