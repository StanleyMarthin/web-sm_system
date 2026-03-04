"use client";

// ============================================================
// Vendors Page Client — DataTable view (API #9, #10)
// ============================================================

import { VENDOR_WOS } from "@/lib/dummy-data";
import { Badge } from "@/components/ui/badge";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { SERIF_STYLE } from "@/lib/constants";
import { DarkCard } from "@/components/ui/dark-card";
import type { VendorWO, VendorWOStatus } from "@/types";

function statusBadge(status: VendorWOStatus) {
  switch (status) {
    case "PROSES_VENDOR":
      return <Badge className="bg-amber-500/10 text-amber-400 border-0 text-[10px]">Proses Vendor</Badge>;
    case "RETURNED":
      return <Badge className="bg-emerald-500/10 text-emerald-400 border-0 text-[10px]">Returned</Badge>;
    case "LATE":
      return <Badge className="bg-red-500/10 text-red-400 border-0 text-[10px]">Late</Badge>;
  }
}

const COLUMNS: DataTableColumn<VendorWO>[] = [
  { key: "wovId", label: "WOV ID", sortable: true, sortValue: (r) => r.wovId, render: (r) => <span className="font-medium text-sm text-white/50 font-mono">{r.wovId}</span> },
  { key: "unit", label: "Unit", sortable: true, sortValue: (r) => r.unitName, render: (r) => <span className="font-medium text-sm text-white/70">{r.unitName}</span> },
  { key: "vendor", label: "Vendor", sortable: true, sortValue: (r) => r.vendorName, render: (r) => <span className="text-white/50 text-sm">{r.vendorName}</span> },
  { key: "item", label: "Item", sortable: true, sortValue: (r) => r.itemName, render: (r) => <span className="text-white/50 text-sm">{r.itemName}</span> },
  { key: "coreId", label: "Core ID", render: (r) => <span className="text-white/40 text-sm font-mono">{r.coreId}</span> },
  { key: "targetReturn", label: "Target Return", sortable: true, sortValue: (r) => r.targetReturn, render: (r) => <span className="text-white/50 text-sm">{r.targetReturn}</span> },
  { key: "daysLate", label: "Days Late", align: "right" as const, sortable: true, sortValue: (r) => r.daysLate, render: (r) => r.daysLate > 0 ? <span className="text-red-400 text-sm tabular-nums">{r.daysLate}</span> : <span className="text-white/30 text-sm">0</span> },
  { key: "status", label: "Status", sortable: true, sortValue: (r) => r.status, render: (r) => statusBadge(r.status) },
];

export function VendorsPageClient() {
  const wos = VENDOR_WOS;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-light text-white/90 tracking-wide" style={SERIF_STYLE}>
          Vendor Work Orders
        </h2>
        <p className="text-[11px] text-white/30 tracking-[0.15em] uppercase mt-1">
          {wos.length} WOV · GET /api/v1/web/vendors/wo
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { value: wos.filter((w) => w.status === "PROSES_VENDOR").length, label: "In Process" },
          { value: wos.filter((w) => w.status === "RETURNED").length, label: "Returned" },
          { value: wos.filter((w) => w.status === "LATE").length, label: "Late" },
        ].map((item) => (
          <DarkCard key={item.label} className="p-4 text-center">
            <p className="text-2xl font-bold text-white/90" style={SERIF_STYLE}>{item.value}</p>
            <p className="text-[11px] text-white/35 tracking-wider uppercase">{item.label}</p>
          </DarkCard>
        ))}
      </div>

      <DataTable
        data={wos}
        columns={COLUMNS}
        rowKey={(r) => r.wovId}
        selectable
        searchable
        searchPlaceholder="Cari WOV, unit, vendor..."
        searchFn={(r, q) =>
          r.wovId.toLowerCase().includes(q) ||
          r.unitName.toLowerCase().includes(q) ||
          r.vendorName.toLowerCase().includes(q) ||
          r.itemName.toLowerCase().includes(q)
        }
        emptyMessage="Tidak ada vendor WO."
      />
    </div>
  );
}
