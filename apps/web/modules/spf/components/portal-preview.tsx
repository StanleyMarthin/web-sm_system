"use client";

import { useState } from "react";
import type { SpfItem, SpfPeriod } from "@/shared/api/spf-contracts";
import { SpfStatusBadge } from "./spf-status-badge";

interface PortalPreviewProps {
  period: Partial<SpfPeriod> & { id: string };
  items: readonly SpfItem[];
  adminPreview?: boolean;
}

function formatRange(period: Partial<SpfPeriod>) {
  const start = period.date_start ? new Date(period.date_start).toLocaleDateString("id-ID") : "-";
  const end = period.date_end ? new Date(period.date_end).toLocaleDateString("id-ID") : "-";
  return `${start} - ${end}`;
}

export function PortalPreview({ period, items, adminPreview = false }: PortalPreviewProps) {
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setViewport("desktop")}
            className={`h-8 border px-3 font-mono text-[11px] uppercase ${viewport === "desktop" ? "border-primary text-app-accent-ink" : "border-border text-muted-foreground"}`}
          >
            Desktop
          </button>
          <button
            type="button"
            onClick={() => setViewport("mobile")}
            className={`h-8 border px-3 font-mono text-[11px] uppercase ${viewport === "mobile" ? "border-primary text-app-accent-ink" : "border-border text-muted-foreground"}`}
          >
            Mobile
          </button>
        </div>
        {period.status ? <SpfStatusBadge status={period.status} /> : null}
      </div>

      {adminPreview ? (
        <div className="border border-primary/30 bg-primary/8 px-3 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-app-accent-ink">
          MODE PREVIEW ADMIN - laporan belum terlihat oleh client.
        </div>
      ) : null}

      <div className={`mx-auto border border-border bg-background p-4 shadow-sm dark:border-white/[0.06] ${viewport === "mobile" ? "max-w-[390px]" : "max-w-5xl"}`}>
        <header className="border-b border-border pb-4 dark:border-white/[0.06]">
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">{period.car_id || "Unit"}</p>
          <h2 className="mt-1 text-[22px] font-semibold text-foreground">{period.title || period.id}</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">{formatRange(period)}</p>
        </header>

        <div className="mt-4 space-y-3">
          {items.length === 0 ? (
            <p className="border border-dashed border-border px-3 py-6 text-center text-[13px] text-muted-foreground">
              Belum ada item INCLUDED untuk preview.
            </p>
          ) : (
            items.map((item, index) => (
              <article key={item.id} className="border border-border bg-card px-3 py-3 dark:border-white/[0.05]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-[11px] text-muted-foreground">#{index + 1} · {item.panel_name ?? item.panel ?? item.panel_id ?? "General"}</p>
                    <h3 className="mt-1 text-[15px] font-semibold text-foreground">{item.customer_description}</h3>
                  </div>
                  <span className="font-mono text-[12px] text-app-accent-ink">{item.progress}%</span>
                </div>
                <p className="mt-2 text-[13px] text-muted-foreground">{item.work_status}</p>
              </article>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
