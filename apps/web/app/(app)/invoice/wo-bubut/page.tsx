import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { permissionCodes } from "@smsystem/permissions";
import { BubutInvoiceShell } from "@/modules/bubut-invoice/components/bubut-invoice-shell";
import { fetchBubutInvoiceWorkOrders } from "@/shared/api/bubut-invoice";
import { fetchCurrentUser } from "@/shared/auth/server";
import { ModuleUnavailableState } from "@/shared/ui/module-unavailable-state";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function currentMonthRange() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
  return {
    from: `${year}-${month}-01`,
    to: `${year}-${month}-${String(lastDay).padStart(2, "0")}`,
  };
}

function withDefaultMonthFilter(
  searchParams: Record<string, string | string[] | undefined>,
) {
  if (searchParams.woDateFrom || searchParams.woDateTo) {
    return searchParams;
  }

  const range = currentMonthRange();
  return {
    ...searchParams,
    woDateFrom: range.from,
    woDateTo: range.to,
  };
}

export default async function InvoiceWoBubutPage({ searchParams }: PageProps) {
  const resolvedSearchParams = withDefaultMonthFilter(await searchParams);
  const requestHeaders = await headers();
  const cookieHeader = requestHeaders.get("cookie") ?? "";
  const [{ payload, status }, { user, status: userStatus }] = await Promise.all([
    fetchBubutInvoiceWorkOrders(cookieHeader, resolvedSearchParams),
    fetchCurrentUser(cookieHeader),
  ]);

  if (status === 401 || userStatus === 401) redirect("/login");
  if (status === 403 || userStatus === 403) redirect("/forbidden");

  if (!payload || !user) {
    return (
      <ModuleUnavailableState
        module="Invoice WO Bubut"
        title="Invoice WO Bubut belum bisa dimuat"
        message="Data invoice atau sesi aktif belum terbaca saat ini."
      />
    );
  }

  return (
    <BubutInvoiceShell
      rows={payload.data}
      meta={payload.meta}
      query={payload.query}
      canRelease={user.permissions.includes(permissionCodes.bubutInvoiceRelease)}
      canPrint={user.permissions.includes(permissionCodes.bubutInvoicePrint)}
    />
  );
}
