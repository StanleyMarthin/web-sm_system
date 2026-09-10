"use client";

import type { UnitPanelDetail, UnitPanelRecord, UpdateUnitPanelRequest } from "@smsystem/contracts/unit-panel";
import type { CellKeyDownEvent, CellValueChangedEvent, ColDef, ICellRendererParams, SelectionChangedEvent } from "ag-grid-community";
import { AllCommunityModule, ModuleRegistry } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { ArrowLeft, ChevronRight, Image as ImageIcon, ListPlus, Plus, RefreshCw, Search, X } from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createUnitAdditionalMasterPanel } from "@/shared/api/unit-catalog";
import { deleteUnitPanel, fetchUnitPanelDetail, fetchUnitPanels, updateUnitPanel } from "@/shared/api/units";
import { MasterPanelActivityMenu } from "./master-panel-activity-menu";
import { MasterPanelCountdownGrid } from "./master-panel-countdown-grid";
import { MasterPanelPhotoGallery } from "./master-panel-photo-gallery";
import { MasterPanelPrGrid } from "./master-panel-pr-grid";
import { MasterPanelWoGrid } from "./master-panel-wo-grid";
import { MasterPanelWovGrid } from "./master-panel-wov-grid";

const ICON_STROKE_WIDTH = 2.5;

ModuleRegistry.registerModules([AllCommunityModule]);

function displayCategory(value: string | null | undefined): string {
  return value?.trim() || "Lainnya";
}

interface MasterPanelManagerProps {
  unitId: string;
  canManage: boolean;
  canCreateWo: boolean;
  canCreatePr: boolean;
  canCreateVendor: boolean;
  initialRows?: UnitPanelRecord[];
}

interface AdditionalFormState {
  componentName: string;
  panelName: string;
  itemName: string;
  partNumber: string;
  deskription: string;
}

type MasterPartGridRow = UnitPanelRecord & {
  clientId: string;
  isDraft?: boolean;
};

type PartEditableField = "name" | "partNumber" | "initialCondition" | "currentStatus" | "qty";

const PART_PASTE_FIELDS: PartEditableField[] = ["name", "partNumber", "initialCondition", "currentStatus", "qty"];

function withPartValue<T extends MasterPartGridRow>(row: T, field: PartEditableField, value: unknown): T {
  const nextValue = field === "qty" ? toPositiveQty(value) : String(value ?? "");
  return { ...row, [field]: nextValue };
}

const EMPTY_ADDITIONAL_FORM: AdditionalFormState = {
  componentName: "",
  panelName: "",
  itemName: "",
  partNumber: "",
  deskription: "",
};

const CONDITION_LABEL: Record<UnitPanelRecord["defaultConditionType"], string> = {
  BARU: "Baru",
  BEKAS: "Bekas",
  RESTORE: "Restore",
};

function displayCondition(record: UnitPanelRecord): string {
  return record.initialCondition ?? CONDITION_LABEL[record.defaultConditionType] ?? "-";
}

function displayCurrentStatus(record: UnitPanelRecord): string {
  return record.currentStatus ?? displayPanelStatus(record);
}

function toNullable(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function toPositiveQty(value: unknown): number {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : 1;
}

function recordToUpdateInput(record: UnitPanelRecord): UpdateUnitPanelRequest {
  return {
    section: record.section,
    name: record.name,
    category: record.category,
    aliasName: toNullable(record.aliasName),
    partNumber: toNullable(record.partNumber),
    initialCondition: toNullable(record.initialCondition ?? record.defaultConditionType),
    currentStatus: toNullable(record.currentStatus ?? record.defaultStockStatus),
    location: toNullable(record.location ?? record.defaultLocationType),
    notes: toNullable(record.notes),
    qty: toPositiveQty(record.qty),
    sortOrder: record.sortOrder,
    defaultLocationType: record.defaultLocationType,
    defaultStockStatus: record.defaultStockStatus,
    defaultConditionType: record.defaultConditionType,
    isActive: record.isActive,
  };
}

function updateRecordTree(
  records: UnitPanelRecord[],
  id: number,
  update: (record: UnitPanelRecord) => UnitPanelRecord,
): UnitPanelRecord[] {
  return records.map((record) => {
    const nextRecord = record.id === id ? update(record) : record;
    return {
      ...nextRecord,
      children: updateRecordTree(nextRecord.children, id, update),
    };
  });
}

function displayPanelStatus(record: UnitPanelRecord): string {
  if (!record.isActive) return "Nonaktif";
  if (record.statusUsageCount > 0 || record.countdownUsageCount > 0) return "Operational";
  return "Siap";
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

const DONE_STATUS_VALUES = new Set(["DONE", "SELESAI", "FINISH", "FINISHED", "COMPLETED", "COMPLETE"]);

type PartFilter = "ALL" | "WAITING" | "RESTORE" | "DONE";

const PART_FILTERS: Array<{ value: PartFilter; label: string }> = [
  { value: "ALL", label: "Semua" },
  { value: "WAITING", label: "Belum Progress" },
  { value: "RESTORE", label: "Restorasi" },
  { value: "DONE", label: "Selesai" },
];

function normalizeStatus(value: string | null | undefined): string {
  return (value ?? "").trim().toUpperCase();
}

function isPartComplete(record: UnitPanelRecord): boolean {
  return DONE_STATUS_VALUES.has(normalizeStatus(record.currentStatus));
}

function isRestorationPart(record: UnitPanelRecord): boolean {
  return displayCondition(record).toUpperCase().includes("RESTOR");
}

function partProgressLabel(record: UnitPanelRecord): { label: string; className: string; dotClassName: string } {
  if (isPartComplete(record)) {
    return {
      label: "SELESAI",
      className: "border-success/30 bg-success/[0.08] text-success",
      dotClassName: "bg-success",
    };
  }

  if (isRestorationPart(record)) {
    return {
      label: "RESTORASI",
      className: "border-primary/35 bg-primary/[0.08] text-app-accent-ink",
      dotClassName: "bg-primary",
    };
  }

  return {
    label: "MENUNGGU",
    className: "border-border bg-muted text-muted-foreground",
    dotClassName: "bg-muted-foreground",
  };
}

function progressFromParts(totalPart: number, completedPart: number): number {
  if (totalPart <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((completedPart / totalPart) * 100)));
}

function sumBy<T>(items: T[], read: (item: T) => number | null | undefined): number {
  return items.reduce((total, item) => total + Number(read(item) ?? 0), 0);
}

function flattenPanelRecords(records: UnitPanelRecord[]): UnitPanelRecord[] {
  return records.flatMap((record) => [record, ...flattenPanelRecords(record.children)]);
}

function conditionSummary(records: UnitPanelRecord[]): string {
  if (records.length === 0) return "-";
  const counts = records.reduce<Record<string, number>>((acc, item) => {
    const label = CONDITION_LABEL[item.defaultConditionType];
    acc[label] = (acc[label] ?? 0) + 1;
    return acc;
  }, {});

  return Object.entries(counts)
    .map(([label, count]) => `${label} ${count}`)
    .join(" · ");
}

interface MasterPanelPanelGroup {
  key: string;
  componentName: string;
  panelName: string;
  parts: UnitPanelRecord[];
  totalPart: number;
  completedPart: number;
  remainingPart: number;
  conditionSummary: string;
  status: string;
  totalJobdesc: number;
  totalHours: number;
  remainingHours: number;
  progress: number;
}

interface MasterPanelComponentGroup {
  key: string;
  componentName: string;
  panels: MasterPanelPanelGroup[];
  totalPanel: number;
  totalPart: number;
  completedPart: number;
  remainingPart: number;
  totalHours: number;
  remainingHours: number;
  progress: number;
}

function buildMasterPanelHierarchy(records: UnitPanelRecord[]): MasterPanelComponentGroup[] {
  const componentMap = new Map<string, Map<string, UnitPanelRecord[]>>();

  for (const record of records) {
    const componentName = displayCategory(record.category);
    const panelName = record.section.trim() || "Tanpa Panel";
    const panelMap = componentMap.get(componentName) ?? new Map<string, UnitPanelRecord[]>();
    const parts = panelMap.get(panelName) ?? [];
    parts.push(record);
    panelMap.set(panelName, parts);
    componentMap.set(componentName, panelMap);
  }

  return Array.from(componentMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([componentName, panelMap]) => {
      const panels = Array.from(panelMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([panelName, parts]) => {
          const totalHours = sumBy(parts, part => part.totalHours);
          const remainingHours = sumBy(parts, part => part.remainingHours);
          const completedPart = parts.filter(isPartComplete).length;
          return {
            key: `${componentName}\u0000${panelName}`,
            componentName,
            panelName,
            parts,
            totalPart: parts.length,
            completedPart,
            remainingPart: parts.length - completedPart,
            conditionSummary: conditionSummary(parts),
            status: parts.some((part) => displayPanelStatus(part) === "Operational") ? "Operational" : "Siap",
            totalJobdesc: sumBy(parts, part => part.totalJobdesc),
            totalHours,
            remainingHours,
            progress: progressFromParts(parts.length, completedPart),
          };
        });
      const totalHours = sumBy(panels, panel => panel.totalHours);
      const remainingHours = sumBy(panels, panel => panel.remainingHours);
      const completedPart = panels.reduce((total, panel) => total + panel.completedPart, 0);
      const totalPart = panels.reduce((total, panel) => total + panel.totalPart, 0);
      return {
        key: componentName,
        componentName,
        panels,
        totalPanel: panels.length,
        totalPart,
        completedPart,
        remainingPart: totalPart - completedPart,
        totalHours,
        remainingHours,
        progress: progressFromParts(totalPart, completedPart),
      };
    });
}

function matchesPart(part: UnitPanelRecord, term: string): boolean {
  return (
    part.name.toLowerCase().includes(term) ||
    (part.aliasName ?? "").toLowerCase().includes(term) ||
    (part.partNumber ?? "").toLowerCase().includes(term) ||
    (part.code ?? "").toLowerCase().includes(term) ||
    displayCondition(part).toLowerCase().includes(term) ||
    displayCurrentStatus(part).toLowerCase().includes(term)
  );
}

function matchesPartFilter(part: UnitPanelRecord, filter: PartFilter): boolean {
  if (filter === "ALL") return true;
  if (filter === "WAITING") return !isPartComplete(part);
  if (filter === "RESTORE") return isRestorationPart(part);
  if (filter === "DONE") return isPartComplete(part);
  return true;
}

interface MasterPanelGridContext {
  onOpenComponent: (component: MasterPanelComponentGroup) => void;
  onOpenPanel: (panel: MasterPanelPanelGroup) => void;
  onOpenPartPhoto: (part: UnitPanelRecord) => void;
  onOpenPartActivity: (part: UnitPanelRecord) => void;
}

function getGridContext<T>(params: ICellRendererParams<T>): MasterPanelGridContext {
  return params.context as MasterPanelGridContext;
}

function ComponentNameRenderer(params: ICellRendererParams<MasterPanelComponentGroup>) {
  const data = params.data;
  if (!data) return null;
  return (
    <span className="block text-left font-semibold text-foreground">
      {data.componentName}
    </span>
  );
}

function ComponentNavigationRenderer(params: ICellRendererParams<MasterPanelComponentGroup>) {
  const data = params.data;
  if (!data) return null;
  const context = getGridContext(params);
  return (
    <button type="button" className="catalog-icon-button" aria-label={`Buka ${data.componentName}`} title="Buka daftar panel"
      onClick={(event) => { event.stopPropagation(); context.onOpenComponent(data); }}>
      <ChevronRight className="h-4 w-4" />
    </button>
  );
}

function PanelNameRenderer(params: ICellRendererParams<MasterPanelPanelGroup>) {
  const data = params.data;
  if (!data) return null;
  return (
    <span className="block text-left font-medium text-foreground">
      {data.panelName}
    </span>
  );
}

function PanelNavigationRenderer(params: ICellRendererParams<MasterPanelPanelGroup>) {
  const data = params.data;
  if (!data) return null;
  const context = getGridContext(params);
  return (
    <button type="button" className="catalog-icon-button" aria-label={`Buka ${data.panelName}`} title="Buka daftar part"
      onClick={(event) => { event.stopPropagation(); context.onOpenPanel(data); }}>
      <ChevronRight className="h-4 w-4" />
    </button>
  );
}

function PartStatusRenderer(params: ICellRendererParams<UnitPanelRecord>) {
  const data = params.data;
  if (!data) return null;
  const badge = partProgressLabel(data);
  return (
    <span className={`inline-flex items-center gap-1.5 border px-2 py-1 text-[12px] font-semibold ${badge.className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${badge.dotClassName}`} />
      {badge.label}
    </span>
  );
}

type ActiveActivityType = "COUNTDOWN" | "WO" | "PR" | "WOV" | null;

export function MasterPanelManager({ unitId, canManage, canCreateWo, canCreatePr, canCreateVendor, initialRows }: MasterPanelManagerProps) {
  const [rows, setRows] = useState<UnitPanelRecord[]>(() => initialRows ?? []);
  const [isLoading, setIsLoading] = useState(() => initialRows === undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [activePartDetail, setActivePartDetail] = useState<UnitPanelDetail | null>(null);
  const [activeDetailMode, setActiveDetailMode] = useState<"photos" | "activity" | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [activeActivityType, setActiveActivityType] = useState<ActiveActivityType>(null);

  const [search, setSearch] = useState<string>("");
  const [partFilter, setPartFilter] = useState<PartFilter>("ALL");
  const [expandedComponentKey, setExpandedComponentKey] = useState<string | null>(null);
  const [expandedPanelKey, setExpandedPanelKey] = useState<string | null>(null);
  const [dirtyPartIds, setDirtyPartIds] = useState<Set<number>>(() => new Set());
  const [draftParts, setDraftParts] = useState<MasterPartGridRow[]>([]);
  const [selectedPartRow, setSelectedPartRow] = useState<MasterPartGridRow | null>(null);
  const [deletedPartIds, setDeletedPartIds] = useState<number[]>([]);
  const [isAddingAdditional, setIsAddingAdditional] = useState(false);
  const [additionalForm, setAdditionalForm] = useState<AdditionalFormState>(EMPTY_ADDITIONAL_FORM);
  const flatRows = useMemo(() => flattenPanelRecords(rows), [rows]);
  const hierarchy = useMemo(() => buildMasterPanelHierarchy(flatRows), [flatRows]);
  const searchTerm = search.trim().toLowerCase();

  const rootCount = hierarchy.reduce((total, component) => total + component.totalPanel, 0);
  const partCount = flatRows.length;
  const expandedComponent = useMemo(
    () => hierarchy.find(component => component.key === expandedComponentKey) ?? null,
    [hierarchy, expandedComponentKey],
  );
  const expandedPanel = useMemo(
    () => expandedComponent?.panels.find(panel => panel.key === expandedPanelKey) ?? null,
    [expandedComponent, expandedPanelKey],
  );
  const filteredComponents = useMemo(() => {
    if (!searchTerm && partFilter === "ALL") return hierarchy;
    return hierarchy.filter(component =>
      (
        !searchTerm ||
        component.componentName.toLowerCase().includes(searchTerm) ||
        component.panels.some(panel =>
          panel.panelName.toLowerCase().includes(searchTerm) ||
          panel.parts.some(part => matchesPart(part, searchTerm))
        )
      ) &&
      (partFilter === "ALL" || component.panels.some(panel => panel.parts.some(part => matchesPartFilter(part, partFilter))))
    );
  }, [hierarchy, searchTerm, partFilter]);
  const filteredPanels = useMemo(() => {
    if (!expandedComponent) return [];
    if (!searchTerm && partFilter === "ALL") return expandedComponent.panels;
    return expandedComponent.panels.filter(panel =>
      (
        !searchTerm ||
        panel.panelName.toLowerCase().includes(searchTerm) ||
        panel.parts.some(part => matchesPart(part, searchTerm))
      ) &&
      (partFilter === "ALL" || panel.parts.some(part => matchesPartFilter(part, partFilter)))
    );
  }, [searchTerm, expandedComponent, partFilter]);
  const filteredParts = useMemo(() => {
    if (!expandedPanel) return [];
    return expandedPanel.parts.filter(part =>
      (!searchTerm || matchesPart(part, searchTerm)) &&
      matchesPartFilter(part, partFilter)
    );
  }, [searchTerm, expandedPanel, partFilter]);
  const visibleDraftParts = useMemo(() => {
    if (!expandedPanel) return [];
    return draftParts.filter((part) => part.category === expandedPanel.componentName && part.section === expandedPanel.panelName);
  }, [draftParts, expandedPanel]);
  const partGridRows = useMemo<MasterPartGridRow[]>(() => {
    const deletedIds = new Set(deletedPartIds);
    return [
      ...filteredParts
        .filter((part) => !deletedIds.has(part.id))
        .map((part) => ({ ...part, clientId: `id-${part.id}` })),
      ...visibleDraftParts,
    ];
  }, [deletedPartIds, filteredParts, visibleDraftParts]);
  const showAliasColumn = useMemo(() => partGridRows.some((part) => Boolean(part.aliasName?.trim())), [partGridRows]);
  const hasPartChanges = dirtyPartIds.size > 0 || deletedPartIds.length > 0 || draftParts.some((part) => part.name.trim());
  const [focusedPartCell, setFocusedPartCell] = useState<{ rowIndex: number; field: PartEditableField } | null>(null);
  const toggleComponent = useCallback((component: MasterPanelComponentGroup) => {
    setExpandedComponentKey(component.key);
    setExpandedPanelKey(null);
    setSelectedPartRow(null);
    setSearch("");
  }, []);
  const togglePanel = useCallback((panel: MasterPanelPanelGroup) => {
    setExpandedPanelKey(panel.key);
    setSelectedPartRow(null);
    setFocusedPartCell(null);
    setSearch("");
  }, []);
  const openPartDetail = useCallback(async (part: UnitPanelRecord, mode: "photos" | "activity") => {
    setIsLoadingDetail(true);
    setActiveDetailMode(mode);
    setActivePartDetail(null);
    setActiveActivityType(null);
    setError(null);
    const result = await fetchUnitPanelDetail("", unitId, part.id);
    if (!result.payload) {
      setError("Detail master panel belum bisa dimuat.");
      setIsLoadingDetail(false);
      return;
    }
    setActivePartDetail(result.payload.data);
    setIsLoadingDetail(false);
  }, [unitId]);
  const reloadActivePartDetail = useCallback(async () => {
    if (!activePartDetail) return;
    const refreshed = await fetchUnitPanelDetail("", activePartDetail.unitId, activePartDetail.panel.id);
    if (refreshed.payload) {
      setActivePartDetail(refreshed.payload.data);
    }
  }, [activePartDetail]);
  const gridContext = useMemo<MasterPanelGridContext>(() => ({
    onOpenComponent: toggleComponent,
    onOpenPanel: togglePanel,
    onOpenPartPhoto: (part) => void openPartDetail(part, "photos"),
    onOpenPartActivity: (part) => void openPartDetail(part, "activity"),
  }), [openPartDetail, toggleComponent, togglePanel]);
  const updatePartGridRow = useCallback((row: MasterPartGridRow, field: PartEditableField, value: unknown) => {
    if (row.isDraft) {
      setDraftParts((current) => current.map((part) => part.clientId === row.clientId ? withPartValue(part, field, value) : part));
      return;
    }

    setRows((current) => updateRecordTree(current, row.id, (record) => withPartValue({ ...record, clientId: row.clientId }, field, value)));
    setDirtyPartIds((current) => new Set(current).add(row.id));
  }, []);
  const createDraftPart = useCallback((panel: MasterPanelPanelGroup): MasterPartGridRow => ({
    id: -Date.now(),
    clientId: `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    isDraft: true,
    carId: unitId,
    componentId: null,
    catalogPanelId: null,
    code: null,
    aliasName: null,
    partNumber: null,
    sourcePart: "ADDITIONAL",
    initialCondition: "BEKAS",
    currentStatus: "UNKNOWN",
    location: "UNIT",
    notes: null,
    totalJobdesc: 0,
    totalHours: 0,
    remainingHours: 0,
    sourceGeneralId: null,
    parentId: null,
    nodeType: "PART",
    section: panel.panelName,
    name: "",
    category: panel.componentName,
    isActive: true,
    sortOrder: 0,
    qty: 1,
    defaultLocationType: "UNIT",
    defaultStockStatus: "INSTALLED",
    defaultConditionType: "BEKAS",
    countdownUsageCount: 0,
    statusUsageCount: 0,
    childCount: 0,
    createdAt: null,
    updatedAt: null,
    children: [],
  }), [unitId]);
  const handleAddPartRow = useCallback(() => {
    if (!expandedPanel) return;
    setDraftParts((current) => [...current, createDraftPart(expandedPanel)]);
  }, [createDraftPart, expandedPanel]);
  const loadPanels = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const result = await fetchUnitPanels("", unitId);
    if (!result.payload) {
      setRows([]);
      setError("Struktur panel unit belum bisa dimuat.");
      setIsLoading(false);
      return;
    }

    setRows(result.payload.data.tree);
    setIsLoading(false);
  }, [unitId]);
  const handlePartDelete = useCallback((row = selectedPartRow) => {
    if (!row) return;
    if (!window.confirm("Hapus part ini dari Struktur Panel Unit?")) return;
    if (row.isDraft) {
      setDraftParts((current) => current.filter((part) => part.clientId !== row.clientId));
    } else {
      setDeletedPartIds((current) => current.includes(row.id) ? current : [...current, row.id]);
      setDirtyPartIds((current) => {
        const next = new Set(current);
        next.delete(row.id);
        return next;
      });
    }
    setSelectedPartRow(null);
  }, [selectedPartRow]);
  const handlePartCellValueChanged = useCallback((event: CellValueChangedEvent<MasterPartGridRow>) => {
    const field = event.colDef.field as PartEditableField | undefined;
    if (!event.data || !field || !PART_PASTE_FIELDS.includes(field)) return;
    updatePartGridRow(event.data, field, event.newValue);
  }, [updatePartGridRow]);
  const handlePartSelectionChanged = useCallback((event: SelectionChangedEvent<MasterPartGridRow>) => {
    setSelectedPartRow(event.api.getSelectedRows()[0] ?? null);
  }, []);
  const applyPastedRows = useCallback((text: string) => {
    if (!expandedPanel) return;
    const rowsToPaste = text
      .replace(/\r\n/gu, "\n")
      .split("\n")
      .map((line) => line.split("\t"))
      .filter((cells) => cells.some((cell) => cell.trim()));
    if (rowsToPaste.length === 0) return;

    const startRow = focusedPartCell?.rowIndex ?? partGridRows.length;
    const startField = focusedPartCell?.field ?? "name";
    const startFieldIndex = PART_PASTE_FIELDS.indexOf(startField);
    const nextRows = [...partGridRows];
    const newDrafts: MasterPartGridRow[] = [];

    rowsToPaste.forEach((cells, offset) => {
      const rowIndex = startRow + offset;
      let target = nextRows[rowIndex];
      if (!target) {
        target = createDraftPart(expandedPanel);
        nextRows.push(target);
      }
      cells.forEach((cell, cellIndex) => {
        const field = PART_PASTE_FIELDS[startFieldIndex + cellIndex];
        if (!field) return;
        if (target.isDraft && !draftParts.some((part) => part.clientId === target.clientId)) {
          target = withPartValue(target, field, cell.trim());
          nextRows[rowIndex] = target;
          return;
        }
        updatePartGridRow(target, field, cell.trim());
      });
      if (target.isDraft && !draftParts.some((part) => part.clientId === target.clientId)) {
        newDrafts.push(target);
      }
    });
    if (newDrafts.length > 0) {
      setDraftParts((current) => [...current, ...newDrafts]);
    }
  }, [createDraftPart, draftParts, expandedPanel, focusedPartCell, partGridRows, updatePartGridRow]);
  const handlePartKeyDown = useCallback((event: CellKeyDownEvent<MasterPartGridRow>) => {
    const keyboardEvent = event.event as KeyboardEvent | undefined;
    if (!keyboardEvent || !event.data) return;
    if ((keyboardEvent.ctrlKey || keyboardEvent.metaKey) && keyboardEvent.key.toLowerCase() === "c") {
      const row = event.data;
      void navigator.clipboard?.writeText([
        row.name,
        row.aliasName ?? "",
        row.partNumber ?? "",
        displayCondition(row),
        displayCurrentStatus(row),
        formatNumber(row.qty),
      ].join("\t"));
    }
    if (!canManage || isSubmitting) return;
    if ((keyboardEvent.ctrlKey || keyboardEvent.metaKey) && keyboardEvent.key.toLowerCase() === "d" && focusedPartCell) {
      const target = partGridRows[focusedPartCell.rowIndex + 1];
      if (target) {
        keyboardEvent.preventDefault();
        updatePartGridRow(target, focusedPartCell.field, event.data[focusedPartCell.field]);
      }
    }
    if (keyboardEvent.key === "Delete" || keyboardEvent.key === "Backspace") {
      handlePartDelete(event.data);
    }
  }, [canManage, isSubmitting, focusedPartCell, handlePartDelete, partGridRows, updatePartGridRow]);
  const handleSaveParts = useCallback(async () => {
    if (!expandedPanel) return;
    const dirtyRows = flatRows.filter((part) => dirtyPartIds.has(part.id));
    const newRows = draftParts.filter((part) => part.name.trim());

    setIsSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      for (const id of deletedPartIds) {
        const result = await deleteUnitPanel(unitId, id);
        if (!result.success) throw new Error(result.message);
      }
      for (const part of dirtyRows) {
        const result = await updateUnitPanel(unitId, part.id, recordToUpdateInput(part));
        if (!result.success) throw new Error(result.message);
      }
      for (const part of newRows) {
        const createResult = await createUnitAdditionalMasterPanel(unitId, {
          componentName: part.category ?? expandedPanel.componentName,
          panelName: part.section || expandedPanel.panelName,
          itemName: part.name.trim(),
          partNumber: toNullable(part.partNumber),
          deskription: toNullable(part.notes),
        });
        if (!createResult.success) throw new Error(createResult.message);
        const updateResult = await updateUnitPanel(unitId, createResult.result.panelId, recordToUpdateInput({
          ...part,
          id: createResult.result.panelId,
          carId: unitId,
        }));
        if (!updateResult.success) throw new Error(updateResult.message);
      }
      setDirtyPartIds(new Set());
      setDeletedPartIds([]);
      setDraftParts([]);
      setSelectedPartRow(null);
      setMessage("Struktur Panel Unit berhasil disimpan.");
      await loadPanels();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Struktur Panel Unit belum bisa disimpan.");
    } finally {
      setIsSubmitting(false);
    }
  }, [deletedPartIds, dirtyPartIds, draftParts, expandedPanel, flatRows, loadPanels, unitId]);
  const handleCancelPartChanges = useCallback(() => {
    setDirtyPartIds(new Set());
    setDeletedPartIds([]);
    setDraftParts([]);
    setSelectedPartRow(null);
    void loadPanels();
  }, [loadPanels]);
  function navigateBack(toComponents = false) {
    if (isSubmitting) return;
    if (hasPartChanges) {
      if (!window.confirm("Perubahan belum disimpan. Buang perubahan dan kembali?")) return;
      handleCancelPartChanges();
    }
    if (toComponents || !expandedPanel) setExpandedComponentKey(null);
    setExpandedPanelKey(null);
    setSelectedPartRow(null);
    setFocusedPartCell(null);
    setSearch("");
  }
  const componentColumnDefs = useMemo<ColDef<MasterPanelComponentGroup>[]>(() => [
    {
      headerName: "Component",
      field: "componentName",
      minWidth: 240,
      flex: 1.7,
      cellRenderer: ComponentNameRenderer,
    },
    { headerName: "Panel", field: "totalPanel", width: 110, cellClass: "font-mono text-muted-foreground" },
    { headerName: "Part", field: "totalPart", width: 110, cellClass: "font-mono text-muted-foreground" },
    {
      headerName: "Progress",
      field: "progress",
      width: 150,
      cellRenderer: ({ data }: { data?: MasterPanelComponentGroup }) => data ? (
        <div className="flex h-full items-center gap-2">
          <div className="h-1.5 flex-1 bg-muted">
            <div className="h-full bg-primary" style={{ width: `${data.progress}%` }} />
          </div>
          <span className="w-10 text-right font-mono text-[12px] text-muted-foreground">{data.progress}%</span>
        </div>
      ) : null,
    },
    {
      headerName: "Action",
      width: 90,
      sortable: false,
      filter: false,
      cellRenderer: ComponentNavigationRenderer,
    },
  ], []);
  const panelColumnDefs = useMemo<ColDef<MasterPanelPanelGroup>[]>(() => [
    {
      headerName: "Panel",
      field: "panelName",
      minWidth: 220,
      flex: 1.4,
      cellRenderer: PanelNameRenderer,
    },
    {
      headerName: "Part",
      field: "totalPart",
      width: 120,
      cellClass: "font-mono text-muted-foreground",
    },
    {
      headerName: "Progress",
      field: "progress",
      width: 130,
      cellRenderer: ({ data }: { data?: MasterPanelPanelGroup }) => data ? (
        <div className="flex h-full items-center gap-2">
          <div className="h-1.5 flex-1 bg-muted">
            <div className="h-full bg-primary" style={{ width: `${data.progress}%` }} />
          </div>
          <span className="w-10 text-right font-mono text-[12px] text-muted-foreground">{data.progress}%</span>
        </div>
      ) : null,
    },
    { headerName: "Pekerjaan", field: "totalJobdesc", width: 120, cellClass: "font-mono text-muted-foreground" },
    {
      headerName: "Durasi",
      field: "totalHours",
      width: 125,
      cellClass: "font-mono text-muted-foreground",
      valueFormatter: ({ value }) => `${formatNumber(Number(value ?? 0))} jam`,
    },
    {
      headerName: "Sisa",
      field: "remainingHours",
      width: 150,
      cellClass: "font-mono text-muted-foreground",
      valueFormatter: ({ value }) => `${formatNumber(Number(value ?? 0))} jam`,
    },
    {
      headerName: "Action",
      width: 90,
      sortable: false,
      filter: false,
      cellRenderer: PanelNavigationRenderer,
    },
  ], []);
  const partColumnDefs = useMemo<ColDef<MasterPartGridRow>[]>(() => [
    {
      headerName: "Nama Part",
      field: "name",
      minWidth: 260,
      flex: 1.8,
      editable: canManage,
      valueGetter: ({ data }) => data?.name ?? "-",
    },
    ...(showAliasColumn ? [{
      headerName: "Alias",
      field: "aliasName" as const,
      minWidth: 150,
      flex: 0.8,
      editable: false,
      valueGetter: ({ data }: { data?: MasterPartGridRow }) => data?.aliasName?.trim() || "-",
    }] : []),
    {
      headerName: "Part Number",
      field: "partNumber",
      minWidth: 160,
      flex: 0.9,
      editable: canManage,
      valueGetter: ({ data }) => data?.partNumber ?? "-",
    },
    {
      headerName: "Kondisi",
      field: "initialCondition",
      editable: canManage,
      cellEditor: "agSelectCellEditor",
      cellEditorParams: { values: ["BARU", "BEKAS", "RESTORE", "RESTORASI", "LAYAK", "TIDAK LAYAK", "UNKNOWN"] },
      valueGetter: ({ data }) => data ? displayCondition(data) : "-",
      minWidth: 130,
      flex: 0.8,
    },
    {
      headerName: "Status",
      field: "currentStatus",
      editable: canManage,
      cellEditor: "agSelectCellEditor",
      cellEditorParams: { values: ["WAITING", "UNKNOWN", "INSTALLED", "IN_PROGRESS", "DONE", "SELESAI"] },
      minWidth: 150,
      flex: 0.9,
      cellRenderer: PartStatusRenderer,
    },
    {
      headerName: "Qty",
      field: "qty",
      width: 90,
      editable: canManage,
      cellClass: "font-mono text-muted-foreground",
      valueFormatter: ({ value }) => formatNumber(Number(value ?? 0)),
      valueParser: ({ newValue }) => toPositiveQty(newValue),
    },
    {
      headerName: "Action",
      width: 120,
      sortable: false,
      filter: false,
      editable: false,
      cellRenderer: (params: ICellRendererParams<MasterPartGridRow>) => params.data && !params.data.isDraft ? (
        <div className="flex h-full items-center gap-1">
          <button type="button" className="catalog-icon-button" title="Foto" aria-label={`Foto ${params.data.name}`}
            onClick={(event) => { event.stopPropagation(); getGridContext(params).onOpenPartPhoto(params.data!); }}>
            <ImageIcon className="h-4 w-4" />
          </button>
          <button type="button" className="catalog-icon-button" title="Aktivitas" aria-label={`Aktivitas ${params.data.name}`}
            onClick={(event) => { event.stopPropagation(); getGridContext(params).onOpenPartActivity(params.data!); }}>
            <ListPlus className="h-4 w-4" />
          </button>
        </div>
      ) : null,
    },
  ], [canManage, showAliasColumn]);

  useEffect(() => {
    if (initialRows !== undefined) {
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial client fetch when server data is unavailable.
    void loadPanels();
  }, [initialRows, loadPanels]);

  function openAdditionalForm() {
    setAdditionalForm({
      componentName: expandedPanel?.componentName ?? expandedComponent?.componentName ?? "",
      panelName: expandedPanel?.panelName ?? "",
      itemName: "",
      partNumber: "",
      deskription: "",
    });
    setMessage(null);
    setError(null);
    setIsAddingAdditional(true);
  }

  async function handleAdditionalSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage) {
      return;
    }

    const payload = {
      componentName: additionalForm.componentName.trim(),
      panelName: additionalForm.panelName.trim(),
      itemName: additionalForm.itemName.trim(),
      partNumber: additionalForm.partNumber.trim() || null,
      deskription: additionalForm.deskription.trim() || null,
    };

    if (!payload.componentName || !payload.panelName || !payload.itemName) {
      setError("Bagian, panel, dan item wajib diisi.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setMessage(null);
    const result = await createUnitAdditionalMasterPanel(unitId, payload);
    if (!result.success) {
      setError(result.message);
      setIsSubmitting(false);
      return;
    }

    setMessage("Item tambahan berhasil masuk Struktur Panel Unit.");
    setIsAddingAdditional(false);
    setAdditionalForm(EMPTY_ADDITIONAL_FORM);
    await loadPanels();
    setIsSubmitting(false);
  }

  return (
    <section className="border border-border bg-card">

      {/* ── HEADER ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-2">
        <div>
          <p className="text-[14px] font-mono uppercase tracking-[0.12em] text-muted-foreground">Struktur Panel Unit</p>
          <h3 className="text-[15px] text-foreground">{expandedPanel?.panelName ?? expandedComponent?.componentName ?? "Daftar Component"}</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[14px] text-muted-foreground">{rootCount} panel · {partCount} part</span>
          <div className="w-px h-4 bg-muted" />
          <button type="button" disabled={hasPartChanges || isSubmitting} onClick={() => void loadPanels()}
            className="inline-flex items-center gap-1.5 border border-border px-2 py-1 text-[14px] font-mono uppercase text-foreground hover:text-foreground hover:border-border transition-colors">
            <RefreshCw className="h-3 w-3" strokeWidth={ICON_STROKE_WIDTH} /> Refresh
          </button>
          {canManage && !expandedPanel && (
            <button type="button" onClick={openAdditionalForm}
              className="inline-flex items-center gap-1.5 border border-primary/30 bg-primary/[0.04] px-2 py-1 text-[14px] font-mono uppercase text-app-accent-ink hover:bg-primary/10 transition-colors">
              <Plus className="h-3 w-3" strokeWidth={ICON_STROKE_WIDTH} /> Tambah Panel Baru
            </button>
          )}
        </div>
      </div>

      {expandedComponent && (
        <nav aria-label="Navigasi struktur panel" className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3 text-[13px]">
          <button type="button" disabled={isSubmitting} onClick={() => navigateBack()} className="mr-2 inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Kembali
          </button>
          <button type="button" disabled={isSubmitting} onClick={() => navigateBack(true)} className="text-muted-foreground hover:text-foreground">Component</button>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          {expandedPanel ? (
            <>
              <button type="button" disabled={isSubmitting} onClick={() => navigateBack()} className="text-muted-foreground hover:text-foreground">{expandedComponent.componentName}</button>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              <span aria-current="page">{expandedPanel.panelName}</span>
            </>
          ) : <span aria-current="page">{expandedComponent.componentName}</span>}
        </nav>
      )}

      <div className="border-b border-border bg-background">
        <div className="flex items-center gap-3 px-4 py-2">
          <div className="flex flex-1 items-center gap-2 border border-border bg-card px-3">
            <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={ICON_STROKE_WIDTH} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari bagian, panel, atau part..."
              className="h-8 w-full bg-transparent text-[15px] font-mono text-foreground outline-none placeholder:text-muted-foreground"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="text-[14px] font-mono text-muted-foreground transition-colors hover:text-foreground">
                x
              </button>
            )}
          </div>
        </div>
        <div className="flex gap-2 overflow-x-auto px-4 pb-3">
          {PART_FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => setPartFilter(filter.value)}
              className={`shrink-0 border px-2.5 py-1 text-[12px] font-mono uppercase tracking-[0.08em] transition-colors ${
                partFilter === filter.value
                  ? "border-primary/40 bg-primary/[0.08] text-app-accent-ink"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-[300px]">

        {/* LEFT — Tabel */}
        <div className="overflow-auto">
          {message && (
            <div className="border-b border-success/20 bg-success/[0.04] px-4 py-2 text-[15px] font-mono text-success">
              {message}
            </div>
          )}
          {error && (
            <div className="border-b border-destructive/20 bg-destructive/[0.04] px-4 py-2 text-[15px] font-mono text-destructive">
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="px-4 py-6 text-[15px] font-mono text-muted-foreground">Memuat struktur panel unit...</div>
          ) : !expandedComponent && filteredComponents.length === 0 ? (
            <div className="m-4 border border-dashed border-border px-4 py-8 text-center text-[15px] font-mono text-muted-foreground">
              {search || partFilter !== "ALL" ? "Tidak ada struktur panel yang cocok." : "Belum ada struktur panel unit."}
            </div>
          ) : (
            <div className="space-y-4 p-4">
              {!expandedComponent && <div className="ag-theme-alpine sms-ag-grid h-[32rem] w-full border border-border">
                <AgGridReact<MasterPanelComponentGroup>
                  rowData={filteredComponents}
                  columnDefs={componentColumnDefs}
                  context={gridContext}
                  defaultColDef={{
                    sortable: true,
                    resizable: true,
                    filter: true,
                    suppressHeaderMenuButton: true,
                  }}
                  getRowId={({ data }) => data.key}
                  rowHeight={46}
                  suppressCellFocus={false}
                  suppressMovableColumns
                  onRowClicked={({ data }) => data && toggleComponent(data)}
                  overlayNoRowsTemplate="<span class='text-muted-foreground'>Belum ada bagian pada struktur panel unit.</span>"
                />
              </div>}

              {expandedComponent ? (
                <div>
                  {!expandedPanel && <div className="flex items-start justify-between gap-4 border-b border-border px-4 py-3">
                    <div>
                      <p className="text-[13px] font-mono uppercase tracking-[0.12em] text-muted-foreground">Panel</p>
                      <h4 className="mt-1 text-[18px] font-semibold text-foreground">{expandedComponent.componentName}</h4>
                      <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-[14px] text-muted-foreground sm:grid-cols-5">
                        <span>Panel <strong className="font-mono text-foreground">{expandedComponent.totalPanel}</strong></span>
                        <span>Part <strong className="font-mono text-foreground">{expandedComponent.totalPart}</strong></span>
                        <span>Progress <strong className="font-mono text-foreground">{expandedComponent.progress}%</strong></span>
                        <span>Selesai <strong className="font-mono text-foreground">{expandedComponent.completedPart}</strong></span>
                        <span>Sisa <strong className="font-mono text-foreground">{expandedComponent.remainingPart}</strong></span>
                      </div>
                    </div>
                  </div>}
                  {!expandedPanel && <div className="ag-theme-alpine sms-ag-grid h-[32rem] w-full">
                    <AgGridReact<MasterPanelPanelGroup>
                      rowData={filteredPanels}
                      columnDefs={panelColumnDefs}
                      context={gridContext}
                      defaultColDef={{
                        sortable: true,
                        resizable: true,
                        filter: true,
                        suppressHeaderMenuButton: true,
                      }}
                      getRowId={({ data }) => data.key}
                      rowHeight={46}
                      suppressCellFocus={false}
                      suppressMovableColumns
                      onRowClicked={({ data }) => data && togglePanel(data)}
                      overlayNoRowsTemplate="<span class='text-muted-foreground'>Belum ada panel pada bagian ini.</span>"
                    />
                  </div>}

                  {expandedPanel ? (
                    <div className="border-t border-border bg-card">
                      <div className="flex items-start justify-between gap-4 border-b border-border px-4 py-3">
                        <div>
                          <p className="text-[13px] font-mono uppercase tracking-[0.12em] text-muted-foreground">Daftar Part</p>
                          <h4 className="mt-1 text-[18px] font-semibold text-foreground">{expandedPanel.panelName}</h4>
                          <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-[14px] text-muted-foreground sm:grid-cols-5">
                            <span>Part <strong className="font-mono text-foreground">{expandedPanel.totalPart}</strong></span>
                            <span>Progress <strong className="font-mono text-foreground">{expandedPanel.progress}%</strong></span>
                            <span>Pekerjaan <strong className="font-mono text-foreground">{expandedPanel.totalJobdesc}</strong></span>
                            <span>Durasi <strong className="font-mono text-foreground">{formatNumber(expandedPanel.totalHours)} jam</strong></span>
                            <span>Sisa <strong className="font-mono text-foreground">{formatNumber(expandedPanel.remainingHours)} jam</strong></span>
                          </div>
                        </div>
                        {canManage ? (
                          <div className="flex flex-wrap justify-end gap-2">
                            <button
                              type="button"
                              onClick={handleAddPartRow}
                              className="inline-flex items-center gap-1.5 border border-primary/30 bg-primary/[0.04] px-2 py-1 text-[14px] font-mono uppercase text-app-accent-ink hover:bg-primary/10"
                            >
                              <Plus className="h-3 w-3" strokeWidth={ICON_STROKE_WIDTH} /> Tambah Part
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePartDelete()}
                              disabled={!selectedPartRow || isSubmitting}
                              className="border border-border px-2 py-1 text-[14px] font-mono uppercase text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              Hapus
                            </button>
                            <button
                              type="button"
                              onClick={handleCancelPartChanges}
                              disabled={!hasPartChanges || isSubmitting}
                              className="border border-border px-2 py-1 text-[14px] font-mono uppercase text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              Batal
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleSaveParts()}
                              disabled={!hasPartChanges || isSubmitting}
                              className="border border-primary/40 bg-primary/[0.06] px-2 py-1 text-[14px] font-mono uppercase text-app-accent-ink hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              {isSubmitting ? "Menyimpan..." : "Simpan Data"}
                            </button>
                          </div>
                        ) : null}
                      </div>
                      <div
                        className="ag-theme-alpine sms-ag-grid h-[32rem] w-full"
                        onPaste={(event) => {
                          if (!canManage || isSubmitting) return;
                          const text = event.clipboardData.getData("text/plain");
                          if (!text.trim()) return;
                          event.preventDefault();
                          applyPastedRows(text);
                        }}
                      >
                        <AgGridReact<MasterPartGridRow>
                          rowData={partGridRows}
                          columnDefs={partColumnDefs}
                          context={gridContext}
                          defaultColDef={{
                            sortable: true,
                            resizable: true,
                            filter: true,
                            suppressHeaderMenuButton: true,
                          }}
                          getRowId={({ data }) => data.clientId}
                          rowHeight={44}
                          suppressCellFocus={false}
                          suppressMovableColumns
                          rowSelection="single"
                          onSelectionChanged={handlePartSelectionChanged}
                          onCellValueChanged={handlePartCellValueChanged}
                          onCellKeyDown={handlePartKeyDown}
                          onCellFocused={({ rowIndex, column }) => {
                            const field = typeof column === "string" ? undefined : column?.getColDef().field as PartEditableField | undefined;
                            if (rowIndex !== null && field && PART_PASTE_FIELDS.includes(field)) {
                              setFocusedPartCell({ rowIndex, field });
                            }
                          }}
                          overlayNoRowsTemplate="<span class='text-muted-foreground'>Belum ada part pada panel ini.</span>"
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}
        </div>

      </div>
      {isLoadingDetail ? (
        <div className="border-t border-border px-4 py-4 text-[14px] font-mono text-muted-foreground">Memuat detail master panel...</div>
      ) : activePartDetail && activeDetailMode ? (
        <div className="space-y-4 border-t border-border bg-background p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[13px] font-mono uppercase tracking-[0.12em] text-muted-foreground">
                {activeDetailMode === "photos" ? "Foto Master Panel" : "Aktivitas Master Panel"}
              </p>
              <h4 className="mt-1 text-[18px] font-semibold text-foreground">{activePartDetail.panel.name}</h4>
              <p className="mt-1 text-[13px] text-muted-foreground">{activePartDetail.panel.category ?? "-"} / {activePartDetail.panel.section}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setActivePartDetail(null);
                  setActiveDetailMode(null);
                  setActiveActivityType(null);
                }}
                className="catalog-icon-button"
                title="Tutup"
              >
                <X className="h-4 w-4" strokeWidth={ICON_STROKE_WIDTH} />
              </button>
            </div>
          </div>

          {activeDetailMode === "photos" ? (
            <MasterPanelPhotoGallery detail={activePartDetail} />
          ) : (
            <div className="space-y-4">
              {activeActivityType === null ? (
                <MasterPanelActivityMenu
                  detail={activePartDetail}
                  canCreateCountdown={canManage}
                  canCreateWo={canCreateWo}
                  canCreatePr={canCreatePr}
                  canCreateVendor={canCreateVendor}
                  onSelect={setActiveActivityType}
                />
              ) : null}
              {activeActivityType ? (
                <button
                  type="button"
                  onClick={() => setActiveActivityType(null)}
                  className="inline-flex items-center gap-1.5 border border-border px-3 py-2 text-[12px] font-mono uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <ArrowLeft className="h-3.5 w-3.5" strokeWidth={ICON_STROKE_WIDTH} />
                  Pilih Aktivitas
                </button>
              ) : null}
              {activeActivityType === "COUNTDOWN" ? (
                <MasterPanelCountdownGrid
                  detail={activePartDetail}
                  canCreateCountdown={canManage}
                  onCreated={reloadActivePartDetail}
                />
              ) : null}
              {activeActivityType === "WO" ? (
                <MasterPanelWoGrid
                  detail={activePartDetail}
                  canCreateWo={canCreateWo}
                  onCreated={reloadActivePartDetail}
                />
              ) : null}
              {activeActivityType === "PR" ? (
                <MasterPanelPrGrid
                  detail={activePartDetail}
                  canCreatePr={canCreatePr}
                  onCreated={reloadActivePartDetail}
                />
              ) : null}
              {activeActivityType === "WOV" ? (
                <MasterPanelWovGrid
                  detail={activePartDetail}
                  canCreateVendor={canCreateVendor}
                  onCreated={reloadActivePartDetail}
                />
              ) : null}
            </div>
          )}
        </div>
      ) : null}
      {isAddingAdditional ? (
        <div className="fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l border-border bg-card shadow-2xl">
          <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
            <div>
              <p className="text-[13px] font-mono uppercase tracking-[0.12em] text-muted-foreground">Item Tambahan</p>
              <h4 className="mt-1 text-[18px] font-semibold text-foreground">Tambah Panel Baru</h4>
            </div>
            <button type="button" onClick={() => setIsAddingAdditional(false)} className="catalog-icon-button" title="Tutup">
              <X className="h-3.5 w-3.5" strokeWidth={ICON_STROKE_WIDTH} />
            </button>
          </div>
          <form className="flex flex-1 flex-col" onSubmit={(event) => void handleAdditionalSubmit(event)}>
            <div className="flex-1 space-y-3 overflow-auto px-5 py-4">
              <label className="block space-y-1">
                <span className="text-[13px] font-mono uppercase tracking-[0.12em] text-muted-foreground">Bagian</span>
                <input
                  value={additionalForm.componentName}
                  onChange={(event) => setAdditionalForm((current) => ({ ...current, componentName: event.target.value }))}
                  className="h-9 w-full border border-border bg-background px-3 text-[14px] text-foreground outline-none focus:border-primary/45"
                  placeholder="Contoh: BODY"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[13px] font-mono uppercase tracking-[0.12em] text-muted-foreground">Nama Panel</span>
                <input
                  value={additionalForm.panelName}
                  onChange={(event) => setAdditionalForm((current) => ({ ...current, panelName: event.target.value }))}
                  className="h-9 w-full border border-border bg-background px-3 text-[14px] text-foreground outline-none focus:border-primary/45"
                  placeholder="Contoh: FRONT BUMPER"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[13px] font-mono uppercase tracking-[0.12em] text-muted-foreground">Nama Part</span>
                <input
                  value={additionalForm.itemName}
                  onChange={(event) => setAdditionalForm((current) => ({ ...current, itemName: event.target.value }))}
                  className="h-9 w-full border border-border bg-background px-3 text-[14px] text-foreground outline-none focus:border-primary/45"
                  placeholder="Contoh: Bracket Foglamp Custom"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[13px] font-mono uppercase tracking-[0.12em] text-muted-foreground">Part Number</span>
                <input
                  value={additionalForm.partNumber}
                  onChange={(event) => setAdditionalForm((current) => ({ ...current, partNumber: event.target.value }))}
                  className="h-9 w-full border border-border bg-background px-3 text-[14px] text-foreground outline-none focus:border-primary/45"
                  placeholder="Opsional"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[13px] font-mono uppercase tracking-[0.12em] text-muted-foreground">Catatan</span>
                <textarea
                  value={additionalForm.deskription}
                  onChange={(event) => setAdditionalForm((current) => ({ ...current, deskription: event.target.value }))}
                  className="min-h-24 w-full resize-y border border-border bg-background px-3 py-2 text-[14px] text-foreground outline-none focus:border-primary/45"
                  placeholder="Opsional"
                />
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
              <button type="button" onClick={() => setIsAddingAdditional(false)} className="border border-border px-3 py-1.5 text-[13px] font-mono uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground">
                Batal
              </button>
              <button type="submit" disabled={isSubmitting} className="border border-primary/40 bg-primary/[0.06] px-3 py-1.5 text-[13px] font-mono uppercase tracking-[0.08em] text-app-accent-ink transition-colors hover:bg-primary/10 disabled:opacity-30">
                {isSubmitting ? "Menyimpan..." : "Simpan Data"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
