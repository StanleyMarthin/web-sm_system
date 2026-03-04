"use client";

// ============================================================
// Work Order Page Client — DataTable view
// ============================================================

import { useMemo } from "react";
import useSWR from "swr";
import { getWorkOrders } from "@/features/work-order/services/work-order-service";
import { Badge } from "@/components/ui/badge";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { ArrowRight } from "lucide-react";
import type { WoStatus, WorkOrder } from "@/types";
import { SERIF_STYLE } from "@/lib/constants";
import { Loader2 } from "lucide-react";

function woStatusBadge(status: WoStatus) {
  const map: Record<WoStatus, { label: string; cls: string }> = {
    DRAFT: { label: "Draft", cls: "bg-white/[0.06] text-white/40" },
    PENDING_ADVISOR: { label: "Menunggu Advisor", cls: "bg-amber-500/10 text-amber-400" },
    PENDING_PM: { label: "Menunggu PM", cls: "bg-orange-500/10 text-orange-400" },
    APPROVED: { label: "Disetujui", cls: "bg-emerald-500/10 text-emerald-400" },
    REJECTED: { label: "Ditolak", cls: "bg-red-500/10 text-red-400" },
    IN_PROGRESS: { label: "Dikerjakan", cls: "bg-white/[0.06] text-white/50" },
    DONE: { label: "Selesai", cls: "bg-emerald-500/10 text-emerald-400" },
  };
  const { label, cls } = map[status];
  return <Badge className={`${cls} border-0 text-[10px]`}>{label}</Badge>;
}

const COLUMNS: DataTableColumn<WorkOrder>[] = [
  {
    key: "woNumber", label: "WO Number", sortable: true,
    sortValue: (r) => r.woNumber,
    render: (r) => <span className="font-medium text-sm text-white/70">{r.woNumber}</span>,
  },
  {
    key: "type", label: "Type", sortable: true,
    sortValue: (r) => r.woType,
    render: (r) => (
      <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.05] text-white/40">
        {r.woType}
      </span>
    ),
  },
  {
    key: "unit", label: "Unit", sortable: true,
    sortValue: (r) => r.unitName,
    render: (r) => <span className="text-white/50 text-sm">{r.unitName}</span>,
  },
  {
    key: "desc", label: "Deskripsi",
    render: (r) => <span className="text-white/40 text-sm max-w-[200px] truncate block">{r.description}</span>,
  },
  {
    key: "route", label: "From → To",
    render: (r) => (
      <span className="text-white/50 text-sm inline-flex items-center gap-1">
        {r.fromDivision} <ArrowRight className="w-3 h-3 text-white/25" /> {r.toDivision}
      </span>
    ),
  },
  {
    key: "est", label: "Est (h)", align: "right", sortable: true,
    sortValue: (r) => r.estimatedHours,
    render: (r) => <span className="text-white/50 text-sm tabular-nums">{r.estimatedHours}</span>,
  },
  {
    key: "priority", label: "Priority", sortable: true,
    sortValue: (r) => r.priority === "HIGH" ? 1 : 0,
    render: (r) => r.priority === "HIGH"
      ? <Badge className="text-[10px] bg-red-500/10 text-red-400 border-0">HIGH</Badge>
      : <span className="text-white/40 text-sm">Normal</span>,
  },
  {
    key: "status", label: "Status", sortable: true,
    sortValue: (r) => r.status,
    render: (r) => woStatusBadge(r.status),
  },
  {
    key: "deadline", label: "Deadline", sortable: true,
    sortValue: (r) => r.deadline ?? "",
    render: (r) => <span className="text-white/50 text-sm">{r.deadline ?? "—"}</span>,
  },
];

export function WorkOrderPageClient() {
  const { data: orders, isLoading, error } = useSWR(
    "work-orders",
    () => getWorkOrders(),
    { revalidateOnFocus: false }
  );

  const statusCounts = useMemo(() => {
    const map = new Map<WoStatus, number>();
    for (const wo of orders ?? []) {
      map.set(wo.status, (map.get(wo.status) ?? 0) + 1);
    }
    return map;
  }, [orders]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-amber-500/40" />
      </div>
    );
  }

  if (error) {
    return <p className="text-center text-red-400/70 py-20">Gagal memuat work order.</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-light text-white/90 tracking-wide" style={SERIF_STYLE}>
          Work Orders
        </h2>
        <p className="text-[11px] text-white/30 tracking-[0.15em] uppercase mt-1">
          {orders?.length ?? 0} work order total
        </p>
      </div>

      {/* Status Summary Badges */}
      <div className="flex flex-wrap gap-2">
        {Array.from(statusCounts.entries()).map(([status, count]) => (
          <span key={status}>{woStatusBadge(status)} <span className="text-white/30 text-xs ml-0.5">({count})</span></span>
        ))}
      </div>

      <DataTable
        data={orders ?? []}
        columns={COLUMNS}
        rowKey={(r) => r.id}
        selectable
        searchable
        searchPlaceholder="Cari WO number, unit, deskripsi..."
        searchFn={(r, q) =>
          r.woNumber.toLowerCase().includes(q) ||
          r.unitName.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q) ||
          r.toDivision.toLowerCase().includes(q)
        }
        emptyMessage="Tidak ada work order."
      />
    </div>
  );
}
