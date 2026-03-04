// Planning Page
import { Suspense } from "react";
import { PlanningPageClient } from "@/features/planning/components/planning-page-client";
import { Loader2 } from "lucide-react";

export default function PlanningPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <PlanningPageClient />
    </Suspense>
  );
}
