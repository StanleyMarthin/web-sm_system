import type { PermissionCode } from "@smsystem/permissions";
import { permissionCodes } from "@smsystem/permissions";
import { hasAnyPermission, hasPermission } from "@smsystem/permissions";
import { errorResponse } from "@/http/response";
import type { AuthService } from "@/services/auth/auth.service";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface RoutePermission {
  method: HttpMethod;
  path: string;
  permission: PermissionCode;
}

interface RouteAnyPermission {
  method: HttpMethod;
  path: string;
  permissions: readonly PermissionCode[];
}

function getRoutePermissions(): readonly RoutePermission[] {
  return [
  { method: "POST", path: "/api/bubut-invoices/release", permission: permissionCodes.bubutInvoiceRelease },
  { method: "PUT", path: "/api/bubut-invoices/*", permission: permissionCodes.bubutInvoiceRelease },
  { method: "PATCH", path: "/api/bubut-invoices/*/cancel", permission: permissionCodes.bubutInvoiceCancel },
  { method: "POST", path: "/api/spk/generate", permission: permissionCodes.updatePlan },
  { method: "PATCH", path: "/api/spk/*/approve", permission: permissionCodes.updatePlan },
  { method: "PATCH", path: "/api/spk/*/reject", permission: permissionCodes.updatePlan },
  { method: "PATCH", path: "/api/spk/*/activate", permission: permissionCodes.updatePlan },
  { method: "PATCH", path: "/api/spk/*/done", permission: permissionCodes.updatePlan },
  { method: "PATCH", path: "/api/wo/*/reject", permission: permissionCodes.woReject },
  { method: "POST", path: "/api/pr", permission: permissionCodes.prCreate },
  { method: "PATCH", path: "/api/pr/*/approve", permission: permissionCodes.prApprove },
  { method: "PATCH", path: "/api/pr/*/order", permission: permissionCodes.prOrder },
  { method: "PATCH", path: "/api/pr/*/receive", permission: permissionCodes.prReceive },
  { method: "PATCH", path: "/api/pr/*/cancel", permission: permissionCodes.prOrder },
  { method: "POST", path: "/api/vendor", permission: permissionCodes.vendorCreate },
  { method: "PATCH", path: "/api/vendor/*/approve", permission: permissionCodes.vendorApprove },
  { method: "PATCH", path: "/api/vendor/*/status", permission: permissionCodes.vendorUpdateStatus },
  { method: "PATCH", path: "/api/vendor/*/receive", permission: permissionCodes.vendorReceive },
  { method: "PATCH", path: "/api/vendor/*/cancel", permission: permissionCodes.vendorUpdateStatus },
  { method: "POST", path: "/api/warehouse/request", permission: permissionCodes.warehouseRequest },
  { method: "POST", path: "/api/warehouse/approve", permission: permissionCodes.warehouseApprove },
  { method: "POST", path: "/api/warehouse/reject", permission: permissionCodes.warehouseApprove },
  { method: "POST", path: "/api/warehouse/ready", permission: permissionCodes.warehouseReady },
  { method: "POST", path: "/api/warehouse/issue", permission: permissionCodes.warehouseIssue },
  { method: "POST", path: "/api/warehouse/return", permission: permissionCodes.warehouseReturn },
  { method: "POST", path: "/api/warehouse/store", permission: permissionCodes.warehouseReturn },
  { method: "GET", path: "/api/warehouse/stock-card/references", permission: permissionCodes.warehouseStockCardView },
  { method: "POST", path: "/api/warehouse/stock-card", permission: permissionCodes.warehouseStockCardManage },
  { method: "PUT", path: "/api/warehouse/stock-card", permission: permissionCodes.warehouseStockCardManage },
  { method: "DELETE", path: "/api/warehouse/stock-card/*", permission: permissionCodes.warehouseStockCardManage },
  { method: "POST", path: "/api/warehouse/stock-card/photos", permission: permissionCodes.warehouseStockCardManage },
  { method: "POST", path: "/api/warehouse/items", permission: permissionCodes.warehouseStockCardManage },
  { method: "PUT", path: "/api/warehouse/items", permission: permissionCodes.warehouseStockCardManage },
  { method: "DELETE", path: "/api/warehouse/items/*", permission: permissionCodes.warehouseStockCardManage },
  { method: "POST", path: "/api/warehouse/storage-locations", permission: permissionCodes.warehouseLocationManage },
  { method: "PUT", path: "/api/warehouse/storage-locations", permission: permissionCodes.warehouseLocationManage },
  { method: "DELETE", path: "/api/warehouse/storage-locations/*", permission: permissionCodes.warehouseLocationManage },
  { method: "POST", path: "/api/warehouse/opname", permission: permissionCodes.warehouseStockOpnameCreate },
  { method: "POST", path: "/api/warehouse/adjustments", permission: permissionCodes.warehouseStockAdjustmentCreate },
  { method: "POST", path: "/api/qc/*/pass", permission: permissionCodes.qcSubmit },
  { method: "POST", path: "/api/qc/*/reject", permission: permissionCodes.qcSubmit },
  { method: "POST", path: "/api/qc/final-checklist/*/approve", permission: permissionCodes.qcValidate },
  { method: "PATCH", path: "/api/qa/inspections/*", permission: permissionCodes.qcValidate },
  { method: "GET", path: "/api/reports/*/export", permission: permissionCodes.reportExport },
  { method: "POST", path: "/api/planning/work-control/release-spk", permission: permissionCodes.updatePlan },
  { method: "POST", path: "/api/planning/weekly-plan/*/publish", permission: permissionCodes.updatePlan },
  { method: "POST", path: "/api/users", permission: permissionCodes.manageUsers },
  { method: "PUT", path: "/api/users/*", permission: permissionCodes.manageUsers },
  { method: "POST", path: "/api/users/*/reset-password", permission: permissionCodes.manageUsers },
  { method: "POST", path: "/api/users/*/deactivate", permission: permissionCodes.manageUsers },
  { method: "POST", path: "/api/roles", permission: permissionCodes.manageUsers },
  { method: "PUT", path: "/api/roles/*/permissions", permission: permissionCodes.manageUsers },
  { method: "PUT", path: "/api/roles/*", permission: permissionCodes.manageUsers },
  { method: "PATCH", path: "/api/roles/*", permission: permissionCodes.manageUsers },
] as const satisfies readonly RoutePermission[];
}

function getRouteAnyPermissions(): readonly RouteAnyPermission[] {
  return [
  {
    method: "PATCH",
    path: "/api/wo/*/approve",
    permissions: [
      permissionCodes.woApprove,
      permissionCodes.woApproveAdvisor,
      permissionCodes.woApprovePm,
    ],
  },
] as const satisfies readonly RouteAnyPermission[];
}

export const routePermissions = getRoutePermissions();

function splitPath(path: string): string[] {
  return path.replace(/^\/|\/$/gu, "").split("/");
}

function matchesPath(pattern: string, pathname: string): boolean {
  const patternSegments = splitPath(pattern);
  const pathSegments = splitPath(pathname);
  if (patternSegments.length !== pathSegments.length) {
    return false;
  }

  return patternSegments.every((segment, index) => {
    return segment === "*" || segment === pathSegments[index];
  });
}

function findRoutePermission(
  method: string,
  pathname: string,
): RoutePermission | RouteAnyPermission | null {
  const normalizedMethod = method.toUpperCase();
  return (
    getRoutePermissions().find((route) => {
      return route.method === normalizedMethod && matchesPath(route.path, pathname);
    }) ??
    getRouteAnyPermissions().find((route) => {
      return route.method === normalizedMethod && matchesPath(route.path, pathname);
    }) ??
    null
  );
}

export async function enforceRoutePermissionMatrix(
  request: Request,
  authService: AuthService,
): Promise<Response | null> {
  const url = new URL(request.url);
  const routePermission = findRoutePermission(request.method, url.pathname);
  if (!routePermission) {
    return null;
  }

  const session = await authService.getCurrentSession(request);
  if (!session) {
    return errorResponse(
      request,
      "Sesi tidak valid atau sudah berakhir.",
      401,
      "INVALID_SESSION",
    );
  }

  const allowed =
    "permission" in routePermission
      ? hasPermission(session.user.permissions, routePermission.permission)
      : hasAnyPermission(session.user.permissions, routePermission.permissions);

  if (allowed) {
    return null;
  }

  return errorResponse(
    request,
    "Kamu tidak memiliki izin untuk mengakses resource ini.",
    403,
    "FORBIDDEN",
  );
}
