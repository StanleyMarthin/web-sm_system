"use client";

import type { UnitBomNode, UnitBomWorkspace } from "@smsystem/contracts/unit-bom";
import type { UnitPanelRecord } from "@smsystem/contracts/unit-panel";
import {
  ArrowUpRight,
  Boxes,
  ChevronDown,
  Eye,
  EyeOff,
  FolderOpen,
  GitBranch,
  Grip,
  Lock,
  PackageCheck,
  PackageSearch,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Undo2,
  Wrench,
  X,
  XCircle,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  ChevronsDownUp,
  ChevronsUpDown,
  Users,
} from "lucide-react";
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
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
import {
  buildPayload,
  CONDITION_LABEL,
  emptyForm,
  formForChild,
  formForNode,
  formFromRecord,
  LOCATION_LABEL,
  type PanelFormState,
  STOCK_STATUS_LABEL,
  stockStatusForLocation,
} from "@/modules/units/helpers/unit-panel-form";
import { SearchableField, type SearchOption } from "./shared/SearchableField";

interface BomTrackerTabProps {
  carId: string;
  unitName?: string;
  bom: UnitBomWorkspace | null;
  canManagePhotos: boolean;
  canDownloadPhotos: boolean;
  canManagePanels?: boolean;
}

type FormMode =
  | { type: "create"; sectionMode: "existing" | "new"; sourceNode?: UnitBomNode | null }
  | { type: "edit"; record: UnitPanelRecord }
  | { type: "edit-category"; category: string }
  | { type: "edit-section"; category: string; section: string }
  | null;

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

interface CanvasFocus {
  visibleNodeIds: Set<string> | null;
  activeEdgeKeys: Set<string>;
  label: string | null;
}

interface NodePosition {
  x: number;
  y: number;
}

type SelectionTarget =
  | { type: "unit" }
  | { type: "node"; node: UnitBomNode }
  | null;

interface PersistedCanvasState {
  zoom?: number;
  isRootExpanded?: boolean;
  expandedNodeIds?: string[];
  nodePositions?: Record<string, NodePosition>;
  canvasMinSize?: { width: number; height: number };
  hiddenNodeIds?: string[];
  nodeDimensions?: Record<string, NodeDimension>;
}

interface NodeDimension {
  width: number;
  height: number;
}

interface ContextMenuState {
  node: UnitBomNode;
  x: number;
  y: number;
}

interface BomCanvasDraft {
  zoom: number;
  isRootExpanded: boolean;
  expandedNodeIds: string[];
  nodePositions: Record<string, NodePosition>;
  canvasMinSize: { width: number; height: number };
  hiddenNodeIds: string[];
  nodeDimensions: Record<string, NodeDimension>;
}

const NODE_WIDTH = 220;
const NODE_HEIGHT = 118;
const COLUMN_GAP = 96;
const ROW_GAP = 24;
const ROOT_NODE_ID = "__unit_root";
const CANVAS_STATE_VERSION = "v1";
const MIN_NODE_WIDTH = 180;
const MIN_NODE_HEIGHT = 118;
const EDGE_SCROLL_ZONE = 80;
const EDGE_SCROLL_SPEED = 10;
const EDGE_EXPAND_STEP = 300;

function safeStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage;
}

function getAllNodeIds(nodes: UnitBomNode[]): string[] {
  return nodes.flatMap((node) => [node.nodeId, ...getAllNodeIds(node.children)]);
}

function jobStatusMeta(status: string | null | undefined) {
  switch (status) {
    case "DONE":
      return { label: "DONE", className: "border-success/30 bg-success/[0.07] text-success", dot: "bg-success" };
    case "QC_READY":
      return { label: "QC", className: "border-info/30 bg-info/[0.07] text-info", dot: "bg-info" };
    case "PROSES":
      return { label: "PROSES", className: "border-primary/25 bg-primary/[0.07] text-app-accent-ink", dot: "bg-primary" };
    case "PLAN":
      return { label: "PLAN", className: "border-border bg-muted text-muted-foreground", dot: "bg-muted-foreground" };
    default:
      return { label: "BELUM ADA", className: "border-border bg-muted text-muted-foreground", dot: "bg-muted" };
  }
}

function stockStatusMeta(status: string | null | undefined) {
  switch (status) {
    case "INSTALLED":
      return { label: "Terpasang", icon: PackageCheck, className: "text-success" };
    case "RETRIEVED":
      return { label: "Diambil", icon: Wrench, className: "text-app-accent-ink" };
    case "IN_STORAGE":
      return { label: "Di Gudang", icon: Boxes, className: "text-info" };
    case "LOST":
      return { label: "Hilang", icon: XCircle, className: "text-destructive" };
    default:
      return { label: "Tidak ada", icon: PackageSearch, className: "text-muted-foreground" };
  }
}

function conditionBadge(type: string | null | undefined) {
  switch (type) {
    case "BARU":
      return "border-success/25 text-success";
    case "RESTORE":
      return "border-primary/25 text-app-accent-ink";
    case "BEKAS":
      return "border-border text-muted-foreground";
    default:
      return null;
  }
}

function hierarchyText(node: UnitBomNode): string {
  const parts = [node.category, node.section].filter(Boolean);
  if (node.nodeType === "CATEGORY") return "Kelompok utama";
  if (node.nodeType === "SECTION") return node.category ? `Bagian dari ${node.category}` : "Sub kelompok";
  return parts.length > 0 ? parts.join(" > ") : "Belum masuk kelompok";
}

function panelDetailKey(node: UnitBomNode): string | null {
  if (node.panelId) return `panel-${node.panelId}`;
  if (node.actualId) return node.actualId;
  return null;
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

function averageProgress(nodes: UnitBomNode[]): number | null {
  const values = nodes
    .map((node) => node.progressPercent)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (values.length === 0) return null;
  return Number((values.reduce((total, value) => total + value, 0) / values.length).toFixed(2));
}

function sumRemainingHours(nodes: UnitBomNode[]): number | null {
  const total = nodes.reduce((sum, node) => sum + Number(node.remainingHours ?? 0), 0);
  return Number(total.toFixed(2));
}

function buildBomDetailByPanel(nodes: UnitBomNode[]): Map<number, UnitBomNode> {
  const map = new Map<number, UnitBomNode>();

  function walk(items: UnitBomNode[]) {
    for (const item of items) {
      if (item.panelId !== null) {
        map.set(item.panelId, item);
      }
      if (item.children.length > 0) {
        walk(item.children);
      }
    }
  }

  walk(nodes);
  return map;
}

function buildPanelNode(record: UnitPanelRecord, bomDetailByPanel: Map<number, UnitBomNode>): UnitBomNode {
  const detail = bomDetailByPanel.get(record.id);
  const children = record.children.map((child) => buildPanelNode(child, bomDetailByPanel));
  return {
    nodeId: `panel:${record.id}`,
    nodeType: "PART",
    label: record.name,
    category: record.category,
    section: record.section,
    panelId: record.id,
    physicalStatus: detail?.physicalStatus ?? null,
    divisionId: detail?.divisionId ?? null,
    divisionName: detail?.divisionName ?? null,
    progressPercent: detail?.progressPercent ?? averageProgress(children),
    remainingHours: detail?.remainingHours ?? sumRemainingHours(children),
    actualId: detail?.actualId ?? null,
    logisticStatus: detail?.logisticStatus ?? null,
    logisticReference: detail?.logisticReference ?? null,
    logisticPath: detail?.logisticPath ?? null,
    stockStatus: detail?.stockStatus ?? record.defaultStockStatus,
    conditionType: detail?.conditionType ?? record.defaultConditionType,
    locationName: detail?.locationName ?? null,
    locationDetail: detail?.locationDetail ?? null,
    takenByName: detail?.takenByName ?? null,
    dateOut: detail?.dateOut ?? null,
    jobStatus: detail?.jobStatus ?? null,
    qcLastStatus: detail?.qcLastStatus ?? null,
    deadlineDate: detail?.deadlineDate ?? null,
    countRevisi: detail?.countRevisi ?? null,
    isLocked: detail?.isLocked ?? null,
    currentDivisionName: detail?.currentDivisionName ?? detail?.divisionName ?? null,
    detail: detail?.detail ?? null,
    children,
  };
}

function buildPanelTrackerTree(rows: UnitPanelRecord[], bomTree: UnitBomNode[]): UnitBomNode[] {
  if (rows.length === 0) return bomTree;

  const bomDetailByPanel = buildBomDetailByPanel(bomTree);
  const categories = new Map<string, Map<string, UnitPanelRecord[]>>();

  for (const row of rows) {
    const category = displayCategory(row.category);
    const sections = categories.get(category) ?? new Map<string, UnitPanelRecord[]>();
    const panels = sections.get(row.section) ?? [];
    panels.push(row);
    sections.set(row.section, panels);
    categories.set(category, sections);
  }

  return [...categories.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([category, sections]) => {
      const sectionNodes = [...sections.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([section, panels]) => {
          const panelNodes = panels
            .slice()
            .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name))
            .map((panel) => buildPanelNode(panel, bomDetailByPanel));
          return {
            nodeId: `section:${category}:${section}`,
            nodeType: "SECTION",
            label: section,
            category,
            section,
            panelId: null,
            physicalStatus: null,
            divisionId: null,
            divisionName: null,
            progressPercent: averageProgress(panelNodes),
            remainingHours: sumRemainingHours(panelNodes),
            actualId: null,
            logisticStatus: null,
            logisticReference: null,
            logisticPath: null,
            children: panelNodes,
          } satisfies UnitBomNode;
        });

      return {
        nodeId: `category:${category}`,
        nodeType: "CATEGORY",
        label: category,
        category,
        section: null,
        panelId: null,
        physicalStatus: null,
        divisionId: null,
        divisionName: null,
        progressPercent: averageProgress(sectionNodes),
        remainingHours: sumRemainingHours(sectionNodes),
        actualId: null,
        logisticStatus: null,
        logisticReference: null,
        logisticPath: null,
        children: sectionNodes,
      } satisfies UnitBomNode;
    });
}

function estimateNodeHeight(node: UnitBomNode, width: number): number {
  const hierarchy = hierarchyText(node);
  const labelCapacity = Math.max(16, Math.round((width / NODE_WIDTH) * 22));
  const hierarchyCapacity = Math.max(20, Math.round((width / NODE_WIDTH) * 30));
  const locationCapacity = Math.max(18, Math.round((width / NODE_WIDTH) * 28));
  const labelLines = Math.max(1, Math.ceil(node.label.length / labelCapacity));
  const hierarchyLines = Math.max(1, Math.ceil(hierarchy.length / hierarchyCapacity));
  const locationLines = node.nodeType === "PART" ? Math.max(1, Math.ceil((node.divisionName ?? "Belum ditentukan").length / locationCapacity)) : 1;
  return NODE_HEIGHT + (labelLines - 1) * 16 + (hierarchyLines - 1) * 14 + (locationLines - 1) * 14;
}

function recordMatchesCategory(record: UnitPanelRecord, category: string): boolean {
  return displayCategory(record.category) === category;
}

function buildCanvasLayout(
  nodes: UnitBomNode[],
  expandedNodeIds: Set<string>,
  isRootExpanded: boolean,
  nodeDimensions: Record<string, NodeDimension>,
  hiddenNodeIds: Set<string>,
  focusNodeIds: Set<string> | null,
): CanvasLayout {
  const positioned: CanvasNode[] = [];
  let row = 0;
  let maxDepth = 1;
  let maxRight = 860;
  let maxBottom = 32;

  function walk(items: UnitBomNode[], depth: number, parentId: string | null) {
    maxDepth = Math.max(maxDepth, depth);
    for (const item of items) {
      if (hiddenNodeIds.has(item.nodeId)) continue;
      if (focusNodeIds && !focusNodeIds.has(item.nodeId)) continue;
      const savedDimension = nodeDimensions[item.nodeId];
      const nodeWidth = savedDimension?.width ?? NODE_WIDTH;
      const nodeHeight = savedDimension?.height ?? estimateNodeHeight(item, nodeWidth);
      const previousBottom = maxBottom;
      const y = positioned.length > 0 ? previousBottom + ROW_GAP : 32;
      const x = 32 + depth * (NODE_WIDTH + 44 + COLUMN_GAP);
      row += 1;
      maxBottom = Math.max(maxBottom, y + nodeHeight);
      positioned.push({
        node: item,
        depth,
        x,
        y,
        width: nodeWidth,
        height: nodeHeight,
        parentId,
      });
      maxRight = Math.max(maxRight, x + nodeWidth + 96);
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
    width: Math.max(860, maxRight, 64 + (maxDepth + 1) * (NODE_WIDTH + 44) + maxDepth * COLUMN_GAP),
    height: Math.max(520, 64 + Math.max(1, row) * (NODE_HEIGHT + ROW_GAP), 64 + Math.max(0, ...positioned.map((node) => node.y + node.height))),
  };
}

function findNodePath(nodes: UnitBomNode[], nodeId: string): UnitBomNode[] {
  for (const node of nodes) {
    if (node.nodeId === nodeId) return [node];
    const childPath = findNodePath(node.children, nodeId);
    if (childPath.length > 0) return [node, ...childPath];
  }
  return [];
}

function canvasEdgeKey(parentId: string, childId: string): string {
  return `${parentId}:${childId}`;
}

function addDirectChildEdges(parentId: string, children: UnitBomNode[], target: Set<string>) {
  for (const child of children) {
    target.add(canvasEdgeKey(parentId, child.nodeId));
  }
}

function addPathEdges(path: UnitBomNode[], target: Set<string>) {
  if (path.length === 0) return;

  target.add(canvasEdgeKey(ROOT_NODE_ID, path[0].nodeId));

  for (let i = 1; i < path.length; i += 1) {
    target.add(canvasEdgeKey(path[i - 1].nodeId, path[i].nodeId));
  }
}

function addNodeAndDirectChildren(node: UnitBomNode | null | undefined, target: Set<string>) {
  if (!node) return;
  target.add(node.nodeId);
  for (const child of node.children) {
    target.add(child.nodeId);
  }
}

function getCanvasFocus(
  nodes: UnitBomNode[],
  selection: SelectionTarget,
  recordsById: Map<number, UnitPanelRecord>,
  showAll: boolean,
): CanvasFocus {
  const activeEdgeKeys = new Set<string>();

  if (selection?.type === "unit") {
    addDirectChildEdges(ROOT_NODE_ID, nodes, activeEdgeKeys);
    return {
      visibleNodeIds: null,
      activeEdgeKeys,
      label: null,
    };
  }

  if (selection?.type !== "node") {
    return {
      visibleNodeIds: null,
      activeEdgeKeys,
      label: null,
    };
  }

  const selectedNode = selection.node;
  const path = findNodePath(nodes, selectedNode.nodeId);
  const visibleNodeIds = new Set<string>();
  const categoryNode = path.find((node) => node.nodeType === "CATEGORY") ?? null;
  const sectionNode = path.find((node) => node.nodeType === "SECTION") ?? null;
  const parentNode = path.length > 1 ? path[path.length - 2] : null;
  const selectedRecord = selectedNode.panelId ? recordsById.get(selectedNode.panelId) ?? null : null;
  const isPanelRecord = selectedRecord?.nodeType === "PANEL";
  const isPartRecord = selectedRecord?.nodeType === "PART";
  
  addPathEdges(path, activeEdgeKeys);
  for (const node of path) {
    visibleNodeIds.add(node.nodeId);
  }

  let label: string | null = selectedNode.label;

  if (selectedNode.nodeType === "CATEGORY") {
    addDirectChildEdges(selectedNode.nodeId, selectedNode.children, activeEdgeKeys);
    addNodeAndDirectChildren(selectedNode, visibleNodeIds);
    label = `Kategori: ${selectedNode.label}`;
  } else if (selectedNode.nodeType === "SECTION") {
    addDirectChildEdges(selectedNode.nodeId, selectedNode.children, activeEdgeKeys);
    if (categoryNode) visibleNodeIds.add(categoryNode.nodeId);
    addNodeAndDirectChildren(selectedNode, visibleNodeIds);
    label = `Section: ${selectedNode.label}`;
  } else if (isPanelRecord) {
    addDirectChildEdges(selectedNode.nodeId, selectedNode.children, activeEdgeKeys);
    if (categoryNode) visibleNodeIds.add(categoryNode.nodeId);
    if (sectionNode) visibleNodeIds.add(sectionNode.nodeId);
    addNodeAndDirectChildren(selectedNode, visibleNodeIds);
    label = `Panel: ${selectedNode.label}`;
  } else if (isPartRecord && parentNode) {
  if (categoryNode) visibleNodeIds.add(categoryNode.nodeId);
  if (sectionNode) visibleNodeIds.add(sectionNode.nodeId);
  addNodeAndDirectChildren(parentNode, visibleNodeIds);
  visibleNodeIds.add(selectedNode.nodeId);
  label = `Part: ${selectedNode.label}`;
  }

  return {
    visibleNodeIds: showAll ? null : visibleNodeIds,
    activeEdgeKeys,
    label,
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

function NodeCard({
  canvasNode,
  zoom,
  panelRecord,
  isExpanded,
  isSelected,
  onInteractionStart,
  onPositionChange,
  onDimensionChange,
  onOpenMenu,
  onToggle,
  onSelect,
  onDragNodeStart,
  onDragNodeMove,
  onDragNodeEnd,
  onNavigateToDetail,
}: {
  canvasNode: CanvasNode;
  zoom: number;
  panelRecord: UnitPanelRecord | null;
  isExpanded: boolean;
  isSelected: boolean;
  onInteractionStart: () => void;
  onPositionChange: (nodeId: string, updater: (current: NodePosition) => NodePosition, initialPos?: NodePosition) => void;
  onDimensionChange: (nodeId: string, dimension: NodeDimension) => void;
  onOpenMenu: (node: UnitBomNode, event: MouseEvent<HTMLDivElement>) => void;
  onToggle: (node: UnitBomNode) => void;
  onSelect: (node: UnitBomNode) => void;
  onDragNodeStart: (clientX: number, clientY: number) => void;
  onDragNodeMove: (clientX: number, clientY: number) => void;
  onDragNodeEnd: () => void;
  onNavigateToDetail: (node: UnitBomNode) => void;
}) {
  const { node, x, y, width, height } = canvasNode;
  const detailKey = panelDetailKey(node);
  const isPanel = panelRecord?.nodeType === "PANEL";
  const isGroupNode = node.nodeType === "CATEGORY" || node.nodeType === "SECTION";
  const isGroup = isGroupNode || isPanel;
  const canExpand = node.children.length > 0;
  const nodeKind = isGroupNode ? node.nodeType : isPanel ? "PANEL" : "PART";
  const progressValue = typeof node.progressPercent === "number" ? Math.max(0, Math.min(100, node.progressPercent)) : null;
  const jobMeta = jobStatusMeta(node.jobStatus);
  const stockMeta = stockStatusMeta(node.stockStatus);
  const StockIcon = stockMeta.icon;
  const conditionClass = conditionBadge(node.conditionType);
  const contextLabel = isGroupNode
    ? `${node.children.length} isi${node.remainingHours != null && node.remainingHours > 0 ? ` · ${node.remainingHours}j sisa` : ""}`
    : node.currentDivisionName ?? node.divisionName ?? stockMeta.label;
  const dragRef = useRef<{
    pointerId: number;
    lastClientX: number;
    lastClientY: number;
    didDrag: boolean;
    totalDx: number;
    totalDy: number;
  } | null>(null);
  const resizeRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    width: number;
    height: number;
  } | null>(null);
  const suppressClickRef = useRef(false);
  const cardRef = useRef<HTMLButtonElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 10);
    return () => clearTimeout(t);
  }, []);

  // [REFACTOR 3] ResizeObserver auto height
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const measuredH = Math.ceil(entry.contentRect.height);
      // Hanya report jika berbeda signifikan (>2px) dari height saat ini
      if (Math.abs(measuredH - height) > 2) {
        onDimensionChange(node.nodeId, { width, height: measuredH });
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, [node.nodeId, width, height, onDimensionChange]);


  function handleNodePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    if (event.target instanceof Element && event.target.closest("[data-node-resize='true']")) return;
    event.stopPropagation();
    onInteractionStart();
    onDragNodeStart(event.clientX, event.clientY);
    dragRef.current = {
      pointerId: event.pointerId,
      lastClientX: event.clientX,
      lastClientY: event.clientY,
      didDrag: false,
      totalDx: 0,
      totalDy: 0,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleNodePointerMove(event: PointerEvent<HTMLDivElement>) {
    onDragNodeMove(event.clientX, event.clientY);
    const activeResize = resizeRef.current;
    if (activeResize && activeResize.pointerId === event.pointerId) {
      const nextWidth = Math.max(MIN_NODE_WIDTH, Math.round(activeResize.width + (event.clientX - activeResize.startX) / zoom));
      const nextHeight = Math.max(MIN_NODE_HEIGHT, Math.round(activeResize.height + (event.clientY - activeResize.startY) / zoom));
      onDimensionChange(node.nodeId, { width: nextWidth, height: nextHeight });
      return;
    }
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = (event.clientX - drag.lastClientX) / zoom;
    const dy = (event.clientY - drag.lastClientY) / zoom;
    drag.lastClientX = event.clientX;
    drag.lastClientY = event.clientY;
    drag.totalDx += dx;
    drag.totalDy += dy;
    if (Math.abs(drag.totalDx) > 3 || Math.abs(drag.totalDy) > 3) {
      drag.didDrag = true;
    }
    onPositionChange(
      node.nodeId,
      (current) => ({ x: current.x + dx, y: current.y + dy }),
      { x, y }
    );
  }

  function handleNodePointerUp(event: PointerEvent<HTMLDivElement>) {
    onDragNodeEnd();
    const activeResize = resizeRef.current;
    if (activeResize && activeResize.pointerId === event.pointerId) {
      resizeRef.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
      return;
    }
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

  function handleResizePointerDown(event: PointerEvent<HTMLSpanElement>) {
    if (event.button !== 0) return;
    event.stopPropagation();
    onInteractionStart();
    resizeRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      width,
      height,
    };
    onSelect(node);
    event.currentTarget.parentElement?.setPointerCapture(event.pointerId);
  }

  return (
    <div
      data-canvas-node="true"
      className="group absolute cursor-move"
      style={{
        left: x,
        top: y,
        width,
        minHeight: height,
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'scale(1)' : 'scale(0.95)',
        transition: 'opacity 150ms ease, transform 150ms ease',
      }}
      onContextMenu={(event) => onOpenMenu(node, event)}
      onPointerDown={handleNodePointerDown}
      onPointerMove={handleNodePointerMove}
      onPointerUp={handleNodePointerUp}
      onPointerCancel={handleNodePointerUp}
    >
      <button
        ref={cardRef}
        aria-expanded={canExpand ? isExpanded : undefined}
        aria-label={`${node.label}${canExpand ? ` — ${node.children.length} turunan, ${isExpanded ? 'terbuka' : 'tertutup'}` : ''}`}
        // [REFACTOR 4B] Node hover tooltip
        title={[
          `Klik kanan untuk aksi · ${node.label}`,
          node.divisionName ? `Lokasi: ${node.divisionName}` : null,
          node.logisticReference ? `Ref: ${node.logisticReference}` : null,
          node.progressPercent != null ? `Progress: ${node.progressPercent.toFixed(0)}%` : null,
          node.remainingHours != null && node.remainingHours > 0
            ? `Sisa: ${node.remainingHours}j`
            : null,
        ]
          .filter(Boolean)
          .join('\n')}
        type="button"
        onClick={() => {
          if (suppressClickRef.current) return;
        }}
        className={`min-h-full w-full border bg-card p-3 text-left shadow-lg shadow-black/20 transition-[border-color,background-color,transform] hover:-translate-y-0.5 hover:border-primary/35 hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary/70 ${isSelected ? "border-primary/70 bg-primary/[0.08]" : isGroup ? "border-border" : detailKey ? "border-border" : "border-border"
          }`}
      >
        <div className="space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                {canExpand ? (
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center border border-border text-muted-foreground">
                    {isExpanded ? <ChevronDown className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                  </span>
                ) : null}
                {node.isLocked ? <Lock className="h-3.5 w-3.5 shrink-0 text-app-accent-ink" /> : null}
                <p className="min-w-0 truncate text-[15px] font-semibold text-foreground">{node.label}</p>
              </div>
              <p className="mt-1 truncate text-[13px] text-muted-foreground">{hierarchyText(node)}</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className="border border-border px-1.5 py-0.5 font-mono text-[12px] uppercase tracking-[0.08em] text-muted-foreground">
                {nodeKind}
              </span>
              {conditionClass ? (
                <span className={`border px-1.5 py-0.5 font-mono text-[12px] uppercase tracking-[0.08em] ${conditionClass}`}>
                  {node.conditionType}
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1.5 truncate font-mono text-[13px] text-muted-foreground">
              {isGroupNode ? <GitBranch className="h-3.5 w-3.5 shrink-0" /> : <StockIcon className={`h-3.5 w-3.5 shrink-0 ${stockMeta.className}`} />}
              <span className="truncate">{contextLabel}</span>
            </span>
            {!isGroupNode ? (
              <span className={`shrink-0 border px-2 py-0.5 font-mono text-[12px] uppercase tracking-[0.08em] ${jobMeta.className}`}>
                {jobMeta.label}
              </span>
            ) : null}
          </div>

          {progressValue != null ? (
            <div className="space-y-1">
              <div className="flex items-center justify-between font-mono text-[12px] text-muted-foreground">
                <span>Progress</span>
                <span className="font-semibold text-foreground">{progressValue.toFixed(0)}%</span>
              </div>
              <div className="h-1.5 overflow-hidden bg-muted">
                <div
                  className={`h-full transition-[width] ${node.jobStatus === "DONE" ? "bg-success" : "bg-primary"}`}
                  style={{ width: `${progressValue}%` }}
                />
              </div>
            </div>
          ) : null}

          {(node.remainingHours != null && node.remainingHours > 0) || node.deadlineDate || node.qcLastStatus ? (
            <div className="flex flex-wrap items-center gap-1.5 font-mono text-[12px] text-muted-foreground">
              {node.remainingHours != null && node.remainingHours > 0 ? <span>{node.remainingHours}j sisa</span> : null}
              {node.deadlineDate ? <span>Deadline {new Date(node.deadlineDate).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}</span> : null}
              {node.qcLastStatus === "TIDAK_LOLOS" ? <span className="text-destructive">QC gagal{node.countRevisi ? ` · rev.${node.countRevisi}` : ""}</span> : null}
              {node.qcLastStatus === "LOLOS" ? <span className="text-success">QC lolos</span> : null}
            </div>
          ) : null}
        </div>
        {detailKey ? (
          <button
            type="button"
            data-node-actions="true"
            className="mt-2 flex w-full cursor-pointer justify-end opacity-0 transition-opacity group-hover:opacity-100 hover:opacity-80"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onNavigateToDetail(node);
            }}
            title="Buka detail workflow"
          >
            <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        ) : null}
      </button>
      <span
        data-node-resize="true"
        className={`absolute bottom-[-4px] right-[-4px] h-3 w-3 cursor-nwse-resize border border-info bg-info transition-opacity ${
          isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-60'
        }`}
        onPointerDown={handleResizePointerDown}
      />
    </div>
  );
}

const CanvasEdges = memo(
  ({
    positionedNodes,
    nodeById,
    rootPosition,
    activeEdgeKeys,
  }: {
    positionedNodes: CanvasNode[];
    nodeById: Map<string, CanvasNode>;
    rootPosition: NodePosition;
    activeEdgeKeys: Set<string>;
  }) => (
    <svg className="absolute inset-0 h-full w-full pointer-events-none" aria-hidden="true">
      <defs>
        <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path
            d="M0,0 L0,6 L6,3 z"
            fill="var(--muted-foreground)"
            opacity="0.65"
          />
        </marker>
        <marker id="arrow-active" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
          <path d="M0,0 L0,7 L7,3.5 z" fill="var(--primary)" />
        </marker>
      </defs>
      {positionedNodes.map((item) => {
        if (!item.parentId) return null;
        const parent = item.parentId === ROOT_NODE_ID
          ? { x: rootPosition.x, y: rootPosition.y, width: NODE_WIDTH, height: NODE_HEIGHT }
          : nodeById.get(item.parentId);
        if (!parent) return null;

        const isHighlighted = activeEdgeKeys.has(canvasEdgeKey(item.parentId, item.node.nodeId));
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
            stroke={isHighlighted ? "var(--primary)" : "var(--border)"}
            strokeWidth={isHighlighted ? 2.5 : 0.8}
            markerEnd={isHighlighted ? "url(#arrow-active)" : "url(#arrow)"}
          />
        );
      })}
    </svg>
  ),
  (prev, next) =>
    prev.positionedNodes === next.positionedNodes &&
    prev.rootPosition.x === next.rootPosition.x &&
    prev.rootPosition.y === next.rootPosition.y &&
    prev.activeEdgeKeys === next.activeEdgeKeys,
);
CanvasEdges.displayName = 'CanvasEdges';

export function BomTrackerTab({
  carId,
  unitName,
  bom,
  canManagePhotos,
  canDownloadPhotos,
  canManagePanels = false,
}: BomTrackerTabProps) {
  const router = useRouter();
  const { alertElement, notifyError, notifySuccess, confirm } = useSweetAlert();
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const hasLoadedCanvasStateRef = useRef(false);
  const skipNextCanvasSaveRef = useRef(true);
  const sectionRef = useRef<HTMLElement | null>(null);
  const panRef = useRef<{ pointerId: number; startX: number; startY: number; left: number; top: number } | null>(null);
  const edgeScrollRafRef = useRef<number | null>(null);
  const hasScrolledToRootRef = useRef(false);
  const isDraggingNodeRef = useRef(false);
  const lastCursorRef = useRef({ clientX: 0, clientY: 0 });

  const onNodeDragStart = useCallback((clientX: number, clientY: number) => {
    isDraggingNodeRef.current = true;
    lastCursorRef.current = { clientX, clientY };
    edgeScrollRafRef.current = requestAnimationFrame(runEdgeScroll);
  }, []);

  const onNodeDragMove = useCallback((clientX: number, clientY: number) => {
    lastCursorRef.current = { clientX, clientY };
  }, []);

  const onNodeDragEnd = useCallback(() => {
    isDraggingNodeRef.current = false;
    if (edgeScrollRafRef.current !== null) {
      cancelAnimationFrame(edgeScrollRafRef.current);
      edgeScrollRafRef.current = null;
    }
  }, []);

  function runEdgeScroll() {
    if (!isDraggingNodeRef.current || !viewportRef.current) return;

    const vp = viewportRef.current;
    const vpRect = vp.getBoundingClientRect();
    const { clientX, clientY } = lastCursorRef.current;
    const relX = clientX - vpRect.left;
    const relY = clientY - vpRect.top;

    // Scroll ke kanan/bawah saja
    if (relX > vpRect.width - EDGE_SCROLL_ZONE) {
      vp.scrollLeft += EDGE_SCROLL_SPEED;
      setCanvasMinSize((s) => ({ ...s, width: s.width + EDGE_EXPAND_STEP }));
    }
    if (relY > vpRect.height - EDGE_SCROLL_ZONE) {
      vp.scrollTop += EDGE_SCROLL_SPEED;
      setCanvasMinSize((s) => ({ ...s, height: s.height + EDGE_EXPAND_STEP }));
    }

    // Scroll ke kiri/atas — hanya scroll viewport, TIDAK geser node, TIDAK expand
    if (relX < EDGE_SCROLL_ZONE) vp.scrollLeft -= EDGE_SCROLL_SPEED;
    if (relY < EDGE_SCROLL_ZONE) vp.scrollTop  -= EDGE_SCROLL_SPEED;

    edgeScrollRafRef.current = requestAnimationFrame(runEdgeScroll);
  }

  useEffect(() => {
    return () => {
      if (edgeScrollRafRef.current !== null) {
        cancelAnimationFrame(edgeScrollRafRef.current);
      }
    };
  }, []);

  const rootDragRef = useRef<{
    pointerId: number;
    lastClientX: number;
    lastClientY: number;
    didDrag: boolean;
  } | null>(null);
  const suppressRootClickRef = useRef(false);
  const [workspace, setWorkspace] = useState<UnitBomWorkspace | null>(bom);
  const [rows, setRows] = useState<UnitPanelRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [zoom, setZoom] = useState(0.92);
  const [mode, setMode] = useState<FormMode>(null);
  const [form, setForm] = useState<PanelFormState>(emptyForm());
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [isRootExpanded, setIsRootExpanded] = useState(false);
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(() => new Set());
  const [nodePositions, setNodePositions] = useState<Record<string, NodePosition>>({});
  const [selection, setSelection] = useState<SelectionTarget>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [canvasMinSize, setCanvasMinSize] = useState({ width: 6000, height: 4000 });
  const [hiddenNodeIds, setHiddenNodeIds] = useState<Set<string>>(() => new Set());
  const [nodeDimensions, setNodeDimensions] = useState<Record<string, NodeDimension>>({});
  const [showFocusedHidden, setShowFocusedHidden] = useState(false);
  // Draft history for canvas undo (Ctrl+Z)
  const canvasStateRef = useRef<BomCanvasDraft>({
    zoom: 0.92,
    isRootExpanded: false,
    expandedNodeIds: [],
    nodePositions: {},
    canvasMinSize: { width: 6000, height: 4000 },
    hiddenNodeIds: [],
    nodeDimensions: {},
  });
  const draftHistoryRef = useRef<BomCanvasDraft[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [showHint, setShowHint] = useState(() => !safeStorage()?.getItem('bom:canvas:hint-dismissed'));
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    if (contextMenu) {
      const firstBtn = contextMenuRef.current?.querySelector('button');
      firstBtn?.focus();
    }
  }, [contextMenu]);

  const undoCanvas = useCallback(() => {
    const history = draftHistoryRef.current;
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    draftHistoryRef.current = history.slice(0, -1);
    setCanUndo(draftHistoryRef.current.length > 0);
    setZoom(prev.zoom);
    setIsRootExpanded(prev.isRootExpanded);
    setExpandedNodeIds(new Set(prev.expandedNodeIds));
    setNodePositions(prev.nodePositions);
    setCanvasMinSize(prev.canvasMinSize);
    setHiddenNodeIds(new Set(prev.hiddenNodeIds));
    setNodeDimensions(prev.nodeDimensions);
  }, []);

  const fitToView = useCallback(() => {
    const positions = Object.values(nodePositions);
    if (positions.length === 0 || !viewportRef.current) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const pos of positions) {
      if (pos.x < minX) minX = pos.x;
      if (pos.y < minY) minY = pos.y;
      if (pos.x > maxX) maxX = pos.x;
      if (pos.y > maxY) maxY = pos.y;
    }
    maxX += NODE_WIDTH + 96;
    maxY += NODE_HEIGHT + 96;

    const vpW = viewportRef.current.clientWidth;
    const vpH = viewportRef.current.clientHeight;
    const contentW = maxX - minX;
    const contentH = maxY - minY;

    const fitZoom = Math.min(vpW / (contentW + 160), vpH / (contentH + 160), 1.0, 1.35);
    const roundedZoom = Number(Math.max(0.55, fitZoom).toFixed(2));
    setZoom(roundedZoom);

    window.requestAnimationFrame(() => {
      viewportRef.current?.scrollTo({
        left: Math.max(0, (minX - 80) * roundedZoom),
        top: Math.max(0, (minY - 80) * roundedZoom),
        behavior: 'smooth',
      });
    });
  }, [nodePositions]);

  useEffect(() => {
    setWorkspace(bom);
  }, [bom]);

  useEffect(() => {
    hasLoadedCanvasStateRef.current = false;
    skipNextCanvasSaveRef.current = true;
    const saved = parsePersistedCanvasState(safeStorage()?.getItem(canvasStateKey(carId)) ?? null);
    if (saved) {
      if (typeof saved.zoom === "number") {
        setZoom(Math.max(0.55, Math.min(1.35, saved.zoom)));
      } else {
        setZoom(0.92);
      }
      setIsRootExpanded(Boolean(saved.isRootExpanded));
      setExpandedNodeIds(new Set(saved.expandedNodeIds ?? []));
      setNodePositions(saved.nodePositions ?? {});
      setCanvasMinSize(saved.canvasMinSize ?? { width: 6000, height: 4000 });
      setHiddenNodeIds(new Set(saved.hiddenNodeIds ?? []));
      setNodeDimensions(saved.nodeDimensions ?? {});
    } else {
      setZoom(0.92);
      setIsRootExpanded(false);
      setExpandedNodeIds(new Set());
      setNodePositions({});
      setCanvasMinSize({ width: 1400, height: 1100 });
      setHiddenNodeIds(new Set());
      setNodeDimensions({});
    }
    hasLoadedCanvasStateRef.current = true;
  }, [carId]);

  useEffect(() => {
    if (!viewportRef.current || hasScrolledToRootRef.current) return;
    if (!hasLoadedCanvasStateRef.current) return;
    hasScrolledToRootRef.current = true;

    // Scroll viewport supaya root node terlihat di tengah
    const rootX = (nodePositions[ROOT_NODE_ID]?.x ?? 32) * zoom;
    const rootY = (nodePositions[ROOT_NODE_ID]?.y ?? 32) * zoom;
    const vpW = viewportRef.current.clientWidth;
    const vpH = viewportRef.current.clientHeight;

    viewportRef.current.scrollTo({
      left: Math.max(0, rootX - vpW / 2 + (NODE_WIDTH * zoom) / 2),
      top:  Math.max(0, rootY - vpH / 2 + (NODE_HEIGHT * zoom) / 2),
    });
  }, [hasLoadedCanvasStateRef.current, zoom, nodePositions]);

  useEffect(() => {
    if (!hasLoadedCanvasStateRef.current) return;

    const draft: BomCanvasDraft = {
      zoom,
      isRootExpanded,
      expandedNodeIds: Array.from(expandedNodeIds),
      nodePositions: { ...nodePositions },
      canvasMinSize: { ...canvasMinSize },
      hiddenNodeIds: Array.from(hiddenNodeIds),
      nodeDimensions: { ...nodeDimensions },
    };

    // Sync ref terlebih dahulu (selalu)
    canvasStateRef.current = draft;

    // Save ke localStorage (kecuali skip flag aktif)
    if (skipNextCanvasSaveRef.current) {
      skipNextCanvasSaveRef.current = false;
      return;
    }

    safeStorage()?.setItem(canvasStateKey(carId), JSON.stringify(draft));
  }, [zoom, isRootExpanded, expandedNodeIds, nodePositions, canvasMinSize, hiddenNodeIds, nodeDimensions, carId]);

  // Auto-expand dihapus, diganti edge-scroll



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

    const [bomResult, panelsOk] = await Promise.all([
      fetchUnitBom("", carId),
      loadPanels(),
    ]);

    if (bomResult.payload) {
      setWorkspace(bomResult.payload.data);
    } else {
      notifyError("Data BOM belum bisa dimuat ulang.");
    }

    if (!panelsOk) {
      notifyError("Master panel unit belum bisa dimuat.");
    }

    setIsLoading(false);
  }, [carId, loadPanels]);

  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  function handleFullscreenToggle() {
    if (!isFullscreen) {
      sectionRef.current?.requestFullscreen?.().catch(() => {
        setIsFullscreen(true);
      });
    } else {
      if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => { });
      } else {
        setIsFullscreen(false);
      }
    }
  }

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
  const panelTrackerTree = useMemo(
    () => buildPanelTrackerTree(rows, workspace?.tree ?? []),
    [rows, workspace?.tree],
  );
  const selectedNode = selection?.type === "node" ? selection.node : null;
  const selectedNodeId = selectedNode?.nodeId ?? null;
  const canvasFocus = useMemo(
    () => getCanvasFocus(panelTrackerTree, selection, recordsById, showFocusedHidden),
    [panelTrackerTree, recordsById, selection, showFocusedHidden],
  );
  useEffect(() => {
    setShowFocusedHidden(false);
  }, [selectedNodeId]);
  const layout = useMemo(
    () => buildCanvasLayout(panelTrackerTree, expandedNodeIds, isRootExpanded, nodeDimensions, hiddenNodeIds, canvasFocus.visibleNodeIds),
    [canvasFocus.visibleNodeIds, expandedNodeIds, hiddenNodeIds, isRootExpanded, nodeDimensions, panelTrackerTree],
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
      { width: Math.max(layout.width, canvasMinSize.width), height: Math.max(layout.height, canvasMinSize.height) },
    );
  }, [canvasMinSize.height, canvasMinSize.width, layout.height, layout.width, positionedNodes, rootPosition.x, rootPosition.y]);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    for (const row of rows) {
      cats.add(displayCategory(row.category));
    }
    for (const node of panelTrackerTree) {
      cats.add(displayCategory(node.category ?? node.label));
    }
    return Array.from(cats).sort();
  }, [panelTrackerTree, rows]);

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
      notifyError("Master panel unit belum bisa dimuat untuk disimpan.");
      return null;
    }

    setRows(result.payload.data.tree);
    return flattenPanelRecords(result.payload.data.tree);
  }

  const openCreateRoot = useCallback(() => {
    setMode({ type: "create", sectionMode: rows.length > 0 ? "existing" : "new" });
    setForm(emptyForm());


  }, [rows.length]);

  function openCreateCategory() {
    setMode({ type: "create", sectionMode: "new" });
    setForm({ ...emptyForm(), nodeType: "PANEL", nodeTypeName: "Panel" });
    setSelection({ type: "unit" });


  }

  function openCreateSectionFromCategory(category: string) {
    setMode({ type: "create", sectionMode: "new" });
    setForm({ ...emptyForm(), category, nodeType: "PANEL", nodeTypeName: "Panel" });


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


  }

  function openEditCategory(category: string) {
    setMode({ type: "edit-category", category });
    setForm({ ...emptyForm(), category });


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
      notifyError("Kategori tidak memiliki panel atau part yang bisa dihapus.");
      return;
    }

    const confirmed = await confirm({ title: "Hapus Kategori?", description: `Hapus kategori "${category}" beserta ${targets.length} panel/part di dalamnya?`, tone: "error", confirmLabel: "Hapus", cancelLabel: "Batal" });
    if (!confirmed) return;

    setIsSubmitting(true);


    for (const record of targets) {
      const result = await deleteUnitPanel(carId, record.id);
      if (!result.success) {
        notifyError(result.message);
        setIsSubmitting(false);
        return;
      }
    }

    notifySuccess(`Kategori "${category}" berhasil dihapus.`);
    closeForm();
    setSelection({ type: "unit" });
    await refreshWorkspace();
    setIsSubmitting(false);
  }

  function openEditSection(category: string, section: string) {
    setMode({ type: "edit-section", category, section });
    setForm({ ...emptyForm(), category, section });


  }

  function openCreateFromNode(node: UnitBomNode) {
    const parentRecord = node.panelId ? recordsById.get(node.panelId) ?? null : null;
    setMode({ type: "create", sectionMode: "existing", sourceNode: node });
    setForm(parentRecord ? formForChild(parentRecord) : formForNode(node));
    setContextMenu(null);


  }

  function openEdit(record: UnitPanelRecord) {
    setMode({ type: "edit", record });
    setForm(formFromRecord(record));
    setContextMenu(null);


  }

  function closeForm() {
    setMode(null);
    setForm(emptyForm());
    viewportRef.current?.focus();
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
      qty: panel ? String(panel.qty ?? 1) : current.qty,
      defaultLocationType: panel?.defaultLocationType ?? current.defaultLocationType,
      defaultStockStatus: panel?.defaultStockStatus ?? current.defaultStockStatus,
      defaultConditionType: panel?.defaultConditionType ?? current.defaultConditionType,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManagePanels || !mode) {
      return;
    }

    setIsSubmitting(true);


    if (mode.type === "edit-category") {
      const nextCategory = form.category.trim();
      if (!nextCategory) {
        notifyError("Nama kategori wajib diisi.");
        setIsSubmitting(false);
        return;
      }

      const result = await renameUnitPanelCategory(carId, {
        fromCategory: mode.category,
        toCategory: nextCategory,
      });
      if (!result.success) {
        notifyError(result.message);
        setIsSubmitting(false);
        return;
      }

      notifySuccess(`Nama kategori berhasil diperbarui untuk ${result.result.updatedCount} panel/part.`);
      closeForm();
      await refreshWorkspace();
      setIsSubmitting(false);
      return;
    }

    if (mode.type === "edit-section") {
      const nextSection = form.section.trim();
      if (!nextSection) {
        notifyError("Nama section wajib diisi.");
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
        notifyError(`Tidak ada panel atau part pada section "${mode.section}" yang bisa diperbarui.`);
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
        notifyError(failed.message);
        setIsSubmitting(false);
        return;
      }

      notifySuccess("Nama section berhasil diperbarui.");
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
      notifyError("Section dan nama wajib diisi.");
      setIsSubmitting(false);
      return;
    }

    if (
      mode.type === "create" &&
      mode.sectionMode === "existing" &&
      !["panel", "part"].includes(form.nodeTypeName.trim().toLowerCase())
    ) {
      notifyError("Pilih tipe yang valid: Panel atau Part.");
      setIsSubmitting(false);
      return;
    }

    if (mode.type !== "edit" && effectiveForm.nodeType === "PART" && !parentId) {
      notifyError("Pilih panel parent untuk part.");
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
      notifyError(result.message);
      setIsSubmitting(false);
      return;
    }

    notifySuccess(
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
    const confirmed = await confirm({ title: "Hapus?", description: `Hapus ${record.nodeType === "PANEL" ? "panel" : "part"} "${record.name}"?`, tone: "error", confirmLabel: "Hapus", cancelLabel: "Batal" });
    if (!confirmed) return;

    setIsSubmitting(true);


    const result = await deleteUnitPanel(carId, record.id);
    if (!result.success) {
      notifyError(result.message);
      setIsSubmitting(false);
      return;
    }

    notifySuccess(`${record.nodeType === "PANEL" ? "Panel" : "Part"} berhasil dihapus.`);
    await refreshWorkspace();
    setIsSubmitting(false);
  }

  function openMenu(node: UnitBomNode, event: MouseEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    const bounds = sectionRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const menuWidth = 176;
    const menuHeight = 164;
    setSelection({ type: "node", node });
    setContextMenu({
      node,
      x: Math.max(12, Math.min(event.clientX - bounds.left, bounds.width - menuWidth - 12)),
      y: Math.max(12, Math.min(event.clientY - bounds.top, bounds.height - menuHeight - 12)),
    });
  }

  function getSelectionAfterCollapse(node: UnitBomNode): SelectionTarget {
    const path = findNodePath(panelTrackerTree, node.nodeId);
    const categoryNode = path.find((item) => item.nodeType === "CATEGORY") ?? null;
    const sectionNode = path.find((item) => item.nodeType === "SECTION") ?? null;
    const record = node.panelId ? recordsById.get(node.panelId) ?? null : null;

    if (node.nodeType === "CATEGORY") {
      return { type: "unit" };
    }

    if (node.nodeType === "SECTION") {
      return categoryNode ? { type: "node", node: categoryNode } : { type: "unit" };
    }

    if (record?.nodeType === "PANEL") {
      if (sectionNode) return { type: "node", node: sectionNode };
      if (categoryNode) return { type: "node", node: categoryNode };
      return { type: "unit" };
    }

    const parentNode = path.length > 1 ? path[path.length - 2] : null;
    return parentNode ? { type: "node", node: parentNode } : { type: "unit" };
  }

  function getSelectionAfterPartToggle(node: UnitBomNode): SelectionTarget {
    const path = findNodePath(panelTrackerTree, node.nodeId);
    const sectionNode = path.find((item) => item.nodeType === "SECTION") ?? null;
    const categoryNode = path.find((item) => item.nodeType === "CATEGORY") ?? null;

    if (sectionNode) return { type: "node", node: sectionNode };
    if (categoryNode) return { type: "node", node: categoryNode };
    return { type: "unit" };
  }

  function selectCanvasNode(node: UnitBomNode) {
    const record = node.panelId ? recordsById.get(node.panelId) ?? null : null;
    const isSamePart =
      record?.nodeType === "PART" &&
      selection?.type === "node" &&
      selection.node.nodeId === node.nodeId;

    if (isSamePart) {
      setSelection(getSelectionAfterPartToggle(node));
      return;
    }

    setSelection({ type: "node", node });
  }

  function toggleNode(node: UnitBomNode) {
    if (node.children.length === 0) return;

    const isClosing = expandedNodeIds.has(node.nodeId);
    setExpandedNodeIds((current) => {
      const next = new Set(current);
      if (next.has(node.nodeId)) {
        next.delete(node.nodeId);
      } else {
        next.add(node.nodeId);
      }
      return next;
    });
    setSelection(isClosing ? getSelectionAfterCollapse(node) : { type: "node", node });
    setShowFocusedHidden(false);
  }

  function updateNodePosition(
    nodeId: string,
    updater: (current: NodePosition) => NodePosition,
    initialPos?: NodePosition,
  ) {
    setNodePositions((current) => ({
      ...current,
      [nodeId]: updater(current[nodeId] ?? initialPos ?? { x: 32, y: 32 }),
    }));
  }

  function resetCanvasLayout() {
    setZoom(0.92);
    setIsRootExpanded(false);
    setExpandedNodeIds(new Set());
    setNodePositions({});
    setCanvasMinSize({ width: 6000, height: 4000 });
    setHiddenNodeIds(new Set());
    setNodeDimensions({});
    setSelection(null);
    setContextMenu(null);
    draftHistoryRef.current = [];
    setCanUndo(false);
    safeStorage()?.removeItem(canvasStateKey(carId));
  }

  // Called by NodeCard before drag/resize starts — snapshots current canvas state for undo
  const handleInteractionStart = useCallback(() => {
    draftHistoryRef.current = [...draftHistoryRef.current.slice(-19), { ...canvasStateRef.current }];
    setCanUndo(true);
    if (showHint) {
      setShowHint(false);
      safeStorage()?.setItem('bom:canvas:hint-dismissed', '1');
    }
  }, [showHint]);

  function hideNode(nodeId: string) {
    setHiddenNodeIds((current) => {
      const next = new Set(current);
      next.add(nodeId);
      return next;
    });
    if (selection?.type === "node" && selection.node.nodeId === nodeId) {
      setSelection(null);
    }
    setContextMenu(null);
  }

  function updateNodeDimension(nodeId: string, dimension: NodeDimension) {
    setNodeDimensions((current) => ({
      ...current,
      [nodeId]: dimension,
    }));
  }

  function resetNodeDimension(nodeId: string) {
    setNodeDimensions((current) => {
      const { [nodeId]: _removed, ...rest } = current;
      return rest;
    });
    setContextMenu(null);
  }

  function handleRootPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.stopPropagation();
    isDraggingNodeRef.current = true;
    lastCursorRef.current = { clientX: event.clientX, clientY: event.clientY };
    edgeScrollRafRef.current = requestAnimationFrame(runEdgeScroll);
    rootDragRef.current = {
      pointerId: event.pointerId,
      lastClientX: event.clientX,
      lastClientY: event.clientY,
      didDrag: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleRootPointerMove(event: PointerEvent<HTMLDivElement>) {
    lastCursorRef.current = { clientX: event.clientX, clientY: event.clientY };
    const drag = rootDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = (event.clientX - drag.lastClientX) / zoom;
    const dy = (event.clientY - drag.lastClientY) / zoom;
    drag.lastClientX = event.clientX;
    drag.lastClientY = event.clientY;
    if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
      drag.didDrag = true;
    }
    // Gunakan functional updater agar tidak ada stale closure
    setNodePositions((current) => {
      const pos = current[ROOT_NODE_ID] ?? { x: 32, y: 32 };
      return {
        ...current,
        [ROOT_NODE_ID]: { x: pos.x + dx, y: pos.y + dy },
      };
    });
  }

  function handleRootPointerUp(event: PointerEvent<HTMLDivElement>) {
    isDraggingNodeRef.current = false;
    if (edgeScrollRafRef.current !== null) {
      cancelAnimationFrame(edgeScrollRafRef.current);
      edgeScrollRafRef.current = null;
    }
    const drag = rootDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    suppressRootClickRef.current = drag.didDrag;
    rootDragRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
    if (!drag.didDrag) {
      const isClosing = isRootExpanded;
      setSelection(isClosing ? null : { type: "unit" });
      setIsRootExpanded((value) => !value);
      setShowFocusedHidden(false);
    }
    window.setTimeout(() => {
      suppressRootClickRef.current = false;
    }, 0);
  }

  function navigateToDetail(node: UnitBomNode) {
    const detailKey = panelDetailKey(node);
    if (!detailKey) {
      setContextMenu(null);
      return;
    }
    const params = new URLSearchParams({ mode: "workflow" });
    if (isFullscreen) params.set("fullscreen", "true");
    router.push(`/units/${carId}/panels/${detailKey}?${params.toString()}`);
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    if (
      event.target instanceof Element &&
      event.target.closest("[data-canvas-node='true'], [data-canvas-control='true']")
    ) {
      return;
    }

    event.preventDefault();

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

    event.preventDefault();

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
  const isSidePanelOpen = mode !== null;
  const viewportStyle: CSSProperties = isFullscreen
    ? {
        height: "100vh",
        minHeight: "100vh",
        maxHeight: "100vh",
      }
    : {
        height: "calc(100vh - 180px)",
        minHeight: 520,
        maxHeight: "calc(100vh - 180px)",
      };
  const sidePanelStyle = isFullscreen ? { maxHeight: "100vh", minHeight: "100vh" } : undefined;
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
  const sidePanelTitle = drawerTitle;

  function expandAll() {
    const allIds = new Set(getAllNodeIds(panelTrackerTree));
    setExpandedNodeIds(allIds);
    setIsRootExpanded(true);
    setSelection({ type: "unit" });
    setShowFocusedHidden(true);
  }

  function collapseAll() {
    setExpandedNodeIds(new Set());
    setIsRootExpanded(false);
    setSelection(null);
    setShowFocusedHidden(false);
  }

  // [REFACTOR 2] Scroll wheel zoom
  function handleWheel(event: React.WheelEvent<HTMLDivElement>) {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();

    const delta = event.deltaY > 0
      ? -Math.min(0.08, Math.abs(event.deltaY) / 500)
      :  Math.min(0.08, Math.abs(event.deltaY) / 500);

    setZoom((v) => Math.max(0.55, Math.min(1.35, Number((v + delta).toFixed(2)))));
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setContextMenu(null);
        return;
      }

      const isCtrl = event.ctrlKey || event.metaKey;

      if (selectedNode && !isCtrl) {
        if (event.key === 'ArrowRight') {
          const firstChild = positionedNodes.find((n) => n.parentId === selectedNode.nodeId);
          if (firstChild) {
            event.preventDefault();
            setSelection({ type: 'node', node: firstChild.node });
          }
        }
        if (event.key === 'ArrowLeft') {
          const current = nodeById.get(selectedNode.nodeId);
          if (current?.parentId && current.parentId !== ROOT_NODE_ID) {
            const parent = nodeById.get(current.parentId);
            if (parent) {
              event.preventDefault();
              setSelection({ type: 'node', node: parent.node });
            }
          }
        }
        if (event.key === 'Enter') {
          event.preventDefault();
          toggleNode(selectedNode);
        }
      }

      if (isCtrl && event.key === "z" && !event.shiftKey) {
        event.preventDefault();
        undoCanvas();
        return;
      }

      if (isCtrl && event.key === "s") {
        event.preventDefault();
        if (formRef.current) {
          formRef.current.requestSubmit();
        }
        return;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undoCanvas, selectedNode, nodeById, positionedNodes, toggleNode]);

  if (!workspace) {
    return (
      <section className="border border-border bg-card px-4 py-3">
        <p className="text-[15px] uppercase tracking-[0.2em] text-app-accent-ink/70">Katalog Part</p>
        <h2 className="mt-3 text-xl font-light text-foreground">Data BOM belum bisa dimuat</h2>
      </section>
    );
  }

  return (
    <section ref={sectionRef} className={`relative overflow-hidden border border-border bg-card ${isFullscreen ? "fixed inset-0 z-50" : ""}`}>



      <div className={`grid ${isFullscreen ? "min-h-screen" : "min-h-[calc(100vh-180px)]"} ${isSidePanelOpen ? "xl:grid-cols-[minmax(0,1fr)_360px]" : "xl:grid-cols-1"} transition-[grid-template-columns] duration-300 ease-in-out`}>
        <div className="relative min-w-0 border-r border-border bg-background">
          <div data-canvas-control="true" className="absolute left-4 top-4 z-30 flex items-center gap-1 border border-border bg-card/95 p-1 shadow-lg shadow-black/20 backdrop-blur">
            <button
              type="button"
              onClick={() => setZoom((value) => Math.max(0.55, Number((value - 0.05).toFixed(2))))}
              className="flex h-8 w-8 items-center justify-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Zoom out"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <span className="w-12 text-center text-[14px] font-mono text-muted-foreground">{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              onClick={() => setZoom((value) => Math.min(1.35, Number((value + 0.05).toFixed(2))))}
              className="flex h-8 w-8 items-center justify-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Zoom in"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={resetCanvasLayout}
              className="border-l border-border px-2.5 text-[14px] font-mono uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Reset layout canvas"
            >
              Reset
            </button>
            {/* [REFACTOR 4A] Undo button UI */}
            {canUndo ? (
              <button
                type="button"
                onClick={undoCanvas}
                className="border-l border-border px-2.5 text-[14px] font-mono uppercase tracking-[0.08em] text-app-accent-ink/70 transition-colors hover:bg-muted hover:text-app-accent-ink"
                aria-label="Undo perubahan canvas (Ctrl+Z)"
                title="Undo (Ctrl+Z)"
              >
                <Undo2 className="h-3.5 w-3.5" />
              </button>
            ) : null}
            <button
              type="button"
              onClick={fitToView}
              className="border-l border-border px-2.5 text-[14px] font-mono uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="Fit to view / Center all"
              aria-label="Fit semua node ke layar"
            >
              Fit All
            </button>
            <button
              type="button"
              onClick={expandAll}
              className="border-l border-border px-2.5 text-[14px] font-mono uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="Buka semua node"
              aria-label="Expand semua node"
            >
              <ChevronsUpDown className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={collapseAll}
              className="border-l border-border px-2.5 text-[14px] font-mono uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="Tutup semua node"
              aria-label="Collapse semua node"
            >
              <ChevronsDownUp className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={handleFullscreenToggle}
              className="border-l border-border px-2.5 text-[14px] font-mono uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label={isFullscreen ? "Keluar fullscreen" : "Masuk fullscreen"}
            >
              {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </button>
          </div>

          <div data-canvas-control="true" className="absolute right-4 top-4 z-30 flex max-w-[min(780px,calc(100%-2rem))] flex-wrap items-center justify-end gap-2">
            {canvasFocus.label ? (
              <div className="flex h-9 min-w-0 max-w-[460px] items-center gap-2 border border-primary/25 bg-card/95 px-2.5 text-[13px] font-mono text-muted-foreground shadow-lg shadow-black/10 backdrop-blur dark:shadow-black/30">
                <button
                  type="button"
                  onClick={() => setShowFocusedHidden((value) => !value)}
                  className="ml-1 inline-flex h-6 shrink-0 items-center gap-1 border border-border px-2 text-[12px] uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:border-primary/35 hover:text-app-accent-ink"
                  title={showFocusedHidden ? "Kembali ke mode fokus" : "Lihat seluruh tree sementara"}
                >
                  {showFocusedHidden ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  {showFocusedHidden ? "Fokus" : "Lihat Semua"}
                </button>
              </div>
            ) : null}
            {hiddenNodeIds.size > 0 ? (
              <button
                type="button"
                onClick={() => setHiddenNodeIds(new Set())}
                className="inline-flex h-9 items-center gap-1.5 border border-border bg-card/95 px-3 text-[13px] font-mono text-muted-foreground shadow-lg shadow-black/10 backdrop-blur transition-colors hover:border-border hover:text-foreground dark:shadow-black/30"
              >
                <Eye className="h-3.5 w-3.5" />
                Tampilkan Hidden
              </button>
            ) : null}
            <span className="hidden h-9 items-center border border-border bg-card/95 px-3 text-[13px] font-mono text-muted-foreground shadow-lg shadow-black/10 backdrop-blur md:inline-flex dark:shadow-black/30">
              {workspace.summary.totalParts} komponen · {totalPanelRecords} panel · {totalPartRecords} part
            </span>
            <button
              type="button"
              onClick={() => void refreshWorkspace()}
              className="inline-flex h-9 items-center gap-1.5 border border-border bg-card/95 px-3 text-[13px] font-mono text-muted-foreground shadow-lg shadow-black/10 backdrop-blur transition-colors hover:border-border hover:text-foreground disabled:opacity-30 dark:shadow-black/30"
              disabled={isLoading}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>

          {showHint ? (
            <div className="absolute bottom-4 left-4 z-30 flex items-center gap-2 border border-border bg-card/95 px-3 py-2 text-[14px] font-mono text-muted-foreground backdrop-blur transition-opacity duration-300">
              <Grip className="h-3.5 w-3.5 text-muted-foreground" />
              Klik kanan node untuk aksi. Drag node untuk pindah. Drag area kosong untuk pan.
            </div>
          ) : null}



          {panelTrackerTree.length === 0 ? (
            <div className={`flex ${isFullscreen ? "min-h-screen" : "min-h-[calc(100vh-180px)]"} items-center justify-center px-6`}>
              <div className="max-w-sm border border-dashed border-border bg-card px-6 py-8 text-center">
                <Boxes className="mx-auto h-8 w-8 text-app-accent-ink/70" />
                <h3 className="mt-4 text-[15px] font-mono text-foreground">Belum ada master panel</h3>
                <p className="mt-2 text-[15px] text-muted-foreground">Mulai dari satu kategori dan panel utama agar BOM unit bisa divisualkan.</p>
                {canManagePanels ? (
                  <button
                    type="button"
                    onClick={openCreateRoot}
                    className="mt-5 inline-flex items-center gap-2 border border-primary/30 bg-primary/[0.06] px-4 py-2 text-[14px] font-mono uppercase tracking-[0.12em] text-app-accent-ink transition-colors hover:bg-primary/10"
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
              tabIndex={-1}
              role="region"
              aria-label="BOM Canvas — gunakan keyboard Arrow Keys untuk navigasi node, Ctrl+Z untuk undo"
              className="cursor-grab overflow-auto active:cursor-grabbing"
              style={{ ...viewportStyle, touchAction: 'none', overscrollBehavior: 'contain' }}
              onWheel={handleWheel}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onClick={() => setContextMenu(null)}
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
                <CanvasEdges
                  positionedNodes={positionedNodes}
                  nodeById={nodeById}
                  rootPosition={rootPosition}
                  activeEdgeKeys={canvasFocus.activeEdgeKeys}
                />

                <div
                  data-canvas-node="true"
                  className="absolute"
                  style={{ left: rootPosition.x, top: rootPosition.y, width: NODE_WIDTH, height: NODE_HEIGHT }}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    const bounds = sectionRef.current?.getBoundingClientRect();
                    if (!bounds) return;
                    setSelection({ type: "unit" });
                    setContextMenu({
                      node: {
                        nodeId: ROOT_NODE_ID,
                        nodeType: "CATEGORY",
                        label: rootLabel,
                        category: null,
                        section: null,
                        panelId: null,
                        physicalStatus: null,
                        divisionId: null,
                        divisionName: null,
                        progressPercent: averageProgress(panelTrackerTree),
                        remainingHours: sumRemainingHours(panelTrackerTree),
                        actualId: null,
                        logisticStatus: null,
                        logisticReference: null,
                        logisticPath: null,
                        children: panelTrackerTree,
                      } as UnitBomNode,
                      x: Math.max(12, Math.min(event.clientX - bounds.left, bounds.width - 220)),
                      y: Math.max(12, Math.min(event.clientY - bounds.top, bounds.height - 200)),
                    });
                  }}
                  onPointerDown={handleRootPointerDown}
                  onPointerMove={handleRootPointerMove}
                  onPointerUp={handleRootPointerUp}
                  onPointerCancel={handleRootPointerUp}
                >
                  <button
                    type="button"
                    title={`Klik kanan untuk aksi · ${rootLabel}`}
                    onClick={() => {
                      if (suppressRootClickRef.current) return;
                    }}
                    className={`h-full w-full border bg-primary/10 p-3 text-left shadow-lg shadow-black/25 transition-[border-color,background-color,transform] hover:-translate-y-0.5 hover:border-primary/50 hover:bg-primary/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500/70 ${selection?.type === "unit" ? "border-primary/70" : "border-primary/25"
                      }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center border border-primary/25 text-app-accent-ink">
                            {isRootExpanded ? <ChevronDown className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                          </span>
                          <span className="h-2 w-2 shrink-0 bg-primary shadow-[0_0_16px_rgba(245,158,11,0.45)]" />
                          <p className="truncate text-[14px] font-mono text-foreground/90">{rootLabel}</p>
                        </div>
                        <p className="mt-1 truncate text-[14px] text-muted-foreground">Root unit workspace</p>
                      </div>
                      <span className="shrink-0 border border-primary/25 px-1.5 py-0.5 text-[15px] font-mono uppercase text-app-accent-ink">
                        UNIT
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 border border-primary/25 bg-primary/[0.07] px-2 py-0.5 text-[15px] font-mono uppercase tracking-[0.1em] text-app-accent-ink">
                        <GitBranch className="h-3 w-3" />
                        {panelTrackerTree.length} kategori
                      </span>
                    </div>
                    <p className="mt-3 text-[14px] font-mono text-muted-foreground">
                      {isRootExpanded ? "Klik kategori untuk buka section" : "Klik untuk buka tree"}
                    </p>
                  </button>
                </div>

                {positionedNodes.map((item) => (
                  <NodeCard
                    key={item.node.nodeId}
                    canvasNode={item}
                    zoom={zoom}
                    panelRecord={item.node.panelId ? recordsById.get(item.node.panelId) ?? null : null}
                    isExpanded={expandedNodeIds.has(item.node.nodeId)}
                    isSelected={selection?.type === "node" && selection.node.nodeId === item.node.nodeId}
                    onInteractionStart={handleInteractionStart}
                    onPositionChange={(nodeId, updater, initialPos) =>
                      updateNodePosition(nodeId, updater, initialPos)
                    }
                    onDimensionChange={updateNodeDimension}
                    onOpenMenu={openMenu}
                    onToggle={toggleNode}
                    onSelect={selectCanvasNode}
                    onDragNodeStart={onNodeDragStart}
                    onDragNodeMove={onNodeDragMove}
                    onDragNodeEnd={onNodeDragEnd}
                    onNavigateToDetail={navigateToDetail}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {contextMenu ? (
          <div
            ref={contextMenuRef}
            data-canvas-control="true"
            className="absolute z-40 min-w-52 border border-border bg-card p-1 shadow-2xl shadow-black/10 dark:shadow-black/40"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const n = contextMenu.node;
              const isRootMenu = n.nodeId === ROOT_NODE_ID;
              const ctxRecord = n.panelId ? recordsById.get(n.panelId) ?? null : null;
              const ctxDetailKey = panelDetailKey(n);
              const isExpanded = expandedNodeIds.has(n.nodeId);

              return (
                <>
                  <div className="border-b border-border px-3 py-2">
                    <p className="text-[15px] font-mono uppercase tracking-[0.12em] text-muted-foreground">{isRootMenu ? "UNIT" : n.nodeType}</p>
                    <p className="truncate text-[14px] font-mono font-medium text-foreground">{n.label}</p>
                  </div>

                  {isRootMenu ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          if (isRootExpanded) {
                            collapseAll();
                          } else {
                            expandAll();
                          }
                          setContextMenu(null);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[15px] font-mono text-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        {isRootExpanded ? <ChevronsDownUp className="h-3.5 w-3.5" /> : <ChevronsUpDown className="h-3.5 w-3.5" />}
                        {isRootExpanded ? "Tutup semua" : "Buka semua"}
                      </button>
                      {canManagePanels ? (
                        <button
                          type="button"
                          onClick={() => {
                            openCreateCategory();
                            setContextMenu(null);
                          }}
                          className="flex w-full items-center gap-2 border-t border-border px-3 py-2 text-left text-[15px] font-mono text-app-accent-ink/80 hover:bg-primary/10 hover:text-app-accent-ink"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Tambah kategori baru
                        </button>
                      ) : null}
                    </>
                  ) : null}

                  {!isRootMenu && n.children.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        toggleNode(n);
                        setContextMenu(null);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-[15px] font-mono text-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                      {isExpanded ? "Tutup turunan" : "Buka turunan"}
                    </button>
                  ) : null}

                  {!isRootMenu && n.nodeType === "CATEGORY" && canManagePanels && n.category ? (
                    <>
                      <div className="border-t border-border" />
                      <button type="button" onClick={() => { openEditCategory(n.category ?? ""); setContextMenu(null); }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[15px] font-mono text-foreground hover:bg-muted hover:text-foreground">
                        <Pencil className="h-3.5 w-3.5" /> Edit nama kategori
                      </button>
                      <button type="button" onClick={() => { openCreateSectionFromCategory(n.category ?? ""); setContextMenu(null); }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[15px] font-mono text-app-accent-ink/80 hover:bg-primary/10 hover:text-app-accent-ink">
                        <Plus className="h-3.5 w-3.5" /> Tambah section baru
                      </button>
                      <button type="button" onClick={() => { void handleDeleteCategory(displayCategory(n.category)); setContextMenu(null); }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[15px] font-mono text-destructive/70 hover:bg-destructive/10 hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" /> Hapus kategori
                      </button>
                    </>
                  ) : null}

                  {!isRootMenu && n.nodeType === "SECTION" && canManagePanels && n.category && n.section ? (
                    <>
                      <div className="border-t border-border" />
                      <button type="button" onClick={() => { openEditSection(n.category ?? "", n.section ?? ""); setContextMenu(null); }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[15px] font-mono text-foreground hover:bg-muted hover:text-foreground">
                        <Pencil className="h-3.5 w-3.5" /> Edit nama section
                      </button>
                      <button type="button" onClick={() => { openCreatePanelFromSection(n); setContextMenu(null); }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[15px] font-mono text-app-accent-ink/80 hover:bg-primary/10 hover:text-app-accent-ink">
                        <Plus className="h-3.5 w-3.5" /> Tambah panel di section ini
                      </button>
                    </>
                  ) : null}

                  {!isRootMenu && ctxRecord && canManagePanels ? (
                    <>
                      <div className="border-t border-border" />
                      <button type="button" onClick={() => { openEdit(ctxRecord); setContextMenu(null); }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[15px] font-mono text-foreground hover:bg-muted hover:text-foreground">
                        <Pencil className="h-3.5 w-3.5" /> Edit {ctxRecord.nodeType === "PANEL" ? "panel" : "part"}
                      </button>
                      {ctxRecord.nodeType === "PANEL" ? (
                        <button type="button" onClick={() => { openCreateFromNode(n); setContextMenu(null); }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-[15px] font-mono text-app-accent-ink/80 hover:bg-primary/10 hover:text-app-accent-ink">
                          <Plus className="h-3.5 w-3.5" /> Tambah part
                        </button>
                      ) : null}
                      <button type="button" onClick={() => { void handleDelete(ctxRecord); setContextMenu(null); }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[15px] font-mono text-destructive/70 hover:bg-destructive/10 hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" /> Hapus {ctxRecord.nodeType === "PANEL" ? "panel" : "part"}
                      </button>
                    </>
                  ) : null}

                  {!isRootMenu && ctxDetailKey ? (
                    <>
                      <div className="border-t border-border" />
                      <button type="button" onClick={() => { navigateToDetail(n); setContextMenu(null); }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[15px] font-mono text-foreground hover:bg-muted hover:text-foreground">
                        <FolderOpen className="h-3.5 w-3.5" /> Buka detail workflow
                      </button>
                    </>
                  ) : null}

                  {!isRootMenu ? (
                    <>
                      <div className="border-t border-border" />
                      <button type="button" onClick={() => { hideNode(n.nodeId); setContextMenu(null); }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[15px] font-mono text-muted-foreground hover:bg-muted hover:text-foreground">
                        <EyeOff className="h-3.5 w-3.5" /> Sembunyikan node
                      </button>
                    </>
                  ) : null}
                  {!isRootMenu && nodeDimensions[n.nodeId] ? (
                    <button
                      type="button"
                      onClick={() => resetNodeDimension(n.nodeId)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-[15px] font-mono text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Reset ukuran node
                    </button>
                  ) : null}
                </>
              );
            })()}
          </div>
        ) : null}

        {isSidePanelOpen ? (
          <aside className="bg-card">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-2">
                <Boxes className="h-3.5 w-3.5 text-app-accent-ink" />
                <span className="text-[14px] font-mono uppercase tracking-[0.12em] text-muted-foreground">{sidePanelTitle}</span>
              </div>
              <button
                type="button"
                onClick={closeForm}
                className="flex h-8 w-8 items-center justify-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Tutup panel"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="overflow-auto px-4 py-4" style={sidePanelStyle}>
              {mode.type === "edit-category" ? (
                <form className="space-y-3" onSubmit={(event) => void handleSubmit(event)}>
                  <label className="block space-y-1">
                    <span className="text-[14px] font-mono uppercase tracking-[0.12em] text-muted-foreground">Nama Kategori</span>
                    <input
                      value={form.category}
                      onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
                      className="h-9 w-full border border-border bg-card px-3 text-[15px] font-mono text-foreground outline-none transition-colors focus:border-primary/40"
                      autoFocus
                    />
                  </label>
                  <p className="border border-border bg-card px-3 py-2 text-[14px] text-muted-foreground">
                    Semua panel dan part di kategori ini akan ikut memakai nama kategori baru.
                  </p>
                  <div className="flex gap-2 pt-1">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="border border-primary/40 bg-primary/[0.06] px-3 py-2 text-[14px] font-mono uppercase tracking-[0.12em] text-app-accent-ink transition-colors hover:bg-primary/10 disabled:opacity-30"
                    >
                      {isSubmitting ? "Menyimpan..." : "Simpan"}
                    </button>
                    <button
                      type="button"
                      onClick={closeForm}
                      className="border border-border px-3 py-2 text-[14px] font-mono uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-foreground"
                    >
                      Batal
                    </button>
                  </div>
                </form>
              ) : mode.type === "edit-section" ? (
                <form className="space-y-3" onSubmit={(event) => void handleSubmit(event)}>
                  <label className="block space-y-1">
                    <span className="text-[14px] font-mono uppercase tracking-[0.12em] text-muted-foreground">Nama Section</span>
                    <input
                      value={form.section}
                      onChange={(event) => setForm((current) => ({ ...current, section: event.target.value }))}
                      className="h-9 w-full border border-border bg-card px-3 text-[15px] font-mono text-foreground outline-none transition-colors focus:border-primary/40"
                      autoFocus
                    />
                  </label>
                  <p className="border border-border bg-card px-3 py-2 text-[14px] text-muted-foreground">
                    Semua panel dan part di section ini akan ikut memakai nama section baru.
                  </p>
                  <div className="flex gap-2 pt-1">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="border border-primary/40 bg-primary/[0.06] px-3 py-2 text-[14px] font-mono uppercase tracking-[0.12em] text-app-accent-ink transition-colors hover:bg-primary/10 disabled:opacity-30"
                    >
                      {isSubmitting ? "Menyimpan..." : "Simpan"}
                    </button>
                    <button
                      type="button"
                      onClick={closeForm}
                      className="border border-border px-3 py-2 text-[14px] font-mono uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-foreground"
                    >
                      Batal
                    </button>
                  </div>
                </form>
              ) : (
                <form className="space-y-3" onSubmit={(event) => void handleSubmit(event)}>
                  {mode.type === "create" && mode.sectionMode === "existing" ? (
                    <div className="space-y-1">
                      <span className="text-[14px] font-mono uppercase tracking-[0.12em] text-muted-foreground">Buat</span>
                      <div className="grid grid-cols-2 gap-1 border border-border bg-card p-1">
                        <button
                          type="button"
                          onClick={() => selectNodeType("Panel")}
                          className={`px-2 py-1.5 text-[14px] font-mono uppercase tracking-[0.12em] transition-colors ${form.nodeType === "PANEL"
                            ? "bg-primary/[0.08] text-app-accent-ink"
                            : "text-muted-foreground hover:text-foreground"
                            }`}
                        >
                          Panel
                        </button>
                        <button
                          type="button"
                          onClick={() => selectNodeType("Part")}
                          className={`px-2 py-1.5 text-[14px] font-mono uppercase tracking-[0.12em] transition-colors ${form.nodeType === "PART"
                            ? "bg-primary/[0.08] text-app-accent-ink"
                            : "text-muted-foreground hover:text-foreground"
                            }`}
                        >
                          Part
                        </button>
                      </div>
                    </div>
                  ) : null}

                  <label className="block space-y-1">
                    <span className="text-[14px] font-mono uppercase tracking-[0.12em] text-muted-foreground">Kategori</span>
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
                    <span className="text-[14px] font-mono uppercase tracking-[0.12em] text-muted-foreground">Section</span>
                    {mode.type === "create" && mode.sectionMode === "new" ? (
                      <input
                        value={form.section}
                        onChange={(event) => setForm((current) => ({ ...current, section: event.target.value }))}
                        placeholder="Nama section baru"
                        className="h-9 w-full border border-border bg-card px-3 text-[15px] font-mono text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/40"
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
                      <span className="text-[14px] font-mono uppercase tracking-[0.12em] text-muted-foreground">Panel Parent</span>
                      <SearchableField
                        value={parentPanelValue}
                        options={parentPanelOptions}
                        onChange={selectParentPanel}
                        placeholder={form.section ? "Pilih panel parent" : "Pilih section dulu"}
                        disabled={!form.section}
                      />
                    </label>
                  ) : null}

                    {mode.type === "edit" && mode.record.nodeType === "PART" && selectedParentPanel ? (
                      <div className="border border-primary/20 bg-primary/[0.04] px-3 py-2 text-[14px] font-mono text-app-accent-ink">
                        Parent: {selectedParentPanel.name}
                      </div>
                    ) : null}

                    <label className="block space-y-1">
                      <span className="text-[14px] font-mono uppercase tracking-[0.12em] text-muted-foreground">
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
                        className="h-9 w-full border border-border bg-card px-3 text-[15px] font-mono text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/40"
                      />
                    </label>

                  <label className="flex items-center gap-3 border border-border bg-card px-3 py-2">
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
                      className="h-4 w-4 border-border bg-transparent"
                    />
                    <span className="text-[14px] font-mono text-muted-foreground">Aktifkan {form.nodeType === "PART" ? "part" : "panel"} ini</span>
                  </label>

                  <div className="grid grid-cols-2 gap-2">
                    <label className="block space-y-1">
                      <span className="text-[14px] font-mono uppercase tracking-[0.12em] text-muted-foreground">Qty</span>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={form.qty}
                        onChange={(event) => setForm((current) => ({ ...current, qty: event.target.value }))}
                        className="h-9 w-full border border-border bg-card px-3 text-[15px] font-mono text-foreground outline-none transition-colors focus:border-primary/40"
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="text-[14px] font-mono uppercase tracking-[0.12em] text-muted-foreground">Lokasi</span>
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
                        className="h-9 w-full border border-border bg-card px-2 text-[14px] font-mono text-foreground outline-none transition-colors focus:border-primary/40 dark:[color-scheme:dark]"
                      >
                        <option value="UNIT">{LOCATION_LABEL.UNIT}</option>
                        <option value="WORKSHOP">{LOCATION_LABEL.WORKSHOP}</option>
                        <option value="GUDANG">{LOCATION_LABEL.GUDANG}</option>
                      </select>
                    </label>
                    <label className="block space-y-1">
                      <span className="text-[14px] font-mono uppercase tracking-[0.12em] text-muted-foreground">Posisi</span>
                      <select
                        value={form.defaultStockStatus}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            defaultStockStatus: event.target.value as PanelFormState["defaultStockStatus"],
                          }))
                        }
                        disabled={form.defaultLocationType === "UNIT"}
                        className="h-9 w-full border border-border bg-card px-2 text-[14px] font-mono text-foreground outline-none transition-colors focus:border-primary/40 disabled:cursor-not-allowed disabled:text-muted-foreground dark:[color-scheme:dark]"
                      >
                        <option value="INSTALLED">{STOCK_STATUS_LABEL.INSTALLED}</option>
                        <option value="IN_STORAGE">{STOCK_STATUS_LABEL.IN_STORAGE}</option>
                        <option value="RETRIEVED">{STOCK_STATUS_LABEL.RETRIEVED}</option>
                        <option value="LOST">{STOCK_STATUS_LABEL.LOST}</option>
                      </select>
                    </label>
                    <label className="block space-y-1">
                      <span className="text-[14px] font-mono uppercase tracking-[0.12em] text-muted-foreground">Kondisi Barang</span>
                      <select
                        value={form.defaultConditionType}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            defaultConditionType: event.target.value as PanelFormState["defaultConditionType"],
                          }))
                        }
                        className="h-9 w-full border border-border bg-card px-2 text-[14px] font-mono text-foreground outline-none transition-colors focus:border-primary/40 dark:[color-scheme:dark]"
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
                      className="border border-primary/40 bg-primary/[0.06] px-3 py-2 text-[14px] font-mono uppercase tracking-[0.12em] text-app-accent-ink transition-colors hover:bg-primary/10 disabled:opacity-30"
                    >
                      {isSubmitting ? "Menyimpan..." : "Simpan"}
                    </button>
                    <button
                      type="button"
                      onClick={closeForm}
                      className="border border-border px-3 py-2 text-[14px] font-mono uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-foreground"
                    >
                      Batal
                    </button>
                  </div>
                </form>
              )}
            </div>

            <div className="border-t border-border px-4 py-3 text-[14px] font-mono text-muted-foreground">
              Foto: {canManagePhotos ? "manage" : "read"} / download {canDownloadPhotos ? "aktif" : "nonaktif"}
            </div>
          </aside>
        ) : null}
      </div>
      {alertElement}
    </section>
  );
}
