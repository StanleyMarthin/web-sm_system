"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, Eye } from "lucide-react";
import type { SpfPagination, SpfPeriod } from "@/shared/api/spf-contracts";
import { ActionButton } from "@/shared/ui/compact";
import { SpfDataTable } from "./spf-data-table";
import { SpfStatusBadge } from "./spf-status-badge";

interface PeriodListProps {
  rows: readonly SpfPeriod[];
  meta: SpfPagination;
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

function actionLinks(period: SpfPeriod) {
  const detail = `/spf/periods?period=${encodeURIComponent(period.id)}`;
  return [
    { href: detail, label: "Detail", icon: <Eye className="h-3.5 w-3.5" /> },
    ...(period.status === "PUBLISHED" ? [{ href: `${detail}&export=1`, label: "Export", icon: <Download className="h-3.5 w-3.5" /> }] : []),
  ];
}

export function PeriodList({ rows, meta }: PeriodListProps) {
  const router = useRouter();
  const page = Math.floor(meta.offset / meta.limit) + 1;
  const totalPages = Math.max(1, Math.ceil(meta.total / meta.limit));

  function goToPage(next: number) {
    const params = new URLSearchParams(window.location.search);
    params.set("page", String(next));
    router.push(`?${params.toString()}`);
  }

  return (
    <div className="space-y-3">
      <SpfDataTable
        rows={rows}
        minWidth={1180}
        emptyMessage="Belum ada periode SPF sesuai filter."
        onRowClick={(period) => router.push(`/spf/periods?period=${encodeURIComponent(period.id)}`)}
        columns={[
          {
            key: "unit",
            label: "Unit",
            render: (period) => (
              <p className="font-semibold text-foreground">{period.car_name || period.car_id || "-"}</p>
            ),
          },
          {
            key: "period",
            label: "Periode",
            render: (period) => (
              <Link href={`/spf/periods?period=${encodeURIComponent(period.id)}`} className="font-medium text-foreground hover:text-app-accent-ink hover:underline">
                {period.title || period.id}
              </Link>
            ),
          },
          { key: "range", label: "Rentang Tanggal", render: (period) => `${formatDate(period.date_start)} - ${formatDate(period.date_end)}` },
          { key: "items", label: "Jumlah Item", render: (period) => period.item_count },
          { key: "status", label: "Status", render: (period) => <SpfStatusBadge status={period.status} /> },
          { key: "updated", label: "Diperbarui", render: (period) => formatDateTime(period.updated_at) },
          {
            key: "actions",
            label: "Aksi",
            render: (period) => (
              <div className="flex min-w-[240px] flex-wrap gap-1.5" onClick={(event) => event.stopPropagation()}>
                {actionLinks(period).map((action) => (
                  <Link
                    key={`${period.id}:${action.label}`}
                    href={action.href}
                    className="inline-flex h-8 items-center gap-1.5 border border-border px-2.5 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground hover:bg-muted hover:text-foreground dark:border-white/[0.08]"
                  >
                    {action.icon}
                    {action.label}
                  </Link>
                ))}
              </div>
            ),
          },
        ]}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-[11px] text-muted-foreground">
          {meta.total} total · halaman {page} dari {totalPages}
        </p>
        <div className="flex items-center gap-1">
          <ActionButton disabled={page <= 1} onClick={() => goToPage(page - 1)}>Prev</ActionButton>
          <ActionButton disabled={!meta.hasNextPage} onClick={() => goToPage(page + 1)}>Next</ActionButton>
        </div>
      </div>
    </div>
  );
}
