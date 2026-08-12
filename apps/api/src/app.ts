import { handleHealthRequest, type HealthDependencies } from "@/health/service";
import { MySqlAuthContextRepository } from "@/repositories/auth-context.repo";
import { MySqlAuditRepository } from "@/repositories/audit.repo";
import { DefaultAuditService } from "@/services/audit/audit.service";
import { DefaultAuthService, type AuthService } from "@/services/auth/auth.service";
import { RedisSessionStore } from "@/services/auth/session.service";
import { HttpSmLoginAdapter } from "@/services/auth/sm-login.adapter";
import {
  handleLoginRoute,
  handleLogoutRoute,
  handleMeRoute,
  handlePermissionsRoute,
  handleRefreshRoute,
} from "@/routes/auth.routes";
import {
  handleDashboardBootstrapRoute,
  handleDashboardSummaryRoute,
} from "@/routes/dashboard.routes";
import { preflightResponse, withSecurityHeaders } from "@/http/response";
import {
  handleUsersCreateRoute,
  handleUsersDeactivateRoute,
  handleUsersDetailRoute,
  handleUsersExportRoute,
  handleUsersListRoute,
  handleUsersResetPasswordRoute,
  handleUsersUpdateRoute,
  handleProfileAvatarUploadRoute,
  handleProfileUpdateRoute,
  handleProfilePasswordRoute,
} from "@/routes/users.routes";
import { DefaultUsersService, type UsersService } from "@/services/users.service";
import { handleImageProxyRoute } from "@/routes/proxy.routes";
import { handleNotificationsRoute } from "@/routes/notification.routes";
import {
  handlePermissionsListRoute,
  handleRolesReferencesRoute,
  handleRolePermissionsDetailRoute,
  handleRolePermissionsUpdateRoute,
  handleRolesCreateRoute,
  handleRolesListRoute,
  handleRolesUpdateRoute,
} from "@/routes/roles.routes";
import {
  handleDivisionCreateRoute,
  handleDivisionDeleteRoute,
  handleDivisionJobTypeCreateRoute,
  handleDivisionManagementListRoute,
  handleDivisionUpdateRoute,
  handleGeneralJobTypeCreateRoute,
  handleJobTypeDeleteRoute,
  handleJobTypeUpdateRoute,
} from "@/routes/division-management.routes";
import { DefaultRolesService, type RolesService } from "@/services/roles.service";
import {
  handleUnitBomRoute,
  handleUnitDetailRoute,
  handleUnitPanelCategoryRoute,
  handleUnitPanelDetailRoute,
  handleUnitPanelGeneralRoute,
  handleUnitPanelsRoute,
  handleUnitWorkspaceRoute,
  handleUnitsListRoute,
  handleUnitClientsRoute,
} from "@/routes/units.routes";
import { DefaultUnitsService, type UnitsService } from "@/services/units.service";
import {
  handleCountdownCreateRoute,
  handleCountdownDeleteRoute,
  handleCountdownDetailRoute,
  handleCountdownDownloadRoute,
  handleCountdownImportRoute,
  handleCountdownListRoute,
  handleCountdownRevisionApprovalRoute,
  handleCountdownRevisionRequestRoute,
  handleCountdownTemplateRoute,
  handleCountdownUpdateRoute,
} from "@/routes/countdown.routes";
import {
  handleJobPlanBulkCreateRoute,
  handleJobPlanCreateRoute,
  handleJobPlanDeleteRoute,
  handleJobPlanDraftDeleteRoute,
  handleJobPlanDraftSaveRoute,
  handleJobPlanDraftSubmitRoute,
  handleJobPlanExportRoute,
  handleJobPlanListRoute,
  handleJobPlanMyDivisionRoute,
  handleJobPlanPicLoadRoute,
  handleJobPlanStatusRoute,
  handleJobPlanTodayRoute,
  handleJobPlanUpdateRoute,
  handleJobPlanWorkspaceCreateRoute,
} from "@/routes/job-plan.routes";
import {
  handleWorkflowLayoutGetRoute,
  handleWorkflowLayoutSaveRoute,
} from "@/routes/workflow-layout.routes";
import {
  DefaultCountdownService,
  type CountdownService,
} from "@/services/countdown.service";
import {
  DefaultJobPlanService,
  type JobPlanService,
} from "@/services/job-plan.service";
import {
  handleSpkActivateRoute,
  handleSpkApproveRoute,
  handleSpkDraftDetailsRoute,
  handleSpkDetailRoute,
  handleSpkDoneRoute,
  handleSpkGenerateRoute,
  handleSpkItemApprovalRoute,
  handleSpkListRoute,
  handleSpkPreviewRoute,
  handleSpkRejectRoute,
  handleSpkSubmitRoute,
  handleSpkSummaryRoute,
  handleSpkTodayRoute,
} from "@/routes/spk.routes";
import {
  DefaultSpkService,
  type SpkService,
} from "@/services/spk.service";
import {
  handleWoApproveRoute,
  handleWoCreateRoute,
  handleWoDetailRoute,
  handleWoDoneRoute,
  handleWoLinkedCountdownsRoute,
  handleWoListRoute,
  handleWoMyDivisionRoute,
  handleWoPendingApprovalRoute,
  handleWoRejectRoute,
  handleWoUpdateRoute,
  handleWoUrgentRoute,
} from "@/routes/wo.routes";
import {
  DefaultWoService,
  type WoService,
} from "@/services/wo.service";
import {
  handlePrApproveRoute,
  handlePrCancelRoute,
  handlePrCreateRoute,
  handlePrCriticalRoute,
  handlePrDetailRoute,
  handlePrListRoute,
  handlePrOrderRoute,
  handlePrReceiveRoute,
  handlePrUploadTicketRoute,
  handlePrUpdateRoute,
} from "@/routes/pr.routes";
import {
  DefaultPrService,
  type PrService,
} from "@/services/pr.service";
import {
  handleCalendarDayOverrideListRoute,
  handleCalendarDayOverrideUpsertRoute,
  handleDeliveryRiskRoute,
  handleCapacityPreviewRoute,
  handleUnitEtaRoute,
  handleWeeklyConfigListRoute,
  handleWeeklyConfigUpsertRoute,
  handleWorkingDaysRoute,
} from "@/routes/calendar.routes";
import {
  DefaultCalendarService,
  type CalendarService,
} from "@/services/calendar.service";
import {
  handleWeeklyPlanAlertsRoute,
  handleWeeklyPlanDetailRoute,
  handleWeeklyPlanDivisionRoute,
  handleWeeklyPlanGapRoute,
  handleWeeklyPlanOvertimeRoute,
  handleWeeklyPlanPublishRoute,
  handleWeeklyPlanSnapshotAbsenceRoute,
  handleWeeklyPlanUnitsRoute,
  handleWeeklyPlanUpsertRoute,
} from "@/routes/planning.routes";
import { handlePlanningWorkspaceSummaryRoute } from "@/routes/planning-workspace.routes";
import {
  handleWorkControlCapacityRoute,
  handleWorkControlCreateTargetRoute,
  handleWorkControlCriticalPathSnapshotRoute,
  handleWorkControlLabourOverrideRoute,
  handleWorkControlOvertimeRecommendationListRoute,
  handleWorkControlOvertimeRecommendationRoute,
  handleWorkControlReleaseSpkRoute,
  handleWorkControlServiceIntakeRoute,
  handleWorkControlServiceTemplatesRoute,
  handleWorkControlUnitProgressRoute,
  handleWorkControlUnitsRoute,
} from "@/routes/planning-work-control.routes";
import {
  DefaultWeeklyPlanningService,
  type WeeklyPlanningService,
} from "@/services/planning.service";
import {
  DefaultPlanningWorkspaceService,
  type PlanningWorkspaceService,
} from "@/services/planning-workspace.service";
import {
  DefaultPlanningWorkControlService,
  type PlanningWorkControlService,
} from "@/services/planning-work-control.service";
import { handlePlanningEvaluationRoute } from "@/routes/planning-evaluation.routes";
import {
  DefaultPlanningEvaluationService,
  type PlanningEvaluationService,
} from "@/services/planning-evaluation.service";
import {
  handleIssuesAcknowledgeRoute,
  handleIssuesAssignRoute,
  handleIssuesByUnitRoute,
  handleIssuesCreateRoute,
  handleIssuesDetailRoute,
  handleIssuesListRoute,
  handleIssuesQcRecheckRoute,
  handleIssuesResolveRoute,
  handleIssuesStartRoute,
  handleIssuesUrgentRoute,
  handleIssuesWaiveRoute,
  handleIssuesEscalateRoute,
} from "@/routes/issues.routes";
import {
  DefaultIssuesService,
  type IssuesService,
} from "@/services/issues.service";
import {
  handleMonitoringDivisionDetailRoute,
  handleMonitoringDivisionRoute,
  handleMonitoringActualCreateRoute,
  handleMonitoringEmployeeRoute,
  handleMonitoringUnitRoute,
  handleMonitoringNoStartRoute,
  handleMonitoringNoSubmitRoute,
  handleMonitoringOvertimeRoute,
  handleMonitoringTodayRoute,
} from "@/routes/monitoring.routes";
import {
  DefaultMonitoringService,
  type MonitoringService,
} from "@/services/monitoring.service";
import {
  handleQcDetailRoute,
  handleQcFinalChecklistApproveRoute,
  handleQcFinalChecklistRoute,
  handleQcPassRoute,
  handleQcQueueRoute,
  handleQcRecheckRoute,
  handleQcRejectRoute,
  handleQcReworkRoute,
} from "@/routes/qc.routes";
import {
  DefaultQcService,
  type QcService,
} from "@/services/qc.service";
import {
  handleQaInspectionUpdateRoute,
  handleQaPortalRoute,
} from "@/routes/qa.routes";
import {
  DefaultQaService,
  type QaService,
} from "@/services/qa.service";
import {
  handleVendorApproveRoute,
  handleVendorCancelRoute,
  handleVendorCreateRoute,
  handleVendorDetailRoute,
  handleVendorListRoute,
  handleVendorReceiveRoute,
  handleVendorStatusRoute,
  handleVendorUpdateRoute,
} from "@/routes/vendor.routes";
import {
  DefaultVendorService,
  type VendorService,
} from "@/services/vendor.service";
import {
  handleWarehouseApproveRoute,
  handleWarehouseIssueRoute,
  handleWarehouseDashboardRoute,
  handleWarehouseItemCreateRoute,
  handleWarehouseItemDeleteRoute,
  handleWarehouseItemUpdateRoute,
  handleWarehouseItemsRoute,
  handleWarehouseMaterialUsageRoute,
  handleWarehousePendingApprovalRoute,
  handleWarehouseReadyRoute,
  handleWarehouseRejectRoute,
  handleWarehouseRequestCreateRoute,
  handleWarehouseRequestReferencesRoute,
  handleWarehouseReturnRoute,
  handleWarehouseStockCardCreateRoute,
  handleWarehouseStockCardDeleteRoute,
  handleWarehouseStockCardPhotosRoute,
  handleWarehouseStockCardReferencesRoute,
  handleWarehouseStockCardUploadTicketRoute,
  handleWarehouseStockCardUpdateRoute,
  handleWarehouseStorageLocationCreateRoute,
  handleWarehouseStorageLocationDeleteRoute,
  handleWarehouseStorageLocationUpdateRoute,
  handleWarehouseStockAdjustmentCreateRoute,
  handleWarehouseStockAdjustmentRoute,
  handleWarehouseStockCardRoute,
  handleWarehouseStockOpnameCreateRoute,
  handleWarehouseStockOpnameRoute,
  handleWarehouseStoreRoute,
  handleWarehouseStorageLocationsRoute,
  handleWarehouseTransactionsRoute,
} from "@/routes/warehouse.routes";
import {
  DefaultWarehouseService,
  type WarehouseService,
} from "@/services/warehouse.service";
import {
  handleReportsExportRoute,
  handleReportsGridRoute,
} from "@/routes/reports.routes";
import {
  DefaultReportsService,
  type ReportsService,
} from "@/services/reports.service";
import {
  handleBubutInvoiceCancelRoute,
  handleBubutInvoiceDetailRoute,
  handleBubutInvoicePreviewRoute,
  handleBubutInvoicePrintRoute,
  handleBubutInvoiceReleaseRoute,
  handleBubutInvoiceUpdateRoute,
  handleBubutInvoiceWorkHistoryRoute,
  handleBubutInvoiceWorkOrdersRoute,
} from "@/routes/bubut-invoice.routes";
import {
  DefaultBubutInvoiceService,
  type BubutInvoiceService,
} from "@/services/bubut-invoice.service";
import {
  handleGalleryCreatePhotoRoute,
  handleGalleryDeletePhotoRoute,
  handleGalleryListRoute,
  handleGalleryPhotosRoute,
  handleGalleryUpdatePhotoRoute,
  handleGalleryUploadTicketRoute,
} from "@/routes/gallery.routes";
import {
  DefaultGalleryService,
  type GalleryService,
} from "@/services/gallery.service";
import {
  DefaultDashboardService,
  type DashboardService,
} from "@/services/dashboard.service";
import { reportTypeSchema } from "@smsystem/contracts/reports";
import { enforceSecurityRateLimit } from "@/security/rate-limit";
import { enforceCsrfProtection } from "@/security/csrf";

function jsonResponse(body: Record<string, string>, status: number): Response {
  return withSecurityHeaders(Response.json(body, { status }));
}

export interface AppDependencies extends HealthDependencies {
  authService?: AuthService;
  usersService?: UsersService;
  rolesService?: RolesService;
  unitsService?: UnitsService;
  countdownService?: CountdownService;
  jobPlanService?: JobPlanService;
  spkService?: SpkService;
  woService?: WoService;
  prService?: PrService;
  vendorService?: VendorService;
  monitoringService?: MonitoringService;
  issuesService?: IssuesService;
  calendarService?: CalendarService;
  planningService?: WeeklyPlanningService;
  planningWorkspaceService?: PlanningWorkspaceService;
  planningWorkControlService?: PlanningWorkControlService;
  planningEvaluationService?: PlanningEvaluationService;
  qcService?: QcService;
  qaService?: QaService;
  warehouseService?: WarehouseService;
  reportsService?: ReportsService;
  bubutInvoiceService?: BubutInvoiceService;
  dashboardService?: DashboardService;
  galleryService?: GalleryService;
}

type RouteMatch = RegExpMatchArray | null;
type Handler = (
  request: Request,
  match: RouteMatch,
) => Response | Promise<Response>;

interface AppRoute {
  method: string;
  pattern: string | RegExp;
  handler: Handler;
}

function matchRoute(
  pattern: AppRoute["pattern"],
  pathname: string,
): RouteMatch | undefined {
  if (typeof pattern === "string") {
    return pattern === pathname ? null : undefined;
  }

  return pathname.match(pattern) ?? undefined;
}

export function createApiFetchHandler(dependencies: AppDependencies = {}) {
  const getAuthService = () =>
    dependencies.authService ??
    new DefaultAuthService(
      new HttpSmLoginAdapter(),
      new MySqlAuthContextRepository(),
      new RedisSessionStore(),
      new DefaultAuditService(new MySqlAuditRepository()),
    );
  const getUsersService = () => dependencies.usersService ?? new DefaultUsersService();
  const getRolesService = () => dependencies.rolesService ?? new DefaultRolesService();
  const getUnitsService = () => dependencies.unitsService ?? new DefaultUnitsService();
  const getCountdownService = () =>
    dependencies.countdownService ?? new DefaultCountdownService();
  const getJobPlanService = () =>
    dependencies.jobPlanService ?? new DefaultJobPlanService();
  const getSpkService = () => dependencies.spkService ?? new DefaultSpkService();
  const getWoService = () => dependencies.woService ?? new DefaultWoService();
  const getPrService = () => dependencies.prService ?? new DefaultPrService();
  const getVendorService = () =>
    dependencies.vendorService ?? new DefaultVendorService();
  const getMonitoringService = () =>
    dependencies.monitoringService ?? new DefaultMonitoringService();
  const getIssuesService = () => dependencies.issuesService ?? new DefaultIssuesService();
  const getCalendarService = () =>
    dependencies.calendarService ?? new DefaultCalendarService();
  const getPlanningService = () =>
    dependencies.planningService ?? new DefaultWeeklyPlanningService();
  const getPlanningWorkspaceService = () =>
    dependencies.planningWorkspaceService ?? new DefaultPlanningWorkspaceService();
  const getPlanningWorkControlService = () =>
    dependencies.planningWorkControlService ?? new DefaultPlanningWorkControlService();
  const getPlanningEvaluationService = () =>
    dependencies.planningEvaluationService ?? new DefaultPlanningEvaluationService();
  const getQcService = () => dependencies.qcService ?? new DefaultQcService();
  const getQaService = () => dependencies.qaService ?? new DefaultQaService();
  const getWarehouseService = () =>
    dependencies.warehouseService ?? new DefaultWarehouseService();
  const getReportsService = () =>
    dependencies.reportsService ?? new DefaultReportsService();
  const getBubutInvoiceService = () =>
    dependencies.bubutInvoiceService ?? new DefaultBubutInvoiceService();
  const getDashboardService = () =>
    dependencies.dashboardService ?? new DefaultDashboardService();
  const getGalleryService = () =>
    dependencies.galleryService ?? new DefaultGalleryService();

  const routes: AppRoute[] = [
    { method: "POST", pattern: "/api/auth/login", handler: (request) => handleLoginRoute(request, getAuthService()) },
    { method: "POST", pattern: "/api/auth/logout", handler: (request) => handleLogoutRoute(request, getAuthService()) },
    { method: "POST", pattern: "/api/auth/refresh", handler: (request) => handleRefreshRoute(request, getAuthService()) },
    { method: "GET", pattern: "/api/auth/me", handler: (request) => handleMeRoute(request, getAuthService()) },
    { method: "POST", pattern: "/api/profile/avatar/upload", handler: (request) => handleProfileAvatarUploadRoute(request, getAuthService()) },
    { method: "PUT", pattern: "/api/profile/me", handler: (request) => handleProfileUpdateRoute(request, getAuthService()) },
    { method: "POST", pattern: "/api/profile/password", handler: (request) => handleProfilePasswordRoute(request, getAuthService()) },
    { method: "GET", pattern: "/api/auth/permissions", handler: (request) => handlePermissionsRoute(request, getAuthService()) },
    { method: "GET", pattern: "/api/dashboard/bootstrap", handler: (request) => handleDashboardBootstrapRoute(request, getAuthService()) },
    { method: "GET", pattern: "/api/dashboard/summary", handler: (request) => handleDashboardSummaryRoute(request, getAuthService(), getDashboardService()) },
    { method: "GET", pattern: "/api/proxy/image", handler: (request) => handleImageProxyRoute(request, getAuthService()) },
    { method: "GET", pattern: "/api/notifications", handler: (request) => handleNotificationsRoute(request, getAuthService()) },
    { method: "GET", pattern: "/api/users", handler: (request) => handleUsersListRoute(request, getAuthService(), getUsersService()) },
    { method: "POST", pattern: "/api/users", handler: (request) => handleUsersCreateRoute(request, getAuthService(), getUsersService()) },
    { method: "GET", pattern: "/api/users/export", handler: (request) => handleUsersExportRoute(request, getAuthService(), getUsersService()) },
    { method: "GET", pattern: /^\/api\/users\/([^/]+)$/, handler: (request, match) => handleUsersDetailRoute(request, match![1], getAuthService(), getUsersService()) },
    { method: "PUT", pattern: /^\/api\/users\/([^/]+)$/, handler: (request, match) => handleUsersUpdateRoute(request, match![1], getAuthService(), getUsersService()) },
    { method: "POST", pattern: /^\/api\/users\/([^/]+)\/reset-password$/, handler: (request, match) => handleUsersResetPasswordRoute(request, match![1], getAuthService(), getUsersService()) },
    { method: "POST", pattern: /^\/api\/users\/([^/]+)\/deactivate$/, handler: (request, match) => handleUsersDeactivateRoute(request, match![1], getAuthService(), getUsersService()) },
    { method: "GET", pattern: "/api/roles", handler: (request) => handleRolesListRoute(request, getAuthService(), getRolesService()) },
    { method: "GET", pattern: "/api/roles/references", handler: (request) => handleRolesReferencesRoute(request, getAuthService(), getRolesService()) },
    { method: "GET", pattern: "/api/admin/divisions", handler: (request) => handleDivisionManagementListRoute(request, getAuthService()) },
    { method: "POST", pattern: "/api/admin/divisions", handler: (request) => handleDivisionCreateRoute(request, getAuthService()) },
    { method: "POST", pattern: "/api/admin/job-types", handler: (request) => handleGeneralJobTypeCreateRoute(request, getAuthService()) },
    { method: "PATCH", pattern: /^\/api\/admin\/divisions\/(\d+)$/, handler: (request, match) => handleDivisionUpdateRoute(request, Number.parseInt(match![1], 10), getAuthService()) },
    { method: "PUT", pattern: /^\/api\/admin\/divisions\/(\d+)$/, handler: (request, match) => handleDivisionUpdateRoute(request, Number.parseInt(match![1], 10), getAuthService()) },
    { method: "DELETE", pattern: /^\/api\/admin\/divisions\/(\d+)$/, handler: (request, match) => handleDivisionDeleteRoute(request, Number.parseInt(match![1], 10), getAuthService()) },
    { method: "POST", pattern: /^\/api\/admin\/divisions\/(\d+)\/job-types$/, handler: (request, match) => handleDivisionJobTypeCreateRoute(request, Number.parseInt(match![1], 10), getAuthService()) },
    { method: "PATCH", pattern: /^\/api\/admin\/job-types\/([^/]+)$/, handler: (request, match) => handleJobTypeUpdateRoute(request, match![1], getAuthService()) },
    { method: "PUT", pattern: /^\/api\/admin\/job-types\/([^/]+)$/, handler: (request, match) => handleJobTypeUpdateRoute(request, match![1], getAuthService()) },
    { method: "DELETE", pattern: /^\/api\/admin\/job-types\/([^/]+)$/, handler: (request, match) => handleJobTypeDeleteRoute(request, match![1], getAuthService()) },
    { method: "POST", pattern: "/api/roles", handler: (request) => handleRolesCreateRoute(request, getAuthService(), getRolesService()) },
    { method: "GET", pattern: "/api/permissions", handler: (request) => handlePermissionsListRoute(request, getAuthService(), getRolesService()) },
    { method: "GET", pattern: /^\/api\/roles\/(\d+)\/permissions$/, handler: (request, match) => handleRolePermissionsDetailRoute(request, Number.parseInt(match![1], 10), getAuthService(), getRolesService()) },
    { method: "PUT", pattern: /^\/api\/roles\/(\d+)\/permissions$/, handler: (request, match) => handleRolePermissionsUpdateRoute(request, Number.parseInt(match![1], 10), getAuthService(), getRolesService()) },
    { method: "PUT", pattern: /^\/api\/roles\/(\d+)$/, handler: (request, match) => handleRolesUpdateRoute(request, Number.parseInt(match![1], 10), getAuthService(), getRolesService()) },
    { method: "PATCH", pattern: /^\/api\/roles\/(\d+)$/, handler: (request, match) => handleRolesUpdateRoute(request, Number.parseInt(match![1], 10), getAuthService(), getRolesService()) },
    { method: "GET", pattern: "/api/units", handler: (request) => handleUnitsListRoute(request, getAuthService(), getUnitsService()) },
    { method: "GET", pattern: "/api/units/clients", handler: (request) => handleUnitClientsRoute(request, getAuthService(), getUnitsService()) },
    { method: "POST", pattern: "/api/units", handler: (request) => handleUnitsListRoute(request, getAuthService(), getUnitsService()) },
    { method: "GET", pattern: "/api/countdown", handler: (request) => handleCountdownListRoute(request, getAuthService(), getCountdownService()) },
    { method: "GET", pattern: "/api/countdown/download", handler: (request) => handleCountdownDownloadRoute(request, getAuthService(), getCountdownService()) },
    { method: "POST", pattern: /^\/api\/countdown\/([^/]+)\/revision$/, handler: (request, match) => handleCountdownRevisionRequestRoute(request, match![1], getAuthService(), getCountdownService()) },
    { method: "PUT", pattern: /^\/api\/countdown\/([^/]+)\/revision\/approval$/, handler: (request, match) => handleCountdownRevisionApprovalRoute(request, match![1], getAuthService(), getCountdownService()) },
    { method: "POST", pattern: "/api/countdown", handler: (request) => handleCountdownCreateRoute(request, getAuthService(), getCountdownService()) },
    { method: "GET", pattern: "/api/job-plan", handler: (request) => handleJobPlanListRoute(request, getAuthService(), getJobPlanService()) },
    { method: "GET", pattern: "/api/monitoring/today", handler: (request) => handleMonitoringTodayRoute(request, getAuthService(), getMonitoringService()) },
    { method: "GET", pattern: "/api/monitoring/division", handler: (request) => handleMonitoringDivisionRoute(request, getAuthService(), getMonitoringService()) },
    { method: "GET", pattern: "/api/monitoring/unit", handler: (request) => handleMonitoringUnitRoute(request, getAuthService(), getMonitoringService()) },
    { method: "GET", pattern: "/api/monitoring/employee", handler: (request) => handleMonitoringEmployeeRoute(request, getAuthService(), getMonitoringService()) },
    { method: "POST", pattern: "/api/monitoring/actual", handler: (request) => handleMonitoringActualCreateRoute(request, getAuthService(), getMonitoringService()) },
    { method: "GET", pattern: /^\/api\/monitoring\/division\/\d+$/, handler: (request) => handleMonitoringDivisionDetailRoute(request, getAuthService(), getMonitoringService()) },
    { method: "GET", pattern: "/api/monitoring/overtime", handler: (request) => handleMonitoringOvertimeRoute(request, getAuthService(), getMonitoringService()) },
    { method: "GET", pattern: "/api/monitoring/no-start", handler: (request) => handleMonitoringNoStartRoute(request, getAuthService(), getMonitoringService()) },
    { method: "GET", pattern: "/api/monitoring/no-submit", handler: (request) => handleMonitoringNoSubmitRoute(request, getAuthService(), getMonitoringService()) },
    { method: "GET", pattern: "/api/issues", handler: (request) => handleIssuesListRoute(request, getAuthService(), getIssuesService()) },
    { method: "POST", pattern: "/api/issues", handler: (request) => handleIssuesCreateRoute(request, getAuthService(), getIssuesService()) },
    { method: "GET", pattern: "/api/issues/urgent", handler: (request) => handleIssuesUrgentRoute(request, getAuthService(), getIssuesService()) },
    { method: "GET", pattern: "/api/gallery", handler: (request) => handleGalleryListRoute(request, getAuthService(), getGalleryService()) },
    { method: "GET", pattern: "/api/gallery/upload-ticket", handler: (request) => handleGalleryUploadTicketRoute(request, getAuthService(), getGalleryService()) },
    { method: "POST", pattern: "/api/gallery/photos", handler: (request) => handleGalleryCreatePhotoRoute(request, getAuthService(), getGalleryService()) },
    { method: "GET", pattern: "/api/calendar/weekly-config", handler: (request) => handleWeeklyConfigListRoute(request, getAuthService(), getCalendarService()) },
    { method: "POST", pattern: "/api/calendar/weekly-config", handler: (request) => handleWeeklyConfigUpsertRoute(request, getAuthService(), getCalendarService()) },
    { method: "GET", pattern: "/api/calendar/working-days", handler: (request) => handleWorkingDaysRoute(request, getAuthService(), getCalendarService()) },
    { method: "GET", pattern: "/api/calendar/day-overrides", handler: (request) => handleCalendarDayOverrideListRoute(request, getAuthService(), getCalendarService()) },
    { method: "POST", pattern: "/api/calendar/day-overrides", handler: (request) => handleCalendarDayOverrideUpsertRoute(request, getAuthService(), getCalendarService()) },
    { method: "POST", pattern: "/api/calendar/simulate-capacity", handler: (request) => handleCapacityPreviewRoute(request, getAuthService(), getCalendarService()) },
    { method: "GET", pattern: "/api/planning/delivery-risk", handler: (request) => handleDeliveryRiskRoute(request, getAuthService(), getCalendarService()) },
    { method: "GET", pattern: "/api/planning/workspace", handler: (request) => handlePlanningWorkspaceSummaryRoute(request, getAuthService(), getPlanningWorkspaceService()) },
    { method: "GET", pattern: "/api/planning/work-control/units", handler: (request) => handleWorkControlUnitsRoute(request, getAuthService(), getPlanningWorkControlService()) },
    { method: "GET", pattern: /^\/api\/planning\/work-control\/units\/([^/]+)\/progress$/, handler: (request, match) => handleWorkControlUnitProgressRoute(request, match![1], getAuthService(), getPlanningWorkControlService()) },
    { method: "GET", pattern: "/api/planning/work-control/capacity", handler: (request) => handleWorkControlCapacityRoute(request, getAuthService(), getPlanningWorkControlService()) },
    { method: "GET", pattern: "/api/planning/work-control/overtime-recommendations", handler: (request) => handleWorkControlOvertimeRecommendationListRoute(request, getAuthService(), getPlanningWorkControlService()) },
    { method: "GET", pattern: "/api/planning/work-control/service-templates", handler: (request) => handleWorkControlServiceTemplatesRoute(request, getAuthService(), getPlanningWorkControlService()) },
    { method: "POST", pattern: "/api/planning/work-control/targets", handler: (request) => handleWorkControlCreateTargetRoute(request, getAuthService(), getPlanningWorkControlService()) },
    { method: "POST", pattern: "/api/planning/work-control/release-spk", handler: (request) => handleWorkControlReleaseSpkRoute(request, getAuthService(), getPlanningWorkControlService()) },
    { method: "POST", pattern: "/api/planning/work-control/overtime-recommendation", handler: (request) => handleWorkControlOvertimeRecommendationRoute(request, getAuthService(), getPlanningWorkControlService()) },
    { method: "POST", pattern: "/api/planning/work-control/service-intakes", handler: (request) => handleWorkControlServiceIntakeRoute(request, getAuthService(), getPlanningWorkControlService()) },
    { method: "POST", pattern: "/api/planning/work-control/calculation-snapshots", handler: (request) => handleWorkControlCriticalPathSnapshotRoute(request, getAuthService(), getPlanningWorkControlService()) },
    { method: "POST", pattern: "/api/planning/work-control/labour-overrides", handler: (request) => handleWorkControlLabourOverrideRoute(request, getAuthService(), getPlanningWorkControlService()) },
    { method: "GET", pattern: "/api/planning/evaluation", handler: (request) => handlePlanningEvaluationRoute(request, getAuthService(), getPlanningEvaluationService()) },
    { method: "POST", pattern: "/api/planning/weekly-plan", handler: (request) => handleWeeklyPlanUpsertRoute(request, getAuthService(), getPlanningService()) },
    { method: "GET", pattern: "/api/job-plan/export", handler: (request) => handleJobPlanExportRoute(request, getAuthService(), getJobPlanService()) },
    { method: "GET", pattern: /^\/api\/units\/([^/]+)\/workflow-layout\/([^/]+)$/, handler: (request, match) => handleWorkflowLayoutGetRoute(request, decodeURIComponent(match![1]), decodeURIComponent(match![2]), getAuthService()) },
    { method: "PUT", pattern: /^\/api\/units\/([^/]+)\/workflow-layout\/([^/]+)$/, handler: (request, match) => handleWorkflowLayoutSaveRoute(request, decodeURIComponent(match![1]), decodeURIComponent(match![2]), getAuthService()) },
    { method: "GET", pattern: "/api/job-plan/today", handler: (request) => handleJobPlanTodayRoute(request, getAuthService(), getJobPlanService()) },
    { method: "GET", pattern: "/api/job-plan/my-division", handler: (request) => handleJobPlanMyDivisionRoute(request, getAuthService(), getJobPlanService()) },
    { method: "GET", pattern: "/api/job-plan/pic-load", handler: (request) => handleJobPlanPicLoadRoute(request, getAuthService(), getJobPlanService()) },
    { method: "POST", pattern: "/api/job-plan", handler: (request) => handleJobPlanCreateRoute(request, getAuthService(), getJobPlanService()) },
    { method: "POST", pattern: "/api/job-plan/bulk", handler: (request) => handleJobPlanBulkCreateRoute(request, getAuthService(), getJobPlanService()) },
    { method: "POST", pattern: "/api/job-plan/workspace", handler: (request) => handleJobPlanWorkspaceCreateRoute(request, getAuthService(), getJobPlanService()) },
    { method: "POST", pattern: "/api/job-plan/draft", handler: (request) => handleJobPlanDraftSaveRoute(request, getAuthService(), getJobPlanService()) },
    { method: "POST", pattern: "/api/job-plan/draft/submit", handler: (request) => handleJobPlanDraftSubmitRoute(request, getAuthService(), getJobPlanService()) },
    { method: "POST", pattern: "/api/job-plan/draft/delete", handler: (request) => handleJobPlanDraftDeleteRoute(request, getAuthService(), getJobPlanService()) },
    { method: "GET", pattern: "/api/spk", handler: (request) => handleSpkListRoute(request, getAuthService(), getSpkService()) },
    { method: "GET", pattern: "/api/spk/preview", handler: (request) => handleSpkPreviewRoute(request, getAuthService(), getSpkService()) },
    { method: "POST", pattern: "/api/spk/generate", handler: (request) => handleSpkGenerateRoute(request, getAuthService(), getSpkService()) },
    { method: "GET", pattern: "/api/spk/today", handler: (request) => handleSpkTodayRoute(request, getAuthService(), getSpkService()) },
    { method: "GET", pattern: "/api/spk/summary", handler: (request) => handleSpkSummaryRoute(request, getAuthService(), getSpkService()) },
    { method: "GET", pattern: "/api/wo", handler: (request) => handleWoListRoute(request, getAuthService(), getWoService()) },
    { method: "GET", pattern: "/api/wo/pending-approval", handler: (request) => handleWoPendingApprovalRoute(request, getAuthService(), getWoService()) },
    { method: "GET", pattern: "/api/wo/my-division", handler: (request) => handleWoMyDivisionRoute(request, getAuthService(), getWoService()) },
    { method: "GET", pattern: "/api/wo/urgent", handler: (request) => handleWoUrgentRoute(request, getAuthService(), getWoService()) },
    { method: "POST", pattern: "/api/wo", handler: (request) => handleWoCreateRoute(request, getAuthService(), getWoService()) },
    { method: "GET", pattern: "/api/pr/upload-ticket", handler: (request) => handlePrUploadTicketRoute(request, getAuthService()) },
    { method: "GET", pattern: "/api/pr", handler: (request) => handlePrListRoute(request, getAuthService(), getPrService()) },
    { method: "GET", pattern: "/api/pr/critical", handler: (request) => handlePrCriticalRoute(request, getAuthService(), getPrService()) },
    { method: "POST", pattern: "/api/pr", handler: (request) => handlePrCreateRoute(request, getAuthService(), getPrService()) },
    { method: "GET", pattern: "/api/vendor", handler: (request) => handleVendorListRoute(request, getAuthService(), getVendorService()) },
    { method: "POST", pattern: "/api/vendor", handler: (request) => handleVendorCreateRoute(request, getAuthService(), getVendorService()) },
    { method: "GET", pattern: "/api/warehouse/transactions", handler: (request) => handleWarehouseTransactionsRoute(request, getAuthService(), getWarehouseService()) },
    { method: "GET", pattern: "/api/warehouse/dashboard", handler: (request) => handleWarehouseDashboardRoute(request, getAuthService(), getWarehouseService()) },
    { method: "GET", pattern: "/api/warehouse/pending-approval", handler: (request) => handleWarehousePendingApprovalRoute(request, getAuthService(), getWarehouseService()) },
    { method: "GET", pattern: "/api/warehouse/request-references", handler: (request) => handleWarehouseRequestReferencesRoute(request, getAuthService(), getWarehouseService()) },
    { method: "GET", pattern: "/api/warehouse/stock-card/references", handler: (request) => handleWarehouseStockCardReferencesRoute(request, getAuthService(), getWarehouseService()) },
    { method: "GET", pattern: "/api/warehouse/stock-card", handler: (request) => handleWarehouseStockCardRoute(request, getAuthService(), getWarehouseService()) },
    { method: "GET", pattern: "/api/warehouse/stock-card/upload-ticket", handler: (request) => handleWarehouseStockCardUploadTicketRoute(request, getAuthService(), getWarehouseService()) },
    { method: "GET", pattern: "/api/warehouse/items", handler: (request) => handleWarehouseItemsRoute(request, getAuthService(), getWarehouseService()) },
    { method: "POST", pattern: "/api/warehouse/items", handler: (request) => handleWarehouseItemCreateRoute(request, getAuthService(), getWarehouseService()) },
    { method: "PUT", pattern: "/api/warehouse/items", handler: (request) => handleWarehouseItemUpdateRoute(request, getAuthService(), getWarehouseService()) },
    { method: "DELETE", pattern: /^\/api\/warehouse\/items\/([^/]+)$/u, handler: (request, match) => handleWarehouseItemDeleteRoute(request, decodeURIComponent(match![1]), getAuthService(), getWarehouseService()) },
    { method: "GET", pattern: "/api/warehouse/material-usage", handler: (request) => handleWarehouseMaterialUsageRoute(request, getAuthService(), getWarehouseService()) },
    { method: "GET", pattern: "/api/warehouse/storage-locations", handler: (request) => handleWarehouseStorageLocationsRoute(request, getAuthService(), getWarehouseService()) },
    { method: "GET", pattern: "/api/warehouse/opname", handler: (request) => handleWarehouseStockOpnameRoute(request, getAuthService(), getWarehouseService()) },
    { method: "GET", pattern: "/api/warehouse/adjustments", handler: (request) => handleWarehouseStockAdjustmentRoute(request, getAuthService(), getWarehouseService()) },
    { method: "GET", pattern: "/api/bubut-invoices/work-orders", handler: (request) => handleBubutInvoiceWorkOrdersRoute(request, getAuthService(), getBubutInvoiceService()) },
    { method: "POST", pattern: "/api/bubut-invoices/preview", handler: (request) => handleBubutInvoicePreviewRoute(request, getAuthService(), getBubutInvoiceService()) },
    { method: "POST", pattern: "/api/bubut-invoices/release", handler: (request) => handleBubutInvoiceReleaseRoute(request, getAuthService(), getBubutInvoiceService()) },
    { method: "GET", pattern: /^\/api\/wo-bubut-invoice\/([^/]+)\/work-history$/u, handler: (request, match) => handleBubutInvoiceWorkHistoryRoute(request, match![1], getAuthService(), getBubutInvoiceService()) },
    { method: "GET", pattern: /^\/api\/bubut-invoices\/([^/]+)\/work-history$/u, handler: (request, match) => handleBubutInvoiceWorkHistoryRoute(request, match![1], getAuthService(), getBubutInvoiceService()) },
    { method: "GET", pattern: /^\/api\/reports\/([^/]+)\/export$/u, handler: (request, match) => {
      const reportType = reportTypeSchema.safeParse(match![1]);
      return reportType.success
        ? handleReportsExportRoute(request, reportType.data, getAuthService(), getReportsService())
        : jsonResponse({ message: "Not Found" }, 404);
    } },
    { method: "GET", pattern: /^\/api\/reports\/([^/]+)$/u, handler: (request, match) => {
      const reportType = reportTypeSchema.safeParse(match![1]);
      return reportType.success
        ? handleReportsGridRoute(request, reportType.data, getAuthService(), getReportsService())
        : jsonResponse({ message: "Not Found" }, 404);
    } },
    { method: "PUT", pattern: /^\/api\/bubut-invoices\/(\d+)$/u, handler: (request, match) => handleBubutInvoiceUpdateRoute(request, Number(match![1]), getAuthService(), getBubutInvoiceService()) },
    { method: "GET", pattern: /^\/api\/bubut-invoices\/(\d+)\/print$/u, handler: (request, match) => handleBubutInvoicePrintRoute(request, Number(match![1]), getAuthService(), getBubutInvoiceService()) },
    { method: "PATCH", pattern: /^\/api\/bubut-invoices\/(\d+)\/cancel$/u, handler: (request, match) => handleBubutInvoiceCancelRoute(request, Number(match![1]), getAuthService(), getBubutInvoiceService()) },
    { method: "GET", pattern: /^\/api\/bubut-invoices\/(\d+)$/u, handler: (request, match) => handleBubutInvoiceDetailRoute(request, Number(match![1]), getAuthService(), getBubutInvoiceService()) },
    { method: "POST", pattern: "/api/warehouse/request", handler: (request) => handleWarehouseRequestCreateRoute(request, getAuthService(), getWarehouseService()) },
    { method: "POST", pattern: "/api/warehouse/approve", handler: (request) => handleWarehouseApproveRoute(request, getAuthService(), getWarehouseService()) },
    { method: "POST", pattern: "/api/warehouse/reject", handler: (request) => handleWarehouseRejectRoute(request, getAuthService(), getWarehouseService()) },
    { method: "POST", pattern: "/api/warehouse/ready", handler: (request) => handleWarehouseReadyRoute(request, getAuthService(), getWarehouseService()) },
    { method: "POST", pattern: "/api/warehouse/issue", handler: (request) => handleWarehouseIssueRoute(request, getAuthService(), getWarehouseService()) },
    { method: "POST", pattern: "/api/warehouse/return", handler: (request) => handleWarehouseReturnRoute(request, getAuthService(), getWarehouseService()) },
    { method: "POST", pattern: "/api/warehouse/store", handler: (request) => handleWarehouseStoreRoute(request, getAuthService(), getWarehouseService()) },
    { method: "POST", pattern: "/api/warehouse/stock-card", handler: (request) => handleWarehouseStockCardCreateRoute(request, getAuthService(), getWarehouseService()) },
    { method: "PUT", pattern: "/api/warehouse/stock-card", handler: (request) => handleWarehouseStockCardUpdateRoute(request, getAuthService(), getWarehouseService()) },
    { method: "DELETE", pattern: /^\/api\/warehouse\/stock-card\/([^/]+)$/u, handler: (request, match) => handleWarehouseStockCardDeleteRoute(request, match![1], getAuthService(), getWarehouseService()) },
    { method: "POST", pattern: "/api/warehouse/stock-card/photos", handler: (request) => handleWarehouseStockCardPhotosRoute(request, getAuthService(), getWarehouseService()) },
    { method: "POST", pattern: "/api/warehouse/storage-locations", handler: (request) => handleWarehouseStorageLocationCreateRoute(request, getAuthService(), getWarehouseService()) },
    { method: "PUT", pattern: "/api/warehouse/storage-locations", handler: (request) => handleWarehouseStorageLocationUpdateRoute(request, getAuthService(), getWarehouseService()) },
    { method: "DELETE", pattern: /^\/api\/warehouse\/storage-locations\/(\d+)$/u, handler: (request, match) => handleWarehouseStorageLocationDeleteRoute(request, Number(match![1]), getAuthService(), getWarehouseService()) },
    { method: "POST", pattern: "/api/warehouse/opname", handler: (request) => handleWarehouseStockOpnameCreateRoute(request, getAuthService(), getWarehouseService()) },
    { method: "POST", pattern: "/api/warehouse/adjustments", handler: (request) => handleWarehouseStockAdjustmentCreateRoute(request, getAuthService(), getWarehouseService()) },
    { method: "GET", pattern: "/api/qc/queue", handler: (request) => handleQcQueueRoute(request, getAuthService(), getQcService()) },
    { method: "GET", pattern: "/api/qc/rework", handler: (request) => handleQcReworkRoute(request, getAuthService(), getQcService()) },
    { method: "GET", pattern: "/api/qc/recheck", handler: (request) => handleQcRecheckRoute(request, getAuthService(), getQcService()) },
    { method: "GET", pattern: "/api/qa/inspections", handler: (request) => handleQaPortalRoute(request, getAuthService(), getQaService()) },
    { method: "GET", pattern: "/api/countdown/template", handler: (request) => handleCountdownTemplateRoute(request, getAuthService(), getCountdownService()) },
    { method: "PATCH", pattern: /^\/api\/job-plan\/([^/]+)\/status$/, handler: (request, match) => handleJobPlanStatusRoute(request, match![1], getAuthService(), getJobPlanService()) },
    { method: "PUT", pattern: /^\/api\/job-plan\/([^/]+)$/, handler: (request, match) => handleJobPlanUpdateRoute(request, match![1], getAuthService(), getJobPlanService()) },
    { method: "DELETE", pattern: /^\/api\/job-plan\/([^/]+)$/, handler: (request, match) => handleJobPlanDeleteRoute(request, match![1], getAuthService(), getJobPlanService()) },
    { method: "PATCH", pattern: /^\/api\/spk\/([^/]+)\/item\/([^/]+)$/, handler: (request, match) => handleSpkItemApprovalRoute(request, match![1], match![2], getAuthService(), getSpkService()) },
    { method: "PATCH", pattern: /^\/api\/spk\/([^/]+)\/draft-details$/, handler: (request, match) => handleSpkDraftDetailsRoute(request, match![1], getAuthService(), getSpkService()) },
    { method: "PATCH", pattern: /^\/api\/spk\/([^/]+)\/(submit|approve|reject|activate|done)$/, handler: (request, match) => {
      const handlers = {
        submit: handleSpkSubmitRoute,
        approve: handleSpkApproveRoute,
        reject: handleSpkRejectRoute,
        activate: handleSpkActivateRoute,
        done: handleSpkDoneRoute,
      };
      return handlers[match![2] as keyof typeof handlers](request, match![1], getAuthService(), getSpkService());
    } },
    { method: "GET", pattern: /^\/api\/spk\/([^/]+)$/, handler: (request, match) => handleSpkDetailRoute(request, match![1], getAuthService(), getSpkService()) },
    { method: "GET", pattern: /^\/api\/wo\/([^/]+)\/linked-countdowns$/, handler: (request, match) => handleWoLinkedCountdownsRoute(request, match![1], getAuthService(), getWoService()) },
    { method: "PATCH", pattern: /^\/api\/wo\/([^/]+)\/(approve|reject|done)$/, handler: (request, match) => {
      const handlers = {
        approve: handleWoApproveRoute,
        reject: handleWoRejectRoute,
        done: handleWoDoneRoute,
      };
      return handlers[match![2] as keyof typeof handlers](request, match![1], getAuthService(), getWoService());
    } },
    { method: "PUT", pattern: /^\/api\/wo\/([^/]+)$/, handler: (request, match) => handleWoUpdateRoute(request, match![1], getAuthService(), getWoService()) },
    { method: "GET", pattern: /^\/api\/wo\/([^/]+)$/, handler: (request, match) => handleWoDetailRoute(request, match![1], getAuthService(), getWoService()) },
    { method: "PATCH", pattern: /^\/api\/pr\/([^/]+)\/(approve|order|receive|cancel)$/, handler: (request, match) => {
      const handlers = {
        approve: handlePrApproveRoute,
        order: handlePrOrderRoute,
        receive: handlePrReceiveRoute,
        cancel: handlePrCancelRoute,
      };
      return handlers[match![2] as keyof typeof handlers](request, match![1], getAuthService(), getPrService());
    } },
    { method: "PUT", pattern: /^\/api\/pr\/([^/]+)$/, handler: (request, match) => handlePrUpdateRoute(request, match![1], getAuthService(), getPrService()) },
    { method: "GET", pattern: /^\/api\/pr\/([^/]+)$/, handler: (request, match) => handlePrDetailRoute(request, match![1], getAuthService(), getPrService()) },
    { method: "PATCH", pattern: /^\/api\/vendor\/([^/]+)\/(approve|status|receive|cancel)$/, handler: (request, match) => {
      const handlers = {
        approve: handleVendorApproveRoute,
        status: handleVendorStatusRoute,
        receive: handleVendorReceiveRoute,
        cancel: handleVendorCancelRoute,
      };
      return handlers[match![2] as keyof typeof handlers](request, match![1], getAuthService(), getVendorService());
    } },
    { method: "PUT", pattern: /^\/api\/vendor\/([^/]+)$/, handler: (request, match) => handleVendorUpdateRoute(request, match![1], getAuthService(), getVendorService()) },
    { method: "GET", pattern: /^\/api\/vendor\/([^/]+)$/, handler: (request, match) => handleVendorDetailRoute(request, match![1], getAuthService(), getVendorService()) },
    { method: "GET", pattern: /^\/api\/issues\/unit\/([^/]+)$/, handler: (request, match) => handleIssuesByUnitRoute(request, match![1], getAuthService(), getIssuesService()) },
    { method: "PATCH", pattern: /^\/api\/issues\/([^/]+)\/(acknowledge|assign|start|qc-recheck|resolve|escalate|waive)$/, handler: (request, match) => {
      const handlers = {
        acknowledge: handleIssuesAcknowledgeRoute,
        assign: handleIssuesAssignRoute,
        start: handleIssuesStartRoute,
        "qc-recheck": handleIssuesQcRecheckRoute,
        resolve: handleIssuesResolveRoute,
        escalate: handleIssuesEscalateRoute,
        waive: handleIssuesWaiveRoute,
      };
      return handlers[match![2] as keyof typeof handlers](request, match![1], getAuthService(), getIssuesService());
    } },
    { method: "GET", pattern: /^\/api\/issues\/([^/]+)$/, handler: (request, match) => handleIssuesDetailRoute(request, match![1], getAuthService(), getIssuesService()) },
    { method: "GET", pattern: /^\/api\/gallery\/([^/]+)\/photos$/, handler: (request, match) => handleGalleryPhotosRoute(request, match![1], getAuthService(), getGalleryService()) },
    { method: "PUT", pattern: /^\/api\/gallery\/photos\/([^/]+)$/, handler: (request, match) => handleGalleryUpdatePhotoRoute(request, match![1], getAuthService(), getGalleryService()) },
    { method: "DELETE", pattern: /^\/api\/gallery\/photos\/([^/]+)$/, handler: (request, match) => handleGalleryDeletePhotoRoute(request, match![1], getAuthService(), getGalleryService()) },
    { method: "POST", pattern: /^\/api\/qc\/final-checklist\/([^/]+)\/approve$/, handler: (request, match) => handleQcFinalChecklistApproveRoute(request, match![1], getAuthService(), getQcService()) },
    { method: "GET", pattern: /^\/api\/qc\/final-checklist\/([^/]+)$/, handler: (request, match) => handleQcFinalChecklistRoute(request, match![1], getAuthService(), getQcService()) },
    { method: "PATCH", pattern: /^\/api\/qa\/inspections\/([^/]+)$/, handler: (request, match) => handleQaInspectionUpdateRoute(request, match![1], getAuthService(), getQaService()) },
    { method: "POST", pattern: /^\/api\/qc\/([^/]+)\/(pass|reject)$/, handler: (request, match) =>
      match![2] === "pass"
        ? handleQcPassRoute(request, match![1], getAuthService(), getQcService())
        : handleQcRejectRoute(request, match![1], getAuthService(), getQcService()) },
    { method: "GET", pattern: /^\/api\/qc\/([^/]+)$/, handler: (request, match) => handleQcDetailRoute(request, match![1], getAuthService(), getQcService()) },
    { method: "GET", pattern: /^\/api\/planning\/eta\/([^/]+)$/, handler: (request, match) => handleUnitEtaRoute(request, match![1], getAuthService(), getCalendarService()) },
    { method: "POST", pattern: /^\/api\/planning\/weekly-plan\/([^/]+)\/overtime$/, handler: (request, match) => handleWeeklyPlanOvertimeRoute(request, match![1], getAuthService(), getPlanningService()) },
    { method: "POST", pattern: /^\/api\/planning\/weekly-plan\/([^/]+)\/divisions$/, handler: (request, match) => handleWeeklyPlanDivisionRoute(request, match![1], getAuthService(), getPlanningService()) },
    { method: "POST", pattern: /^\/api\/planning\/weekly-plan\/([^/]+)\/units$/, handler: (request, match) => handleWeeklyPlanUnitsRoute(request, match![1], getAuthService(), getPlanningService()) },
    { method: "POST", pattern: /^\/api\/planning\/weekly-plan\/([^/]+)\/snapshot-absence$/, handler: (request, match) => handleWeeklyPlanSnapshotAbsenceRoute(request, match![1], getAuthService(), getPlanningService()) },
    { method: "POST", pattern: /^\/api\/planning\/weekly-plan\/([^/]+)\/publish$/, handler: (request, match) => handleWeeklyPlanPublishRoute(request, match![1], getAuthService(), getPlanningService()) },
    { method: "GET", pattern: /^\/api\/planning\/weekly-plan\/([^/]+)\/gap$/, handler: (request, match) => handleWeeklyPlanGapRoute(request, match![1], getAuthService(), getPlanningService()) },
    { method: "GET", pattern: /^\/api\/planning\/weekly-plan\/([^/]+)\/alerts$/, handler: (request, match) => handleWeeklyPlanAlertsRoute(request, match![1], getAuthService(), getPlanningService()) },
    { method: "GET", pattern: /^\/api\/planning\/weekly-plan\/([^/]+)$/, handler: (request, match) => handleWeeklyPlanDetailRoute(request, match![1], getAuthService(), getPlanningService()) },
    { method: "POST", pattern: "/api/countdown/import", handler: (request) => handleCountdownImportRoute(request, getAuthService(), getCountdownService()) },
    { method: "GET", pattern: /^\/api\/units\/([^/]+)\/workspace$/, handler: (request, match) => handleUnitWorkspaceRoute(request, match![1], getAuthService(), getUnitsService()) },
    { method: "GET", pattern: /^\/api\/units\/([^/]+)\/bom$/, handler: (request, match) => handleUnitBomRoute(request, match![1], getAuthService(), getUnitsService()) },
    { method: "GET", pattern: "/api/units/master-panels/general", handler: (request) => handleUnitPanelGeneralRoute(request, getAuthService(), getUnitsService()) },
    { method: "GET", pattern: /^\/api\/units\/([^/]+)\/master-panels$/, handler: (request, match) => handleUnitPanelsRoute(request, match![1], getAuthService(), getUnitsService()) },
    { method: "POST", pattern: /^\/api\/units\/([^/]+)\/master-panels$/, handler: (request, match) => handleUnitPanelsRoute(request, match![1], getAuthService(), getUnitsService()) },
    { method: "PUT", pattern: /^\/api\/units\/([^/]+)\/master-panels\/category$/, handler: (request, match) => handleUnitPanelCategoryRoute(request, match![1], getAuthService(), getUnitsService()) },
    { method: "PUT", pattern: /^\/api\/units\/([^/]+)\/master-panels\/(\d+)$/, handler: (request, match) => handleUnitPanelDetailRoute(request, match![1], Number.parseInt(match![2], 10), getAuthService(), getUnitsService()) },
    { method: "DELETE", pattern: /^\/api\/units\/([^/]+)\/master-panels\/(\d+)$/, handler: (request, match) => handleUnitPanelDetailRoute(request, match![1], Number.parseInt(match![2], 10), getAuthService(), getUnitsService()) },
    { method: "GET", pattern: /^\/api\/units\/([^/]+)$/, handler: (request, match) => handleUnitDetailRoute(request, match![1], getAuthService(), getUnitsService()) },
    { method: "PUT", pattern: /^\/api\/units\/([^/]+)$/, handler: (request, match) => handleUnitDetailRoute(request, match![1], getAuthService(), getUnitsService()) },
    { method: "DELETE", pattern: /^\/api\/units\/([^/]+)$/, handler: (request, match) => handleUnitDetailRoute(request, match![1], getAuthService(), getUnitsService()) },
    { method: "GET", pattern: /^\/api\/countdown\/([^/]+)$/, handler: (request, match) => handleCountdownDetailRoute(request, match![1], getAuthService(), getCountdownService()) },
    { method: "PUT", pattern: /^\/api\/countdown\/([^/]+)$/, handler: (request, match) => handleCountdownUpdateRoute(request, match![1], getAuthService(), getCountdownService()) },
    { method: "DELETE", pattern: /^\/api\/countdown\/([^/]+)$/, handler: (request, match) => handleCountdownDeleteRoute(request, match![1], getAuthService(), getCountdownService()) },
  ];

  return async function fetchHandler(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return preflightResponse(request);
    }

    if (request.method === "GET" && url.pathname === "/health") {
      return handleHealthRequest(dependencies);
    }

    const rateLimitResponse = await enforceSecurityRateLimit(request, getAuthService());
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const csrfResponse = await enforceCsrfProtection(request, getAuthService());
    if (csrfResponse) {
      return csrfResponse;
    }

    for (const route of routes) {
      if (route.method !== request.method) {
        continue;
      }

      const match = matchRoute(route.pattern, url.pathname);
      if (match !== undefined) {
        return route.handler(request, match);
      }
    }

    return jsonResponse({ message: "Not Found" }, 404);
  };
}
