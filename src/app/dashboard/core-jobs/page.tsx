// Core Jobs Page — Server Component shell
import { Suspense } from "react";
import { CoreJobsPageClient } from "@/features/core-jobs/components/core-jobs-page-client";
import { Loader2 } from "lucide-react";

function CoreJobsFallback() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );
}

export default function CoreJobsPage() {
  return (
    <Suspense fallback={<CoreJobsFallback />}>
      <CoreJobsPageClient />
    </Suspense>
  );
}
