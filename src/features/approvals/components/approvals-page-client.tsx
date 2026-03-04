"use client";

// ============================================================
// Approvals Page Client — DataTable view (API #11, #12)
// ============================================================

import { APPROVALS } from "@/lib/dummy-data";
import { Badge } from "@/components/ui/badge";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { SERIF_STYLE } from "@/lib/constants";
import { DarkCard } from "@/components/ui/dark-card";
import type { Approval, ApprovalStatus, ApprovalType } from "@/types";
import { Check, X } from "lucide-react";

function statusBadge(status: ApprovalStatus) {
  switch (status) {
    case "PENDING":
      return <Badge className="bg-amber-500/10 text-amber-400 border-0 text-[10px]">Pending</Badge>;
    case "APPROVED":
      return <Badge className="bg-emerald-500/10 text-emerald-400 border-0 text-[10px]">Approved</Badge>;
    case "REJECTED":
      return <Badge className="bg-red-500/10 text-red-400 border-0 text-[10px]">Rejected</Badge>;
  }
}

function typeLabel(type: ApprovalType) {
  switch (type) {
    case "TIME_EXT":
      return "Time Extension";
    case "SCOPE_CHANGE":
      return "Scope Change";
    case "BUDGET_ADD":
      return "Budget Addition";
  }
}

const COLUMNS: DataTableColumn<Approval>[] = [
  { key: "reqId", label: "Req ID", sortable: true, sortValue: (r) => r.reqId, render: (r) => <span className="font-medium text-sm text-white/50 font-mono">{r.reqId}</span> },
  { key: "type", label: "Type", sortable: true, sortValue: (r) => r.type, render: (r) => <span className="text-white/50 text-sm">{typeLabel(r.type)}</span> },
  { key: "unit", label: "Unit", sortable: true, sortValue: (r) => r.unitName, render: (r) => <span className="font-medium text-sm text-white/70">{r.unitName}</span> },
  { key: "reqHours", label: "Req Hours", align: "right" as const, sortable: true, sortValue: (r) => r.reqHours ?? 0, render: (r) => <span className="text-white/50 text-sm tabular-nums">{r.reqHours || "—"}</span> },
  { key: "requestedBy", label: "Requested By", sortable: true, sortValue: (r) => r.requestedBy, render: (r) => <span className="text-white/50 text-sm">{r.requestedBy}</span> },
  { key: "notes", label: "Notes", cellClassName: "max-w-[200px] truncate", render: (r) => <span className="text-white/40 text-sm">{r.notes}</span> },
  { key: "status", label: "Status", sortable: true, sortValue: (r) => r.status, render: (r) => statusBadge(r.status) },
  {
    key: "aksi", label: "Aksi",
    render: (r) =>
      r.status === "PENDING" ? (
        <div className="flex gap-1">
          <button className="h-7 w-7 inline-flex items-center justify-center rounded-md text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300 transition-colors">
            <Check className="h-3.5 w-3.5" />
          </button>
          <button className="h-7 w-7 inline-flex items-center justify-center rounded-md text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <span className="text-white/20 text-xs">—</span>
      ),
  },
];

export function ApprovalsPageClient() {
  const approvals = APPROVALS;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-light text-white/90 tracking-wide" style={SERIF_STYLE}>
          Approval Center
        </h2>
        <p className="text-[11px] text-white/30 tracking-[0.15em] uppercase mt-1">
          {approvals.length} request · GET /api/v1/web/approvals
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { value: approvals.filter((a) => a.status === "PENDING").length, label: "Pending" },
          { value: approvals.filter((a) => a.status === "APPROVED").length, label: "Approved" },
          { value: approvals.filter((a) => a.status === "REJECTED").length, label: "Rejected" },
        ].map((item) => (
          <DarkCard key={item.label} className="p-4 text-center">
            <p className="text-2xl font-bold text-white/90" style={SERIF_STYLE}>{item.value}</p>
            <p className="text-[11px] text-white/35 tracking-wider uppercase">{item.label}</p>
          </DarkCard>
        ))}
      </div>

      <DataTable
        data={approvals}
        columns={COLUMNS}
        rowKey={(r) => r.reqId}
        selectable
        searchable
        searchPlaceholder="Cari request ID, unit..."
        searchFn={(r, q) =>
          r.reqId.toLowerCase().includes(q) ||
          r.unitName.toLowerCase().includes(q) ||
          r.requestedBy.toLowerCase().includes(q)
        }
        emptyMessage="Tidak ada approval request."
      />
    </div>
  );
}
