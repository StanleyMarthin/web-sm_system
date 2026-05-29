"use client";

import type { PlanAlert } from "@smsystem/contracts/calendar";
import { AlertCircle, AlertTriangle } from "lucide-react";

interface PlanAlertPanelProps {
  alerts: PlanAlert[];
}

function severityClass(severity: PlanAlert["severity"]): string {
  if (severity === "CRITICAL") {
    return "border-rose-500/30 bg-rose-500/10 text-rose-100";
  }

  return "border-amber-500/25 bg-amber-500/10 text-amber-100";
}

export function PlanAlertPanel({ alerts }: PlanAlertPanelProps) {
  const visibleAlerts = alerts.filter(
    (alert) => alert.severity === "WARNING" || alert.severity === "CRITICAL",
  );

  if (visibleAlerts.length === 0) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
      <div className="flex items-center gap-2 text-amber-200">
        <AlertTriangle className="h-4 w-4" />
        <h2 className="text-sm font-semibold">Perlu Perhatian Minggu Ini</h2>
      </div>
      <div className="mt-3 overflow-x-auto rounded-2xl border border-white/[0.06] bg-black/20">
        <table className="min-w-full text-sm text-white/80">
          <thead className="text-left text-[11px] uppercase tracking-[0.12em] text-white/40">
            <tr>
              <th className="px-3 py-3">Tingkat</th>
              <th className="px-3 py-3">Catatan</th>
              <th className="px-3 py-3">Dampak</th>
            </tr>
          </thead>
          <tbody>
            {visibleAlerts.map((alert, index) => (
              <tr
                key={`${alert.type}-${alert.divisionId ?? "div"}-${alert.carId ?? "car"}-${index}`}
                className="border-t border-white/[0.06]"
              >
                <td className="px-3 py-3">
                  <span className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] ${severityClass(alert.severity)}`}>
                    <AlertCircle className="h-3 w-3" />
                    {alert.severity}
                  </span>
                </td>
                <td className="px-3 py-3">{alert.message}</td>
                <td className="px-3 py-3 text-white/55">
                  {alert.divisionId ? "Divisi terkait" : alert.carId ? "Ada unit yang terdampak" : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
