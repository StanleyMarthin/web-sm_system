// Warehouse Locations Page
import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { WarehouseLocations } from "@/features/warehouse/components/warehouse-locations";

export default function WarehouseLocationsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <WarehouseLocations />
    </Suspense>
  );
}
