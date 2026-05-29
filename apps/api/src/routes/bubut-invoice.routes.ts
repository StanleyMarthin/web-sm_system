import {
  bubutInvoiceCancelRequestSchema,
  bubutInvoicePreviewQuerySchema,
  bubutInvoiceReleaseRequestSchema,
} from "@smsystem/contracts/bubut-invoice";
import { permissionCodes } from "@smsystem/permissions";
import { ZodError } from "zod";
import { parseJsonBody } from "@/http/request";
import { errorResponse, withCors } from "@/http/response";
import { requireSession } from "@/middleware/auth.middleware";
import { requirePermission } from "@/middleware/permission.middleware";
import type { AuthService } from "@/services/auth/auth.service";
import type { BubutInvoiceService } from "@/services/bubut-invoice.service";
import { sanitizeBubutInvoiceWorkOrderQuery } from "@/services/bubut-invoice/query";

async function requireBubutInvoiceSession(
  request: Request,
  authService: AuthService,
  permission: string,
) {
  const sessionResult = await requireSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult;
  }

  const permissionResult = requirePermission(
    request,
    sessionResult.session,
    permission,
  );
  if ("response" in permissionResult) {
    return permissionResult;
  }

  return {
    session: sessionResult.session,
  };
}

function mapBubutInvoiceError(request: Request, error: unknown): Response {
  if (error instanceof ZodError) {
    return errorResponse(request, "Payload invoice WO Bubut tidak valid.", 400, "INVALID_PAYLOAD");
  }

  if (error instanceof Error) {
    if (error.message === "BUBUT_WO_NOT_FOUND") {
      return errorResponse(request, "WO Bubut selesai tidak ditemukan.", 404, "BUBUT_WO_NOT_FOUND");
    }
    if (error.message === "BUBUT_INVOICE_NOT_FOUND") {
      return errorResponse(request, "Invoice WO Bubut tidak ditemukan.", 404, "BUBUT_INVOICE_NOT_FOUND");
    }
    if (error.message === "BUBUT_INVOICE_ALREADY_RELEASED") {
      return errorResponse(request, "Invoice aktif untuk WO dan tipe ini sudah dirilis.", 409, "BUBUT_INVOICE_ALREADY_RELEASED");
    }
    if (error.message === "BUBUT_INVOICE_INVALID_STATE") {
      return errorResponse(request, "State invoice tidak valid untuk aksi ini.", 409, "BUBUT_INVOICE_INVALID_STATE");
    }
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "ER_NO_SUCH_TABLE"
  ) {
    return errorResponse(request, "Storage invoice WO Bubut belum siap.", 503, "BUBUT_INVOICE_STORAGE_NOT_READY");
  }

  return errorResponse(request, "Terjadi kesalahan internal pada modul invoice WO Bubut.", 500, "BUBUT_INVOICE_FAILED");
}

export async function handleBubutInvoiceWorkOrdersRoute(
  request: Request,
  authService: AuthService,
  service: BubutInvoiceService,
): Promise<Response> {
  const sessionResult = await requireBubutInvoiceSession(
    request,
    authService,
    permissionCodes.bubutInvoiceView,
  );
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const query = sanitizeBubutInvoiceWorkOrderQuery(new URL(request.url).searchParams);
    const result = await service.listWorkOrders(sessionResult.session, query);
    return withCors(
      request,
      Response.json({
        success: true,
        message: "Invoice WO Bubut grid ready",
        data: result.data,
        meta: result.meta,
        query: result.query,
      }),
    );
  } catch (error) {
    return mapBubutInvoiceError(request, error);
  }
}

export async function handleBubutInvoicePreviewRoute(
  request: Request,
  authService: AuthService,
  service: BubutInvoiceService,
): Promise<Response> {
  const sessionResult = await requireBubutInvoiceSession(
    request,
    authService,
    permissionCodes.bubutInvoiceView,
  );
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const url = new URL(request.url);
    const query = bubutInvoicePreviewQuerySchema.parse({
      sourceWoId: url.searchParams.get("sourceWoId"),
      invoiceType: url.searchParams.get("invoiceType"),
      salesInvoiceDate: url.searchParams.get("salesInvoiceDate") ?? undefined,
      poNo: url.searchParams.get("poNo"),
      poDate: url.searchParams.get("poDate"),
      roundingStep: Number.parseInt(url.searchParams.get("roundingStep") ?? "1000", 10),
    });
    const preview = await service.buildInvoicePreview(sessionResult.session, query);
    return withCors(
      request,
      Response.json({
        success: true,
        message: "Preview invoice WO Bubut ready",
        data: preview,
      }),
    );
  } catch (error) {
    return mapBubutInvoiceError(request, error);
  }
}

export async function handleBubutInvoiceReleaseRoute(
  request: Request,
  authService: AuthService,
  service: BubutInvoiceService,
): Promise<Response> {
  const sessionResult = await requireBubutInvoiceSession(
    request,
    authService,
    permissionCodes.bubutInvoiceRelease,
  );
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const body = await parseJsonBody(request, bubutInvoiceReleaseRequestSchema);
    if (!body.success) {
      return withCors(request, body.response);
    }
    const input = body.data;
    const result = await service.releaseInvoice(sessionResult.session, input);
    return withCors(
      request,
      Response.json({
        success: true,
        message: "Invoice WO Bubut berhasil dirilis",
        data: result,
      }),
    );
  } catch (error) {
    return mapBubutInvoiceError(request, error);
  }
}

export async function handleBubutInvoiceDetailRoute(
  request: Request,
  invoiceId: number,
  authService: AuthService,
  service: BubutInvoiceService,
): Promise<Response> {
  const sessionResult = await requireBubutInvoiceSession(
    request,
    authService,
    permissionCodes.bubutInvoiceView,
  );
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const invoice = await service.getInvoice(sessionResult.session, invoiceId);
    if (!invoice) {
      throw new Error("BUBUT_INVOICE_NOT_FOUND");
    }
    return withCors(
      request,
      Response.json({
        success: true,
        message: "Invoice WO Bubut ready",
        data: invoice,
      }),
    );
  } catch (error) {
    return mapBubutInvoiceError(request, error);
  }
}

export async function handleBubutInvoiceWorkHistoryRoute(
  request: Request,
  sourceKey: string,
  authService: AuthService,
  service: BubutInvoiceService,
): Promise<Response> {
  const sessionResult = await requireBubutInvoiceSession(
    request,
    authService,
    permissionCodes.bubutInvoiceView,
  );
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const workHistory = await service.getWorkHistory(
      sessionResult.session,
      decodeURIComponent(sourceKey),
    );
    return withCors(
      request,
      Response.json({
        success: true,
        message: "Riwayat pengerjaan WO Bubut ready",
        data: workHistory,
      }),
    );
  } catch (error) {
    return mapBubutInvoiceError(request, error);
  }
}

export async function handleBubutInvoicePrintRoute(
  request: Request,
  invoiceId: number,
  authService: AuthService,
  service: BubutInvoiceService,
): Promise<Response> {
  const sessionResult = await requireBubutInvoiceSession(
    request,
    authService,
    permissionCodes.bubutInvoicePrint,
  );
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const invoice = await service.buildPrintView(sessionResult.session, invoiceId);
    if (!invoice) {
      throw new Error("BUBUT_INVOICE_NOT_FOUND");
    }
    return withCors(
      request,
      Response.json({
        success: true,
        message: "Print invoice WO Bubut ready",
        data: invoice,
      }),
    );
  } catch (error) {
    return mapBubutInvoiceError(request, error);
  }
}

export async function handleBubutInvoiceCancelRoute(
  request: Request,
  invoiceId: number,
  authService: AuthService,
  service: BubutInvoiceService,
): Promise<Response> {
  const sessionResult = await requireBubutInvoiceSession(
    request,
    authService,
    permissionCodes.bubutInvoiceCancel,
  );
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const body = await parseJsonBody(request, bubutInvoiceCancelRequestSchema);
    if (!body.success) {
      return withCors(request, body.response);
    }
    const input = body.data;
    const result = await service.cancelInvoice(sessionResult.session, invoiceId, input);
    return withCors(
      request,
      Response.json({
        success: true,
        message: "Invoice WO Bubut dibatalkan",
        data: result,
      }),
    );
  } catch (error) {
    return mapBubutInvoiceError(request, error);
  }
}
