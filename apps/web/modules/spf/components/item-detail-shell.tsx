"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Camera } from "lucide-react";
import type { CountdownBoardRow } from "@smsystem/contracts/countdown";
import { ItemForm } from "./forms/item-form";
import { ItemMedia } from "./item-media";
import type { SpfItem, SpfMedia } from "@/shared/api/spf-contracts";
import { ActionButton, PageHeader, SectionCard } from "@/shared/ui/compact";
import { useSweetAlert } from "@/shared/ui/sweet-alert";
import { mutateSpf } from "@/shared/api/spf";
import { DataGridStatusBadge } from "@/shared/datagrid/status-badge";

interface ItemDetailShellProps {
  item: Readonly<SpfItem>;
  media: readonly SpfMedia[];
  history: readonly CountdownBoardRow[];
  canAdmin: boolean;
  editable: boolean;
}

export function ItemDetailShell({
  item,
  media,
  history,
  canAdmin,
  editable,
}: ItemDetailShellProps) {
  const router = useRouter();
  const [isEditOpen, setEditOpen] = useState(false);
  const [isDeleting, startDeleteTransition] = useTransition();
  const { alertElement, confirm, notifySuccess, notifyError } = useSweetAlert();

  async function handleDeleteItem() {
    const confirmed = await confirm({
      title: "Hapus Item",
      description: `Apakah Anda yakin ingin menghapus item "${item.work_type}" untuk unit ${item.car_id}? Aksi ini tidak dapat dibatalkan.`,
      tone: "warning",
      confirmLabel: "Hapus Item",
      cancelLabel: "Batal",
    });

    if (!confirmed) return;

    startDeleteTransition(async () => {
      const result = await mutateSpf("item", {
        mode: "DELETE",
        item_id: item.id,
      });

      if (!result.success) {
        notifyError("Gagal Hapus", result.message);
        return;
      }

      notifySuccess("Berhasil", "Item telah dihapus.");
      // Replace URL to list so back button doesn't land on deleted detail
      router.replace("/spf/items");
    });
  }

  return (
    <section aria-labelledby="item-detail-title" className="space-y-5">
      {alertElement}

      {/* Breadcrumb & Actions */}
      <div className="space-y-1">
        <nav aria-label="Breadcrumb">
          <ol className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground dark:text-foreground/45">
            <li>
              <Link href="/spf/items" className="hover:underline">
                Daftar Item
              </Link>
            </li>
            <li>/</li>
            <li className="text-foreground dark:text-foreground">#{item.id}</li>
          </ol>
        </nav>
        <PageHeader
          eyebrow={`ID #${item.id}`}
          title={item.work_type}
          actions={
            canAdmin && editable ? (
              <div className="flex items-center gap-2">
                <ActionButton variant="primary" onClick={() => setEditOpen(true)}>
                  Edit Item
                </ActionButton>
                <ActionButton
                  variant="danger"
                  disabled={isDeleting}
                  onClick={handleDeleteItem}
                >
                  {isDeleting ? "Hapus…" : "Hapus Item"}
                </ActionButton>
              </div>
            ) : undefined
          }
        />
      </div>

      {/* Metadata Card */}
      <SectionCard label="Informasi Item">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground dark:text-foreground/45">
                Nama Mobil
              </p>
              <p className="font-mono text-[14px] font-semibold text-foreground dark:text-foreground">
                {item.car_name || item.car_id}
              </p>
            </div>
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground dark:text-foreground/45">
                Jenis Pekerjaan
              </p>
              <p className="text-[13px] text-foreground dark:text-foreground">
                {item.work_type}
              </p>
            </div>
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground dark:text-foreground/45">
                Periode Terlampir
              </p>
              <p className="font-mono text-[12px] text-foreground dark:text-foreground">
                {item.period_id ? (
                  <Link
                    href={`/spf/periods?period=${encodeURIComponent(item.period_id)}`}
                    className="text-app-accent-ink hover:underline dark:text-app-accent-ink/80"
                  >
                    Periode #{item.period_id} →
                  </Link>
                ) : (
                  "Belum masuk periode"
                )}
              </p>
            </div>
          </div>

          <div className="space-y-2 font-mono text-[12px]">
            <div>
              <p className="uppercase tracking-[0.08em] text-muted-foreground dark:text-foreground/45">
                Tanggal Dibuat
              </p>
              <p className="text-foreground dark:text-foreground tabular-nums">
                {new Date(item.created_at).toLocaleString("id-ID")}
              </p>
            </div>
            <div>
              <p className="uppercase tracking-[0.08em] text-muted-foreground dark:text-foreground/45">
                Terakhir Diperbarui
              </p>
              <p className="text-foreground dark:text-foreground tabular-nums">
                {new Date(item.updated_at).toLocaleString("id-ID")}
              </p>
            </div>
          </div>
        </div>

        {/* Escaped Description */}
        <div className="mt-4 border-t border-border pt-3 dark:border-white/[0.05]">
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground dark:text-foreground/45 mb-1">
            Deskripsi Pekerjaan
          </p>
          <p className="text-[13px] text-foreground dark:text-foreground/90 whitespace-pre-wrap">
            {item.description}
          </p>
        </div>
      </SectionCard>

      {/* Riwayat Panel/Part */}
      <SectionCard label={`Riwayat Panel/Part (${history.length})`}>
        {history.length > 0 ? (
          <div className="divide-y divide-border dark:divide-white/[0.05]">
            {history.map((row) => (
              <div key={row.countdownId} className="grid gap-2 py-2 md:grid-cols-[minmax(10rem,1.4fr)_minmax(7rem,1fr)_5rem_auto_auto] md:items-center">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-foreground">
                    {row.panelName ?? row.sectionName ?? "-"}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {row.jobTypeName ?? row.sectionName ?? "-"}
                  </p>
                </div>
                <span className="w-fit"><DataGridStatusBadge value={row.status} /></span>
                <span className="font-mono text-[11px] tabular-nums text-foreground">{row.actualProgressPercent.toFixed(0)}%</span>
                <span className="font-mono text-[11px] text-muted-foreground">
                  T {row.targetHoursInitial} · A {row.totalActualHours} · S {row.remainingHours} jam
                </span>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/countdown/${encodeURIComponent(row.countdownId)}`}
                    className="inline-flex h-7 items-center border border-border px-2 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    Detail Countdown
                  </Link>
                  <Link
                    href={`/countdown/${encodeURIComponent(row.countdownId)}#dokumentasi`}
                    className="inline-flex h-7 items-center gap-1 border border-primary/30 px-2 font-mono text-[10px] uppercase tracking-[0.08em] text-app-accent-ink transition-colors hover:bg-primary/10"
                  >
                    <Camera className="h-3 w-3" />Dokumentasi
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[12px] text-muted-foreground">
            Belum ada riwayat panel/part untuk bagian ini.
          </p>
        )}
      </SectionCard>

      {/* Media Gallery Card */}
      <SectionCard label={`Dokumentasi & Media (${media.length})`}>
        <ItemMedia itemId={item.id} media={media} editable={editable} />
      </SectionCard>

      {/* Edit Dialog */}
      {isEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/35 p-4 backdrop-blur-[1px] dark:bg-background/80">
          <div className="w-full max-w-lg border border-border bg-white p-6 shadow-2xl dark:border-white/[0.08] dark:bg-popover">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground dark:text-foreground/50">Edit Item</h2>
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="text-muted-foreground hover:text-foreground dark:text-foreground/50 dark:hover:text-foreground"
              >
                ✕
              </button>
            </div>
            <ItemForm
              mode="UPDATE"
              item={item}
              onSuccess={() => setEditOpen(false)}
            />
          </div>
        </div>
      )}
    </section>
  );
}
