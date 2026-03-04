// Monitoring Page — Server Component shell
import { Suspense } from "react";
import { MonitoringPageClient } from "@/features/monitoring/components/monitoring-page-client";
import { Loader2 } from "lucide-react";

function MonitoringFallback() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );
}

export default function MonitoringPage() {
  return (
    <Suspense fallback={<MonitoringFallback />}>
      <MonitoringPageClient />
    </Suspense>
  );
}
