import {
  catalogItemSchema,
  catalogOverviewSchema,
  catalogWorkspaceSchema,
  catalogSearchItemSchema,
  catalogMediaRequestSchema,
  masterPanelSchema,
  createPanelJobdescsRequestSchema,
  openCatalogPanelRequestSchema,
  saveCatalogWorkspaceRequestSchema,
  updateCatalogSurveyRequestSchema,
  type CatalogItem,
  type CatalogOverview,
  type CatalogWorkspace,
  type CreatePanelJobdescsRequest,
  type OpenCatalogPanelRequest,
  type SaveCatalogWorkspaceRequest,
  type UpdateCatalogSurveyRequest,
} from "@smsystem/contracts/unit-catalog";
import { z } from "zod";
import { getApiBaseUrl } from "@/shared/api/config";

const overviewEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({ overview: catalogOverviewSchema }),
});

const workspaceEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({ workspace: catalogWorkspaceSchema }),
});

const itemEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({ item: catalogItemSchema }),
});

const searchEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({ items: z.array(catalogSearchItemSchema) }),
});

const catalogComponentSchema = catalogOverviewSchema.shape.components.element;
const catalogPanelSchema = catalogOverviewSchema.shape.panels.element.pick({
  id: true,
  componentId: true,
  componentCode: true,
  componentName: true,
  panelName: true,
});

const componentsEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({ components: z.array(catalogComponentSchema) }),
});

const panelsEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({ panels: z.array(catalogPanelSchema) }),
});

const mediaEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({ media: z.record(z.string(), z.unknown()) }),
});

const panelEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({ panel: masterPanelSchema }),
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
  return requestJson(`/api/units/${encodeURIComponent(unitId)}/catalog`, overviewEnvelopeSchema);
}

export async function fetchCatalogComponents() {
  return requestJson("/api/catalog/components", componentsEnvelopeSchema);
}

export async function fetchCatalogPanelsByComponent(componentId: number) {
  return requestJson(`/api/catalog/components/${componentId}/panels`, panelsEnvelopeSchema);
}

export async function searchUnitCatalog(unitId: string, input: {
  q: string;
  componentId?: number | null;
  panelId?: number | null;
  limit?: number;
  offset?: number;
}) {
  const params = new URLSearchParams({ q: input.q });
  if (input.componentId) params.set("componentId", String(input.componentId));
  if (input.panelId) params.set("panelId", String(input.panelId));
  if (input.limit) params.set("limit", String(input.limit));
  if (input.offset) params.set("offset", String(input.offset));
  return requestJson(
    `/api/units/${encodeURIComponent(unitId)}/catalog/search?${params.toString()}`,
    searchEnvelopeSchema,
  );
}

export async function fetchUnitCatalogPanelWorkspace(unitId: string, panelId: number) {
  return requestJson(
    `/api/units/${encodeURIComponent(unitId)}/catalog/panels/${panelId}`,
    workspaceEnvelopeSchema,
  );
}

export async function openUnitCatalogPanel(unitId: string, input: OpenCatalogPanelRequest) {
  const body = openCatalogPanelRequestSchema.parse(input);
  return requestJson(
    `/api/units/${encodeURIComponent(unitId)}/catalog`,
    workspaceEnvelopeSchema,
    { method: "POST", body: JSON.stringify(body) },
  );
}

export async function saveUnitCatalogPanelWorkspace(unitId: string, panelId: number, input: SaveCatalogWorkspaceRequest) {
  const body = saveCatalogWorkspaceRequestSchema.parse(input);
  return requestJson(
    `/api/units/${encodeURIComponent(unitId)}/catalog/panels/${panelId}/items/batch`,
    workspaceEnvelopeSchema,
    { method: "PUT", body: JSON.stringify(body) },
  );
}

export async function saveUnitCatalogSurvey(unitId: string, itemId: number, input: UpdateCatalogSurveyRequest) {
  const body = updateCatalogSurveyRequestSchema.parse(input);
  return requestJson(
    `/api/units/${encodeURIComponent(unitId)}/catalog/items/${itemId}/survey`,
    itemEnvelopeSchema,
    { method: "PUT", body: JSON.stringify(body) },
  );
}

export async function confirmUnitCatalogSurvey(unitId: string, itemId: number, input: UpdateCatalogSurveyRequest) {
  const body = updateCatalogSurveyRequestSchema.parse(input);
  return requestJson(
    `/api/units/${encodeURIComponent(unitId)}/catalog/items/${itemId}/survey/confirm`,
    z.object({
      success: z.boolean(),
      message: z.string(),
      data: z.object({
        result: z.object({
          item: catalogItemSchema,
          panelId: z.number().int().positive(),
          alreadyPromoted: z.boolean(),
        }),
      }),
    }),
    { method: "POST", body: JSON.stringify(body) },
  );
}

export async function addUnitCatalogItemMedia(unitId: string, itemId: number, input: { fileUrl: string; caption?: string | null }) {
  const body = catalogMediaRequestSchema.parse(input);
  return requestJson(
    `/api/units/${encodeURIComponent(unitId)}/catalog/items/${itemId}/media`,
    mediaEnvelopeSchema,
    { method: "POST", body: JSON.stringify(body) },
  );
}

export async function requestUnitCatalogUploadTicket(input: { unitId: string; filename: string; contentType: string; size: number }) {
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

export async function createUnitCatalogPanelJobdescs(unitId: string, panelId: number, input: CreatePanelJobdescsRequest) {
  const body = createPanelJobdescsRequestSchema.parse(input);
  return requestJson(
    `/api/units/${encodeURIComponent(unitId)}/catalog/master-panels/${panelId}/jobdescs`,
    jobdescsEnvelopeSchema,
    { method: "POST", body: JSON.stringify(body) },
  );
}

export type { CatalogItem, CatalogOverview, CatalogWorkspace };
