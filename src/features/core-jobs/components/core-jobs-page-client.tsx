"use client";

// ============================================================
// Core Jobs Page Client — DataTable view (API #6, #7, #8)
// ============================================================

import { CORE_JOBS } from "@/lib/dummy-data";
import { Badge } from "@/components/ui/badge";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { SERIF_STYLE } from "@/lib/constants";
import { DarkCard } from "@/components/ui/dark-card";
import type { CoreJob, CoreJobStatus } from "@/types";

function statusBadge(status: CoreJobStatus) {
  switch (status) {
    case "PLAN":
      return <Badge className="bg-white/[0.06] text-white/40 border-0 text-[10px]">Plan</Badge>;
    case "IN_PROGRESS":
      return <Badge className="bg-amber-500/10 text-amber-400 border-0 text-[10px]">In Progress</Badge>;
    case "DONE":
      return <Badge className="bg-emerald-500/10 text-emerald-400 border-0 text-[10px]">Done</Badge>;
  }
}

const COLUMNS: DataTableColumn<CoreJob>[] = [
  { key: "coreId", label: "Core ID", sortable: true, sortValue: (r) => r.coreId, render: (r) => <span className="font-medium text-sm text-white/50 font-mono">{r.coreId}</span> },
  { key: "unit", label: "Unit", sortable: true, sortValue: (r) => r.unitName, render: (r) => <span className="font-medium text-sm text-white/70">{r.unitName}</span> },
  { key: "panel", label: "Panel", sortable: true, sortValue: (r) => r.panel, render: (r) => <span className="text-white/50 text-sm">{r.panel}</span> },
  { key: "job", label: "Job", sortable: true, sortValue: (r) => r.job, render: (r) => <span className="text-white/50 text-sm">{r.job}</span> },
  { key: "division", label: "Division", sortable: true, sortValue: (r) => r.divisionName, render: (r) => <span className="text-white/50 text-sm">{r.divisionName}</span> },
  { key: "target", label: "Target (h)", align: "right" as const, sortable: true, sortValue: (r) => r.targetHours, render: (r) => <span className="text-white/50 text-sm tabular-nums">{r.targetHours}</span> },
  { key: "deadline", label: "Deadline", sortable: true, sortValue: (r) => r.deadline, render: (r) => <span className="text-white/50 text-sm">{r.deadline}</span> },
  { key: "status", label: "Status", sortable: true, sortValue: (r) => r.status, render: (r) => statusBadge(r.status) },
  { key: "prereq", label: "Prerequisite", render: (r) => <span className="text-white/40 text-sm font-mono">{r.prerequisiteCoreId ?? "—"}</span> },
];

export function CoreJobsPageClient() {
  const jobs = CORE_JOBS;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-light text-white/90 tracking-wide" style={SERIF_STYLE}>
          Core Jobs (WBS)
        </h2>
        <p className="text-[11px] text-white/30 tracking-[0.15em] uppercase mt-1">
          {jobs.length} jobdesc · GET /api/v1/web/core-jobs
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { value: jobs.filter((j) => j.status === "PLAN").length, label: "Plan" },
          { value: jobs.filter((j) => j.status === "IN_PROGRESS").length, label: "In Progress" },
          { value: jobs.filter((j) => j.status === "DONE").length, label: "Done" },
        ].map((item) => (
          <DarkCard key={item.label} className="p-4 text-center">
            <p className="text-2xl font-bold text-white/90" style={SERIF_STYLE}>{item.value}</p>
            <p className="text-[11px] text-white/35 tracking-wider uppercase">{item.label}</p>
          </DarkCard>
        ))}
      </div>

      <DataTable
        data={jobs}
        columns={COLUMNS}
        rowKey={(r) => r.coreId}
        selectable
        searchable
        searchPlaceholder="Cari core ID, unit, panel, job..."
        searchFn={(r, q) =>
          r.coreId.toLowerCase().includes(q) ||
          r.unitName.toLowerCase().includes(q) ||
          r.panel.toLowerCase().includes(q) ||
          r.job.toLowerCase().includes(q)
        }
        emptyMessage="Tidak ada core job."
      />
    </div>
  );
}
