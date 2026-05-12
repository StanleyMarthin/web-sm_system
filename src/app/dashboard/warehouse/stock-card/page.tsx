// Warehouse Stock Card Page
import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { WarehouseStockCard } from "@/features/warehouse/components/warehouse-stock-card";

export default function WarehouseStockCardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <WarehouseStockCard />
    </Suspense>
  );
}
