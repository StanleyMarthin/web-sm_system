export type PermissionCode = string;
export type PermissionPlatform = "WEB" | "MOBILE";
export type PermissionAudience = "SHARED" | "WEB" | "MOBILE";

export interface PermissionMeta {
  platforms: PermissionPlatform[];
  audience: PermissionAudience;
}

export const permissionCodes = {
  profileView: "PROFILE_VIEW",
  viewAllUnits: "view_all_units",
  viewAssignedUnits: "view_assigned_units",
  listNotifications: "LIST_NOTIFICATIONS",
  viewUnits: "VIEW_UNITS",
  listCarProgress: "LIST_CAR_PROGRESS",
  unitDetailView: "CAR_PROGRESS_DETAIL",
  viewCountdown: "VIEW_COUNTDOWN",
  viewCountdownDetail: "VIEW_COUNTDOWN_DETAIL",
  countdownSubmitApproval: "COUNTDOWN_SUBMIT_APPROVAL",
  countdownMarkQcReady: "COUNTDOWN_MARK_QC_READY",
  countdownRequestRevision: "COUNTDOWN_REQUEST_REVISION",
  updatePlan: "UPDATE_PLAN",
  createTask: "CREATE_TASK",
  reviewTask: "REVIEW_TASK",
  taskAssign: "TASK_ASSIGN",
  taskView: "TASK_VIEW",
  taskSubmit: "TASK_SUBMIT",
  taskCheckpoint: "TASK_CHECKPOINT",
  taskPending: "TASK_PENDING",
  taskBreak: "TASK_BREAK",
  taskExecute: "TASK_EXECUTE",
  uploadTicket: "UPLOAD_TICKET",
  woCreate: "WO_CREATE",
  woApprove: "WO_APPROVE",
  woApproveAdvisor: "APPROVE_WO_ADVISOR",
  woApprovePm: "APPROVE_WO_PM",
  woExtensionRequest: "WO_EXTENSION_REQUEST",
  woExtensionApprove: "WO_EXTENSION_APPROVE",
  woView: "WO_VIEW",
  woReject: "WO_REJECT",
  qcView: "QC_VIEW",
  qcSubmit: "QC_SUBMIT",
  qcValidate: "QC_VALIDATE",
  prView: "PR_VIEW",
  prCreate: "PR_CREATE",
  prApprove: "PR_APPROVE",
  wovCreate: "WOV_CREATE",
  wovUpdate: "WOV_UPDATE",
  prOrder: "PR_ORDER",
  prReceive: "PR_RECEIVE",
  vendorView: "VENDOR_VIEW",
  vendorCreate: "VENDOR_CREATE",
  vendorApprove: "VENDOR_APPROVE",
  vendorUpdateStatus: "VENDOR_UPDATE_STATUS",
  vendorReceive: "VENDOR_RECEIVE",
  warehouseView: "WAREHOUSE_VIEW",
  warehouseRequest: "WAREHOUSE_REQUEST",
  warehouseApprove: "WAREHOUSE_APPROVE",
  warehouseReady: "WAREHOUSE_READY",
  warehouseIssue: "WAREHOUSE_ISSUE",
  warehouseReturn: "WAREHOUSE_RETURN",
  warehouseStockCardView: "WAREHOUSE_STOCK_CARD_VIEW",
  warehouseStockCardManage: "WAREHOUSE_STOCK_CARD_MANAGE",
  warehouseLocationManage: "WAREHOUSE_LOCATION_MANAGE",
  warehouseStockOpnameView: "WAREHOUSE_STOCK_OPNAME_VIEW",
  warehouseStockOpnameCreate: "WAREHOUSE_STOCK_OPNAME_CREATE",
  warehouseStockAdjustmentView: "WAREHOUSE_STOCK_ADJUSTMENT_VIEW",
  warehouseStockAdjustmentCreate: "WAREHOUSE_STOCK_ADJUSTMENT_CREATE",
  galleryView: "GALLERY_VIEW",
  galleryDownload: "GALLERY_DOWNLOAD",
  galleryPhotoManage: "GALLERY_PHOTO_MANAGE",
  unitPanelManage: "unit_panel.manage",
  reportView: "REPORT_VIEW",
  reportExport: "REPORT_EXPORT",
  bubutInvoiceView: "bubut_invoice.view",
  bubutInvoiceRelease: "bubut_invoice.release",
  bubutInvoicePrint: "bubut_invoice.print",
  bubutInvoiceCancel: "bubut_invoice.cancel",
  manageUsers: "user.manage",
  spfAdmin: "spf:admin",
  spfApprove: "spf:approve",
  spfPublish: "spf:publish",
} as const;

export const permissionCatalog = Object.values(permissionCodes);

const permissionMetaCatalog: Record<string, PermissionMeta> = {
  [permissionCodes.profileView]: { platforms: ["WEB", "MOBILE"], audience: "SHARED" },
  [permissionCodes.listNotifications]: {
    platforms: ["WEB", "MOBILE"],
    audience: "SHARED",
  },
  [permissionCodes.viewAllUnits]: { platforms: ["WEB", "MOBILE"], audience: "SHARED" },
  [permissionCodes.viewAssignedUnits]: {
    platforms: ["WEB", "MOBILE"],
    audience: "SHARED",
  },
  [permissionCodes.viewUnits]: { platforms: ["WEB", "MOBILE"], audience: "SHARED" },
  [permissionCodes.listCarProgress]: {
    platforms: ["WEB", "MOBILE"],
    audience: "SHARED",
  },
  [permissionCodes.unitDetailView]: {
    platforms: ["WEB", "MOBILE"],
    audience: "SHARED",
  },
  [permissionCodes.viewCountdown]: {
    platforms: ["WEB", "MOBILE"],
    audience: "SHARED",
  },
  [permissionCodes.viewCountdownDetail]: {
    platforms: ["WEB", "MOBILE"],
    audience: "SHARED",
  },
  [permissionCodes.countdownSubmitApproval]: {
    platforms: ["MOBILE"],
    audience: "MOBILE",
  },
  [permissionCodes.countdownMarkQcReady]: {
    platforms: ["MOBILE"],
    audience: "MOBILE",
  },
  [permissionCodes.countdownRequestRevision]: {
    platforms: ["MOBILE"],
    audience: "MOBILE",
  },
  [permissionCodes.updatePlan]: { platforms: ["WEB", "MOBILE"], audience: "SHARED" },
  [permissionCodes.createTask]: { platforms: ["WEB", "MOBILE"], audience: "SHARED" },
  [permissionCodes.reviewTask]: { platforms: ["WEB", "MOBILE"], audience: "SHARED" },
  [permissionCodes.taskAssign]: { platforms: ["MOBILE"], audience: "MOBILE" },
  [permissionCodes.taskView]: { platforms: ["WEB", "MOBILE"], audience: "SHARED" },
  [permissionCodes.taskSubmit]: { platforms: ["MOBILE"], audience: "MOBILE" },
  [permissionCodes.taskCheckpoint]: {
    platforms: ["MOBILE"],
    audience: "MOBILE",
  },
  [permissionCodes.taskPending]: { platforms: ["MOBILE"], audience: "MOBILE" },
  [permissionCodes.taskBreak]: { platforms: ["MOBILE"], audience: "MOBILE" },
  [permissionCodes.taskExecute]: { platforms: ["WEB", "MOBILE"], audience: "SHARED" },
  [permissionCodes.uploadTicket]: { platforms: ["MOBILE"], audience: "MOBILE" },
  [permissionCodes.woCreate]: { platforms: ["WEB", "MOBILE"], audience: "SHARED" },
  [permissionCodes.woApprove]: { platforms: ["WEB", "MOBILE"], audience: "SHARED" },
  [permissionCodes.woApproveAdvisor]: {
    platforms: ["WEB", "MOBILE"],
    audience: "SHARED",
  },
  [permissionCodes.woApprovePm]: {
    platforms: ["WEB", "MOBILE"],
    audience: "SHARED",
  },
  [permissionCodes.woExtensionRequest]: {
    platforms: ["MOBILE"],
    audience: "MOBILE",
  },
  [permissionCodes.woExtensionApprove]: {
    platforms: ["MOBILE"],
    audience: "MOBILE",
  },
  [permissionCodes.woView]: { platforms: ["WEB", "MOBILE"], audience: "SHARED" },
  [permissionCodes.woReject]: { platforms: ["WEB", "MOBILE"], audience: "SHARED" },
  [permissionCodes.qcView]: { platforms: ["WEB", "MOBILE"], audience: "SHARED" },
  [permissionCodes.qcSubmit]: { platforms: ["WEB", "MOBILE"], audience: "SHARED" },
  [permissionCodes.qcValidate]: { platforms: ["WEB", "MOBILE"], audience: "SHARED" },
  [permissionCodes.prView]: { platforms: ["WEB", "MOBILE"], audience: "SHARED" },
  [permissionCodes.prCreate]: { platforms: ["WEB", "MOBILE"], audience: "SHARED" },
  [permissionCodes.prApprove]: { platforms: ["WEB", "MOBILE"], audience: "SHARED" },
  [permissionCodes.wovCreate]: { platforms: ["MOBILE"], audience: "MOBILE" },
  [permissionCodes.wovUpdate]: { platforms: ["MOBILE"], audience: "MOBILE" },
  [permissionCodes.prOrder]: { platforms: ["WEB"], audience: "WEB" },
  [permissionCodes.prReceive]: { platforms: ["WEB"], audience: "WEB" },
  [permissionCodes.vendorView]: { platforms: ["WEB"], audience: "WEB" },
  [permissionCodes.vendorCreate]: { platforms: ["WEB"], audience: "WEB" },
  [permissionCodes.vendorApprove]: { platforms: ["WEB"], audience: "WEB" },
  [permissionCodes.vendorUpdateStatus]: { platforms: ["WEB"], audience: "WEB" },
  [permissionCodes.vendorReceive]: { platforms: ["WEB"], audience: "WEB" },
  [permissionCodes.warehouseView]: { platforms: ["WEB"], audience: "WEB" },
  [permissionCodes.warehouseRequest]: {
    platforms: ["WEB", "MOBILE"],
    audience: "SHARED",
  },
  [permissionCodes.warehouseApprove]: {
    platforms: ["WEB", "MOBILE"],
    audience: "SHARED",
  },
  [permissionCodes.warehouseReady]: { platforms: ["WEB"], audience: "WEB" },
  [permissionCodes.warehouseIssue]: { platforms: ["WEB"], audience: "WEB" },
  [permissionCodes.warehouseReturn]: { platforms: ["WEB"], audience: "WEB" },
  [permissionCodes.warehouseStockCardView]: {
    platforms: ["WEB"],
    audience: "WEB",
  },
  [permissionCodes.warehouseStockCardManage]: {
    platforms: ["WEB"],
    audience: "WEB",
  },
  [permissionCodes.warehouseLocationManage]: {
    platforms: ["WEB"],
    audience: "WEB",
  },
  [permissionCodes.warehouseStockOpnameView]: {
    platforms: ["WEB"],
    audience: "WEB",
  },
  [permissionCodes.warehouseStockOpnameCreate]: {
    platforms: ["WEB"],
    audience: "WEB",
  },
  [permissionCodes.warehouseStockAdjustmentView]: {
    platforms: ["WEB"],
    audience: "WEB",
  },
  [permissionCodes.warehouseStockAdjustmentCreate]: {
    platforms: ["WEB"],
    audience: "WEB",
  },
  [permissionCodes.galleryView]: { platforms: ["WEB"], audience: "WEB" },
  [permissionCodes.galleryDownload]: { platforms: ["WEB"], audience: "WEB" },
  [permissionCodes.galleryPhotoManage]: { platforms: ["WEB"], audience: "WEB" },
  [permissionCodes.unitPanelManage]: { platforms: ["WEB"], audience: "WEB" },
  [permissionCodes.reportView]: { platforms: ["WEB"], audience: "WEB" },
  [permissionCodes.reportExport]: { platforms: ["WEB"], audience: "WEB" },
  [permissionCodes.bubutInvoiceView]: { platforms: ["WEB"], audience: "WEB" },
  [permissionCodes.bubutInvoiceRelease]: { platforms: ["WEB"], audience: "WEB" },
  [permissionCodes.bubutInvoicePrint]: { platforms: ["WEB"], audience: "WEB" },
  [permissionCodes.bubutInvoiceCancel]: { platforms: ["WEB"], audience: "WEB" },
  [permissionCodes.manageUsers]: { platforms: ["WEB"], audience: "WEB" },
  [permissionCodes.spfAdmin]: { platforms: ["WEB"], audience: "WEB" },
  [permissionCodes.spfApprove]: { platforms: ["WEB"], audience: "WEB" },
  [permissionCodes.spfPublish]: { platforms: ["WEB"], audience: "WEB" },
};

export function hasPermission(
  permissions: readonly string[],
  requiredPermission: PermissionCode,
): boolean {
  return permissions.includes(requiredPermission);
}

export function hasAnyPermission(
  permissions: readonly string[],
  requiredPermissions: readonly PermissionCode[],
): boolean {
  return requiredPermissions.some((requiredPermission) =>
    permissions.includes(requiredPermission),
  );
}

export function getPermissionMeta(permissionCode: string): PermissionMeta {
  return (
    permissionMetaCatalog[permissionCode] ?? {
      platforms: ["WEB", "MOBILE"],
      audience: "SHARED",
    }
  );
}
