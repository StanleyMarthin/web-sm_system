// Work Order Page
import { Suspense } from "react";
import { WorkOrderPageClient } from "@/features/work-order/components/work-order-page-client";
import { Loader2 } from "lucide-react";

export default function WorkOrderPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <WorkOrderPageClient />
    </Suspense>
  );
}
