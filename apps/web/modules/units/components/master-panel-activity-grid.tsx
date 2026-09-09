"use client";

import type { UnitPanelActivity, UnitPanelActivityType, UnitPanelDetail } from "@smsystem/contracts/unit-panel";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { AllCommunityModule, ModuleRegistry } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { fmtDateTime } from "@/shared/format/humanize";

ModuleRegistry.registerModules([AllCommunityModule]);

type ActivityFilter = "ALL" | UnitPanelActivityType;

const ACTIVITY_FILTERS: Array<{ value: ActivityFilter; label: string }> = [
  { value: "ALL", label: "Semua" },
  { value: "COUNTDOWN", label: "Countdown" },
  { value: "JOBDESC", label: "Job Plan" },
  { value: "PR", label: "PR" },
  { value: "WO", label: "WO" },
  { value: "WOV", label: "WOV" },
];

function displayValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

function formatNumber(value: unknown): string {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return "0";
  return Number.isInteger(parsed) ? String(parsed) : parsed.toFixed(1);
}

function ActivityLinkRenderer(params: ICellRendererParams<UnitPanelActivity>) {
  const activity = params.data;
  if (!activity?.url) return null;
  return (
    <Link href={activity.url} className="catalog-icon-button" title="Buka aktivitas">
      <ChevronRight className="h-4 w-4" />
    </Link>
  );
}

export function MasterPanelActivityGrid({ detail }: { detail: UnitPanelDetail }) {
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("ALL");
  const filteredActivities = useMemo(
    () => activityFilter === "ALL" ? detail.activities : detail.activities.filter((activity) => activity.type === activityFilter),
    [activityFilter, detail.activities],
  );
  const columnDefs = useMemo<ColDef<UnitPanelActivity>[]>(() => [
    { headerName: "Type", field: "type", width: 125, cellClass: "font-mono text-muted-foreground" },
    { headerName: "Title", field: "title", minWidth: 260, flex: 1.6 },
    {
      headerName: "Status",
      field: "status",
      minWidth: 150,
      flex: 0.8,
      valueFormatter: ({ value }) => displayValue(value),
      cellClass: "font-mono text-muted-foreground",
    },
    {
      headerName: "Tanggal",
      field: "date",
      minWidth: 180,
      flex: 0.9,
      valueFormatter: ({ value }) => fmtDateTime(value),
      cellClass: "text-muted-foreground",
    },
    {
      headerName: "Jam",
      width: 105,
      valueGetter: ({ data }) => formatNumber(data?.metadata.targetHours),
      cellClass: "font-mono text-muted-foreground",
    },
    {
      headerName: "Sisa",
      width: 105,
      valueGetter: ({ data }) => formatNumber(data?.metadata.remainingHours),
      cellClass: "font-mono text-muted-foreground",
    },
    {
      headerName: "Action",
      width: 90,
      sortable: false,
      filter: false,
      cellRenderer: ActivityLinkRenderer,
    },
  ], []);

  return (
    <section className="border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h2 className="text-[13px] font-mono uppercase tracking-[0.12em] text-muted-foreground">Aktivitas Operasional</h2>
        <div className="flex gap-2 overflow-x-auto">
          {ACTIVITY_FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => setActivityFilter(filter.value)}
              className={`shrink-0 border px-2.5 py-1 text-[12px] font-mono uppercase tracking-[0.08em] transition-colors ${
                activityFilter === filter.value ? "border-primary/40 bg-primary/[0.08] text-app-accent-ink" : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>
      <div className="ag-theme-alpine sms-ag-grid h-[22rem] w-full">
        <AgGridReact<UnitPanelActivity>
          rowData={filteredActivities}
          columnDefs={columnDefs}
          defaultColDef={{
            sortable: true,
            resizable: true,
            filter: true,
            suppressHeaderMenuButton: true,
          }}
          getRowId={({ data }) => `${data.type}-${data.id}`}
          rowHeight={42}
          suppressMovableColumns
          overlayNoRowsTemplate="<span class='text-muted-foreground'>Belum ada aktivitas operasional yang terhubung langsung.</span>"
        />
      </div>
    </section>
  );
}
