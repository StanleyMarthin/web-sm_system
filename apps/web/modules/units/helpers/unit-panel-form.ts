import type { UnitBomNode } from "@smsystem/contracts/unit-bom";
import type {
  CreateUnitPanelRequest,
  UnitPanelRecord,
  UpdateUnitPanelRequest,
} from "@smsystem/contracts/unit-panel";

export interface PanelFormState {
  section: string;
  name: string;
  category: string;
  sortOrder: string;
  qty: string;
  defaultLocationType: "GUDANG" | "WORKSHOP" | "UNIT";
  defaultStockStatus: "IN_STORAGE" | "RETRIEVED" | "INSTALLED" | "LOST";
  defaultConditionType: "BARU" | "RESTORE" | "BEKAS";
  isActive: boolean;
  sourceGeneralId: string;
  generalTemplateName: string;
  nodeType: "PANEL" | "PART";
  nodeTypeName: string;
  parentId: string;
  parentName: string;
}

export const LOCATION_LABEL: Record<PanelFormState["defaultLocationType"], string> = {
  UNIT: "UNIT",
  WORKSHOP: "WORKSHOP",
  GUDANG: "GUDANG",
};

export const STOCK_STATUS_LABEL: Record<PanelFormState["defaultStockStatus"], string> = {
  INSTALLED: "Terpasang",
  IN_STORAGE: "Disimpan",
  RETRIEVED: "Dilepas",
  LOST: "Hilang",
};

export const CONDITION_LABEL: Record<PanelFormState["defaultConditionType"], string> = {
  BEKAS: "Bekas",
  RESTORE: "Restore",
  BARU: "Baru",
};

export function stockStatusForLocation(
  locationType: PanelFormState["defaultLocationType"],
): PanelFormState["defaultStockStatus"] {
  if (locationType === "UNIT") return "INSTALLED";
  if (locationType === "GUDANG") return "IN_STORAGE";
  return "RETRIEVED";
}

export function normalizeInventoryForm(form: PanelFormState): PanelFormState {
  if (form.defaultLocationType !== "UNIT") return form;
  if (form.defaultStockStatus === "INSTALLED") return form;
  return { ...form, defaultStockStatus: "INSTALLED" };
}

export function emptyForm(): PanelFormState {
  return {
    section: "",
    name: "",
    category: "",
    sortOrder: "0",
    qty: "1",
    defaultLocationType: "UNIT",
    defaultStockStatus: "INSTALLED",
    defaultConditionType: "BEKAS",
    isActive: true,
    sourceGeneralId: "",
    generalTemplateName: "",
    nodeType: "PANEL",
    nodeTypeName: "Panel",
    parentId: "",
    parentName: "",
  };
}

export function formFromRecord(record: UnitPanelRecord): PanelFormState {
  return normalizeInventoryForm({
    section: record.section,
    name: record.name,
    category: record.category ?? "",
    sortOrder: String(record.sortOrder),
    qty: String(record.qty ?? 1),
    defaultLocationType: record.defaultLocationType,
    defaultStockStatus: record.defaultStockStatus,
    defaultConditionType: record.defaultConditionType,
    isActive: record.isActive,
    sourceGeneralId: record.sourceGeneralId === null ? "" : String(record.sourceGeneralId),
    generalTemplateName: "",
    nodeType: record.nodeType,
    nodeTypeName: record.nodeType === "PART" ? "Part" : "Panel",
    parentId: record.parentId === null ? "" : String(record.parentId),
    parentName: "",
  });
}

export function formForChild(parent: UnitPanelRecord): PanelFormState {
  return normalizeInventoryForm({
    section: parent.section,
    name: "",
    category: parent.category ?? "",
    sortOrder: String(parent.children.length + 1),
    qty: "1",
    defaultLocationType: parent.defaultLocationType,
    defaultStockStatus: parent.defaultStockStatus,
    defaultConditionType: parent.defaultConditionType,
    isActive: true,
    sourceGeneralId: "",
    generalTemplateName: "",
    nodeType: "PART",
    nodeTypeName: "Part",
    parentId: String(parent.id),
    parentName: parent.name,
  });
}

export function formForNode(node: UnitBomNode): PanelFormState {
  const shouldCreatePart = node.panelId !== null || node.nodeType === "PART";
  return normalizeInventoryForm({
    section: node.section ?? "",
    name: "",
    category: node.category ?? "",
    sortOrder: "0",
    qty: "1",
    defaultLocationType: "UNIT",
    defaultStockStatus: "INSTALLED",
    defaultConditionType: node.conditionType ?? "BEKAS",
    isActive: true,
    sourceGeneralId: "",
    generalTemplateName: "",
    nodeType: shouldCreatePart ? "PART" : "PANEL",
    nodeTypeName: shouldCreatePart ? "Part" : "Panel",
    parentId: node.panelId ? String(node.panelId) : "",
    parentName: node.panelId ? node.label : "",
  });
}

type UnitPanelPayload = Omit<CreateUnitPanelRequest, "parentId"> & UpdateUnitPanelRequest;

export function buildPayload(
  form: PanelFormState,
  options: { includeParentId?: boolean } = {},
): UnitPanelPayload {
  const normalizedForm = normalizeInventoryForm(form);
  const payload: UnitPanelPayload = {
    section: normalizedForm.section.trim(),
    name: normalizedForm.name.trim(),
    category: normalizedForm.category.trim() || null,
    sortOrder: Number.parseInt(normalizedForm.sortOrder || "0", 10) || 0,
    qty: Number(normalizedForm.qty) > 0 ? Number(normalizedForm.qty) : 1,
    defaultLocationType: normalizedForm.defaultLocationType,
    defaultStockStatus: normalizedForm.defaultStockStatus,
    defaultConditionType: normalizedForm.defaultConditionType,
    isActive: normalizedForm.isActive,
  };

  if (options.includeParentId) {
    payload.parentId = form.nodeType === "PART" ? (Number.parseInt(form.parentId, 10) || null) : null;
  }

  return payload;
}
