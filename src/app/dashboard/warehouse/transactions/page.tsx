// Warehouse Transactions Page
import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { WarehouseTransactions } from "@/features/warehouse/components/warehouse-transactions";

export default function WarehouseTransactionsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <WarehouseTransactions />
    </Suspense>
  );
}
