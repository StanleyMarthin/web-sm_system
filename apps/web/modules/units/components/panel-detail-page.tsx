"use client";

import type {
  UnitBomDocument,
  UnitBomNode,
  UnitBomPhotoSlot,
  UnitBomPhotoSlotSummary,
  UnitBomTimelineItem,
} from "@smsystem/contracts/unit-bom";
import type { GalleryPhotoRecord, GalleryPhotoType } from "@smsystem/contracts/gallery";
import {
  Archive,
  ArrowLeft,
  Building2,
  Camera,
  CheckCircle2,
  ClipboardList,
  Download,
  Eye,
  FileText,
  FolderOpen,
  Lock,
  MapPin,
  Maximize2,
  PackageCheck,
  PackageSearch,
  Pencil,
  Plus,
  Save,
  ShoppingCart,
  Minimize2,
  Package,
  Trash2,
  TrendingUp,
  Truck,
  Upload,
  Wrench,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
import {
  addEdge,
  Background,
  ConnectionMode,
  Handle,
  NodeResizeControl,
  Position,
  ReactFlow,
  ResizeControlVariant,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type OnNodeDrag,
  type NodeMouseHandler,
  type NodeProps,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { getProxiedImageUrl } from "@/shared/api/config";
import { GalleryUploadForm, type UploadFormValues } from "@/modules/gallery/components/forms/gallery-upload-form";
import { GalleryPhotoEditForm, type EditFormValues } from "@/modules/gallery/components/forms/gallery-photo-edit-form";
import {
  createGalleryPhoto,
  deleteGalleryPhoto,
  fetchGalleryPhotos,
  requestGalleryUploadTicket,
  updateGalleryPhoto,
} from "@/shared/api/gallery";
import { fetchCountdownBoard } from "@/shared/api/countdown";
import {
  fetchWorkflowLayout,
  saveWorkflowLayout,
} from "@/shared/api/units";
import { fmtDateTime } from "@/shared/format/humanize";
import { useSweetAlert } from "@/shared/ui/sweet-alert";
import { WorkflowJobCreateForm } from "@/modules/workflow-job/components/workflow-job-create-form";
import type {
  CreatedWorkflowJob,
  WorkflowCreateType,
  WorkflowJobCreateContext,
} from "@/modules/workflow-job/workflow-job-create";

type DrawerTab = "timeline" | "photos" | "documents";
type TriageTone = "good" | "repair" | "replace" | "unknown";

interface PanelDetailPageProps {
  carId: string;
  node: UnitBomNode;
  canManagePhotos: boolean;
  canDownloadPhotos: boolean;
  allowedWorkflowCreateTypes: WorkflowCreateType[];
  canSaveWorkflowCanvas: boolean;
}

interface TimelineItem {
  eventType?: UnitBomTimelineItem["eventType"];
  title: string;
  detail: string;
  date: string | null;
  icon: typeof Truck;
  tone: string;
}

interface PhotoSlot {
  slot: UnitBomPhotoSlot;
  label: string;
  caption: string;
  icon: typeof Camera;
  photoCount: number;
  latestPhotoUrl: string | null;
  latestPhotoAt: string | null;
  photos: GalleryPhotoRecord[];
}

interface DocumentCard {
  title: string;
  detail: string;
  icon: typeof FileText;
  tone: string;
}

interface GalleryPhotoState {
  actualId: string | null;
  photos: GalleryPhotoRecord[];
  isLoading: boolean;
  error: string | null;
  submittedToLedger: boolean;
}

function triageMeta(node: UnitBomNode | null): { label: string; tone: TriageTone; className: string } {
  if (!node) {
    return { label: "Belum Ada Data", tone: "unknown", className: "border-border text-muted-foreground" };
  }

  if (node.physicalStatus === "INSTALLED" || node.logisticStatus === "READY_GUDANG") {
    return { label: "BAGUS", tone: "good", className: "border-success/20 bg-success/[0.04] text-success" };
  }

  if (node.physicalStatus === "IN_DIVISION" || node.logisticStatus === "AT_VENDOR") {
    return { label: "REPAIR", tone: "repair", className: "border-primary/30 bg-primary/[0.04] text-app-accent-ink" };
  }

  if (node.physicalStatus === "DISASSEMBLED" || node.logisticStatus === "ORDER_PR") {
    return { label: "REPLACE", tone: "replace", className: "border-destructive/20 bg-destructive/[0.04] text-destructive" };
  }

  return { label: "PERLU CEK", tone: "unknown", className: "border-border text-muted-foreground" };
}

function workStatusLabel(node: UnitBomNode): string {
  if (node.physicalStatus === "INSTALLED") return "Siap Dipasang";
  if (node.physicalStatus === "IN_DIVISION") return "Sedang Dikerjakan";
  if (node.physicalStatus === "DISASSEMBLED") return "Menunggu Tindak Lanjut";
  return "Belum Dicek";
}

function hierarchyLabel(node: UnitBomNode): string {
  const parts = [node.category, node.section].filter(Boolean);
  if (parts.length === 0) return "Kategori belum tercatat";
  return `Kategori: ${parts.join(" > ")}`;
}

function buildTimeline(node: UnitBomNode): TimelineItem[] {
  const items: TimelineItem[] = [];

  if (node.detail?.timeline.length) {
    items.push(
      ...node.detail.timeline.map((item) => {
        const rawItem: TimelineItem = {
          eventType: item.eventType,
          title: item.title,
          detail: item.description,
          date: formatShortDate(item.occurredAt),
          icon: timelineIcon(item.eventType),
          tone: timelineTone(item.eventType),
        };
        return normalizeTimelineItem(rawItem, node);
      })
    );
  } else {
    const divisionName = node.divisionName ?? "Divisi terkait";
    items.push({
      title: "Pendataan awal",
      detail: `Didata untuk ${divisionName}`,
      date: "-",
      icon: Truck,
      tone: "border-info/30 bg-info/10 text-info",
    });
    if (node.physicalStatus === "INSTALLED") {
      items.push({
        title: "Pemeriksaan akhir",
        detail: `Progress terakhir ${Math.round(node.progressPercent ?? 0)}%`,
        date: "-",
        icon: CheckCircle2,
        tone: "border-success/30 bg-success/10 text-success",
      });
    }
  }

  // Include WOV from documents into timeline (WO/WOV belongs to history)
  if (node.detail?.documents.length) {
    const wovDocs = node.detail.documents.filter(d => d.documentType === "WOV");
    for (const doc of wovDocs) {
      items.push({
        title: doc.title,
        detail: doc.description,
        date: "-",
        icon: Wrench,
        tone: "border-info/30 bg-info/10 text-info",
      });
    }
  }

  // Handle AT_VENDOR as WO Vendor in timeline
  if (!node.detail?.documents.length && node.logisticStatus === "AT_VENDOR") {
    items.push({
      title: "WO Vendor",
      detail: node.logisticReference ?? "Sedang dikerjakan di Vendor",
      date: "-",
      icon: Wrench,
      tone: "border-info/30 bg-info/10 text-info",
    });
  }

  return items;
}

function normalizeTimelineItem(item: TimelineItem, node: UnitBomNode): TimelineItem {
  if (item.eventType === "HANDOVER" || item.title.toLowerCase().includes("pendataan")) {
    return item;
  }

  const title = deriveTimelineJobTitle(item, node);
  const detail = stripTimelinePanelText(item.detail, title, node);
  return {
    ...item,
    title,
    detail,
  };
}

function stripTimelinePanelText(detail: string, jobTitle: string, node: UnitBomNode): string {
  let next = detail.trim();
  for (const value of [jobTitle, node.label].filter(Boolean)) {
    next = next.replace(new RegExp(`\\b${escapeRegExp(value)}\\b`, "giu"), " ");
  }
  next = next
    .replace(/\s+-\s+/gu, " - ")
    .replace(/^\s*[-–:]+\s*/u, "")
    .replace(/\s+/gu, " ")
    .trim();
  return next || detail;
}

function timelineFlowId(item: TimelineItem, index: number): string {
  return `timeline-${index}-${item.eventType ?? "event"}`;
}

function buildDocuments(node: UnitBomNode): DocumentCard[] {
  const cards: DocumentCard[] = [];

  if (node.detail?.documents.length) {
    cards.push(
      ...node.detail.documents
        .filter((d) => d.documentType !== "WOV") // WOV moved to timeline
        .map(mapDocumentCard)
    );
  } else {
    if (node.logisticStatus === "ORDER_PR") {
      cards.push({
        title: "PR Logistik",
        detail: node.logisticReference ?? "Menunggu kedatangan parts",
        icon: ShoppingCart,
        tone: "border-primary/20 bg-primary/[0.08] text-app-accent-ink",
      });
    }

    if (node.logisticStatus === "CANNIBALIZED") {
      cards.push({
        title: "Pemakaian Sementara",
        detail: node.logisticReference ?? "Part dipakai sementara untuk kebutuhan unit lain",
        icon: PackageSearch,
        tone: "border-rose-400/20 bg-rose-400/[0.08] text-rose-300",
      });
    }
  }

  // Mock data for materials/tools usage
  cards.push({
    title: "Pemakaian Bahan & Alat",
    detail: "Data konsumsi bahan dan alat yang digunakan (Hardener, Dempul, dll)",
    icon: Archive,
    tone: "border-success/20 bg-success/[0.08] text-success",
  });

  return cards;
}

const basePhotoSlots: Array<Pick<PhotoSlot, "slot" | "label" | "caption" | "icon">> = [
  { slot: "BEFORE", label: "Before", caption: "Kondisi awal / triage", icon: Camera },
  { slot: "EVIDENCE", label: "Evidence", caption: "Proses pengerjaan", icon: ClipboardList },
  { slot: "AFTER", label: "After", caption: "Hasil akhir / QC", icon: PackageCheck },
];

const tabs: Array<{ id: DrawerTab; label: string }> = [
  { id: "timeline", label: "Timeline" },
  { id: "photos", label: "Galeri Bukti" },
  { id: "documents", label: "Logistik" },
];

function Badge({ children, className }: { children: ReactNode; className: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 border px-2 py-0.5 font-mono text-[14px] uppercase tracking-[0.08em] ${className}`}>
      {children}
    </span>
  );
}

function formatShortDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short" }).format(date);
}

function humanizePhotoType(photoType: GalleryPhotoType): string {
  switch (photoType) {
    case "BEFORE":
      return "Sebelum";
    case "AFTER":
      return "Sesudah";
    case "DEFECT":
      return "Temuan";
    default:
      return "Proses";
  }
}

function proxiedPhotoUrl(photoUrl: string): string {
  return getProxiedImageUrl(photoUrl) ?? photoUrl;
}

function buildDownloadFileName(partName: string, photo: GalleryPhotoRecord, index?: number): string {
  const originalName = decodeURIComponent(photo.photoUrl.split("/").pop() ?? "foto.jpg");
  const extension = originalName.includes(".") ? originalName.split(".").pop() : "jpg";
  const safePart = partName.replace(/[^\w\- ]/gu, "_").trim() || "part";
  const fileName = `${safePart}_${photo.photoType.toLowerCase()}.${extension}`;
  return typeof index === "number" && index > 0 ? `${index}_${fileName}` : fileName;
}

async function downloadUrl(url: string, fileName: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("DOWNLOAD_FAILED");
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(objectUrl);
}

function timelineIcon(eventType: UnitBomTimelineItem["eventType"]) {
  if (eventType === "HANDOVER") return Truck;
  if (eventType === "QC") return CheckCircle2;
  return Wrench;
}

function timelineTone(eventType: UnitBomTimelineItem["eventType"]) {
  if (eventType === "HANDOVER") return "border-info/30 bg-info/10 text-info";
  if (eventType === "QC") return "border-success/30 bg-success/10 text-success";
  return "border-primary/30 bg-primary/10 text-app-accent-ink";
}

function mapDocumentCard(document: UnitBomDocument): DocumentCard {
  const iconMap: Record<UnitBomDocument["documentType"], typeof FileText> = {
    PR: ShoppingCart,
    WOV: Wrench,
    STOCK: PackageCheck,
    TRANSFER: PackageSearch,
  };
  const toneMap: Record<UnitBomDocument["documentType"], string> = {
    PR: "border-primary/20 bg-primary/[0.08] text-app-accent-ink",
    WOV: "border-info/20 bg-info/[0.08] text-info",
    STOCK: "border-success/20 bg-success/[0.08] text-success",
    TRANSFER: "border-rose-400/20 bg-rose-400/[0.08] text-rose-300",
  };

  return {
    title: document.title,
    detail: document.description,
    icon: iconMap[document.documentType],
    tone: toneMap[document.documentType],
  };
}

function buildPhotoSlots(apiSlots: UnitBomPhotoSlotSummary[] | undefined): PhotoSlot[] {
  const bySlot = new Map<UnitBomPhotoSlot, UnitBomPhotoSlotSummary>();
  for (const slot of apiSlots ?? []) {
    bySlot.set(slot.slot, slot);
  }

  return basePhotoSlots.map((slot) => {
    const apiSlot = bySlot.get(slot.slot);
    return {
      ...slot,
      label: apiSlot?.label ?? slot.label,
      photoCount: apiSlot?.photoCount ?? 0,
      latestPhotoUrl: apiSlot?.latestPhotoUrl ?? null,
      latestPhotoAt: apiSlot?.latestPhotoAt ?? null,
      photos: [],
    };
  });
}

function photoMatchesSlot(photo: GalleryPhotoRecord, slot: UnitBomPhotoSlot): boolean {
  if (slot === "BEFORE") return photo.photoType === "BEFORE";
  if (slot === "AFTER") return photo.photoType === "AFTER";
  return photo.photoType === "PROCESS" || photo.photoType === "DEFECT";
}

function mergeGalleryPhotos(slots: PhotoSlot[], photos: GalleryPhotoRecord[]): PhotoSlot[] {
  if (photos.length === 0) return slots;

  return slots.map((slot) => {
    const slotPhotos = photos.filter((photo) => photoMatchesSlot(photo, slot.slot));
    const latest = slotPhotos[0] ?? null;
    return {
      ...slot,
      photoCount: slotPhotos.length,
      latestPhotoUrl: latest?.photoUrl ?? slot.latestPhotoUrl,
      latestPhotoAt: latest?.uploadedAt ?? slot.latestPhotoAt,
      photos: slotPhotos,
    };
  });
}

type WorkflowNodeType = "handover" | "job" | "doc" | "wov";
interface WorkflowNode {
  [key: string]: unknown;
  id: string;
  type: WorkflowNodeType;
  typeLabel: string;
  title: string;
  meta: string;
  badge: string;
  status: "done" | "progress" | "plan" | "open";
  statusLabel: string;
  detail?: string;
  divisionLabel?: string | null;
  sourceLabel?: string;
  hourLabel?: string | null;
  progressLabel?: string | null;
  hasPhotos?: boolean;
  hasMaterials?: boolean;
  isEnd?: boolean;
}

interface WorkflowDivisionOption {
  value: string;
  label: string;
  parentId?: number | null;
  parentName?: string | null;
  parentCode?: string | null;
  divisionId?: number | null;
  divisionName?: string | null;
  divisionParentId?: number | null;
}

interface WorkflowCountdownReferences {
  divisions: WorkflowDivisionOption[];
  sections: WorkflowDivisionOption[];
  jobTypes: WorkflowDivisionOption[];
}

interface JobDescEditForm {
  title: string;
  meta: string;
}

function isJobDescMutable(source: WorkflowNode): boolean {
  const isManuallyCreated = source.id.startsWith("manual-");
  const isUnstarted = source.status === "plan" || source.status === "open";
  return isManuallyCreated && isUnstarted;
}

function buildWorkflowSources(node: UnitBomNode): WorkflowNode[] {
  const progressPercent = Math.round(node.progressPercent ?? 0);
  const progressLabel = `${progressPercent}%`;
  const divisionLabel = node.divisionName ?? null;
  const timeline = node.detail?.timeline.length
    ? node.detail.timeline.map((item) => {
        const rawItem: TimelineItem = {
          eventType: item.eventType,
          title: item.title,
          detail: item.description,
          date: formatShortDate(item.occurredAt),
          icon: timelineIcon(item.eventType),
          tone: timelineTone(item.eventType),
        };
        return normalizeTimelineItem(rawItem, node);
      })
    : [];
  const hasActualSignal = progressPercent > 0
    || node.physicalStatus === "INSTALLED"
    || timeline.some((item) => item.eventType === "QC" || item.title.toLowerCase().includes("aktual"));
  const countdownHourLabel = node.detail?.workStatusLabel
    ? null
    : node.progressPercent !== null && node.progressPercent !== undefined
    ? `Aktual ${progressLabel}`
    : null;
  return timeline.map((item, index) => {
    const isHandover = item.eventType === "HANDOVER" || item.title.toLowerCase().includes("pendataan");
    const isQc = item.eventType === "QC" || item.title.toLowerCase().includes("pemeriksaan");
    const isVendor = item.title.toLowerCase().includes("vendor") || item.detail.toLowerCase().includes("vendor");
    const jobTitle = deriveTimelineJobTitle(item, node);
    const type: WorkflowNodeType = isHandover ? "handover" : isVendor ? "wov" : "job";
    const sourceLabel = isVendor
      ? "WOV"
      : isQc
      ? "COUNTDOWN, AKTUAL"
      : isHandover
      ? "PENDATAAN"
      : node.physicalStatus === "IN_DIVISION" || node.physicalStatus === "INSTALLED"
      ? "COUNTDOWN, JOBPLAN"
      : "COUNTDOWN";
    const isScheduledPlan = !isHandover && !isVendor && !isQc && sourceLabel.includes("JOBPLAN") && !hasActualSignal;

    return {
      id: timelineFlowId(item, index),
      type,
      typeLabel: isHandover ? "Pendataan" : isVendor ? "WOV - Vendor" : sourceLabel.includes("JOBPLAN") ? "Countdown + Job Plan" : "Countdown",
      title: jobTitle,
      meta: item.detail,
      badge: item.date ?? "-",
      status: isScheduledPlan ? "plan" : isHandover || isQc || node.physicalStatus === "INSTALLED" ? "done" : node.physicalStatus === "IN_DIVISION" || isVendor ? "progress" : "plan",
      statusLabel: isScheduledPlan ? "Terjadwal" : isHandover ? "Selesai" : isQc ? "Aktual" : isVendor ? "WOV" : workStatusLabel(node),
      detail: item.detail,
      divisionLabel,
      sourceLabel,
      hourLabel: isHandover ? null : countdownHourLabel,
      progressLabel: isHandover ? "100%" : progressLabel,
      hasPhotos: !isHandover && !isVendor,
      hasMaterials: isVendor,
    };
  });
}

function normalizeTextToken(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, " ")
    .trim();
}

function deriveTimelineJobTitle(item: TimelineItem, node: UnitBomNode): string {
  const title = item.title.trim();
  const detail = item.detail.trim();
  const panelName = normalizeTextToken(node.label ?? "");
  const titleToken = normalizeTextToken(title);

  if (!title) return node.label ?? "Jobdesc";
  if (!panelName || titleToken !== panelName) return title;

  const beforeBy = detail.split(/\boleh\b/iu)[0]?.trim() ?? detail;
  const withoutPanel = beforeBy
    .replace(new RegExp(`\\b${escapeRegExp(node.label ?? "")}\\b`, "iu"), "")
    .replace(/\s+-\s+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();

  const beforeSeparator = withoutPanel.split(/\s[-–]\s/u)[0]?.trim() ?? withoutPanel;
  return beforeSeparator || "Belum ada jobdesc";
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

export function PanelDetailPage({
  carId,
  node,
  canManagePhotos,
  canDownloadPhotos,
  allowedWorkflowCreateTypes,
  canSaveWorkflowCanvas,
}: PanelDetailPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const replaceInputRef = useRef<HTMLInputElement | null>(null);
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const [activeTab, setActiveTab] = useState<DrawerTab>("timeline");
  type PageMode = "detail" | "workflow";
  const [pageMode, setPageMode] = useState<PageMode>(() =>
    searchParams.get("mode") === "workflow" ? "workflow" : "detail",
  );
  const [isFullscreen, setIsFullscreen] = useState(false);
  const workflowScopeId = node.actualId ?? (node.panelId ? `panel-${node.panelId}` : node.nodeId);
  const [workflowOrderIds, setWorkflowOrderIds] = useState<string[]>([]);
  const [galleryState, setGalleryState] = useState<GalleryPhotoState>({
    actualId: null,
    photos: [],
    isLoading: false,
    error: null,
    submittedToLedger: false,
  });
  const [isUploading, setIsUploading] = useState(false);
  const [rowSavingId, setRowSavingId] = useState<string | null>(null);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([]);
  const [replaceTarget, setReplaceTarget] = useState<GalleryPhotoRecord | null>(null);

  const timeline = useMemo(() => (node ? buildTimeline(node) : []), [node]);
  const orderedTimeline = useMemo(() => {
    if (workflowOrderIds.length === 0) return timeline;

    const byFlowId = new Map(timeline.map((item, index) => [timelineFlowId(item, index), item]));
    const used = new Set<string>();
    const ordered = workflowOrderIds
      .map((id) => {
        const item = byFlowId.get(id);
        if (item) used.add(id);
        return item;
      })
      .filter((item): item is TimelineItem => Boolean(item));
    const remaining = timeline.filter((item, index) => !used.has(timelineFlowId(item, index)));
    return [...ordered, ...remaining];
  }, [timeline, workflowOrderIds]);
  const documents = useMemo(() => (node ? buildDocuments(node) : []), [node]);
  const workflowSources = useMemo(() => buildWorkflowSources(node), [node]);
  const galleryPhotos = useMemo(
    () => (galleryState.actualId === node.actualId ? galleryState.photos : []),
    [galleryState.actualId, galleryState.photos, node.actualId],
  );
  const photoSlots = useMemo(
    () => mergeGalleryPhotos(buildPhotoSlots(node?.detail?.photos), galleryPhotos),
    [galleryPhotos, node],
  );
  const selectedPhotos = useMemo(
    () => galleryPhotos.filter((photo) => selectedPhotoIds.includes(photo.photoId)),
    [galleryPhotos, selectedPhotoIds],
  );
  const triage = triageMeta(node);
  const canMutatePhotos = canManagePhotos && !galleryState.submittedToLedger;

  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    setPageMode(searchParams.get("mode") === "workflow" ? "workflow" : "detail");
  }, [searchParams]);

  useEffect(() => {
    if (searchParams.get("fullscreen") !== "true") return;

    const timer = window.setTimeout(() => {
      sectionRef.current?.requestFullscreen?.().catch(() => {
        setIsFullscreen(true);
      });
    }, 100);

    return () => window.clearTimeout(timer);
  }, [searchParams]);

  function handleFullscreenToggle() {
    if (!isFullscreen) {
      sectionRef.current?.requestFullscreen?.().catch(() => {
        setIsFullscreen(true);
      });
      return;
    }

    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    } else {
      setIsFullscreen(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadWorkflowOrder() {
      const result = await fetchWorkflowLayout("", carId, workflowScopeId);
      if (cancelled) return;
      setWorkflowOrderIds(result.payload?.data.layout?.order ?? []);
    }

    void loadWorkflowOrder();

    return () => {
      cancelled = true;
    };
  }, [carId, workflowScopeId]);

  useEffect(() => {
    const actualId = node.actualId ?? null;

    let cancelled = false;

    async function loadPhotos() {
      await Promise.resolve();
      if (cancelled) return;

      if (!actualId) {
        setGalleryState({ actualId: null, photos: [], isLoading: false, error: null, submittedToLedger: false });
        setSelectedPhotoIds([]);
        return;
      }

      setGalleryState({ actualId, photos: [], isLoading: true, error: null, submittedToLedger: false });
      const result = await fetchGalleryPhotos("", actualId);
      if (cancelled) return;

      if (!result.payload) {
        setGalleryState({ actualId, photos: [], isLoading: false, error: "Foto belum bisa dimuat.", submittedToLedger: false });
        return;
      }

      setGalleryState({ actualId, photos: result.payload.data.photos, isLoading: false, error: null, submittedToLedger: result.payload.data.actual.submittedToLedger ?? false });
      setSelectedPhotoIds([]);
    }

    void loadPhotos();

    return () => {
      cancelled = true;
    };
  }, [node.actualId]);

  async function refreshPhotos() {
    const actualId = node?.actualId;
    if (!actualId) return;

    const result = await fetchGalleryPhotos("", actualId);
    if (!result.payload) {
      setGalleryState({ actualId, photos: galleryPhotos, isLoading: false, error: "Data foto belum bisa dimuat ulang.", submittedToLedger: galleryState.submittedToLedger });
      return;
    }

    setGalleryState({ actualId, photos: result.payload.data.photos, isLoading: false, error: null, submittedToLedger: result.payload.data.actual.submittedToLedger ?? false });
  }

  async function uploadFileToR2(params: {
    actualId: string;
    photoType: GalleryPhotoType;
    file: File;
  }) {
    const ticketResult = await requestGalleryUploadTicket({
      actualId: params.actualId,
      photoType: params.photoType,
      filename: params.file.name,
      contentType: params.file.type || "image/jpeg",
      size: params.file.size,
    });

    if (!ticketResult.success) {
      throw new Error(ticketResult.message);
    }

    const uploadResponse = await fetch(ticketResult.result.uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": params.file.type || "image/jpeg",
      },
      body: params.file,
    });

    if (!uploadResponse.ok) {
      throw new Error("Upload ke penyimpanan foto gagal.");
    }

    return ticketResult.result.publicUrl;
  }

  async function handleUpload(data: UploadFormValues & { file: File }) {
    const actualId = node?.actualId;
    if (!actualId) return;

    setIsUploading(true);
    setGalleryState((current) => ({ ...current, error: null }));

    try {
      const photoUrl = await uploadFileToR2({
        actualId,
        photoType: data.photoType,
        file: data.file,
      });

      const createResult = await createGalleryPhoto({
        actualId,
        photoType: data.photoType,
        photoUrl,
        caption: data.caption?.trim() || null,
      });

      if (!createResult.success) {
        throw new Error(createResult.message);
      }

      await refreshPhotos();
      router.refresh();
    } catch (error) {
      setGalleryState((current) => ({
        ...current,
        error: error instanceof Error ? error.message : "Upload foto gagal.",
      }));
    } finally {
      setIsUploading(false);
    }
  }

  async function handleSavePhoto(photoId: string, data: EditFormValues) {
    setRowSavingId(photoId);
    setGalleryState((current) => ({ ...current, error: null }));

    try {
      const result = await updateGalleryPhoto(photoId, {
        photoType: data.photoType,
        caption: data.caption?.trim() || null,
      });

      if (!result.success) {
        throw new Error(result.message);
      }

      await refreshPhotos();
      router.refresh();
    } catch (error) {
      setGalleryState((current) => ({
        ...current,
        error: error instanceof Error ? error.message : "Foto belum bisa diperbarui.",
      }));
    } finally {
      setRowSavingId(null);
    }
  }

  async function handleDeletePhoto(photoId: string) {
    setRowSavingId(photoId);
    setGalleryState((current) => ({ ...current, error: null }));

    try {
      const result = await deleteGalleryPhoto(photoId);
      if (!result.success) {
        throw new Error(result.message);
      }

      await refreshPhotos();
      router.refresh();
      setSelectedPhotoIds((current) => current.filter((id) => id !== photoId));
    } catch (error) {
      setGalleryState((current) => ({
        ...current,
        error: error instanceof Error ? error.message : "Foto belum bisa dihapus.",
      }));
    } finally {
      setRowSavingId(null);
    }
  }

  async function handleReplaceFile(file: File) {
    const actualId = node?.actualId;
    if (!actualId || !replaceTarget) return;

    setRowSavingId(replaceTarget.photoId);
    setGalleryState((current) => ({ ...current, error: null }));

    try {
      const draft = {
        photoType: replaceTarget.photoType,
        caption: replaceTarget.caption ?? "",
      };
      const photoUrl = await uploadFileToR2({
        actualId,
        photoType: draft.photoType,
        file,
      });

      const result = await updateGalleryPhoto(replaceTarget.photoId, {
        photoType: draft.photoType,
        caption: draft.caption.trim() || null,
        photoUrl,
      });

      if (!result.success) {
        throw new Error(result.message);
      }

      await refreshPhotos();
      router.refresh();
      setReplaceTarget(null);
    } catch (error) {
      setGalleryState((current) => ({
        ...current,
        error: error instanceof Error ? error.message : "File foto belum bisa diganti.",
      }));
    } finally {
      setRowSavingId(null);
    }
  }

  async function handleDownloadSelected() {
    if (!node || selectedPhotos.length === 0) return;

    setGalleryState((current) => ({ ...current, error: null }));

    for (const [index, photo] of selectedPhotos.entries()) {
      try {
        await downloadUrl(
          proxiedPhotoUrl(photo.photoUrl),
          buildDownloadFileName(node.label, photo, index),
        );
      } catch {
        setGalleryState((current) => ({
          ...current,
          error: "Sebagian foto tidak bisa diunduh. Coba lagi satu per satu.",
        }));
        break;
      }
    }
  }


  const locationDisplay = node.locationName || node.locationDetail || (triage.tone === "good" ? "Gudang" : node.divisionName ?? "Belum ditentukan");

  return (
    <>
    <div
      ref={sectionRef}
      className={`space-y-2 bg-background text-foreground ${isFullscreen ? "fixed inset-0 z-50 overflow-y-auto p-2" : ""}`}
    >
      <div className="border border-border bg-card px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[14px] font-mono uppercase tracking-[0.12em] text-muted-foreground">Rekam Part</p>
            <h1 className="mt-0.5 text-[16px] font-mono font-semibold text-foreground">{node.label}</h1>
            <p className="mt-0.5 text-[15px] font-mono text-muted-foreground">{hierarchyLabel(node)}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleFullscreenToggle}
              className="inline-flex items-center gap-1.5 border border-border px-2.5 py-1.5 text-[14px] font-mono uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-foreground"
              aria-label={isFullscreen ? "Keluar fullscreen" : "Masuk fullscreen"}
              title={isFullscreen ? "Keluar fullscreen" : "Masuk fullscreen"}
            >
              {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </button>
            <Link
              href={`/units/${carId}?tab=parts-panels`}
              className="inline-flex items-center gap-1.5 border border-border px-3 py-1.5 text-[14px] font-mono uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Kembali
            </Link>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {node.conditionType ? (
            <Badge className={
              node.conditionType === "BARU" ? "border-success/20 bg-success/[0.04] text-success" :
              node.conditionType === "RESTORE" ? "border-primary/20 bg-primary/[0.04] text-app-accent-ink" :
              "border-border bg-muted text-foreground"
            }>
              <Archive className="h-3.5 w-3.5" />
              Kondisi: {node.conditionType}
            </Badge>
          ) : (
            <Badge className={triage.className}>
              <Archive className="h-3.5 w-3.5" />
              Triage: {triage.label}
            </Badge>
          )}

          <Badge className="border-border text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            Lokasi: {locationDisplay}
          </Badge>

          {node.stockStatus && (
            <Badge className="border-border text-muted-foreground">
              <PackageCheck className="h-3.5 w-3.5" />
              Posisi: {node.stockStatus}
            </Badge>
          )}

          <Badge className="border-border text-foreground">
            <Wrench className="h-3.5 w-3.5" />
            Status Kerja: {node.detail?.workStatusLabel ?? workStatusLabel(node)}
          </Badge>
        </div>

        {/* Mode switcher */}
        <div className="mt-3 flex items-center gap-0 border-b border-border">
          <div className="flex">
            {(["detail", "workflow"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setPageMode(mode)}
                className={[
                  "px-4 py-2 text-[14px] font-mono uppercase tracking-[0.12em] border-b-2 -mb-px transition-colors",
                  pageMode === mode
                    ? "border-primary text-app-accent-ink"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                {mode === "detail" ? "Detail" : "Workflow"}
              </button>
            ))}
          </div>

          <div className="mx-2 h-4 w-px bg-muted" />

          {pageMode === "detail" && (
            <div className="flex">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={[
                      "px-4 py-2 text-[14px] font-mono uppercase tracking-[0.12em] border-b-2 -mb-px transition-colors",
                      isActive
                        ? "border-primary text-app-accent-ink"
                        : "border-transparent text-muted-foreground hover:text-foreground",
                    ].join(" ")}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {pageMode === "detail" && (
          <>
          {activeTab === "timeline" ? (
            <div className="overflow-x-auto border border-border bg-card">
              <table className="min-w-full text-left text-[14px] text-foreground">
                <thead>
                  <tr className="border-b border-border bg-background font-mono text-[14px] uppercase tracking-[0.12em] text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Tanggal</th>
                    <th className="px-4 py-3 font-medium">Riwayat</th>
                    <th className="px-4 py-3 font-medium">Keterangan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {timeline.length > 0 ? (
                    orderedTimeline.map((item, index) => {
                      return (
                        <tr key={`${item.eventType ?? "event"}-${item.title}-${item.date ?? "no-date"}-${index}`} className="transition-colors hover:bg-muted">
                          <td className="whitespace-nowrap px-4 py-4 align-top text-[14px] text-muted-foreground">
                            {item.date ?? "-"}
                          </td>
                          <td className="px-4 py-4 align-top">
                            <span className="font-medium">{item.title}</span>
                          </td>
                          <td className="px-4 py-4 align-top text-foreground">
                            {item.detail}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={3} className="px-4 py-6 text-center text-[15px] font-mono text-muted-foreground">
                        Belum ada riwayat tercatat.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : null}

          {activeTab === "photos" ? (
            <div className="space-y-4">
              {galleryState.actualId === node.actualId && galleryState.isLoading ? (
                <div className="border border-border bg-card px-4 py-3 text-[15px] font-mono text-muted-foreground">
                  Memuat foto pengerjaan...
                </div>
              ) : null}

              {galleryState.actualId === node.actualId && galleryState.error ? (
                <div className="border border-primary/20 bg-primary/[0.04] px-4 py-3 text-[15px] font-mono text-app-accent-ink">
                  {galleryState.error}
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-3">
                {photoSlots.map((slot) => {
                  const Icon = slot.icon;
                  return (
                    <div
                      key={slot.label}
                      className="min-h-[150px] border border-border bg-card p-3"
                    >
                      <div className="flex h-full flex-col justify-between">
                        {slot.latestPhotoUrl ? (
                          <button
                            type="button"
                            onClick={() => window.open(getProxiedImageUrl(slot.latestPhotoUrl), "_blank", "noopener,noreferrer")}
                            className="h-16 w-full bg-cover bg-center border border-border"
                            style={{ backgroundImage: `url(${getProxiedImageUrl(slot.latestPhotoUrl)})` }}
                            aria-label={slot.caption}
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center border border-border bg-background text-foreground">
                            <Icon className="h-5 w-5" />
                          </div>
                        )}
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[14px] font-mono text-foreground">{slot.label}</p>
                            <span className="border border-border px-1.5 py-0.5 text-[14px] text-foreground">{slot.photoCount} foto</span>
                          </div>
                          <p className="mt-1 text-[15px] text-muted-foreground">{slot.caption}</p>
                          {slot.latestPhotoAt ? <p className="mt-1 text-[14px] text-muted-foreground">{formatShortDate(slot.latestPhotoAt)}</p> : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {canMutatePhotos ? (
                <div className="border border-border bg-card px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Upload className="h-4 w-4 text-app-accent-ink" />
                    <h3 className="text-[14px] font-mono uppercase tracking-[0.12em] text-muted-foreground">Tambah Foto</h3>
                  </div>
                  <GalleryUploadForm
                    isUploading={isUploading}
                    isDisabled={!node.actualId}
                    defaultCaption={""}
                    onSubmit={(data) => {
                      void handleUpload(data);
                    }}
                  />
                  {!node.actualId ? null : null}
                </div>
              ) : null}

              {canManagePhotos && galleryState.submittedToLedger ? null : null}

              {galleryPhotos.length > 0 ? (
                <div className="border border-border bg-card p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-[14px] font-mono uppercase tracking-[0.12em] text-muted-foreground">Foto Tersimpan</h3>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="border border-border px-2 py-0.5 font-mono text-[14px] text-muted-foreground">
                        {galleryPhotos.length} foto
                      </span>
                      {canDownloadPhotos ? (
                        <button
                          type="button"
                          onClick={() => {
                            void handleDownloadSelected();
                          }}
                          disabled={selectedPhotos.length === 0}
                          className="inline-flex items-center gap-1.5 border border-border px-2.5 py-1 font-mono text-[14px] text-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-35"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Unduh Terpilih ({selectedPhotos.length})
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {galleryPhotos.map((photo) => {
                      const isBusy = rowSavingId === photo.photoId;
                      const isMutable = canMutatePhotos && photo.canEdit;
                      const isSelected = selectedPhotoIds.includes(photo.photoId);
                      const photoUrl = proxiedPhotoUrl(photo.photoUrl);

                      return (
                        <article
                          key={photo.photoId}
                          className={`overflow-hidden border bg-card transition-colors ${isSelected ? "border-primary/35" : "border-border"
                            }`}
                        >
                          <div className="relative">
                            <label className="absolute left-2.5 top-2.5 z-[1] flex h-6 w-6 cursor-pointer items-center justify-center border border-border bg-background/80 dark:bg-black/55">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(event) => {
                                  setSelectedPhotoIds((current) =>
                                    event.target.checked
                                      ? [...current, photo.photoId]
                                      : current.filter((id) => id !== photo.photoId),
                                  );
                                }}
                                className="h-3 w-3 rounded accent-primary"
                              />
                            </label>
                            <span className="absolute right-2.5 top-2.5 z-[1] bg-background border border-border px-2 py-0.5 text-[14px] uppercase tracking-[0.14em] text-foreground">
                              {humanizePhotoType(photo.photoType)}
                            </span>
                            <button
                              type="button"
                              onClick={() => window.open(photoUrl, "_blank", "noopener,noreferrer")}
                              className="block aspect-video w-full bg-cover bg-center"
                              style={{ backgroundImage: `url(${photoUrl})` }}
                              aria-label={photo.caption ?? "Lihat foto"}
                            />
                          </div>

                          <div className="space-y-3 p-3">
                            {isMutable ? (
                              <GalleryPhotoEditForm
                                initialPhotoType={photo.photoType}
                                initialCaption={photo.caption ?? ""}
                                isBusy={isBusy}
                                onSave={(data) => {
                                  void handleSavePhoto(photo.photoId, data);
                                }}
                              />
                            ) : (
                              <p className="line-clamp-2 text-[14px] text-foreground">
                                {photo.caption || "Tidak ada keterangan foto."}
                              </p>
                            )}

                            <div className="flex flex-wrap gap-x-2 gap-y-1 text-[14px] text-muted-foreground">
                              <span>{photo.uploadedByName || photo.uploadedBy || "-"}</span>
                              <span>-</span>
                              <span>{fmtDateTime(photo.uploadedAt)}</span>
                              <span>-</span>
                              <span>{photo.source}</span>
                            </div>

                            <div className="flex flex-wrap gap-1.5 border-t border-border pt-3">
                              <button
                                type="button"
                                onClick={() => window.open(photoUrl, "_blank", "noopener,noreferrer")}
                                className="inline-flex items-center gap-1 border border-border px-2 py-0.5 font-mono text-[14px] text-foreground hover:text-foreground"
                              >
                                <Eye className="h-3 w-3" />
                                Lihat
                              </button>

                              {canDownloadPhotos ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    void downloadUrl(photoUrl, buildDownloadFileName(node.label, photo));
                                  }}
                                  className="inline-flex items-center gap-1 border border-border px-2 py-0.5 font-mono text-[14px] text-foreground hover:text-foreground"
                                >
                                  <Download className="h-3 w-3" />
                                  Unduh
                                </button>
                              ) : null}

                              {isMutable ? (
                                <>
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() => {
                                      setReplaceTarget(photo);
                                      replaceInputRef.current?.click();
                                    }}
                                    className="border border-border px-2 py-0.5 font-mono text-[14px] text-foreground hover:text-foreground disabled:opacity-35"
                                  >
                                    Ganti
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() => {
                                      void handleDeletePhoto(photo.photoId);
                                    }}
                                    className="inline-flex items-center gap-1 border border-destructive/20 bg-destructive/[0.04] px-2 py-0.5 font-mono text-[14px] text-destructive disabled:opacity-35"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                    Hapus
                                  </button>
                                </>
                              ) : (
                                <span className="border border-border px-2 py-0.5 font-mono text-[14px] text-muted-foreground">
                                  Foto final
                                </span>
                              )}
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <input
                ref={replaceInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    void handleReplaceFile(file);
                  }
                  event.currentTarget.value = "";
                }}
              />
            </div>
          ) : null}

          {activeTab === "documents" ? (
            <div className="space-y-3">
              {documents.length > 0 ? (
                documents.map((document) => {
                  const Icon = document.icon;
                  return (
                    <article key={document.title} className="border border-border bg-card px-4 py-3">
                      <div className="flex items-start gap-3">
                        <div className={`flex h-7 w-7 shrink-0 items-center justify-center border ${document.tone}`}>
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <div>
                          <h3 className="text-[14px] font-mono text-foreground">{document.title}</h3>
                          <p className="mt-1 text-[15px] text-muted-foreground">{document.detail}</p>
                        </div>
                      </div>
                    </article>
                  );
                })
              ) : (
                <div className="border border-dashed border-border px-4 py-8 text-center">
                  <FolderOpen className="mx-auto h-5 w-5 text-muted-foreground" />
                  <h3 className="mt-4 text-[15px] font-mono text-muted-foreground">Tidak ada data logistik</h3>
                </div>
              )}
            </div>
          ) : null}
          </>
        )}

        {pageMode === "workflow" && (
          <WorkflowBuilder
            carId={carId}
            node={node}
            workflowSources={workflowSources}
            allowedCreateTypes={allowedWorkflowCreateTypes}
            canSaveCanvas={canSaveWorkflowCanvas}
            isFullscreen={isFullscreen}
            onToggleFullscreen={handleFullscreenToggle}
            onWorkflowOrderChange={setWorkflowOrderIds}
            onNavigateToPhotos={() => {
              setPageMode("detail");
              setActiveTab("photos");
            }}
            onNavigateToDocuments={() => {
              setPageMode("detail");
              setActiveTab("documents");
            }}
          />
        )}
      </div>
    </div>
    </>
  );
}

interface WorkflowBuilderProps {
  carId: string;
  node: UnitBomNode;
  workflowSources: WorkflowNode[];
  allowedCreateTypes: WorkflowCreateType[];
  canSaveCanvas: boolean;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onWorkflowOrderChange: (order: string[]) => void;
  onNavigateToPhotos: () => void;
  onNavigateToDocuments: () => void;
}

type WorkflowNodeData = WorkflowNode;
type WorkflowFlowNode = Node<WorkflowNodeData, "workflowNode">;
type WorkflowFlowEdge = Edge<Record<string, unknown>>;

const workflowNodeStatusClass = {
  done: "border-success/30 bg-success/[0.05] text-success",
  progress: "border-primary/35 bg-primary/[0.07] text-app-accent-ink",
  plan: "border-border bg-muted text-muted-foreground",
  open: "border-destructive/25 bg-destructive/[0.05] text-destructive",
} as const;

const workflowNodeAccentClass: Record<WorkflowNodeType, string> = {
  handover: "border-l-info",
  job: "border-l-primary",
  doc: "border-l-destructive",
  wov: "border-l-info",
};

function WorkflowCanvasNode({ data, selected }: NodeProps<WorkflowFlowNode>) {
  const isCountdownNode = (data.sourceLabel ?? data.typeLabel).toUpperCase().includes("COUNTDOWN");
  const statusLabel = isCountdownNode
    ? ({
        done: "Selesai",
        progress: "Berjalan",
        plan: "Terjadwal",
        open: "Terbuka",
      } as const)[data.status]
    : data.statusLabel;
  const sourceTone = {
    handover: "text-info",
    job: "text-app-accent-ink",
    doc: "text-destructive",
    wov: "text-muted-foreground",
  }[data.type];
  const statusTone = {
    done: "text-success",
    progress: "text-app-accent-ink",
    plan: "text-muted-foreground",
    open: "text-destructive",
  }[data.status];
  const statusDot = {
    done: "bg-success",
    progress: "bg-primary",
    plan: "bg-muted-foreground",
    open: "bg-destructive",
  }[data.status];
  const progressText = data.progressLabel ?? data.hourLabel ?? data.badge ?? null;
  const hasDivision = Boolean(data.divisionLabel);
  const hasProgress = Boolean(progressText);
  const hasAssets = data.hasPhotos || data.hasMaterials;
  const handleClassName = [
    "!h-2.5 !w-2.5 !border-[1.5px] !border-primary/70 !bg-background !transition-opacity",
    selected ? "!opacity-100" : "!opacity-0 group-hover:!opacity-100",
  ].join(" ");

  return (
    <div className={[
      "group flex h-full min-w-[280px] flex-col overflow-visible border border-l-4 bg-card shadow-sm transition-colors",
      workflowNodeAccentClass[data.type],
      selected ? "border-primary/70 bg-primary/[0.04]" : "border-border hover:border-primary/35",
    ].join(" ")}>
      {selected ? (
        <NodeResizeControl
          position="bottom-right"
          variant={ResizeControlVariant.Handle}
          minWidth={280}
          minHeight={80}
          maxWidth={560}
          maxHeight={320}
          autoScale={false}
          className="!h-4 !w-4 !rounded-none !border-0 !bg-transparent !shadow-none ![translate:-100%_-100%]"
        >
          <span className="absolute bottom-1 right-1 h-2.5 w-2.5 border-b-2 border-r-2 border-primary/80" />
        </NodeResizeControl>
      ) : null}
      {(["top", "right", "bottom", "left"] as const).map((side) => {
        const position = {
          top: Position.Top,
          right: Position.Right,
          bottom: Position.Bottom,
          left: Position.Left,
        }[side];
        const offsetClass = {
          top: "!-top-2",
          right: "!-right-2",
          bottom: "!-bottom-2",
          left: "!-left-2",
        }[side];

        return (
          <Fragment key={side}>
            <Handle id={side} type="target" position={position} className={`${handleClassName} ${offsetClass}`} />
            <Handle id={side} type="source" position={position} className={`${handleClassName} ${offsetClass}`} />
          </Fragment>
        );
      })}
      <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-[7px]">
        <p className={`min-w-0 truncate font-mono text-[10px] uppercase tracking-[0.1em] ${sourceTone}`}>
          {data.sourceLabel ?? data.typeLabel}
        </p>
        <div className={`flex shrink-0 items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.07em] ${statusTone}`}>
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusDot}`} />
          <span className="max-w-[130px] truncate">{statusLabel}</span>
        </div>
      </div>
      <div className="flex-1 px-3 pb-2 pt-2.5">
        <p className="break-words text-[13px] font-medium leading-snug text-foreground">{data.title}</p>
        <p className="mt-1 break-words text-[11px] leading-snug text-muted-foreground">{data.meta}</p>
      </div>
      {(hasDivision || hasProgress || hasAssets) ? (
        <div className="flex items-center gap-0 border-t border-border px-3 py-[6px] font-mono text-[10px] leading-none text-muted-foreground">
          {hasDivision ? (
            <div className="flex min-w-0 items-center gap-1">
              <Building2 className="h-3 w-3 shrink-0" />
              <span className="truncate">{data.divisionLabel}</span>
            </div>
          ) : null}
          {hasDivision && hasProgress ? <span className="mx-2 h-2.5 w-px shrink-0 bg-border" /> : null}
          {hasProgress ? (
            <div className="flex min-w-0 items-center gap-1">
              <TrendingUp className="h-3 w-3 shrink-0" />
              <span className="truncate">{progressText}</span>
            </div>
          ) : null}
          {(hasDivision || hasProgress) && hasAssets ? <span className="mx-2 h-2.5 w-px shrink-0 bg-border" /> : null}
          {hasAssets ? (
            <div className="flex min-w-0 items-center gap-2 text-app-accent-ink">
              {data.hasPhotos ? (
                <span className="flex items-center gap-1">
                  <Camera className="h-3 w-3 shrink-0" />
                  <span>Foto</span>
                </span>
              ) : null}
              {data.hasMaterials ? (
                <span className="flex items-center gap-1">
                  <Package className="h-3 w-3 shrink-0" />
                  <span>Material</span>
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

const workflowNodeTypes = { workflowNode: WorkflowCanvasNode };
const workflowCanvasGrid = 24;
type WorkflowAnchorSide = "left" | "right" | "top" | "bottom";

function snapWorkflowCanvasPosition(position: { x: number; y: number }) {
  return {
    x: Math.max(24, Math.round(position.x / workflowCanvasGrid) * workflowCanvasGrid),
    y: Math.max(24, Math.round(position.y / workflowCanvasGrid) * workflowCanvasGrid),
  };
}

function normalizeWorkflowAnchorSide(side: string | null | undefined, fallback: WorkflowAnchorSide): WorkflowAnchorSide {
  return side === "left" || side === "right" || side === "top" || side === "bottom" ? side : fallback;
}

function createEndWorkflowNode(): WorkflowNode {
  return {
    id: "workflow-end",
    type: "job",
    typeLabel: "Selesai",
    title: "Selesai",
    meta: "Alur kerja selesai",
    badge: "End",
    status: "done",
    statusLabel: "Selesai",
    isEnd: true,
  };
}

function flowNodeFromSource(
  source: WorkflowNode,
  index: number,
  position?: { x: number; y: number },
  size?: { width?: number; height?: number },
): WorkflowFlowNode {
  const snappedPosition = snapWorkflowCanvasPosition(position ?? { x: 360 + (index % 3) * 380, y: 80 + Math.floor(index / 3) * 220 });
  return {
    id: source.id,
    type: "workflowNode",
    position: snappedPosition,
    style: { width: size?.width ?? 340 },
    data: source as WorkflowNodeData,
  };
}

function toWorkflowEdge(edge: WorkflowFlowEdge): { id: string; fromId: string; toId: string; fromSide: WorkflowAnchorSide; toSide: WorkflowAnchorSide } {
  return {
    id: edge.id,
    fromId: edge.source,
    toId: edge.target,
    fromSide: normalizeWorkflowAnchorSide(edge.sourceHandle, "right"),
    toSide: normalizeWorkflowAnchorSide(edge.targetHandle, "left"),
  };
}

function getOrderedNodeIds(nodes: WorkflowFlowNode[], edges: WorkflowFlowEdge[]) {
  const nodeIds = new Set(nodes.filter((item) => !item.data.isEnd).map((item) => item.id));
  const outgoing = new Map<string, string[]>();
  const incomingCount = new Map<string, number>();

  for (const id of nodeIds) incomingCount.set(id, 0);
  for (const edge of edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) continue;
    outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge.target]);
    incomingCount.set(edge.target, (incomingCount.get(edge.target) ?? 0) + 1);
  }

  const byId = new Map(nodes.map((item) => [item.id, item]));
  const sortByCanvas = (left: string, right: string) => {
    const a = byId.get(left)?.position ?? { x: 0, y: 0 };
    const b = byId.get(right)?.position ?? { x: 0, y: 0 };
    return a.y === b.y ? a.x - b.x : a.y - b.y;
  };
  const starts = [...nodeIds].filter((id) => (incomingCount.get(id) ?? 0) === 0).sort(sortByCanvas);
  const ordered: string[] = [];
  const visited = new Set<string>();

  function visit(id: string) {
    if (visited.has(id)) return;
    visited.add(id);
    ordered.push(id);
    for (const next of (outgoing.get(id) ?? []).slice().sort(sortByCanvas)) visit(next);
  }

  for (const start of starts) visit(start);
  for (const id of [...nodeIds].filter((item) => !visited.has(item)).sort(sortByCanvas)) visit(id);
  return ordered;
}

function WorkflowBuilder({
  carId,
  node,
  workflowSources,
  allowedCreateTypes,
  canSaveCanvas,
  isFullscreen,
  onToggleFullscreen,
  onWorkflowOrderChange,
  onNavigateToPhotos,
  onNavigateToDocuments,
}: WorkflowBuilderProps) {
  const workflowScopeId = node.actualId ?? (node.panelId ? `panel-${node.panelId}` : node.nodeId);
  const [nodes, setNodes, onNodesChange] = useNodesState<WorkflowFlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<WorkflowFlowEdge>([]);
  const [selectedNode, setSelectedNode] = useState<WorkflowNode | null>(null);
  const [localWorkflowSources, setLocalWorkflowSources] = useState<WorkflowNode[]>(workflowSources);
  const [countdownReferences, setCountdownReferences] = useState<WorkflowCountdownReferences>({ divisions: [], sections: [], jobTypes: [] });
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreateMinimized, setIsCreateMinimized] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [editingSourceId, setEditingSourceId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<JobDescEditForm | null>(null);
  const [isSourceListHidden, setIsSourceListHidden] = useState(false);
  const [dragSourceId, setDragSourceId] = useState<string | null>(null);
  const [isCanvasDragActive, setIsCanvasDragActive] = useState(false);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance<WorkflowFlowNode, WorkflowFlowEdge> | null>(null);
  const { alertElement, confirm } = useSweetAlert();

  useEffect(() => {
    setLocalWorkflowSources((current) => {
      const manualSources = current.filter((source) => source.id.startsWith("manual-"));
      const next = [...workflowSources];
      for (const manualSource of manualSources) {
        if (!next.some((source) => source.id === manualSource.id)) next.push(manualSource);
      }
      return next;
    });
  }, [workflowSources]);

  useEffect(() => {
    let cancelled = false;

    async function loadSharedLayout() {
      setSaveMessage("Memuat canvas");
      const result = await fetchWorkflowLayout("", carId, workflowScopeId);
      if (cancelled) return;

      const sourceById = new Map(workflowSources.map((source) => [source.id, source]));
      const savedLayout = result.payload?.data.layout as {
        nodeLayouts?: Array<{ id: string; x: number; y: number; width?: number; height?: number }>;
        connections?: Array<{ id: string; fromId: string; toId: string; fromSide?: string; toSide?: string }>;
        order?: string[];
      } | undefined;
      const savedPositions = new Map((savedLayout?.nodeLayouts ?? []).map((item) => [item.id, { x: item.x, y: item.y }]));
      const savedSizes = new Map((savedLayout?.nodeLayouts ?? []).map((item) => [item.id, { width: item.width, height: item.height }]));
      const savedNodeIds = savedLayout?.nodeLayouts?.map((item) => item.id).filter((id) => id !== "workflow-end") ?? [];
      const initialSources = savedNodeIds
        .map((id) => sourceById.get(id))
        .filter((item): item is WorkflowNode => Boolean(item));
      const flowNodes = [
        ...initialSources.map((source, index) => flowNodeFromSource(source, index, savedPositions.get(source.id), savedSizes.get(source.id))),
        flowNodeFromSource(createEndWorkflowNode(), initialSources.length, savedPositions.get("workflow-end") ?? { x: 900, y: 360 }, savedSizes.get("workflow-end")),
      ];
      const validNodeIds = new Set(flowNodes.map((item) => item.id));
      const flowEdges = (savedLayout?.connections ?? [])
        .filter((edge) => validNodeIds.has(edge.fromId) && validNodeIds.has(edge.toId))
        .map((edge) => ({
          id: edge.id,
          source: edge.fromId,
          target: edge.toId,
          sourceHandle: edge.fromSide ?? "right",
          targetHandle: edge.toSide ?? "left",
          type: "smoothstep" as const,
          animated: true,
        }));

      setNodes(flowNodes);
      setEdges(flowEdges);
      if (savedLayout?.order) onWorkflowOrderChange(savedLayout.order);
      setSaveMessage(savedLayout ? "Canvas shared siap" : null);
      if (savedLayout) window.setTimeout(() => setSaveMessage(null), 1200);
    }

    void loadSharedLayout();
    return () => { cancelled = true; };
  }, [carId, onWorkflowOrderChange, setEdges, setNodes, workflowScopeId, workflowSources]);

  useEffect(() => {
    let cancelled = false;
    async function loadDivisions() {
      const response = await fetchCountdownBoard("", { limit: "1" });
      if (cancelled) return;
      const references = response.payload?.references;
      setCountdownReferences({
        divisions: (references?.divisions ?? []).map((division) => ({ value: division.value, label: division.label, parentId: division.parentId, parentName: division.parentName, parentCode: division.parentCode })),
        sections: (references?.sections ?? []).map((section) => ({ value: section.value, label: section.label })),
        jobTypes: (references?.jobTypes ?? []).map((jobType) => ({ value: jobType.value, label: jobType.label, divisionId: jobType.divisionId, divisionName: jobType.divisionName, divisionParentId: jobType.divisionParentId })),
      });
    }
    void loadDivisions();
    return () => { cancelled = true; };
  }, []);

  const usedNodeIds = useMemo(() => new Set(nodes.map((item) => item.id)), [nodes]);
  const availableSources = localWorkflowSources.filter((source) => !usedNodeIds.has(source.id));
  const selectedFlowNode = selectedNode ? nodes.find((item) => item.id === selectedNode.id)?.data ?? selectedNode : null;
  const orderedNodeIds = useMemo(() => getOrderedNodeIds(nodes, edges), [edges, nodes]);
  const orderedFlowNodes = orderedNodeIds.map((id) => nodes.find((item) => item.id === id)?.data).filter((item): item is WorkflowNode => Boolean(item));
  const canCreateWorkflowSource = allowedCreateTypes.length > 0;
  const workflowJobContext = useMemo<WorkflowJobCreateContext>(() => ({
    carId,
    panelId: node.panelId,
    panelName: node.label,
    sectionName: node.section,
    panelCategory: node.category,
    divisionId: node.divisionId ? String(node.divisionId) : null,
    divisionName: node.divisionName,
  }), [carId, node.category, node.divisionId, node.divisionName, node.label, node.panelId, node.section]);

  const onConnect = useCallback((connection: Connection) => {
    setEdges((current) => addEdge({ ...connection, type: "smoothstep", animated: true }, current));
  }, [setEdges]);

  const handleNodeClick: NodeMouseHandler<WorkflowFlowNode> = useCallback((_event, clickedNode) => {
    setSelectedNode(clickedNode.data);
  }, []);

  const handleNodeDragStop: OnNodeDrag<WorkflowFlowNode> = useCallback((_event, draggedNode) => {
    const snappedPosition = snapWorkflowCanvasPosition(draggedNode.position);
    setNodes((current) => current.map((item) => item.id === draggedNode.id ? { ...item, position: snappedPosition } : item));
  }, [setNodes]);

  function addSourceToCanvas(source: WorkflowNode) {
    if (usedNodeIds.has(source.id)) return;
    setNodes((current) => [
      ...current.filter((item) => item.id !== "workflow-end"),
      flowNodeFromSource(source, current.length),
      current.find((item) => item.id === "workflow-end") ?? flowNodeFromSource(createEndWorkflowNode(), current.length, { x: 900, y: 360 }),
    ]);
  }

  function addSourceToCanvasAt(source: WorkflowNode, position?: { x: number; y: number }) {
    if (usedNodeIds.has(source.id)) return;
    setNodes((current) => [
      ...current.filter((item) => item.id !== "workflow-end"),
      flowNodeFromSource(source, current.length, position),
      current.find((item) => item.id === "workflow-end") ?? flowNodeFromSource(createEndWorkflowNode(), current.length, { x: 900, y: 360 }),
    ]);
    setSelectedNode(source);
  }

  const handleSourceDragStart = useCallback((event: DragEvent<HTMLDivElement>, sourceId: string) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/x-workflow-source", sourceId);
    setDragSourceId(sourceId);
  }, []);

  const handleSourceDragEnd = useCallback(() => {
    setDragSourceId(null);
    setIsCanvasDragActive(false);
  }, []);

  const handleCanvasDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer.types.includes("application/x-workflow-source")) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (!isCanvasDragActive) setIsCanvasDragActive(true);
  }, [isCanvasDragActive]);

  const handleCanvasDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as globalThis.Node | null)) return;
    setIsCanvasDragActive(false);
  }, []);

  const handleCanvasDrop = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const sourceId = event.dataTransfer.getData("application/x-workflow-source") || dragSourceId;
    const source = localWorkflowSources.find((item) => item.id === sourceId);
    if (!source) {
      setIsCanvasDragActive(false);
      setDragSourceId(null);
      return;
    }

    const flowPosition = reactFlowInstance?.screenToFlowPosition({ x: event.clientX, y: event.clientY });
    const droppedPosition = flowPosition
      ? snapWorkflowCanvasPosition({ x: flowPosition.x - 140, y: flowPosition.y - 40 })
      : undefined;

    addSourceToCanvasAt(source, droppedPosition);
    setIsCanvasDragActive(false);
    setDragSourceId(null);
  }, [addSourceToCanvasAt, dragSourceId, localWorkflowSources, reactFlowInstance]);

  function handleRemoveNode(id: string) {
    if (id === "workflow-end") return;
    setNodes((current) => current.filter((item) => item.id !== id));
    setEdges((current) => current.filter((edge) => edge.source !== id && edge.target !== id));
    if (selectedNode?.id === id) setSelectedNode(null);
  }

  async function handleDeleteSource(sourceId: string) {
    const source = localWorkflowSources.find((item) => item.id === sourceId);
    if (!source || !isJobDescMutable(source)) return;
    const confirmed = await confirm({ title: "Hapus jobdesc?", description: `Hapus "${source.title}"? Ini juga akan menghapusnya dari canvas.`, tone: "error", confirmLabel: "Hapus", cancelLabel: "Batal" });
    if (!confirmed) return;
    setLocalWorkflowSources((current) => current.filter((item) => item.id !== sourceId));
    handleRemoveNode(sourceId);
    if (editingSourceId === sourceId) {
      setEditingSourceId(null);
      setEditForm(null);
    }
  }

  function handleSaveEditSource() {
    if (!editingSourceId || !editForm) return;
    const nextTitle = editForm.title.trim();
    const nextMeta = editForm.meta.trim();
    const updateSource = (item: WorkflowNode) => item.id === editingSourceId ? { ...item, title: nextTitle || item.title, meta: nextMeta } : item;
    setLocalWorkflowSources((current) => current.map(updateSource));
    setNodes((current) => current.map((item) => ({ ...item, data: updateSource(item.data) })));
    setSelectedNode((current) => current && current.id === editingSourceId ? updateSource(current) : current);
    setEditingSourceId(null);
    setEditForm(null);
  }

  function handleClearFlow() {
    setNodes([flowNodeFromSource(createEndWorkflowNode(), 0, { x: 900, y: 360 })]);
    setEdges([]);
    setSelectedNode(null);
  }

  async function handleSaveCanvas() {
    const order = getOrderedNodeIds(nodes, edges);
    const layout = {
      version: 2 as const,
      nodeLayouts: nodes.map((item) => ({
        id: item.id,
        x: item.position.x,
        y: item.position.y,
        width: item.measured?.width ?? item.width ?? 340,
        height: item.measured?.height ?? item.height ?? 96,
      })),
      connections: edges.map(toWorkflowEdge),
      order,
      savedAt: new Date().toISOString(),
    };
    setSaveMessage("Menyimpan");
    const result = await saveWorkflowLayout(carId, workflowScopeId, layout);
    if (!result.success) {
      setSaveMessage("Canvas gagal disimpan");
      window.setTimeout(() => setSaveMessage(null), 2400);
      return;
    }
    onWorkflowOrderChange(order);
    setSaveMessage("Canvas shared tersimpan");
    window.setTimeout(() => setSaveMessage(null), 1800);
  }

  function addCreatedSource(params: CreatedWorkflowJob) {
    const sourceType: WorkflowNodeType = params.type === "PR" ? "doc" : params.type === "WOV" ? "wov" : "job";
    const source: WorkflowNode = {
      id: `manual-${params.type.toLowerCase()}-${params.idSuffix}`,
      type: sourceType,
      typeLabel: params.type === "COUNTDOWN" ? "Countdown" : params.type === "WO" ? "WO" : params.type === "PR" ? "PR Logistik" : "WOV - Vendor",
      title: params.title,
      meta: params.meta,
      badge: params.type,
      status: params.type === "PR" ? "open" : params.type === "WOV" ? "progress" : "plan",
      statusLabel: params.type === "COUNTDOWN" ? "PLAN" : "Dibuat",
      detail: params.meta,
      divisionLabel: params.meta.split(" - ").at(-1) ?? null,
      sourceLabel: params.type === "COUNTDOWN" ? "COUNTDOWN" : params.type,
      hasPhotos: params.type === "COUNTDOWN" || params.type === "WO",
      hasMaterials: params.type === "PR" || params.type === "WOV",
    };
    setLocalWorkflowSources((current) => [source, ...current]);
    addSourceToCanvas(source);
  }

  function handleCreatedWorkflowJob(created: CreatedWorkflowJob) {
    addCreatedSource(created);
    setIsCreateOpen(false);
    setIsCreateMinimized(false);
  }

  const borderAccentClass: Record<WorkflowNodeType, string> = { handover: "border-l-info", job: "border-l-primary", doc: "border-l-destructive", wov: "border-l-info" };
  const typeColorClass: Record<WorkflowNodeType, string> = { handover: "text-info", job: "text-app-accent-ink", doc: "text-destructive", wov: "text-info" };
  const statusConfig = { done: "border-success/20 bg-success/[0.04] text-success", progress: "border-primary/30 bg-primary/[0.04] text-app-accent-ink", plan: "border-border text-muted-foreground", open: "border-destructive/20 bg-destructive/[0.04] text-destructive" } as const;

  return (
    <>
      {alertElement}
      <div className={`grid border border-border bg-card ${isFullscreen ? "h-[calc(100vh-140px)]" : "min-h-[calc(100vh-300px)]"} grid-cols-1 ${isSourceListHidden ? "xl:grid-cols-1" : "xl:grid-cols-[280px_minmax(0,1fr)]"}`}>
        {!isSourceListHidden ? (
          <div className="flex min-h-0 flex-col border-b border-border bg-card xl:border-b-0 xl:border-r">
            <div className="flex items-center gap-2 border-b border-border bg-muted px-3 py-2">
              <p className="flex-1 text-[14px] font-mono uppercase tracking-[0.12em] text-muted-foreground">Sumber Job ({availableSources.length})</p>
              <button type="button" onClick={() => setIsSourceListHidden(true)} className="h-9 border border-border bg-card px-3 text-[13px] font-mono uppercase tracking-[0.08em] text-muted-foreground hover:border-primary/35 hover:text-foreground">Hide</button>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto bg-card p-2">
              {localWorkflowSources.map((src) => {
                const used = usedNodeIds.has(src.id);
                const mutable = isJobDescMutable(src);
                const isEditing = editingSourceId === src.id;
                return (
                  <div
                    key={src.id}
                    draggable={!used && !isEditing}
                    onDragStart={(event) => handleSourceDragStart(event, src.id)}
                    onDragEnd={handleSourceDragEnd}
                    className={[
                      "group relative border border-l-2 bg-card transition-all",
                      borderAccentClass[src.type],
                      dragSourceId === src.id ? "scale-[0.985] opacity-60" : "",
                      used && !isEditing ? "bg-muted opacity-70" : "hover:border-primary/35 hover:bg-muted",
                      !used && !isEditing ? "cursor-grab active:cursor-grabbing" : "",
                    ].join(" ")}
                  >
                    <button type="button" disabled={used || isEditing} onClick={() => addSourceToCanvas(src)} className={`w-full px-2.5 py-2 text-left ${!used && !isEditing ? "cursor-pointer" : "cursor-default"}`}>
                      <p className={`pr-12 text-[15px] font-mono uppercase tracking-[0.08em] ${typeColorClass[src.type]}`}>{src.typeLabel}</p>
                      <p className="mt-0.5 pr-12 text-[15px] leading-snug text-foreground">{src.title}</p>
                      <p className="mt-0.5 pr-12 text-[15px] text-muted-foreground">{src.meta}</p>
                    </button>
                    {mutable && !isEditing ? (
                      <div className="absolute right-1 top-1 hidden items-center gap-1 group-hover:flex">
                        <button type="button" onClick={() => { setEditingSourceId(src.id); setEditForm({ title: src.title, meta: src.meta }); }} className="flex h-8 w-8 items-center justify-center border border-border bg-card text-muted-foreground hover:text-foreground" title="Edit jobdesc"><Pencil className="h-3.5 w-3.5" /></button>
                        <button type="button" onClick={() => { void handleDeleteSource(src.id); }} className="flex h-8 w-8 items-center justify-center border border-border bg-card text-muted-foreground hover:text-destructive" title="Hapus jobdesc"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    ) : null}
                    {!mutable ? <div className="absolute right-1.5 top-1.5"><Lock className="h-3 w-3 text-muted-foreground/50" /></div> : null}
                    {isEditing && editForm ? (
                      <div className="space-y-2 border-t border-border p-2.5">
                        <input type="text" value={editForm.title} onChange={(event) => setEditForm((current) => current ? { ...current, title: event.target.value } : current)} className="w-full border border-border bg-background px-2 py-1 text-[14px] text-foreground focus:border-primary/50 focus:outline-none" placeholder="Nama pekerjaan" />
                        <input type="text" value={editForm.meta} onChange={(event) => setEditForm((current) => current ? { ...current, meta: event.target.value } : current)} className="w-full border border-border bg-background px-2 py-1 text-[14px] text-foreground focus:border-primary/50 focus:outline-none" placeholder="Keterangan" />
                        <div className="flex gap-1.5">
                          <button type="button" onClick={handleSaveEditSource} className="flex-1 border border-primary/30 bg-primary/10 px-2 py-1 text-[14px] font-mono uppercase tracking-[0.08em] text-app-accent-ink hover:bg-primary/15">Simpan</button>
                          <button type="button" onClick={() => { setEditingSourceId(null); setEditForm(null); }} className="border border-border px-2 py-1 text-[14px] font-mono uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground">Batal</button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="flex min-w-0 flex-col bg-card">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted px-3 py-2">
            <div className="flex min-w-0 items-center gap-2">
              {isSourceListHidden ? <button type="button" onClick={() => setIsSourceListHidden(false)} className="h-9 border border-border bg-card px-3 text-[13px] font-mono uppercase tracking-[0.08em] text-muted-foreground hover:border-primary/35 hover:text-foreground">Sumber Job</button> : null}
              <p className="text-[14px] font-mono uppercase tracking-[0.12em] text-muted-foreground">Workflow Canvas{orderedFlowNodes.length > 0 ? <span className="ml-1 opacity-50">- {orderedFlowNodes.length} step</span> : null}</p>
              <span className="hidden text-[13px] font-mono text-muted-foreground md:inline">{saveMessage ?? "React Flow"}</span>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <button type="button" onClick={onToggleFullscreen} className="inline-flex h-9 w-9 items-center justify-center border border-border bg-card text-muted-foreground transition-colors hover:border-primary/35 hover:text-foreground" title={isFullscreen ? "Keluar fullscreen" : "Masuk fullscreen"} aria-label={isFullscreen ? "Keluar fullscreen" : "Masuk fullscreen"}>{isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}</button>
              {canSaveCanvas ? <button type="button" onClick={handleSaveCanvas} className="inline-flex h-9 items-center gap-1 border border-border bg-card px-3 text-[13px] font-mono uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:border-success/30 hover:text-success"><Save className="h-3.5 w-3.5" />Save Layout</button> : null}
              {canCreateWorkflowSource ? <button type="button" onClick={() => { setIsCreateMinimized(false); setIsCreateOpen(true); }} className="inline-flex h-9 items-center gap-1.5 border border-primary/30 bg-primary/10 px-3 text-[13px] font-mono uppercase tracking-[0.08em] text-app-accent-ink hover:bg-primary/15"><Plus className="h-3.5 w-3.5" />Tambah</button> : null}
              {(orderedFlowNodes.length > 0 || edges.length > 0) ? <button type="button" onClick={handleClearFlow} className="h-9 border border-border bg-card px-3 text-[13px] font-mono uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:border-destructive/30 hover:text-destructive">Reset</button> : null}
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col xl:flex-row">
            <div
              className={[
                "relative min-h-[520px] flex-1 bg-background transition-colors",
                isFullscreen ? "h-[calc(100vh-220px)]" : "",
                isCanvasDragActive ? "bg-primary/[0.05]" : "",
              ].join(" ")}
              onDragOver={handleCanvasDragOver}
              onDragLeave={handleCanvasDragLeave}
              onDrop={handleCanvasDrop}
            >
              <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={workflowNodeTypes}
                connectionMode={ConnectionMode.Loose}
                defaultEdgeOptions={{ type: "smoothstep", animated: true }}
                snapToGrid
                snapGrid={[workflowCanvasGrid, workflowCanvasGrid]}
                onInit={setReactFlowInstance}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeClick={handleNodeClick}
                onNodeDragStop={handleNodeDragStop}
                fitView
                proOptions={{ hideAttribution: true }}
                className="[&_.react-flow__edge-path]:!stroke-primary [&_.react-flow__handle]:!bg-primary [&_.react-flow__node-default]:!border-border [&_.react-flow__node-default]:!bg-card [&_.react-flow__node-default]:!text-foreground"
              >
                <Background color="var(--border)" gap={24} />
              </ReactFlow>
              {orderedFlowNodes.length === 0 ? (
                <div className="pointer-events-none absolute inset-x-4 bottom-4 z-10 border border-dashed border-border bg-card/90 px-4 py-3 backdrop-blur-sm">
                  <p className="text-[12px] font-mono uppercase tracking-[0.12em] text-muted-foreground">Canvas kosong</p>
                  <p className="mt-1 text-[13px] text-foreground">Geser kartu dari Sumber Job ke canvas, lalu hubungkan node sesuai alur kerja.</p>
                </div>
              ) : null}
              {isCanvasDragActive ? (
                <div className="pointer-events-none absolute inset-4 z-10 border border-dashed border-primary/35 bg-primary/[0.06]" />
              ) : null}
            </div>

            {(selectedFlowNode || orderedFlowNodes.length > 0) ? (
              <div className="flex w-full flex-shrink-0 flex-col border-t border-border bg-card xl:w-[280px] xl:border-l xl:border-t-0">
                <div className="flex items-center justify-between border-b border-border bg-muted px-3 py-2">
                  <p className="text-[14px] font-mono uppercase tracking-[0.08em] text-muted-foreground">{selectedFlowNode ? "Detail" : "Urutan Flow"}</p>
                  {selectedFlowNode ? <button type="button" onClick={() => setSelectedNode(null)} className="text-[14px] font-mono text-muted-foreground hover:text-foreground">x</button> : null}
                </div>
                <div className="flex-1 space-y-4 overflow-y-auto p-3">
                  {selectedFlowNode ? (
                    <>
                      <div><p className="mb-1 text-[15px] font-mono uppercase tracking-[0.08em] text-muted-foreground">Sumber</p><p className="text-[15px] font-mono leading-snug text-foreground">{selectedFlowNode.sourceLabel ?? selectedFlowNode.typeLabel}</p></div>
                      <div><p className="mb-1 text-[15px] font-mono uppercase tracking-[0.08em] text-muted-foreground">Master Jobdesc</p><p className="text-[15px] font-mono leading-snug text-foreground">{selectedFlowNode.title}</p><p className="mt-1 text-[14px] text-muted-foreground">{selectedFlowNode.meta}</p></div>
                      <div><p className="mb-1 text-[15px] font-mono uppercase tracking-[0.08em] text-muted-foreground">Divisi</p><p className="text-[14px] font-mono text-foreground">{selectedFlowNode.divisionLabel ?? "-"}</p></div>
                      <div className="grid grid-cols-2 gap-2"><div><p className="mb-1 text-[15px] font-mono uppercase tracking-[0.08em] text-muted-foreground">Jam</p><p className="text-[14px] font-mono text-foreground">{selectedFlowNode.hourLabel ?? "-"}</p></div><div><p className="mb-1 text-[15px] font-mono uppercase tracking-[0.08em] text-muted-foreground">Progress</p><p className="text-[14px] font-mono text-foreground">{selectedFlowNode.progressLabel ?? "-"}</p></div></div>
                      {selectedFlowNode.detail ? <div><p className="mb-1 text-[15px] font-mono uppercase tracking-[0.08em] text-muted-foreground">Detail</p><p className="text-[14px] leading-relaxed text-muted-foreground">{selectedFlowNode.detail}</p></div> : null}
                      <div><p className="mb-1 text-[15px] font-mono uppercase tracking-[0.08em] text-muted-foreground">Status</p><span className={`border px-2 py-0.5 text-[15px] font-mono uppercase tracking-[0.06em] ${statusConfig[selectedFlowNode.status]}`}>{selectedFlowNode.statusLabel}</span></div>
                      <div><p className="mb-1 text-[15px] font-mono uppercase tracking-[0.08em] text-muted-foreground">Bukti Foto</p>{selectedFlowNode.hasPhotos ? <button type="button" onClick={onNavigateToPhotos} className="w-full border border-border px-2 py-1 text-left text-[15px] font-mono uppercase tracking-[0.06em] text-muted-foreground transition-colors hover:border-primary/20 hover:text-app-accent-ink">Lihat Galeri -&gt;</button> : <p className="text-[14px] font-mono text-muted-foreground">Belum ada foto</p>}</div>
                      <div><p className="mb-1 text-[15px] font-mono uppercase tracking-[0.08em] text-muted-foreground">Bahan & Tools</p>{selectedFlowNode.hasMaterials ? <button type="button" onClick={onNavigateToDocuments} className="w-full border border-border px-2 py-1 text-left text-[15px] font-mono uppercase tracking-[0.06em] text-muted-foreground transition-colors hover:border-primary/20 hover:text-app-accent-ink">Lihat Logistik -&gt;</button> : <p className="text-[14px] font-mono text-muted-foreground">Belum ada data</p>}</div>
                      {!selectedFlowNode.isEnd ? <button type="button" onClick={() => handleRemoveNode(selectedFlowNode.id)} className="border border-destructive/20 bg-destructive/[0.04] px-2 py-1 text-[13px] font-mono uppercase tracking-[0.08em] text-destructive transition-colors hover:border-destructive/35">Hapus node</button> : null}
                    </>
                  ) : null}
                  {orderedFlowNodes.length > 0 ? <div><p className="mb-2 text-[15px] font-mono uppercase tracking-[0.08em] text-muted-foreground">Urutan</p><div className="space-y-1.5">{orderedFlowNodes.map((flowNode, index) => <button key={flowNode.id} type="button" onClick={() => setSelectedNode(flowNode)} className="w-full border border-border px-2 py-1.5 text-left transition-colors hover:border-primary/20"><p className="text-[15px] font-mono uppercase tracking-[0.08em] text-muted-foreground">{String(index + 1).padStart(2, "0")} - {flowNode.sourceLabel ?? flowNode.typeLabel}</p><p className="mt-0.5 line-clamp-2 text-[14px] text-foreground">{flowNode.title}</p></button>)}</div></div> : null}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {isCreateOpen && isCreateMinimized ? (
        <div className="fixed bottom-4 right-4 z-[80] w-[min(360px,calc(100vw-32px))] border border-border bg-card shadow-2xl">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="min-w-0 flex-1"><p className="truncate text-[14px] font-mono uppercase tracking-[0.12em] text-app-accent-ink">Tambah Sumber Job</p><p className="truncate text-[14px] text-foreground">{node.label}</p></div>
            <button type="button" onClick={() => setIsCreateMinimized(false)} className="border border-border px-3 py-1.5 text-[14px] font-mono uppercase tracking-[0.1em] text-foreground hover:text-foreground">Buka</button>
            <button type="button" onClick={() => { setIsCreateOpen(false); setIsCreateMinimized(false); }} className="flex h-7 w-7 items-center justify-center border border-border text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
          </div>
        </div>
      ) : isCreateOpen ? (
        <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-background/90 px-3 py-6 backdrop-blur-[2px] dark:bg-black/75">
          <div className="flex max-h-[calc(100vh-48px)] w-full max-w-3xl flex-col overflow-hidden border border-border bg-card shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-border bg-card px-4 py-3">
              <div><p className="text-[15px] font-mono uppercase tracking-[0.12em] text-app-accent-ink">Tambah Sumber Job</p><p className="mt-1 text-[15px] text-foreground">{node.label}</p></div>
              <div className="flex items-center gap-2"><button type="button" onClick={() => setIsCreateMinimized(true)} className="flex h-8 w-8 items-center justify-center border border-border text-muted-foreground hover:text-foreground" title="Minimize"><span className="mb-1 text-lg leading-none">-</span></button><button type="button" onClick={() => { setIsCreateOpen(false); setIsCreateMinimized(false); }} className="flex h-8 w-8 items-center justify-center border border-border text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button></div>
            </div>
            <WorkflowJobCreateForm context={workflowJobContext} references={countdownReferences} allowedTypes={allowedCreateTypes} isSaving={isCreating} onSavingChange={setIsCreating} onCancel={() => { setIsCreateOpen(false); setIsCreateMinimized(false); }} onCreated={handleCreatedWorkflowJob} />
          </div>
        </div>
      ) : null}
    </>
  );
}
