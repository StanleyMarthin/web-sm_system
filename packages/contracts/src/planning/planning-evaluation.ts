import { z } from "zod";

export const planningEvaluationModeSchema = z.enum(["all", "normal", "overtime"]);
export const planningEvaluationSpanSchema = z.enum(["daily", "weekly"]);

export const planningEvaluationSummarySchema = z.object({
  baselineHours: z.number().nonnegative(),
  revisionHours: z.number().nonnegative(),
  actualHours: z.number().nonnegative(),
  revisionDeltaHours: z.number(),
  actualDeltaHours: z.number(),
});

export const planningEvaluationDivisionRecordSchema = z.object({
  divisionId: z.number().int().nullable(),
  divisionName: z.string().nullable(),
  baselineHours: z.number().nonnegative(),
  revisionHours: z.number().nonnegative(),
  actualHours: z.number().nonnegative(),
  revisionDeltaHours: z.number(),
  actualDeltaHours: z.number(),
  baselineUnitCount: z.number().int().nonnegative(),
  revisionJobCount: z.number().int().nonnegative(),
  actualUnitCount: z.number().int().nonnegative(),
});

export const planningEvaluationEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    date: z.string(),
    dateTo: z.string(),
    span: planningEvaluationSpanSchema,
    mode: planningEvaluationModeSchema,
    summary: planningEvaluationSummarySchema,
    divisions: z.array(planningEvaluationDivisionRecordSchema),
  }),
});

export type PlanningEvaluationMode = z.infer<typeof planningEvaluationModeSchema>;
export type PlanningEvaluationSpan = z.infer<typeof planningEvaluationSpanSchema>;
export type PlanningEvaluationSummary = z.infer<typeof planningEvaluationSummarySchema>;
export type PlanningEvaluationDivisionRecord = z.infer<
  typeof planningEvaluationDivisionRecordSchema
>;
