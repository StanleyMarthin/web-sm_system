import {
  createWarehouseStorageLocationSchema,
  createWarehouseStockAdjustmentSchema,
  createWarehouseStockOpnameSchema,
  createWarehouseRequestSchema,
  updateWarehouseStorageLocationSchema,
  warehouseApproveRequestSchema,
  warehouseIssueRequestSchema,
  warehouseReadyRequestSchema,
  warehouseRejectRequestSchema,
  warehouseReturnRequestSchema,
  warehouseStockCardPhotoUpdateSchema,
  warehouseStoreRequestSchema,
} from "@smsystem/contracts/warehouse";
import { permissionCodes } from "@smsystem/permissions";
import { parseJsonBody } from "@/http/request";
import { errorResponse, withCors } from "@/http/response";
import { requireSession } from "@/middleware/auth.middleware";
import { requirePermission } from "@/middleware/permission.middleware";
import type { AuthService } from "@/services/auth/auth.service";
import type { WarehouseService } from "@/services/warehouse.service";
import type { WebSession } from "@/services/auth/session.service";
import {
  sanitizeWarehouseGenericGridQuery,
  sanitizeWarehouseTransactionsQuery,
} from "@/services/warehouse/query";
import { applyDefaultDivisionIdFilter } from "@/services/grid/division-default";

function withShortSharedCache(response: Response): Response {
  response.headers.set("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
  return response;
}

async function requireWarehouseSession(
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

function mapWarehouseError(request: Request, error: unknown): Response {
  if (error instanceof Error) {
    if (error.message === "WAREHOUSE_TRANSACTION_NOT_FOUND") {
      return errorResponse(
        request,
        "Transaksi warehouse tidak ditemukan.",
        404,
        "WAREHOUSE_TRANSACTION_NOT_FOUND",
      );
    }

    if (error.message === "INVALID_UPLOAD_CONTENT_TYPE") {
      return errorResponse(
        request,
        "Tipe file upload tidak diizinkan.",
        400,
        "INVALID_UPLOAD_CONTENT_TYPE",
      );
    }

    if (error.message === "MISSING_DIVISION") {
      return errorResponse(
        request,
        "Divisi user aktif belum tersedia untuk transaksi warehouse.",
        400,
        "MISSING_DIVISION",
      );
    }

    if (error.message === "WAREHOUSE_SCOPE_DENIED") {
      return errorResponse(
        request,
        "Unit di luar scope warehouse user aktif.",
        403,
        "WAREHOUSE_SCOPE_DENIED",
      );
    }

    if (error.message === "WAREHOUSE_STOCK_CARD_SCOPE_DENIED") {
      return errorResponse(
        request,
        "Stock card di luar scope warehouse user aktif.",
        403,
        "WAREHOUSE_STOCK_CARD_SCOPE_DENIED",
      );
    }

    if (error.message === "WAREHOUSE_DIVISION_SCOPE_DENIED") {
      return errorResponse(
        request,
        "Divisi yang dipilih di luar scope user aktif.",
        403,
        "WAREHOUSE_DIVISION_SCOPE_DENIED",
      );
    }

    if (error.message === "WAREHOUSE_REQUESTER_NOT_FOUND") {
      return errorResponse(
        request,
        "Anggota divisi yang dipilih tidak ditemukan.",
        404,
        "WAREHOUSE_REQUESTER_NOT_FOUND",
      );
    }

    if (error.message === "WAREHOUSE_REQUESTER_DIVISION_MISMATCH") {
      return errorResponse(
        request,
        "PIC yang dipilih tidak berada pada divisi yang dipilih.",
        400,
        "WAREHOUSE_REQUESTER_DIVISION_MISMATCH",
      );
    }

    if (error.message === "WAREHOUSE_JOB_DIVISION_MISMATCH") {
      return errorResponse(
        request,
        "Jobdesc yang dipilih tidak berada pada divisi pengaju.",
        400,
        "WAREHOUSE_JOB_DIVISION_MISMATCH",
      );
    }

    if (error.message === "WAREHOUSE_STOCK_CARD_REQUIRED") {
      return errorResponse(
        request,
        "Pilih barang dari kartu stok sebelum mengirim pengajuan.",
        400,
        "WAREHOUSE_STOCK_CARD_REQUIRED",
      );
    }

    if (error.message === "WAREHOUSE_JOB_REQUIRED") {
      return errorResponse(
        request,
        "Pilih pekerjaan aktif sebelum mengirim pengajuan gudang.",
        400,
        "WAREHOUSE_JOB_REQUIRED",
      );
    }

    if (error.message === "WAREHOUSE_STOCK_CARD_SCOPE_DENIED") {
      return errorResponse(
        request,
        "Barang tidak sesuai dengan kartu stok unit pada pekerjaan yang dipilih.",
        403,
        "WAREHOUSE_STOCK_CARD_SCOPE_DENIED",
      );
    }

    if (error.message === "WAREHOUSE_TRANSFER_SOURCE_NOT_FOUND") {
      return errorResponse(
        request,
        "Part donor tidak ditemukan atau di luar scope unit yang bisa diakses.",
        404,
        "WAREHOUSE_TRANSFER_SOURCE_NOT_FOUND",
      );
    }

    if (error.message === "WAREHOUSE_TRANSFER_CATEGORY_INVALID") {
      return errorResponse(
        request,
        "Transfer donor hanya bisa dipakai untuk spare part.",
        400,
        "WAREHOUSE_TRANSFER_CATEGORY_INVALID",
      );
    }

    if (error.message === "WAREHOUSE_STOCK_CARD_NOT_FOUND") {
      return errorResponse(
        request,
        "Kartu stok tidak ditemukan.",
        404,
        "WAREHOUSE_STOCK_CARD_NOT_FOUND",
      );
    }

    if (error.message === "WAREHOUSE_LOCATION_NOT_FOUND") {
      return errorResponse(
        request,
        "Lokasi gudang tidak ditemukan.",
        404,
        "WAREHOUSE_LOCATION_NOT_FOUND",
      );
    }

    if (
      error.message === "WAREHOUSE_INVALID_APPROVAL_STATE" ||
      error.message === "WAREHOUSE_INVALID_READY_STATE" ||
      error.message === "WAREHOUSE_NOT_APPROVED" ||
      error.message === "WAREHOUSE_INVALID_ISSUE_STATE" ||
      error.message === "WAREHOUSE_INVALID_RETURN_STATE" ||
      error.message === "WAREHOUSE_INVALID_STORE_STATE"
    ) {
      return errorResponse(
        request,
        "State transaksi warehouse tidak valid untuk aksi ini.",
        409,
        error.message,
      );
    }
  }

  return errorResponse(
    request,
    "Terjadi kesalahan internal pada modul warehouse.",
    500,
    "WAREHOUSE_FAILED",
  );
}

export async function handleWarehouseTransactionsRoute(
  request: Request,
  authService: AuthService,
  warehouseService: WarehouseService,
): Promise<Response> {
  const sessionResult = await requireWarehouseSession(
    request,
    authService,
    permissionCodes.warehouseView,
  );
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const query = applyDefaultDivisionIdFilter(
      sessionResult.session,
      sanitizeWarehouseTransactionsQuery(new URL(request.url).searchParams),
    );
    const result = await warehouseService.listTransactions(sessionResult.session, query);
    return withCors(
      request,
      Response.json({
        success: true,
        message: "Warehouse transactions ready",
        data: result.data,
        meta: result.meta,
        references: result.references,
        query: result.query,
        summary: result.summary,
      }),
    );
  } catch (error) {
    return mapWarehouseError(request, error);
  }
}

export async function handleWarehousePendingApprovalRoute(
  request: Request,
  authService: AuthService,
  warehouseService: WarehouseService,
): Promise<Response> {
  const sessionResult = await requireWarehouseSession(
    request,
    authService,
    permissionCodes.warehouseApprove,
  );
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const rows = await warehouseService.listPendingApproval(sessionResult.session);
    return withCors(
      request,
      Response.json({
        success: true,
        message: "Warehouse pending approvals ready",
        data: rows,
      }),
    );
  } catch (error) {
    return mapWarehouseError(request, error);
  }
}

export async function handleWarehouseDashboardRoute(
  request: Request,
  authService: AuthService,
  warehouseService: WarehouseService,
): Promise<Response> {
  const sessionResult = await requireWarehouseSession(
    request,
    authService,
    permissionCodes.warehouseView,
  );
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const result = await warehouseService.getDashboard(sessionResult.session);
    return withCors(
      request,
      Response.json({
        success: true,
        message: "Warehouse dashboard ready",
        data: result,
      }),
    );
  } catch (error) {
    return mapWarehouseError(request, error);
  }
}

export async function handleWarehouseRequestReferencesRoute(
  request: Request,
  authService: AuthService,
  warehouseService: WarehouseService,
): Promise<Response> {
  const sessionResult = await requireWarehouseSession(
    request,
    authService,
    permissionCodes.warehouseRequest,
  );
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  const url = new URL(request.url);
  const date = url.searchParams.get("date")?.trim() ?? "";
  const isOvertime = url.searchParams.get("isOvertime") === "1";
  const coreId = url.searchParams.get("coreId")?.trim() ?? "";
  const search = url.searchParams.get("search")?.trim() ?? "";
  const transactionType = url.searchParams.get("transactionType")?.trim() ?? "PENGAMBILAN";
  const divisionIdRaw = url.searchParams.get("divisionId")?.trim() ?? "";
  const divisionId =
    /^\d+$/u.test(divisionIdRaw) && Number(divisionIdRaw) > 0
      ? Number(divisionIdRaw)
      : null;
  const resolvedDate =
    /^\d{4}-\d{2}-\d{2}$/u.test(date) ? date : new Date().toISOString().slice(0, 10);

  try {
    const [jobs, stockCards, employees] = await Promise.all([
      warehouseService.listRequestJobs(sessionResult.session, {
        date: resolvedDate,
        isOvertime,
        divisionId,
      }),
      coreId
        ? transactionType === "TRANSFER_PART"
          ? warehouseService.listTransferStockCards(sessionResult.session, {
              coreId,
              search,
            })
          : warehouseService.listRequestStockCards(sessionResult.session, {
              coreId,
              search,
            })
        : Promise.resolve([]),
      warehouseService.listRequestEmployees(sessionResult.session, {
        divisionId,
      }),
    ]);

    return withCors(
      request,
      withShortSharedCache(
        Response.json({
          success: true,
          message: "Referensi pengajuan warehouse siap",
          data: {
            jobs,
            stockCards,
            employees,
          },
        }),
      ),
    );
  } catch (error) {
    return mapWarehouseError(request, error);
  }
}

async function handleWarehouseGridRoute(
  request: Request,
  authService: AuthService,
  permission: string,
  fallbackSortBy: string,
  loader: (
    session: WebSession,
    query: ReturnType<typeof sanitizeWarehouseGenericGridQuery>,
  ) => Promise<{
    data: unknown[];
    meta: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
    query: ReturnType<typeof sanitizeWarehouseGenericGridQuery>;
  }>,
  cacheResponse = false,
) {
  const sessionResult = await requireWarehouseSession(request, authService, permission);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const query = applyDefaultDivisionIdFilter(
      sessionResult.session,
      sanitizeWarehouseGenericGridQuery(
        new URL(request.url).searchParams,
        fallbackSortBy,
      ),
    );
    const result = await loader(sessionResult.session, query);
    const response = Response.json({
      success: true,
      message: "Warehouse grid ready",
      data: result.data,
      meta: result.meta,
      query: result.query,
    });
    return withCors(
      request,
      cacheResponse ? withShortSharedCache(response) : response,
    );
  } catch (error) {
    return mapWarehouseError(request, error);
  }
}

export function handleWarehouseStockCardRoute(
  request: Request,
  authService: AuthService,
  warehouseService: WarehouseService,
) {
  return handleWarehouseGridRoute(
    request,
    authService,
    permissionCodes.warehouseStockCardView,
    "dateIn",
    warehouseService.listStockCard.bind(warehouseService),
  );
}

export function handleWarehouseItemsRoute(
  request: Request,
  authService: AuthService,
  warehouseService: WarehouseService,
) {
  return handleWarehouseGridRoute(
    request,
    authService,
    permissionCodes.warehouseView,
    "itemName",
    warehouseService.listItems.bind(warehouseService),
  );
}

export function handleWarehouseMaterialUsageRoute(
  request: Request,
  authService: AuthService,
  warehouseService: WarehouseService,
) {
  return handleWarehouseGridRoute(
    request,
    authService,
    permissionCodes.warehouseView,
    "usageDate",
    warehouseService.listMaterialUsage.bind(warehouseService),
  );
}

export function handleWarehouseStorageLocationsRoute(
  request: Request,
  authService: AuthService,
  warehouseService: WarehouseService,
) {
  return handleWarehouseGridRoute(
    request,
    authService,
    permissionCodes.warehouseView,
    "label",
    warehouseService.listStorageLocations.bind(warehouseService),
    true,
  );
}

async function handleWarehouseGridWithReferencesRoute(
  request: Request,
  authService: AuthService,
  permission: string,
  fallbackSortBy: string,
  loader: (
    session: WebSession,
    query: ReturnType<typeof sanitizeWarehouseGenericGridQuery>,
  ) => Promise<{
    data: unknown[];
    meta: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
    query: ReturnType<typeof sanitizeWarehouseGenericGridQuery>;
    references: unknown;
  }>,
) {
  const sessionResult = await requireWarehouseSession(request, authService, permission);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const query = applyDefaultDivisionIdFilter(
      sessionResult.session,
      sanitizeWarehouseGenericGridQuery(
        new URL(request.url).searchParams,
        fallbackSortBy,
      ),
    );
    const result = await loader(sessionResult.session, query);
    return withCors(
      request,
      Response.json({
        success: true,
        message: "Warehouse grid ready",
        data: result.data,
        meta: result.meta,
        query: result.query,
        references: result.references,
      }),
    );
  } catch (error) {
    return mapWarehouseError(request, error);
  }
}

export function handleWarehouseStockOpnameRoute(
  request: Request,
  authService: AuthService,
  warehouseService: WarehouseService,
) {
  return handleWarehouseGridWithReferencesRoute(
    request,
    authService,
    permissionCodes.warehouseStockOpnameView,
    "countedAt",
    warehouseService.listStockOpnames.bind(warehouseService),
  );
}

export function handleWarehouseStockAdjustmentRoute(
  request: Request,
  authService: AuthService,
  warehouseService: WarehouseService,
) {
  return handleWarehouseGridWithReferencesRoute(
    request,
    authService,
    permissionCodes.warehouseStockAdjustmentView,
    "createdAt",
    warehouseService.listStockAdjustments.bind(warehouseService),
  );
}

async function handleWarehouseMutationRoute<T>(
  request: Request,
  authService: AuthService,
  permission: string,
  schema: Parameters<typeof parseJsonBody<T>>[1],
  runner: (session: WebSession, data: T) => Promise<unknown>,
  message: string,
) {
  const sessionResult = await requireWarehouseSession(request, authService, permission);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  const bodyResult = await parseJsonBody(request, schema);
  if (!bodyResult.success) {
    return withCors(request, bodyResult.response);
  }

  try {
    const result = await runner(sessionResult.session, bodyResult.data);
    return withCors(
      request,
      Response.json({
        success: true,
        message,
        data: result,
      }),
    );
  } catch (error) {
    return mapWarehouseError(request, error);
  }
}

export function handleWarehouseRequestCreateRoute(
  request: Request,
  authService: AuthService,
  warehouseService: WarehouseService,
) {
  return handleWarehouseMutationRoute(
    request,
    authService,
    permissionCodes.warehouseRequest,
    createWarehouseRequestSchema,
    warehouseService.createRequest.bind(warehouseService),
    "Warehouse request berhasil dibuat.",
  );
}

export function handleWarehouseApproveRoute(
  request: Request,
  authService: AuthService,
  warehouseService: WarehouseService,
) {
  return handleWarehouseMutationRoute(
    request,
    authService,
    permissionCodes.warehouseApprove,
    warehouseApproveRequestSchema,
    warehouseService.approve.bind(warehouseService),
    "Approval warehouse berhasil diproses.",
  );
}

export function handleWarehouseRejectRoute(
  request: Request,
  authService: AuthService,
  warehouseService: WarehouseService,
) {
  return handleWarehouseMutationRoute(
    request,
    authService,
    permissionCodes.warehouseApprove,
    warehouseRejectRequestSchema,
    warehouseService.reject.bind(warehouseService),
    "Request warehouse berhasil ditolak.",
  );
}

export function handleWarehouseReadyRoute(
  request: Request,
  authService: AuthService,
  warehouseService: WarehouseService,
) {
  return handleWarehouseMutationRoute(
    request,
    authService,
    permissionCodes.warehouseReady,
    warehouseReadyRequestSchema,
    warehouseService.ready.bind(warehouseService),
    "Barang warehouse berhasil ditandai siap.",
  );
}

export function handleWarehouseIssueRoute(
  request: Request,
  authService: AuthService,
  warehouseService: WarehouseService,
) {
  return handleWarehouseMutationRoute(
    request,
    authService,
    permissionCodes.warehouseIssue,
    warehouseIssueRequestSchema,
    warehouseService.issue.bind(warehouseService),
    "Barang warehouse berhasil ditandai keluar.",
  );
}

export function handleWarehouseReturnRoute(
  request: Request,
  authService: AuthService,
  warehouseService: WarehouseService,
) {
  return handleWarehouseMutationRoute(
    request,
    authService,
    permissionCodes.warehouseReturn,
    warehouseReturnRequestSchema,
    warehouseService.returnItem.bind(warehouseService),
    "Barang warehouse berhasil dikembalikan.",
  );
}

export function handleWarehouseStoreRoute(
  request: Request,
  authService: AuthService,
  warehouseService: WarehouseService,
) {
  return handleWarehouseMutationRoute(
    request,
    authService,
    permissionCodes.warehouseReturn,
    warehouseStoreRequestSchema,
    warehouseService.storeItem.bind(warehouseService),
    "Barang warehouse berhasil ditandai tersimpan kembali.",
  );
}

export async function handleWarehouseStockCardUploadTicketRoute(
  request: Request,
  authService: AuthService,
  warehouseService: WarehouseService,
): Promise<Response> {
  const sessionResult = await requireWarehouseSession(
    request,
    authService,
    permissionCodes.warehouseStockCardManage,
  );
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const url = new URL(request.url);
    const stockCardId = url.searchParams.get("stockCardId")?.trim() ?? "";
    const filename = url.searchParams.get("filename")?.trim() ?? "";
    const contentType = url.searchParams.get("contentType")?.trim() ?? "image/jpeg";

    if (!stockCardId || !filename) {
      return errorResponse(
        request,
        "stockCardId dan filename wajib diisi.",
        400,
        "MISSING_UPLOAD_TICKET_PARAM",
      );
    }

    const ticket = await warehouseService.createStockCardUploadTicket(
      sessionResult.session,
      {
        stockCardId,
        filename,
        contentType,
      },
    );

    return withCors(
      request,
      Response.json({
        success: true,
        message: "Warehouse upload ticket ready",
        data: ticket,
      }),
    );
  } catch (error) {
    return mapWarehouseError(request, error);
  }
}

export function handleWarehouseStockCardPhotosRoute(
  request: Request,
  authService: AuthService,
  warehouseService: WarehouseService,
) {
  return handleWarehouseMutationRoute(
    request,
    authService,
    permissionCodes.warehouseStockCardManage,
    warehouseStockCardPhotoUpdateSchema,
    warehouseService.updateStockCardPhotos.bind(warehouseService),
    "Foto stock card berhasil diperbarui.",
  );
}

export function handleWarehouseStorageLocationCreateRoute(
  request: Request,
  authService: AuthService,
  warehouseService: WarehouseService,
) {
  return handleWarehouseMutationRoute(
    request,
    authService,
    permissionCodes.warehouseLocationManage,
    createWarehouseStorageLocationSchema,
    warehouseService.createStorageLocation.bind(warehouseService),
    "Lokasi gudang berhasil ditambahkan.",
  );
}

export function handleWarehouseStorageLocationUpdateRoute(
  request: Request,
  authService: AuthService,
  warehouseService: WarehouseService,
) {
  return handleWarehouseMutationRoute(
    request,
    authService,
    permissionCodes.warehouseLocationManage,
    updateWarehouseStorageLocationSchema,
    warehouseService.updateStorageLocation.bind(warehouseService),
    "Lokasi gudang berhasil diperbarui.",
  );
}

export async function handleWarehouseStorageLocationDeleteRoute(
  request: Request,
  storageLocationId: number,
  authService: AuthService,
  warehouseService: WarehouseService,
): Promise<Response> {
  const sessionResult = await requireWarehouseSession(
    request,
    authService,
    permissionCodes.warehouseLocationManage,
  );
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const result = await warehouseService.deleteStorageLocation(
      sessionResult.session,
      storageLocationId,
    );
    return withCors(
      request,
      Response.json({
        success: true,
        message: "Lokasi gudang berhasil dinonaktifkan.",
        data: result,
      }),
    );
  } catch (error) {
    return mapWarehouseError(request, error);
  }
}

export function handleWarehouseStockOpnameCreateRoute(
  request: Request,
  authService: AuthService,
  warehouseService: WarehouseService,
) {
  return handleWarehouseMutationRoute(
    request,
    authService,
    permissionCodes.warehouseStockOpnameCreate,
    createWarehouseStockOpnameSchema,
    warehouseService.createStockOpname.bind(warehouseService),
    "Stock opname berhasil disimpan.",
  );
}

export function handleWarehouseStockAdjustmentCreateRoute(
  request: Request,
  authService: AuthService,
  warehouseService: WarehouseService,
) {
  return handleWarehouseMutationRoute(
    request,
    authService,
    permissionCodes.warehouseStockAdjustmentCreate,
    createWarehouseStockAdjustmentSchema,
    warehouseService.createStockAdjustment.bind(warehouseService),
    "Penyesuaian stok berhasil disimpan.",
  );
}
