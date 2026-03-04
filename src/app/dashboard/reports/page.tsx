// Reports Page — Server Component shell
import { Suspense } from "react";
import { ReportsPageClient } from "@/features/reports/components/reports-page-client";
import { Loader2 } from "lucide-react";

function ReportsFallback() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );
}

export default function ReportsPage() {
  return (
    <Suspense fallback={<ReportsFallback />}>
      <ReportsPageClient />
    </Suspense>
  );
}
