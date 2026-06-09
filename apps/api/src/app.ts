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
  handleUnitPanelDetailRoute,
  handleUnitPanelsRoute,
  handleUnitWorkspaceRoute,
  handleUnitsListRoute,
} from "@/routes/units.routes";
import { DefaultUnitsService, type UnitsService } from "@/services/units.service";
import {
  handleCountdownCreateRoute,
  handleCountdownDeleteRoute,
  handleCountdownDetailRoute,
  handleCountdownImportRoute,
  handleCountdownListRoute,
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
  handleMonitoringEmployeeRoute,
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
} from "@/routes/vendor.routes";
import {
  DefaultVendorService,
  type VendorService,
} from "@/services/vendor.service";
import {
  handleWarehouseApproveRoute,
  handleWarehouseIssueRoute,
  handleWarehouseDashboardRoute,
  handleWarehouseItemsRoute,
  handleWarehouseMaterialUsageRoute,
  handleWarehousePendingApprovalRoute,
  handleWarehouseReadyRoute,
  handleWarehouseRejectRoute,
  handleWarehouseRequestCreateRoute,
  handleWarehouseRequestReferencesRoute,
  handleWarehouseReturnRoute,
  handleWarehouseStockCardPhotosRoute,
  handleWarehouseStockCardUploadTicketRoute,
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
import { enforceRoutePermissionMatrix } from "@/security/route-permissions";

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

function getDefaultAuthService(): AuthService {
  return new DefaultAuthService(
    new HttpSmLoginAdapter(),
    new MySqlAuthContextRepository(),
    new RedisSessionStore(),
    new DefaultAuditService(new MySqlAuditRepository()),
  );
}

function getDefaultUsersService(): UsersService {
  return new DefaultUsersService();
}

function getDefaultRolesService(): RolesService {
  return new DefaultRolesService();
}

function getDefaultUnitsService(): UnitsService {
  return new DefaultUnitsService();
}

function getDefaultCountdownService(): CountdownService {
  return new DefaultCountdownService();
}

function getDefaultJobPlanService(): JobPlanService {
  return new DefaultJobPlanService();
}

function getDefaultSpkService(): SpkService {
  return new DefaultSpkService();
}

function getDefaultWoService(): WoService {
  return new DefaultWoService();
}

function getDefaultPrService(): PrService {
  return new DefaultPrService();
}

function getDefaultVendorService(): VendorService {
  return new DefaultVendorService();
}

function getDefaultMonitoringService(): MonitoringService {
  return new DefaultMonitoringService();
}

function getDefaultIssuesService(): IssuesService {
  return new DefaultIssuesService();
}

function getDefaultCalendarService(): CalendarService {
  return new DefaultCalendarService();
}

function getDefaultPlanningService(): WeeklyPlanningService {
  return new DefaultWeeklyPlanningService();
}

function getDefaultPlanningWorkspaceService(): PlanningWorkspaceService {
  return new DefaultPlanningWorkspaceService();
}

function getDefaultPlanningWorkControlService(): PlanningWorkControlService {
  return new DefaultPlanningWorkControlService();
}

function getDefaultPlanningEvaluationService(): PlanningEvaluationService {
  return new DefaultPlanningEvaluationService();
}

function getDefaultQcService(): QcService {
  return new DefaultQcService();
}

function getDefaultQaService(): QaService {
  return new DefaultQaService();
}

function getDefaultWarehouseService(): WarehouseService {
  return new DefaultWarehouseService();
}

function getDefaultReportsService(): ReportsService {
  return new DefaultReportsService();
}

function getDefaultBubutInvoiceService(): BubutInvoiceService {
  return new DefaultBubutInvoiceService();
}

function getDefaultDashboardService(): DashboardService {
  return new DefaultDashboardService();
}

function getDefaultGalleryService(): GalleryService {
  return new DefaultGalleryService();
}

export function createApiFetchHandler(dependencies: AppDependencies = {}) {
  const getAuthService = () => dependencies.authService ?? getDefaultAuthService();
  const getUsersService = () => dependencies.usersService ?? getDefaultUsersService();
  const getRolesService = () => dependencies.rolesService ?? getDefaultRolesService();
  const getUnitsService = () => dependencies.unitsService ?? getDefaultUnitsService();
  const getCountdownService = () =>
    dependencies.countdownService ?? getDefaultCountdownService();
  const getJobPlanService = () =>
    dependencies.jobPlanService ?? getDefaultJobPlanService();
  const getSpkService = () => dependencies.spkService ?? getDefaultSpkService();
  const getWoService = () => dependencies.woService ?? getDefaultWoService();
  const getPrService = () => dependencies.prService ?? getDefaultPrService();
  const getVendorService = () =>
    dependencies.vendorService ?? getDefaultVendorService();
  const getMonitoringService = () =>
    dependencies.monitoringService ?? getDefaultMonitoringService();
  const getIssuesService = () => dependencies.issuesService ?? getDefaultIssuesService();
  const getCalendarService = () =>
    dependencies.calendarService ?? getDefaultCalendarService();
  const getPlanningService = () =>
    dependencies.planningService ?? getDefaultPlanningService();
  const getPlanningWorkspaceService = () =>
    dependencies.planningWorkspaceService ?? getDefaultPlanningWorkspaceService();
  const getPlanningWorkControlService = () =>
    dependencies.planningWorkControlService ?? getDefaultPlanningWorkControlService();
  const getPlanningEvaluationService = () =>
    dependencies.planningEvaluationService ?? getDefaultPlanningEvaluationService();
  const getQcService = () => dependencies.qcService ?? getDefaultQcService();
  const getQaService = () => dependencies.qaService ?? getDefaultQaService();
  const getWarehouseService = () =>
    dependencies.warehouseService ?? getDefaultWarehouseService();
  const getReportsService = () =>
    dependencies.reportsService ?? getDefaultReportsService();
  const getBubutInvoiceService = () =>
    dependencies.bubutInvoiceService ?? getDefaultBubutInvoiceService();
  const getDashboardService = () =>
    dependencies.dashboardService ?? getDefaultDashboardService();
  const getGalleryService = () =>
    dependencies.galleryService ?? getDefaultGalleryService();

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

    const permissionMatrixResponse = await enforceRoutePermissionMatrix(
      request,
      getAuthService(),
    );
    if (permissionMatrixResponse) {
      return permissionMatrixResponse;
    }

    if (request.method === "POST" && url.pathname === "/api/auth/login") {
      return handleLoginRoute(request, getAuthService());
    }

    if (request.method === "POST" && url.pathname === "/api/auth/logout") {
      return handleLogoutRoute(request, getAuthService());
    }

    if (request.method === "POST" && url.pathname === "/api/auth/refresh") {
      return handleRefreshRoute(request, getAuthService());
    }

    if (request.method === "GET" && url.pathname === "/api/auth/me") {
      return handleMeRoute(request, getAuthService());
    }

    if (request.method === "POST" && url.pathname === "/api/profile/avatar/upload") {
      return handleProfileAvatarUploadRoute(request, getAuthService());
    }

    if (request.method === "PUT" && url.pathname === "/api/profile/me") {
      return handleProfileUpdateRoute(request, getAuthService());
    }

    if (request.method === "POST" && url.pathname === "/api/profile/password") {
      return handleProfilePasswordRoute(request, getAuthService());
    }

    if (request.method === "GET" && url.pathname === "/api/auth/permissions") {
      return handlePermissionsRoute(request, getAuthService());
    }

    if (request.method === "GET" && url.pathname === "/api/dashboard/bootstrap") {
      return handleDashboardBootstrapRoute(request, getAuthService());
    }

    if (request.method === "GET" && url.pathname === "/api/dashboard/summary") {
      return handleDashboardSummaryRoute(
        request,
        getAuthService(),
        getDashboardService(),
      );
    }

    if (request.method === "GET" && url.pathname === "/api/proxy/image") {
      return handleImageProxyRoute(request);
    }

    if (request.method === "GET" && url.pathname === "/api/users") {
      return handleUsersListRoute(request, getAuthService(), getUsersService());
    }

    if (request.method === "POST" && url.pathname === "/api/users") {
      return handleUsersCreateRoute(request, getAuthService(), getUsersService());
    }

    if (request.method === "GET" && url.pathname === "/api/users/export") {
      return handleUsersExportRoute(request, getAuthService(), getUsersService());
    }

    const userMatch = url.pathname.match(/^\/api\/users\/([^/]+)$/);
    if (userMatch) {
      const employeeId = userMatch[1];
      if (request.method === "GET") {
        return handleUsersDetailRoute(
          request,
          employeeId,
          getAuthService(),
          getUsersService(),
        );
      }
      if (request.method === "PUT") {
        return handleUsersUpdateRoute(
          request,
          employeeId,
          getAuthService(),
          getUsersService(),
        );
      }
    }

    const resetPasswordMatch = url.pathname.match(/^\/api\/users\/([^/]+)\/reset-password$/);
    if (resetPasswordMatch && request.method === "POST") {
      const employeeId = resetPasswordMatch[1];
      return handleUsersResetPasswordRoute(
        request,
        employeeId,
        getAuthService(),
        getUsersService(),
      );
    }

    const deactivateMatch = url.pathname.match(/^\/api\/users\/([^/]+)\/deactivate$/);
    if (deactivateMatch && request.method === "POST") {
      const employeeId = deactivateMatch[1];
      return handleUsersDeactivateRoute(
        request,
        employeeId,
        getAuthService(),
        getUsersService(),
      );
    }

    if (request.method === "GET" && url.pathname === "/api/roles") {
      return handleRolesListRoute(request, getAuthService(), getRolesService());
    }

    if (request.method === "GET" && url.pathname === "/api/roles/references") {
      return handleRolesReferencesRoute(
        request,
        getAuthService(),
        getRolesService(),
      );
    }

    if (request.method === "GET" && url.pathname === "/api/admin/divisions") {
      return handleDivisionManagementListRoute(request, getAuthService());
    }

    if (request.method === "POST" && url.pathname === "/api/admin/divisions") {
      return handleDivisionCreateRoute(request, getAuthService());
    }

    if (request.method === "POST" && url.pathname === "/api/admin/job-types") {
      return handleGeneralJobTypeCreateRoute(request, getAuthService());
    }

    const divisionDetailMatch = url.pathname.match(/^\/api\/admin\/divisions\/(\d+)$/);
    if (divisionDetailMatch && (request.method === "PATCH" || request.method === "PUT")) {
      const divisionId = Number.parseInt(divisionDetailMatch[1], 10);
      return handleDivisionUpdateRoute(
        request,
        divisionId,
        getAuthService(),
      );
    }

    if (divisionDetailMatch && request.method === "DELETE") {
      const divisionId = Number.parseInt(divisionDetailMatch[1], 10);
      return handleDivisionDeleteRoute(
        request,
        divisionId,
        getAuthService(),
      );
    }

    const divisionJobTypeMatch = url.pathname.match(/^\/api\/admin\/divisions\/(\d+)\/job-types$/);
    if (divisionJobTypeMatch && request.method === "POST") {
      const divisionId = Number.parseInt(divisionJobTypeMatch[1], 10);
      return handleDivisionJobTypeCreateRoute(
        request,
        divisionId,
        getAuthService(),
      );
    }

    const jobTypeMatch = url.pathname.match(/^\/api\/admin\/job-types\/([^/]+)$/);
    if (jobTypeMatch && (request.method === "PATCH" || request.method === "PUT")) {
      return handleJobTypeUpdateRoute(
        request,
        jobTypeMatch[1],
        getAuthService(),
      );
    }

    if (jobTypeMatch && request.method === "DELETE") {
      return handleJobTypeDeleteRoute(
        request,
        jobTypeMatch[1],
        getAuthService(),
      );
    }

    if (request.method === "POST" && url.pathname === "/api/roles") {
      return handleRolesCreateRoute(request, getAuthService(), getRolesService());
    }

    if (request.method === "GET" && url.pathname === "/api/permissions") {
      return handlePermissionsListRoute(request, getAuthService(), getRolesService());
    }

    const rolePermissionsMatch = url.pathname.match(
      /^\/api\/roles\/(\d+)\/permissions$/,
    );
    if (rolePermissionsMatch) {
      const roleId = Number.parseInt(rolePermissionsMatch[1], 10);
      if (request.method === "GET") {
        return handleRolePermissionsDetailRoute(
          request,
          roleId,
          getAuthService(),
          getRolesService(),
        );
      }

      if (request.method === "PUT") {
        return handleRolePermissionsUpdateRoute(
          request,
          roleId,
          getAuthService(),
          getRolesService(),
        );
      }
    }

    const roleMatch = url.pathname.match(/^\/api\/roles\/(\d+)$/);
    if (roleMatch && (request.method === "PUT" || request.method === "PATCH")) {
      const roleId = Number.parseInt(roleMatch[1], 10);
      return handleRolesUpdateRoute(
        request,
        roleId,
        getAuthService(),
        getRolesService(),
      );
    }

    if (request.method === "GET" && url.pathname === "/api/units") {
      return handleUnitsListRoute(request, getAuthService(), getUnitsService());
    }

    if (request.method === "GET" && url.pathname === "/api/countdown") {
      return handleCountdownListRoute(
        request,
        getAuthService(),
        getCountdownService(),
      );
    }

    if (request.method === "POST" && url.pathname === "/api/countdown") {
      return handleCountdownCreateRoute(
        request,
        getAuthService(),
        getCountdownService(),
      );
    }

    if (request.method === "GET" && url.pathname === "/api/job-plan") {
      return handleJobPlanListRoute(request, getAuthService(), getJobPlanService());
    }

    if (request.method === "GET" && url.pathname === "/api/monitoring/today") {
      return handleMonitoringTodayRoute(
        request,
        getAuthService(),
        getMonitoringService(),
      );
    }

    if (request.method === "GET" && url.pathname === "/api/monitoring/division") {
      return handleMonitoringDivisionRoute(
        request,
        getAuthService(),
        getMonitoringService(),
      );
    }

    if (request.method === "GET" && url.pathname === "/api/monitoring/employee") {
      return handleMonitoringEmployeeRoute(
        request,
        getAuthService(),
        getMonitoringService(),
      );
    }

    if (request.method === "GET" && /^\/api\/monitoring\/division\/\d+$/.test(url.pathname)) {
      return handleMonitoringDivisionDetailRoute(
        request,
        getAuthService(),
        getMonitoringService(),
      );
    }

    if (request.method === "GET" && url.pathname === "/api/monitoring/overtime") {
      return handleMonitoringOvertimeRoute(
        request,
        getAuthService(),
        getMonitoringService(),
      );
    }

    if (request.method === "GET" && url.pathname === "/api/monitoring/no-start") {
      return handleMonitoringNoStartRoute(
        request,
        getAuthService(),
        getMonitoringService(),
      );
    }

    if (request.method === "GET" && url.pathname === "/api/monitoring/no-submit") {
      return handleMonitoringNoSubmitRoute(
        request,
        getAuthService(),
        getMonitoringService(),
      );
    }

    if (request.method === "GET" && url.pathname === "/api/issues") {
      return handleIssuesListRoute(request, getAuthService(), getIssuesService());
    }

    if (request.method === "GET" && url.pathname === "/api/gallery") {
      return handleGalleryListRoute(request, getAuthService(), getGalleryService());
    }

    if (request.method === "GET" && url.pathname === "/api/gallery/upload-ticket") {
      return handleGalleryUploadTicketRoute(
        request,
        getAuthService(),
        getGalleryService(),
      );
    }

    if (request.method === "POST" && url.pathname === "/api/gallery/photos") {
      return handleGalleryCreatePhotoRoute(
        request,
        getAuthService(),
        getGalleryService(),
      );
    }

    if (request.method === "POST" && url.pathname === "/api/issues") {
      return handleIssuesCreateRoute(request, getAuthService(), getIssuesService());
    }

    if (request.method === "GET" && url.pathname === "/api/issues/urgent") {
      return handleIssuesUrgentRoute(
        request,
        getAuthService(),
        getIssuesService(),
      );
    }

    if (request.method === "GET" && url.pathname === "/api/calendar/weekly-config") {
      return handleWeeklyConfigListRoute(
        request,
        getAuthService(),
        getCalendarService(),
      );
    }

    if (request.method === "POST" && url.pathname === "/api/calendar/weekly-config") {
      return handleWeeklyConfigUpsertRoute(
        request,
        getAuthService(),
        getCalendarService(),
      );
    }

    if (request.method === "GET" && url.pathname === "/api/calendar/working-days") {
      return handleWorkingDaysRoute(
        request,
        getAuthService(),
        getCalendarService(),
      );
    }

    if (request.method === "GET" && url.pathname === "/api/calendar/day-overrides") {
      return handleCalendarDayOverrideListRoute(
        request,
        getAuthService(),
        getCalendarService(),
      );
    }

    if (request.method === "POST" && url.pathname === "/api/calendar/day-overrides") {
      return handleCalendarDayOverrideUpsertRoute(
        request,
        getAuthService(),
        getCalendarService(),
      );
    }

    if (request.method === "POST" && url.pathname === "/api/calendar/simulate-capacity") {
      return handleCapacityPreviewRoute(
        request,
        getAuthService(),
        getCalendarService(),
      );
    }

    if (request.method === "GET" && url.pathname === "/api/planning/delivery-risk") {
      return handleDeliveryRiskRoute(
        request,
        getAuthService(),
        getCalendarService(),
      );
    }

    if (request.method === "GET" && url.pathname === "/api/planning/workspace") {
      return handlePlanningWorkspaceSummaryRoute(
        request,
        getAuthService(),
        getPlanningWorkspaceService(),
      );
    }

    if (request.method === "GET" && url.pathname === "/api/planning/work-control/units") {
      return handleWorkControlUnitsRoute(
        request,
        getAuthService(),
        getPlanningWorkControlService(),
      );
    }

    const workControlProgressMatch = url.pathname.match(
      /^\/api\/planning\/work-control\/units\/([^/]+)\/progress$/,
    );
    if (workControlProgressMatch && request.method === "GET") {
      return handleWorkControlUnitProgressRoute(
        request,
        workControlProgressMatch[1],
        getAuthService(),
        getPlanningWorkControlService(),
      );
    }

    if (request.method === "GET" && url.pathname === "/api/planning/work-control/capacity") {
      return handleWorkControlCapacityRoute(
        request,
        getAuthService(),
        getPlanningWorkControlService(),
      );
    }

    if (request.method === "GET" && url.pathname === "/api/planning/work-control/overtime-recommendations") {
      return handleWorkControlOvertimeRecommendationListRoute(
        request,
        getAuthService(),
        getPlanningWorkControlService(),
      );
    }

    if (request.method === "GET" && url.pathname === "/api/planning/work-control/service-templates") {
      return handleWorkControlServiceTemplatesRoute(
        request,
        getAuthService(),
        getPlanningWorkControlService(),
      );
    }

    if (request.method === "POST" && url.pathname === "/api/planning/work-control/targets") {
      return handleWorkControlCreateTargetRoute(
        request,
        getAuthService(),
        getPlanningWorkControlService(),
      );
    }

    if (request.method === "POST" && url.pathname === "/api/planning/work-control/release-spk") {
      return handleWorkControlReleaseSpkRoute(
        request,
        getAuthService(),
        getPlanningWorkControlService(),
      );
    }

    if (
      request.method === "POST" &&
      url.pathname === "/api/planning/work-control/overtime-recommendation"
    ) {
      return handleWorkControlOvertimeRecommendationRoute(
        request,
        getAuthService(),
        getPlanningWorkControlService(),
      );
    }

    if (request.method === "POST" && url.pathname === "/api/planning/work-control/service-intakes") {
      return handleWorkControlServiceIntakeRoute(
        request,
        getAuthService(),
        getPlanningWorkControlService(),
      );
    }

    if (request.method === "POST" && url.pathname === "/api/planning/work-control/calculation-snapshots") {
      return handleWorkControlCriticalPathSnapshotRoute(
        request,
        getAuthService(),
        getPlanningWorkControlService(),
      );
    }

    if (request.method === "POST" && url.pathname === "/api/planning/work-control/labour-overrides") {
      return handleWorkControlLabourOverrideRoute(
        request,
        getAuthService(),
        getPlanningWorkControlService(),
      );
    }

    if (request.method === "GET" && url.pathname === "/api/planning/evaluation") {
      return handlePlanningEvaluationRoute(
        request,
        getAuthService(),
        getPlanningEvaluationService(),
      );
    }

    if (request.method === "POST" && url.pathname === "/api/planning/weekly-plan") {
      return handleWeeklyPlanUpsertRoute(
        request,
        getAuthService(),
        getPlanningService(),
      );
    }

    if (request.method === "GET" && url.pathname === "/api/job-plan/export") {
      return handleJobPlanExportRoute(
        request,
        getAuthService(),
        getJobPlanService(),
      );
    }

    const workflowLayoutMatch = url.pathname.match(
      /^\/api\/units\/([^/]+)\/workflow-layout\/([^/]+)$/,
    );
    if (workflowLayoutMatch && request.method === "GET") {
      return handleWorkflowLayoutGetRoute(
        request,
        decodeURIComponent(workflowLayoutMatch[1]),
        decodeURIComponent(workflowLayoutMatch[2]),
        getAuthService(),
      );
    }
    if (workflowLayoutMatch && request.method === "PUT") {
      return handleWorkflowLayoutSaveRoute(
        request,
        decodeURIComponent(workflowLayoutMatch[1]),
        decodeURIComponent(workflowLayoutMatch[2]),
        getAuthService(),
      );
    }

    if (request.method === "GET" && url.pathname === "/api/job-plan/today") {
      return handleJobPlanTodayRoute(
        request,
        getAuthService(),
        getJobPlanService(),
      );
    }

    if (request.method === "GET" && url.pathname === "/api/job-plan/my-division") {
      return handleJobPlanMyDivisionRoute(
        request,
        getAuthService(),
        getJobPlanService(),
      );
    }

    if (request.method === "GET" && url.pathname === "/api/job-plan/pic-load") {
      return handleJobPlanPicLoadRoute(
        request,
        getAuthService(),
        getJobPlanService(),
      );
    }

    if (request.method === "POST" && url.pathname === "/api/job-plan") {
      return handleJobPlanCreateRoute(
        request,
        getAuthService(),
        getJobPlanService(),
      );
    }

    if (request.method === "POST" && url.pathname === "/api/job-plan/bulk") {
      return handleJobPlanBulkCreateRoute(
        request,
        getAuthService(),
        getJobPlanService(),
      );
    }

    if (request.method === "POST" && url.pathname === "/api/job-plan/workspace") {
      return handleJobPlanWorkspaceCreateRoute(
        request,
        getAuthService(),
        getJobPlanService(),
      );
    }

    if (request.method === "POST" && url.pathname === "/api/job-plan/draft") {
      return handleJobPlanDraftSaveRoute(
        request,
        getAuthService(),
        getJobPlanService(),
      );
    }

    if (request.method === "POST" && url.pathname === "/api/job-plan/draft/submit") {
      return handleJobPlanDraftSubmitRoute(
        request,
        getAuthService(),
        getJobPlanService(),
      );
    }

    if (request.method === "POST" && url.pathname === "/api/job-plan/draft/delete") {
      return handleJobPlanDraftDeleteRoute(
        request,
        getAuthService(),
        getJobPlanService(),
      );
    }

    if (request.method === "GET" && url.pathname === "/api/spk") {
      return handleSpkListRoute(request, getAuthService(), getSpkService());
    }

    if (request.method === "GET" && url.pathname === "/api/spk/preview") {
      return handleSpkPreviewRoute(request, getAuthService(), getSpkService());
    }

    if (request.method === "POST" && url.pathname === "/api/spk/generate") {
      return handleSpkGenerateRoute(request, getAuthService(), getSpkService());
    }

    if (request.method === "GET" && url.pathname === "/api/spk/today") {
      return handleSpkTodayRoute(request, getAuthService(), getSpkService());
    }

    if (request.method === "GET" && url.pathname === "/api/spk/summary") {
      return handleSpkSummaryRoute(request, getAuthService(), getSpkService());
    }

    if (request.method === "GET" && url.pathname === "/api/wo") {
      return handleWoListRoute(request, getAuthService(), getWoService());
    }

    if (request.method === "GET" && url.pathname === "/api/wo/pending-approval") {
      return handleWoPendingApprovalRoute(request, getAuthService(), getWoService());
    }

    if (request.method === "GET" && url.pathname === "/api/wo/my-division") {
      return handleWoMyDivisionRoute(request, getAuthService(), getWoService());
    }

    if (request.method === "GET" && url.pathname === "/api/wo/urgent") {
      return handleWoUrgentRoute(request, getAuthService(), getWoService());
    }

    if (request.method === "POST" && url.pathname === "/api/wo") {
      return handleWoCreateRoute(request, getAuthService(), getWoService());
    }

    if (request.method === "GET" && url.pathname === "/api/pr/upload-ticket") {
      return handlePrUploadTicketRoute(request, getAuthService());
    }

    if (request.method === "GET" && url.pathname === "/api/pr") {
      return handlePrListRoute(request, getAuthService(), getPrService());
    }

    if (request.method === "GET" && url.pathname === "/api/pr/critical") {
      return handlePrCriticalRoute(request, getAuthService(), getPrService());
    }

    if (request.method === "POST" && url.pathname === "/api/pr") {
      return handlePrCreateRoute(request, getAuthService(), getPrService());
    }

    if (request.method === "GET" && url.pathname === "/api/vendor") {
      return handleVendorListRoute(request, getAuthService(), getVendorService());
    }

    if (request.method === "POST" && url.pathname === "/api/vendor") {
      return handleVendorCreateRoute(request, getAuthService(), getVendorService());
    }

    if (request.method === "GET" && url.pathname === "/api/warehouse/transactions") {
      return handleWarehouseTransactionsRoute(
        request,
        getAuthService(),
        getWarehouseService(),
      );
    }

    if (request.method === "GET" && url.pathname === "/api/warehouse/dashboard") {
      return handleWarehouseDashboardRoute(
        request,
        getAuthService(),
        getWarehouseService(),
      );
    }

    if (request.method === "GET" && url.pathname === "/api/warehouse/pending-approval") {
      return handleWarehousePendingApprovalRoute(
        request,
        getAuthService(),
        getWarehouseService(),
      );
    }

    if (request.method === "GET" && url.pathname === "/api/warehouse/request-references") {
      return handleWarehouseRequestReferencesRoute(
        request,
        getAuthService(),
        getWarehouseService(),
      );
    }

    if (request.method === "GET" && url.pathname === "/api/warehouse/stock-card") {
      return handleWarehouseStockCardRoute(
        request,
        getAuthService(),
        getWarehouseService(),
      );
    }

    if (request.method === "GET" && url.pathname === "/api/warehouse/stock-card/upload-ticket") {
      return handleWarehouseStockCardUploadTicketRoute(
        request,
        getAuthService(),
        getWarehouseService(),
      );
    }

    if (request.method === "GET" && url.pathname === "/api/warehouse/items") {
      return handleWarehouseItemsRoute(
        request,
        getAuthService(),
        getWarehouseService(),
      );
    }

    if (request.method === "GET" && url.pathname === "/api/warehouse/material-usage") {
      return handleWarehouseMaterialUsageRoute(
        request,
        getAuthService(),
        getWarehouseService(),
      );
    }

    if (request.method === "GET" && url.pathname === "/api/warehouse/storage-locations") {
      return handleWarehouseStorageLocationsRoute(
        request,
        getAuthService(),
        getWarehouseService(),
      );
    }

    if (request.method === "GET" && url.pathname === "/api/warehouse/opname") {
      return handleWarehouseStockOpnameRoute(
        request,
        getAuthService(),
        getWarehouseService(),
      );
    }

    if (request.method === "GET" && url.pathname === "/api/warehouse/adjustments") {
      return handleWarehouseStockAdjustmentRoute(
        request,
        getAuthService(),
        getWarehouseService(),
      );
    }

    if (request.method === "GET" && url.pathname === "/api/bubut-invoices/work-orders") {
      return handleBubutInvoiceWorkOrdersRoute(
        request,
        getAuthService(),
        getBubutInvoiceService(),
      );
    }

    if (request.method === "POST" && url.pathname === "/api/bubut-invoices/preview") {
      return handleBubutInvoicePreviewRoute(
        request,
        getAuthService(),
        getBubutInvoiceService(),
      );
    }

    if (request.method === "POST" && url.pathname === "/api/bubut-invoices/release") {
      return handleBubutInvoiceReleaseRoute(
        request,
        getAuthService(),
        getBubutInvoiceService(),
      );
    }

    const woBubutInvoiceWorkHistoryMatch = url.pathname.match(
      /^\/api\/wo-bubut-invoice\/([^/]+)\/work-history$/u,
    );
    if (request.method === "GET" && woBubutInvoiceWorkHistoryMatch) {
      return handleBubutInvoiceWorkHistoryRoute(
        request,
        woBubutInvoiceWorkHistoryMatch[1],
        getAuthService(),
        getBubutInvoiceService(),
      );
    }

    const bubutInvoiceWorkHistoryMatch = url.pathname.match(
      /^\/api\/bubut-invoices\/([^/]+)\/work-history$/u,
    );
    if (request.method === "GET" && bubutInvoiceWorkHistoryMatch) {
      return handleBubutInvoiceWorkHistoryRoute(
        request,
        bubutInvoiceWorkHistoryMatch[1],
        getAuthService(),
        getBubutInvoiceService(),
      );
    }

    const reportsExportMatch = url.pathname.match(/^\/api\/reports\/([^/]+)\/export$/u);
    if (request.method === "GET" && reportsExportMatch) {
      const reportType = reportTypeSchema.safeParse(reportsExportMatch[1]);
      if (!reportType.success) {
        return jsonResponse({ message: "Not Found" }, 404);
      }

      return handleReportsExportRoute(
        request,
        reportType.data,
        getAuthService(),
        getReportsService(),
      );
    }

    const reportsGridMatch = url.pathname.match(/^\/api\/reports\/([^/]+)$/u);
    if (request.method === "GET" && reportsGridMatch) {
      const reportType = reportTypeSchema.safeParse(reportsGridMatch[1]);
      if (!reportType.success) {
        return jsonResponse({ message: "Not Found" }, 404);
      }

      return handleReportsGridRoute(
        request,
        reportType.data,
        getAuthService(),
        getReportsService(),
      );
    }

    const bubutInvoiceUpdateMatch = /^\/api\/bubut-invoices\/(\d+)$/u.exec(url.pathname);
    if (request.method === "PUT" && bubutInvoiceUpdateMatch) {
      return handleBubutInvoiceUpdateRoute(
        request,
        Number(bubutInvoiceUpdateMatch[1]),
        getAuthService(),
        getBubutInvoiceService(),
      );
    }

    const bubutInvoicePrintMatch = url.pathname.match(/^\/api\/bubut-invoices\/(\d+)\/print$/u);
    if (request.method === "GET" && bubutInvoicePrintMatch) {
      return handleBubutInvoicePrintRoute(
        request,
        Number(bubutInvoicePrintMatch[1]),
        getAuthService(),
        getBubutInvoiceService(),
      );
    }

    const bubutInvoiceCancelMatch = url.pathname.match(/^\/api\/bubut-invoices\/(\d+)\/cancel$/u);
    if (request.method === "PATCH" && bubutInvoiceCancelMatch) {
      return handleBubutInvoiceCancelRoute(
        request,
        Number(bubutInvoiceCancelMatch[1]),
        getAuthService(),
        getBubutInvoiceService(),
      );
    }

    const bubutInvoiceDetailMatch = url.pathname.match(/^\/api\/bubut-invoices\/(\d+)$/u);
    if (request.method === "GET" && bubutInvoiceDetailMatch) {
      return handleBubutInvoiceDetailRoute(
        request,
        Number(bubutInvoiceDetailMatch[1]),
        getAuthService(),
        getBubutInvoiceService(),
      );
    }

    if (request.method === "POST" && url.pathname === "/api/warehouse/request") {
      return handleWarehouseRequestCreateRoute(
        request,
        getAuthService(),
        getWarehouseService(),
      );
    }

    if (request.method === "POST" && url.pathname === "/api/warehouse/approve") {
      return handleWarehouseApproveRoute(
        request,
        getAuthService(),
        getWarehouseService(),
      );
    }

    if (request.method === "POST" && url.pathname === "/api/warehouse/reject") {
      return handleWarehouseRejectRoute(
        request,
        getAuthService(),
        getWarehouseService(),
      );
    }

    if (request.method === "POST" && url.pathname === "/api/warehouse/ready") {
      return handleWarehouseReadyRoute(
        request,
        getAuthService(),
        getWarehouseService(),
      );
    }

    if (request.method === "POST" && url.pathname === "/api/warehouse/issue") {
      return handleWarehouseIssueRoute(
        request,
        getAuthService(),
        getWarehouseService(),
      );
    }

    if (request.method === "POST" && url.pathname === "/api/warehouse/return") {
      return handleWarehouseReturnRoute(
        request,
        getAuthService(),
        getWarehouseService(),
      );
    }

    if (request.method === "POST" && url.pathname === "/api/warehouse/store") {
      return handleWarehouseStoreRoute(
        request,
        getAuthService(),
        getWarehouseService(),
      );
    }

    if (request.method === "POST" && url.pathname === "/api/warehouse/stock-card/photos") {
      return handleWarehouseStockCardPhotosRoute(
        request,
        getAuthService(),
        getWarehouseService(),
      );
    }

    if (request.method === "POST" && url.pathname === "/api/warehouse/storage-locations") {
      return handleWarehouseStorageLocationCreateRoute(
        request,
        getAuthService(),
        getWarehouseService(),
      );
    }

    if (request.method === "PUT" && url.pathname === "/api/warehouse/storage-locations") {
      return handleWarehouseStorageLocationUpdateRoute(
        request,
        getAuthService(),
        getWarehouseService(),
      );
    }

    const warehouseLocationMatch = url.pathname.match(/^\/api\/warehouse\/storage-locations\/(\d+)$/u);
    if (request.method === "DELETE" && warehouseLocationMatch) {
      return handleWarehouseStorageLocationDeleteRoute(
        request,
        Number(warehouseLocationMatch[1]),
        getAuthService(),
        getWarehouseService(),
      );
    }

    if (request.method === "POST" && url.pathname === "/api/warehouse/opname") {
      return handleWarehouseStockOpnameCreateRoute(
        request,
        getAuthService(),
        getWarehouseService(),
      );
    }

    if (request.method === "POST" && url.pathname === "/api/warehouse/adjustments") {
      return handleWarehouseStockAdjustmentCreateRoute(
        request,
        getAuthService(),
        getWarehouseService(),
      );
    }

    if (request.method === "GET" && url.pathname === "/api/qc/queue") {
      return handleQcQueueRoute(request, getAuthService(), getQcService());
    }

    if (request.method === "GET" && url.pathname === "/api/qc/rework") {
      return handleQcReworkRoute(request, getAuthService(), getQcService());
    }

    if (request.method === "GET" && url.pathname === "/api/qc/recheck") {
      return handleQcRecheckRoute(request, getAuthService(), getQcService());
    }

    if (request.method === "GET" && url.pathname === "/api/qa/inspections") {
      return handleQaPortalRoute(request, getAuthService(), getQaService());
    }

    if (request.method === "GET" && url.pathname === "/api/countdown/template") {
      return handleCountdownTemplateRoute(
        request,
        getAuthService(),
        getCountdownService(),
      );
    }

    const jobPlanStatusMatch = url.pathname.match(/^\/api\/job-plan\/([^/]+)\/status$/);
    if (jobPlanStatusMatch && request.method === "PATCH") {
      return handleJobPlanStatusRoute(
        request,
        jobPlanStatusMatch[1],
        getAuthService(),
        getJobPlanService(),
      );
    }

    const jobPlanMatch = url.pathname.match(/^\/api\/job-plan\/([^/]+)$/);
    if (jobPlanMatch) {
      if (request.method === "PUT") {
        return handleJobPlanUpdateRoute(
          request,
          jobPlanMatch[1],
          getAuthService(),
          getJobPlanService(),
        );
      }

      if (request.method === "DELETE") {
        return handleJobPlanDeleteRoute(
          request,
          jobPlanMatch[1],
          getAuthService(),
          getJobPlanService(),
        );
      }
    }

    const spkItemApprovalMatch = url.pathname.match(
      /^\/api\/spk\/([^/]+)\/item\/([^/]+)$/,
    );
    if (spkItemApprovalMatch && request.method === "PATCH") {
      return handleSpkItemApprovalRoute(
        request,
        spkItemApprovalMatch[1],
        spkItemApprovalMatch[2],
        getAuthService(),
        getSpkService(),
      );
    }

    const spkDraftDetailsMatch = url.pathname.match(/^\/api\/spk\/([^/]+)\/draft-details$/);
    if (spkDraftDetailsMatch && request.method === "PATCH") {
      return handleSpkDraftDetailsRoute(
        request,
        spkDraftDetailsMatch[1],
        getAuthService(),
        getSpkService(),
      );
    }

    const spkActionMatch = url.pathname.match(/^\/api\/spk\/([^/]+)\/(submit|approve|reject|activate|done)$/);
    if (spkActionMatch && request.method === "PATCH") {
      const spkId = spkActionMatch[1];
      const action = spkActionMatch[2];

      if (action === "submit") {
        return handleSpkSubmitRoute(
          request,
          spkId,
          getAuthService(),
          getSpkService(),
        );
      }

      if (action === "approve") {
        return handleSpkApproveRoute(
          request,
          spkId,
          getAuthService(),
          getSpkService(),
        );
      }

      if (action === "reject") {
        return handleSpkRejectRoute(
          request,
          spkId,
          getAuthService(),
          getSpkService(),
        );
      }

      if (action === "activate") {
        return handleSpkActivateRoute(
          request,
          spkId,
          getAuthService(),
          getSpkService(),
        );
      }

      return handleSpkDoneRoute(
        request,
        spkId,
        getAuthService(),
        getSpkService(),
      );
    }

    const spkMatch = url.pathname.match(/^\/api\/spk\/([^/]+)$/);
    if (spkMatch && request.method === "GET") {
      return handleSpkDetailRoute(
        request,
        spkMatch[1],
        getAuthService(),
        getSpkService(),
      );
    }

    const woLinkedCountdownsMatch = url.pathname.match(/^\/api\/wo\/([^/]+)\/linked-countdowns$/);
    if (woLinkedCountdownsMatch && request.method === "GET") {
      return handleWoLinkedCountdownsRoute(
        request,
        woLinkedCountdownsMatch[1],
        getAuthService(),
        getWoService(),
      );
    }

    const woActionMatch = url.pathname.match(/^\/api\/wo\/([^/]+)\/(approve|reject|done)$/);
    if (woActionMatch && request.method === "PATCH") {
      const woId = woActionMatch[1];
      const action = woActionMatch[2];

      if (action === "approve") {
        return handleWoApproveRoute(
          request,
          woId,
          getAuthService(),
          getWoService(),
        );
      }

      if (action === "reject") {
        return handleWoRejectRoute(
          request,
          woId,
          getAuthService(),
          getWoService(),
        );
      }

      return handleWoDoneRoute(
        request,
        woId,
        getAuthService(),
        getWoService(),
      );
    }

    const woMatch = url.pathname.match(/^\/api\/wo\/([^/]+)$/);
    if (woMatch && request.method === "GET") {
      return handleWoDetailRoute(
        request,
        woMatch[1],
        getAuthService(),
        getWoService(),
      );
    }

    const prActionMatch = url.pathname.match(/^\/api\/pr\/([^/]+)\/(approve|order|receive|cancel)$/);
    if (prActionMatch && request.method === "PATCH") {
      const prId = prActionMatch[1];
      const action = prActionMatch[2];

      if (action === "approve") {
        return handlePrApproveRoute(request, prId, getAuthService(), getPrService());
      }

      if (action === "order") {
        return handlePrOrderRoute(request, prId, getAuthService(), getPrService());
      }

      if (action === "receive") {
        return handlePrReceiveRoute(request, prId, getAuthService(), getPrService());
      }

      return handlePrCancelRoute(request, prId, getAuthService(), getPrService());
    }

    const prMatch = url.pathname.match(/^\/api\/pr\/([^/]+)$/);
    if (prMatch && request.method === "GET") {
      return handlePrDetailRoute(
        request,
        prMatch[1],
        getAuthService(),
        getPrService(),
      );
    }

    const vendorActionMatch = url.pathname.match(/^\/api\/vendor\/([^/]+)\/(approve|status|receive|cancel)$/);
    if (vendorActionMatch && request.method === "PATCH") {
      const wovId = vendorActionMatch[1];
      const action = vendorActionMatch[2];

      if (action === "approve") {
        return handleVendorApproveRoute(
          request,
          wovId,
          getAuthService(),
          getVendorService(),
        );
      }

      if (action === "status") {
        return handleVendorStatusRoute(
          request,
          wovId,
          getAuthService(),
          getVendorService(),
        );
      }

      if (action === "receive") {
        return handleVendorReceiveRoute(
          request,
          wovId,
          getAuthService(),
          getVendorService(),
        );
      }

      return handleVendorCancelRoute(
        request,
        wovId,
        getAuthService(),
        getVendorService(),
      );
    }

    const vendorMatch = url.pathname.match(/^\/api\/vendor\/([^/]+)$/);
    if (vendorMatch && request.method === "GET") {
      return handleVendorDetailRoute(
        request,
        vendorMatch[1],
        getAuthService(),
        getVendorService(),
      );
    }

    const issueUnitMatch = url.pathname.match(/^\/api\/issues\/unit\/([^/]+)$/);
    if (issueUnitMatch && request.method === "GET") {
      return handleIssuesByUnitRoute(
        request,
        issueUnitMatch[1],
        getAuthService(),
        getIssuesService(),
      );
    }

    const issueActionMatch = url.pathname.match(
      /^\/api\/issues\/([^/]+)\/(acknowledge|assign|start|qc-recheck|resolve|escalate|waive)$/,
    );
    if (issueActionMatch && request.method === "PATCH") {
      const issueId = issueActionMatch[1];
      const action = issueActionMatch[2];

      if (action === "acknowledge") {
        return handleIssuesAcknowledgeRoute(
          request,
          issueId,
          getAuthService(),
          getIssuesService(),
        );
      }

      if (action === "assign") {
        return handleIssuesAssignRoute(
          request,
          issueId,
          getAuthService(),
          getIssuesService(),
        );
      }

      if (action === "start") {
        return handleIssuesStartRoute(
          request,
          issueId,
          getAuthService(),
          getIssuesService(),
        );
      }

      if (action === "qc-recheck") {
        return handleIssuesQcRecheckRoute(
          request,
          issueId,
          getAuthService(),
          getIssuesService(),
        );
      }

      if (action === "resolve") {
        return handleIssuesResolveRoute(
          request,
          issueId,
          getAuthService(),
          getIssuesService(),
        );
      }

      if (action === "escalate") {
        return handleIssuesEscalateRoute(
          request,
          issueId,
          getAuthService(),
          getIssuesService(),
        );
      }

      return handleIssuesWaiveRoute(
        request,
        issueId,
        getAuthService(),
        getIssuesService(),
      );
    }

    const issueMatch = url.pathname.match(/^\/api\/issues\/([^/]+)$/);
    if (issueMatch && request.method === "GET") {
      return handleIssuesDetailRoute(
        request,
        issueMatch[1],
        getAuthService(),
        getIssuesService(),
      );
    }

    const galleryPhotosMatch = url.pathname.match(/^\/api\/gallery\/([^/]+)\/photos$/);
    if (galleryPhotosMatch && request.method === "GET") {
      return handleGalleryPhotosRoute(
        request,
        galleryPhotosMatch[1],
        getAuthService(),
        getGalleryService(),
      );
    }

    const galleryPhotoMatch = url.pathname.match(/^\/api\/gallery\/photos\/([^/]+)$/);
    if (galleryPhotoMatch && request.method === "PUT") {
      return handleGalleryUpdatePhotoRoute(
        request,
        galleryPhotoMatch[1],
        getAuthService(),
        getGalleryService(),
      );
    }

    if (galleryPhotoMatch && request.method === "DELETE") {
      return handleGalleryDeletePhotoRoute(
        request,
        galleryPhotoMatch[1],
        getAuthService(),
        getGalleryService(),
      );
    }

    const qcFinalChecklistActionMatch = url.pathname.match(
      /^\/api\/qc\/final-checklist\/([^/]+)\/approve$/,
    );
    if (qcFinalChecklistActionMatch && request.method === "POST") {
      return handleQcFinalChecklistApproveRoute(
        request,
        qcFinalChecklistActionMatch[1],
        getAuthService(),
        getQcService(),
      );
    }

    const qcFinalChecklistMatch = url.pathname.match(/^\/api\/qc\/final-checklist\/([^/]+)$/);
    if (qcFinalChecklistMatch && request.method === "GET") {
      return handleQcFinalChecklistRoute(
        request,
        qcFinalChecklistMatch[1],
        getAuthService(),
        getQcService(),
      );
    }

    const qaInspectionMatch = url.pathname.match(/^\/api\/qa\/inspections\/([^/]+)$/);
    if (qaInspectionMatch && request.method === "PATCH") {
      return handleQaInspectionUpdateRoute(
        request,
        qaInspectionMatch[1],
        getAuthService(),
        getQaService(),
      );
    }

    const qcActionMatch = url.pathname.match(/^\/api\/qc\/([^/]+)\/(pass|reject)$/);
    if (qcActionMatch && request.method === "POST") {
      if (qcActionMatch[2] === "pass") {
        return handleQcPassRoute(
          request,
          qcActionMatch[1],
          getAuthService(),
          getQcService(),
        );
      }

      return handleQcRejectRoute(
        request,
        qcActionMatch[1],
        getAuthService(),
        getQcService(),
      );
    }

    const qcDetailMatch = url.pathname.match(/^\/api\/qc\/([^/]+)$/);
    if (qcDetailMatch && request.method === "GET") {
      return handleQcDetailRoute(
        request,
        qcDetailMatch[1],
        getAuthService(),
        getQcService(),
      );
    }

    const planningEtaMatch = url.pathname.match(/^\/api\/planning\/eta\/([^/]+)$/);
    if (planningEtaMatch && request.method === "GET") {
      return handleUnitEtaRoute(
        request,
        planningEtaMatch[1],
        getAuthService(),
        getCalendarService(),
      );
    }

    const weeklyPlanOvertimeMatch = url.pathname.match(
      /^\/api\/planning\/weekly-plan\/([^/]+)\/overtime$/,
    );
    if (weeklyPlanOvertimeMatch && request.method === "POST") {
      return handleWeeklyPlanOvertimeRoute(
        request,
        weeklyPlanOvertimeMatch[1],
        getAuthService(),
        getPlanningService(),
      );
    }

    const weeklyPlanDivisionMatch = url.pathname.match(
      /^\/api\/planning\/weekly-plan\/([^/]+)\/divisions$/,
    );
    if (weeklyPlanDivisionMatch && request.method === "POST") {
      return handleWeeklyPlanDivisionRoute(
        request,
        weeklyPlanDivisionMatch[1],
        getAuthService(),
        getPlanningService(),
      );
    }

    const weeklyPlanUnitsMatch = url.pathname.match(
      /^\/api\/planning\/weekly-plan\/([^/]+)\/units$/,
    );
    if (weeklyPlanUnitsMatch && request.method === "POST") {
      return handleWeeklyPlanUnitsRoute(
        request,
        weeklyPlanUnitsMatch[1],
        getAuthService(),
        getPlanningService(),
      );
    }

    const weeklyPlanSnapshotMatch = url.pathname.match(
      /^\/api\/planning\/weekly-plan\/([^/]+)\/snapshot-absence$/,
    );
    if (weeklyPlanSnapshotMatch && request.method === "POST") {
      return handleWeeklyPlanSnapshotAbsenceRoute(
        request,
        weeklyPlanSnapshotMatch[1],
        getAuthService(),
        getPlanningService(),
      );
    }

    const weeklyPlanPublishMatch = url.pathname.match(
      /^\/api\/planning\/weekly-plan\/([^/]+)\/publish$/,
    );
    if (weeklyPlanPublishMatch && request.method === "POST") {
      return handleWeeklyPlanPublishRoute(
        request,
        weeklyPlanPublishMatch[1],
        getAuthService(),
        getPlanningService(),
      );
    }

    const weeklyPlanGapMatch = url.pathname.match(
      /^\/api\/planning\/weekly-plan\/([^/]+)\/gap$/,
    );
    if (weeklyPlanGapMatch && request.method === "GET") {
      return handleWeeklyPlanGapRoute(
        request,
        weeklyPlanGapMatch[1],
        getAuthService(),
        getPlanningService(),
      );
    }

    const weeklyPlanAlertsMatch = url.pathname.match(
      /^\/api\/planning\/weekly-plan\/([^/]+)\/alerts$/,
    );
    if (weeklyPlanAlertsMatch && request.method === "GET") {
      return handleWeeklyPlanAlertsRoute(
        request,
        weeklyPlanAlertsMatch[1],
        getAuthService(),
        getPlanningService(),
      );
    }

    const weeklyPlanDetailMatch = url.pathname.match(
      /^\/api\/planning\/weekly-plan\/([^/]+)$/,
    );
    if (weeklyPlanDetailMatch && request.method === "GET") {
      return handleWeeklyPlanDetailRoute(
        request,
        weeklyPlanDetailMatch[1],
        getAuthService(),
        getPlanningService(),
      );
    }

    if (request.method === "POST" && url.pathname === "/api/countdown/import") {
      return handleCountdownImportRoute(
        request,
        getAuthService(),
        getCountdownService(),
      );
    }

    const unitWorkspaceMatch = url.pathname.match(/^\/api\/units\/([^/]+)\/workspace$/);
    if (unitWorkspaceMatch && request.method === "GET") {
      const unitId = unitWorkspaceMatch[1];
      return handleUnitWorkspaceRoute(
        request,
        unitId,
        getAuthService(),
        getUnitsService(),
      );
    }

    const unitBomMatch = url.pathname.match(/^\/api\/units\/([^/]+)\/bom$/);
    if (unitBomMatch && request.method === "GET") {
      const unitId = unitBomMatch[1];
      return handleUnitBomRoute(
        request,
        unitId,
        getAuthService(),
        getUnitsService(),
      );
    }

    const unitPanelsMatch = url.pathname.match(/^\/api\/units\/([^/]+)\/master-panels$/);
    if (unitPanelsMatch && (request.method === "GET" || request.method === "POST")) {
      const unitId = unitPanelsMatch[1];
      return handleUnitPanelsRoute(
        request,
        unitId,
        getAuthService(),
        getUnitsService(),
      );
    }

    const unitPanelDetailMatch = url.pathname.match(/^\/api\/units\/([^/]+)\/master-panels\/(\d+)$/);
    if (unitPanelDetailMatch && (request.method === "PUT" || request.method === "DELETE")) {
      const unitId = unitPanelDetailMatch[1];
      const panelId = Number.parseInt(unitPanelDetailMatch[2], 10);
      return handleUnitPanelDetailRoute(
        request,
        unitId,
        panelId,
        getAuthService(),
        getUnitsService(),
      );
    }

    const unitMatch = url.pathname.match(/^\/api\/units\/([^/]+)$/);
    if (unitMatch && request.method === "GET") {
      const unitId = unitMatch[1];
      return handleUnitDetailRoute(
        request,
        unitId,
        getAuthService(),
        getUnitsService(),
      );
    }

    const countdownMatch = url.pathname.match(/^\/api\/countdown\/([^/]+)$/);
    if (countdownMatch && request.method === "GET") {
      const countdownId = countdownMatch[1];
      return handleCountdownDetailRoute(
        request,
        countdownId,
        getAuthService(),
        getCountdownService(),
      );
    }

    if (countdownMatch && request.method === "PUT") {
      const countdownId = countdownMatch[1];
      return handleCountdownUpdateRoute(
        request,
        countdownId,
        getAuthService(),
        getCountdownService(),
      );
    }

    if (countdownMatch && request.method === "DELETE") {
      const countdownId = countdownMatch[1];
      return handleCountdownDeleteRoute(
        request,
        countdownId,
        getAuthService(),
        getCountdownService(),
      );
    }

    return jsonResponse({ message: "Not Found" }, 404);
  };
}
