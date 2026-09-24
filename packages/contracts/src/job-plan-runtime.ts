import { z } from "zod";

export const jobPlanRuntimeApprovalStateSchema = z.enum([
  "DRAFT",
  "DIVISION_REVIEW",
  "UNIT_REVIEW",
  "MANAGEMENT_REVIEW",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
]);

export const jobPlanRuntimeExecutionStateSchema = z.enum([
  "NOT_STARTED",
  "RUNNING",
  "HOLD",
  "FINISHED_PENDING_VALIDATION",
  "VALIDATED",
]);

export const jobPlanRuntimeLedgerStateSchema = z.enum([
  "UNMATERIALIZED",
  "MATERIALIZED",
  "FINALIZED",
]);

export const jobPlanRuntimeSourceSchema = z.enum([
  "V2_REDIS",
  "MYSQL_LEGACY",
  "MYSQL_V2_PROJECTION",
]);

export const jobPlanRuntimeViewSchema = z.enum([
  "browse",
  "approval",
  "approval_queue",
  "execution",
  "history",
]);

const jobPlanRuntimeReadItemBaseSchema = z.object({
  plan_id: z.string(),
  core_id: z.string(),
  car_id: z.string().nullable(),
  panel_id: z.number().int().nullable(),
  division_id: z.number().int().nullable(),
  employee_id: z.string().nullable(),
  task_date: z.string(),
  planned_start_minute: z.number().int(),
  planned_finish_minute: z.number().int(),
  planned_work_minutes: z.number().int(),
  approval_state: jobPlanRuntimeApprovalStateSchema,
  execution_state: jobPlanRuntimeExecutionStateSchema,
  ledger_state: jobPlanRuntimeLedgerStateSchema,
  legacy_status: z.string().nullable(),
  urgent: z.boolean(),
  is_rework: z.boolean(),
  is_overtime: z.boolean(),
  is_priority: z.boolean(),
  jobdescription: z.string().nullable().optional(),
  job_description: z.string().nullable().optional(),
  note: z.string().nullable(),
  source: jobPlanRuntimeSourceSchema,
  version: z.number().int().nullable().optional(),
  projection_ready: z.boolean().nullable().optional(),
  accumulated_work_minutes: z.number().int().default(0),
  persisted_work_minutes: z.number().int().default(0),
  unverified_work_minutes: z.number().int().default(0),
  live_state_available: z.boolean().default(true),
  read_only: z.boolean().default(false),
});

export const jobPlanRuntimeReadItemSchema = jobPlanRuntimeReadItemBaseSchema.transform(({ job_description, ...row }) => ({
  ...row,
  jobdescription: row.jobdescription ?? job_description ?? null,
}));

export const jobPlanRuntimeListEnvelopeSchema = z.object({
  statusCode: z.number().int(),
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    items: z.array(jobPlanRuntimeReadItemSchema),
    count: z.number().int().nonnegative(),
  }),
});

const commandIdSchema = z.string().trim().min(1).max(120);
const userIdSchema = z.string().trim().min(1).max(100);
const planIdSchema = z.string().trim().min(1).max(100);
const minuteSchema = z.number().int().min(0).max(24 * 60);
const workMinuteSchema = z.number().int().positive().max(24 * 60);

export const createJobPlanRuntimeRequestSchema = z.object({
  userId: userIdSchema,
  coreId: z.string().trim().min(1).max(100),
  employeeId: z.string().trim().min(1).max(100),
  taskDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
  plannedStartMinute: minuteSchema,
  plannedWorkMinutes: workMinuteSchema,
  jobDescription: z.string().trim().min(1).max(1000),
  commandId: commandIdSchema,
  note: z.string().trim().max(1000).nullable().optional(),
  isOvertime: z.boolean().default(false),
  isRework: z.boolean().default(false),
  isPriority: z.boolean().default(false),
});

export const mutateJobPlanRuntimeApprovalRequestSchema = z.object({
  action: z.enum(["submit", "cancel", "edit_draft", "approve", "correct", "reject"]),
  userId: userIdSchema,
  commandId: commandIdSchema,
  expectedVersion: z.number().int().positive(),
  employeeId: z.string().trim().min(1).max(100).optional(),
  taskDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u).optional(),
  plannedStartMinute: minuteSchema.optional(),
  plannedWorkMinutes: workMinuteSchema.optional(),
  jobDescription: z.string().trim().min(1).max(1000).optional(),
  note: z.string().trim().max(1000).nullable().optional(),
  rejectReason: z.string().trim().max(1000).nullable().optional(),
  reason: z.string().trim().max(1000).nullable().optional(),
});

export const mutateJobPlanRuntimeExecutionRequestSchema = z.object({
  action: z.enum(["start", "hold", "resume", "finish"]),
  userId: userIdSchema,
  commandId: commandIdSchema,
  expectedVersion: z.number().int().positive(),
  occurredAt: z.string().trim().min(1).max(80),
  manualBreakMinutes: z.number().int().min(0).max(24 * 60).default(0),
  taskDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u).optional(),
  plannedStartMinute: minuteSchema.optional(),
  plannedWorkMinutes: workMinuteSchema.optional(),
});

export const monitorJobPlanRuntimeRequestSchema = z.object({
  userId: userIdSchema,
  commandId: commandIdSchema,
  expectedVersion: z.number().int().positive(),
  verifiedTotalMinutes: z.number().int().min(0).optional(),
  progressSeen: z.number().int().min(0).max(100).optional(),
  note: z.string().trim().max(1000).nullable().optional(),
});

export const validateJobPlanRuntimeRequestSchema = monitorJobPlanRuntimeRequestSchema;

export const manualExecutionJobPlanRuntimeRequestSchema = z.object({
  userId: userIdSchema,
  commandId: commandIdSchema,
  expectedVersion: z.number().int().positive(),
  actualStart: z.string().trim().min(1).max(80),
  actualFinish: z.string().trim().min(1).max(80),
  actualMinutes: z.number().int().positive().max(24 * 60),
  result: z.string().trim().max(1000).nullable().optional(),
  note: z.string().trim().max(1000).nullable().optional(),
  attachmentRef: z.string().trim().max(500).nullable().optional(),
});

export const jobPlanRuntimeMutationEnvelopeSchema = z.object({
  statusCode: z.number().int(),
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    planId: planIdSchema,
    version: z.number().int().positive(),
    reused: z.boolean().optional(),
    approvalState: jobPlanRuntimeApprovalStateSchema.optional(),
    executionState: jobPlanRuntimeExecutionStateSchema.optional(),
    ledgerState: jobPlanRuntimeLedgerStateSchema.optional(),
    schedulingGap: z.record(z.string(), z.unknown()).nullable().optional(),
    verifiedTotalMinutes: z.number().int().optional(),
    verifiedDeltaMinutes: z.number().int().optional(),
    validationId: z.string().nullable().optional(),
  }),
});

export const jobPlanRuntimeFailureSchema = z.object({
  statusCode: z.number().int(),
  success: z.literal(false),
  message: z.string(),
  errorCode: z.string().optional(),
  data: z.record(z.string(), z.unknown()).default({}),
});

export type JobPlanRuntimeApprovalState = z.infer<typeof jobPlanRuntimeApprovalStateSchema>;
export type JobPlanRuntimeExecutionState = z.infer<typeof jobPlanRuntimeExecutionStateSchema>;
export type JobPlanRuntimeLedgerState = z.infer<typeof jobPlanRuntimeLedgerStateSchema>;
export type JobPlanRuntimeReadItem = z.infer<typeof jobPlanRuntimeReadItemSchema>;
export type JobPlanRuntimeView = z.infer<typeof jobPlanRuntimeViewSchema>;
export type CreateJobPlanRuntimeRequest = z.infer<typeof createJobPlanRuntimeRequestSchema>;
export type MutateJobPlanRuntimeApprovalRequest = z.infer<typeof mutateJobPlanRuntimeApprovalRequestSchema>;
export type MutateJobPlanRuntimeExecutionRequest = z.infer<typeof mutateJobPlanRuntimeExecutionRequestSchema>;
export type MonitorJobPlanRuntimeRequest = z.infer<typeof monitorJobPlanRuntimeRequestSchema>;
export type ValidateJobPlanRuntimeRequest = z.infer<typeof validateJobPlanRuntimeRequestSchema>;
export type ManualExecutionJobPlanRuntimeRequest = z.infer<typeof manualExecutionJobPlanRuntimeRequestSchema>;
