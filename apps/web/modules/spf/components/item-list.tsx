"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SpfItem, SpfPagination } from "@/shared/api/spf-contracts";
import type { SpfRole } from "@/shared/auth/admin-session";
import { ActionButton, EmptyRow } from "@/shared/ui/compact";
import { useSweetAlert } from "@/shared/ui/sweet-alert";
import { mutateSpf } from "@/shared/api/spf";

interface ItemListProps {
  rows: readonly SpfItem[];
  meta: SpfPagination;
  role: SpfRole;
  editable?: boolean;
}

export function ItemList({ rows, meta, role, editable = true }: ItemListProps) {
  const router = useRouter();
  const { alertElement, confirm, notifySuccess, notifyError } = useSweetAlert();
  const [isDeleting, startDeleteTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const page = Math.floor(meta.offset / meta.limit) + 1;
  const totalPages = Math.ceil(meta.total / meta.limit);

  function goToPage(next: number) {
    const params = new URLSearchParams(window.location.search);
    params.set("page", String(next));
    router.push(`?${params.toString()}`);
  }

  async function handleDelete(item: SpfItem) {
    const confirmed = await confirm({
      title: `Hapus Item #${item.id}`,
      description: `Apakah Anda yakin ingin menghapus item "${item.work_type}" untuk Car #${item.car_id}? Aksi ini tidak dapat dibatalkan.`,
      tone: "warning",
      confirmLabel: "Hapus Item",
      cancelLabel: "Batal",
    });

    if (!confirmed) return;

    setDeletingId(item.id);
    startDeleteTransition(async () => {
      const result = await mutateSpf("item", {
        mode: "DELETE",
        item_id: item.id,
      });

      setDeletingId(null);

      if (!result.success) {
        notifyError("Gagal Hapus", result.message);
        return;
      }

      notifySuccess("Sukses", `Item #${item.id} berhasil dihapus.`);
      router.refresh();
    });
  }

  if (rows.length === 0) {
    return <EmptyRow message="Belum ada item SPF yang ditemukan." />;
  }

  return (
    <div className="space-y-2">
      {alertElement}

      <div className="overflow-x-auto border border-border dark:border-white/[0.05]">
        <table className="w-full min-w-[700px] text-[13px]">
          <thead>
            <tr className="border-b border-border bg-muted dark:border-white/[0.05] dark:bg-white/[0.02]">
              <th className="px-3 py-2 text-left font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground dark:text-foreground/40">
                ID
              </th>
              <th className="px-3 py-2 text-left font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground dark:text-foreground/40">
                Nama Mobil
              </th>
              <th className="px-3 py-2 text-left font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground dark:text-foreground/40">
                Jenis Pekerjaan
              </th>
              <th className="px-3 py-2 text-left font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground dark:text-foreground/40">
                Deskripsi
              </th>
              <th className="px-3 py-2 text-left font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground dark:text-foreground/40">
                Periode ID
              </th>
              <th className="px-3 py-2 text-left font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground dark:text-foreground/40">
                Aksi
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => (
              <tr
                key={item.id}
                className="border-b border-border last:border-b-0 hover:bg-muted/40 dark:border-white/[0.04] dark:hover:bg-white/[0.02]"
              >
                <td className="px-3 py-2.5 font-mono text-[12px] text-muted-foreground tabular-nums dark:text-foreground/45">
                  #{item.id}
                </td>
                <td className="px-3 py-2.5 font-mono text-[12px] font-semibold text-foreground dark:text-foreground">
                  {item.car_name || item.car_id}
                </td>
                <td className="px-3 py-2.5 font-medium text-foreground dark:text-foreground">
                  {item.work_type}
                </td>
                <td className="max-w-[280px] px-3 py-2.5">
                  <p className="truncate text-foreground dark:text-foreground/90">
                    {item.description}
                  </p>
                </td>
                <td className="px-3 py-2.5 font-mono text-[12px] text-muted-foreground tabular-nums dark:text-foreground/45">
                  {item.period_id ? (
                    <Link
                      href={`/spf/periods/${item.period_id}`}
                      className="text-app-accent-ink hover:underline dark:text-app-accent-ink/80"
                    >
                      #{item.period_id}
                    </Link>
                  ) : (
                    "-"
                  )}
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Link
                      href={`/spf/items/${item.id}`}
                      className="inline-flex items-center gap-1 rounded border border-border bg-muted/60 px-2.5 py-1 font-mono text-[11px] font-semibold text-foreground transition-all hover:bg-muted dark:border-white/[0.08] dark:bg-white/[0.04]"
                      title="Lihat Detail Item"
                    >
                      👁️ Detail
                    </Link>
                    {role === "ADMIN" && editable && item.period_id === null && (
                      <button
                        type="button"
                        onClick={() => handleDelete(item)}
                        disabled={isDeleting && deletingId === item.id}
                        className="inline-flex items-center gap-1 rounded border border-destructive/30 bg-destructive/10 px-2.5 py-1 font-mono text-[11px] font-semibold text-destructive transition-all hover:bg-destructive/20 disabled:opacity-50 dark:border-destructive/30 dark:bg-destructive/15"
                        title="Hapus Item Ini"
                      >
                        🗑️ {isDeleting && deletingId === item.id ? "Hapus…" : "Hapus"}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
