import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { BubutInvoicePrintView } from "@/modules/bubut-invoice/components/bubut-invoice-print-view";
import { fetchBubutInvoiceDetail } from "@/shared/api/bubut-invoice";
import { ModuleUnavailableState } from "@/shared/ui/module-unavailable-state";

interface PageProps {
  params: Promise<{ invoiceId: string }>;
}

export default async function InvoiceWoBubutPrintPage({ params }: PageProps) {
  const { invoiceId } = await params;
  const numericInvoiceId = Number.parseInt(invoiceId, 10);
  if (!Number.isFinite(numericInvoiceId)) notFound();

  const requestHeaders = await headers();
  const cookieHeader = requestHeaders.get("cookie") ?? "";
  const { payload, status } = await fetchBubutInvoiceDetail(
    cookieHeader,
    numericInvoiceId,
    true,
  );

  if (status === 401) redirect("/login");
  if (status === 403) redirect("/forbidden");
  if (status === 404) notFound();

  if (!payload) {
    return (
      <ModuleUnavailableState
        module="Invoice WO Bubut"
        title="Invoice belum bisa dimuat"
        message="Snapshot invoice tidak terbaca saat ini."
      />
    );
  }

  return <BubutInvoicePrintView invoice={payload.data} />;
}
