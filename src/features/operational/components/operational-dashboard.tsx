"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { useAuthStore } from "@/features/auth/stores/auth-store";
import { SERIF_STYLE } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { ClipboardList, Users, CheckSquare, TrendingUp, Calendar } from "lucide-react";
import { getJobPlans } from "@/features/operational/services/job-plan-service";
import { getOperationalMonitoringCars } from "@/features/operational/services/monitoring-service";
import { getQcDivisions } from "@/features/operational/services/qc-service";
import { getWorkOrders } from "@/features/operational/services/wo-service";

function StatCard({
  title, value, subtitle, icon, alert, loading
}: {
  title: string; value: number | string; subtitle?: string;
  icon: React.ReactNode; alert?: boolean; loading?: boolean;
}) {
  return (
    <div className={cn(
      "relative overflow-hidden rounded-xl border p-5 flex flex-col gap-3 transition-colors",
      alert ? "bg-red-500/10 border-red-500/30" : "bg-white/[0.02] border-white/[0.08]"
    )}>
      {alert && <div className="absolute top-0 right-0 w-16 h-16 bg-red-500/10 blur-2xl rounded-full translate-x-1/2 -translate-y-1/2" />}
      <div className="flex items-center justify-between z-10">
        <p className={cn("text-[10px] uppercase tracking-[0.15em] font-medium", alert ? "text-red-400" : "text-white/40")}>
          {title}
        </p>
        <span className={cn("p-2 rounded-lg", alert ? "bg-red-500/20 text-red-400" : "bg-white/[0.04] text-white/50")}>
          {icon}
        </span>
      </div>
      <div className="z-10">
        {loading ? (
          <div className="h-10 w-16 bg-white/5 animate-pulse rounded" />
        ) : (
          <p className={cn("text-4xl font-light tabular-nums tracking-tight", alert ? "text-red-400" : "text-white/90")} style={SERIF_STYLE}>
            {value}
          </p>
        )}
        {subtitle && <p className="text-[11px] text-white/30 mt-2">{subtitle}</p>}
      </div>
    </div>
  );
}

export function OperationalDashboard() {
  const user = useAuthStore(s => s.user);
  const today = useMemo(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().split("T")[0];
  }, []);
  const [date, setDate] = useState(today);

  // Stat counts
  const { data: jpStat, isLoading: jpL } = useSWR(
    user ? ["op-jp-s", user.userId, date] : null,
    () => getJobPlans({ userId: user!.userId, action: "queue", taskDate: date }),
    { revalidateOnFocus: false }
  );
  const { data: monitoringStat = [], isLoading: monitoringL } = useSWR(
    user ? ["op-monitoring-s", user.userId] : null,
    () => getOperationalMonitoringCars(user!.userId),
    { revalidateOnFocus: false }
  );
  const { data: qcStat, isLoading: qcL } = useSWR(
    user ? ["op-qc-s", user.userId] : null,
    () => getQcDivisions(user!.userId),
    { revalidateOnFocus: false }
  );
  const { data: woStat, isLoading: woL } = useSWR(
    user ? ["op-wo-s", user.userId] : null,
    () => getWorkOrders({ userId: user!.userId, view: "ACTIVE" }),
    { revalidateOnFocus: false }
  );

  if (!user) return null;

  const qcTotal = (qcStat?.divisions ?? []).reduce((s, d) => s + d.totalItem, 0);

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-light text-white/90 tracking-wide" style={SERIF_STYLE}>
            Operational Control
          </h2>
          <p className="text-[11px] text-white/30 tracking-[0.15em] uppercase mt-1">
            {date ? new Date(date + "T00:00:00").toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "Semua Tanggal"}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-[11px] text-white/40 uppercase tracking-wider">Tanggal</label>
          <div className="flex items-center gap-2 bg-[#0a0a0a] border border-white/10 rounded-md px-3 py-1.5 focus-within:border-amber-500/50 transition-colors">
            <Calendar className="w-3.5 h-3.5 text-amber-500/60 shrink-0" />
            <input
              type="date" value={date}
              onChange={e => setDate(e.target.value)}
              className="bg-transparent text-white/80 text-xs focus:outline-none min-w-[110px]"
              style={{ colorScheme: "dark" }}
            />
          </div>
          {date !== today && (
            <button onClick={() => setDate(today)}
              className="text-[10px] text-white/30 hover:text-amber-400 px-2 py-1.5 rounded transition-colors">
              Hari Ini
            </button>
          )}
        </div>
      </div>

      {/* ── Stat Cards ───────────────── */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard title="Job Plan" icon={<ClipboardList className="w-4 h-4" />}
          value={jpStat?.items?.length ?? 0}
          subtitle="Hari ini" loading={jpL} />
        <StatCard title="Monitoring Unit" icon={<Users className="w-4 h-4" />}
          value={monitoringStat.length}
          subtitle="Scope unit terpantau" loading={monitoringL} />
        <StatCard title="Antrean QC" icon={<CheckSquare className="w-4 h-4" />}
          value={qcTotal}
          subtitle="Ready QC" alert={qcTotal > 10} loading={qcL} />
        <StatCard title="Work Order Aktif" icon={<TrendingUp className="w-4 h-4" />}
          value={woStat?.length ?? 0}
          subtitle="Dalam proses" loading={woL} />
      </div>

      <div className="flex items-center justify-center h-48 border border-dashed border-white/[0.06] rounded-xl text-white/20 text-sm">
        Pilih menu di sidebar untuk melihat detail tiap modul.
      </div>
    </div>
  );
}
