"use client";

// ============================================================
// QC Page Client — DataTable view
// ============================================================

import { useMemo } from "react";
import { QC_JOBS } from "@/lib/dummy-data";
import { Badge } from "@/components/ui/badge";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { ThumbsUp, RotateCcw } from "lucide-react";
import type { QcJob } from "@/types";
import { SERIF_STYLE } from "@/lib/constants";
import { DarkCard } from "@/components/ui/dark-card";

function qcStatusBadge(status: QcJob["qcStatus"]) {
  switch (status) {
    case "PENDING":
      return <Badge className="bg-amber-500/10 text-amber-400 border-0 text-[10px]">Pending</Badge>;
    case "APPROVED":
      return <Badge className="bg-emerald-500/10 text-emerald-400 border-0 text-[10px]">Approved</Badge>;
    case "REWORK":
      return <Badge className="bg-red-500/10 text-red-400 border-0 text-[10px]">Rework</Badge>;
  }
}

const COLUMNS: DataTableColumn<QcJob>[] = [
  {
    key: "unit", label: "Unit", sortable: true,
    sortValue: (r) => r.unitName,
    render: (r) => <span className="font-medium text-sm text-white/70">{r.unitName}</span>,
  },
  {
    key: "panel", label: "Panel", sortable: true,
    sortValue: (r) => r.panelName,
    render: (r) => <span className="text-white/50 text-sm">{r.panelName}</span>,
  },
  {
    key: "job", label: "Job",
    render: (r) => <span className="text-white/50 text-sm">{r.jobName}</span>,
  },
  {
    key: "mechanic", label: "Mechanic", sortable: true,
    sortValue: (r) => r.mechanicName,
    render: (r) => <span className="text-white/50 text-sm">{r.mechanicName}</span>,
  },
  {
    key: "selesai", label: "Selesai", sortable: true,
    sortValue: (r) => r.completedAt,
    render: (r) => <span className="text-white/50 text-sm">{new Date(r.completedAt).toLocaleDateString("id-ID")}</span>,
  },
  {
    key: "qcStatus", label: "QC Status", sortable: true,
    sortValue: (r) => r.qcStatus,
    render: (r) => qcStatusBadge(r.qcStatus),
  },
  {
    key: "checks", label: "Check Items",
    render: (r) => {
      const passCount = r.checkItems.filter((i) => i.status === "PASS").length;
      const failCount = r.checkItems.filter((i) => i.status === "FAIL").length;
      return (
        <span className="text-sm">
          <span className="text-emerald-400">{passCount}P</span>
          {failCount > 0 && <span className="text-red-400 ml-1">{failCount}F</span>}
          <span className="text-white/30 ml-1">/ {r.checkItems.length}</span>
        </span>
      );
    },
  },
  {
    key: "aksi", label: "Aksi",
    render: (r) => r.qcStatus === "PENDING" ? (
      <div className="flex gap-1.5">
        <button className="px-2 py-1 rounded text-[10px] bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 transition-colors flex items-center gap-1">
          <ThumbsUp className="w-3 h-3" /> Approve
        </button>
        <button className="px-2 py-1 rounded text-[10px] bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors flex items-center gap-1">
          <RotateCcw className="w-3 h-3" /> Rework
        </button>
      </div>
    ) : null,
  },
];

export function QcPageClient() {
  const jobs = QC_JOBS;

  const { pending, approved, rework } = useMemo(() => ({
    pending: jobs.filter((j) => j.qcStatus === "PENDING").length,
    approved: jobs.filter((j) => j.qcStatus === "APPROVED").length,
    rework: jobs.filter((j) => j.qcStatus === "REWORK").length,
  }), [jobs]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-light text-white/90 tracking-wide" style={SERIF_STYLE}>
          Quality Check
        </h2>
        <p className="text-[11px] text-white/30 tracking-[0.15em] uppercase mt-1">
          {jobs.length} items
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { value: pending, label: "Pending", color: "text-amber-400" },
          { value: approved, label: "Approved", color: "text-emerald-400" },
          { value: rework, label: "Rework", color: "text-red-400" },
        ].map((item) => (
          <DarkCard key={item.label} className="p-4 text-center">
            <p className={`text-2xl font-bold ${item.color}`} style={SERIF_STYLE}>{item.value}</p>
            <p className="text-[11px] text-white/35 tracking-wider uppercase">{item.label}</p>
          </DarkCard>
        ))}
      </div>

      <DataTable
        data={jobs}
        columns={COLUMNS}
        rowKey={(r) => r.id}
        selectable
        searchable
        searchPlaceholder="Cari unit, panel, mechanic..."
        searchFn={(r, q) =>
          r.unitName.toLowerCase().includes(q) ||
          r.panelName.toLowerCase().includes(q) ||
          r.mechanicName.toLowerCase().includes(q) ||
          r.jobName.toLowerCase().includes(q)
        }
        emptyMessage="Tidak ada QC job."
      />
    </div>
  );
}
