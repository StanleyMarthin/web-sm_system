"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { PeriodForm } from "./forms/period-form";
import { PeriodWorkflowActions } from "./period-workflow-actions";
import { ItemList } from "./item-list";
import type { SpfPeriod, SpfItem } from "@/shared/api/spf-contracts";
import type { SpfRole } from "@/shared/auth/admin-session";
import { ActionButton, PageHeader, SectionCard } from "@/shared/ui/compact";
import { useSweetAlert } from "@/shared/ui/sweet-alert";
import { mutateSpf } from "@/shared/api/spf";

const STATUS_STYLES: Record<string, string> = {
  DRAFT:
    "border-border bg-muted text-muted-foreground dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-foreground/50",
  WAITING_APPROVAL:
    "border-primary/30 bg-primary/8 text-app-accent-ink dark:border-primary/25 dark:bg-primary/10 dark:text-app-accent-ink",
  APPROVED:
    "border-success/25 bg-success/8 text-success dark:border-success/30 dark:bg-success/10 dark:text-success",
  PUBLISHED:
    "border-success/40 bg-success/15 text-success dark:border-success/40 dark:bg-success/20 dark:text-success",
  REJECTED:
    "border-destructive/25 bg-destructive/8 text-destructive dark:border-destructive/20 dark:bg-destructive/10 dark:text-destructive",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-block border px-2 py-0.5 font-mono text-[11px] uppercase tracking-[0.08em] ${
        STATUS_STYLES[status] ?? STATUS_STYLES["DRAFT"]
      }`}
    >
      {status.replace("_", " ")}
    </span>
  );
}

interface PeriodDetailShellProps {
  period: Readonly<SpfPeriod>;
  items: readonly SpfItem[];
  role: SpfRole;
  editable: boolean;
}

export function PeriodDetailShell({
  period,
  items,
  role,
  editable,
}: PeriodDetailShellProps) {
  const [isEditOpen, setEditOpen] = useState(false);
  const [isExporting, startExportTransition] = useTransition();
  const { alertElement, notifyError, notifySuccess } = useSweetAlert();

  const isEditable =
    editable &&
    role === "ADMIN" &&
    (period.status === "DRAFT" || period.status === "REJECTED");

  function handleExport() {
    startExportTransition(async () => {
      const result = await mutateSpf("period", {
        mode: "EXPORT",
        period_id: period.id,
      });

      if (!result.success) {
        notifyError("Gagal Export", result.message);
        return;
      }

      notifySuccess("Export Berhasil", "Laporan periode siap Diunduh.");
    });
  }

  return (
    <section aria-labelledby="period-detail-title" className="space-y-5">
      {alertElement}

      {/* Breadcrumb & Actions */}
      <div className="space-y-1">
        <nav aria-label="Breadcrumb">
          <ol className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground dark:text-foreground/45">
            <li>
              <Link href="/spf/periods" className="hover:underline">
                Periode SPF
              </Link>
            </li>
            <li>/</li>
            <li className="text-foreground dark:text-foreground">#{period.id}</li>
          </ol>
        </nav>
        <PageHeader
          eyebrow={`ID #${period.id}`}
          title={period.title}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {isEditable && (
                <ActionButton variant="primary" onClick={() => setEditOpen(true)}>
                  Edit Periode
                </ActionButton>
              )}
              <ActionButton
                variant="default"
                disabled={isExporting}
                onClick={handleExport}
              >
                {isExporting ? "Mengeksport…" : "Export Laporan"}
              </ActionButton>
              <PeriodWorkflowActions
                periodId={period.id}
                status={period.status}
                role={role}
              />
            </div>
          }
        />
      </div>

      {/* Read-Only Notice Banner for Published / Waiting Approval */}
      {!isEditable && (
        <div className="rounded border border-primary/20 bg-primary/5 p-3 dark:border-primary/15 dark:bg-primary/8">
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-app-accent-ink font-semibold dark:text-app-accent-ink/90">
            Mode Read-Only ({period.status.replace("_", " ")})
          </p>
          <p className="mt-1 text-[12px] leading-5 text-muted-foreground dark:text-foreground/75">
            {period.status === "PUBLISHED"
              ? "Periode ini telah dipublikasi ke portal klien. Seluruh elemen detail (periode, item, dan gambar) dikunci dan tidak dapat diubah."
              : period.status === "WAITING_APPROVAL"
                ? "Periode ini sedang menunggu persetujuan (Waiting Approval). Elemen dikunci hingga proses peninjauan selesai."
                : "Periode ini berada dalam mode baca saja."}
          </p>
        </div>
      )}

      {/* Summary Card */}
      <SectionCard label="Informasi Periode">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground dark:text-foreground/45">
                Status
              </p>
              <div className="mt-1">
                <StatusBadge status={period.status} />
              </div>
            </div>
            {period.description && (
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground dark:text-foreground/45">
                  Deskripsi
                </p>
                <p className="mt-1 text-[13px] text-foreground dark:text-foreground/90 whitespace-pre-wrap">
                  {period.description}
                </p>
              </div>
            )}
            {period.rejection_reason && (
              <div className="rounded border border-destructive/20 bg-destructive/5 p-2.5 dark:border-destructive/20">
                <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-destructive font-semibold">
                  Alasan Penolakan (Rejection Reason)
                </p>
                <p className="mt-1 text-[13px] text-destructive dark:text-destructive/90">
                  {period.rejection_reason}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-2 font-mono text-[12px]">
            <div>
              <p className="uppercase tracking-[0.08em] text-muted-foreground dark:text-foreground/45">
                Dibuat Oleh (Creator)
              </p>
              <p className="text-foreground dark:text-foreground font-semibold">{period.created_by}</p>
            </div>
            <div>
              <p className="uppercase tracking-[0.08em] text-muted-foreground dark:text-foreground/45">
                Tanggal Dibuat
              </p>
              <p className="text-foreground dark:text-foreground tabular-nums">
                {new Date(period.created_at).toLocaleString("id-ID")}
              </p>
            </div>
            <div>
              <p className="uppercase tracking-[0.08em] text-muted-foreground dark:text-foreground/45">
                Terakhir Diperbarui
              </p>
              <p className="text-foreground dark:text-foreground tabular-nums">
                {new Date(period.updated_at).toLocaleString("id-ID")}
              </p>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Histori Audit Perubahan Status */}
      <SectionCard label="Histori Audit Perubahan Status">
        <div className="space-y-3">
          <div className="flex items-start gap-3 border-b border-border pb-2.5 last:border-b-0 dark:border-white/[0.04]">
            <div className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary font-mono text-[10px] font-bold">
              1
            </div>
            <div className="flex-1 space-y-0.5 text-[12px]">
              <div className="flex items-center justify-between">
                <span className="font-mono font-semibold text-foreground">Pembuatan DRAFT</span>
                <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                  {new Date(period.created_at).toLocaleString("id-ID")}
                </span>
              </div>
              <p className="text-muted-foreground dark:text-foreground/60">
                Dibuat oleh <span className="font-semibold text-foreground">{period.created_by}</span>
              </p>
            </div>
          </div>

          {period.status !== "DRAFT" && (
            <div className="flex items-start gap-3 border-b border-border pb-2.5 last:border-b-0 dark:border-white/[0.04]">
              <div className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary font-mono text-[10px] font-bold">
                2
              </div>
              <div className="flex-1 space-y-0.5 text-[12px]">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-semibold text-foreground">
                    Pengajuan Persetujuan (Submit)
                  </span>
                  <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                    {new Date(period.updated_at).toLocaleString("id-ID")}
                  </span>
                </div>
                <p className="text-muted-foreground dark:text-foreground/60">
                  Status diajukan dari DRAFT ke WAITING APPROVAL oleh Admin
                </p>
              </div>
            </div>
          )}

          {(period.status === "APPROVED" || period.status === "PUBLISHED") && (
            <div className="flex items-start gap-3 border-b border-border pb-2.5 last:border-b-0 dark:border-white/[0.04]">
              <div className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-success/10 text-success font-mono text-[10px] font-bold">
                3
              </div>
              <div className="flex-1 space-y-0.5 text-[12px]">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-semibold text-success">Persetujuan (Approved)</span>
                  <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                    {new Date(period.updated_at).toLocaleString("id-ID")}
                  </span>
                </div>
                <p className="text-muted-foreground dark:text-foreground/60">
                  Disetujui oleh Approver
                </p>
              </div>
            </div>
          )}

          {period.status === "REJECTED" && (
            <div className="flex items-start gap-3 border-b border-border pb-2.5 last:border-b-0 dark:border-white/[0.04]">
              <div className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive/10 text-destructive font-mono text-[10px] font-bold">
                !
              </div>
              <div className="flex-1 space-y-0.5 text-[12px]">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-semibold text-destructive">Penolakan (Rejected)</span>
                  <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                    {new Date(period.updated_at).toLocaleString("id-ID")}
                  </span>
                </div>
                <p className="text-destructive dark:text-destructive/90">
                  Alasan: {period.rejection_reason || "Perlu revisi data"}
                </p>
              </div>
            </div>
          )}

          {period.status === "PUBLISHED" && (
            <div className="flex items-start gap-3 border-b border-border pb-2.5 last:border-b-0 dark:border-white/[0.04]">
              <div className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-success/20 text-success font-mono text-[10px] font-bold">
                4
              </div>
              <div className="flex-1 space-y-0.5 text-[12px]">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-semibold text-success">Publikasi Portal (Published)</span>
                  <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                    {new Date(period.updated_at).toLocaleString("id-ID")}
                  </span>
                </div>
                <p className="text-muted-foreground dark:text-foreground/60">
                  Dipublikasi ke portal viewer klien (`is_released = 1`)
                </p>
              </div>
            </div>
          )}
        </div>
      </SectionCard>

      {/* Item List embedded */}
      <SectionCard label={`Daftar Item (${items.length})`}>
        <ItemList
          rows={items}
          meta={{
            total: items.length,
            limit: Math.max(1, items.length),
            offset: 0,
            hasNextPage: false,
          }}
          role={role}
          editable={isEditable}
        />
      </SectionCard>

      {/* Edit dialog */}
      {isEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/35 p-4 backdrop-blur-[1px] dark:bg-background/80">
          <div className="w-full max-w-lg border border-border bg-white p-6 shadow-2xl dark:border-white/[0.08] dark:bg-popover">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground dark:text-foreground/50">
                Edit Periode #{period.id}
              </h2>
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="text-muted-foreground hover:text-foreground dark:text-foreground/50 dark:hover:text-foreground"
              >
                ✕
              </button>
            </div>
            <PeriodForm
              mode="UPDATE"
              period={period}
              onClose={() => setEditOpen(false)}
              onSuccess={() => setEditOpen(false)}
            />
          </div>
        </div>
      )}
    </section>
  );
}
