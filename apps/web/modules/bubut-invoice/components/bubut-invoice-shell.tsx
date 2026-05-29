"use client";

import type {
  BubutInvoiceType,
  BubutInvoiceWorkOrderQuery,
  BubutInvoiceWorkOrderRow,
} from "@smsystem/contracts/bubut-invoice";
import type { GridQueryState } from "@smsystem/contracts/grid";
import { Eye, FileText, Printer, RefreshCcw } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { BubutInvoiceReleaseDialog } from "@/modules/bubut-invoice/components/bubut-invoice-release-dialog";
import { BubutInvoiceStatusBadge } from "@/modules/bubut-invoice/components/bubut-invoice-status-badge";
import { WoBubutWorkHistoryDrawer } from "@/modules/invoice-wo-bubut/components/wo-bubut-work-history-drawer";
import { SmartDataGrid } from "@/shared/datagrid/smart-data-grid";
import type { SmartDataGridColumn, SmartDataGridSortOption } from "@/shared/datagrid/types";

function rupiah(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

function nextPageHref(pathname: string, searchParams: URLSearchParams, page: number) {
  const params = new URLSearchParams(searchParams.toString());
  params.set("page", String(page));
  return `${pathname}?${params.toString()}`;
}

function getMonthValue(query: BubutInvoiceWorkOrderQuery): string {
  if (query.woDateFrom?.match(/^\d{4}-\d{2}-01$/u)) {
    return query.woDateFrom.slice(0, 7);
  }
  return "";
}

function monthRange(month: string) {
  const [year, monthNumber] = month.split("-").map((part) => Number.parseInt(part, 10));
  const lastDay = new Date(year, monthNumber, 0).getDate();
  return {
    from: `${month}-01`,
    to: `${month}-${String(lastDay).padStart(2, "0")}`,
  };
}

const sortOptions: SmartDataGridSortOption[] = [
  { label: "Tanggal WO", value: "woDate" },
  { label: "Tanggal Kerja", value: "workDate" },
  { label: "No WOB", value: "sourceWobNo" },
  { label: "Team", value: "teamName" },
  { label: "Kendaraan", value: "carType" },
  { label: "Operator", value: "operatorName" },
  { label: "Divisi", value: "divisionName" },
  { label: "Total Jam", value: "totalWorkHourDecimal" },
  { label: "Total Bahan", value: "materialTotal" },
  { label: "Total Price Bubut", value: "totalPriceBubut" },
];

export function BubutInvoiceShell({
  rows,
  meta,
  query,
  canRelease,
  canPrint,
}: {
  rows: BubutInvoiceWorkOrderRow[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  query: BubutInvoiceWorkOrderQuery;
  canRelease: boolean;
  canPrint: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isRefreshing, startRefresh] = useTransition();
  const [releaseTarget, setReleaseTarget] = useState<{
    sourceWoId: string;
    invoiceType: BubutInvoiceType;
  } | null>(null);
  const [detailSourceKey, setDetailSourceKey] = useState<string | null>(null);
  const [month, setMonth] = useState(getMonthValue(query));

  const gridState: GridQueryState = {
    page: query.page,
    limit: query.limit,
    search: query.search,
    sortBy: query.sortBy,
    sortDirection: query.sortDirection,
    view: query.view,
    filters: query.filters,
  };

  function applyMonthFilter(nextMonth: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", "1");
    params.delete("woDateFrom");
    params.delete("woDateTo");
    if (nextMonth) {
      const range = monthRange(nextMonth);
      params.set("woDateFrom", range.from);
      params.set("woDateTo", range.to);
    }
    startRefresh(() =>
      router.replace(`${pathname}?${params.toString()}`, { scroll: false }),
    );
  }

  const columns: SmartDataGridColumn[] = [
    { key: "woDate", label: "WO Date", kind: "mono", sortable: true, sortKey: "woDate" },
    {
      key: "sourceWobNo",
      label: "No WOB",
      kind: "mono",
      sticky: true,
      filterKey: "sourceWobNo",
      sortable: true,
      sortKey: "sourceWobNo",
      renderCell: (value, row) => (
        <button
          type="button"
          onClick={() => setDetailSourceKey(String(row.sourceKey ?? row.sourceWoId))}
          className="font-mono text-[11px] text-amber-500/90 underline-offset-2 hover:underline"
        >
          {String(value)}
        </button>
      ),
    },
    { key: "workDate", label: "Tanggal Kerja", kind: "mono", sortable: true, sortKey: "workDate" },
    { key: "teamName", label: "Team", filterKey: "teamName", sortable: true, sortKey: "teamName" },
    { key: "carType", label: "Kendaraan", filterKey: "carType", sortable: true, sortKey: "carType" },
    { key: "divisionName", label: "Divisi", filterKey: "divisionName", sortable: true, sortKey: "divisionName" },
    { key: "operatorName", label: "Operator", filterKey: "operatorName", sortable: true, sortKey: "operatorName" },
    { key: "sparepartName", label: "Sparepart / Panel", filterKey: "sparepartName" },
    { key: "totalWorkHourText", label: "Total Jam", kind: "mono" },
    { key: "materialTotalText", label: "Total Bahan", align: "right", sortable: true, sortKey: "materialTotal" },
    { key: "totalPriceBubutText", label: "Total Price Bubut", align: "right", sortable: true, sortKey: "totalPriceBubut" },
    {
      key: "invoiceStatus",
      label: "Status",
      filterKey: "invoiceStatus",
      filterOptions: [
        { label: "Belum Rilis", value: "BELUM_RILIS" },
        { label: "Rilis Direksi", value: "RILIS_DIREKSI" },
        { label: "Rilis Customer", value: "RILIS_CUSTOMER" },
        { label: "Rilis Keduanya", value: "RILIS_KEDUANYA" },
        { label: "Dibatalkan", value: "DIBATALKAN" },
      ],
      renderCell: (value) => (
        <BubutInvoiceStatusBadge
          status={String(value) as BubutInvoiceWorkOrderRow["invoiceStatus"]}
        />
      ),
    },
    {
      key: "invoiceTypeFilter",
      label: "Tipe",
      filterKey: "invoiceType",
      filterOptions: [
        { label: "Direksi", value: "DIREKSI" },
        { label: "Customer", value: "CUSTOMER" },
      ],
      renderCell: () => null,
      hideHeader: true,
    },
    {
      key: "action",
      label: "Action",
      renderCell: (_value, row) => (
        <div className="flex min-w-[260px] flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setDetailSourceKey(String(row.sourceKey ?? row.sourceWoId))}
            className="inline-flex items-center gap-1 border border-white/10 px-2 py-1 text-[10px] font-mono uppercase tracking-[0.08em] text-white/50 hover:border-white/30 hover:text-white transition-colors"
          >
            <Eye className="h-3 w-3" /> Detail
          </button>
          {canRelease && !row.direksiInvoiceId ? (
            <button
              type="button"
              onClick={() => setReleaseTarget({ sourceWoId: String(row.sourceWoId), invoiceType: "DIREKSI" })}
              className="border border-amber-500/30 px-2 py-1 text-[10px] font-mono uppercase tracking-[0.08em] text-amber-500/70 hover:text-amber-500 transition-colors"
            >
              Rilis Direksi
            </button>
          ) : null}
          {canRelease && !row.customerInvoiceId ? (
            <button
              type="button"
              onClick={() => setReleaseTarget({ sourceWoId: String(row.sourceWoId), invoiceType: "CUSTOMER" })}
              className="border border-sky-500/30 px-2 py-1 text-[10px] font-mono uppercase tracking-[0.08em] text-sky-400/70 hover:text-sky-400 transition-colors"
            >
              Rilis Customer
            </button>
          ) : null}
          {canPrint && row.direksiInvoiceId ? (
            <Link
              href={`/invoice/wo-bubut/${row.direksiInvoiceId}/print`}
              className="inline-flex items-center gap-1 border border-white/10 px-2 py-1 text-[10px] font-mono uppercase tracking-[0.08em] text-white/50 hover:border-white/30 hover:text-white transition-colors"
            >
              <Printer className="h-3 w-3" /> Direksi
            </Link>
          ) : null}
          {canPrint && row.customerInvoiceId ? (
            <Link
              href={`/invoice/wo-bubut/${row.customerInvoiceId}/print`}
              className="inline-flex items-center gap-1 border border-white/10 px-2 py-1 text-[10px] font-mono uppercase tracking-[0.08em] text-white/50 hover:border-white/30 hover:text-white transition-colors"
            >
              <Printer className="h-3 w-3" /> Customer
            </Link>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      <section className="border border-white/5 bg-[#111114] px-4 py-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center border border-white/[0.08]">
              <FileText className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/30">
                Invoice
              </p>
              <h1 className="text-[13px] font-mono text-white/80">
                Invoice WO Bubut
              </h1>
            </div>
          </div>
          <button
            type="button"
            onClick={() => startRefresh(() => router.refresh())}
            className="inline-flex h-8 items-center gap-2 border border-white/[0.08] px-3 font-mono text-[10px] uppercase tracking-[0.12em] text-white/55 hover:text-white dark:border-white/[0.08] dark:text-white/55 dark:hover:text-white"
          >
            <RefreshCcw className="h-3.5 w-3.5" />
            {isRefreshing ? "Memuat..." : "Refresh"}
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="space-y-1">
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/30">
              Bulan WO
            </span>
            <input
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              className="h-9 border border-white/10 bg-[#0a0a0c] px-3 text-[11px] font-mono text-white/60 outline-none focus:border-amber-500/40 [color-scheme:dark]"
            />
          </label>
          <button
            type="button"
            onClick={() => applyMonthFilter(month)}
            className="border border-amber-500/30 bg-amber-500/[0.04] h-9 px-3 text-[10px] font-mono uppercase tracking-[0.12em] text-amber-500 hover:bg-amber-500/10 transition-colors"
          >
            Filter Bulan
          </button>
          <button
            type="button"
            onClick={() => {
              setMonth("");
              applyMonthFilter("");
            }}
            className="border border-white/10 h-9 px-3 text-[10px] font-mono uppercase tracking-[0.12em] text-white/40 hover:text-white transition-colors"
          >
            Reset Bulan
          </button>
        </div>
      </section>

      <SmartDataGrid
        title="Register Invoice WO Bubut"
        description="Server-side list WO Bubut selesai dengan status invoice direksi/customer."
        columns={columns}
        rows={rows.map((row) => ({
          ...row,
          sourceKey: row.sourceKey ?? row.sourceWoId,
          woDate: row.woDate,
          workDate: row.workDate,
          materialTotalText: rupiah(row.materialTotal),
          totalPriceBubutText: rupiah(row.totalPriceBubut),
          direksiInvoiceId: row.direksiInvoiceId,
          customerInvoiceId: row.customerInvoiceId,
          invoiceTypeFilter: "",
          action: "",
        }))}
        meta={meta}
        state={gridState}
        searchPlaceholder="Cari No WOB, unit, operator, panel, atau team..."
        sortOptions={sortOptions}
        emptyMessage="Tidak ada WO Bubut selesai pada filter ini."
        viewportClassName="max-h-[68vh]"
        rowKeyField="sourceKey"
        onRowClick={(row) => setDetailSourceKey(String(row.sourceKey ?? row.sourceWoId))}
        getRowAriaLabel={(row) => `Buka riwayat pengerjaan ${String(row.sourceWobNo)}`}
      />

      {releaseTarget ? (
        <BubutInvoiceReleaseDialog
          sourceWoId={releaseTarget.sourceWoId}
          invoiceType={releaseTarget.invoiceType}
          onClose={() => setReleaseTarget(null)}
          onReleased={() => {
            setReleaseTarget(null);
            router.refresh();
          }}
        />
      ) : null}

      {detailSourceKey ? (
        <WoBubutWorkHistoryDrawer
          sourceKey={detailSourceKey}
          canRelease={canRelease}
          canPrint={canPrint}
          onClose={() => setDetailSourceKey(null)}
          onRelease={(sourceWoId, invoiceType) => {
            setDetailSourceKey(null);
            setReleaseTarget({ sourceWoId, invoiceType });
          }}
        />
      ) : null}
    </div>
  );
}
