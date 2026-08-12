"use client";

import Link from "next/link";
import { SourceCollector } from "./source-collector";
import type { SpfSource, SpfPagination } from "@/shared/api/spf-contracts";
import { PageHeader } from "@/shared/ui/compact";

interface SourceCollectorShellProps {
  sources: readonly SpfSource[];
  meta: SpfPagination;
}

export function SourceCollectorShell({
  sources,
  meta,
}: SourceCollectorShellProps) {
  return (
    <section aria-labelledby="spf-source-collector-title" className="space-y-4">
      <div className="space-y-1">
        <nav aria-label="Breadcrumb">
          <ol className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground dark:text-foreground/45">
            <li>
              <Link href="/spf/items" className="hover:underline">
                Item SPF
              </Link>
            </li>
            <li>/</li>
            <li className="text-foreground dark:text-foreground">Sumber Data</li>
          </ol>
        </nav>
        <PageHeader
          eyebrow="SPF Admin"
          title="Pengumpulan Sumber Data"
        />
      </div>

      {/* Notice Banner */}
      <div className="rounded border border-primary/20 bg-primary/5 p-3 dark:border-primary/15 dark:bg-primary/8">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-app-accent-ink font-semibold dark:text-app-accent-ink/90">
          💡 Catatan Pengumpulan Sumber
        </p>
        <p className="mt-1 text-[12px] leading-5 text-muted-foreground dark:text-foreground/75">
          Proses pengumpulan akan menyalin pekerjaan mentah dari database SMS ke dalam item SPF untuk diproses lebih lanjut. Mengumpulkan data tidak mengubah atau menghapus data asli.
        </p>
      </div>

      {/* Collector Component */}
      <SourceCollector sources={sources} meta={meta} />
    </section>
  );
}
