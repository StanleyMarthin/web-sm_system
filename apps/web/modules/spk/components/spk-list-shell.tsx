"use client";

/* Hallmark · pre-emit critique: P4 H4 E4 S4 R4 V4 */
/* Hallmark · genre: modern-minimal · macrostructure: Workbench · design-system: design.md · designed-as-app */

import type {
  SpkGridQuery,
  SpkHeaderRecord,
} from "@smsystem/contracts/spk";
import type { GridFilter } from "@smsystem/contracts/grid";
import {
  CalendarDays,
  FileCheck2,
  RefreshCcw,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { SmartDataGrid } from "@/shared/datagrid/smart-data-grid";
import type {
  SmartDataGridColumn,
  SmartDataGridFilterDefinition,
  SmartDataGridSavedView,
  SmartDataGridSortOption,
} from "@/shared/datagrid/types";

interface SpkListShellProps {
  rows: SpkHeaderRecord[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  state: SpkGridQuery;
  summary: {
    pendingApproval: number;
  };
}

function formatStatusLabel(value: string): string {
  switch (value) {
    case "DRAFT":
      return "Draft Planner";
    case "SUBMITTED":
      return "Diajukan";
    case "APPROVED":
      return "Siap Mulai";
    case "REJECTED":
      return "Ditolak";
    case "ACTIVE":
      return "Berjalan";
    case "DONE":
      return "Selesai";
    default:
      return value || "-";
  }
}

function statusClassName(status: string): string {
  if (status === "ACTIVE") {
    return "border-success/25 bg-success/[0.06] text-success";
  }
  if (status === "DONE") {
    return "border-white/10 bg-white/[0.03] text-foreground/50";
  }
  if (status === "REJECTED") {
    return "border-destructive/25 bg-destructive/[0.06] text-destructive";
  }
  return "border-primary/25 bg-primary/[0.06] text-app-accent-ink";
}

function SummaryCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "warn" | "ok";
}) {
  const toneClassName =
    tone === "warn"
      ? "text-app-accent-ink"
      : tone === "ok"
        ? "text-success"
        : "text-foreground/80";

  return (
    <div className="border border-white/5 bg-card px-4 py-3">
      <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-foreground/25">{label}</p>
      <p className={`mt-1 font-mono text-[20px] font-semibold ${toneClassName}`}>{value}</p>
    </div>
  );
}

const sortOptions: SmartDataGridSortOption[] = [
  { label: "Tanggal SPK", value: "spkDate" },
  { label: "Status", value: "status" },
  { label: "Total Unit", value: "totalUnits" },
  { label: "Total Jam", value: "totalHours" },
  { label: "Dibuat", value: "createdAt" },
  { label: "Aktif", value: "activatedAt" },
];

const savedViews: SmartDataGridSavedView[] = [
  {
    id: "draft-planner",
    label: "Draft Planner",
    sortBy: "spkDate",
    sortDirection: "desc",
    filters: [
      {
        field: "status",
        operator: "eq",
        value: "DRAFT",
      } satisfies GridFilter,
    ],
  },
  {
    id: "active-spk",
    label: "Berjalan",
    sortBy: "spkDate",
    sortDirection: "desc",
    filters: [
      {
        field: "status",
        operator: "eq",
        value: "ACTIVE",
      } satisfies GridFilter,
    ],
  },
  {
    id: "done-spk",
    label: "Selesai",
    sortBy: "spkDate",
    sortDirection: "desc",
    filters: [
      {
        field: "status",
        operator: "eq",
        value: "DONE",
      } satisfies GridFilter,
    ],
  },
];

const filters: SmartDataGridFilterDefinition[] = [
  {
    field: "status",
    label: "Status",
    options: [
      { label: "Draft Planner", value: "DRAFT" },
      { label: "Diajukan", value: "SUBMITTED" },
      { label: "Siap Mulai", value: "APPROVED" },
      { label: "Ditolak", value: "REJECTED" },
      { label: "Berjalan", value: "ACTIVE" },
      { label: "Selesai", value: "DONE" },
    ],
  },
];

const columns: SmartDataGridColumn[] = [
  {
    key: "spkNumber",
    label: "Nomor SPK",
    kind: "mono",
    sticky: true,
    renderCell: (value, row) => (
      <Link
        href={`/spk/${String(row.spkId)}`}
        className="font-semibold text-app-accent-ink hover:text-app-accent-ink"
      >
        {String(value)}
      </Link>
    ),
  },
  {
    key: "spkDate",
    label: "Tanggal",
  },
  {
    key: "status",
    label: "Status",
    kind: "text",
    align: "center",
    renderCell: (value) => {
      const status = String(value ?? "");
      return (
        <span
          className={`inline-flex border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] ${statusClassName(status)}`}
        >
          {formatStatusLabel(status)}
        </span>
      );
    },
  },
  {
    key: "totalUnits",
    label: "Total Unit",
    kind: "number",
    align: "right",
  },
  {
    key: "totalHours",
    label: "Total Jam",
    kind: "number",
    align: "right",
  },
  {
    key: "createdBy",
    label: "Dibuat Oleh",
  },
  {
    key: "activatedAt",
    label: "Mulai Dikerjakan",
  },
  {
    key: "notes",
    label: "Catatan",
    renderCell: (value) => String(value ?? "-"),
  },
];

export function SpkListShell({
  rows,
  meta,
  state,
  summary,
}: SpkListShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const draftCount = rows.filter((row) => row.status === "DRAFT").length;
  const activeCount = rows.filter((row) => row.status === "ACTIVE").length;
  const doneCount = rows.filter((row) => row.status === "DONE").length;
  const periodLabel = state.date;

  return (
    <div className="space-y-4">
      <section className="border border-white/5 bg-card px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center border border-white/[0.08]">
              <FileCheck2 className="h-4 w-4 text-app-accent-ink" />
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-foreground/30">
                SPK Planner
              </p>
              <h1 className="text-[13px] font-mono text-foreground/80">
                Papan Kerja SPK Mingguan
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 border border-white/10 bg-background px-3 h-8">
              <CalendarDays className="h-3.5 w-3.5 text-foreground/30" />
              <input
                type="date"
                value={state.date || ""}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  startTransition(() => {
                    const nextParams = new URLSearchParams(searchParams.toString());
                    if (nextValue) nextParams.set("date", nextValue);
                    else nextParams.delete("date");
                    nextParams.set("page", "1");
                    router.push(`${pathname}?${nextParams.toString()}`);
                  });
                }}
                className="bg-transparent font-mono text-[11px] text-foreground/60 outline-none dark:[color-scheme:dark]"
              />
            </label>
            <button
              type="button"
              onClick={() => router.refresh()}
              className="inline-flex h-8 items-center gap-2 border border-white/10 px-3 font-mono text-[10px] uppercase tracking-[0.12em] text-foreground/40 hover:text-foreground transition-colors"
            >
              <RefreshCcw className={`h-3.5 w-3.5 ${isPending ? "animate-spin" : ""}`} />
              {isPending ? "Memuat..." : "Refresh"}
            </button>
            <span className="border border-white/5 bg-background px-3 h-8 flex items-center font-mono text-[10px] text-foreground/30">
              {meta.total} SPK
            </span>
          </div>
        </div>
      </section>

      <section className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Draft Di Halaman Ini"
          value={String(draftCount)}
          tone="warn"
        />
        <SummaryCard
          label="Berjalan Di Halaman Ini"
          value={String(activeCount)}
          tone="ok"
        />
        <SummaryCard
          label="Selesai Di Halaman Ini"
          value={String(doneCount)}
        />
        <SummaryCard
          label="Perlu Tindakan"
          value={String(summary.pendingApproval)}
          tone="warn"
        />
      </section>

      <section className="overflow-hidden border border-white/5 bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 px-4 py-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-foreground/30">Tabel Kerja</p>
            <h2 className="text-[13px] font-mono text-foreground/80 mt-0.5">Daftar SPK</h2>
          </div>
        </div>

        <SmartDataGrid
        viewportClassName="max-h-[calc(100svh-260px)]"
          title="Daftar SPK"
          description="Buka detail untuk melihat rekomendasi jam kerja, menerima target, lalu memulai SPK."
          columns={columns}
          rows={rows.map((row) => ({
            spkId: row.spkId,
            spkNumber: row.spkNumber,
            spkDate: row.spkDate,
            status: row.status,
            totalUnits: row.totalUnits,
            totalHours: Number(row.totalHours.toFixed(2)),
            createdBy: row.createdBy,
            activatedAt: row.activatedAt,
            notes: row.plannerMeta?.note ?? row.notes,
          }))}
          meta={meta}
          state={state}
          searchPlaceholder="Cari nomor SPK, unit, atau catatan..."
          filters={filters}
          sortOptions={sortOptions}
          savedViews={savedViews}
          emptyMessage="Belum ada draft SPK dari planner untuk query ini."
        />
      </section>
    </div>
  );
}
