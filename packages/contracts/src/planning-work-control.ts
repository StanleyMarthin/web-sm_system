import { z } from "zod";

export const workControlRiskLevelSchema = z.enum([
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL",
]);

export const workControlUnitSchema = z.object({
  unitId: z.string(),
  unitName: z.string(),
  customerName: z.string().nullable().optional(),
  carId: z.string(),
  progressPercent: z.number().min(0).max(100),
  riskLevel: workControlRiskLevelSchema,
  remainingJobCount: z.number().int().nonnegative(),
  remainingHours: z.number().nonnegative(),
  targetDeliveryDate: z.string().nullable(),
  status: z.string().optional(),
});

export const workControlUnitsResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.array(workControlUnitSchema),
});

export const divisionSummarySchema = z.object({
  divisionId: z.string(),
  divisionName: z.string(),
  pendingHours: z.number().nonnegative(),
});

export const jobItemSchema = z.object({
  jobId: z.string(),
  jobName: z.string(),
  status: z.string(),
  estimatedHours: z.number().nonnegative(),
  actualHours: z.number().nullable(),
});

export const unitProgressSchema = z.object({
  unitId: z.string(),
  progressPercent: z.number().min(0).max(100),
  remainingHours: z.number().nonnegative(),
  totalEstimatedHours: z.number().nonnegative(),
  actualHours: z.number().nonnegative(),
  roughEstimateDays: z.number().int().nonnegative(),
  mainConstraint: z.string().nullable(),
  involvedDivisions: z.array(divisionSummarySchema),
  jobs: z.array(jobItemSchema),
});

export const unitProgressResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: unitProgressSchema,
});

export const absentMemberSchema = z.object({
  memberId: z.string(),
  memberName: z.string(),
  absenceType: z.string(),
  startDate: z.string(),
  endDate: z.string(),
});

export const divisionCapacitySchema = z.object({
  divisionId: z.string(),
  divisionName: z.string(),
  totalMembers: z.number().int().nonnegative(),
  activeMembers: z.number().int().nonnegative(),
  absentMembers: z.number().int().nonnegative(),
  normalCapacityHours: z.number().nonnegative(),
  absenceHours: z.number().nonnegative(),
  availableCapacityHours: z.number().nonnegative(),
  absentMemberDetails: z.array(absentMemberSchema),
});

export const capacityResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.array(divisionCapacitySchema),
});

export const createTargetBodySchema = z.object({
  planningTargetId: z.string().trim().min(1).optional(),
  weekStartDate: z.string().trim().min(1),
  units: z.array(
    z.object({
      carId: z.string().trim().min(1),
      divisionId: z.string().trim().min(1),
      targetHours: z.number().positive(),
      targetOutput: z.string().trim().min(1),
      targetFinishDate: z.string().trim().min(1),
      priority: z.number().int().positive(),
      riskLevel: workControlRiskLevelSchema,
      notes: z.string().optional(),
    }),
  ).min(1),
});

export const createTargetResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    planningTargetId: z.string(),
    status: z.literal("DRAFT"),
  }),
});

export const releaseSpkBodySchema = z.object({
  planningTargetId: z.string().trim().min(1),
});

export const releaseSpkResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    spkIds: z.array(z.string()),
    message: z.string(),
  }),
});

export const overtimeRecommendationBodySchema = z.object({
  planningTargetId: z.string().trim().min(1),
  divisionId: z.string().trim().min(1),
  shortageHours: z.number().positive(),
  reason: z.string().trim().min(1),
});

export const overtimeRecommendationResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    recommendationId: z.string(),
    status: z.literal("RECOMMENDED"),
  }),
});

export const planningSplRecommendationRecordSchema = z.object({
  planningTargetId: z.string(),
  periodStart: z.string(),
  periodEnd: z.string(),
  divisionId: z.string(),
  divisionName: z.string(),
  shortageHours: z.number().nonnegative(),
  recommendedOvertimeHours: z.number().nonnegative(),
  unitCount: z.number().int().nonnegative(),
  targetCount: z.number().int().nonnegative(),
  firstNeedDate: z.string().nullable(),
  lastNeedDate: z.string().nullable(),
  reason: z.string().nullable(),
  status: z.enum(["RECOMMENDED", "APPROVED", "REJECTED"]).nullable(),
});

export const planningSplRecommendationListResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.array(planningSplRecommendationRecordSchema),
});

export type WorkControlRiskLevel = z.infer<typeof workControlRiskLevelSchema>;
export type WorkControlUnit = z.infer<typeof workControlUnitSchema>;
export type DivisionSummary = z.infer<typeof divisionSummarySchema>;
export type JobItem = z.infer<typeof jobItemSchema>;
export type UnitProgress = z.infer<typeof unitProgressSchema>;
export type AbsentMember = z.infer<typeof absentMemberSchema>;
export type DivisionCapacity = z.infer<typeof divisionCapacitySchema>;
export type CreateTargetBody = z.infer<typeof createTargetBodySchema>;
export type ReleaseSpkBody = z.infer<typeof releaseSpkBodySchema>;
export type OvertimeRecommendationBody = z.infer<typeof overtimeRecommendationBodySchema>;
export type PlanningSplRecommendationRecord = z.infer<typeof planningSplRecommendationRecordSchema>;
