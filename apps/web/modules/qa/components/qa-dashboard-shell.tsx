import type { QaDashboardSummary } from "@smsystem/contracts/qa";

function fmtPct(value: number) {
  return `${new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(value)}%`;
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-4">
      <p className="text-[10px] uppercase tracking-[0.16em] text-foreground/35">{label}</p>
      <p className="mt-3 text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

function EmptyBlock({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-white/[0.08] bg-white/[0.02] px-4 py-8 text-sm text-foreground/35">
      {message}
    </div>
  );
}

const chartColors = [
  "var(--primary)",
  "var(--info)",
  "var(--success)",
  "var(--destructive)",
  "var(--warning)",
  "var(--app-accent-ink)",
  "var(--muted-foreground)",
];

export function QaDashboardShell({ dashboard }: { dashboard: QaDashboardSummary }) {
  const totalArea = dashboard.issueAreaDistribution.reduce((sum, item) => sum + item.total, 0);
  const donutStops = (() => {
    if (totalArea === 0) return "conic-gradient(rgba(255,255,255,0.08) 0deg 360deg)";
    let start = 0;
    return `conic-gradient(${dashboard.issueAreaDistribution
      .map((item, index) => {
        const size = (item.total / totalArea) * 360;
        const segment = `${chartColors[index % chartColors.length]} ${start}deg ${start + size}deg`;
        start += size;
        return segment;
      })
      .join(", ")})`;
  })();

  return (
    <div className="space-y-4">
      <section className="grid gap-3 md:grid-cols-3">
        <KpiCard label="Total inspeksi bulan ini" value={String(dashboard.totalInspectionsThisMonth)} />
        <KpiCard label="First time yield" value={fmtPct(dashboard.firstTimeYieldPercent)} />
        <KpiCard label="Temuan open" value={String(dashboard.openFindingsCount)} />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-xl border border-white/[0.06] bg-card p-4">
          <div className="mb-4">
            <p className="text-sm font-semibold text-foreground">Top 5 Divisi Penyumbang Reject</p>
          </div>
          {dashboard.topRejectDivisions.length > 0 ? (
            <div className="space-y-3">
              {dashboard.topRejectDivisions.map((item) => {
                const maxValue = dashboard.topRejectDivisions[0]?.rejectCount ?? 1;
                const width = maxValue > 0 ? (item.rejectCount / maxValue) * 100 : 0;
                return (
                  <div key={item.divisionName} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-foreground/75">{item.divisionName}</span>
                      <span className="font-semibold text-foreground">{item.rejectCount}</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-white/[0.06]">
                      <div className="h-2.5 rounded-full bg-destructive" style={{ width: `${width}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyBlock message="Belum ada data reject divisi pada scope aktif." />
          )}
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-card p-4">
          <div className="mb-4">
            <p className="text-sm font-semibold text-foreground">Distribusi Area Masalah</p>
          </div>
          {dashboard.issueAreaDistribution.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-[180px_1fr] md:items-center">
              <div className="mx-auto flex h-[180px] w-[180px] items-center justify-center rounded-full" style={{ background: donutStops }}>
                <div className="flex h-[112px] w-[112px] items-center justify-center rounded-full bg-card text-center">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.14em] text-foreground/35">Total</p>
                    <p className="mt-1 text-2xl font-semibold text-foreground">{totalArea}</p>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                {dashboard.issueAreaDistribution.map((item, index) => {
                  return (
                    <div key={item.issueArea} className="flex items-center justify-between gap-3 text-sm">
                      <span className="inline-flex items-center gap-2 text-foreground/75">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: chartColors[index % chartColors.length] }} />
                        {item.issueArea}
                      </span>
                      <span className="font-semibold text-foreground">{item.total}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <EmptyBlock message="Belum ada area masalah yang terklasifikasi." />
          )}
        </div>
      </section>

      <section className="rounded-xl border border-white/[0.06] bg-card p-4">
        <div className="mb-4">
          <p className="text-sm font-semibold text-foreground">Critical Alert</p>
        </div>
        {dashboard.criticalAlerts.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-white/[0.04] bg-white/[0.015]">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] bg-white/[0.02] text-[10px] uppercase tracking-[0.16em] text-foreground/35">
                  <th className="px-3 py-2 font-medium">Tanggal</th>
                  <th className="px-3 py-2 font-medium">Unit</th>
                  <th className="px-3 py-2 font-medium">Divisi</th>
                  <th className="px-3 py-2 font-medium">Jobdesc</th>
                  <th className="px-3 py-2 font-medium">Prioritas</th>
                  <th className="px-3 py-2 font-medium">Follow-up</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.criticalAlerts.map((row) => (
                  <tr key={row.qcId} className="border-b border-white/[0.04] last:border-b-0">
                    <td className="px-3 py-2.5 text-foreground/75">{row.inspectionDate}</td>
                    <td className="px-3 py-2.5 text-foreground">{row.unitName}</td>
                    <td className="px-3 py-2.5 text-foreground/75">{row.divisionName ?? "-"}</td>
                    <td className="px-3 py-2.5 text-foreground/75">{row.jobName}</td>
                    <td className="px-3 py-2.5 text-destructive">{row.priorityLevel ?? "-"}</td>
                    <td className="px-3 py-2.5 text-app-accent-ink">{row.followupStatus ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyBlock message="Belum ada reject prioritas tinggi yang masih open." />
        )}
      </section>
    </div>
  );
}
