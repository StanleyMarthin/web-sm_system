import { parseGridQueryParams } from "@smsystem/contracts/grid";
import { qaUpdateInspectionRequestSchema } from "@smsystem/contracts/qa";
import { permissionCodes } from "@smsystem/permissions";
import { parseJsonBody } from "@/http/request";
import { errorResponse, withCors } from "@/http/response";
import { requireSession } from "@/middleware/auth.middleware";
import { requirePermission } from "@/middleware/permission.middleware";
import type { AuthService } from "@/services/auth/auth.service";
import type { QaService } from "@/services/qa.service";

async function requireQaReadSession(request: Request, authService: AuthService) {
  const sessionResult = await requireSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult;
  }

  const permissionResult = requirePermission(request, sessionResult.session, permissionCodes.qcView);
  if ("response" in permissionResult) {
    return permissionResult;
  }

  return { session: sessionResult.session };
}

async function requireQaUpdateSession(request: Request, authService: AuthService) {
  const sessionResult = await requireQaReadSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult;
  }

  const permissionResult = requirePermission(request, sessionResult.session, permissionCodes.qcValidate);
  if ("response" in permissionResult) {
    return permissionResult;
  }

  return { session: sessionResult.session };
}

function mapQaError(request: Request, error: unknown): Response {
  if (error instanceof Error && error.message === "QA_NOT_FOUND") {
    return errorResponse(request, "Data inspeksi QA tidak ditemukan.", 404, "QA_NOT_FOUND");
  }

  if (error instanceof Error && error.message === "QA_ANALYTICS_COLUMNS_NOT_READY") {
    return errorResponse(
      request,
      "Kolom analitik QA belum tersedia di database.",
      409,
      "QA_ANALYTICS_COLUMNS_NOT_READY",
    );
  }

  return errorResponse(request, "Terjadi kesalahan internal pada portal QA.", 500, "QA_FAILED");
}

export async function handleQaPortalRoute(
  request: Request,
  authService: AuthService,
  qaService: QaService,
): Promise<Response> {
  const sessionResult = await requireQaReadSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const query = parseGridQueryParams(new URL(request.url).searchParams);
    const result = await qaService.listPortal(sessionResult.session, query);
    return withCors(
      request,
      Response.json({
        success: true,
        message: "QA portal ready",
        data: result.data,
        meta: result.meta,
        query: result.query,
        references: result.references,
        dashboard: result.dashboard,
      }),
    );
  } catch (error) {
    return mapQaError(request, error);
  }
}

export async function handleQaInspectionUpdateRoute(
  request: Request,
  qcId: string,
  authService: AuthService,
  qaService: QaService,
): Promise<Response> {
  const sessionResult = await requireQaUpdateSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  const bodyResult = await parseJsonBody(request, qaUpdateInspectionRequestSchema);
  if (!bodyResult.success) {
    return withCors(request, bodyResult.response);
  }

  try {
    const updated = await qaService.updateInspectionAnalysis(sessionResult.session, qcId, bodyResult.data);
    if (!updated) {
      return errorResponse(request, "Data inspeksi QA tidak ditemukan.", 404, "QA_NOT_FOUND");
    }

    return withCors(
      request,
      Response.json({
        success: true,
        message: "Analisa QA berhasil disimpan.",
        data: updated,
      }),
    );
  } catch (error) {
    return mapQaError(request, error);
  }
}
