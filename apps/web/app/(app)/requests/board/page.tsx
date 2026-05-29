import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { fetchCurrentUser } from "@/shared/auth/server";
import { fetchWoGrid } from "@/shared/api/wo";
import { fetchPrGrid } from "@/shared/api/pr";
import { fetchVendorGrid } from "@/shared/api/vendor";
import { RequestsOutstandingShell } from "@/modules/requests/components/requests-outstanding-shell";

async function RequestsBoardPageContent() {
  const requestHeaders = await headers();
  const cookieHeader = requestHeaders.get("cookie") ?? "";

  const [
    { payload: woPayload },
    { payload: prPayload },
    { payload: vendorPayload },
    { user },
  ] = await Promise.all([
    fetchWoGrid(cookieHeader, { limit: "100", viewMode: "active" }),
    fetchPrGrid(cookieHeader, { limit: "100", viewMode: "active" }),
    fetchVendorGrid(cookieHeader, { limit: "100", viewMode: "active" }),
    fetchCurrentUser(cookieHeader),
  ]);

  if (!user) {
    redirect("/login");
  }

  const safeWoPayload = woPayload || {
    data: [],
    references: { units: [], divisions: [], statuses: [] },
    summary: { pendingApproval: 0, approvedOpen: 0, urgentCount: 0 }
  };

  const safePrPayload = prPayload || {
    data: [],
    references: { units: [], divisions: [], statuses: [], approvalStages: [], vendors: [] },
    summary: { pendingApproval: 0, huntingCount: 0, orderedCount: 0, criticalCount: 0 }
  };

  const safeVendorPayload = vendorPayload || {
    data: [],
    references: { units: [], divisions: [], statuses: [], approvalStages: [], vendors: [] },
    summary: { pendingApproval: 0, activeVendorCount: 0, overdueCount: 0, reworkCount: 0 }
  };

  return (
    <RequestsOutstandingShell
      user={user}
      woPayload={safeWoPayload}
      prPayload={safePrPayload}
      vendorPayload={safeVendorPayload}
    />
  );
}


export default function RequestsBoardPage() {
  return <RequestsBoardPageContent />;
}
