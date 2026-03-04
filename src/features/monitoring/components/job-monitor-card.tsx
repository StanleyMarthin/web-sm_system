"use client";

// ============================================================
// Job Monitor Card — SM luxury dark vibe
// ============================================================

import { memo } from "react";
import { Badge } from "@/components/ui/badge";
import type { MonitoringJob } from "@/types";
import { Clock, User, AlertTriangle, CheckCircle2, Circle } from "lucide-react";
import { SERIF_STYLE } from "@/lib/constants";
import { DarkCard } from "@/components/ui/dark-card";

function statusColor(status: MonitoringJob["status"]) {
  switch (status) {
    case "TO_DO":
      return "bg-white/[0.06] text-white/40";
    case "IN_PROGRESS":
      return "bg-amber-500/10 text-amber-400";
    case "DONE":
      return "bg-emerald-500/10 text-emerald-400";
  }
}

function statusLabel(status: MonitoringJob["status"]) {
  switch (status) {
    case "TO_DO":
      return "Belum Mulai";
    case "IN_PROGRESS":
      return "Sedang Dikerjakan";
    case "DONE":
      return "Selesai";
  }
}

export const JobMonitorCard = memo(function JobMonitorCard({ job }: { job: MonitoringJob }) {
  const progressPct =
    job.targetHoursRevised > 0
      ? Math.min(
          100,
          Math.round(
            (job.totalActualHours / job.targetHoursRevised) * 100
          )
        )
      : 0;

  return (
    <DarkCard interactive>
      {/* Header */}
      <div className="px-4 pt-4 pb-2 space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm text-white/90 truncate">{job.unitName}</p>
            <p className="text-xs text-white/30 truncate">
              {job.ownerName} · {job.panelName}
            </p>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {job.isUrgent && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                <AlertTriangle className="w-3 h-3 mr-0.5" />
                URGENT
              </Badge>
            )}
            <Badge className={`text-[10px] px-1.5 py-0 border-0 ${statusColor(job.status)}`}>
              {statusLabel(job.status)}
            </Badge>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pb-4 space-y-3">
        <p className="text-xs text-white/40">{job.jobName}</p>
        {job.detailPOK && (
          <p className="text-xs text-white/25 italic line-clamp-2">
            {job.detailPOK}
          </p>
        )}

        {/* Mechanic & Shift */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1 text-white/35">
            <User className="w-3 h-3" />
            {job.mechanicName}
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.05] text-white/40">
            {job.shiftType}
          </span>
        </div>

        {/* Hours Progress */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1 text-white/35">
              <Clock className="w-3 h-3" />
              {job.totalActualHours}h / {job.targetHoursRevised}h
            </div>
            <span className="text-amber-500/70 text-[11px]" style={SERIF_STYLE}>
              {progressPct}%
            </span>
          </div>
          <div className="relative h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-amber-600 to-amber-400"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Checkpoints */}
        {job.checkpoints.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <p className="text-[9px] text-white/20 uppercase tracking-[0.2em]">
              Checkpoints
            </p>
            {job.checkpoints.map((cp, i) => (
              <div
                key={i}
                className="flex items-center gap-2 text-xs"
              >
                {cp.status === "VALIDATED" ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                ) : (
                  <Circle className="w-3.5 h-3.5 text-white/15 flex-shrink-0" />
                )}
                <span className="text-white/30">{cp.time}</span>
                <span className={cp.status === "VALIDATED" ? "text-white/70" : "text-white/30"}>
                  {cp.label}
                </span>
                {cp.progressPercent !== null && (
                  <span className="ml-auto text-amber-500/50">
                    {cp.progressPercent}%
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </DarkCard>
  );
});
