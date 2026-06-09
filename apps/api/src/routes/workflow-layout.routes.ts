import {
  workflowLayoutPayloadSchema,
  type WorkflowLayoutPayload,
} from "@smsystem/contracts/workflow-layout";
import { permissionCodes } from "@smsystem/permissions";
import { parseJsonBody } from "@/http/request";
import { errorResponse, successResponse } from "@/http/response";
import { requireSession } from "@/middleware/auth.middleware";
import { requirePermission } from "@/middleware/permission.middleware";
import { getRedisClient } from "@/redis/client";
import type { AuthService } from "@/services/auth/auth.service";

const WORKFLOW_LAYOUT_KEY_PREFIX = "workflow:layout:v1";

function buildWorkflowLayoutKey(unitId: string, scopeId: string): string {
  return `${WORKFLOW_LAYOUT_KEY_PREFIX}:${encodeURIComponent(unitId)}:${encodeURIComponent(scopeId)}:shared`;
}

async function requireWorkflowLayoutReadSession(
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
    permissionCodes.unitDetailView,
  );
  if ("response" in permissionResult) {
    return permissionResult;
  }

  return { session: sessionResult.session };
}

async function requireWorkflowLayoutWriteSession(
  request: Request,
  authService: AuthService,
) {
  const sessionResult = await requireWorkflowLayoutReadSession(request, authService);
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

function parseStoredLayout(raw: string | null): WorkflowLayoutPayload | null {
  if (!raw) return null;
  const parsed = JSON.parse(raw) as unknown;
  const current = workflowLayoutPayloadSchema.safeParse(parsed);
  if (current.success) {
    return current.data;
  }

  const legacy = parsed as {
    nodes?: Array<{
      id?: unknown;
      x?: unknown;
      y?: unknown;
      width?: unknown;
      height?: unknown;
    }>;
    connections?: unknown;
    order?: unknown;
    savedAt?: unknown;
  };

  return workflowLayoutPayloadSchema.parse({
    version: 2,
    nodeLayouts: (legacy.nodes ?? []).map((node) => ({
      id: node.id,
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height,
    })),
    connections: Array.isArray(legacy.connections) ? legacy.connections : [],
    order: Array.isArray(legacy.order) ? legacy.order : [],
    savedAt: typeof legacy.savedAt === "string" ? legacy.savedAt : undefined,
  });
}

export async function handleWorkflowLayoutGetRoute(
  request: Request,
  unitId: string,
  scopeId: string,
  authService: AuthService,
): Promise<Response> {
  const sessionResult = await requireWorkflowLayoutReadSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const redis = await getRedisClient();
    const layout = parseStoredLayout(await redis.get(buildWorkflowLayoutKey(unitId, scopeId)));
    return successResponse(request, "Workflow layout ready.", { layout });
  } catch (error) {
    console.error("[workflow-layout:get]", error);
    return errorResponse(request, "Layout workflow belum bisa dimuat.", 503, "WORKFLOW_LAYOUT_LOAD_FAILED");
  }
}

export async function handleWorkflowLayoutSaveRoute(
  request: Request,
  unitId: string,
  scopeId: string,
  authService: AuthService,
): Promise<Response> {
  const sessionResult = await requireWorkflowLayoutWriteSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  const parsedBody = await parseJsonBody(request, workflowLayoutPayloadSchema);
  if (!parsedBody.success) {
    return parsedBody.response;
  }

  const layout: WorkflowLayoutPayload = {
    ...parsedBody.data,
    savedAt: new Date().toISOString(),
  };

  try {
    const redis = await getRedisClient();
    await redis.set(buildWorkflowLayoutKey(unitId, scopeId), JSON.stringify(layout));
    return successResponse(request, "Workflow layout berhasil disimpan.", { layout });
  } catch (error) {
    console.error("[workflow-layout:save]", error);
    return errorResponse(request, "Layout workflow belum bisa disimpan.", 503, "WORKFLOW_LAYOUT_SAVE_FAILED");
  }
}
