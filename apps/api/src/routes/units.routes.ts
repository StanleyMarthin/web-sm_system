import { parseGridQueryParams } from "@smsystem/contracts/grid";
import {
  createUnitRequestSchema,
  updateUnitRequestSchema,
} from "@smsystem/contracts/unit";
import {
  createUnitPanelRequestSchema,
  renameUnitPanelCategoryRequestSchema,
  updateUnitPanelRequestSchema,
} from "@smsystem/contracts/unit-panel";
import { permissionCodes } from "@smsystem/permissions";
import { parseJsonBody } from "@/http/request";
import { errorResponse, successResponse, withCors } from "@/http/response";
import { requireSession } from "@/middleware/auth.middleware";
import { requirePermission } from "@/middleware/permission.middleware";
import type { AuthService } from "@/services/auth/auth.service";
import type { UnitsService } from "@/services/units.service";

async function requireViewUnitsSession(
  request: Request,
  authService: AuthService,
) {
  const sessionResult = await requireSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult;
  }

  const permissionResult = requirePermission(
    request,
    sessionResult.session,
    permissionCodes.viewUnits,
  );
  if ("response" in permissionResult) {
    return permissionResult;
  }

  return { session: sessionResult.session };
}

export function canReadUnitClients(permissions: readonly string[]) {
  return (
    permissions.includes(permissionCodes.viewUnits) ||
    permissions.includes(permissionCodes.spfAdmin) ||
    permissions.includes(permissionCodes.spfPublish)
  );
}

async function requireUnitClientsSession(request: Request, authService: AuthService) {
  const sessionResult = await requireSession(request, authService);
  if ("response" in sessionResult) return sessionResult;
  const permissions = sessionResult.session.user.permissions;
  if (canReadUnitClients(permissions)) {
    return { session: sessionResult.session };
  }
  return { response: errorResponse(request, "Anda belum memiliki akses ke data client SPF.", 403, "SPF_CLIENT_FORBIDDEN") };
}

async function requireUnitDetailSession(
  request: Request,
  authService: AuthService,
) {
  const sessionResult = await requireViewUnitsSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult;
  }

  const permissionResult = requirePermission(
    request,
    sessionResult.session,
    permissionCodes.unitDetailView,
  );
  if ("response" in permissionResult) {
    return permissionResult;
  }

  return { session: sessionResult.session };
}

async function requireUnitPanelManageSession(
  request: Request,
  authService: AuthService,
) {
  const sessionResult = await requireUnitDetailSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult;
  }

  const permissionResult = requirePermission(
    request,
    sessionResult.session,
    permissionCodes.unitPanelManage,
  );
  if ("response" in permissionResult) {
    return permissionResult;
  }

  return { session: sessionResult.session };
}

async function requireUnitManageSession(
  request: Request,
  authService: AuthService,
) {
  const sessionResult = await requireViewUnitsSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult;
  }

  const permissions = sessionResult.session.user.permissions;
  if (
    sessionResult.session.user.scope.canViewAllUnits ||
    permissions.includes(permissionCodes.viewAllUnits) ||
    permissions.includes(permissionCodes.manageUsers)
    || permissions.includes(permissionCodes.unitPanelManage)
  ) {
    return { session: sessionResult.session };
  }

  return {
    response: errorResponse(
      request,
      "Akses kelola unit membutuhkan scope semua unit atau permission kelola unit.",
      403,
      "UNIT_MANAGE_FORBIDDEN",
    ),
  };
}

function mapUnitsError(request: Request, error: unknown): Response {
  if (error instanceof Error) {
    if (error.message === "SCOPE_FORBIDDEN") {
      return errorResponse(
        request,
        "Akses unit di luar scope user aktif.",
        403,
        "SCOPE_FORBIDDEN",
      );
    }

    if (error.message === "UNIT_NOT_FOUND") {
      return errorResponse(request, "Unit tidak ditemukan.", 404, "UNIT_NOT_FOUND");
    }

    if (error.message === "UNIT_ALREADY_EXISTS") {
      return errorResponse(request, "ID unit sudah terdaftar.", 409, "UNIT_ALREADY_EXISTS");
    }

    if (error.message === "UNIT_IN_USE") {
      const dependencySummary =
        "dependencySummary" in error && Array.isArray(error.dependencySummary)
          ? { dependencySummary: error.dependencySummary }
          : {};
      return errorResponse(
        request,
        "Unit masih dipakai data operasional sehingga tidak bisa dihapus.",
        409,
        "UNIT_IN_USE",
        dependencySummary,
      );
    }

    if (error.message === "UNIT_PANEL_NOT_FOUND") {
      return errorResponse(request, "Master panel tidak ditemukan.", 404, "UNIT_PANEL_NOT_FOUND");
    }

    if (error.message === "UNIT_PANEL_DUPLICATE") {
      return errorResponse(
        request,
        "Master panel dengan komponen, panel, dan nama part yang sama sudah ada.",
        409,
        "UNIT_PANEL_DUPLICATE",
      );
    }

    if (error.message === "UNIT_PANEL_PARENT_NOT_FOUND") {
      return errorResponse(request, "Parent panel tidak ditemukan.", 404, "UNIT_PANEL_PARENT_NOT_FOUND");
    }

    if (error.message === "UNIT_PANEL_PARENT_INVALID") {
      return errorResponse(
        request,
        "Part hanya boleh ditempatkan di bawah panel utama.",
        409,
        "UNIT_PANEL_PARENT_INVALID",
      );
    }

    if (error.message === "UNIT_PANEL_HAS_CHILDREN") {
      return errorResponse(
        request,
        "Panel masih memiliki part turunan. Hapus atau pindahkan turunannya dulu.",
        409,
        "UNIT_PANEL_HAS_CHILDREN",
      );
    }

    if (error.message === "UNIT_PANEL_IN_USE") {
      return errorResponse(
        request,
        "Panel/part sudah dipakai di progress unit sehingga tidak bisa dihapus.",
        409,
        "UNIT_PANEL_IN_USE",
      );
    }
  }

  return errorResponse(
    request,
    "Terjadi kesalahan internal pada units module.",
    500,
    "UNITS_MODULE_FAILED",
  );
}

export async function handleUnitsListRoute(
  request: Request,
  authService: AuthService,
  unitsService: UnitsService,
): Promise<Response> {
  const sessionResult =
    request.method === "GET"
      ? await requireViewUnitsSession(request, authService)
      : await requireUnitManageSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    if (request.method === "POST") {
      const body = await parseJsonBody(request, createUnitRequestSchema);
      if (!body.success) {
        return withCors(request, body.response);
      }

      const unit = await unitsService.createUnit(sessionResult.session, body.data);
      return successResponse(request, "Unit berhasil dibuat.", { unit }, { status: 201 });
    }

    const query = parseGridQueryParams(new URL(request.url).searchParams);
    const result = await unitsService.listUnits(sessionResult.session, query);

    return withCors(
      request,
      Response.json({
        success: true,
        message: "Unit board ready",
        data: result.data,
        meta: result.meta,
        query: result.query,
      }),
    );
  } catch (error) {
    return mapUnitsError(request, error);
  }
}

export async function handleUnitClientsRoute(
  request: Request,
  authService: AuthService,
  unitsService: UnitsService,
): Promise<Response> {
  const sessionResult = await requireUnitClientsSession(request, authService);
  if ("response" in sessionResult) return sessionResult.response;
  const url = new URL(request.url);
  const search = url.searchParams.get("search")?.trim().slice(0, 255) || undefined;
  const selected = url.searchParams.get("selected")?.trim().slice(0, 255) || undefined;
  try {
    const data = await unitsService.listUnitClients(sessionResult.session, { search, selected });
    return successResponse(request, "Daftar client dari unit siap.", data);
  } catch (error) {
    return mapUnitsError(request, error);
  }
}

export async function handleUnitDetailRoute(
  request: Request,
  unitId: string,
  authService: AuthService,
  unitsService: UnitsService,
): Promise<Response> {
  const sessionResult =
    request.method === "GET"
      ? await requireUnitDetailSession(request, authService)
      : await requireUnitManageSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    if (request.method === "PUT") {
      const body = await parseJsonBody(request, updateUnitRequestSchema);
      if (!body.success) {
        return withCors(request, body.response);
      }

      const unit = await unitsService.updateUnit(sessionResult.session, unitId, body.data);
      return successResponse(request, "Unit berhasil diperbarui.", { unit });
    }

    if (request.method === "DELETE") {
      const result = await unitsService.deleteUnit(sessionResult.session, unitId);
      return successResponse(request, "Unit berhasil dihapus.", result);
    }

    const summary = await unitsService.getUnitSummary(sessionResult.session, unitId);
    if (!summary) {
      return errorResponse(request, "Unit tidak ditemukan.", 404, "UNIT_NOT_FOUND");
    }

    return successResponse(request, "Unit detail ready", {
      unit: summary,
    });
  } catch (error) {
    return mapUnitsError(request, error);
  }
}

export async function handleUnitWorkspaceRoute(
  request: Request,
  unitId: string,
  authService: AuthService,
  unitsService: UnitsService,
): Promise<Response> {
  const sessionResult = await requireViewUnitsSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const workspace = await unitsService.getUnitWorkspace(sessionResult.session, unitId);
    if (!workspace) {
      return errorResponse(request, "Unit tidak ditemukan.", 404, "UNIT_NOT_FOUND");
    }

    return successResponse(request, "Unit workspace ready", workspace);
  } catch (error) {
    return mapUnitsError(request, error);
  }
}

export async function handleUnitBomRoute(
  request: Request,
  unitId: string,
  authService: AuthService,
  unitsService: UnitsService,
): Promise<Response> {
  const sessionResult = await requireUnitDetailSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const workspace = await unitsService.getUnitBom(sessionResult.session, unitId);
    if (!workspace) {
      return errorResponse(request, "Unit tidak ditemukan.", 404, "UNIT_NOT_FOUND");
    }

    return successResponse(request, "Unit BOM ready", workspace);
  } catch (error) {
    return mapUnitsError(request, error);
  }
}

export async function handleUnitPanelsRoute(
  request: Request,
  unitId: string,
  authService: AuthService,
  unitsService: UnitsService,
): Promise<Response> {
  const sessionResult =
    request.method === "GET"
      ? await requireUnitDetailSession(request, authService)
      : await requireUnitPanelManageSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    if (request.method === "GET") {
      const panels = await unitsService.getUnitPanels(sessionResult.session, unitId);
      if (!panels) {
        return errorResponse(request, "Unit tidak ditemukan.", 404, "UNIT_NOT_FOUND");
      }

      return successResponse(request, "Master panel unit ready", panels);
    }

    const body = await parseJsonBody(request, createUnitPanelRequestSchema);
    if (!body.success) {
      return withCors(request, body.response);
    }

    const record = await unitsService.createUnitPanel(sessionResult.session, unitId, body.data);
    return successResponse(request, "Master panel berhasil ditambahkan.", { record }, { status: 201 });
  } catch (error) {
    return mapUnitsError(request, error);
  }
}

export async function handleUnitPanelGeneralRoute(
  request: Request,
  authService: AuthService,
  unitsService: UnitsService,
): Promise<Response> {
  const sessionResult = await requireUnitPanelManageSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const searchParams = new URL(request.url).searchParams;
    const nodeType = searchParams.get("nodeType");
    const limit = Number(searchParams.get("limit") ?? "");
    const panels = await unitsService.getGeneralUnitPanels(sessionResult.session, {
      q: searchParams.get("q") ?? undefined,
      nodeType: nodeType === "PANEL" || nodeType === "PART" ? nodeType : undefined,
      limit: Number.isFinite(limit) && limit > 0 ? limit : undefined,
    });
    return successResponse(request, "Master panel general ready", panels);
  } catch (error) {
    return mapUnitsError(request, error);
  }
}

export async function handleUnitPanelDetailRoute(
  request: Request,
  unitId: string,
  panelId: number,
  authService: AuthService,
  unitsService: UnitsService,
): Promise<Response> {
  const sessionResult = await requireUnitPanelManageSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    if (request.method === "PUT") {
      const body = await parseJsonBody(request, updateUnitPanelRequestSchema);
      if (!body.success) {
        return withCors(request, body.response);
      }

      const record = await unitsService.updateUnitPanel(
        sessionResult.session,
        unitId,
        panelId,
        body.data,
      );
      return successResponse(request, "Master panel berhasil diperbarui.", { record });
    }

    const result = await unitsService.deleteUnitPanel(sessionResult.session, unitId, panelId);
    return successResponse(request, "Master panel berhasil dihapus.", result);
  } catch (error) {
    return mapUnitsError(request, error);
  }
}

export async function handleUnitPanelCategoryRoute(
  request: Request,
  unitId: string,
  authService: AuthService,
  unitsService: UnitsService,
): Promise<Response> {
  const sessionResult = await requireUnitPanelManageSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const body = await parseJsonBody(request, renameUnitPanelCategoryRequestSchema);
    if (!body.success) {
      return withCors(request, body.response);
    }

    const result = await unitsService.renameUnitPanelCategory(
      sessionResult.session,
      unitId,
      body.data,
    );

    if (result.updatedCount === 0) {
      return errorResponse(
        request,
        `Tidak ada panel atau part pada kategori "${body.data.fromCategory}" yang bisa diperbarui.`,
        404,
        "UNIT_PANEL_CATEGORY_NOT_FOUND",
      );
    }

    return successResponse(request, "Kategori master panel berhasil diperbarui.", result);
  } catch (error) {
    return mapUnitsError(request, error);
  }
}
