"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, Eye, FileText, Send, Share2, UploadCloud } from "lucide-react";
import type { SpfPagination, SpfPeriod } from "@/shared/api/spf-contracts";
import type { SpfRole } from "@/shared/auth/admin-session";
import { ActionButton } from "@/shared/ui/compact";
import { SpfDataTable } from "./spf-data-table";
import { SpfStatusBadge } from "./spf-status-badge";

interface PeriodListProps {
  rows: readonly SpfPeriod[];
  meta: SpfPagination;
  role: SpfRole;
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

function actionLinks(period: SpfPeriod, role: SpfRole) {
  const detail = `/spf/periods/${period.id}`;
  const preview = `${detail}?tab=preview`;
  if (period.status === "DRAFT") {
    return [
      { href: detail, label: "Lanjutkan", icon: <FileText className="h-3.5 w-3.5" /> },
      { href: `${detail}?tab=items`, label: "Edit", icon: <FileText className="h-3.5 w-3.5" /> },
      { href: preview, label: "Review", icon: <Eye className="h-3.5 w-3.5" /> },
      ...(role === "ADMIN" ? [{ href: detail, label: "Ajukan", icon: <Send className="h-3.5 w-3.5" /> }] : []),
    ];
  }
  if (period.status === "REJECTED") {
    return [
      { href: detail, label: "Revisi", icon: <FileText className="h-3.5 w-3.5" /> },
      ...(role === "ADMIN" ? [{ href: detail, label: "Ajukan Ulang", icon: <Send className="h-3.5 w-3.5" /> }] : []),
    ];
  }
  if (period.status === "WAITING_APPROVAL") {
    return [{ href: detail, label: "Detail", icon: <Eye className="h-3.5 w-3.5" /> }];
  }
  if (period.status === "APPROVED") {
    return [
      { href: preview, label: "Preview Client", icon: <Eye className="h-3.5 w-3.5" /> },
      ...(role === "PUBLISHER" ? [{ href: detail, label: "Publish", icon: <UploadCloud className="h-3.5 w-3.5" /> }] : []),
    ];
  }
  return [
    { href: preview, label: "Preview", icon: <Eye className="h-3.5 w-3.5" /> },
    { href: `${detail}?export=1`, label: "Export", icon: <Download className="h-3.5 w-3.5" /> },
    { href: `/spf/url-generator?period_id=${encodeURIComponent(period.id)}`, label: "Bagikan", icon: <Share2 className="h-3.5 w-3.5" /> },
    ...(role === "PUBLISHER" ? [{ href: detail, label: "Unpublish", icon: <UploadCloud className="h-3.5 w-3.5" /> }] : []),
  ];
}

export function PeriodList({ rows, meta, role }: PeriodListProps) {
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
        columns={[
          {
            key: "unit",
            label: "Unit",
            render: (period) => (
              <div>
                <p className="font-mono text-[12px] font-semibold text-foreground">{period.car_id || "-"}</p>
                {period.car_name ? <p className="text-[12px] text-muted-foreground">{period.car_name}</p> : null}
              </div>
            ),
          },
          {
            key: "period",
            label: "Periode",
            render: (period) => (
              <Link href={`/spf/periods/${period.id}`} className="font-medium text-foreground hover:text-app-accent-ink hover:underline">
                {period.title || period.id}
              </Link>
            ),
          },
          { key: "range", label: "Rentang Tanggal", render: (period) => `${formatDate(period.date_start)} - ${formatDate(period.date_end)}` },
          { key: "items", label: "Jumlah Item", render: (period) => period.item_count },
          { key: "docs", label: "Dokumentasi", render: (period) => period.documentation_count },
          { key: "status", label: "Status", render: (period) => <SpfStatusBadge status={period.status} /> },
          { key: "updated", label: "Updated At", render: (period) => formatDateTime(period.updated_at) },
          {
            key: "actions",
            label: "Aksi",
            render: (period) => (
              <div className="flex min-w-[240px] flex-wrap gap-1.5">
                {actionLinks(period, role).map((action) => (
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
