"use client";

// ============================================================
// Projects Page Client — DataTable view (API #3, #5)
// ============================================================

import { PROJECTS } from "@/lib/dummy-data";
import { Badge } from "@/components/ui/badge";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { SERIF_STYLE } from "@/lib/constants";
import { DarkCard } from "@/components/ui/dark-card";
import type { Project, ProjectStatus } from "@/types";

function statusBadge(status: ProjectStatus) {
  switch (status) {
    case "ACTIVE":
      return <Badge className="bg-amber-500/10 text-amber-400 border-0 text-[10px]">Active</Badge>;
    case "COMPLETED":
      return <Badge className="bg-emerald-500/10 text-emerald-400 border-0 text-[10px]">Completed</Badge>;
    case "ON_HOLD":
      return <Badge className="bg-white/[0.06] text-white/40 border-0 text-[10px]">On Hold</Badge>;
  }
}

const COLUMNS: DataTableColumn<Project>[] = [
  { key: "unit", label: "Unit", sortable: true, sortValue: (r) => r.unitName, render: (r) => <span className="font-medium text-sm text-white/70">{r.unitName}</span> },
  { key: "customer", label: "Customer", sortable: true, sortValue: (r) => r.customerName, render: (r) => <span className="text-white/50 text-sm">{r.customerName}</span> },
  { key: "type", label: "Tipe Restorasi", sortable: true, sortValue: (r) => r.restorationType, render: (r) => <span className="text-white/50 text-sm">{r.restorationType}</span> },
  { key: "start", label: "Start", sortable: true, sortValue: (r) => r.startDate, render: (r) => <span className="text-white/50 text-sm">{r.startDate}</span> },
  { key: "end", label: "End", sortable: true, sortValue: (r) => r.endDate, render: (r) => <span className="text-white/50 text-sm">{r.endDate}</span> },
  { key: "delivery", label: "Contract Delivery", sortable: true, sortValue: (r) => r.contractDeliveryDate, render: (r) => <span className="text-white/50 text-sm">{r.contractDeliveryDate}</span> },
  { key: "progress", label: "Progress", align: "right" as const, sortable: true, sortValue: (r) => r.progress, render: (r) => <span className="text-amber-500/70 text-sm tabular-nums" style={SERIF_STYLE}>{r.progress}%</span> },
  { key: "status", label: "Status", sortable: true, sortValue: (r) => r.status, render: (r) => statusBadge(r.status) },
];

export function ProjectsPageClient() {
  const projects = PROJECTS;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-light text-white/90 tracking-wide" style={SERIF_STYLE}>
          Projects
        </h2>
        <p className="text-[11px] text-white/30 tracking-[0.15em] uppercase mt-1">
          {projects.length} project · GET /api/v1/web/calendar/projects
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { value: projects.length, label: "Total" },
          { value: projects.filter((p) => p.status === "ACTIVE").length, label: "Active" },
          { value: projects.filter((p) => p.progress >= 80).length, label: "Near Complete" },
        ].map((item) => (
          <DarkCard key={item.label} className="p-4 text-center">
            <p className="text-2xl font-bold text-white/90" style={SERIF_STYLE}>{item.value}</p>
            <p className="text-[11px] text-white/35 tracking-wider uppercase">{item.label}</p>
          </DarkCard>
        ))}
      </div>

      <DataTable
        data={projects}
        columns={COLUMNS}
        rowKey={(r) => r.carId}
        selectable
        searchable
        searchPlaceholder="Cari unit, customer..."
        searchFn={(r, q) =>
          r.unitName.toLowerCase().includes(q) ||
          r.customerName.toLowerCase().includes(q) ||
          r.restorationType.toLowerCase().includes(q)
        }
        emptyMessage="Tidak ada project."
      />
    </div>
  );
}
