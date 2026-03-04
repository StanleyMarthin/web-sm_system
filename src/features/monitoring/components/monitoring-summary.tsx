"use client";

// ============================================================
// Monitoring Summary Tiles — SM luxury dark vibe
// ============================================================

import { memo } from "react";
import { ClipboardList, Play, CheckCircle, AlertTriangle } from "lucide-react";
import { SERIF_STYLE } from "@/lib/constants";
import { DarkCard } from "@/components/ui/dark-card";

interface SummaryProps {
  total: number;
  toDo: number;
  inProgress: number;
  done: number;
  urgent: number;
}

const tiles = [
  { key: "total" as const, label: "Total Jobs", icon: ClipboardList, accent: true },
  { key: "inProgress" as const, label: "In Progress", icon: Play, accent: false },
  { key: "done" as const, label: "Selesai", icon: CheckCircle, accent: false },
  { key: "urgent" as const, label: "Urgent", icon: AlertTriangle, accent: true },
];

export const MonitoringSummary = memo(function MonitoringSummary(props: SummaryProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {tiles.map(({ key, label, icon: Icon, accent }) => (
        <DarkCard
          key={key}
          className="p-4 flex items-center gap-3"
        >
          <div
            className={`p-2.5 rounded-lg ${
              accent ? "bg-amber-500/10 text-amber-500" : "bg-white/[0.04] text-white/30"
            }`}
          >
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <p
              className="text-2xl font-bold text-white/90"
              style={SERIF_STYLE}
            >
              {props[key]}
            </p>
            <p className="text-[11px] text-white/35 tracking-wider uppercase">
              {label}
            </p>
          </div>
        </DarkCard>
      ))}
    </div>
  );
});
