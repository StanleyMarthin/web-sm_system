// Warehouse Dashboard Page
import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { WarehouseDashboard } from "@/features/warehouse/components/warehouse-dashboard";

export default function WarehouseDashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <WarehouseDashboard />
    </Suspense>
  );
}
