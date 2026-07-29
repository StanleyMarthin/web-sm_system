"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ItemList } from "./item-list";
import { ItemForm } from "./forms/item-form";
import type { SpfItem, SpfPagination } from "@/shared/api/spf-contracts";
import type { SpfRole } from "@/shared/auth/admin-session";
import { ActionButton, CompactInput, PageHeader } from "@/shared/ui/compact";

interface ItemListShellProps {
  rows: readonly SpfItem[];
  meta: SpfPagination;
  role: SpfRole;
}

export function ItemListShell({ rows, meta, role }: ItemListShellProps) {
  const router = useRouter();
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [carIdFilter, setCarIdFilter] = useState("");
  const [periodIdFilter, setPeriodIdFilter] = useState("");

  function handleFilterSubmit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams(window.location.search);
    if (carIdFilter.trim()) {
      params.set("car_id", carIdFilter.trim());
    } else {
      params.delete("car_id");
    }
    if (periodIdFilter.trim()) {
      params.set("period_id", periodIdFilter.trim());
    } else {
      params.delete("period_id");
    }
    params.set("page", "1");
    router.push(`?${params.toString()}`);
  }

  function handleResetFilter() {
    setCarIdFilter("");
    setPeriodIdFilter("");
    router.push("/spf/items");
  }

  return (
    <section aria-labelledby="spf-items-title" className="space-y-4">
      <PageHeader
        eyebrow="SPF"
        title="Daftar Item Restorasi"
        actions={
          <div className="flex items-center gap-2">
            {role === "ADMIN" && (
              <>
                <Link href="/spf/sources">
                  <ActionButton variant="default">
                    Source SMS DB
                  </ActionButton>
                </Link>
                <ActionButton
                  variant="primary"
                  onClick={() => setCreateOpen(true)}
                >
                  + Buat Item
                </ActionButton>
              </>
            )}
          </div>
        }
      />

      {/* Filter Form */}
      <form
        onSubmit={handleFilterSubmit}
        className="flex flex-wrap items-end gap-2 border border-border bg-card p-3 dark:border-white/[0.05]"
      >
        <div className="w-36">
          <label
            htmlFor="filter-car-id"
            className="block font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground dark:text-foreground/45 mb-1"
          >
            Nama Mobil
          </label>
          <CompactInput
            id="filter-car-id"
            placeholder="Filter Nama Mobil"
            value={carIdFilter}
            onChange={(e) => setCarIdFilter(e.target.value)}
          />
        </div>
        <div className="w-36">
          <label
            htmlFor="filter-period-id"
            className="block font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground dark:text-foreground/45 mb-1"
          >
            Period ID
          </label>
          <CompactInput
            id="filter-period-id"
            placeholder="Filter Period ID"
            value={periodIdFilter}
            onChange={(e) => setPeriodIdFilter(e.target.value)}
          />
        </div>
        <ActionButton type="submit" variant="primary">
          Filter
        </ActionButton>
        <ActionButton type="button" variant="default" onClick={handleResetFilter}>
          Reset
        </ActionButton>
      </form>

      {/* List Component */}
      <ItemList rows={rows} meta={meta} role={role} />

      {/* Create Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/35 p-4 backdrop-blur-[1px] dark:bg-background/80">
          <div className="w-full max-w-lg border border-border bg-white p-6 shadow-2xl dark:border-white/[0.08] dark:bg-popover">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground dark:text-foreground/50">
                Buat Item Baru
              </h2>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="text-muted-foreground hover:text-foreground dark:text-foreground/50 dark:hover:text-foreground"
              >
                ✕
              </button>
            </div>
            <ItemForm
              mode="CREATE"
              onSuccess={() => setCreateOpen(false)}
            />
          </div>
        </div>
      )}
    </section>
  );
}
