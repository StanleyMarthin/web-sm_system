import { z } from "zod";

const workflowAnchorSideSchema = z.enum(["top", "right", "bottom", "left"]);

export const workflowNodeLayoutSchema = z.object({
  id: z.string().trim().min(1).max(160),
  x: z.number().int().min(0).max(5000),
  y: z.number().int().min(0).max(5000),
  width: z.number().int().min(80).max(1200),
  height: z.number().int().min(60).max(1200),
});

export const workflowLayoutConnectionSchema = z.object({
  id: z.string().trim().min(1).max(360),
  fromId: z.string().trim().min(1).max(160),
  toId: z.string().trim().min(1).max(160),
  fromSide: workflowAnchorSideSchema,
  toSide: workflowAnchorSideSchema,
  bendX: z.number().int().min(0).max(5000).optional(),
  bendY: z.number().int().min(0).max(5000).optional(),
});

export const workflowLayoutPayloadSchema = z.object({
  version: z.literal(2).default(2),
  nodeLayouts: z.array(workflowNodeLayoutSchema).max(300),
  connections: z.array(workflowLayoutConnectionSchema).max(600),
  order: z.array(z.string().trim().min(1).max(160)).max(300).default([]),
  savedAt: z.string().datetime().optional(),
});

export const workflowLayoutEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    layout: workflowLayoutPayloadSchema.nullable(),
  }),
});

export type WorkflowLayoutPayload = z.infer<typeof workflowLayoutPayloadSchema>;
