import { z } from "zod";
import {
  gridMetaSchema,
  gridQueryStateSchema,
} from "./grid";

export const weeklyWorkConfigRecordSchema = z.object({
  configId: z.string(),
  weekStartDate: z.string(),
  weekdayHours: z.number().nonnegative(),
  saturdayHours: z.number().nonnegative(),
  sundayHours: z.number().nonnegative(),
  weekdayOvertimeHours: z.number().nonnegative(),
  saturdayOvertimeHours: z.number().nonnegative(),
  sundayOvertimeHours: z.number().nonnegative(),
  efficiencyFactor: z.number().positive(),
  qcBufferDays: z.number().int().nonnegative(),
  createdBy: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const weeklyWorkConfigRequestSchema = z.object({
  weekStartDate: z.string().trim().min(1),
  weekdayHours: z.number().nonnegative(),
  saturdayHours: z.number().nonnegative(),
  sundayHours: z.number().nonnegative(),
  weekdayOvertimeHours: z.number().nonnegative(),
  saturdayOvertimeHours: z.number().nonnegative(),
  sundayOvertimeHours: z.number().nonnegative(),
  efficiencyFactor: z.number().positive(),
  qcBufferDays: z.number().int().nonnegative(),
});

export const workingDaySchema = z.object({
  date: z.string(),
  dayName: z.string(),
  workingHours: z.number().nonnegative(),
  overtimeHours: z.number().nonnegative(),
  totalCapacityHours: z.number().nonnegative(),
  isWorkingDay: z.boolean(),
});

export const workingDaysRequestSchema = z.object({
  startDate: z.string().trim().min(1),
  endDate: z.string().trim().min(1),
  includeOvertime: z.boolean().optional().default(false),
});

export const workingDaysEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    startDate: z.string(),
    endDate: z.string(),
    includeOvertime: z.boolean(),
    days: z.array(workingDaySchema),
  }),
});

export const capacityPreviewRequestSchema = z.object({
  divisionId: z.number().int().positive(),
  date: z.string().trim().min(1),
  activePicCount: z.number().int().positive(),
  includeOvertime: z.boolean().optional().default(false),
});

export const capacityPreviewRecordSchema = z.object({
  divisionId: z.number().int().positive(),
  divisionName: z.string(),
  activePicCount: z.number().int().nonnegative(),
  workingHours: z.number().nonnegative(),
  efficiencyFactor: z.number().positive(),
  effectiveDailyCapacity: z.number().nonnegative(),
});

export const capacityPreviewEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: capacityPreviewRecordSchema,
});

export const unitEtaRecordSchema = z.object({
  carId: z.string(),
  unitName: z.string(),
  customerName: z.string().nullable(),
  targetDeliveryDate: z.string().nullable(),
  predictedDeliveryDate: z.string().nullable(),
  riskLevel: z.enum(["GREEN", "YELLOW", "ORANGE", "RED", "BLACK"]),
  remainingHours: z.number().nonnegative(),
  effectiveDailyCapacity: z.number().nonnegative(),
  etaDays: z.number().int().nonnegative(),
  blockerDelayDays: z.number().int().nonnegative(),
  qcBufferDays: z.number().int().nonnegative(),
});

export const unitEtaEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: unitEtaRecordSchema,
});

export const deliveryRiskQuerySchema = gridQueryStateSchema.extend({
  asOfDate: z.string().trim().min(1),
});

export const deliveryRiskSummarySchema = z.object({
  green: z.number().int().nonnegative(),
  yellow: z.number().int().nonnegative(),
  orange: z.number().int().nonnegative(),
  red: z.number().int().nonnegative(),
  black: z.number().int().nonnegative(),
});

export const deliveryRiskEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.array(unitEtaRecordSchema),
  meta: gridMetaSchema,
  query: deliveryRiskQuerySchema,
  summary: deliveryRiskSummarySchema,
});

export const weeklyConfigListEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.array(weeklyWorkConfigRecordSchema),
});

export const weeklyPlanStatusSchema = z.enum(["DRAFT", "PUBLISHED", "CLOSED"]);

export const weeklyPlanSchema = z.object({
  planId: z.string(),
  weekStartDate: z.string(),
  targetHours: z.number(),
  targetIncome: z.number().nullable(),
  labourRate: z.number().nullable(),
  createdBy: z.string(),
  notes: z.string().nullable(),
  status: weeklyPlanStatusSchema,
  createdAt: z.string(),
});

export const weeklyPlanRequestSchema = z.object({
  weekStartDate: z.string(),
  targetHours: z.number().nonnegative(),
  labourRate: z.number().positive().optional(),
  notes: z.string().optional(),
});

export const planningMaterialStatusSchema = z.enum([
  "READY",
  "HUNTING",
  "ORDERED",
  "VENDOR",
]);

export const planOvertimeSchema = z.object({
  divisionId: z.number().int(),
  overtimeDate: z.string(),
  dayType: z.enum(["WEEKDAY", "SATURDAY", "SUNDAY"]),
  overtimeHours: z.number().positive(),
  memberCount: z.number().int().positive(),
  includeHead: z.boolean().default(false),
  notes: z.string().optional(),
});

export const planUnitSchema = z.object({
  carId: z.string(),
  divisionId: z.number().int(),
  allocatedHours: z.number().min(0),
  priorityRank: z.number().int().optional(),
  notes: z.string().optional(),
});

export const planDivisionInputSchema = z.object({
  divisionId: z.number().int(),
  memberCount: z.number().int().min(0),
});

export const weeklyPlanDivisionInputRecordSchema = z.object({
  divisionId: z.number().int(),
  divisionName: z.string(),
  autoMemberCount: z.number().int().nonnegative(),
  memberCount: z.number().int().nonnegative(),
});

export const divisionCapacitySummarySchema = z.object({
  divisionId: z.number(),
  divisionName: z.string(),
  memberCountActive: z.number(),
  normalCapacityHours: z.number(),
  overtimeCapacityHours: z.number(),
  absenceLostHours: z.number(),
  netCapacityHours: z.number(),
  allocatedHours: z.number(),
  utilizationPct: z.number(),
});

export const weeklyGapResultSchema = z.object({
  targetHours: z.number(),
  totalNetCapacity: z.number(),
  deficit: z.number(),
  byDivision: z.array(divisionCapacitySummarySchema),
});

export const planAlertTypeSchema = z.enum([
  "GAP_DEFICIT",
  "GAP_SURPLUS",
  "UNIT_RISK",
  "ABSENCE_IMPACT",
  "OVERTIME_EXCESSIVE",
  "NON_MARGIN_IDLE",
  "ALLOCATION_OVERFLOW",
]);

export const planAlertSeveritySchema = z.enum(["INFO", "WARNING", "CRITICAL"]);

export const planAlertSchema = z.object({
  type: planAlertTypeSchema,
  severity: planAlertSeveritySchema,
  message: z.string(),
  divisionId: z.number().optional(),
  carId: z.string().optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
});

export const planRecommendationScheduleSchema = z.object({
  date: z.string(),
  dayName: z.string(),
  extraHoursRecommended: z.number().nonnegative(),
  remainingCapacityHours: z.number().nonnegative(),
});

export const planRecommendationDivisionSchema = z.object({
  divisionId: z.number(),
  divisionName: z.string(),
  targetHours: z.number().nonnegative(),
  effectiveNormalHours: z.number().nonnegative(),
  scheduledOvertimeHours: z.number().nonnegative(),
  additionalOvertimeHours: z.number().nonnegative(),
  uncoveredHours: z.number().nonnegative(),
  overtimeDaysRecommended: z.number().int().nonnegative(),
  lockedUnitCount: z.number().int().nonnegative(),
  schedule: z.array(planRecommendationScheduleSchema),
});

export const planRecommendationUnitDivisionSchema = z.object({
  divisionId: z.number(),
  divisionName: z.string(),
  remainingHours: z.number().nonnegative(),
  recommendedHours: z.number().nonnegative(),
  progressPercent: z.number().nonnegative(),
  panelCount: z.number().int().nonnegative(),
  lockedPanelCount: z.number().int().nonnegative(),
  isFocus: z.boolean(),
});

export const planRecommendationUnitSchema = z.object({
  carId: z.string(),
  unitName: z.string(),
  customerName: z.string().nullable(),
  targetDeliveryDate: z.string().nullable(),
  isMargin: z.boolean(),
  materialStatus: planningMaterialStatusSchema,
  materialReady: z.boolean(),
  materialNote: z.string().nullable(),
  totalRemainingHours: z.number().nonnegative(),
  recommendedHours: z.number().nonnegative(),
  uncoveredHours: z.number().nonnegative(),
  lockedDivisionName: z.string().nullable(),
  focusReason: z.string(),
  divisions: z.array(planRecommendationUnitDivisionSchema),
});

export const planRecommendationSummarySchema = z.object({
  targetHours: z.number().nonnegative(),
  totalDemandHours: z.number().nonnegative(),
  effectiveNormalHours: z.number().nonnegative(),
  scheduledOvertimeHours: z.number().nonnegative(),
  additionalOvertimeHours: z.number().nonnegative(),
  uncoveredHours: z.number().nonnegative(),
  overtimeDaysRecommended: z.number().int().nonnegative(),
  bottleneckDivisionName: z.string().nullable(),
});

export const planRecommendationSchema = z.object({
  summary: planRecommendationSummarySchema,
  divisions: z.array(planRecommendationDivisionSchema),
  units: z.array(planRecommendationUnitSchema),
});

export const weeklyPlanDetailsEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    plan: weeklyPlanSchema.nullable(),
    capacity: z.array(divisionCapacitySummarySchema),
    gap: weeklyGapResultSchema,
    alerts: z.array(planAlertSchema),
    recommendations: planRecommendationSchema.nullable(),
  }),
});

const planningWorkspaceDivisionOptionSchema = z.object({
  label: z.string(),
  value: z.string(),
});

export const planningWorkspaceSummarySchema = z.object({
  asOfDate: z.string(),
  weekStartDate: z.string(),
  canManage: z.boolean(),
  weeklyConfigs: z.array(weeklyWorkConfigRecordSchema),
  workingDays: z.object({
    startDate: z.string(),
    endDate: z.string(),
    includeOvertime: z.boolean(),
    days: z.array(workingDaySchema),
  }),
  deliveryRisk: z.object({
    rows: z.array(unitEtaRecordSchema),
    meta: gridMetaSchema,
    query: deliveryRiskQuerySchema,
    summary: deliveryRiskSummarySchema,
  }),
  divisionOptions: z.array(planningWorkspaceDivisionOptionSchema),
  weeklyPlan: z.object({
    plan: weeklyPlanSchema.nullable(),
    capacity: z.array(divisionCapacitySummarySchema),
    gap: weeklyGapResultSchema,
    alerts: z.array(planAlertSchema),
    recommendations: planRecommendationSchema.nullable(),
    overtime: z.array(
      z.object({
        divisionId: z.number(),
        divisionName: z.string(),
        overtimeDate: z.string(),
        dayType: z.enum(["WEEKDAY", "SATURDAY", "SUNDAY"]),
        overtimeHours: z.number(),
        memberCount: z.number(),
        includeHead: z.boolean(),
        notes: z.string().nullable(),
      }),
    ),
    divisionInputs: z.array(weeklyPlanDivisionInputRecordSchema),
    units: z.array(
      z.object({
        carId: z.string(),
        divisionId: z.number(),
        divisionName: z.string(),
        allocatedHours: z.number(),
        priorityRank: z.number().nullable(),
        notes: z.string().nullable(),
        unitName: z.string(),
        customerName: z.string().nullable(),
        isMargin: z.boolean(),
        materialStatus: planningMaterialStatusSchema,
        materialReady: z.boolean(),
        materialNote: z.string().nullable(),
        targetDeliveryDate: z.string().nullable(),
        remainingHours: z.number(),
      }),
    ),
    planningUnits: z.array(
      z.object({
        carId: z.string(),
        unitName: z.string(),
        customerName: z.string().nullable(),
        targetDeliveryDate: z.string().nullable(),
        remainingHours: z.number(),
        isMargin: z.boolean(),
        materialStatus: planningMaterialStatusSchema,
        materialReady: z.boolean(),
        materialNote: z.string().nullable(),
        lockedDivisionName: z.string().nullable(),
      }),
    ),
  }),
});

export const planningWorkspaceEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: planningWorkspaceSummarySchema,
});

export const weeklyPlanEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: weeklyPlanSchema,
});

export const weeklyPlanPublishEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    plan: weeklyPlanSchema,
    spkDraftId: z.string(),
    generatedOvertimeRows: z.number().int().nonnegative(),
  }),
});

export const weeklyPlanCapacityEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.array(divisionCapacitySummarySchema),
});

export const weeklyPlanGapEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: weeklyGapResultSchema,
});

export const weeklyPlanAlertsEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.array(planAlertSchema),
});

export type WeeklyWorkConfigRecord = z.infer<
  typeof weeklyWorkConfigRecordSchema
>;
export type WeeklyWorkConfigRequest = z.infer<
  typeof weeklyWorkConfigRequestSchema
>;
export type WorkingDay = z.infer<typeof workingDaySchema>;
export type WorkingDaysRequest = z.infer<typeof workingDaysRequestSchema>;
export type CapacityPreviewRequest = z.infer<
  typeof capacityPreviewRequestSchema
>;
export type CapacityPreviewRecord = z.infer<
  typeof capacityPreviewRecordSchema
>;
export type UnitEtaRecord = z.infer<typeof unitEtaRecordSchema>;
export type DeliveryRiskQuery = z.infer<typeof deliveryRiskQuerySchema>;
export type DeliveryRiskSummary = z.infer<typeof deliveryRiskSummarySchema>;
export type WeeklyPlanRecord = z.infer<typeof weeklyPlanSchema>;
export type WeeklyPlanRequest = z.infer<typeof weeklyPlanRequestSchema>;
export type PlanningMaterialStatus = z.infer<typeof planningMaterialStatusSchema>;
export type PlanOvertimeInput = z.infer<typeof planOvertimeSchema>;
export type PlanUnitInput = z.infer<typeof planUnitSchema>;
export type PlanDivisionInput = z.infer<typeof planDivisionInputSchema>;
export type WeeklyPlanDivisionInputRecord = z.infer<typeof weeklyPlanDivisionInputRecordSchema>;
export type DivisionCapacitySummary = z.infer<typeof divisionCapacitySummarySchema>;
export type WeeklyGapResult = z.infer<typeof weeklyGapResultSchema>;
export type PlanAlert = z.infer<typeof planAlertSchema>;
export type PlanRecommendationSchedule = z.infer<typeof planRecommendationScheduleSchema>;
export type PlanRecommendationDivision = z.infer<typeof planRecommendationDivisionSchema>;
export type PlanRecommendationUnitDivision = z.infer<typeof planRecommendationUnitDivisionSchema>;
export type PlanRecommendationUnit = z.infer<typeof planRecommendationUnitSchema>;
export type PlanRecommendationSummary = z.infer<typeof planRecommendationSummarySchema>;
export type PlanRecommendation = z.infer<typeof planRecommendationSchema>;
export type PlanningWorkspaceSummary = z.infer<typeof planningWorkspaceSummarySchema>;
