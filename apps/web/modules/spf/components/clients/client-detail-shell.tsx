"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Edit3, ExternalLink, FileText, X } from "lucide-react";
import type { SpfClient, SpfClientVehicle } from "@/shared/api/spf-contracts";
import { mutateSpf } from "@/shared/api/spf";
import { ActionButton, PageHeader, SectionCard } from "@/shared/ui/compact";
import { useSweetAlert } from "@/shared/ui/sweet-alert";
import { SpfDataTable } from "../spf-data-table";
import { ClientAccessShareTab } from "../url-generator-shell";

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) : "-";
}

function accessLabel(value?: string | null) {
  return value === "SET" ? "Sudah diatur" : "Belum diatur";
}

function unitName(vehicle: SpfClientVehicle) {
  return vehicle.car_name?.trim() || vehicle.display_name?.trim() || "Nama unit belum tersedia";
}

export function ClientDetailShell({
  client,
  vehicles,
  portalConfigured = true,
  canEditClient = false,
  canManageAccess = false,
  canGenerateUrl = false,
  canPreview = false,
}: {
  client: SpfClient;
  vehicles: readonly SpfClientVehicle[];
  portalConfigured?: boolean;
  canEditClient?: boolean;
  canManageAccess?: boolean;
  canGenerateUrl?: boolean;
  canPreview?: boolean;
}) {
  const router = useRouter();
  const sweetAlert = useSweetAlert();
  const { alertElement, notifyError, notifySuccess } = sweetAlert;
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState<"ACTIVE" | "INACTIVE">(client.status === "ACTIVE" ? "ACTIVE" : "INACTIVE");
  const [isPending, startTransition] = useTransition();

  async function saveStatus() {
    if (status === "INACTIVE") {
      const confirmed = await sweetAlert.confirm({
        title: "Nonaktifkan akses portal?",
        description: "Client tidak dapat membuka laporan sampai portal diaktifkan kembali.",
        tone: "warning",
        confirmLabel: "Ya, nonaktifkan",
      });
      if (!confirmed) return;
    }

    startTransition(async () => {
      const result = await mutateSpf("client", { mode: "UPDATE", client_id: client.id, status });
      if (!result.success) {
        notifyError("Perubahan belum tersimpan", result.message);
        return;
      }
      setEditing(false);
      notifySuccess("Status client diperbarui", status === "ACTIVE" ? "Portal client sekarang aktif." : "Portal client sekarang dinonaktifkan.");
      router.refresh();
    });
  }

  return (
    <section className="space-y-4">
      {alertElement}
      <Link href="/spf/clients" className="font-mono text-[11px] uppercase tracking-[0.08em] text-app-accent-ink hover:underline">← Daftar Client</Link>
      <PageHeader
        eyebrow="Client dari master Unit"
        title={client.display_name}
        actions={portalConfigured && canEditClient ? (
          editing ? (
            <div className="flex gap-2">
              <ActionButton disabled={isPending} onClick={() => { setEditing(false); setStatus(client.status === "ACTIVE" ? "ACTIVE" : "INACTIVE"); }}><X className="h-3.5 w-3.5" />Batal</ActionButton>
              <ActionButton variant="primary" disabled={isPending} onClick={() => { void saveStatus(); }}><Check className="h-3.5 w-3.5" />{isPending ? "Menyimpan..." : "Simpan Perubahan"}</ActionButton>
            </div>
          ) : <ActionButton onClick={() => setEditing(true)}><Edit3 className="h-3.5 w-3.5" />Ubah Status Client</ActionButton>
        ) : undefined}
      />

      <SectionCard label="Data Client">
        <div className="grid gap-px border border-border bg-border md:grid-cols-2 xl:grid-cols-4">
          <Info label="Nama Client" value={client.display_name} hint="Mengikuti data customer pada modul Unit" />
          <Info label="Laporan Terakhir" value={client.last_report_title ?? "Belum ada laporan terbit"} hint={formatDate(client.last_report_at)} />
          <Info label="Akses Portal" value={portalConfigured ? accessLabel(client.access_code_status) : "Belum disiapkan"} hint={portalConfigured ? `Diperbarui ${formatDate(client.updated_at)}` : "Profil portal belum terhubung"} />
          <div className="bg-card p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Status Portal</p>
            {editing ? (
              <select value={status} onChange={(event) => setStatus(event.target.value as "ACTIVE" | "INACTIVE")} className="mt-2 h-9 w-full border border-border bg-background px-3 text-[13px] text-foreground outline-none focus:border-primary/55">
                <option value="ACTIVE">Aktif</option>
                <option value="INACTIVE">Nonaktif</option>
              </select>
            ) : <p className="mt-1 text-[13px] font-medium text-foreground">{portalConfigured ? client.status === "ACTIVE" ? "Aktif" : "Nonaktif" : "Portal belum disiapkan"}</p>}
          </div>
        </div>
      </SectionCard>

      {portalConfigured ? (
        <ClientAccessShareTab client={client} canGenerateUrl={canGenerateUrl} canManageAccess={canManageAccess} canPreview={canPreview} />
      ) : (
        <div className="border border-primary/20 bg-primary/5 p-3 text-[12px] text-muted-foreground">
          Client ini sudah ada di modul Unit. Profil akses portalnya belum terhubung, jadi link review dan access code belum dapat dibuat.
        </div>
      )}

      <SectionCard label="Unit Client" count={vehicles.length}>
        <SpfDataTable
          rows={vehicles.map((vehicle) => ({ ...vehicle, id: vehicle.car_id }))}
          minWidth={760}
          emptyMessage="Belum ada unit untuk client ini."
          columns={[
            { key: "unit", label: "Nama Unit", render: (vehicle) => <span className="font-semibold text-foreground">{unitName(vehicle)}</span> },
            { key: "period", label: "Periode Terakhir Update", render: (vehicle) => formatDate(vehicle.last_period_update) },
            { key: "status", label: "Status", render: (vehicle) => vehicle.visible ? "Aktif" : "Selesai" },
            { key: "action", label: "Aksi", render: (vehicle) => <div className="flex flex-wrap gap-3"><Link href={`/spf/periods?unit=${encodeURIComponent(unitName(vehicle))}`} className="inline-flex items-center gap-1 font-mono text-[11px] uppercase text-app-accent-ink hover:underline"><FileText className="h-3.5 w-3.5" />Periode SPF</Link><Link href={`/units/${encodeURIComponent(vehicle.car_id)}`} className="inline-flex items-center gap-1 font-mono text-[11px] uppercase text-muted-foreground hover:text-foreground"><ExternalLink className="h-3.5 w-3.5" />Buka Unit</Link></div> },
          ]}
        />
      </SectionCard>
    </section>
  );
}

function Info({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-card p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-[13px] font-medium text-foreground">{value}</p>
      {hint ? <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
