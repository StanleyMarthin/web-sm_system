import { z } from "zod";

export const jobPlanRuntimeApprovalStateSchema = z.string().trim().toUpperCase().pipe(z.enum([
  "DRAFT",
  "DIVISION_REVIEW",
  "UNIT_REVIEW",
  "MANAGEMENT_REVIEW",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
]));

export const jobPlanRuntimeExecutionStateSchema = z.string().trim().toUpperCase().pipe(z.enum([
  "NOT_STARTED",
  "RUNNING",
  "HOLD",
  "FINISHED_PENDING_VALIDATION",
  "VALIDATED",
]));

const jobPlanRuntimeExecutionStatusSchema = z.string().trim().toLowerCase().pipe(z.enum([
  "cancel",
  "onprogress",
  "done",
]));

export const jobPlanRuntimeLedgerStateSchema = z.string().trim().toUpperCase().pipe(z.enum([
  "UNMATERIALIZED",
  "MATERIALIZED",
  "FINALIZED",
]));

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

const jobPlanRuntimeMonitoringHistorySchema = z.object({
  sequence: z.number().int().positive(),
  time: z.string().nullable().optional(),
  progress: z.number().min(0).max(100).nullable().optional(),
  note: z.string().nullable().optional(),
});

export const jobPlanRuntimeExecutionSegmentSchema = z.object({
  segment_id: z.string(),
  started_at: z.string(),
  finished_at: z.string(),
  break_minutes: z.number().int().nonnegative(),
  worked_minutes: z.number().int().nonnegative(),
  close_reason: z.string(),
});

const jobPlanPhotoUrlSchema = z.string().trim().url().max(2048).refine(
  (url) => url.startsWith("https://") || url.startsWith("http://"),
  "Dokumentasi harus menggunakan URL HTTP atau HTTPS.",
);

const jobPlanPhotosSchema = z.object({
  before: z.array(jobPlanPhotoUrlSchema).default([]),
  process: z.array(jobPlanPhotoUrlSchema).default([]),
  after: z.array(jobPlanPhotoUrlSchema).default([]),
});

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
  available_actions: z.array(z.string()).optional(),
  availableActions: z.array(z.string()).optional(),
  execution_state: jobPlanRuntimeExecutionStateSchema,
  execution_status: jobPlanRuntimeExecutionStatusSchema.nullable().optional(),
  ledger_state: jobPlanRuntimeLedgerStateSchema,
  legacy_status: z.string().nullable(),
  urgent: z.boolean(),
  is_rework: z.boolean(),
  is_overtime: z.boolean(),
  is_priority: z.boolean(),
  jobdescription: z.string().nullable().optional(),
  job_description: z.string().nullable().optional(),
  unit_name: z.string().nullable().optional(),
  panel_name: z.string().nullable().optional(),
  division_name: z.string().nullable().optional(),
  employee_name: z.string().nullable().optional(),
  countdown_name: z.string().nullable().optional(),
  note: z.string().nullable(),
  source: jobPlanRuntimeSourceSchema,
  created_by: z.string().nullable().optional(),
  version: z.number().int().nullable().optional(),
  projection_ready: z.boolean().nullable().optional(),
  accumulated_work_minutes: z.number().int().default(0),
  persisted_work_minutes: z.number().int().default(0),
  unverified_work_minutes: z.number().int().default(0),
  actual_start: z.string().nullable().optional(),
  actual_finish: z.string().nullable().optional(),
  active_segment_started_at: z.string().nullable().optional(),
  execution_budget_minutes: z.number().int().positive().nullable().optional(),
  execution_deadline: z.string().datetime({ offset: true }).nullable().optional(),
  continuation_of: z.string().nullable().optional(),
  progress_percent: z.number().min(0).max(100).nullable().optional(),
  execution_note: z.string().nullable().optional(),
  execution_segments: z.array(jobPlanRuntimeExecutionSegmentSchema).optional(),
  is_technical: z.boolean().optional(),
  photos: jobPlanPhotosSchema.optional(),
  monitoring_history: z.array(jobPlanRuntimeMonitoringHistorySchema).default([]),
  live_state_available: z.boolean().default(true),
  read_only: z.boolean().default(false),
});

export const jobPlanRuntimeReadItemSchema = jobPlanRuntimeReadItemBaseSchema.transform(({ job_description, availableActions, ...row }) => ({
  ...row,
  ...(row.available_actions === undefined && availableActions !== undefined ? { available_actions: availableActions } : {}),
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
  draftItemId: z.string().trim().min(1).max(120).optional(),
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
  urgent: z.boolean().optional(),
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
  progressPercent: z.number().min(0).max(100).nullable().optional(),
  status: z.string().trim().toLowerCase().pipe(z.enum(["pending", "cancel", "on_progress", "done"])).optional(),
  photos: z.object({
    before: z.array(jobPlanPhotoUrlSchema).max(3).default([]),
    process: z.array(jobPlanPhotoUrlSchema).max(3).default([]),
    after: z.array(jobPlanPhotoUrlSchema).max(3).default([]),
  }).optional(),
  note: z.string().max(2000).nullable().optional(),
});

export const monitorJobPlanRuntimeRequestSchema = z.object({
  userId: userIdSchema,
  commandId: commandIdSchema,
  expectedVersion: z.number().int().positive(),
  verifiedTotalMinutes: z.number().int().min(0).optional(),
  progressSeen: z.number().min(0).max(100).optional(),
  note: z.string().trim().max(2000).nullable().optional(),
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
    executionStatus: jobPlanRuntimeExecutionStatusSchema.nullable().optional(),
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
