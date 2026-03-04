// Vendors Page — Server Component shell
import { Suspense } from "react";
import { VendorsPageClient } from "@/features/vendors/components/vendors-page-client";
import { Loader2 } from "lucide-react";

function VendorsFallback() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );
}

export default function VendorsPage() {
  return (
    <Suspense fallback={<VendorsFallback />}>
      <VendorsPageClient />
    </Suspense>
  );
}
