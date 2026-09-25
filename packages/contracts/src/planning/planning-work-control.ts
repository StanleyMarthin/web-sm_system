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
  targetHours: z.number().nonnegative().optional().default(0),
  actualHours: z.number().nonnegative().optional().default(0),
});

export const jobItemSchema = z.object({
  jobId: z.string(),
  divisionId: z.string().nullable().optional().default(null),
  divisionName: z.string().nullable().optional().default(null),
  jobName: z.string(),
  panel: z.string().nullable().optional().default(null),
  status: z.string(),
  estimatedHours: z.number().nonnegative(),
  actualHours: z.number().nullable(),
  remainingHours: z.number().nonnegative().optional().default(0),
  dependsOn: z.array(z.string()).optional().default([]),
  startDate: z.string().nullable().optional().default(null),
  deadlineDate: z.string().nullable().optional().default(null),
  qcLastStatus: z.string().nullable().optional().default(null),
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

export const serviceTemplateSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  divisionId: z.string().trim().min(1),
  estimatedHours: z.number().positive(),
  applicableConditions: z.array(z.string()),
});

export const serviceTemplateListResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.array(serviceTemplateSchema),
});

export const createServiceIntakeBodySchema = z.object({
  unitId: z.string().trim().min(1),
  diagnosis: z.string().trim().min(1),
  templateIds: z.array(z.string().trim().min(1)).min(1),
  totalEstimatedHours: z.number().nonnegative(),
  capacityStatus: z.enum(["SPK_READY", "SPK_WITH_SPL", "TARGET_PERLU_DIREVISI"]),
  targetFinishDate: z.string().trim().min(1),
});

export const serviceIntakeResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    intakeId: z.string(),
    status: z.literal("DRAFT"),
  }),
});

export const criticalPathSnapshotBodySchema = z.object({
  unitId: z.string().trim().min(1),
  summary: z.unknown(),
});

export const criticalPathSnapshotResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    unitId: z.string(),
    savedAt: z.string(),
  }),
});

export const labourOverrideBodySchema = z.object({
  unitId: z.string().trim().min(1),
  billableHours: z.number().nonnegative(),
  nonBillableHours: z.number().nonnegative().optional().default(0),
  warrantyHours: z.number().nonnegative().optional().default(0),
});

export const labourOverrideResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    unitId: z.string(),
    savedAt: z.string(),
  }),
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
export type ServiceTemplate = z.infer<typeof serviceTemplateSchema>;
export type CreateServiceIntakeBody = z.infer<typeof createServiceIntakeBodySchema>;
export type CriticalPathSnapshotBody = z.infer<typeof criticalPathSnapshotBodySchema>;
export type LabourOverrideBody = z.infer<typeof labourOverrideBodySchema>;
