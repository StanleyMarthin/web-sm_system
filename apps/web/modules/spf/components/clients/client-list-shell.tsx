"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, Search } from "lucide-react";
import type { SpfClient, SpfPagination } from "@/shared/api/spf-contracts";
import { ActionButton, CompactInput, PageHeader, SectionCard } from "@/shared/ui/compact";
import { SpfDataTable } from "../spf-data-table";

export function ClientListShell({ rows, meta }: { rows: readonly SpfClient[]; meta: SpfPagination }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const params = new URLSearchParams(searchParams.toString());
    const search = String(formData.get("search") ?? "").trim();
    if (search) params.set("search", search);
    else params.delete("search");
    params.set("page", "1");
    router.push(`?${params.toString()}`);
  }

  return (
    <section className="space-y-4">
      <PageHeader eyebrow="SPF Admin" title="Client / Customer" />
      <SectionCard label="Filter">
        <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
          <div className="min-w-[260px] flex-1">
            <label className="mb-1 block font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Search</label>
            <CompactInput name="search" defaultValue={searchParams.get("search") ?? ""} placeholder="Cari client, account_id, owner_slug" />
          </div>
          <ActionButton type="submit" variant="primary"><Search className="h-3.5 w-3.5" />Filter</ActionButton>
        </form>
      </SectionCard>
      <SpfDataTable
        rows={rows}
        minWidth={960}
        emptyMessage="Belum ada client SPF dari backend."
        columns={[
          {
            key: "client",
            label: "Client",
            render: (client) => (
              <div>
                <Link href={`/spf/clients/${client.id}`} className="font-semibold text-foreground hover:text-app-accent-ink hover:underline">{client.display_name}</Link>
                <p className="font-mono text-[11px] text-muted-foreground">{client.account_id ?? client.owner_slug ?? client.id}</p>
              </div>
            ),
          },
          { key: "units", label: "Jumlah Unit", render: (client) => client.unit_count },
          { key: "last", label: "Laporan Terakhir", render: (client) => client.last_report_title ?? "-" },
          { key: "updated", label: "Update Terakhir", render: (client) => client.updated_at ? new Date(client.updated_at).toLocaleString("id-ID") : "-" },
          { key: "access", label: "Access Code", render: (client) => client.access_code_status ?? "-" },
          { key: "status", label: "Status", render: (client) => client.status },
          {
            key: "actions",
            label: "Aksi",
            render: (client) => (
              <Link href={`/spf/clients/${client.id}`} className="inline-flex h-8 items-center gap-1.5 border border-border px-2.5 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground hover:bg-muted">
                <Eye className="h-3.5 w-3.5" />
                Detail
              </Link>
            ),
          },
        ]}
      />
      <p className="font-mono text-[11px] text-muted-foreground">{meta.total} total</p>
    </section>
  );
}
