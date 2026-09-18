"use client";

import { FileText } from "lucide-react";
import Link from "next/link";
import { SectionCard } from "@/shared/ui/compact";

export function CountdownPrSection({ refWoId }: { refWoId: string | null }) {
  return (
    <SectionCard label="Purchase Request">
      <div className="flex items-start gap-2">
        <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <p className="text-[13px] text-foreground">Belum ada PR terkait countdown ini.</p>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            {refWoId
              ? `PR dicatat dari modul PR atau lewat WO ${refWoId}.`
              : "PR dicatat dari modul PR dengan unit yang sama."}
          </p>
          <Link
            href="/pr"
            className="mt-1 inline-block font-mono text-[10px] uppercase tracking-[0.08em] text-app-accent-ink underline-offset-2 hover:underline"
          >
            Buka modul PR
          </Link>
        </div>
      </div>
    </SectionCard>
  );
}
