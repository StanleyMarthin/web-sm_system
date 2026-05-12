// Warehouse Master Item Page
import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { WarehouseMasterItem } from "@/features/warehouse/components/warehouse-master-item";

export default function WarehouseMasterItemPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <WarehouseMasterItem />
    </Suspense>
  );
}
