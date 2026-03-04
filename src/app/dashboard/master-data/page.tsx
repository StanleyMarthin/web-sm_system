// Master Data Page — Server Component shell
import { Suspense } from "react";
import { MasterDataPageClient } from "@/features/master-data/components/master-data-page-client";
import { Loader2 } from "lucide-react";

function MasterDataFallback() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );
}

export default function MasterDataPage() {
  return (
    <Suspense fallback={<MasterDataFallback />}>
      <MasterDataPageClient />
    </Suspense>
  );
}
