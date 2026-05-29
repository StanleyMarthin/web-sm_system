"use client";

import type { GridFilter, GridQueryState } from "@smsystem/contracts/grid";
import type { UnitBoardRow } from "@smsystem/contracts/unit";
import Link from "next/link";
import { SmartDataGrid } from "@/shared/datagrid/smart-data-grid";
import type {
  SmartDataGridColumn,
  SmartDataGridFilterDefinition,
  SmartDataGridSavedView,
  SmartDataGridSortOption,
} from "@/shared/datagrid/types";

interface UnitBoardShellProps {
  rows: UnitBoardRow[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  state: GridQueryState;
}

const sortOptions: SmartDataGridSortOption[] = [
  { label: "Target Delivery", value: "targetDeliveryDate" },
  { label: "Unit", value: "unitName" },
  { label: "Customer", value: "customerName" },
  { label: "ETA", value: "etaDate" },
  { label: "Risk", value: "riskLevel" },
  { label: "Progress", value: "progressPercent" },
  { label: "Remaining Hours", value: "remainingHours" },
  { label: "WO Open", value: "woOpenCount" },
  { label: "Issue Open", value: "issueOpenCount" },
  { label: "Status", value: "status" },
];

const savedViews: SmartDataGridSavedView[] = [
  {
    id: "all-units",
    label: "All",
    sortBy: "targetDeliveryDate",
    sortDirection: "asc",
    filters: [],
  },
  {
    id: "critical-risk",
    label: "Critical",
    sortBy: "targetDeliveryDate",
    sortDirection: "asc",
    filters: [
      {
        field: "riskLevel",
        operator: "eq",
        value: "RED",
      } satisfies GridFilter,
    ],
  },
];

const columns: SmartDataGridColumn[] = [
  {
    key: "unitName",
    label: "Unit",
    kind: "text",
    sticky: true,
    renderCell: (value, row) => (
      <div className="space-y-1">
        <p className="font-medium text-white">{String(value ?? "-")}</p>
        <p className="text-[11px] text-white/35">{String(row.unitId ?? "-")}</p>
      </div>
    ),
  },
  {
    key: "customerName",
    label: "Customer",
    kind: "text",
  },
  {
    key: "kpName",
    label: "KP",
    kind: "text",
  },
  {
    key: "advisorName",
    label: "Advisor",
    kind: "text",
  },
  {
    key: "targetDeliveryDate",
    label: "Target",
    kind: "mono",
  },
  {
    key: "etaDate",
    label: "ETA",
    kind: "mono",
  },
  {
    key: "riskLevel",
    label: "Risk",
    kind: "status",
    align: "center",
    filterKey: "riskLevel",
    filterOptions: [
      { label: "GREEN", value: "GREEN" },
      { label: "YELLOW", value: "YELLOW" },
      { label: "ORANGE", value: "ORANGE" },
      { label: "RED", value: "RED" },
      { label: "UNKNOWN", value: "UNKNOWN" },
    ],
  },
  {
    key: "progressPercent",
    label: "Progress %",
    kind: "number",
    align: "right",
  },
  {
    key: "remainingHours",
    label: "Sisa Jam",
    kind: "number",
    align: "right",
  },
  {
    key: "woOpenCount",
    label: "WO",
    kind: "number",
    align: "center",
  },
  {
    key: "prOpenCount",
    label: "PR",
    kind: "number",
    align: "center",
  },
  {
    key: "qcIssueOpenCount",
    label: "QC",
    kind: "number",
    align: "center",
  },
  {
    key: "issueOpenCount",
    label: "Issue",
    kind: "number",
    align: "center",
  },
  {
    key: "workspace",
    label: "Action",
    kind: "text",
    align: "center",
    renderCell: (_value, row) => (
      <Link
        href={`/units/${String(row.unitId ?? "")}`}
        className="inline-flex rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[11px] uppercase tracking-[0.12em] text-amber-300 hover:bg-amber-500/20"
      >
        Workspace
      </Link>
    ),
  },
];

const filters: SmartDataGridFilterDefinition[] = [
  {
    field: "riskLevel",
    label: "Filter Risk",
    options: [
      { label: "GREEN", value: "GREEN" },
      { label: "YELLOW", value: "YELLOW" },
      { label: "ORANGE", value: "ORANGE" },
      { label: "RED", value: "RED" },
      { label: "UNKNOWN", value: "UNKNOWN" },
    ],
  },
  {
    field: "status",
    label: "Status",
    options: [
      { label: "Sedang Berjalan", value: "In_Progress" },
      { label: "Selesai", value: "Done" },
    ],
  },
];

export function UnitBoardShell({ rows, meta, state }: UnitBoardShellProps) {
  return (
    <SmartDataGrid
      title="Unit Board"
      description=""
      columns={columns}
      rows={rows.map((row) => ({
        unitId: row.unitId,
        unitName: row.unitName,
        customerName: row.customerName,
        kpName: row.kpName,
        advisorName: row.advisorName,
        targetDeliveryDate: row.targetDeliveryDate,
        etaDate: row.etaDate,
        riskLevel: row.riskLevel,
        progressPercent: row.progressPercent,
        remainingHours: row.remainingHours,
        woOpenCount: row.woOpenCount,
        prOpenCount: row.prOpenCount,
        qcIssueOpenCount: row.qcIssueOpenCount,
        issueOpenCount: row.issueOpenCount,
        status: row.status,
        workspace: row.unitId,
      }))}
      meta={meta}
      state={state}
      searchPlaceholder="Cari unit / customer / KP..."
      filters={filters}
      sortOptions={sortOptions}
      savedViews={savedViews}
      emptyMessage="Belum ada unit sesuai query saat ini."
    />
  );
}
