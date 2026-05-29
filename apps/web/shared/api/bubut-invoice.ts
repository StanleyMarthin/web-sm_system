import {
  bubutInvoiceCancelEnvelopeSchema,
  bubutInvoiceDetailEnvelopeSchema,
  bubutInvoicePreviewEnvelopeSchema,
  bubutInvoiceReleaseEnvelopeSchema,
  bubutInvoiceWorkHistoryEnvelopeSchema,
  bubutInvoiceWorkOrderEnvelopeSchema,
  type BubutInvoiceReleaseRequest,
  type BubutInvoiceType,
} from "@smsystem/contracts/bubut-invoice";
import { getApiBaseUrl } from "@/shared/api/config";

function toUrlSearchParams(
  searchParams: Record<string, string | string[] | undefined>,
): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === "string") {
      params.set(key, value);
      continue;
    }
    for (const item of value ?? []) {
      params.append(key, item);
    }
  }
  return params;
}

export async function fetchBubutInvoiceWorkOrders(
  cookieHeader: string,
  searchParams: Record<string, string | string[] | undefined>,
) {
  const queryString = toUrlSearchParams(searchParams).toString();
  const suffix = queryString ? `?${queryString}` : "";
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/bubut-invoices/work-orders${suffix}`, {
      headers: cookieHeader ? { cookie: cookieHeader } : undefined,
      cache: "no-store",
    });
    if (!response.ok) {
      return { payload: null, status: response.status };
    }
    return {
      payload: bubutInvoiceWorkOrderEnvelopeSchema.parse(await response.json()),
      status: response.status,
    };
  } catch {
    return { payload: null, status: 503 };
  }
}

export async function fetchBubutInvoiceDetail(
  cookieHeader: string,
  invoiceId: number,
  print = false,
) {
  try {
    const response = await fetch(
      `${getApiBaseUrl()}/api/bubut-invoices/${invoiceId}${print ? "/print" : ""}`,
      {
        headers: cookieHeader ? { cookie: cookieHeader } : undefined,
        cache: "no-store",
      },
    );
    if (!response.ok) {
      return { payload: null, status: response.status };
    }
    return {
      payload: bubutInvoiceDetailEnvelopeSchema.parse(await response.json()),
      status: response.status,
    };
  } catch {
    return { payload: null, status: 503 };
  }
}

export async function fetchBubutInvoicePreview(params: {
  sourceWoId: string;
  invoiceType: BubutInvoiceType;
  salesInvoiceDate: string;
  poNo?: string | null;
  poDate?: string | null;
  roundingStep?: number;
}) {
  const query = new URLSearchParams({
    sourceWoId: params.sourceWoId,
    invoiceType: params.invoiceType,
    salesInvoiceDate: params.salesInvoiceDate,
    roundingStep: String(params.roundingStep ?? 1000),
  });
  if (params.poNo) query.set("poNo", params.poNo);
  if (params.poDate) query.set("poDate", params.poDate);

  const response = await fetch(`/api/bubut-invoices/preview?${query.toString()}`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error("PREVIEW_FAILED");
  }
  return bubutInvoicePreviewEnvelopeSchema.parse(await response.json()).data;
}

export async function fetchBubutInvoiceWorkHistory(sourceKey: string) {
  const response = await fetch(
    `/api/wo-bubut-invoice/${encodeURIComponent(sourceKey)}/work-history`,
    {
      cache: "no-store",
    },
  );
  if (!response.ok) {
    throw new Error("WORK_HISTORY_FAILED");
  }
  return bubutInvoiceWorkHistoryEnvelopeSchema.parse(await response.json()).data;
}

export async function releaseBubutInvoice(input: BubutInvoiceReleaseRequest) {
  const response = await fetch("/api/bubut-invoices/release", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error("RELEASE_FAILED");
  }
  return bubutInvoiceReleaseEnvelopeSchema.parse(await response.json()).data;
}

export async function cancelBubutInvoice(invoiceId: number, reason: string) {
  const response = await fetch(`/api/bubut-invoices/${invoiceId}/cancel`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
  if (!response.ok) {
    throw new Error("CANCEL_FAILED");
  }
  return bubutInvoiceCancelEnvelopeSchema.parse(await response.json()).data;
}
