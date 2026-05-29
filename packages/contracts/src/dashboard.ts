import { z } from "zod";

export const dashboardRiskLevelSchema = z.enum([
  "GREEN",
  "YELLOW",
  "ORANGE",
  "RED",
  "BLACK",
]);

export const dashboardHeadlineSchema = z.object({
  title: z.string().trim().min(1).max(120),
  subtitle: z.string().trim().min(1).max(255),
  scopeNote: z.string().trim().min(1).max(255),
  highlights: z.array(z.string().trim().min(1).max(255)).max(5),
});

export const dashboardKpiSchema = z.object({
  activeUnits: z.number().int().nonnegative(),
  deliveryThisWeek: z.number().int().nonnegative(),
  overdueUnits: z.number().int().nonnegative(),
  urgentIssues: z.number().int().nonnegative(),
});

export const dashboardDeliveryRiskItemSchema = z.object({
  carId: z.string(),
  unitName: z.string(),
  customerName: z.string().nullable(),
  targetDeliveryDate: z.string().nullable(),
  predictedDeliveryDate: z.string().nullable(),
  riskLevel: dashboardRiskLevelSchema,
  remainingHours: z.number().nonnegative(),
  effectiveDailyCapacity: z.number().nonnegative(),
});

export const dashboardDeliveryRiskSummarySchema = z.object({
  green: z.number().int().nonnegative(),
  yellow: z.number().int().nonnegative(),
  orange: z.number().int().nonnegative(),
  red: z.number().int().nonnegative(),
  black: z.number().int().nonnegative(),
});

export const dashboardDeliveryRiskSectionSchema = z.object({
  summary: dashboardDeliveryRiskSummarySchema,
  topUnits: z.array(dashboardDeliveryRiskItemSchema).max(5),
});

export const dashboardUnitProgressItemSchema = z.object({
  divisionId: z.number().int().nullable(),
  divisionName: z.string(),
  activeUnits: z.number().int().nonnegative(),
  avgProgressPercent: z.number().nonnegative(),
  completedPanels: z.number().int().nonnegative(),
  plannedPanels: z.number().int().nonnegative(),
  actualHours: z.number().nonnegative(),
});

export const dashboardQcTrendPointSchema = z.object({
  date: z.string(),
  passCount: z.number().int().nonnegative(),
  rejectCount: z.number().int().nonnegative(),
});

export const dashboardUrgentIssueItemSchema = z.object({
  issueId: z.string(),
  issueNumber: z.string(),
  title: z.string(),
  unitName: z.string(),
  divisionName: z.string().nullable(),
  severity: z.enum(["LOW", "MEDIUM", "HIGH"]),
  status: z.string(),
  ageDays: z.number().int().nonnegative(),
});

export const dashboardCountdownOverdueItemSchema = z.object({
  countdownId: z.string(),
  carId: z.string(),
  unitName: z.string(),
  divisionName: z.string().nullable(),
  panelName: z.string(),
  deadlineDate: z.string().nullable(),
  overdueDays: z.number().int().nonnegative(),
  remainingHours: z.number().nonnegative(),
});

export const dashboardManhourDivisionItemSchema = z.object({
  divisionId: z.number().int(),
  divisionName: z.string(),
  capacityHours: z.number().nonnegative(),
  plannedHours: z.number().nonnegative(),
  actualHours: z.number().nonnegative(),
  remainingHours: z.number().nonnegative(),
  utilizationPercent: z.number().nonnegative().nullable(),
});

export const dashboardManhourEmployeeItemSchema = z.object({
  employeeId: z.string(),
  employeeName: z.string(),
  divisionName: z.string().nullable(),
  actualHours: z.number().nonnegative(),
});

export const dashboardManhourSummarySchema = z.object({
  weekStartDate: z.string(),
  planStatus: z.enum(["DRAFT", "PUBLISHED", "CLOSED"]),
  targetHours: z.number().nonnegative().nullable(),
  byDivision: z.array(dashboardManhourDivisionItemSchema),
  byEmployee: z.array(dashboardManhourEmployeeItemSchema).optional(),
});

export const dashboardDivisionKpiItemSchema = z.object({
  divisionId: z.number().int(),
  divisionName: z.string(),
  activeUnits: z.number().int().nonnegative(),
  avgProgressPercent: z.number().nonnegative(),
  completedPanels: z.number().int().nonnegative(),
  plannedPanels: z.number().int().nonnegative(),
  totalHours: z.number().nonnegative(),
});

export const dashboardPendingActionsSchema = z.object({
  woApproval: z.number().int().nonnegative().nullable(),
  prApproval: z.number().int().nonnegative().nullable(),
  vendorApproval: z.number().int().nonnegative().nullable(),
  warehouseApproval: z.number().int().nonnegative().nullable(),
  total: z.number().int().nonnegative(),
});

export const dashboardMonitoringFlagsSchema = z.object({
  noStart: z.number().int().nonnegative(),
  noSubmit: z.number().int().nonnegative(),
  delayRisk: z.number().int().nonnegative(),
  overtimeCount: z.number().int().nonnegative(),
});

export const dashboardUnitWorkHourItemSchema = z.object({
  carId: z.string(),
  unitName: z.string(),
  actualHours: z.number().nonnegative(),
});

export const dashboardSummarySchema = z.object({
  generatedAt: z.string(),
  asOfDate: z.string(),
  headline: dashboardHeadlineSchema,
  kpis: dashboardKpiSchema,
  deliveryRisk: dashboardDeliveryRiskSectionSchema.nullable(),
  unitProgress: z.array(dashboardUnitProgressItemSchema).nullable(),
  qcTrend: z.array(dashboardQcTrendPointSchema).nullable(),
  urgentIssues: z.array(dashboardUrgentIssueItemSchema).nullable(),
  countdownOverdue: z.array(dashboardCountdownOverdueItemSchema).nullable(),
  manhour: dashboardManhourSummarySchema.nullable(),
  divisionKpis: z.array(dashboardDivisionKpiItemSchema).nullable(),
  pendingActions: dashboardPendingActionsSchema.nullable(),
  monitoringFlags: dashboardMonitoringFlagsSchema.nullable(),
  unitWorkHours: z.array(dashboardUnitWorkHourItemSchema).nullable().optional(),
});

export const dashboardSummaryEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: dashboardSummarySchema,
});

export type DashboardHeadline = z.infer<typeof dashboardHeadlineSchema>;
export type DashboardKpi = z.infer<typeof dashboardKpiSchema>;
export type DashboardDeliveryRiskItem = z.infer<typeof dashboardDeliveryRiskItemSchema>;
export type DashboardDeliveryRiskSummary = z.infer<typeof dashboardDeliveryRiskSummarySchema>;
export type DashboardDeliveryRiskSection = z.infer<typeof dashboardDeliveryRiskSectionSchema>;
export type DashboardUnitProgressItem = z.infer<typeof dashboardUnitProgressItemSchema>;
export type DashboardQcTrendPoint = z.infer<typeof dashboardQcTrendPointSchema>;
export type DashboardUrgentIssueItem = z.infer<typeof dashboardUrgentIssueItemSchema>;
export type DashboardCountdownOverdueItem = z.infer<typeof dashboardCountdownOverdueItemSchema>;
export type DashboardManhourDivisionItem = z.infer<typeof dashboardManhourDivisionItemSchema>;
export type DashboardManhourSummary = z.infer<typeof dashboardManhourSummarySchema>;
export type DashboardDivisionKpiItem = z.infer<typeof dashboardDivisionKpiItemSchema>;
export type DashboardPendingActions = z.infer<typeof dashboardPendingActionsSchema>;
export type DashboardMonitoringFlags = z.infer<typeof dashboardMonitoringFlagsSchema>;
export type DashboardSummaryPayload = z.infer<typeof dashboardSummarySchema>;
