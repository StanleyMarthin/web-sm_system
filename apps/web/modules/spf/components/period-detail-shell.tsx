"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Download, Eye, FileText, Images, ListChecks, ScrollText } from "lucide-react";
import { exportSpfPeriod } from "@/shared/api/spf";
import type { SpfItem, SpfMedia, SpfPeriod } from "@/shared/api/spf-contracts";
import type { SpfRole } from "@/shared/auth/admin-session";
import { ActionButton, PageHeader, SectionCard } from "@/shared/ui/compact";
import { useSweetAlert } from "@/shared/ui/sweet-alert";
import { PeriodWorkflowBar } from "./period-workflow-actions";
import { CuratedItemEditor } from "./item-list";
import { DocumentationManager } from "./item-media";
import { PortalPreview } from "./portal-preview";
import { AuditTimeline } from "./audit-timeline";
import { SpfStatusBadge } from "./spf-status-badge";

type TabKey = "summary" | "items" | "documentation" | "preview" | "audit";

interface PeriodDetailShellProps {
  period: Readonly<SpfPeriod>;
  items: readonly SpfItem[];
  media?: readonly SpfMedia[];
  role: SpfRole;
  editable: boolean;
}

const TABS: Array<{ key: TabKey; label: string; icon: React.ReactNode }> = [
  { key: "summary", label: "Ringkasan", icon: <FileText className="h-3.5 w-3.5" /> },
  { key: "items", label: "Isi Laporan", icon: <ListChecks className="h-3.5 w-3.5" /> },
  { key: "documentation", label: "Dokumentasi", icon: <Images className="h-3.5 w-3.5" /> },
  { key: "preview", label: "Preview Client", icon: <Eye className="h-3.5 w-3.5" /> },
  { key: "audit", label: "Audit", icon: <ScrollText className="h-3.5 w-3.5" /> },
];

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function PeriodDetailShell({ period, items, media = [], role, editable }: PeriodDetailShellProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("summary");
  const [isExporting, startExportTransition] = useTransition();
  const { alertElement, notifyError, notifySuccess } = useSweetAlert();
  const isEditable = editable && role === "ADMIN" && (period.status === "DRAFT" || period.status === "REJECTED");
  const includedItems = useMemo(
    () => items.filter((item) => item.spf_status === "INCLUDED").sort((a, b) => a.display_order - b.display_order),
    [items],
  );
  const mediaByItem = useMemo(() => {
    const map = new Map<string, SpfMedia[]>();
    for (const item of media) {
      const list = map.get(item.item_id) ?? [];
      map.set(item.item_id, [...list, item].sort((a, b) => a.display_order - b.display_order));
    }
    return map;
  }, [media]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (tab === "items" || tab === "documentation" || tab === "preview" || tab === "audit") {
      setActiveTab(tab);
    }
    if (params.get("export") === "1") {
      handleExport();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot URL action on mount
  }, []);

  function handleExport() {
    startExportTransition(async () => {
      const result = await exportSpfPeriod(period.id);
      if (!result.success) {
        notifyError("Gagal export", result.message);
        return;
      }
      downloadBlob(result.data.blob, result.data.filename);
      notifySuccess("Export berhasil", result.data.filename);
    });
  }

  return (
    <section aria-labelledby="period-detail-title" className="space-y-5">
      {alertElement}
      <nav aria-label="Breadcrumb" className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
        <Link href="/spf/periods" className="hover:underline">Periode SPF</Link>
        <span className="px-1">/</span>
        <span className="text-foreground">{period.id}</span>
      </nav>

      <PageHeader
        eyebrow={`ID ${period.id}`}
        title={period.title}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ActionButton disabled={isExporting} onClick={handleExport}>
              <Download className="h-3.5 w-3.5" />
              {isExporting ? "Export..." : "Export"}
            </ActionButton>
            {period.status === "APPROVED" ? (
              <Link href={`/spf/periods/${period.id}?tab=preview`} className="inline-flex h-9 items-center gap-1.5 border border-border px-3 font-mono text-[12px] font-medium uppercase tracking-[0.08em] text-muted-foreground hover:bg-muted">
                <Eye className="h-3.5 w-3.5" />
                Preview Web Client
              </Link>
            ) : null}
            <PeriodWorkflowBar periodId={period.id} status={period.status} role={role} />
          </div>
        }
      />

      {!isEditable ? (
        <div className="border border-primary/20 bg-primary/5 p-3 dark:border-primary/15 dark:bg-primary/8">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-app-accent-ink">Mode Read-Only ({period.status.replaceAll("_", " ")})</p>
          <p className="mt-1 text-[12px] text-muted-foreground">Perubahan isi laporan hanya tersedia saat status DRAFT atau REJECTED untuk Admin.</p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-1 border-b border-border dark:border-white/[0.05]">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`inline-flex h-10 items-center gap-1.5 border-x border-t px-3 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] ${
              activeTab === tab.key
                ? "border-border bg-card text-app-accent-ink dark:border-white/[0.08]"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "summary" ? (
        <SectionCard label="Ringkasan">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Status</p>
              <div className="mt-1"><SpfStatusBadge status={period.status} /></div>
            </div>
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Unit</p>
              <p className="mt-1 font-mono text-[13px] font-semibold text-foreground">{period.car_id || "-"}</p>
            </div>
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Rentang</p>
              <p className="mt-1 text-[13px] text-foreground">{formatDate(period.date_start)} - {formatDate(period.date_end)}</p>
            </div>
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Item</p>
              <p className="mt-1 font-mono text-[18px] text-foreground">{items.length}</p>
            </div>
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Included</p>
              <p className="mt-1 font-mono text-[18px] text-success">{includedItems.length}</p>
            </div>
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Dokumentasi</p>
              <p className="mt-1 font-mono text-[18px] text-foreground">{media.length}</p>
            </div>
          </div>
          {period.description ? <p className="mt-3 whitespace-pre-wrap text-[13px] text-muted-foreground">{period.description}</p> : null}
        </SectionCard>
      ) : null}

      {activeTab === "items" ? (
        <SectionCard label="Isi Laporan" count={items.length}>
          <CuratedItemEditor rows={items} meta={{ total: items.length, limit: Math.max(1, items.length), offset: 0, hasNextPage: false }} role={role} editable={isEditable} />
        </SectionCard>
      ) : null}

      {activeTab === "documentation" ? (
        <div className="space-y-4">
          {items.map((item) => (
            <SectionCard key={item.id} label={item.customer_description || item.id} count={(mediaByItem.get(item.id) ?? []).length}>
              <DocumentationManager itemId={item.id} media={mediaByItem.get(item.id) ?? []} editable={isEditable} />
            </SectionCard>
          ))}
        </div>
      ) : null}

      {activeTab === "preview" ? (
        <SectionCard label="Preview Client">
          <PortalPreview period={period} items={includedItems} adminPreview={period.status !== "PUBLISHED"} />
        </SectionCard>
      ) : null}

      {activeTab === "audit" ? (
        <SectionCard label="Audit">
          <AuditTimeline period={period} />
        </SectionCard>
      ) : null}
    </section>
  );
}
