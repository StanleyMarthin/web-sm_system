import { z } from "zod";
import { gridMetaSchema, gridQueryStateSchema } from "./grid";

export const reportTypeSchema = z.enum([
  "delivery-accuracy",
  "manhour",
  "division-kpi",
  "qc-reject",
  "issues",
  "spk",
  "wo-aging",
  "pr-aging",
  "material-cost",
  "cash-flow",
]);

export const reportExportFormatSchema = z.enum(["csv", "xlsx"]);

export const reportColumnKindSchema = z.enum(["text", "mono", "number", "status"]);
export const reportColumnAlignSchema = z.enum(["left", "center", "right"]);

export const reportOptionSchema = z.object({
  value: z.string(),
  label: z.string(),
});

export const reportColumnSchema = z.object({
  key: z.string().trim().min(1).max(64),
  label: z.string().trim().min(1).max(120),
  kind: reportColumnKindSchema.optional(),
  align: reportColumnAlignSchema.optional(),
  sticky: z.boolean().optional(),
});

export const reportFilterDefinitionSchema = z.object({
  field: z.string().trim().min(1).max(64),
  label: z.string().trim().min(1).max(120),
  options: z.array(reportOptionSchema),
});

export const reportSortOptionSchema = z.object({
  label: z.string().trim().min(1).max(120),
  value: z.string().trim().min(1).max(64),
});

export const reportSummaryItemSchema = z.object({
  label: z.string().trim().min(1).max(120),
  value: z.string().trim().min(1).max(120),
  helper: z.string().trim().min(1).max(255),
});

export const reportCellValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);

export const reportRowSchema = z.record(z.string(), reportCellValueSchema);

export const reportQuerySchema = gridQueryStateSchema.extend({
  dateFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/u)
    .nullable()
    .optional()
    .default(null),
  dateTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/u)
    .nullable()
    .optional()
    .default(null),
});

export const reportDefinitionSchema = z.object({
  type: reportTypeSchema,
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(255),
  columns: z.array(reportColumnSchema).min(1),
  sortOptions: z.array(reportSortOptionSchema),
  filters: z.array(reportFilterDefinitionSchema),
  exportFormats: z.array(reportExportFormatSchema).min(1),
});

export const reportGridEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.array(reportRowSchema),
  meta: gridMetaSchema,
  query: reportQuerySchema,
  definition: reportDefinitionSchema,
  summary: z.array(reportSummaryItemSchema),
});

export const reportTypeOptions = [
  { value: "delivery-accuracy", label: "Delivery Accuracy" },
  { value: "manhour", label: "Manhour" },
  { value: "division-kpi", label: "Division KPI" },
  { value: "qc-reject", label: "QC Reject" },
  { value: "issues", label: "Issue Log" },
  { value: "spk", label: "SPK" },
  { value: "wo-aging", label: "WO Aging" },
  { value: "pr-aging", label: "PR Aging" },
  { value: "material-cost", label: "Material Cost" },
  { value: "cash-flow", label: "Cash Flow" },
] as const satisfies Array<{
  value: z.infer<typeof reportTypeSchema>;
  label: string;
}>;

export type ReportType = z.infer<typeof reportTypeSchema>;
export type ReportExportFormat = z.infer<typeof reportExportFormatSchema>;
export type ReportColumn = z.infer<typeof reportColumnSchema>;
export type ReportFilterDefinition = z.infer<typeof reportFilterDefinitionSchema>;
export type ReportSortOption = z.infer<typeof reportSortOptionSchema>;
export type ReportSummaryItem = z.infer<typeof reportSummaryItemSchema>;
export type ReportCellValue = z.infer<typeof reportCellValueSchema>;
export type ReportRow = z.infer<typeof reportRowSchema>;
export type ReportQuery = z.infer<typeof reportQuerySchema>;
export type ReportDefinition = z.infer<typeof reportDefinitionSchema>;
