"use client";

// ============================================================
// Dashboard Overview — SM luxury dark vibe
// ============================================================

import { memo, useMemo } from "react";
import { MONITORING_JOBS, WORK_ORDERS, PLAN_JOBS, KPI_SUMMARY } from "@/lib/dummy-data";
import { useAuthStore } from "@/features/auth/stores/auth-store";
import { SERIF_STYLE } from "@/lib/constants";
import { DarkCard } from "@/components/ui/dark-card";
import {
  Monitor,
  Calendar,
  FileText,
  TrendingUp,
  CheckCircle,
  Play,
  AlertTriangle,
  Clock,
} from "lucide-react";

const StatCard = memo(function StatCard({
  icon: Icon,
  value,
  label,
  accent = false,
}: {
  icon: React.ElementType;
  value: string | number;
  label: string;
  accent?: boolean;
}) {
  return (
    <DarkCard className="p-4 flex items-center gap-3">
      <div className={`p-2.5 rounded-lg ${
        accent ? "bg-amber-500/10 text-amber-500" : "bg-white/[0.04] text-white/30"
      }`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-white/90" style={SERIF_STYLE}>
          {value}
        </p>
        <p className="text-[11px] text-white/35 tracking-wider uppercase">{label}</p>
      </div>
    </DarkCard>
  );
});

const GaugeCard = memo(function GaugeCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
}) {
  return (
    <DarkCard className="p-5 space-y-3">
      <div className="flex items-center gap-2 text-white/35">
        <Icon className="w-3.5 h-3.5" />
        <span className="text-[11px] tracking-wider uppercase">{label}</span>
      </div>
      <p className="text-3xl font-bold text-amber-500" style={SERIF_STYLE}>
        {value}%
      </p>
      <div className="relative h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-amber-600 to-amber-400"
          style={{ width: `${value}%` }}
        />
      </div>
    </DarkCard>
  );
});

export function DashboardOverview() {
  const user = useAuthStore((s) => s.user);

  const { activeJobs, doneJobs, urgentJobs, pendingWo, totalPlanned } = useMemo(() => {
    const monJobs = MONITORING_JOBS;
    return {
      activeJobs: monJobs.filter((j) => j.status === "IN_PROGRESS").length,
      doneJobs: monJobs.filter((j) => j.status === "DONE").length,
      urgentJobs: monJobs.filter((j) => j.isUrgent).length,
      pendingWo: WORK_ORDERS.filter(
        (w) => w.status === "PENDING_ADVISOR" || w.status === "PENDING_PM"
      ).length,
      totalPlanned: PLAN_JOBS.length,
    };
  }, []);

  const todayStr = useMemo(
    () =>
      new Date().toLocaleDateString("id-ID", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    []
  );

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div>
        <h2
          className="text-xl font-light text-white/90 tracking-wide"
          style={SERIF_STYLE}
        >
          Selamat Datang, {user?.fullName}
        </h2>
        <p className="text-[11px] text-white/30 tracking-[0.15em] uppercase mt-1">
          {user?.role.toUpperCase()} · {user?.divisionName} ·{" "}
          {todayStr}
        </p>
      </div>

      {/* Section: Quick Stats */}
      <div>
        <p className="text-[9px] font-medium uppercase tracking-[0.2em] text-white/25 mb-3">
          Ringkasan
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard icon={Monitor} value={MONITORING_JOBS.length} label="Monitoring Jobs" accent />
          <StatCard icon={Play} value={activeJobs} label="In Progress" />
          <StatCard icon={CheckCircle} value={doneJobs} label="Completed" />
          <StatCard icon={AlertTriangle} value={urgentJobs} label="Urgent" accent />
        </div>
      </div>

      {/* Section: KPI Gauges */}
      <div>
        <p className="text-[9px] font-medium uppercase tracking-[0.2em] text-white/25 mb-3">
          Key Performance
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <GaugeCard icon={TrendingUp} label="Efficiency" value={KPI_SUMMARY.efficiency} />
          <GaugeCard icon={CheckCircle} label="QC Pass Rate" value={KPI_SUMMARY.qcPassRate} />
          <GaugeCard icon={Clock} label="On-Time Rate" value={KPI_SUMMARY.onTimeRate} />
        </div>
      </div>

      {/* Section: Quick Links */}
      <div>
        <p className="text-[9px] font-medium uppercase tracking-[0.2em] text-white/25 mb-3">
          Hari Ini
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <DarkCard className="p-4 flex items-center gap-3">
            <Calendar className="w-5 h-5 text-white/25" />
            <div>
              <p className="text-lg font-bold text-white/90" style={SERIF_STYLE}>
                {totalPlanned}
              </p>
              <p className="text-[11px] text-white/35 tracking-wider uppercase">Plan Hari Ini</p>
            </div>
          </DarkCard>
          <DarkCard className="p-4 flex items-center gap-3">
            <FileText className="w-5 h-5 text-white/25" />
            <div>
              <p className="text-lg font-bold text-white/90" style={SERIF_STYLE}>
                {pendingWo}
              </p>
              <p className="text-[11px] text-white/35 tracking-wider uppercase">WO Pending</p>
            </div>
          </DarkCard>
          <DarkCard className="p-4">
            <p className="text-[11px] text-white/35 tracking-wider uppercase mb-1.5">Hours Today</p>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold text-amber-500" style={SERIF_STYLE}>
                {KPI_SUMMARY.actualHours}h
              </span>
              <span className="text-[11px] text-white/30">/ {KPI_SUMMARY.standardHours}h target</span>
            </div>
          </DarkCard>
        </div>
      </div>
    </div>
  );
}
