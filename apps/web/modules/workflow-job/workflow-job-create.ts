"use client";

import { createCountdownRecord, updateCountdownRecord } from "@/shared/api/countdown";
import { createPr, updatePr } from "@/shared/api/pr";
import { createVendor, updateVendor } from "@/shared/api/vendor";
import { createWo, updateWo } from "@/shared/api/wo";
import { parseHHMMToDecimal } from "@/shared/format/time";

export type WorkflowCreateType = "COUNTDOWN" | "WO" | "PR" | "WOV";

export interface WorkflowJobReferenceOption {
  value: string;
  label: string;
  parentId?: number | null;
  parentName?: string | null;
  parentCode?: string | null;
  divisionId?: number | null;
}

export interface WorkflowJobCreateReferences {
  divisions: WorkflowJobReferenceOption[];
  sections: WorkflowJobReferenceOption[];
  jobTypes: WorkflowJobReferenceOption[];
}

export interface WorkflowJobCreateContext {
  carId: string;
  panelId?: number | null;
  panelName: string;
  sectionName?: string | null;
  panelCategory?: string | null;
  divisionId?: string | null;
  divisionName?: string | null;
}

export interface WorkflowJobCreateFormState {
  type: WorkflowCreateType;
  divisionId: string;
  sectionName: string;
  jobTypeId: string;
  title: string;
  targetHours: string;
  startDate: string;
  targetDate: string;
  qty: string;
  uom: string;
  vendorName: string;
  notes: string;
  temuanAwal: string;
  keterangan: string;
  estimatedHours: string;
  estimatedPrice: string;
  estimatedCost: string;
  goodsConditionOut: string;
  photoUrl: string;
  isPriority: boolean;
  priority: "NORMAL" | "URGENT";
  taskCategory: "MAIN" | "ADDITIONAL";
}

export interface CreatedWorkflowJob {
  type: WorkflowCreateType;
  title: string;
  meta: string;
  idSuffix: string;
}

export function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

export function createWorkflowJobForm(
  context: WorkflowJobCreateContext,
  defaultType: WorkflowCreateType = "COUNTDOWN",
): WorkflowJobCreateFormState {
  return {
    type: defaultType,
    divisionId: context.divisionId ?? "",
    sectionName: context.sectionName ?? context.panelCategory ?? context.panelName,
    jobTypeId: "",
    title: context.panelName,
    targetHours: "01:00",
    startDate: todayDate(),
    targetDate: todayDate(),
    qty: "1",
    uom: "pcs",
    vendorName: "",
    notes: "",
    temuanAwal: "",
    keterangan: "",
    estimatedHours: "",
    estimatedPrice: "",
    estimatedCost: "",
    goodsConditionOut: "",
    photoUrl: "",
    isPriority: false,
    priority: "NORMAL",
    taskCategory: "ADDITIONAL",
  };
}

export function visibleWorkflowJobTypes(
  references: WorkflowJobCreateReferences,
  selectedDivisionId: string,
) {
  if (!selectedDivisionId) return references.jobTypes;
  const selectedDivisionOption = references.divisions.find((division) => division.value === selectedDivisionId);
  const selectedParentId = selectedDivisionOption?.parentId ?? null;
  return references.jobTypes.filter((jobType) => {
    if (jobType.divisionId === null || jobType.divisionId === undefined) return true;
    if (String(jobType.divisionId) === selectedDivisionId) return true;
    return jobType.divisionId === selectedParentId;
  });
}

export async function submitWorkflowJobCreate(input: {
  form: WorkflowJobCreateFormState;
  context: WorkflowJobCreateContext;
  references: WorkflowJobCreateReferences;
}): Promise<{ success: true; created: CreatedWorkflowJob } | { success: false; message: string }> {
  const { form, context, references } = input;
  const divisionValue = form.divisionId || context.divisionId || "";
  const division = references.divisions.find((item) => item.value === divisionValue);
  const divisionId = Number(divisionValue);
  const divisionName = division?.label ?? context.divisionName ?? "";
  const title = form.title.trim() || context.panelName;
  const targetDate = form.targetDate || todayDate();
  const qty = Number(form.qty || 1);
  const normalizedQty = Number.isFinite(qty) && qty > 0 ? qty : 1;
  const meta = `${context.panelName} - ${divisionName || "Divisi mengikuti request"}`;

  if (!title.trim()) return { success: false, message: "Nama pekerjaan wajib diisi." };
  if (!Number.isFinite(divisionId) && form.type !== "WOV") {
    return { success: false, message: "Divisi wajib dipilih." };
  }

  if (form.type === "COUNTDOWN") {
    const targetHoursInitial = parseHHMMToDecimal(form.targetHours || "0:00", true);
    if (!form.sectionName.trim()) return { success: false, message: "Section wajib dipilih." };
    if (!form.jobTypeId.trim()) return { success: false, message: "Jobdesc wajib dipilih dari master jobdesc." };
    if (!Number.isFinite(targetHoursInitial) || targetHoursInitial < 0) {
      return { success: false, message: "Target jam wajib format HHH:MM." };
    }

    const result = await createCountdownRecord({
      carId: context.carId,
      divisionId,
      panelId: context.panelId ?? null,
      taskCategory: form.taskCategory,
      sectionName: form.sectionName.trim(),
      jobTypeId: form.jobTypeId.trim(),
      targetHoursInitial,
      startDate: form.startDate || null,
      deadlineDate: targetDate,
      prerequisiteCoreId: "",
      refWoId: "",
      note: form.notes.trim() || null,
      temuanAwal: form.temuanAwal.trim() || null,
      keterangan: form.keterangan.trim() || `Panel: ${context.panelName}`,
      status: "PLAN",
    });

    if (!result.success) return { success: false, message: result.message };
    const idSuffix = String(result.payload.data.countdown.countdownId ?? Date.now());
    return { success: true, created: { type: form.type, title, meta, idSuffix } };
  }

  if (form.type === "WO") {
    const result = await createWo({
      carId: context.carId,
      toDivisionId: divisionId,
      requestDate: targetDate,
      isPriority: form.isPriority,
      panelName: null,
      jobDetail: null,
      estimatedHours: null,
      notes: null,
      items: [{
        jobDetail: title,
        panelName: context.panelName,
        sectionName: context.sectionName ?? context.panelName,
        panelCategory: context.panelCategory ?? null,
        addPanelToMaster: false,
        estimatedHours: form.estimatedHours ? Number(form.estimatedHours) : null,
        notes: form.notes.trim() || null,
      }],
    });

    if (!result.success) return { success: false, message: result.message };
    return { success: true, created: { type: form.type, title, meta, idSuffix: String(result.result.woId) } };
  }

  if (form.type === "PR") {
    const result = await createPr({
      carId: context.carId,
      divisionName: divisionName || null,
      targetDate: targetDate || null,
      priority: form.priority || "NORMAL",
      notes: form.notes.trim() || null,
      items: [{
        itemName: context.panelName,
        description: title,
        originType: "LOKAL",
        qty: normalizedQty,
        uom: form.uom.trim() || "pcs",
        estimatedPrice: form.estimatedPrice ? Number(form.estimatedPrice) : null,
        photoUrl: form.photoUrl.trim() || null,
      }],
    });

    if (!result.success) return { success: false, message: result.message };
    return { success: true, created: { type: form.type, title, meta, idSuffix: String(result.result.prId) } };
  }

  if (!form.vendorName.trim()) return { success: false, message: "Vendor wajib diisi untuk WOV." };

  const result = await createVendor({
    carId: context.carId,
    coreId: null,
    prId: null,
    vendorId: null,
    vendorName: form.vendorName.trim(),
    picVendor: null,
    itemName: null,
    quantity: null,
    uom: null,
    goodsConditionOut: null,
    targetDateReturn: targetDate || null,
    estimatedCost: null,
    remarks: form.notes.trim() || null,
    items: [{
      itemName: title || context.panelName,
      quantity: normalizedQty,
      uom: form.uom.trim() || null,
      goodsConditionOut: form.goodsConditionOut.trim() || null,
      estimatedCost: form.estimatedCost ? Number(form.estimatedCost) : null,
    }],
  });

  if (!result.success) return { success: false, message: result.message };
  return { success: true, created: { type: form.type, title, meta, idSuffix: String(result.result.wovId) } };
}

export async function submitWorkflowJobUpdate(input: {
  id: string;
  form: WorkflowJobCreateFormState;
  context: WorkflowJobCreateContext;
  references: WorkflowJobCreateReferences;
}): Promise<{ success: true } | { success: false; message: string }> {
  const { id, form, context, references } = input;
  const divisionValue = form.divisionId || context.divisionId || "";
  const division = references.divisions.find((item) => item.value === divisionValue);
  const divisionId = Number(divisionValue);
  const divisionName = division?.label ?? context.divisionName ?? "";
  const title = form.title.trim() || context.panelName;
  const targetDate = form.targetDate || todayDate();
  const qty = Number(form.qty || 1);
  const normalizedQty = Number.isFinite(qty) && qty > 0 ? qty : 1;

  if (!title.trim()) return { success: false, message: "Nama pekerjaan wajib diisi." };
  if (!Number.isFinite(divisionId) && form.type !== "WOV") {
    return { success: false, message: "Divisi wajib dipilih." };
  }

  if (form.type === "COUNTDOWN") {
    const targetHoursInitial = parseHHMMToDecimal(form.targetHours || "0:00", true);
    if (!form.sectionName.trim()) return { success: false, message: "Section wajib dipilih dari master." };
    if (!form.jobTypeId.trim()) return { success: false, message: "Jobdesc wajib dipilih dari master jobdesc." };
    if (!Number.isFinite(targetHoursInitial) || targetHoursInitial < 0) {
      return { success: false, message: "Target jam wajib format HHH:MM." };
    }
    const result = await updateCountdownRecord(id, {
      carId: context.carId,
      divisionId,
      panelId: context.panelId ?? null,
      taskCategory: form.taskCategory,
      sectionName: form.sectionName.trim(),
      jobTypeId: form.jobTypeId.trim(),
      targetHoursInitial,
      startDate: form.startDate || null,
      deadlineDate: targetDate,
      prerequisiteCoreId: "",
      refWoId: "",
      note: form.notes.trim() || null,
      temuanAwal: form.temuanAwal.trim() || null,
      keterangan: form.keterangan.trim() || `Panel: ${context.panelName}`,
      status: "PLAN",
    });
    return result.success ? { success: true } : { success: false, message: result.message };
  }

  if (form.type === "WO") {
    const result = await updateWo(id, {
      carId: context.carId,
      toDivisionId: divisionId,
      requestDate: targetDate,
      isPriority: form.isPriority,
      panelName: null,
      jobDetail: null,
      estimatedHours: null,
      notes: null,
      items: [{
        jobDetail: title,
        panelName: context.panelName,
        sectionName: context.sectionName ?? context.panelName,
        panelCategory: context.panelCategory ?? null,
        addPanelToMaster: false,
        estimatedHours: form.estimatedHours ? Number(form.estimatedHours) : null,
        notes: form.notes.trim() || null,
      }],
    });
    return result.success ? { success: true } : { success: false, message: result.message };
  }

  if (form.type === "PR") {
    const result = await updatePr(id, {
      carId: context.carId,
      divisionName: divisionName || null,
      targetDate: targetDate || null,
      priority: form.priority || "NORMAL",
      notes: form.notes.trim() || null,
      items: [{
        itemName: context.panelName,
        description: title,
        originType: "LOKAL",
        qty: normalizedQty,
        uom: form.uom.trim() || "pcs",
        estimatedPrice: form.estimatedPrice ? Number(form.estimatedPrice) : null,
        photoUrl: form.photoUrl.trim() || null,
      }],
    });
    return result.success ? { success: true } : { success: false, message: result.message };
  }

  const result = await updateVendor(id, {
    carId: context.carId,
    coreId: null,
    prId: null,
    vendorId: null,
    vendorName: form.vendorName.trim(),
    picVendor: null,
    itemName: null,
    quantity: null,
    uom: null,
    goodsConditionOut: null,
    targetDateReturn: targetDate || null,
    estimatedCost: null,
    remarks: form.notes.trim() || null,
    items: [{
      itemName: title || context.panelName,
      quantity: normalizedQty,
      uom: form.uom.trim() || null,
      goodsConditionOut: form.goodsConditionOut.trim() || null,
      estimatedCost: form.estimatedCost ? Number(form.estimatedCost) : null,
    }],
  });
  return result.success ? { success: true } : { success: false, message: result.message };
}
