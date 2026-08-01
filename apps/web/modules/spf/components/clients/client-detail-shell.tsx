"use client";

import { useState } from "react";
import Link from "next/link";
import { Car, Clock, Eye, FileDown, History, Link2, Share2, UserRound } from "lucide-react";
import type { SpfClient, SpfClientVehicle, SpfPeriod, SpfTimelineEntry } from "@/shared/api/spf-contracts";
import { ActionButton, PageHeader, SectionCard } from "@/shared/ui/compact";
import { SpfDataTable } from "../spf-data-table";
import { SpfSourceBadge } from "../spf-source-badge";
import { SpfStatusBadge } from "../spf-status-badge";
import { ClientAccessShareTab } from "../url-generator-shell";

type TabKey = "overview" | "vehicles" | "timeline" | "reports" | "access";

const TABS: Array<{ key: TabKey; label: string; icon: React.ReactNode }> = [
  { key: "overview", label: "Overview", icon: <UserRound className="h-3.5 w-3.5" /> },
  { key: "vehicles", label: "Kendaraan", icon: <Car className="h-3.5 w-3.5" /> },
  { key: "timeline", label: "Timeline", icon: <Clock className="h-3.5 w-3.5" /> },
  { key: "reports", label: "Riwayat Laporan", icon: <History className="h-3.5 w-3.5" /> },
  { key: "access", label: "Akses & Berbagi", icon: <Link2 className="h-3.5 w-3.5" /> },
];

export function ClientDetailShell({
  client,
  vehicles,
  timeline,
  reports,
}: {
  client: SpfClient;
  vehicles: readonly SpfClientVehicle[];
  timeline: readonly SpfTimelineEntry[];
  reports: readonly SpfPeriod[];
}) {
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const publishedReports = reports.filter((report) => report.status === "PUBLISHED");

  return (
    <section className="space-y-5">
      <nav aria-label="Breadcrumb" className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
        <Link href="/spf/clients" className="hover:underline">Client SPF</Link>
        <span className="px-1">/</span>
        <span className="text-foreground">{client.display_name}</span>
      </nav>

      <PageHeader eyebrow={client.account_id ?? client.owner_slug ?? client.id} title={client.display_name} />

      <div className="flex flex-wrap gap-1 border-b border-border dark:border-white/[0.05]">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`inline-flex h-10 items-center gap-1.5 border-x border-t px-3 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] ${
              activeTab === tab.key ? "border-border bg-card text-app-accent-ink dark:border-white/[0.08]" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" ? (
        <SectionCard label="Overview">
          <div className="grid gap-4 md:grid-cols-4">
            <Info label="Jumlah Unit" value={String(vehicles.length)} />
            <Info label="Laporan" value={String(reports.length)} />
            <Info label="Access Code" value={client.access_code_status ?? "-"} />
            <Info label="Status" value={client.status} />
          </div>
        </SectionCard>
      ) : null}

      {activeTab === "vehicles" ? (
        <SectionCard label="Kendaraan" count={vehicles.length}>
          <SpfDataTable
            rows={vehicles.map((vehicle) => ({ ...vehicle, id: vehicle.car_id }))}
            minWidth={900}
            emptyMessage="Belum ada kendaraan terhubung ke client ini."
            columns={[
              {
                key: "unit",
                label: "Unit",
                render: (vehicle) => (
                  <Link href={`/units/${encodeURIComponent(vehicle.car_id)}`} className="font-mono text-[12px] font-semibold text-foreground hover:text-app-accent-ink hover:underline">
                    {vehicle.car_id}
                  </Link>
                ),
              },
              { key: "name", label: "Nama Tampilan", render: (vehicle) => vehicle.display_name ?? vehicle.car_name ?? "-" },
              { key: "source", label: "Sumber", render: (vehicle) => <SpfSourceBadge value={vehicle.source_type} /> },
              { key: "visible", label: "Visibility", render: (vehicle) => vehicle.visible ? "Visible" : "Hidden" },
              { key: "order", label: "Urutan", render: (vehicle) => vehicle.display_order },
              { key: "updated", label: "Update Terakhir", render: (vehicle) => vehicle.updated_at ? new Date(vehicle.updated_at).toLocaleString("id-ID") : "-" },
            ]}
          />
        </SectionCard>
      ) : null}

      {activeTab === "timeline" ? (
        <SectionCard label="Timeline" count={timeline.length}>
          <SpfDataTable
            rows={timeline.map((entry) => ({ ...entry, id: entry.id }))}
            minWidth={760}
            emptyMessage="Belum ada timeline client."
            columns={[
              { key: "type", label: "Tipe", render: (entry) => entry.type },
              { key: "title", label: "Judul", render: (entry) => entry.title },
              { key: "date", label: "Tanggal", render: (entry) => entry.date ?? "-" },
              { key: "unit", label: "Unit", render: (entry) => entry.car_id ?? "-" },
              { key: "desc", label: "Deskripsi", render: (entry) => entry.description ?? "-" },
            ]}
          />
        </SectionCard>
      ) : null}

      {activeTab === "reports" ? (
        <SectionCard label="Riwayat Laporan" count={reports.length}>
          <SpfDataTable
            rows={reports}
            minWidth={980}
            emptyMessage="Belum ada riwayat laporan untuk client ini."
            columns={[
              { key: "unit", label: "Unit", render: (report) => report.car_id || "-" },
              { key: "period", label: "Periode", render: (report) => <Link href={`/spf/periods/${report.id}`} className="font-medium hover:text-app-accent-ink hover:underline">{report.title}</Link> },
              { key: "status", label: "Status", render: (report) => <SpfStatusBadge status={report.status} /> },
              { key: "published", label: "Published At", render: (report) => report.published_at ? new Date(report.published_at).toLocaleString("id-ID") : "-" },
              {
                key: "actions",
                label: "Aksi",
                render: (report) => (
                  <div className="flex flex-wrap gap-1.5">
                    <Link href={`/spf/periods/${report.id}?tab=preview`} className="inline-flex h-8 items-center gap-1 border border-border px-2.5 font-mono text-[11px] uppercase text-muted-foreground hover:bg-muted"><Eye className="h-3.5 w-3.5" />Preview</Link>
                    <Link href={`/spf/periods/${report.id}?export=1`} className="inline-flex h-8 items-center gap-1 border border-border px-2.5 font-mono text-[11px] uppercase text-muted-foreground hover:bg-muted"><FileDown className="h-3.5 w-3.5" />Export</Link>
                    {report.status === "PUBLISHED" ? <button type="button" onClick={() => setActiveTab("access")} className="inline-flex h-8 items-center gap-1 border border-border px-2.5 font-mono text-[11px] uppercase text-muted-foreground hover:bg-muted"><Share2 className="h-3.5 w-3.5" />Generate Link</button> : null}
                  </div>
                ),
              },
            ]}
          />
        </SectionCard>
      ) : null}

      {activeTab === "access" ? <ClientAccessShareTab client={client} publishedPeriods={publishedReports} /> : null}
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-[18px] text-foreground">{value}</p>
    </div>
  );
}
