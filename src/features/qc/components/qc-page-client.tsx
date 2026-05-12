"use client";

// ============================================================
// QC Page Client — Redirect ke Operational Hub
// QC kini terintegrasi di /dashboard/operational#qc
// ============================================================

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export function QcPageClient() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard/operational");
  }, [router]);

  return (
    <div className="flex items-center justify-center py-20 gap-3">
      <Loader2 className="w-5 h-5 animate-spin text-amber-500/40" />
      <span className="text-[12px] text-white/30">Mengarahkan ke Operational Hub…</span>
    </div>
  );
}
