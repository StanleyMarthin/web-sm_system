import { parseGridQueryParams } from "@smsystem/contracts/grid";
import {
  issueAssignRequestSchema,
  issueCreateRequestSchema,
  issueEscalateRequestSchema,
  issueResolveRequestSchema,
  issueWaiveRequestSchema,
} from "@smsystem/contracts/issue";
import { permissionCodes } from "@smsystem/permissions";
import { parseJsonBody } from "@/http/request";
import { errorResponse, withCors } from "@/http/response";
import { requireSession } from "@/middleware/auth.middleware";
import { requirePermission } from "@/middleware/permission.middleware";
import type { AuthService } from "@/services/auth/auth.service";
import type { IssuesService } from "@/services/issues.service";

async function requireIssueReadSession(
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
    permissionCodes.qcView,
  );
  if ("response" in permissionResult) {
    return permissionResult;
  }

  return {
    session: sessionResult.session,
  };
}

async function requireIssueSubmitSession(
  request: Request,
  authService: AuthService,
) {
  const sessionResult = await requireIssueReadSession(request, authService);
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

async function requireIssueValidateSession(
  request: Request,
  authService: AuthService,
) {
  const sessionResult = await requireIssueReadSession(request, authService);
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

function mapIssuesError(request: Request, error: unknown): Response {
  if (error instanceof Error) {
    if (error.message === "ISSUE_NOT_FOUND") {
      return errorResponse(request, "Issue tidak ditemukan.", 404, "ISSUE_NOT_FOUND");
    }

    if (error.message === "INVALID_STATUS_TRANSITION") {
      return errorResponse(
        request,
        "Transisi status issue tidak valid.",
        409,
        "INVALID_STATUS_TRANSITION",
      );
    }

    if (error.message === "ISSUES_STORAGE_NOT_READY") {
      return errorResponse(
        request,
        "Pencatatan issue belum siap di server ini.",
        503,
        "ISSUES_STORAGE_NOT_READY",
      );
    }
  }

  return errorResponse(
    request,
    "Terjadi kesalahan internal pada issue log.",
    500,
    "ISSUES_FAILED",
  );
}

export async function handleIssuesListRoute(
  request: Request,
  authService: AuthService,
  issuesService: IssuesService,
): Promise<Response> {
  const sessionResult = await requireIssueReadSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const query = parseGridQueryParams(new URL(request.url).searchParams);
    const result = await issuesService.list(sessionResult.session, query);

    return withCors(
      request,
      Response.json({
        success: true,
        message: result.storageReady ? "Daftar issue siap." : "Pencatatan issue belum siap.",
        data: result.data,
        storageReady: result.storageReady,
        meta: result.meta,
        query: result.query,
        references: result.references,
        summary: result.summary,
      }),
    );
  } catch (error) {
    return mapIssuesError(request, error);
  }
}

export async function handleIssuesUrgentRoute(
  request: Request,
  authService: AuthService,
  issuesService: IssuesService,
): Promise<Response> {
  const sessionResult = await requireIssueReadSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const result = await issuesService.listUrgent(sessionResult.session);
    return withCors(
      request,
      Response.json({
        success: true,
        message: "Urgent issues ready",
        data: result,
      }),
    );
  } catch (error) {
    return mapIssuesError(request, error);
  }
}

export async function handleIssuesDetailRoute(
  request: Request,
  issueId: string,
  authService: AuthService,
  issuesService: IssuesService,
): Promise<Response> {
  const sessionResult = await requireIssueReadSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const detail = await issuesService.findDetail(sessionResult.session, issueId);
    if (!detail) {
      return errorResponse(request, "Issue tidak ditemukan.", 404, "ISSUE_NOT_FOUND");
    }

    return withCors(
      request,
      Response.json({
        success: true,
        message: "Issue detail ready",
        data: detail,
      }),
    );
  } catch (error) {
    return mapIssuesError(request, error);
  }
}

export async function handleIssuesCreateRoute(
  request: Request,
  authService: AuthService,
  issuesService: IssuesService,
): Promise<Response> {
  const sessionResult = await requireIssueSubmitSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  const bodyResult = await parseJsonBody(request, issueCreateRequestSchema);
  if (!bodyResult.success) {
    return withCors(request, bodyResult.response);
  }

  try {
    const result = await issuesService.create(sessionResult.session, bodyResult.data);
    return withCors(
      request,
      Response.json(
        {
          success: true,
          message: "Issue berhasil dibuat.",
          data: result,
        },
        { status: 201 },
      ),
    );
  } catch (error) {
    return mapIssuesError(request, error);
  }
}

export async function handleIssuesAcknowledgeRoute(
  request: Request,
  issueId: string,
  authService: AuthService,
  issuesService: IssuesService,
): Promise<Response> {
  const sessionResult = await requireIssueValidateSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const result = await issuesService.acknowledge(sessionResult.session, issueId);
    return withCors(
      request,
      Response.json({
        success: true,
        message: "Issue acknowledged.",
        data: result,
      }),
    );
  } catch (error) {
    return mapIssuesError(request, error);
  }
}

export async function handleIssuesAssignRoute(
  request: Request,
  issueId: string,
  authService: AuthService,
  issuesService: IssuesService,
): Promise<Response> {
  const sessionResult = await requireIssueValidateSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  const bodyResult = await parseJsonBody(request, issueAssignRequestSchema);
  if (!bodyResult.success) {
    return withCors(request, bodyResult.response);
  }

  try {
    const result = await issuesService.assign(sessionResult.session, issueId, bodyResult.data);
    return withCors(
      request,
      Response.json({
        success: true,
        message: "PIC issue berhasil diassign.",
        data: result,
      }),
    );
  } catch (error) {
    return mapIssuesError(request, error);
  }
}

export async function handleIssuesStartRoute(
  request: Request,
  issueId: string,
  authService: AuthService,
  issuesService: IssuesService,
): Promise<Response> {
  const sessionResult = await requireIssueSubmitSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const result = await issuesService.start(sessionResult.session, issueId);
    return withCors(
      request,
      Response.json({
        success: true,
        message: "Issue masuk progress.",
        data: result,
      }),
    );
  } catch (error) {
    return mapIssuesError(request, error);
  }
}

export async function handleIssuesQcRecheckRoute(
  request: Request,
  issueId: string,
  authService: AuthService,
  issuesService: IssuesService,
): Promise<Response> {
  const sessionResult = await requireIssueSubmitSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const result = await issuesService.markQcRecheck(sessionResult.session, issueId);
    return withCors(
      request,
      Response.json({
        success: true,
        message: "Issue masuk QC recheck.",
        data: result,
      }),
    );
  } catch (error) {
    return mapIssuesError(request, error);
  }
}

export async function handleIssuesResolveRoute(
  request: Request,
  issueId: string,
  authService: AuthService,
  issuesService: IssuesService,
): Promise<Response> {
  const sessionResult = await requireIssueValidateSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  const bodyResult = await parseJsonBody(request, issueResolveRequestSchema);
  if (!bodyResult.success) {
    return withCors(request, bodyResult.response);
  }

  try {
    const result = await issuesService.resolve(sessionResult.session, issueId, bodyResult.data);
    return withCors(
      request,
      Response.json({
        success: true,
        message: "Issue resolved.",
        data: result,
      }),
    );
  } catch (error) {
    return mapIssuesError(request, error);
  }
}

export async function handleIssuesEscalateRoute(
  request: Request,
  issueId: string,
  authService: AuthService,
  issuesService: IssuesService,
): Promise<Response> {
  const sessionResult = await requireIssueValidateSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  const bodyResult = await parseJsonBody(request, issueEscalateRequestSchema);
  if (!bodyResult.success) {
    return withCors(request, bodyResult.response);
  }

  try {
    const result = await issuesService.escalate(sessionResult.session, issueId, bodyResult.data);
    return withCors(
      request,
      Response.json({
        success: true,
        message: "Issue escalated.",
        data: result,
      }),
    );
  } catch (error) {
    return mapIssuesError(request, error);
  }
}

export async function handleIssuesWaiveRoute(
  request: Request,
  issueId: string,
  authService: AuthService,
  issuesService: IssuesService,
): Promise<Response> {
  const sessionResult = await requireIssueValidateSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  const bodyResult = await parseJsonBody(request, issueWaiveRequestSchema);
  if (!bodyResult.success) {
    return withCors(request, bodyResult.response);
  }

  try {
    const result = await issuesService.waive(sessionResult.session, issueId, bodyResult.data);
    return withCors(
      request,
      Response.json({
        success: true,
        message: "Issue waived.",
        data: result,
      }),
    );
  } catch (error) {
    return mapIssuesError(request, error);
  }
}

export async function handleIssuesByUnitRoute(
  request: Request,
  carId: string,
  authService: AuthService,
  issuesService: IssuesService,
): Promise<Response> {
  const sessionResult = await requireIssueReadSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const result = await issuesService.listByUnit(sessionResult.session, carId);
    return withCors(
      request,
      Response.json({
        success: true,
        message: "Unit issue log ready",
        data: result,
      }),
    );
  } catch (error) {
    return mapIssuesError(request, error);
  }
}
