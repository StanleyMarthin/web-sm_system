// Approvals Page — Server Component shell
import { Suspense } from "react";
import { ApprovalsPageClient } from "@/features/approvals/components/approvals-page-client";
import { Loader2 } from "lucide-react";

function ApprovalsFallback() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );
}

export default function ApprovalsPage() {
  return (
    <Suspense fallback={<ApprovalsFallback />}>
      <ApprovalsPageClient />
    </Suspense>
  );
}
