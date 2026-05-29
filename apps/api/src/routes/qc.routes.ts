import { parseGridQueryParams } from "@smsystem/contracts/grid";
import {
  qcFinalApproveRequestSchema,
  qcPassRequestSchema,
  qcRejectRequestSchema,
} from "@smsystem/contracts/qc";
import { permissionCodes } from "@smsystem/permissions";
import { parseJsonBody } from "@/http/request";
import { errorResponse, withCors } from "@/http/response";
import { requireSession } from "@/middleware/auth.middleware";
import { requirePermission } from "@/middleware/permission.middleware";
import type { AuthService } from "@/services/auth/auth.service";
import type { QcService } from "@/services/qc.service";

async function requireQcReadSession(request: Request, authService: AuthService) {
  const sessionResult = await requireSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult;
  }

  const permissionResult = requirePermission(
    request,
    sessionResult.session,
    permissionCodes.qcView,
  );
  if ("response" in permissionResult) {
    return permissionResult;
  }

  return {
    session: sessionResult.session,
  };
}

async function requireQcSubmitSession(request: Request, authService: AuthService) {
  const sessionResult = await requireQcReadSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult;
  }

  const permissionResult = requirePermission(
    request,
    sessionResult.session,
    permissionCodes.qcSubmit,
  );
  if ("response" in permissionResult) {
    return permissionResult;
  }

  return {
    session: sessionResult.session,
  };
}

async function requireQcValidateSession(request: Request, authService: AuthService) {
  const sessionResult = await requireQcReadSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult;
  }

  const permissionResult = requirePermission(
    request,
    sessionResult.session,
    permissionCodes.qcValidate,
  );
  if ("response" in permissionResult) {
    return permissionResult;
  }

  return {
    session: sessionResult.session,
  };
}

function mapQcError(request: Request, error: unknown): Response {
  if (error instanceof Error) {
    if (error.message === "QC_NOT_FOUND" || error.message === "FINAL_CHECKLIST_NOT_FOUND") {
      return errorResponse(request, "Data QC tidak ditemukan.", 404, error.message);
    }

    if (error.message === "FINAL_CHECKLIST_NOT_READY") {
      return errorResponse(
        request,
        "Final checklist belum siap untuk approval delivery.",
        409,
        "FINAL_CHECKLIST_NOT_READY",
      );
    }
  }

  return errorResponse(
    request,
    "Terjadi kesalahan internal pada QC center.",
    500,
    "QC_FAILED",
  );
}

export async function handleQcQueueRoute(
  request: Request,
  authService: AuthService,
  qcService: QcService,
): Promise<Response> {
  const sessionResult = await requireQcReadSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const query = parseGridQueryParams(new URL(request.url).searchParams);
    const result = await qcService.listQueue(sessionResult.session, query);

    return withCors(
      request,
      Response.json({
        success: true,
        message: "QC ready queue ready",
        data: result.data,
        meta: result.meta,
        query: result.query,
        references: result.references,
        summary: result.summary,
      }),
    );
  } catch (error) {
    return mapQcError(request, error);
  }
}

export async function handleQcReworkRoute(
  request: Request,
  authService: AuthService,
  qcService: QcService,
): Promise<Response> {
  const sessionResult = await requireQcReadSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const query = parseGridQueryParams(new URL(request.url).searchParams);
    const result = await qcService.listRework(sessionResult.session, query);

    return withCors(
      request,
      Response.json({
        success: true,
        message: "QC rework queue ready",
        data: result.data,
        meta: result.meta,
        query: result.query,
        references: result.references,
        summary: result.summary,
      }),
    );
  } catch (error) {
    return mapQcError(request, error);
  }
}

export async function handleQcRecheckRoute(
  request: Request,
  authService: AuthService,
  qcService: QcService,
): Promise<Response> {
  const sessionResult = await requireQcReadSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const query = parseGridQueryParams(new URL(request.url).searchParams);
    const result = await qcService.listRecheck(sessionResult.session, query);

    return withCors(
      request,
      Response.json({
        success: true,
        message: "QC recheck queue ready",
        data: result.data,
        meta: result.meta,
        query: result.query,
        references: result.references,
        summary: result.summary,
      }),
    );
  } catch (error) {
    return mapQcError(request, error);
  }
}

export async function handleQcDetailRoute(
  request: Request,
  coreId: string,
  authService: AuthService,
  qcService: QcService,
): Promise<Response> {
  const sessionResult = await requireQcReadSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const detail = await qcService.findDetail(sessionResult.session, coreId);
    if (!detail) {
      return errorResponse(request, "Data QC tidak ditemukan.", 404, "QC_NOT_FOUND");
    }

    return withCors(
      request,
      Response.json({
        success: true,
        message: "QC detail ready",
        data: detail,
      }),
    );
  } catch (error) {
    return mapQcError(request, error);
  }
}

export async function handleQcPassRoute(
  request: Request,
  coreId: string,
  authService: AuthService,
  qcService: QcService,
): Promise<Response> {
  const sessionResult = await requireQcSubmitSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  const bodyResult = await parseJsonBody(request, qcPassRequestSchema);
  if (!bodyResult.success) {
    return withCors(request, bodyResult.response);
  }

  try {
    const result = await qcService.pass(sessionResult.session, coreId, bodyResult.data);
    return withCors(
      request,
      Response.json({
        success: true,
        message: "QC pass berhasil disimpan.",
        data: result,
      }),
    );
  } catch (error) {
    return mapQcError(request, error);
  }
}

export async function handleQcRejectRoute(
  request: Request,
  coreId: string,
  authService: AuthService,
  qcService: QcService,
): Promise<Response> {
  const sessionResult = await requireQcSubmitSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  const bodyResult = await parseJsonBody(request, qcRejectRequestSchema);
  if (!bodyResult.success) {
    return withCors(request, bodyResult.response);
  }

  try {
    const result = await qcService.reject(sessionResult.session, coreId, bodyResult.data);
    return withCors(
      request,
      Response.json({
        success: true,
        message: "QC reject berhasil disimpan.",
        data: result,
      }),
    );
  } catch (error) {
    return mapQcError(request, error);
  }
}

export async function handleQcFinalChecklistRoute(
  request: Request,
  carId: string,
  authService: AuthService,
  qcService: QcService,
): Promise<Response> {
  const sessionResult = await requireQcReadSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const result = await qcService.getFinalChecklist(sessionResult.session, carId);
    if (!result) {
      return errorResponse(
        request,
        "Final checklist unit tidak ditemukan.",
        404,
        "FINAL_CHECKLIST_NOT_FOUND",
      );
    }

    return withCors(
      request,
      Response.json({
        success: true,
        message: "Final checklist ready",
        data: result,
      }),
    );
  } catch (error) {
    return mapQcError(request, error);
  }
}

export async function handleQcFinalChecklistApproveRoute(
  request: Request,
  carId: string,
  authService: AuthService,
  qcService: QcService,
): Promise<Response> {
  const sessionResult = await requireQcValidateSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  const bodyResult = await parseJsonBody(request, qcFinalApproveRequestSchema);
  if (!bodyResult.success) {
    return withCors(request, bodyResult.response);
  }

  try {
    const result = await qcService.approveFinalChecklist(
      sessionResult.session,
      carId,
      bodyResult.data,
    );
    return withCors(
      request,
      Response.json({
        success: true,
        message: "Final checklist delivery approved.",
        data: result,
      }),
    );
  } catch (error) {
    return mapQcError(request, error);
  }
}
