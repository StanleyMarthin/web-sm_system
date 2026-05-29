"use client";

import type {
  SpkGridQuery,
  SpkHeaderRecord,
} from "@smsystem/contracts/spk";
import type { GridFilter } from "@smsystem/contracts/grid";
import { CalendarDays, FileCheck2, RefreshCcw } from "lucide-react";
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

function SummaryCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper?: string;
}) {
  return (
    <div className="border border-gray-300 dark:border-white/[0.05] bg-white dark:bg-[#111114] px-3 py-2">
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-gray-500 dark:text-white/30">{label}</p>
      <p className="mt-1 font-mono text-[13px] text-gray-950 dark:text-white">{value}</p>
      {helper ? <p className="mt-2 text-sm text-gray-400 dark:text-white/40">{helper}</p> : null}
    </div>
  );
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
        className="text-amber-400 transition-colors hover:text-amber-300"
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
      const className =
        status === "ACTIVE"
          ? "border-emerald-500/30 text-emerald-300"
          : status === "DONE"
            ? "border-white/15 text-gray-800 dark:text-white/75"
            : status === "REJECTED"
              ? "border-red-500/30 text-red-300"
              : "border-amber-500/30 text-amber-300";

        return (
          <span
          className={`inline-flex border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] ${className}`}
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

  function pushDate(value: string) {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("date", value);
    nextParams.set("page", "1");
    router.push(`${pathname}?${nextParams.toString()}`);
  }

  return (
    <div className="space-y-3">
      <section className="border border-gray-300 dark:border-white/[0.05] bg-white dark:bg-[#111114] px-4 py-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center border border-gray-300 dark:border-white/[0.08] bg-slate-50 dark:bg-[#0a0a0c]">
                <FileCheck2 className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-gray-500 dark:text-white/30">
                  SPK Planner
                </p>
                <h3 className="mt-1 text-[13px] font-medium text-gray-950 dark:text-white">
                  Draft SPK hasil planner mingguan
                </h3>
              </div>
            </div>
            <p className="mt-2 text-[12px] text-gray-600 dark:text-white/45">
              Halaman ini hanya menampilkan draft SPK yang diproduksi oleh planner mingguan.
              Kepala divisi cukup membuka detail, menerima target kerja, lalu memulai SPK.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-2 border border-gray-300 dark:border-white/[0.05] bg-slate-50 dark:bg-[#0a0a0c] px-2.5 py-1.5 font-mono text-[11px] text-gray-800 dark:text-white/70">
              <CalendarDays className="h-4 w-4 text-gray-500 dark:text-white/30" />
              <input
                type="date"
                value={state.date}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  startTransition(() => {
                    pushDate(nextValue);
                  });
                }}
                className="bg-transparent font-mono text-[11px] text-gray-950 dark:text-white outline-none"
              />
            </label>
            <button
              type="button"
              onClick={() => router.refresh()}
              className="inline-flex h-8 items-center gap-2 border border-gray-300 dark:border-white/[0.08] bg-transparent px-3 font-mono text-[10px] uppercase tracking-[0.12em] text-gray-500 dark:text-white/55 hover:text-gray-900 dark:text-white/80"
            >
              <RefreshCcw className="h-3.5 w-3.5" />
              {isPending ? "Memuat..." : "Muat Ulang"}
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-2 xl:grid-cols-[repeat(4,minmax(0,1fr))]">
        <SummaryCard
          label="Draft Planner"
          value={String(draftCount)}
          helper="Menunggu diterima oleh kepala divisi."
        />
        <SummaryCard
          label="Sedang Berjalan"
          value={String(activeCount)}
          helper="SPK yang sudah diterima dan aktif."
        />
        <SummaryCard
          label="Selesai"
          value={String(doneCount)}
          helper="SPK yang sudah ditutup."
        />
        <SummaryCard
          label="Perlu Tindakan"
          value={String(summary.pendingApproval)}
          helper="Masih ada draft yang belum dilanjutkan."
        />
      </section>

      <SmartDataGrid
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
    </div>
  );
}
