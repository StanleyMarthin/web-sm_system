// Countdown Page
import { Suspense } from "react";
import { CountdownPageClient } from "@/features/countdown/components/countdown-page-client";
import { Loader2 } from "lucide-react";

export default function CountdownPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <CountdownPageClient />
    </Suspense>
  );
}
