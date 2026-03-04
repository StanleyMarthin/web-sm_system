// Workload Page — Server Component shell
import { Suspense } from "react";
import { WorkloadPageClient } from "@/features/workload/components/workload-page-client";
import { Loader2 } from "lucide-react";

function WorkloadFallback() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );
}

export default function WorkloadPage() {
  return (
    <Suspense fallback={<WorkloadFallback />}>
      <WorkloadPageClient />
    </Suspense>
  );
}
