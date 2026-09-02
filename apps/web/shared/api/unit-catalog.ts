import {
  catalogItemSchema,
  catalogMediaRequestSchema,
  catalogReferenceSchema,
  bulkCatalogItemsRequestSchema,
  createPanelJobdescsRequestSchema,
  updateCatalogSurveyRequestSchema,
  upsertCatalogReferenceRequestSchema,
  type BulkCatalogItemsRequest,
  type CatalogItem,
  type CatalogMediaRequest,
  type CatalogReference,
  type CreatePanelJobdescsRequest,
  type UpdateCatalogSurveyRequest,
  type UpsertCatalogReferenceRequest,
} from "@smsystem/contracts/unit-catalog";
import { z } from "zod";
import { getApiBaseUrl } from "@/shared/api/config";

const listCatalogEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({ references: z.array(catalogReferenceSchema) }),
});

const referenceEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({ reference: catalogReferenceSchema }),
});

const bulkItemsEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({ itemCount: z.number().int().nonnegative() }),
});

const surveyConfirmEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    result: z.object({
      item: catalogItemSchema,
      panel: z.record(z.string(), z.unknown()),
    }),
  }),
});

const mediaEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({ media: z.record(z.string(), z.unknown()) }),
});

const panelEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({ panel: z.record(z.string(), z.unknown()) }),
});

const jobdescsEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({ jobdescs: z.array(z.record(z.string(), z.unknown())) }),
});

interface ApiFailure {
  success: false;
  message: string;
  errorCode?: string;
}

async function parseFailure(response: Response): Promise<ApiFailure> {
  try {
    const data = await response.json();
    return {
      success: false,
      message: typeof data?.message === "string" ? data.message : "Request gagal.",
      errorCode: typeof data?.errorCode === "string" ? data.errorCode : undefined,
    };
  } catch {
    return { success: false, message: "Response API tidak valid.", errorCode: "INVALID_RESPONSE" };
  }
}

async function requestJson<T>(path: string, schema: z.ZodType<T>, init?: RequestInit) {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    credentials: "include",
    cache: "no-store",
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  if (!response.ok) return parseFailure(response);
  return { success: true as const, payload: schema.parse(await response.json()) };
}

export async function fetchUnitCatalog(unitId: string) {
  return requestJson(
    `/api/units/${encodeURIComponent(unitId)}/catalog`,
    listCatalogEnvelopeSchema,
  );
}

export async function fetchUnitCatalogReference(unitId: string, referenceId: number) {
  return requestJson(
    `/api/units/${encodeURIComponent(unitId)}/catalog/${referenceId}`,
    referenceEnvelopeSchema,
  );
}

export async function createUnitCatalogReference(
  unitId: string,
  input: UpsertCatalogReferenceRequest,
) {
  const body = upsertCatalogReferenceRequestSchema.parse(input);
  return requestJson(
    `/api/units/${encodeURIComponent(unitId)}/catalog`,
    referenceEnvelopeSchema,
    { method: "POST", body: JSON.stringify(body) },
  );
}

export async function replaceUnitCatalogItems(
  unitId: string,
  referenceId: number,
  input: BulkCatalogItemsRequest,
) {
  const body = bulkCatalogItemsRequestSchema.parse(input);
  return requestJson(
    `/api/units/${encodeURIComponent(unitId)}/catalog/${referenceId}/items`,
    bulkItemsEnvelopeSchema,
    { method: "PUT", body: JSON.stringify(body) },
  );
}

export async function saveUnitCatalogSurvey(
  unitId: string,
  itemId: number,
  input: UpdateCatalogSurveyRequest,
) {
  const body = updateCatalogSurveyRequestSchema.parse(input);
  return requestJson(
    `/api/units/${encodeURIComponent(unitId)}/catalog/items/${itemId}/survey`,
    z.object({ success: z.boolean(), message: z.string(), data: z.object({ item: catalogItemSchema }) }),
    { method: "PUT", body: JSON.stringify(body) },
  );
}

export async function confirmUnitCatalogSurvey(
  unitId: string,
  itemId: number,
  input: UpdateCatalogSurveyRequest,
) {
  const body = updateCatalogSurveyRequestSchema.parse(input);
  return requestJson(
    `/api/units/${encodeURIComponent(unitId)}/catalog/items/${itemId}/survey/confirm`,
    surveyConfirmEnvelopeSchema,
    { method: "POST", body: JSON.stringify(body) },
  );
}

export async function addUnitCatalogItemMedia(
  unitId: string,
  itemId: number,
  input: CatalogMediaRequest,
) {
  const body = catalogMediaRequestSchema.parse(input);
  return requestJson(
    `/api/units/${encodeURIComponent(unitId)}/catalog/items/${itemId}/media`,
    mediaEnvelopeSchema,
    { method: "POST", body: JSON.stringify(body) },
  );
}

export async function requestUnitCatalogUploadTicket(input: {
  unitId: string;
  filename: string;
  contentType: string;
  size: number;
}) {
  const params = new URLSearchParams({
    filename: input.filename,
    contentType: input.contentType,
    size: String(input.size),
  });
  const response = await fetch(
    `${getApiBaseUrl()}/api/units/${encodeURIComponent(input.unitId)}/catalog/upload-ticket?${params}`,
    { credentials: "include", cache: "no-store" },
  );
  if (!response.ok) return parseFailure(response);
  const payload = (await response.json()) as {
    success: boolean;
    message: string;
    data: { uploadUrl: string; publicUrl: string; objectKey: string };
  };
  return { success: true as const, result: payload.data };
}

export async function fetchUnitCatalogMasterPanel(unitId: string, panelId: number) {
  return requestJson(
    `/api/units/${encodeURIComponent(unitId)}/catalog/master-panels/${panelId}`,
    panelEnvelopeSchema,
  );
}

export async function createUnitCatalogPanelJobdescs(
  unitId: string,
  panelId: number,
  input: CreatePanelJobdescsRequest,
) {
  const body = createPanelJobdescsRequestSchema.parse(input);
  return requestJson(
    `/api/units/${encodeURIComponent(unitId)}/catalog/master-panels/${panelId}/jobdescs`,
    jobdescsEnvelopeSchema,
    { method: "POST", body: JSON.stringify(body) },
  );
}

export type { CatalogItem, CatalogReference };
