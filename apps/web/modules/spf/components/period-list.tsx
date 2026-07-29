"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SpfPeriod, SpfPagination } from "@/shared/api/spf-contracts";
import type { SpfRole } from "@/shared/auth/admin-session";
import { ActionButton, EmptyRow } from "@/shared/ui/compact";
import { useSweetAlert } from "@/shared/ui/sweet-alert";
import { mutateSpf } from "@/shared/api/spf";

// ─── Status badge ─────────────────────────────────────────────────────────────
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

// ─── Props ────────────────────────────────────────────────────────────────────
interface PeriodListProps {
  rows: readonly SpfPeriod[];
  meta: SpfPagination;
  role: SpfRole;
}

export function PeriodList({ rows, meta, role }: PeriodListProps) {
  const router = useRouter();
  const { alertElement, confirm, notifySuccess, notifyError } = useSweetAlert();
  const [isSubmitting, startSubmitTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();

  const page = Math.floor(meta.offset / meta.limit) + 1;
  const totalPages = Math.ceil(meta.total / meta.limit);

  function goToPage(next: number) {
    const params = new URLSearchParams(window.location.search);
    params.set("page", String(next));
    router.push(`?${params.toString()}`);
  }

  async function handleSubmitPeriod(period: SpfPeriod) {
    const confirmed = await confirm({
      title: `Ajukan Periode #${period.id}`,
      description: `Apakah Anda yakin ingin mengajukan periode "${period.title}" untuk ditinjau (Waiting Approval)?`,
      tone: "info",
      confirmLabel: "Ajukan Sekarang",
      cancelLabel: "Batal",
    });

    if (!confirmed) return;

    startSubmitTransition(async () => {
      const result = await mutateSpf("period", {
        mode: "SUBMIT",
        period_id: period.id,
      });

      if (!result.success) {
        notifyError("Gagal Mengajukan", result.message);
        return;
      }

      notifySuccess("Berhasil", `Periode #${period.id} telah diajukan ke Waiting Approval.`);
      router.refresh();
    });
  }

  async function handleDeletePeriod(period: SpfPeriod) {
    const confirmed = await confirm({
      title: `Hapus Antrian Periode #${period.id}`,
      description: "Apakah Anda yakin ingin menghapus antrian ini?",
      tone: "warning",
      confirmLabel: "Ya, Hapus",
      cancelLabel: "Batal",
    });

    if (!confirmed) return;

    startDeleteTransition(async () => {
      const result = await mutateSpf("period", {
        mode: "DELETE",
        period_id: period.id,
      });

      if (!result.success) {
        notifyError("Gagal Menghapus", result.message);
        return;
      }

      notifySuccess("Berhasil", `Antrian periode #${period.id} telah dihapus.`);
      router.refresh();
    });
  }

  if (rows.length === 0) {
    return (
      <EmptyRow message="Belum ada periode SPF dalam kategori ini. Buat periode baru atau ubah filter tab." />
    );
  }

  return (
    <div className="space-y-2">
      {alertElement}

      {/* Table */}
      <div className="overflow-x-auto border border-border dark:border-white/[0.05]">
        <table className="w-full min-w-[640px] text-[13px]">
          <thead>
            <tr className="border-b border-border bg-muted dark:border-white/[0.05] dark:bg-white/[0.02]">
              <th className="px-3 py-2 text-left font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground dark:text-foreground/40">
                ID
              </th>
              <th className="px-3 py-2 text-left font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground dark:text-foreground/40">
                Judul Periode
              </th>
              <th className="px-3 py-2 text-left font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground dark:text-foreground/40">
                Status
              </th>
              <th className="px-3 py-2 text-left font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground dark:text-foreground/40">
                Dibuat
              </th>
              <th className="px-3 py-2 text-left font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground dark:text-foreground/40">
                Aksi
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((period) => {
              const isModifiable =
                role === "ADMIN" &&
                (period.status === "DRAFT" || period.status === "REJECTED");

              return (
                <tr
                  key={period.id}
                  className="border-b border-border last:border-b-0 hover:bg-muted/40 dark:border-white/[0.04] dark:hover:bg-white/[0.02]"
                >
                  <td className="px-3 py-2.5 font-mono text-[12px] text-muted-foreground tabular-nums dark:text-foreground/45">
                    #{period.id}
                  </td>
                  <td className="max-w-[280px] px-3 py-2.5">
                    <Link
                      href={`/spf/periods/${period.id}`}
                      className="group block transition-colors"
                      title="Klik untuk membuka detail periode"
                    >
                      <p className="truncate font-medium text-foreground group-hover:text-primary group-hover:underline dark:text-foreground">
                        {period.title}
                      </p>
                      {period.description && (
                        <p className="mt-0.5 truncate text-[12px] text-muted-foreground dark:text-foreground/40">
                          {period.description}
                        </p>
                      )}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusBadge status={period.status} />
                  </td>
                  <td className="px-3 py-2.5 font-mono text-[12px] text-muted-foreground tabular-nums dark:text-foreground/40">
                    {new Date(period.created_at).toLocaleDateString("id-ID", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-3 py-2.5">
                    {isModifiable ? (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => handleSubmitPeriod(period)}
                          className="inline-flex items-center rounded border border-success/30 bg-success/10 px-2.5 py-1 font-mono text-[11px] font-semibold text-success transition-all hover:bg-success/20 disabled:opacity-50 dark:border-success/30 dark:bg-success/15"
                          title="Ajukan ke Waiting Approval"
                        >
                          Ajukan
                        </button>
                        <button
                          type="button"
                          disabled={isDeleting}
                          onClick={() => handleDeletePeriod(period)}
                          className="inline-flex items-center rounded border border-destructive/30 bg-destructive/10 px-2.5 py-1 font-mono text-[11px] font-semibold text-destructive transition-all hover:bg-destructive/20 disabled:opacity-50 dark:border-destructive/30 dark:bg-destructive/15"
                          title="Hapus Antrian Periode Ini"
                        >
                          {isDeleting ? "Hapus…" : "Hapus"}
                        </button>
                      </div>
                    ) : (
                      <span className="font-mono text-[12px] text-muted-foreground">-</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="font-mono text-[11px] text-muted-foreground dark:text-foreground/40">
            {meta.total} total · halaman {page} dari {totalPages}
          </p>
          <div className="flex items-center gap-1">
            <ActionButton
              variant="default"
              disabled={page <= 1}
              onClick={() => goToPage(page - 1)}
            >
              ← Prev
            </ActionButton>
            <ActionButton
              variant="default"
              disabled={!meta.hasNextPage}
              onClick={() => goToPage(page + 1)}
            >
              Next →
            </ActionButton>
          </div>
        </div>
      )}
    </div>
  );
}
