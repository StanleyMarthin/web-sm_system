"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { SpfSource, SpfPagination } from "@/shared/api/spf-contracts";
import { ActionButton, CompactInput, EmptyRow } from "@/shared/ui/compact";
import { useSweetAlert } from "@/shared/ui/sweet-alert";
import { mutateSpfCollect } from "@/shared/api/spf";

interface SourceCollectorProps {
  sources: readonly SpfSource[];
  meta: SpfPagination;
}

export function SourceCollector({ sources, meta }: SourceCollectorProps) {
  const router = useRouter();
  const { alertElement, notifySuccess, notifyError } = useSweetAlert();
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isCollecting, startCollectTransition] = useTransition();
  const [carFilter, setCarFilter] = useState("");
  const [resultNotice, setResultNotice] = useState<string | null>(null);

  const page = Math.floor(meta.offset / meta.limit) + 1;
  const totalPages = Math.ceil(meta.total / meta.limit);

  // Visible rows that are not yet collected
  const uncollectedVisible = useMemo(
    () => sources.filter((s) => !s.collected),
    [sources],
  );

  const isAllVisibleSelected =
    uncollectedVisible.length > 0 &&
    uncollectedVisible.every((s) => selectedIds.has(s.id));

  function toggleSelectAllVisible() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (isAllVisibleSelected) {
        for (const s of uncollectedVisible) {
          next.delete(s.id);
        }
      } else {
        for (const s of uncollectedVisible) {
          if (next.size < 200) {
            next.add(s.id);
          }
        }
      }
      return next;
    });
  }

  function toggleSelectOne(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size >= 200) {
          notifyError("Batas Maksimum", "Maksimal 200 item per request collect.");
          return prev;
        }
        next.add(id);
      }
      return next;
    });
  }

  function handleFilterSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSelectedIds(new Set()); // Reset selection when filter changes
    const params = new URLSearchParams(window.location.search);
    if (carFilter.trim()) {
      params.set("car_id", carFilter.trim());
    } else {
      params.delete("car_id");
    }
    params.set("page", "1");
    router.push(`?${params.toString()}`);
  }

  function goToPage(next: number) {
    setSelectedIds(new Set()); // Clear selection on page change
    const params = new URLSearchParams(window.location.search);
    params.set("page", String(next));
    router.push(`?${params.toString()}`);
  }

  function handleCollectSubmit() {
    if (selectedIds.size === 0) return;
    const idsArray = Array.from(selectedIds);

    startCollectTransition(async () => {
      const result = await mutateSpfCollect(idsArray);

      if (!result.success) {
        notifyError("Gagal Collect", result.message);
        return;
      }

      const { inserted, ignored } = result.data;
      const notice = `Berhasil collect: ${inserted} item baru ditambahkan, ${ignored} diabaikan (sudah ada).`;
      setResultNotice(notice);
      notifySuccess("Collect Sukses", notice);
      setSelectedIds(new Set());
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {alertElement}

      {/* Accessible Result Notice */}
      {resultNotice && (
        <p
          role="status"
          aria-live="polite"
          className="border border-success/20 bg-success/8 px-3 py-2 text-[13px] text-success dark:border-success/25 dark:bg-success/8"
        >
          {resultNotice}
        </p>
      )}

      {/* Filter & Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border border-border bg-card p-3 dark:border-white/[0.05]">
        <form onSubmit={handleFilterSubmit} className="flex items-center gap-2">
          <div className="w-36">
            <CompactInput
              placeholder="Filter Nama Mobil"
              value={carFilter}
              onChange={(e) => setCarFilter(e.target.value)}
            />
          </div>
          <ActionButton type="submit" variant="primary">
            Filter
          </ActionButton>
        </form>

        <div className="flex items-center gap-3">
          <span className="font-mono text-[11px] text-muted-foreground tabular-nums dark:text-foreground/45">
            Terpilih: {selectedIds.size} / 200 maks
          </span>
          <ActionButton
            type="button"
            variant="success"
            disabled={selectedIds.size === 0 || isCollecting}
            onClick={handleCollectSubmit}
          >
            {isCollecting
              ? "Proses Collect…"
              : `Collect ${selectedIds.size} Source`}
          </ActionButton>
        </div>
      </div>

      {/* Source Data Table */}
      {sources.length === 0 ? (
        <EmptyRow message="Tidak ada data source SMS yang ditemukan." />
      ) : (
        <div className="overflow-x-auto border border-border dark:border-white/[0.05]">
          <table className="w-full min-w-[700px] text-[13px]">
            <thead>
              <tr className="border-b border-border bg-muted dark:border-white/[0.05] dark:bg-white/[0.02]">
                <th className="w-10 px-3 py-2 text-center">
                  <input
                    type="checkbox"
                    checked={isAllVisibleSelected}
                    onChange={toggleSelectAllVisible}
                    disabled={uncollectedVisible.length === 0}
                    className="cursor-pointer"
                  />
                </th>
                <th className="px-3 py-2 text-left font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground dark:text-foreground/40">
                  ID
                </th>
                <th className="px-3 py-2 text-left font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground dark:text-foreground/40">
                  Nama Mobil
                </th>
                <th className="px-3 py-2 text-left font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground dark:text-foreground/40">
                  Deskripsi SMS
                </th>
                <th className="px-3 py-2 text-left font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground dark:text-foreground/40">
                  Jenis Pekerjaan
                </th>
                <th className="px-3 py-2 text-left font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground dark:text-foreground/40">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {sources.map((source) => {
                const isSelected = selectedIds.has(source.id);
                return (
                  <tr
                    key={source.id}
                    className={`border-b border-border last:border-b-0 hover:bg-muted/40 dark:border-white/[0.04] dark:hover:bg-white/[0.02] ${
                      source.collected ? "opacity-50 bg-muted/20" : ""
                    }`}
                  >
                    <td className="px-3 py-2.5 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectOne(source.id)}
                        disabled={source.collected}
                        className="cursor-pointer disabled:cursor-not-allowed"
                      />
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[12px] text-muted-foreground tabular-nums dark:text-foreground/45">
                      #{source.id}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[12px] font-semibold text-foreground dark:text-foreground">
                      {source.car_name || source.car_id}
                    </td>
                    <td className="max-w-[280px] px-3 py-2.5">
                      <p className="truncate text-foreground dark:text-foreground/90">
                        {source.description}
                      </p>
                    </td>
                    <td className="px-3 py-2.5 text-foreground dark:text-foreground/80">
                      {source.work_type ?? "-"}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[11px] uppercase tracking-[0.08em]">
                      {source.collected ? (
                        <span className="text-muted-foreground">Collected</span>
                      ) : (
                        <span className="text-success font-semibold">Ready</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

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
