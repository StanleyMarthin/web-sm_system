import { z } from "zod";
import {
  gridMetaSchema,
  gridQueryStateSchema,
} from "./grid";

const optionSchema = z.object({
  label: z.string(),
  value: z.string(),
});

export const issueStatusSchema = z.enum([
  "OPEN",
  "ACKNOWLEDGED",
  "IN_PROGRESS",
  "QC_RECHECK",
  "RESOLVED",
  "ESCALATED",
  "WAIVED",
]);

export const issueSeveritySchema = z.enum(["LOW", "MEDIUM", "HIGH"]);
export const issueSourceTypeSchema = z.enum([
  "QC_REJECT",
  "WORK_LEDGER",
  "MANUAL",
]);

export const issueRecordSchema = z.object({
  issueId: z.string(),
  issueNumber: z.string(),
  sourceType: issueSourceTypeSchema,
  sourceRefId: z.string().nullable(),
  carId: z.string(),
  unitName: z.string(),
  customerName: z.string().nullable(),
  divisionId: z.number().int().nullable(),
  divisionName: z.string().nullable(),
  countdownId: z.string().nullable(),
  planId: z.string().nullable(),
  qcId: z.string().nullable(),
  ledgerId: z.string().nullable(),
  issueType: z.string(),
  severity: issueSeveritySchema,
  title: z.string(),
  description: z.string(),
  status: issueStatusSchema,
  isUrgent: z.boolean(),
  assignedTo: z.string().nullable(),
  assignedToName: z.string().nullable(),
  reportedBy: z.string().nullable(),
  reportedByName: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  resolutionNotes: z.string().nullable(),
});

export const issueSummarySchema = z.object({
  openCount: z.number().int().nonnegative(),
  urgentCount: z.number().int().nonnegative(),
  escalatedCount: z.number().int().nonnegative(),
});

export const issueReferencesSchema = z.object({
  units: z.array(optionSchema),
  divisions: z.array(optionSchema),
  statuses: z.array(optionSchema),
  severities: z.array(optionSchema),
  employees: z.array(optionSchema),
});

export const issueQuerySchema = gridQueryStateSchema;

export const issueGridEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.array(issueRecordSchema),
  storageReady: z.boolean().optional(),
  meta: gridMetaSchema,
  query: issueQuerySchema,
  references: issueReferencesSchema,
  summary: issueSummarySchema,
});

export const issueDetailEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    issue: issueRecordSchema,
  }),
});

export const issueMutationEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    issueId: z.string(),
    status: issueStatusSchema,
  }),
});

export const issueCreateRequestSchema = z.object({
  carId: z.string().trim().min(1),
  divisionId: z.number().int().nullable().optional(),
  countdownId: z.string().trim().nullable().optional(),
  planId: z.string().trim().nullable().optional(),
  issueType: z.string().trim().min(1).max(50),
  severity: issueSeveritySchema,
  title: z.string().trim().min(1).max(255),
  description: z.string().trim().min(1).max(4_000),
});

export const issueAssignRequestSchema = z.object({
  assignedTo: z.string().trim().min(1).max(50),
  assignedToName: z.string().trim().min(1).max(255).nullable().optional(),
});

export const issueResolveRequestSchema = z.object({
  resolutionNotes: z.string().trim().min(1).max(4_000),
});

export const issueEscalateRequestSchema = z.object({
  note: z.string().trim().min(1).max(4_000),
});

export const issueWaiveRequestSchema = z.object({
  note: z.string().trim().min(1).max(4_000),
});

export type IssueRecord = z.infer<typeof issueRecordSchema>;
export type IssueStatus = z.infer<typeof issueStatusSchema>;
export type IssueSeverity = z.infer<typeof issueSeveritySchema>;
export type IssueSourceType = z.infer<typeof issueSourceTypeSchema>;
export type IssueCreateRequest = z.infer<typeof issueCreateRequestSchema>;
export type IssueAssignRequest = z.infer<typeof issueAssignRequestSchema>;
export type IssueResolveRequest = z.infer<typeof issueResolveRequestSchema>;
export type IssueEscalateRequest = z.infer<typeof issueEscalateRequestSchema>;
export type IssueWaiveRequest = z.infer<typeof issueWaiveRequestSchema>;
export type IssueQuery = z.infer<typeof issueQuerySchema>;
export type IssueSummary = z.infer<typeof issueSummarySchema>;
export type IssueReferences = z.infer<typeof issueReferencesSchema>;
