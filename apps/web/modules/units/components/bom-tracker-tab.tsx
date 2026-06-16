"use client";

import type { UnitBomNode, UnitBomWorkspace } from "@smsystem/contracts/unit-bom";
import type {
  CreateUnitPanelRequest,
  UnitPanelRecord,
  UpdateUnitPanelRequest,
} from "@smsystem/contracts/unit-panel";
import {
  ArrowUpRight,
  Boxes,
  CheckCircle2,
  ChevronDown,
  Edit3,
  GitBranch,
  Grip,
  MapPin,
  PackageCheck,
  PackagePlus,
  PackageSearch,
  Plus,
  RefreshCw,
  Trash2,
  Wrench,
  X,
  XCircle,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent,
  type PointerEvent,
} from "react";
import { useRouter } from "next/navigation";
import {
  createUnitPanel,
  deleteUnitPanel,
  fetchUnitBom,
  fetchUnitPanels,
  renameUnitPanelCategory,
  updateUnitPanel,
} from "@/shared/api/units";
import { useSweetAlert } from "@/shared/ui/sweet-alert";

interface BomTrackerTabProps {
  carId: string;
  unitName?: string;
  bom: UnitBomWorkspace | null;
  canManagePhotos: boolean;
  canDownloadPhotos: boolean;
  canManagePanels?: boolean;
}

type TriageTone = "good" | "repair" | "replace" | "unknown";

interface TriageMeta {
  label: string;
  tone: TriageTone;
  className: string;
  dotClassName: string;
  icon: typeof CheckCircle2;
}

type FormMode =
  | { type: "create"; sectionMode: "existing" | "new"; sourceNode?: UnitBomNode | null }
  | { type: "edit"; record: UnitPanelRecord }
  | { type: "edit-category"; category: string }
  | { type: "edit-section"; category: string; section: string }
  | null;

interface PanelFormState {
  section: string;
  name: string;
  category: string;
  sortOrder: string;
  qty: string;
  defaultLocationType: "GUDANG" | "WORKSHOP" | "UNIT";
  defaultStockStatus: "IN_STORAGE" | "RETRIEVED" | "INSTALLED" | "LOST";
  defaultConditionType: "BARU" | "RESTORE" | "BEKAS";
  isActive: boolean;
  nodeType: "PANEL" | "PART";
  nodeTypeName: string;
  parentId: string;
  parentName: string;
}

interface SearchOption {
  value: string;
  label?: string;
}

interface CanvasNode {
  node: UnitBomNode;
  depth: number;
  x: number;
  y: number;
  width: number;
  height: number;
  parentId: string | null;
}

interface CanvasLayout {
  nodes: CanvasNode[];
  width: number;
  height: number;
}

interface NodePosition {
  x: number;
  y: number;
}

type SelectionTarget =
  | { type: "unit" }
  | { type: "node"; node: UnitBomNode }
  | null;

interface SearchableFieldProps {
  value: string;
  options: SearchOption[];
  onChange: (value: string) => void;
  onSelect?: (option: SearchOption) => void;
  placeholder?: string;
  disabled?: boolean;
}

interface PersistedCanvasState {
  zoom?: number;
  isRootExpanded?: boolean;
  expandedNodeIds?: string[];
  nodePositions?: Record<string, NodePosition>;
}

const NODE_WIDTH = 220;
const NODE_HEIGHT = 118;
const COLUMN_GAP = 96;
const ROW_GAP = 24;
const ROOT_NODE_ID = "__unit_root";
const CANVAS_STATE_VERSION = "v1";

const LOCATION_LABEL: Record<PanelFormState["defaultLocationType"], string> = {
  UNIT: "UNIT",
  WORKSHOP: "WORKSHOP",
  GUDANG: "GUDANG",
};

const STOCK_STATUS_LABEL: Record<PanelFormState["defaultStockStatus"], string> = {
  INSTALLED: "Terpasang",
  IN_STORAGE: "Disimpan",
  RETRIEVED: "Dilepas",
  LOST: "Hilang",
};

const CONDITION_LABEL: Record<PanelFormState["defaultConditionType"], string> = {
  BEKAS: "Bekas",
  RESTORE: "Restore",
  BARU: "Baru",
};

function triageMeta(node: UnitBomNode): TriageMeta {
  if (node.physicalStatus === "INSTALLED" || node.logisticStatus === "READY_GUDANG") {
    return {
      label: "BAGUS",
      tone: "good",
      className: "border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-300",
      dotClassName: "bg-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.45)]",
      icon: CheckCircle2,
    };
  }

  if (node.physicalStatus === "IN_DIVISION" || node.logisticStatus === "AT_VENDOR") {
    return {
      label: "REPAIR",
      tone: "repair",
      className: "border-amber-500/25 bg-amber-500/[0.07] text-amber-400",
      dotClassName: "bg-amber-400 shadow-[0_0_16px_rgba(245,158,11,0.45)]",
      icon: Wrench,
    };
  }

  if (node.physicalStatus === "DISASSEMBLED" || node.logisticStatus === "ORDER_PR") {
    return {
      label: "REPLACE",
      tone: "replace",
      className: "border-red-500/20 bg-red-500/[0.06] text-red-300",
      dotClassName: "bg-red-400 shadow-[0_0_16px_rgba(248,113,113,0.45)]",
      icon: XCircle,
    };
  }

  return {
    label: "PERLU CEK",
    tone: "unknown",
    className: "border-white/10 bg-white/[0.03] text-white/40",
    dotClassName: "bg-white/30",
    icon: PackageSearch,
  };
}

function hierarchyText(node: UnitBomNode): string {
  const parts = [node.category, node.section].filter(Boolean);
  if (node.nodeType === "CATEGORY") return "Kelompok utama";
  if (node.nodeType === "SECTION") return node.category ? `Bagian dari ${node.category}` : "Sub kelompok";
  return parts.length > 0 ? parts.join(" > ") : "Belum masuk kelompok";
}

function hasOperationalTrace(node: UnitBomNode): boolean {
  if (node.actualId) return true;
  if (node.logisticStatus || node.logisticReference || node.logisticPath) return true;
  if ((node.detail?.timeline.length ?? 0) > 0) return true;
  if ((node.detail?.documents.length ?? 0) > 0) return true;
  if ((node.detail?.photos ?? []).some((slot) => slot.photoCount > 0)) return true;
  if (Number(node.progressPercent ?? 0) > 0) return true;
  if (Number(node.remainingHours ?? 0) > 0) return true;
  return Boolean(node.divisionId || node.divisionName);
}

function panelDetailKey(node: UnitBomNode): string | null {
  if (node.actualId) return node.actualId;
  if (node.panelId) return `panel-${node.panelId}`;
  return null;
}

function stockStatusForLocation(
  locationType: PanelFormState["defaultLocationType"],
): PanelFormState["defaultStockStatus"] {
  if (locationType === "UNIT") return "INSTALLED";
  if (locationType === "GUDANG") return "IN_STORAGE";
  return "RETRIEVED";
}

function normalizeInventoryForm(form: PanelFormState): PanelFormState {
  if (form.defaultLocationType !== "UNIT") return form;
  if (form.defaultStockStatus === "INSTALLED") return form;
  return { ...form, defaultStockStatus: "INSTALLED" };
}

function emptyForm(): PanelFormState {
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
    nodeType: "PANEL",
    nodeTypeName: "Panel",
    parentId: "",
    parentName: "",
  };
}

function formFromRecord(record: UnitPanelRecord): PanelFormState {
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
    nodeType: record.nodeType,
    nodeTypeName: record.nodeType === "PART" ? "Part" : "Panel",
    parentId: record.parentId === null ? "" : String(record.parentId),
    parentName: "",
  });
}

function formForNode(node: UnitBomNode): PanelFormState {
  const shouldCreatePart = node.panelId !== null || node.nodeType === "PART";
  return normalizeInventoryForm({
    section: node.section ?? "",
    name: "",
    category: node.category ?? "",
    sortOrder: "0",
    qty: "1",
    defaultLocationType: "UNIT",
    defaultStockStatus: "INSTALLED",
    defaultConditionType: "BEKAS",
    isActive: true,
    nodeType: shouldCreatePart ? "PART" : "PANEL",
    nodeTypeName: shouldCreatePart ? "Part" : "Panel",
    parentId: node.panelId ? String(node.panelId) : "",
    parentName: node.panelId ? node.label : "",
  });
}

function formForChild(parent: UnitPanelRecord): PanelFormState {
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
    nodeType: "PART",
    nodeTypeName: "Part",
    parentId: String(parent.id),
    parentName: parent.name,
  });
}

function buildPayload(form: PanelFormState): Omit<CreateUnitPanelRequest, "parentId"> & UpdateUnitPanelRequest {
  const normalizedForm = normalizeInventoryForm(form);
  return {
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
}

function flattenPanelRecords(rows: UnitPanelRecord[]): UnitPanelRecord[] {
  const records: UnitPanelRecord[] = [];
  for (const row of rows) {
    records.push(row);
    records.push(...flattenPanelRecords(row.children));
  }
  return records;
}

function displayCategory(value: string | null | undefined): string {
  return value?.trim() || "Lainnya";
}

function estimateNodeHeight(node: UnitBomNode): number {
  const hierarchy = hierarchyText(node);
  const labelLines = Math.max(1, Math.ceil(node.label.length / 22));
  const hierarchyLines = Math.max(1, Math.ceil(hierarchy.length / 30));
  const locationLines = node.nodeType === "PART" ? Math.max(1, Math.ceil((node.divisionName ?? "Belum ditentukan").length / 28)) : 1;
  return NODE_HEIGHT + (labelLines - 1) * 16 + (hierarchyLines - 1) * 14 + (locationLines - 1) * 14;
}

function recordMatchesCategory(record: UnitPanelRecord, category: string): boolean {
  return displayCategory(record.category) === category;
}

function buildCanvasLayout(nodes: UnitBomNode[], expandedNodeIds: Set<string>, isRootExpanded: boolean): CanvasLayout {
  const positioned: CanvasNode[] = [];
  let row = 0;
  let maxDepth = 1;

  function walk(items: UnitBomNode[], depth: number, parentId: string | null) {
    maxDepth = Math.max(maxDepth, depth);
    for (const item of items) {
      const nodeHeight = estimateNodeHeight(item);
      const previousBottom = positioned.length > 0
        ? Math.max(...positioned.map((node) => node.y + node.height))
        : 32;
      const y = positioned.length > 0 ? previousBottom + ROW_GAP : 32;
      const x = 32 + depth * (NODE_WIDTH + COLUMN_GAP);
      row += 1;
      positioned.push({
        node: item,
        depth,
        x,
        y,
        width: NODE_WIDTH,
        height: nodeHeight,
        parentId,
      });
      if (item.children.length > 0 && expandedNodeIds.has(item.nodeId)) {
        walk(item.children, depth + 1, item.nodeId);
      }
    }
  }

  if (isRootExpanded) {
    walk(nodes, 1, ROOT_NODE_ID);
  }

  return {
    nodes: positioned,
    width: Math.max(860, 64 + (maxDepth + 1) * NODE_WIDTH + maxDepth * COLUMN_GAP),
    height: Math.max(520, 64 + Math.max(1, row) * (NODE_HEIGHT + ROW_GAP), 64 + Math.max(0, ...positioned.map((node) => node.y + node.height))),
  };
}

function canvasStateKey(carId: string): string {
  return `smsystem:bom-canvas:${carId}:${CANVAS_STATE_VERSION}`;
}

function parsePersistedCanvasState(value: string | null): PersistedCanvasState | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as PersistedCanvasState;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

function SearchableField({
  value,
  options,
  onChange,
  onSelect,
  placeholder,
  disabled = false,
}: SearchableFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const normalizedValue = value.trim().toLowerCase();
  const filteredOptions = options.filter((option) => {
    const searchable = `${option.value} ${option.label ?? ""}`.toLowerCase();
    return !normalizedValue || searchable.includes(normalizedValue);
  });

  function chooseOption(option: SearchOption) {
    onChange(option.value);
    onSelect?.(option);
    setIsOpen(false);
  }

  return (
    <div className="relative">
      <div className="flex h-9 items-center border border-white/10 bg-[#111114] transition-colors focus-within:border-amber-500/40">
        <input
          value={value}
          disabled={disabled}
          onFocus={() => setIsOpen(true)}
          onBlur={() => window.setTimeout(() => setIsOpen(false), 120)}
          onChange={(event) => {
            onChange(event.target.value);
            setIsOpen(true);
          }}
          placeholder={placeholder}
          className="h-full min-w-0 flex-1 bg-transparent px-3 text-[11px] font-mono text-white/70 outline-none placeholder:text-white/20 disabled:cursor-not-allowed disabled:opacity-40"
        />
        <button
          type="button"
          disabled={disabled}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setIsOpen((open) => !open)}
          className="flex h-full w-8 shrink-0 items-center justify-center text-white/25 transition-colors hover:text-white/60 disabled:cursor-not-allowed disabled:opacity-35"
          aria-label="Buka pilihan"
        >
          <ChevronDown className="h-3 w-3" />
        </button>
      </div>

      {isOpen && !disabled ? (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 max-h-44 overflow-auto border border-white/10 bg-[#0d0d10] py-1 shadow-xl shadow-black/40">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => (
              <button
                key={`${option.value}:${option.label ?? ""}`}
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  chooseOption(option);
                }}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-[11px] font-mono text-white/65 transition-colors hover:bg-amber-500/[0.07] hover:text-amber-400"
              >
                <span className="min-w-0 truncate">{option.value}</span>
                {option.label ? (
                  <span className="shrink-0 text-[9px] uppercase tracking-[0.12em] text-white/25">{option.label}</span>
                ) : null}
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-[10px] font-mono text-white/25">
              Tidak ada data cocok. Tekan Simpan untuk memakai teks ini.
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function ProgressBar({ value, tone }: { value: number | null; tone: TriageTone }) {
  const safeValue = Math.max(0, Math.min(100, Number(value ?? 0)));
  const barClass = tone === "replace" ? "bg-rose-400" : tone === "repair" ? "bg-amber-400" : "bg-emerald-400";

  return (
    <div className="mt-3">
      <div className="h-1.5 overflow-hidden bg-white/[0.06]">
        <div className={`h-full transition-[width] ${barClass}`} style={{ width: `${safeValue}%` }} />
      </div>
      <p className="mt-1 text-[10px] tabular-nums text-white/35">{safeValue.toFixed(0)}% selesai</p>
    </div>
  );
}

function NodeCard({
  canvasNode,
  zoom,
  canManage,
  panelRecord,
  isMenuOpen,
  isExpanded,
  isSelected,
  onPositionChange,
  onOpenMenu,
  onToggle,
  onSelect,
  onCreateChild,
  onEdit,
  onDelete,
}: {
  canvasNode: CanvasNode;
  zoom: number;
  canManage: boolean;
  panelRecord: UnitPanelRecord | null;
  isMenuOpen: boolean;
  isExpanded: boolean;
  isSelected: boolean;
  onPositionChange: (nodeId: string, position: NodePosition) => void;
  onOpenMenu: (node: UnitBomNode, event?: MouseEvent) => void;
  onToggle: (node: UnitBomNode) => void;
  onSelect: (node: UnitBomNode) => void;
  onCreateChild: (node: UnitBomNode) => void;
  onEdit: (record: UnitPanelRecord) => void;
  onDelete: (record: UnitPanelRecord) => void;
}) {
  const { node, x, y, width, height } = canvasNode;
  const triage = triageMeta(node);
  const TriageIcon = triage.icon;
  const detailKey = panelDetailKey(node);
  const location = triage.tone === "good" ? "Gudang" : node.divisionName ?? "Belum ditentukan";
  const isGroup = node.nodeType !== "PART";
  const canExpand = node.children.length > 0;
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    nodeX: number;
    nodeY: number;
    didDrag: boolean;
  } | null>(null);
  const suppressClickRef = useRef(false);

  function handleNodePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    if (event.target instanceof Element && event.target.closest("[data-node-actions='true']")) return;
    event.stopPropagation();
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      nodeX: x,
      nodeY: y,
      didDrag: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleNodePointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = (event.clientX - drag.startX) / zoom;
    const dy = (event.clientY - drag.startY) / zoom;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      drag.didDrag = true;
    }
    onPositionChange(node.nodeId, {
      x: Math.max(16, drag.nodeX + dx),
      y: Math.max(16, drag.nodeY + dy),
    });
  }

  function handleNodePointerUp(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    suppressClickRef.current = drag.didDrag;
    dragRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
    if (!drag.didDrag && !(event.target instanceof Element && event.target.closest("[data-node-actions='true']"))) {
      onSelect(node);
      if (isGroup) {
        onToggle(node);
      }
    }
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
  }

  return (
    <div
      data-canvas-node="true"
      className="group absolute"
      style={{ left: x, top: y, width, minHeight: height }}
      onContextMenu={(event) => onOpenMenu(node, event)}
      onPointerDown={handleNodePointerDown}
      onPointerMove={handleNodePointerMove}
      onPointerUp={handleNodePointerUp}
      onPointerCancel={handleNodePointerUp}
    >
      <button
        type="button"
        onClick={() => {
          if (suppressClickRef.current) return;
        }}
        className={`min-h-full w-full border bg-[#111114] p-3 text-left shadow-lg shadow-black/20 transition-[border-color,background-color,transform] hover:-translate-y-0.5 hover:border-amber-500/35 hover:bg-[#151518] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500/70 ${
          isSelected ? "border-amber-500/60" : isGroup ? "border-white/10" : detailKey ? "border-white/10" : "border-white/5"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-2">
              {canExpand ? (
                <span className="flex h-5 w-5 shrink-0 items-center justify-center border border-white/10 text-white/35">
                  {isExpanded ? <ChevronDown className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                </span>
              ) : null}
              <span className={`mt-1.5 h-2 w-2 shrink-0 ${triage.dotClassName}`} />
              <p className="min-w-0 whitespace-normal break-words text-[12px] font-mono leading-4 text-white/85">{node.label}</p>
            </div>
            <p className="mt-1 whitespace-normal break-words text-[10px] leading-3 text-white/35">{hierarchyText(node)}</p>
          </div>
          <span className="shrink-0 border border-white/10 px-1.5 py-0.5 text-[9px] font-mono uppercase text-white/35">
            {isGroup ? node.nodeType : panelRecord?.nodeType ?? "PART"}
          </span>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <span className={`inline-flex items-center gap-1.5 border px-2 py-0.5 text-[9px] font-mono uppercase tracking-[0.1em] ${triage.className}`}>
            <TriageIcon className="h-3 w-3" />
            {triage.label}
          </span>
          {detailKey ? <ArrowUpRight className="h-3.5 w-3.5 text-white/35" /> : null}
        </div>

        {isGroup ? (
          <p className="mt-3 text-[10px] font-mono text-white/28">
            {node.children.length} turunan · {isExpanded ? "terbuka" : "tertutup"}
          </p>
        ) : (
          <>
            <div className="mt-3 flex items-center gap-1.5 text-[10px] text-white/45">
              {triage.tone === "good" ? <PackageCheck className="h-3 w-3 text-emerald-300" /> : <MapPin className="h-3 w-3 text-white/30" />}
              <span className="min-w-0 whitespace-normal break-words leading-3">{location}</span>
            </div>
            <ProgressBar value={node.progressPercent} tone={triage.tone} />
          </>
        )}
      </button>

      {canManage ? (
        <div
          data-node-actions="true"
          className={`absolute -right-2 top-2 z-20 flex flex-col border border-white/10 bg-[#0d0d10] p-1 shadow-xl shadow-black/30 transition-opacity ${
            isMenuOpen ? "opacity-100" : "pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100"
          }`}
        >
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onCreateChild(node);
            }}
            className="flex h-8 w-8 items-center justify-center text-white/45 transition-colors hover:bg-amber-500/[0.08] hover:text-amber-400"
            title="Tambah Part"
            aria-label="Tambah Part"
          >
            <PackagePlus className="h-4 w-4" />
          </button>
          {panelRecord ? (
            <>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onEdit(panelRecord);
                }}
                className="flex h-8 w-8 items-center justify-center text-white/45 transition-colors hover:bg-white/[0.05] hover:text-white"
                title="Edit"
                aria-label="Edit"
              >
                <Edit3 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onDelete(panelRecord);
                }}
                className="flex h-8 w-8 items-center justify-center text-red-300/45 transition-colors hover:bg-red-500/[0.08] hover:text-red-300"
                title="Hapus"
                aria-label="Hapus"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function BomTrackerTab({
  carId,
  unitName,
  bom,
  canManagePhotos,
  canDownloadPhotos,
  canManagePanels = false,
}: BomTrackerTabProps) {
  const router = useRouter();
  const sweetAlert = useSweetAlert();
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const hasLoadedCanvasStateRef = useRef(false);
  const skipNextCanvasSaveRef = useRef(true);
  const panRef = useRef<{ pointerId: number; startX: number; startY: number; left: number; top: number } | null>(null);
  const rootDragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    nodeX: number;
    nodeY: number;
    didDrag: boolean;
  } | null>(null);
  const suppressRootClickRef = useRef(false);
  const [workspace, setWorkspace] = useState<UnitBomWorkspace | null>(bom);
  const [rows, setRows] = useState<UnitPanelRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [zoom, setZoom] = useState(0.92);
  const [mode, setMode] = useState<FormMode>(null);
  const [form, setForm] = useState<PanelFormState>(emptyForm());
  const [menuNodeId, setMenuNodeId] = useState<string | null>(null);
  const [isRootExpanded, setIsRootExpanded] = useState(false);
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(() => new Set());
  const [nodePositions, setNodePositions] = useState<Record<string, NodePosition>>({});
  const [selection, setSelection] = useState<SelectionTarget>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    setWorkspace(bom);
  }, [bom]);

  useEffect(() => {
    hasLoadedCanvasStateRef.current = false;
    skipNextCanvasSaveRef.current = true;
    const saved = parsePersistedCanvasState(window.localStorage.getItem(canvasStateKey(carId)));
    if (saved) {
      if (typeof saved.zoom === "number") {
        setZoom(Math.max(0.55, Math.min(1.35, saved.zoom)));
      } else {
        setZoom(0.92);
      }
      setIsRootExpanded(Boolean(saved.isRootExpanded));
      setExpandedNodeIds(new Set(saved.expandedNodeIds ?? []));
      setNodePositions(saved.nodePositions ?? {});
    } else {
      setZoom(0.92);
      setIsRootExpanded(false);
      setExpandedNodeIds(new Set());
      setNodePositions({});
    }
    hasLoadedCanvasStateRef.current = true;
  }, [carId]);

  useEffect(() => {
    if (!hasLoadedCanvasStateRef.current) return;
    if (skipNextCanvasSaveRef.current) {
      skipNextCanvasSaveRef.current = false;
      return;
    }
    const payload: PersistedCanvasState = {
      zoom,
      isRootExpanded,
      expandedNodeIds: Array.from(expandedNodeIds),
      nodePositions,
    };
    window.localStorage.setItem(canvasStateKey(carId), JSON.stringify(payload));
  }, [carId, expandedNodeIds, isRootExpanded, nodePositions, zoom]);

  const loadPanels = useCallback(async () => {
    const result = await fetchUnitPanels("", carId);
    if (!result.payload) {
      setRows([]);
      return false;
    }

    setRows(result.payload.data.tree);
    return true;
  }, [carId]);

  const refreshWorkspace = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const [bomResult, panelsOk] = await Promise.all([
      fetchUnitBom("", carId),
      loadPanels(),
    ]);

    if (bomResult.payload) {
      setWorkspace(bomResult.payload.data);
    } else {
      setError("Data BOM belum bisa dimuat ulang.");
    }

    if (!panelsOk) {
      setError((current) => current ?? "Master panel unit belum bisa dimuat.");
    }

    setIsLoading(false);
  }, [carId, loadPanels]);

  useEffect(() => {
    void loadPanels();
  }, [loadPanels]);

  const flatPanelRecords = useMemo(() => flattenPanelRecords(rows), [rows]);
  const recordsById = useMemo(() => {
    const map = new Map<number, UnitPanelRecord>();
    for (const record of flatPanelRecords) {
      map.set(record.id, record);
    }
    return map;
  }, [flatPanelRecords]);
  const layout = useMemo(
    () => buildCanvasLayout(workspace?.tree ?? [], expandedNodeIds, isRootExpanded),
    [expandedNodeIds, isRootExpanded, workspace],
  );
  const rootPosition = nodePositions[ROOT_NODE_ID] ?? { x: 32, y: 32 };
  const positionedNodes = useMemo(
    () =>
      layout.nodes.map((item) => ({
        ...item,
        ...(nodePositions[item.node.nodeId] ?? { x: item.x, y: item.y }),
      })),
    [layout.nodes, nodePositions],
  );
  const nodeById = useMemo(() => new Map(positionedNodes.map((item) => [item.node.nodeId, item])), [positionedNodes]);
  const canvasBounds = useMemo(() => {
    const allPositions = [
      { x: rootPosition.x, y: rootPosition.y, width: NODE_WIDTH, height: NODE_HEIGHT },
      ...positionedNodes,
    ];
    return allPositions.reduce(
      (bounds, item) => ({
        width: Math.max(bounds.width, item.x + item.width + 96),
        height: Math.max(bounds.height, item.y + item.height + 96),
      }),
      { width: layout.width, height: layout.height },
    );
  }, [layout.height, layout.width, positionedNodes, rootPosition.x, rootPosition.y]);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    for (const row of rows) {
      cats.add(displayCategory(row.category));
    }
    if (workspace) {
      for (const node of positionedNodes) {
        cats.add(displayCategory(node.node.category));
      }
    }
    return Array.from(cats).sort();
  }, [positionedNodes, rows, workspace]);

  const rowsInSelectedCategory = useMemo(() => {
    return rows.filter((row) => displayCategory(row.category) === form.category);
  }, [rows, form.category]);

  const formSections = useMemo(() => {
    const sections = new Set(rowsInSelectedCategory.map((row) => row.section));
    if (form.section) sections.add(form.section);
    return Array.from(sections).sort();
  }, [rowsInSelectedCategory, form.section]);

  const panelsBySelectedSection = useMemo(() => {
    return rows.filter((row) => displayCategory(row.category) === form.category && row.section === form.section);
  }, [rows, form.category, form.section]);

  const selectedParentPanel = useMemo(() => {
    if (!form.parentId) return null;
    return flatPanelRecords.find((row) => String(row.id) === form.parentId) ?? null;
  }, [flatPanelRecords, form.parentId]);

  const categoryOptions = useMemo<SearchOption[]>(
    () => categories.map((category) => ({ value: category })),
    [categories],
  );
  const sectionOptions = useMemo<SearchOption[]>(
    () => formSections.map((section) => ({ value: section })),
    [formSections],
  );
  const parentPanelOptions = useMemo<SearchOption[]>(
    () => panelsBySelectedSection.map((panel) => ({ value: panel.name, label: panel.category ?? panel.section })),
    [panelsBySelectedSection],
  );

  const totalPanelRecords = rows.length;
  const totalPartRecords = useMemo(() => rows.reduce((total, row) => total + row.children.length, 0), [rows]);

  useEffect(() => {
    if (error) {
      sweetAlert.notifyError("Aksi belum berhasil", error);
    }
  }, [error]);

  useEffect(() => {
    if (message) {
      sweetAlert.notifySuccess("Berhasil", message);
    }
  }, [message]);

  function getNextSortOrder(parentId: number | null, section: string) {
    if (parentId !== null) {
      const parent = rows.find((row) => row.id === parentId);
      if (!parent) return 0;
      return parent.children.reduce((max, child) => Math.max(max, child.sortOrder), -1) + 1;
    }

    return rows
      .filter((row) => row.section === section)
      .reduce((max, row) => Math.max(max, row.sortOrder), -1) + 1;
  }

  async function getPanelRecordsForMutation(): Promise<UnitPanelRecord[] | null> {
    if (flatPanelRecords.length > 0) {
      return flatPanelRecords;
    }

    const result = await fetchUnitPanels("", carId);
    if (!result.payload) {
      setError("Master panel unit belum bisa dimuat untuk disimpan.");
      return null;
    }

    setRows(result.payload.data.tree);
    return flattenPanelRecords(result.payload.data.tree);
  }

  const openCreateRoot = useCallback(() => {
    setMode({ type: "create", sectionMode: rows.length > 0 ? "existing" : "new" });
    setForm(emptyForm());
    setMessage(null);
    setError(null);
  }, [rows.length]);

  function openCreateCategory() {
    setMode({ type: "create", sectionMode: "new" });
    setForm({ ...emptyForm(), nodeType: "PANEL", nodeTypeName: "Panel" });
    setSelection({ type: "unit" });
    setMessage(null);
    setError(null);
  }

  function openCreateSectionFromCategory(category: string) {
    setMode({ type: "create", sectionMode: "new" });
    setForm({ ...emptyForm(), category, nodeType: "PANEL", nodeTypeName: "Panel" });
    setMessage(null);
    setError(null);
  }

  function openCreatePanelFromSection(node: UnitBomNode) {
    setMode({ type: "create", sectionMode: "existing", sourceNode: node });
    setForm({
      ...emptyForm(),
      category: node.category ?? "",
      section: node.section ?? "",
      nodeType: "PANEL",
      nodeTypeName: "Panel",
    });
    setMessage(null);
    setError(null);
  }

  function openEditCategory(category: string) {
    setMode({ type: "edit-category", category });
    setForm({ ...emptyForm(), category });
    setMessage(null);
    setError(null);
  }

  async function handleDeleteCategory(category: string) {
    if (!canManagePanels) return;

    const panelRecords = await getPanelRecordsForMutation();
    if (!panelRecords) {
      return;
    }

    const targets = panelRecords
      .filter((record) => recordMatchesCategory(record, category))
      .sort((left, right) => {
        if (left.parentId === null && right.parentId !== null) return 1;
        if (left.parentId !== null && right.parentId === null) return -1;
        return 0;
      });

    if (targets.length === 0) {
      setError("Kategori tidak memiliki panel atau part yang bisa dihapus.");
      return;
    }

    const confirmed = window.confirm(
      `Hapus kategori "${category}" beserta ${targets.length} panel/part di dalamnya?`,
    );
    if (!confirmed) return;

    setIsSubmitting(true);
    setError(null);
    setMessage(null);

    for (const record of targets) {
      const result = await deleteUnitPanel(carId, record.id);
      if (!result.success) {
        setError(result.message);
        setIsSubmitting(false);
        return;
      }
    }

    setMessage(`Kategori "${category}" berhasil dihapus.`);
    closeForm();
    setSelection({ type: "unit" });
    await refreshWorkspace();
    setIsSubmitting(false);
  }

  function openEditSection(category: string, section: string) {
    setMode({ type: "edit-section", category, section });
    setForm({ ...emptyForm(), category, section });
    setMessage(null);
    setError(null);
  }

  function openCreateFromNode(node: UnitBomNode) {
    const parentRecord = node.panelId ? recordsById.get(node.panelId) ?? null : null;
    setMode({ type: "create", sectionMode: "existing", sourceNode: node });
    setForm(parentRecord ? formForChild(parentRecord) : formForNode(node));
    setMenuNodeId(null);
    setMessage(null);
    setError(null);
  }

  function openEdit(record: UnitPanelRecord) {
    setMode({ type: "edit", record });
    setForm(formFromRecord(record));
    setMenuNodeId(null);
    setMessage(null);
    setError(null);
  }

  function closeForm() {
    setMode(null);
    setForm(emptyForm());
  }

  function selectNodeType(value: string) {
    const normalized = value.trim().toLowerCase();
    if (normalized !== "panel" && normalized !== "part") {
      setForm((current) => ({ ...current, nodeTypeName: value }));
      return;
    }

    const nextType = normalized === "part" ? "PART" : "PANEL";
    if (nextType === "PANEL") {
      setForm((current) => ({ ...current, nodeType: "PANEL", nodeTypeName: value, parentId: "", parentName: "" }));
      return;
    }

    setForm((current) => ({
      ...current,
      nodeType: "PART",
      nodeTypeName: value,
      parentId: "",
      parentName: "",
    }));
  }

  function selectCategory(value: string) {
    setForm((current) => ({
      ...current,
      category: value,
      section: "",
      parentId: "",
      parentName: "",
    }));
  }

  function selectSection(value: string) {
    setForm((current) => ({
      ...current,
      section: value,
      parentId: "",
      parentName: "",
    }));
  }

  function selectParentPanel(value: string) {
    const normalized = value.trim().toLowerCase();
    const panel = panelsBySelectedSection.find((row) => row.name.toLowerCase() === normalized);
    setForm((current) => ({
      ...current,
      parentId: panel ? String(panel.id) : "",
      parentName: value,
      section: panel?.section ?? current.section,
      category: panel?.category ?? current.category,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManagePanels || !mode) {
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setMessage(null);

    if (mode.type === "edit-category") {
      const nextCategory = form.category.trim();
      if (!nextCategory) {
        setError("Nama kategori wajib diisi.");
        setIsSubmitting(false);
        return;
      }

      const result = await renameUnitPanelCategory(carId, {
        fromCategory: mode.category,
        toCategory: nextCategory,
      });
      if (!result.success) {
        setError(result.message);
        setIsSubmitting(false);
        return;
      }

      setMessage(`Nama kategori berhasil diperbarui untuk ${result.result.updatedCount} panel/part.`);
      closeForm();
      await refreshWorkspace();
      setIsSubmitting(false);
      return;
    }

    if (mode.type === "edit-section") {
      const nextSection = form.section.trim();
      if (!nextSection) {
        setError("Nama section wajib diisi.");
        setIsSubmitting(false);
        return;
      }

      const panelRecords = await getPanelRecordsForMutation();
      if (!panelRecords) {
        setIsSubmitting(false);
        return;
      }

      const targets = panelRecords.filter(
        (record) => recordMatchesCategory(record, mode.category) && record.section === mode.section,
      );
      if (targets.length === 0) {
        setError(`Tidak ada panel atau part pada section "${mode.section}" yang bisa diperbarui.`);
        setIsSubmitting(false);
        return;
      }

      const results = await Promise.all(
        targets.map((record) =>
          updateUnitPanel(carId, record.id, {
            ...buildPayload(formFromRecord(record)),
            section: nextSection,
          }),
        ),
      );
      const failed = results.find((result) => !result.success);
      if (failed) {
        setError(failed.message);
        setIsSubmitting(false);
        return;
      }

      setMessage("Nama section berhasil diperbarui.");
      closeForm();
      await refreshWorkspace();
      setIsSubmitting(false);
      return;
    }

    const parsedParentId = Number.parseInt(form.parentId, 10);
    const parentId =
      mode.type === "edit"
        ? mode.record.parentId
        : form.nodeType === "PART"
          ? Number.isFinite(parsedParentId)
            ? parsedParentId
            : null
          : null;

    const effectiveForm =
      mode.type === "create" && mode.sectionMode === "new"
        ? { ...form, nodeType: "PANEL" as const }
        : form;

    const payload = {
      ...buildPayload(effectiveForm),
      sortOrder:
        mode.type === "edit"
          ? mode.record.sortOrder
          : getNextSortOrder(parentId, form.section.trim()),
    };

    if (!payload.section || !payload.name) {
      setError("Section dan nama wajib diisi.");
      setIsSubmitting(false);
      return;
    }

    if (
      mode.type === "create" &&
      mode.sectionMode === "existing" &&
      !["panel", "part"].includes(form.nodeTypeName.trim().toLowerCase())
    ) {
      setError("Pilih tipe yang valid: Panel atau Part.");
      setIsSubmitting(false);
      return;
    }

    if (mode.type !== "edit" && effectiveForm.nodeType === "PART" && !parentId) {
      setError("Pilih panel parent untuk part.");
      setIsSubmitting(false);
      return;
    }

    const result =
      mode.type === "edit"
        ? await updateUnitPanel(carId, mode.record.id, payload)
        : await createUnitPanel(carId, {
            parentId,
            ...payload,
          });

    if (!result.success) {
      setError(result.message);
      setIsSubmitting(false);
      return;
    }

    setMessage(
      mode.type === "edit"
        ? "Master panel berhasil diperbarui."
        : effectiveForm.nodeType === "PART"
          ? "Part berhasil ditambahkan."
          : "Panel berhasil ditambahkan.",
    );
    closeForm();
    await refreshWorkspace();
    setIsSubmitting(false);
  }

  async function handleDelete(record: UnitPanelRecord) {
    if (!canManagePanels) return;
    const confirmed = window.confirm(`Hapus ${record.nodeType === "PANEL" ? "panel" : "part"} "${record.name}"?`);
    if (!confirmed) return;

    setIsSubmitting(true);
    setError(null);
    setMessage(null);

    const result = await deleteUnitPanel(carId, record.id);
    if (!result.success) {
      setError(result.message);
      setIsSubmitting(false);
      return;
    }

    setMessage(`${record.nodeType === "PANEL" ? "Panel" : "Part"} berhasil dihapus.`);
    await refreshWorkspace();
    setIsSubmitting(false);
  }

  function openMenu(node: UnitBomNode, event?: MouseEvent) {
    event?.preventDefault();
    event?.stopPropagation();
    setMenuNodeId((current) => (current === node.nodeId ? null : node.nodeId));
  }

  function toggleNode(node: UnitBomNode) {
    if (node.children.length === 0) return;
    setExpandedNodeIds((current) => {
      const next = new Set(current);
      if (next.has(node.nodeId)) {
        next.delete(node.nodeId);
      } else {
        next.add(node.nodeId);
      }
      return next;
    });
  }

  function updateNodePosition(nodeId: string, position: NodePosition) {
    setNodePositions((current) => ({
      ...current,
      [nodeId]: position,
    }));
  }

  function resetCanvasLayout() {
    setZoom(0.92);
    setIsRootExpanded(false);
    setExpandedNodeIds(new Set());
    setNodePositions({});
    setSelection(null);
    window.localStorage.removeItem(canvasStateKey(carId));
  }

  function handleRootPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.stopPropagation();
    rootDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      nodeX: rootPosition.x,
      nodeY: rootPosition.y,
      didDrag: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleRootPointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = rootDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = (event.clientX - drag.startX) / zoom;
    const dy = (event.clientY - drag.startY) / zoom;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      drag.didDrag = true;
    }
    updateNodePosition(ROOT_NODE_ID, {
      x: Math.max(16, drag.nodeX + dx),
      y: Math.max(16, drag.nodeY + dy),
    });
  }

  function handleRootPointerUp(event: PointerEvent<HTMLDivElement>) {
    const drag = rootDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    suppressRootClickRef.current = drag.didDrag;
    rootDragRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
    if (!drag.didDrag) {
      setSelection({ type: "unit" });
      setIsRootExpanded((value) => !value);
    }
    window.setTimeout(() => {
      suppressRootClickRef.current = false;
    }, 0);
  }

  function navigateToDetail(node: UnitBomNode) {
    const detailKey = panelDetailKey(node);
    if (!detailKey) {
      setMenuNodeId(node.nodeId);
      return;
    }
    router.push(`/units/${carId}/panels/${detailKey}`);
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    if (
      event.target instanceof Element &&
      event.target.closest("[data-canvas-node='true'], [data-canvas-control='true']")
    ) {
      return;
    }
    panRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      left: event.currentTarget.scrollLeft,
      top: event.currentTarget.scrollTop,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const pan = panRef.current;
    if (!pan || pan.pointerId !== event.pointerId || !viewportRef.current) return;
    viewportRef.current.scrollLeft = pan.left - (event.clientX - pan.startX);
    viewportRef.current.scrollTop = pan.top - (event.clientY - pan.startY);
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    const pan = panRef.current;
    if (!pan || pan.pointerId !== event.pointerId) return;
    panRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  const parentPanelValue = selectedParentPanel?.name ?? form.parentName;
  const rootLabel = unitName?.trim() || workspace?.unitId || carId;
  const selectedNode = selection?.type === "node" ? selection.node : null;
  const selectedRecord = selectedNode?.panelId ? recordsById.get(selectedNode.panelId) ?? null : null;
  const selectedDetailKey = selectedNode ? panelDetailKey(selectedNode) : null;
  const isSidePanelOpen = mode !== null || selection !== null;
  const canvasHeightClass = isFullscreen ? "h-screen min-h-screen" : "h-[calc(100vh-180px)] min-h-[720px]";
  const sidePanelHeightClass = isFullscreen ? "max-h-screen min-h-screen" : "max-h-[calc(100vh-180px)] min-h-[720px]";
  const drawerTitle =
    mode === null
      ? "Master Panel"
      : mode.type === "edit-category"
        ? "Edit Kategori"
        : mode.type === "edit-section"
          ? "Edit Section"
          : mode.type === "edit"
        ? `Edit ${mode.record.nodeType === "PANEL" ? "Panel" : "Part"}`
        : mode.sectionMode === "new"
          ? "Tambah Panel + Kategori / Section"
          : form.nodeType === "PART"
            ? "Tambah Part"
            : "Tambah Panel";
  const sidePanelTitle = mode ? drawerTitle : "Aksi Cepat";

  if (!workspace) {
    return (
      <section className="border border-white/5 bg-[#111114] px-4 py-3">
        <p className="text-[11px] uppercase tracking-[0.2em] text-amber-500/70">Katalog Part</p>
        <h2 className="mt-3 text-xl font-light text-white">Data BOM belum bisa dimuat</h2>
      </section>
    );
  }

  return (
      <section className={`overflow-hidden border border-white/5 bg-[#111114] ${isFullscreen ? "fixed inset-0 z-50" : ""}`}>
        {message ? (
          <div className="border-b border-emerald-500/20 bg-emerald-500/[0.04] px-4 py-2 text-[11px] font-mono text-emerald-400">
            {message}
          </div>
        ) : null}
        {error ? (
          <div className="border-b border-red-500/20 bg-red-500/[0.04] px-4 py-2 text-[11px] font-mono text-red-400">
            {error}
          </div>
        ) : null}

        <div className={`grid ${isFullscreen ? "min-h-screen" : "min-h-[calc(100vh-180px)]"} ${isSidePanelOpen ? "xl:grid-cols-[minmax(0,1fr)_360px]" : "xl:grid-cols-1"}`}>
          <div className="relative min-w-0 border-r border-white/5 bg-[#0a0a0c]">
            <div data-canvas-control="true" className="absolute left-4 top-4 z-30 flex items-center gap-1 border border-white/10 bg-[#111114]/95 p-1 shadow-lg shadow-black/20 backdrop-blur">
              <button
                type="button"
                onClick={() => setZoom((value) => Math.max(0.55, Number((value - 0.1).toFixed(2))))}
                className="flex h-8 w-8 items-center justify-center text-white/45 transition-colors hover:bg-white/[0.05] hover:text-white"
                aria-label="Zoom out"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <span className="w-12 text-center text-[10px] font-mono text-white/35">{Math.round(zoom * 100)}%</span>
              <button
                type="button"
                onClick={() => setZoom((value) => Math.min(1.35, Number((value + 0.1).toFixed(2))))}
                className="flex h-8 w-8 items-center justify-center text-white/45 transition-colors hover:bg-white/[0.05] hover:text-white"
                aria-label="Zoom in"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={resetCanvasLayout}
                className="border-l border-white/10 px-2.5 text-[10px] font-mono uppercase tracking-[0.08em] text-white/35 transition-colors hover:bg-white/[0.05] hover:text-white"
                aria-label="Reset layout canvas"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => setIsFullscreen((value) => !value)}
                className="border-l border-white/10 px-2.5 text-[10px] font-mono uppercase tracking-[0.08em] text-white/35 transition-colors hover:bg-white/[0.05] hover:text-white"
                aria-label={isFullscreen ? "Keluar fullscreen" : "Masuk fullscreen"}
              >
                {isFullscreen ? "Exit" : "Full"}
              </button>
            </div>

            <div data-canvas-control="true" className="absolute right-4 top-4 z-30 flex flex-wrap items-center justify-end gap-2">
              <span className="hidden border border-white/10 bg-[#111114]/95 px-2.5 py-2 text-[10px] font-mono text-white/35 backdrop-blur md:inline-flex">
                {workspace.summary.totalParts} komponen / {totalPanelRecords} panel / {totalPartRecords} part
              </span>
              <button
                type="button"
                onClick={() => void refreshWorkspace()}
                className="inline-flex h-9 items-center gap-1.5 border border-white/10 bg-[#111114]/95 px-3 text-[10px] font-mono uppercase tracking-[0.12em] text-white/45 backdrop-blur transition-colors hover:border-white/30 hover:text-white disabled:opacity-30"
                disabled={isLoading}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>

            <div className="absolute bottom-4 left-4 z-30 hidden items-center gap-2 border border-white/10 bg-[#111114]/95 px-3 py-2 text-[10px] font-mono text-white/35 backdrop-blur md:flex">
              <Grip className="h-3.5 w-3.5 text-white/30" />
              Drag node untuk pindah posisi. Drag area kosong untuk pan.
            </div>

            <div className="hidden">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-mono uppercase tracking-[0.12em] text-white/30">Aksi Cepat</p>
                  <h3 className="mt-1 truncate text-[13px] font-mono text-white/80">
                    {selection?.type === "unit" ? rootLabel : selectedNode?.label ?? "Pilih node dulu"}
                  </h3>
                  <p className="mt-1 text-[11px] text-white/35">
                    {selection?.type === "unit"
                      ? "Kelola kategori dari unit ini."
                      : selectedNode?.nodeType === "CATEGORY"
                        ? "Kelola kategori dan section di bawahnya."
                        : selectedNode?.nodeType === "SECTION"
                          ? "Kelola section dan panel di bawahnya."
                          : selectedRecord?.nodeType === "PANEL"
                            ? "Kelola panel, part, dan detail workflow."
                            : selectedRecord?.nodeType === "PART"
                              ? "Kelola part dan buka detail workflow."
                              : "Klik unit, kategori, section, panel, atau part."}
                  </p>
                </div>
                {selection ? (
                  <button
                    type="button"
                    onClick={() => setSelection(null)}
                    className="flex h-7 w-7 shrink-0 items-center justify-center text-white/30 transition-colors hover:bg-white/[0.05] hover:text-white"
                    aria-label="Tutup aksi cepat"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>

              <div className="mt-3 grid gap-2">
                {!selection ? (
                  <button
                    type="button"
                    onClick={() => setSelection({ type: "unit" })}
                    className="border border-amber-500/30 bg-amber-500/[0.06] px-3 py-2 text-left text-[11px] font-mono text-amber-500 transition-colors hover:bg-amber-500/10"
                  >
                    Mulai dari unit
                  </button>
                ) : null}

                {selection?.type === "unit" ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setIsRootExpanded((value) => !value)}
                      className="border border-white/10 px-3 py-2 text-left text-[11px] font-mono text-white/60 transition-colors hover:border-white/30 hover:text-white"
                    >
                      {isRootExpanded ? "Tutup cabang kategori" : "Buka cabang kategori"}
                    </button>
                    {canManagePanels ? (
                      <button
                        type="button"
                        onClick={openCreateCategory}
                        className="border border-amber-500/30 bg-amber-500/[0.06] px-3 py-2 text-left text-[11px] font-mono text-amber-500 transition-colors hover:bg-amber-500/10"
                      >
                        Tambah panel kategori baru
                      </button>
                    ) : null}
                  </>
                ) : null}

                {selectedNode?.nodeType === "CATEGORY" ? (
                  <>
                    <button
                      type="button"
                      onClick={() => toggleNode(selectedNode)}
                      className="border border-white/10 px-3 py-2 text-left text-[11px] font-mono text-white/60 transition-colors hover:border-white/30 hover:text-white"
                    >
                      {expandedNodeIds.has(selectedNode.nodeId) ? "Tutup section" : "Buka section"}
                    </button>
                    {canManagePanels && selectedNode.category ? (
                      <>
                        <button
                          type="button"
                          onClick={() => openEditCategory(selectedNode.category ?? "")}
                          className="border border-white/10 px-3 py-2 text-left text-[11px] font-mono text-white/60 transition-colors hover:border-white/30 hover:text-white"
                        >
                          Edit nama kategori
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteCategory(displayCategory(selectedNode.category))}
                          className="border border-red-500/25 px-3 py-2 text-left text-[11px] font-mono text-red-400/70 transition-colors hover:border-red-500/50 hover:text-red-300"
                        >
                          Hapus kategori
                        </button>
                        <button
                          type="button"
                          onClick={() => openCreateSectionFromCategory(selectedNode.category ?? "")}
                          className="border border-amber-500/30 bg-amber-500/[0.06] px-3 py-2 text-left text-[11px] font-mono text-amber-500 transition-colors hover:bg-amber-500/10"
                        >
                          Tambah panel section baru
                        </button>
                      </>
                    ) : null}
                  </>
                ) : null}

                {selectedNode?.nodeType === "SECTION" ? (
                  <>
                    <button
                      type="button"
                      onClick={() => toggleNode(selectedNode)}
                      className="border border-white/10 px-3 py-2 text-left text-[11px] font-mono text-white/60 transition-colors hover:border-white/30 hover:text-white"
                    >
                      {expandedNodeIds.has(selectedNode.nodeId) ? "Tutup panel" : "Buka panel"}
                    </button>
                    {canManagePanels && selectedNode.category && selectedNode.section ? (
                      <>
                        <button
                          type="button"
                          onClick={() => openEditSection(selectedNode.category ?? "", selectedNode.section ?? "")}
                          className="border border-white/10 px-3 py-2 text-left text-[11px] font-mono text-white/60 transition-colors hover:border-white/30 hover:text-white"
                        >
                          Edit nama section
                        </button>
                        <button
                          type="button"
                          onClick={() => openCreatePanelFromSection(selectedNode)}
                          className="border border-amber-500/30 bg-amber-500/[0.06] px-3 py-2 text-left text-[11px] font-mono text-amber-500 transition-colors hover:bg-amber-500/10"
                        >
                          Tambah panel di section ini
                        </button>
                      </>
                    ) : null}
                  </>
                ) : null}

                {selectedRecord ? (
                  <>
                    {selectedRecord.nodeType === "PANEL" && canManagePanels ? (
                      <button
                        type="button"
                        onClick={() => openCreateFromNode(selectedNode as UnitBomNode)}
                        className="border border-amber-500/30 bg-amber-500/[0.06] px-3 py-2 text-left text-[11px] font-mono text-amber-500 transition-colors hover:bg-amber-500/10"
                      >
                        Tambah part di panel ini
                      </button>
                    ) : null}
                    {selectedDetailKey ? (
                      <button
                        type="button"
                        onClick={() => selectedNode ? navigateToDetail(selectedNode) : undefined}
                        className="border border-white/10 px-3 py-2 text-left text-[11px] font-mono text-white/70 transition-colors hover:border-white/30 hover:text-white"
                      >
                        Buka detail workflow
                      </button>
                    ) : null}
                    {canManagePanels ? (
                      <>
                        <button
                          type="button"
                          onClick={() => openEdit(selectedRecord)}
                          className="border border-white/10 px-3 py-2 text-left text-[11px] font-mono text-white/60 transition-colors hover:border-white/30 hover:text-white"
                        >
                          Edit {selectedRecord.nodeType === "PANEL" ? "panel" : "part"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(selectedRecord)}
                          className="border border-red-500/25 px-3 py-2 text-left text-[11px] font-mono text-red-300/70 transition-colors hover:border-red-500/45 hover:text-red-300"
                        >
                          Hapus {selectedRecord.nodeType === "PANEL" ? "panel" : "part"}
                        </button>
                      </>
                    ) : null}
                  </>
                ) : null}
              </div>
            </div>

            {workspace.tree.length === 0 ? (
              <div className={`flex ${isFullscreen ? "min-h-screen" : "min-h-[calc(100vh-180px)]"} items-center justify-center px-6`}>
                <div className="max-w-sm border border-dashed border-white/10 bg-[#111114] px-6 py-8 text-center">
                  <Boxes className="mx-auto h-8 w-8 text-amber-500/70" />
                  <h3 className="mt-4 text-[15px] font-mono text-white/80">Belum ada master panel</h3>
                  <p className="mt-2 text-[11px] text-white/35">Mulai dari satu kategori dan panel utama agar BOM unit bisa divisualkan.</p>
                  {canManagePanels ? (
                    <button
                      type="button"
                      onClick={openCreateRoot}
                      className="mt-5 inline-flex items-center gap-2 border border-amber-500/30 bg-amber-500/[0.06] px-4 py-2 text-[10px] font-mono uppercase tracking-[0.12em] text-amber-500 transition-colors hover:bg-amber-500/10"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Buat Master Panel Pertama
                    </button>
                  ) : null}
                </div>
              </div>
            ) : (
              <div
                ref={viewportRef}
                className={`${canvasHeightClass} cursor-grab overflow-auto active:cursor-grabbing`}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onClick={() => setMenuNodeId(null)}
              >
                <div
                  className="relative origin-top-left"
                  style={{
                    width: canvasBounds.width,
                    height: canvasBounds.height,
                    transform: `scale(${zoom})`,
                    transformOrigin: "0 0",
                  }}
                >
                  <svg className="absolute inset-0 h-full w-full" width={canvasBounds.width} height={canvasBounds.height} aria-hidden="true">
                    {positionedNodes.map((item) => {
                      if (!item.parentId) return null;
                      const parent =
                        item.parentId === ROOT_NODE_ID
                          ? { x: rootPosition.x, y: rootPosition.y, width: NODE_WIDTH, height: NODE_HEIGHT }
                          : nodeById.get(item.parentId);
                      if (!parent) return null;
                      const startX = parent.x + parent.width;
                      const startY = parent.y + parent.height / 2;
                      const endX = item.x;
                      const endY = item.y + item.height / 2;
                      const midX = startX + (endX - startX) / 2;
                      return (
                        <path
                          key={`${item.parentId}:${item.node.nodeId}`}
                          d={`M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`}
                          fill="none"
                          stroke="rgba(255,255,255,0.12)"
                          strokeWidth="1"
                        />
                      );
                    })}
                  </svg>

                  <div
                    data-canvas-node="true"
                    className="absolute"
                    style={{ left: rootPosition.x, top: rootPosition.y, width: NODE_WIDTH, height: NODE_HEIGHT }}
                    onPointerDown={handleRootPointerDown}
                    onPointerMove={handleRootPointerMove}
                    onPointerUp={handleRootPointerUp}
                    onPointerCancel={handleRootPointerUp}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (suppressRootClickRef.current) return;
                      }}
                      className={`h-full w-full border bg-[#15120b] p-3 text-left shadow-lg shadow-black/25 transition-[border-color,background-color,transform] hover:-translate-y-0.5 hover:border-amber-500/50 hover:bg-[#18140c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500/70 ${
                        selection?.type === "unit" ? "border-amber-500/70" : "border-amber-500/25"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center border border-amber-500/25 text-amber-400">
                              {isRootExpanded ? <ChevronDown className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                            </span>
                            <span className="h-2 w-2 shrink-0 bg-amber-400 shadow-[0_0_16px_rgba(245,158,11,0.45)]" />
                            <p className="truncate text-[12px] font-mono text-white/90">{rootLabel}</p>
                          </div>
                          <p className="mt-1 truncate text-[10px] text-white/38">Root unit workspace</p>
                        </div>
                        <span className="shrink-0 border border-amber-500/25 px-1.5 py-0.5 text-[9px] font-mono uppercase text-amber-400">
                          UNIT
                        </span>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 border border-amber-500/25 bg-amber-500/[0.07] px-2 py-0.5 text-[9px] font-mono uppercase tracking-[0.1em] text-amber-400">
                          <GitBranch className="h-3 w-3" />
                          {workspace.tree.length} kategori
                        </span>
                      </div>
                      <p className="mt-3 text-[10px] font-mono text-white/30">
                        {isRootExpanded ? "Klik kategori untuk buka section" : "Klik untuk buka tree"}
                      </p>
                    </button>
                  </div>

                  {positionedNodes.map((item) => (
                    <NodeCard
                      key={item.node.nodeId}
                      canvasNode={item}
                      zoom={zoom}
                      canManage={false}
                      panelRecord={item.node.panelId ? recordsById.get(item.node.panelId) ?? null : null}
                      isMenuOpen={menuNodeId === item.node.nodeId}
                      isExpanded={expandedNodeIds.has(item.node.nodeId)}
                      isSelected={selection?.type === "node" && selection.node.nodeId === item.node.nodeId}
                      onPositionChange={updateNodePosition}
                      onOpenMenu={openMenu}
                      onToggle={toggleNode}
                      onSelect={(node) => setSelection({ type: "node", node })}
                      onCreateChild={openCreateFromNode}
                      onEdit={openEdit}
                      onDelete={(record) => void handleDelete(record)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {isSidePanelOpen ? (
          <aside className="bg-[#0d0d10]">
            <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
              <div className="flex items-center gap-2">
                <Boxes className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-white/35">{sidePanelTitle}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (mode) closeForm();
                  else setSelection(null);
                }}
                className="flex h-8 w-8 items-center justify-center text-white/35 transition-colors hover:bg-white/[0.04] hover:text-white"
                aria-label="Tutup panel"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className={`${sidePanelHeightClass} overflow-auto px-4 py-4`}>
              {!canManagePanels ? (
                <div className="border border-white/5 bg-[#111114] px-4 py-4 text-[11px] font-mono text-white/30">
                  Akses master panel hanya baca. Node tetap bisa dibuka untuk workflow detail.
                </div>
              ) : mode === null ? (
                <div className="space-y-3">
                  <div className="border border-white/5 bg-[#111114] px-3 py-3">
                    <p className="text-[10px] font-mono uppercase tracking-[0.12em] text-white/30">Dipilih</p>
                    <h3 className="mt-1 truncate text-[13px] font-mono text-white/80">
                      {selection?.type === "unit" ? rootLabel : selectedNode?.label ?? "-"}
                    </h3>
                    <p className="mt-1 text-[11px] text-white/35">
                      {selection?.type === "unit"
                        ? "Kelola kategori dari unit ini."
                        : selectedNode?.nodeType === "CATEGORY"
                          ? "Kelola kategori dan section di bawahnya."
                          : selectedNode?.nodeType === "SECTION"
                            ? "Kelola section dan panel di bawahnya."
                            : selectedRecord?.nodeType === "PANEL"
                              ? "Kelola panel, part, dan detail workflow."
                              : selectedRecord?.nodeType === "PART"
                                ? "Kelola part dan buka detail workflow."
                                : "Pilih node di canvas."}
                    </p>
                  </div>

                  {selection?.type === "unit" ? (
                    <>
                      <button type="button" onClick={() => setIsRootExpanded((value) => !value)}
                        className="w-full border border-white/10 px-3 py-2 text-left text-[11px] font-mono text-white/60 transition-colors hover:border-white/30 hover:text-white">
                        {isRootExpanded ? "Tutup cabang kategori" : "Buka cabang kategori"}
                      </button>
                      {canManagePanels ? (
                        <button type="button" onClick={openCreateCategory}
                          className="w-full border border-amber-500/30 bg-amber-500/[0.06] px-3 py-2 text-left text-[11px] font-mono text-amber-500 transition-colors hover:bg-amber-500/10">
                          Tambah panel kategori baru
                        </button>
                      ) : null}
                    </>
                  ) : null}

                  {selectedNode?.nodeType === "CATEGORY" ? (
                    <>
                      <button type="button" onClick={() => toggleNode(selectedNode)}
                        className="w-full border border-white/10 px-3 py-2 text-left text-[11px] font-mono text-white/60 transition-colors hover:border-white/30 hover:text-white">
                        {expandedNodeIds.has(selectedNode.nodeId) ? "Tutup section" : "Buka section"}
                      </button>
                      {canManagePanels && selectedNode.category ? (
                        <>
                          <button type="button" onClick={() => openEditCategory(selectedNode.category ?? "")}
                            className="w-full border border-white/10 px-3 py-2 text-left text-[11px] font-mono text-white/60 transition-colors hover:border-white/30 hover:text-white">
                            Edit nama kategori
                          </button>
                          <button type="button" onClick={() => void handleDeleteCategory(displayCategory(selectedNode.category))}
                            className="w-full border border-red-500/25 px-3 py-2 text-left text-[11px] font-mono text-red-400/70 transition-colors hover:border-red-500/50 hover:text-red-300">
                            Hapus kategori
                          </button>
                          <button type="button" onClick={() => openCreateSectionFromCategory(selectedNode.category ?? "")}
                            className="w-full border border-amber-500/30 bg-amber-500/[0.06] px-3 py-2 text-left text-[11px] font-mono text-amber-500 transition-colors hover:bg-amber-500/10">
                            Tambah panel section baru
                          </button>
                        </>
                      ) : null}
                    </>
                  ) : null}

                  {selectedNode?.nodeType === "SECTION" ? (
                    <>
                      <button type="button" onClick={() => toggleNode(selectedNode)}
                        className="w-full border border-white/10 px-3 py-2 text-left text-[11px] font-mono text-white/60 transition-colors hover:border-white/30 hover:text-white">
                        {expandedNodeIds.has(selectedNode.nodeId) ? "Tutup panel" : "Buka panel"}
                      </button>
                      {canManagePanels && selectedNode.category && selectedNode.section ? (
                        <>
                          <button type="button" onClick={() => openEditSection(selectedNode.category ?? "", selectedNode.section ?? "")}
                            className="w-full border border-white/10 px-3 py-2 text-left text-[11px] font-mono text-white/60 transition-colors hover:border-white/30 hover:text-white">
                            Edit nama section
                          </button>
                          <button type="button" onClick={() => openCreatePanelFromSection(selectedNode)}
                            className="w-full border border-amber-500/30 bg-amber-500/[0.06] px-3 py-2 text-left text-[11px] font-mono text-amber-500 transition-colors hover:bg-amber-500/10">
                            Tambah panel di section ini
                          </button>
                        </>
                      ) : null}
                    </>
                  ) : null}

                  {selectedRecord ? (
                    <>
                      {selectedRecord.nodeType === "PANEL" && canManagePanels ? (
                        <button type="button" onClick={() => openCreateFromNode(selectedNode as UnitBomNode)}
                          className="w-full border border-amber-500/30 bg-amber-500/[0.06] px-3 py-2 text-left text-[11px] font-mono text-amber-500 transition-colors hover:bg-amber-500/10">
                          Tambah part di panel ini
                        </button>
                      ) : null}
                      {selectedDetailKey ? (
                        <button type="button" onClick={() => selectedNode ? navigateToDetail(selectedNode) : undefined}
                          className="w-full border border-white/10 px-3 py-2 text-left text-[11px] font-mono text-white/70 transition-colors hover:border-white/30 hover:text-white">
                          Buka detail workflow
                        </button>
                      ) : null}
                      {canManagePanels ? (
                        <>
                          <button type="button" onClick={() => openEdit(selectedRecord)}
                            className="w-full border border-white/10 px-3 py-2 text-left text-[11px] font-mono text-white/60 transition-colors hover:border-white/30 hover:text-white">
                            Edit {selectedRecord.nodeType === "PANEL" ? "panel" : "part"}
                          </button>
                          <button type="button" onClick={() => void handleDelete(selectedRecord)}
                            className="w-full border border-red-500/25 px-3 py-2 text-left text-[11px] font-mono text-red-300/70 transition-colors hover:border-red-500/45 hover:text-red-300">
                            Hapus {selectedRecord.nodeType === "PANEL" ? "panel" : "part"}
                          </button>
                        </>
                      ) : null}
                    </>
                  ) : null}
                </div>
              ) : mode.type === "edit-category" ? (
                <form className="space-y-3" onSubmit={(event) => void handleSubmit(event)}>
                  <label className="block space-y-1">
                    <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-white/30">Nama Kategori</span>
                    <input
                      value={form.category}
                      onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
                      className="h-9 w-full border border-white/10 bg-[#111114] px-3 text-[11px] font-mono text-white/70 outline-none transition-colors focus:border-amber-500/40"
                      autoFocus
                    />
                  </label>
                  <p className="border border-white/5 bg-[#111114] px-3 py-2 text-[10px] text-white/30">
                    Semua panel dan part di kategori ini akan ikut memakai nama kategori baru.
                  </p>
                  <div className="flex gap-2 pt-1">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="border border-amber-500/40 bg-amber-500/[0.06] px-3 py-2 text-[10px] font-mono uppercase tracking-[0.12em] text-amber-500 transition-colors hover:bg-amber-500/10 disabled:opacity-30"
                    >
                      {isSubmitting ? "Menyimpan..." : "Simpan"}
                    </button>
                    <button
                      type="button"
                      onClick={closeForm}
                      className="border border-white/10 px-3 py-2 text-[10px] font-mono uppercase tracking-[0.12em] text-white/40 transition-colors hover:text-white"
                    >
                      Batal
                    </button>
                  </div>
                </form>
              ) : mode.type === "edit-section" ? (
                <form className="space-y-3" onSubmit={(event) => void handleSubmit(event)}>
                  <label className="block space-y-1">
                    <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-white/30">Nama Section</span>
                    <input
                      value={form.section}
                      onChange={(event) => setForm((current) => ({ ...current, section: event.target.value }))}
                      className="h-9 w-full border border-white/10 bg-[#111114] px-3 text-[11px] font-mono text-white/70 outline-none transition-colors focus:border-amber-500/40"
                      autoFocus
                    />
                  </label>
                  <p className="border border-white/5 bg-[#111114] px-3 py-2 text-[10px] text-white/30">
                    Semua panel dan part di section ini akan ikut memakai nama section baru.
                  </p>
                  <div className="flex gap-2 pt-1">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="border border-amber-500/40 bg-amber-500/[0.06] px-3 py-2 text-[10px] font-mono uppercase tracking-[0.12em] text-amber-500 transition-colors hover:bg-amber-500/10 disabled:opacity-30"
                    >
                      {isSubmitting ? "Menyimpan..." : "Simpan"}
                    </button>
                    <button
                      type="button"
                      onClick={closeForm}
                      className="border border-white/10 px-3 py-2 text-[10px] font-mono uppercase tracking-[0.12em] text-white/40 transition-colors hover:text-white"
                    >
                      Batal
                    </button>
                  </div>
                </form>
              ) : (
                <form className="space-y-3" onSubmit={(event) => void handleSubmit(event)}>
                  {mode.type === "create" && mode.sectionMode === "existing" ? (
                    <div className="space-y-1">
                      <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-white/30">Buat</span>
                      <div className="grid grid-cols-2 gap-1 border border-white/10 bg-[#111114] p-1">
                        <button
                          type="button"
                          onClick={() => selectNodeType("Panel")}
                          className={`px-2 py-1.5 text-[10px] font-mono uppercase tracking-[0.12em] transition-colors ${
                            form.nodeType === "PANEL"
                              ? "bg-amber-500/[0.08] text-amber-500"
                              : "text-white/35 hover:text-white"
                          }`}
                        >
                          Panel
                        </button>
                        <button
                          type="button"
                          onClick={() => selectNodeType("Part")}
                          className={`px-2 py-1.5 text-[10px] font-mono uppercase tracking-[0.12em] transition-colors ${
                            form.nodeType === "PART"
                              ? "bg-amber-500/[0.08] text-amber-500"
                              : "text-white/35 hover:text-white"
                          }`}
                        >
                          Part
                        </button>
                      </div>
                    </div>
                  ) : null}

                  <label className="block space-y-1">
                    <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-white/30">Kategori</span>
                    <SearchableField
                      value={form.category}
                      options={categoryOptions}
                      onChange={mode.type === "create" && mode.sectionMode === "existing"
                        ? selectCategory
                        : (category) => setForm((current) => ({ ...current, category }))}
                      placeholder="Pilih kategori"
                    />
                  </label>

                  <label className="block space-y-1">
                    <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-white/30">Section</span>
                    {mode.type === "create" && mode.sectionMode === "new" ? (
                      <input
                        value={form.section}
                        onChange={(event) => setForm((current) => ({ ...current, section: event.target.value }))}
                        placeholder="Nama section baru"
                        className="h-9 w-full border border-white/10 bg-[#111114] px-3 text-[11px] font-mono text-white/70 outline-none transition-colors placeholder:text-white/20 focus:border-amber-500/40"
                      />
                    ) : (
                      <SearchableField
                        value={form.section}
                        options={sectionOptions}
                        onChange={selectSection}
                        placeholder={form.category ? "Pilih section" : "Pilih kategori dulu"}
                        disabled={mode.type === "create" && mode.sectionMode === "existing" && !form.category}
                      />
                    )}
                  </label>

                  {mode.type === "create" && form.nodeType === "PART" ? (
                    <label className="block space-y-1">
                      <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-white/30">Panel Parent</span>
                      <SearchableField
                        value={parentPanelValue}
                        options={parentPanelOptions}
                        onChange={selectParentPanel}
                        placeholder={form.section ? "Pilih panel parent" : "Pilih section dulu"}
                        disabled={!form.section}
                      />
                    </label>
                  ) : null}

                  <>
                    {mode.type === "edit" && mode.record.nodeType === "PART" && selectedParentPanel ? (
                      <div className="border border-amber-500/20 bg-amber-500/[0.04] px-3 py-2 text-[10px] font-mono text-amber-400">
                        Parent: {selectedParentPanel.name}
                      </div>
                    ) : null}

                    <label className="block space-y-1">
                      <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-white/30">
                        {mode.type === "create" && mode.sectionMode === "new"
                          ? "Nama Panel Pertama"
                          : form.nodeType === "PART"
                            ? "Nama Part"
                            : "Nama Panel"}
                      </span>
                      <input
                        value={form.name}
                        onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                        placeholder={mode.type === "create" && mode.sectionMode === "new" ? "Contoh: Body Depan" : undefined}
                        className="h-9 w-full border border-white/10 bg-[#111114] px-3 text-[11px] font-mono text-white/70 outline-none transition-colors placeholder:text-white/20 focus:border-amber-500/40"
                      />
                    </label>
                  </>

                  <label className="flex items-center gap-3 border border-white/5 bg-[#111114] px-3 py-2">
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
                      className="h-4 w-4 border-white/20 bg-transparent"
                    />
                    <span className="text-[10px] font-mono text-white/50">Aktifkan {form.nodeType === "PART" ? "part" : "panel"} ini</span>
                  </label>

                  <div className="grid grid-cols-2 gap-2">
                      <label className="block space-y-1">
                        <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-white/30">Qty</span>
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={form.qty}
                          onChange={(event) => setForm((current) => ({ ...current, qty: event.target.value }))}
                          className="h-9 w-full border border-white/10 bg-[#111114] px-3 text-[11px] font-mono text-white/70 outline-none transition-colors focus:border-amber-500/40"
                        />
                      </label>
                      <label className="block space-y-1">
                        <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-white/30">Lokasi</span>
                        <select
                          value={form.defaultLocationType}
                          onChange={(event) => {
                            const defaultLocationType = event.target.value as PanelFormState["defaultLocationType"];
                            setForm((current) => ({
                              ...current,
                              defaultLocationType,
                              defaultStockStatus: stockStatusForLocation(defaultLocationType),
                            }));
                          }}
                          className="h-9 w-full border border-white/10 bg-[#111114] px-2 text-[10px] font-mono text-white/70 outline-none transition-colors focus:border-amber-500/40 [color-scheme:dark]"
                        >
                          <option value="UNIT">{LOCATION_LABEL.UNIT}</option>
                          <option value="WORKSHOP">{LOCATION_LABEL.WORKSHOP}</option>
                          <option value="GUDANG">{LOCATION_LABEL.GUDANG}</option>
                        </select>
                      </label>
                      <label className="block space-y-1">
                        <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-white/30">Posisi</span>
                        <select
                          value={form.defaultStockStatus}
                          onChange={(event) => setForm((current) => ({ ...current, defaultStockStatus: event.target.value as PanelFormState["defaultStockStatus"] }))}
                          disabled={form.defaultLocationType === "UNIT"}
                          className="h-9 w-full border border-white/10 bg-[#111114] px-2 text-[10px] font-mono text-white/70 outline-none transition-colors focus:border-amber-500/40 disabled:cursor-not-allowed disabled:text-white/40 [color-scheme:dark]"
                        >
                          <option value="INSTALLED">{STOCK_STATUS_LABEL.INSTALLED}</option>
                          <option value="IN_STORAGE">{STOCK_STATUS_LABEL.IN_STORAGE}</option>
                          <option value="RETRIEVED">{STOCK_STATUS_LABEL.RETRIEVED}</option>
                          <option value="LOST">{STOCK_STATUS_LABEL.LOST}</option>
                        </select>
                      </label>
                      <label className="block space-y-1">
                        <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-white/30">Kondisi</span>
                        <select
                          value={form.defaultConditionType}
                          onChange={(event) => setForm((current) => ({ ...current, defaultConditionType: event.target.value as PanelFormState["defaultConditionType"] }))}
                          className="h-9 w-full border border-white/10 bg-[#111114] px-2 text-[10px] font-mono text-white/70 outline-none transition-colors focus:border-amber-500/40 [color-scheme:dark]"
                        >
                          <option value="BEKAS">{CONDITION_LABEL.BEKAS}</option>
                          <option value="RESTORE">{CONDITION_LABEL.RESTORE}</option>
                          <option value="BARU">{CONDITION_LABEL.BARU}</option>
                        </select>
                      </label>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="border border-amber-500/40 bg-amber-500/[0.06] px-3 py-2 text-[10px] font-mono uppercase tracking-[0.12em] text-amber-500 transition-colors hover:bg-amber-500/10 disabled:opacity-30"
                    >
                      {isSubmitting ? "Menyimpan..." : "Simpan"}
                    </button>
                    <button
                      type="button"
                      onClick={closeForm}
                      className="border border-white/10 px-3 py-2 text-[10px] font-mono uppercase tracking-[0.12em] text-white/40 transition-colors hover:text-white"
                    >
                      Batal
                    </button>
                  </div>
                </form>
              )}
            </div>

            <div className="border-t border-white/5 px-4 py-3 text-[10px] font-mono text-white/25">
              Foto: {canManagePhotos ? "manage" : "read"} / download {canDownloadPhotos ? "aktif" : "nonaktif"}
            </div>
          </aside>
          ) : null}
        </div>
        {sweetAlert.alertElement}
      </section>
  );
}
