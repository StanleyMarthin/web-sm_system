import { parseGridQueryParams } from "@smsystem/contracts/grid";
import { permissionCodes } from "@smsystem/permissions";
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
  const sessionResult = await requireViewUnitsSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
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

export async function handleUnitDetailRoute(
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
