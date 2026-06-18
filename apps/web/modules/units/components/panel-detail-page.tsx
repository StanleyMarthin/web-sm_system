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
  Camera,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Download,
  Eye,
  FileText,
  FolderOpen,
  MapPin,
  PackageCheck,
  PackageSearch,
  Plus,
  Save,
  ShoppingCart,
  Trash2,
  Truck,
  Upload,
  Wrench,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
import { createCountdownRecord, fetchCountdownBoard } from "@/shared/api/countdown";
import {
  fetchWorkflowLayout,
  saveWorkflowLayout,
} from "@/shared/api/units";
import { createWo } from "@/shared/api/wo";
import { createPr } from "@/shared/api/pr";
import { createVendor } from "@/shared/api/vendor";
import { fmtDateTime } from "@/shared/format/humanize";

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
    return { label: "Belum Ada Data", tone: "unknown", className: "border-white/10 text-white/40" };
  }

  if (node.physicalStatus === "INSTALLED" || node.logisticStatus === "READY_GUDANG") {
    return { label: "BAGUS", tone: "good", className: "border-emerald-500/20 bg-emerald-500/[0.04] text-emerald-400" };
  }

  if (node.physicalStatus === "IN_DIVISION" || node.logisticStatus === "AT_VENDOR") {
    return { label: "REPAIR", tone: "repair", className: "border-amber-500/30 bg-amber-500/[0.04] text-amber-500" };
  }

  if (node.physicalStatus === "DISASSEMBLED" || node.logisticStatus === "ORDER_PR") {
    return { label: "REPLACE", tone: "replace", className: "border-red-500/20 bg-red-500/[0.04] text-red-400" };
  }

  return { label: "PERLU CEK", tone: "unknown", className: "border-white/10 text-white/40" };
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
      tone: "border-sky-400/30 bg-sky-400/10 text-sky-300",
    });
    if (node.physicalStatus === "INSTALLED") {
      items.push({
        title: "Pemeriksaan akhir",
        detail: `Progress terakhir ${Math.round(node.progressPercent ?? 0)}%`,
        date: "-",
        icon: CheckCircle2,
        tone: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
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
        tone: "border-sky-400/30 bg-sky-400/10 text-sky-300",
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
      tone: "border-sky-400/30 bg-sky-400/10 text-sky-300",
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
        tone: "border-amber-400/20 bg-amber-400/[0.08] text-amber-300",
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
    tone: "border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-300",
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
    <span className={`inline-flex items-center gap-1.5 border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] ${className}`}>
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
  if (eventType === "HANDOVER") return "border-sky-400/30 bg-sky-400/10 text-sky-300";
  if (eventType === "QC") return "border-emerald-400/30 bg-emerald-400/10 text-emerald-300";
  return "border-amber-400/30 bg-amber-400/10 text-amber-300";
}

function mapDocumentCard(document: UnitBomDocument): DocumentCard {
  const iconMap: Record<UnitBomDocument["documentType"], typeof FileText> = {
    PR: ShoppingCart,
    WOV: Wrench,
    STOCK: PackageCheck,
    TRANSFER: PackageSearch,
  };
  const toneMap: Record<UnitBomDocument["documentType"], string> = {
    PR: "border-amber-400/20 bg-amber-400/[0.08] text-amber-300",
    WOV: "border-sky-400/20 bg-sky-400/[0.08] text-sky-300",
    STOCK: "border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-300",
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

function JobTypeCombobox({
  options,
  selectedValue,
  searchValue,
  onSearchChange,
  onSelect,
}: {
  options: WorkflowDivisionOption[];
  selectedValue: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onSelect: (value: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find((option) => option.value === selectedValue) ?? null;
  const inputValue = searchValue || selectedOption?.label || "";
  const normalizedSearch = normalizeTextToken(searchValue);
  const filteredOptions = normalizedSearch
    ? options.filter((option) => normalizeTextToken(option.label).includes(normalizedSearch))
    : options;

  return (
    <div className="relative">
      <div className="flex h-10 items-center border border-white/10 bg-black transition-colors focus-within:border-amber-500/45">
        <input
          value={inputValue}
          onFocus={() => setIsOpen(true)}
          onBlur={() => window.setTimeout(() => setIsOpen(false), 120)}
          onChange={(event) => {
            const nextValue = event.target.value;
            onSearchChange(nextValue);
            if (selectedValue && nextValue !== selectedOption?.label) {
              onSelect("");
            }
            setIsOpen(true);
          }}
          placeholder="Cari atau pilih jobdesc"
          className="h-full min-w-0 flex-1 bg-transparent px-3 text-[13px] text-white outline-none placeholder:text-white/25"
        />
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setIsOpen((current) => !current)}
          className="flex h-full w-9 shrink-0 items-center justify-center text-white/30 transition-colors hover:text-white/65"
          aria-label="Buka pilihan jobdesc"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>

      {isOpen ? (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-[90] max-h-56 overflow-auto border border-white/10 bg-[#0d0d10] py-1 shadow-2xl shadow-black/50">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  onSelect(option.value);
                  onSearchChange("");
                  setIsOpen(false);
                }}
                className={[
                  "w-full px-3 py-2 text-left text-[12px] transition-colors hover:bg-amber-500/[0.08] hover:text-amber-300",
                  selectedValue === option.value ? "text-amber-300" : "text-white/70",
                ].join(" ")}
              >
                {option.label}
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-[11px] text-white/30">Tidak ada hasil</div>
          )}
        </div>
      ) : null}
    </div>
  );
}

type WorkflowNodeType = "handover" | "job" | "doc" | "wov";
type WorkflowCreateType = "COUNTDOWN" | "WO" | "PR" | "WOV";

interface WorkflowNode {
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

interface WorkflowCreateFormState {
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
  isPriority: boolean;
  taskCategory: "MAIN" | "ADDITIONAL" | "WO" | "WOV";
}

interface WorkflowCountdownReferences {
  divisions: WorkflowDivisionOption[];
  sections: WorkflowDivisionOption[];
  jobTypes: WorkflowDivisionOption[];
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

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function parseHHMMToDecimal(value: string): number {
  if (!value.trim()) return 0;
  if (!value.includes(":")) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : Number.NaN;
  }
  const [hoursText, minutesText] = value.split(":");
  const hours = Number.parseInt(hoursText ?? "0", 10);
  const minutes = Number.parseInt(minutesText ?? "0", 10);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || minutes < 0 || minutes > 59) {
    return Number.NaN;
  }
  return hours + minutes / 60;
}

function createWorkflowForm(
  node: UnitBomNode,
  defaultType: WorkflowCreateType = "COUNTDOWN",
): WorkflowCreateFormState {
  return {
    type: defaultType,
    divisionId: node.divisionId ? String(node.divisionId) : "",
    sectionName: node.section ?? node.category ?? node.label ?? "",
    jobTypeId: "",
    title: node.label ?? "",
    targetHours: "01:00",
    startDate: todayDate(),
    targetDate: todayDate(),
    qty: "1",
    uom: "pcs",
    vendorName: "",
    notes: "",
    temuanAwal: "",
    keterangan: "",
    isPriority: false,
    taskCategory: "ADDITIONAL",
  };
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
  const replaceInputRef = useRef<HTMLInputElement | null>(null);
  const [activeTab, setActiveTab] = useState<DrawerTab>("timeline");
  type PageMode = "detail" | "workflow";
  const [pageMode, setPageMode] = useState<PageMode>("detail");
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
    <div className="space-y-2">
      <div className="border border-white/5 bg-[#111114] px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-[0.12em] text-white/30">Rekam Part</p>
            <h1 className="mt-0.5 text-[15px] font-mono text-white/90">{node.label}</h1>
            <p className="mt-0.5 text-[11px] font-mono text-white/30">{hierarchyLabel(node)}</p>
          </div>
          <Link
            href={`/units/${carId}?tab=parts-panels`}
            className="inline-flex items-center gap-1.5 border border-white/10 px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.12em] text-white/40 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Kembali
          </Link>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {node.conditionType ? (
            <Badge className={
              node.conditionType === "BARU" ? "border-emerald-500/20 bg-emerald-500/[0.04] text-emerald-400" :
              node.conditionType === "RESTORE" ? "border-amber-500/20 bg-amber-500/[0.04] text-amber-400" :
              "border-white/15 bg-white/5 text-white/60"
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

          <Badge className="border-white/10 text-white/50">
            <MapPin className="h-3.5 w-3.5" />
            Lokasi: {locationDisplay}
          </Badge>

          {node.stockStatus && (
            <Badge className="border-white/10 text-white/50">
              <PackageCheck className="h-3.5 w-3.5" />
              Posisi: {node.stockStatus}
            </Badge>
          )}

          <Badge className="border-white/10 text-white/60">
            <Wrench className="h-3.5 w-3.5" />
            Status Kerja: {node.detail?.workStatusLabel ?? workStatusLabel(node)}
          </Badge>
        </div>

        {/* Mode switcher */}
        <div className="mt-3 flex items-center gap-0 border-b border-white/5">
          <div className="flex">
            {(["detail", "workflow"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setPageMode(mode)}
                className={[
                  "px-4 py-2 text-[10px] font-mono uppercase tracking-[0.12em] border-b-2 -mb-px transition-colors",
                  pageMode === mode
                    ? "border-amber-500 text-amber-500"
                    : "border-transparent text-white/30 hover:text-white/60",
                ].join(" ")}
              >
                {mode === "detail" ? "Detail" : "Workflow"}
              </button>
            ))}
          </div>

          <div className="mx-2 h-4 w-px bg-white/10" />

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
                      "px-4 py-2 text-[10px] font-mono uppercase tracking-[0.12em] border-b-2 -mb-px transition-colors",
                      isActive
                        ? "border-amber-500 text-amber-500"
                        : "border-transparent text-white/40 hover:text-white/70",
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
            <div className="overflow-x-auto border border-white/5 bg-[#111114]">
              <table className="min-w-full text-left text-[12px] text-white">
                <thead>
                  <tr className="border-b border-white/[0.06] bg-[#0a0a0c] font-mono text-[10px] uppercase tracking-[0.12em] text-white/30">
                    <th className="px-4 py-3 font-medium">Tanggal</th>
                    <th className="px-4 py-3 font-medium">Riwayat</th>
                    <th className="px-4 py-3 font-medium">Keterangan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {timeline.length > 0 ? (
                    orderedTimeline.map((item, index) => {
                      return (
                        <tr key={`${item.eventType ?? "event"}-${item.title}-${item.date ?? "no-date"}-${index}`} className="transition-colors hover:bg-white/[0.015]">
                          <td className="whitespace-nowrap px-4 py-4 align-top text-[12px] text-white/35">
                            {item.date ?? "-"}
                          </td>
                          <td className="px-4 py-4 align-top">
                            <span className="font-medium">{item.title}</span>
                          </td>
                          <td className="px-4 py-4 align-top text-white/60">
                            {item.detail}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={3} className="px-4 py-6 text-center text-[11px] font-mono text-white/25">
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
                <div className="border border-white/5 bg-[#111114] px-4 py-3 text-[11px] font-mono text-white/35">
                  Memuat foto pengerjaan...
                </div>
              ) : null}

              {galleryState.actualId === node.actualId && galleryState.error ? (
                <div className="border border-amber-500/20 bg-amber-500/[0.04] px-4 py-3 text-[11px] font-mono text-amber-400">
                  {galleryState.error}
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-3">
                {photoSlots.map((slot) => {
                  const Icon = slot.icon;
                  return (
                    <div
                      key={slot.label}
                      className="min-h-[150px] border border-white/5 bg-[#111114] p-3"
                    >
                      <div className="flex h-full flex-col justify-between">
                        {slot.latestPhotoUrl ? (
                          <button
                            type="button"
                            onClick={() => window.open(getProxiedImageUrl(slot.latestPhotoUrl), "_blank", "noopener,noreferrer")}
                            className="h-16 w-full bg-cover bg-center border border-white/5"
                            style={{ backgroundImage: `url(${getProxiedImageUrl(slot.latestPhotoUrl)})` }}
                            aria-label={slot.caption}
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center border border-white/5 bg-[#0a0a0c] text-white/70">
                            <Icon className="h-5 w-5" />
                          </div>
                        )}
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[12px] font-mono text-white/80">{slot.label}</p>
                            <span className="border border-white/10 px-1.5 py-0.5 text-[10px] text-white/55">{slot.photoCount} foto</span>
                          </div>
                          <p className="mt-1 text-[11px] text-white/30">{slot.caption}</p>
                          {slot.latestPhotoAt ? <p className="mt-1 text-[10px] text-white/30">{formatShortDate(slot.latestPhotoAt)}</p> : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {canMutatePhotos ? (
                <div className="border border-white/5 bg-[#111114] px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Upload className="h-4 w-4 text-amber-400" />
                    <h3 className="text-[10px] font-mono uppercase tracking-[0.12em] text-white/30">Tambah Foto</h3>
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
                <div className="border border-white/5 bg-[#111114] p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-[10px] font-mono uppercase tracking-[0.12em] text-white/30">Foto Tersimpan</h3>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="border border-white/10 px-2 py-0.5 font-mono text-[10px] text-white/45">
                        {galleryPhotos.length} foto
                      </span>
                      {canDownloadPhotos ? (
                        <button
                          type="button"
                          onClick={() => {
                            void handleDownloadSelected();
                          }}
                          disabled={selectedPhotos.length === 0}
                          className="inline-flex items-center gap-1.5 border border-white/10 px-2.5 py-1 font-mono text-[10px] text-white/60 hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
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
                          className={`overflow-hidden border bg-[#111114] transition-colors ${isSelected ? "border-amber-400/35" : "border-white/[0.06]"
                            }`}
                        >
                          <div className="relative">
                            <label className="absolute left-2.5 top-2.5 z-[1] flex h-6 w-6 cursor-pointer items-center justify-center border border-white/20 bg-black/55">
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
                                className="h-3 w-3 rounded accent-amber-500"
                              />
                            </label>
                            <span className="absolute right-2.5 top-2.5 z-[1] bg-[#0a0a0c] border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-white/70">
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
                              <p className="line-clamp-2 text-xs text-white/55">
                                {photo.caption || "Tidak ada keterangan foto."}
                              </p>
                            )}

                            <div className="flex flex-wrap gap-x-2 gap-y-1 text-[10px] text-white/35">
                              <span>{photo.uploadedByName || photo.uploadedBy || "-"}</span>
                              <span>-</span>
                              <span>{fmtDateTime(photo.uploadedAt)}</span>
                              <span>-</span>
                              <span>{photo.source}</span>
                            </div>

                            <div className="flex flex-wrap gap-1.5 border-t border-white/[0.06] pt-3">
                              <button
                                type="button"
                                onClick={() => window.open(photoUrl, "_blank", "noopener,noreferrer")}
                                className="inline-flex items-center gap-1 border border-white/10 px-2 py-0.5 font-mono text-[10px] text-white/60 hover:text-white"
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
                                  className="inline-flex items-center gap-1 border border-white/10 px-2 py-0.5 font-mono text-[10px] text-white/60 hover:text-white"
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
                                    className="border border-white/10 px-2 py-0.5 font-mono text-[10px] text-white/60 hover:text-white disabled:opacity-35"
                                  >
                                    Ganti
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() => {
                                      void handleDeletePhoto(photo.photoId);
                                    }}
                                    className="inline-flex items-center gap-1 border border-red-500/20 bg-red-500/[0.04] px-2 py-0.5 font-mono text-[10px] text-red-400 disabled:opacity-35"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                    Hapus
                                  </button>
                                </>
                              ) : (
                                <span className="border border-white/5 px-2 py-0.5 font-mono text-[10px] text-white/20">
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
                    <article key={document.title} className="border border-white/5 bg-[#111114] px-4 py-3">
                      <div className="flex items-start gap-3">
                        <div className={`flex h-7 w-7 shrink-0 items-center justify-center border ${document.tone}`}>
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <div>
                          <h3 className="text-[12px] font-mono text-white/80">{document.title}</h3>
                          <p className="mt-1 text-[11px] text-white/40">{document.detail}</p>
                        </div>
                      </div>
                    </article>
                  );
                })
              ) : (
                <div className="border border-dashed border-white/10 px-4 py-8 text-center">
                  <FolderOpen className="mx-auto h-5 w-5 text-white/20" />
                  <h3 className="mt-4 text-[11px] font-mono text-white/30">Tidak ada data logistik</h3>
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
  );
}

interface WorkflowBuilderProps {
  carId: string;
  node: UnitBomNode;
  workflowSources: WorkflowNode[];
  allowedCreateTypes: WorkflowCreateType[];
  canSaveCanvas: boolean;
  onWorkflowOrderChange: (order: string[]) => void;
  onNavigateToPhotos: () => void;
  onNavigateToDocuments: () => void;
}

function WorkflowBuilder({
  carId,
  node,
  workflowSources,
  allowedCreateTypes,
  canSaveCanvas,
  onWorkflowOrderChange,
  onNavigateToPhotos,
  onNavigateToDocuments,
}: WorkflowBuilderProps) {
  type AnchorSide = "top" | "right" | "bottom" | "left";
  type FlowCanvasNode = WorkflowNode & { x: number; y: number; width: number; height: number; isEnd?: boolean };
  type FlowConnection = {
    id: string;
    fromId: string;
    toId: string;
    fromSide: AnchorSide;
    toSide: AnchorSide;
    bendX?: number;
    bendY?: number;
  };

  const defaultNodeWidth = 220;
  const defaultNodeHeight = 86;
  const minNodeWidth = 160;
  const minNodeHeight = 72;

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nodeDragRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    offsetX: number;
    offsetY: number;
    moved: boolean;
    fromSide: AnchorSide;
  } | null>(null);
  const nodeResizeRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    width: number;
    height: number;
  } | null>(null);
  const connectionDragRef = useRef<{ id: string; axis: "x" | "y" } | null>(null);
  const connectTargetIdRef = useRef<string | null>(null);

  const createEndNode = useCallback((): FlowCanvasNode => {
    return {
      id: "workflow-end",
      type: "job",
      typeLabel: "Selesai",
      title: "Selesai",
      meta: "Alur kerja selesai",
      badge: "End",
      status: "done",
      statusLabel: "Selesai",
      x: 760,
      y: 300,
      width: 180,
      height: 82,
      isEnd: true,
    };
  }, []);

  const [flowNodes, setFlowNodes] = useState<FlowCanvasNode[]>(() => [createEndNode()]);
  const [connections, setConnections] = useState<FlowConnection[]>([]);
  const [selectedFlowNode, setSelectedFlowNode] = useState<FlowCanvasNode | null>(null);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [connectFromId, setConnectFromId] = useState<string | null>(null);
  const [connectTargetId, setConnectTargetId] = useState<string | null>(null);
  const [connectPreview, setConnectPreview] = useState<{ fromId: string; fromSide: AnchorSide; x: number; y: number } | null>(null);
  const [dragFrom, setDragFrom] = useState<"list" | null>(null);
  const [dragSrcId, setDragSrcId] = useState<string | null>(null);
  const [printSvg, setPrintSvg] = useState<string>("");
  const [localWorkflowSources, setLocalWorkflowSources] = useState<WorkflowNode[]>(workflowSources);
  const [countdownReferences, setCountdownReferences] = useState<WorkflowCountdownReferences>({
    divisions: [],
    sections: [],
    jobTypes: [],
  });
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreateMinimized, setIsCreateMinimized] = useState(false);
  const [jobTypeSearch, setJobTypeSearch] = useState("");
  const defaultCreateType = allowedCreateTypes[0] ?? "COUNTDOWN";
  const [createForm, setCreateForm] = useState<WorkflowCreateFormState>(() => createWorkflowForm(node, defaultCreateType));
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const workflowScopeId = node.actualId ?? (node.panelId ? `panel-${node.panelId}` : node.nodeId);
  const storageKey = `unit-panel-workflow:${node.nodeId}:${node.panelId ?? "panel"}`;

  useEffect(() => {
    setLocalWorkflowSources((current) => {
      const manualSources = current.filter((source) => source.id.startsWith("manual-"));
      const next = [...workflowSources];
      for (const manualSource of manualSources) {
        if (!next.some((source) => source.id === manualSource.id)) {
          next.push(manualSource);
        }
      }
      return next;
    });
  }, [workflowSources]);

  useEffect(() => {
    setCreateForm(createWorkflowForm(node, defaultCreateType));
  }, [node, defaultCreateType]);

  useEffect(() => {
    let cancelled = false;

    function applySavedLayout(saved: {
      nodeLayouts?: Array<Pick<FlowCanvasNode, "id" | "x" | "y" | "width" | "height">>;
      nodes?: FlowCanvasNode[];
      connections?: FlowConnection[];
      order?: string[];
      sources?: WorkflowNode[];
    }) {
      if (Array.isArray(saved.order)) {
        onWorkflowOrderChange(saved.order);
      }
      const layoutNodes = saved.nodeLayouts ?? saved.nodes;
      if (Array.isArray(layoutNodes)) {
        const sourceById = new Map(workflowSources.map((source) => [source.id, source]));
        const mergedNodes = layoutNodes.map((savedNode) => {
          if (savedNode.id === "workflow-end") {
            return {
              ...createEndNode(),
              x: savedNode.x,
              y: savedNode.y,
              width: savedNode.width,
              height: savedNode.height,
            };
          }
          const timelineIndex = savedNode.id.match(/^timeline-(\d+)-/u)?.[1];
          const latestSource = sourceById.get(savedNode.id)
            ?? (timelineIndex ? workflowSources[Number.parseInt(timelineIndex, 10)] : undefined);
          return latestSource
            ? {
                ...latestSource,
                id: savedNode.id,
                x: savedNode.x,
                y: savedNode.y,
                width: savedNode.width,
                height: savedNode.height,
              }
            : null;
        }).filter((item): item is FlowCanvasNode => Boolean(item));
        const hasEnd = mergedNodes.some((item) => item.id === "workflow-end");
        setFlowNodes(hasEnd ? mergedNodes : [...mergedNodes, createEndNode()]);
        if (Array.isArray(saved.connections)) {
          const validNodeIds = new Set(mergedNodes.map((item) => item.id));
          setConnections(saved.connections.filter((connection) =>
            validNodeIds.has(connection.fromId) && validNodeIds.has(connection.toId),
          ));
        }
      } else if (Array.isArray(saved.connections)) {
        setConnections(saved.connections);
      }
    }

    function loadLocalFallback() {
      const saved = window.localStorage.getItem(storageKey);
      if (!saved) return false;

      try {
        applySavedLayout(JSON.parse(saved) as {
          nodeLayouts?: Array<Pick<FlowCanvasNode, "id" | "x" | "y" | "width" | "height">>;
          nodes?: FlowCanvasNode[];
          connections?: FlowConnection[];
        });
        return true;
      } catch {
        window.localStorage.removeItem(storageKey);
        return false;
      }
    }

    async function loadSharedLayout() {
      setSaveMessage("Memuat canvas");
      const result = await fetchWorkflowLayout("", carId, workflowScopeId);
      if (cancelled) return;

      if (result.payload?.data.layout) {
        applySavedLayout(result.payload.data.layout as {
          nodeLayouts?: Array<Pick<FlowCanvasNode, "id" | "x" | "y" | "width" | "height">>;
          connections?: FlowConnection[];
        });
        setSaveMessage("Canvas shared siap");
        window.setTimeout(() => setSaveMessage(null), 1200);
        return;
      }

      if (loadLocalFallback()) {
        setSaveMessage("Canvas lokal dimuat");
        window.setTimeout(() => setSaveMessage(null), 1600);
        return;
      }

      setSaveMessage(null);
    }

    void loadSharedLayout();

    return () => {
      cancelled = true;
    };
  }, [carId, createEndNode, onWorkflowOrderChange, workflowScopeId, storageKey, workflowSources]);

  useEffect(() => {
    let cancelled = false;

    async function loadDivisions() {
      const response = await fetchCountdownBoard("", { limit: "1" });
      if (cancelled) return;
      const references = response.payload?.references;
      setCountdownReferences({
        divisions: (references?.divisions ?? []).map((division) => ({
          value: division.value,
          label: division.label,
          parentId: division.parentId,
          parentName: division.parentName,
          parentCode: division.parentCode,
        })),
        sections: (references?.sections ?? []).map((section) => ({
          value: section.value,
          label: section.label,
        })),
        jobTypes: (references?.jobTypes ?? []).map((jobType) => ({
          value: jobType.value,
          label: jobType.label,
          divisionId: jobType.divisionId,
          divisionName: jobType.divisionName,
          divisionParentId: jobType.divisionParentId,
        })),
      });
    }

    void loadDivisions();

    return () => {
      cancelled = true;
    };
  }, []);

  function handleListDragStart(id: string) {
    setDragFrom("list");
    setDragSrcId(id);
  }

  function getCanvasPoint(event: React.DragEvent<HTMLDivElement>) {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 24, y: 24 };
    return {
      x: Math.max(16, Math.round(event.clientX - rect.left - 110)),
      y: Math.max(16, Math.round(event.clientY - rect.top - 42)),
    };
  }

  function handleCanvasDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const point = getCanvasPoint(event);

    if (dragFrom === "list" && dragSrcId) {
      const job = localWorkflowSources.find((j) => j.id === dragSrcId);
      if (!job || flowNodes.find((n) => n.id === job.id)) return;
      setFlowNodes((prev) => [...prev, { ...job, x: point.x, y: point.y, width: defaultNodeWidth, height: defaultNodeHeight }]);
      setDragSrcId(null);
      setDragFrom(null);
      return;
    }

    setDragSrcId(null);
    setDragFrom(null);
  }

  function clearLongPressTimer() {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }

  function getCanvasMousePoint(event: React.MouseEvent<HTMLDivElement> | MouseEvent) {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: Math.max(0, Math.round(event.clientX - rect.left)),
      y: Math.max(0, Math.round(event.clientY - rect.top)),
    };
  }

  function getAnchorSideAtPoint(flowNode: FlowCanvasNode, point: { x: number; y: number }): AnchorSide {
    const distances: Array<{ side: AnchorSide; value: number }> = [
      { side: "left", value: Math.abs(point.x - flowNode.x) },
      { side: "right", value: Math.abs(point.x - (flowNode.x + flowNode.width)) },
      { side: "top", value: Math.abs(point.y - flowNode.y) },
      { side: "bottom", value: Math.abs(point.y - (flowNode.y + flowNode.height)) },
    ];
    distances.sort((a, b) => a.value - b.value);
    return distances[0]?.side ?? "right";
  }

  function getAnchorPoint(flowNode: FlowCanvasNode, side: AnchorSide) {
    if (side === "left") return { x: flowNode.x, y: flowNode.y + flowNode.height / 2 };
    if (side === "right") return { x: flowNode.x + flowNode.width, y: flowNode.y + flowNode.height / 2 };
    if (side === "top") return { x: flowNode.x + flowNode.width / 2, y: flowNode.y };
    return { x: flowNode.x + flowNode.width / 2, y: flowNode.y + flowNode.height };
  }

  function offsetAnchor(point: { x: number; y: number }, side: AnchorSide, amount: number) {
    if (side === "left") return { x: point.x - amount, y: point.y };
    if (side === "right") return { x: point.x + amount, y: point.y };
    if (side === "top") return { x: point.x, y: point.y - amount };
    return { x: point.x, y: point.y + amount };
  }

  function buildOrthogonalPath(
    start: { x: number; y: number },
    end: { x: number; y: number },
    fromSide: AnchorSide,
    toSide: AnchorSide,
    bend?: number,
  ) {
    const exitPoint = offsetAnchor(start, fromSide, 28);
    const entryPoint = offsetAnchor(end, toSide, 28);
    const entryCmd = toSide === "left" || toSide === "right"
      ? `H ${end.x}`
      : `V ${end.y}`;

    if (fromSide === "left" || fromSide === "right") {
      const midX = bend ?? Math.round((exitPoint.x + entryPoint.x) / 2);
      return `M ${start.x} ${start.y} H ${exitPoint.x} H ${midX} V ${entryPoint.y} H ${entryPoint.x} ${entryCmd}`;
    }

    const midY = bend ?? Math.round((exitPoint.y + entryPoint.y) / 2);
    return `M ${start.x} ${start.y} V ${exitPoint.y} V ${midY} H ${entryPoint.x} V ${entryPoint.y} ${entryCmd}`;
  }

  function connectionBendPoint(connection: FlowConnection) {
    const from = flowNodes.find((flowNode) => flowNode.id === connection.fromId);
    const to = flowNodes.find((flowNode) => flowNode.id === connection.toId);
    if (!from || !to) return null;
    const start = getAnchorPoint(from, connection.fromSide);
    const end = getAnchorPoint(to, connection.toSide);
    const exitPoint = offsetAnchor(start, connection.fromSide, 28);
    const entryPoint = offsetAnchor(end, connection.toSide, 28);

    if (connection.fromSide === "left" || connection.fromSide === "right") {
      const bendX = connection.bendX ?? Math.round((exitPoint.x + entryPoint.x) / 2);
      return { x: bendX, y: Math.round((exitPoint.y + entryPoint.y) / 2), axis: "x" as const };
    }

    const bendY = connection.bendY ?? Math.round((exitPoint.y + entryPoint.y) / 2);
    return { x: Math.round((exitPoint.x + entryPoint.x) / 2), y: bendY, axis: "y" as const };
  }

  function createConnection(fromId: string, toId: string, fromSide: AnchorSide, toSide: AnchorSide) {
    if (fromId === toId) return;
    const connectionId = `${fromId}:${fromSide}->${toId}:${toSide}`;
    setConnections((prev) =>
      prev.some((connection) => connection.id === connectionId)
        ? prev
        : [...prev, { id: connectionId, fromId, toId, fromSide, toSide }],
    );
    setSelectedConnectionId(connectionId);
    setSelectedFlowNode(null);
  }

  function startConnectionFromHandle(flowNode: FlowCanvasNode, fromSide: AnchorSide, event: React.MouseEvent<HTMLElement>) {
    event.stopPropagation();
    clearLongPressTimer();
    nodeDragRef.current = null;
    const anchorPoint = getAnchorPoint(flowNode, fromSide);
    setConnectFromId(flowNode.id);
    setConnectTargetId(null);
    connectTargetIdRef.current = null;
    setConnectPreview({ fromId: flowNode.id, fromSide, x: anchorPoint.x, y: anchorPoint.y });
    setSelectedFlowNode(flowNode);
    setSelectedConnectionId(null);
  }

  function handleNodeMouseDown(flowNode: FlowCanvasNode, event: React.MouseEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    clearLongPressTimer();
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (!canvasRect) return;
    const startPoint = getCanvasMousePoint(event.nativeEvent);

    nodeDragRef.current = {
      id: flowNode.id,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: event.clientX - canvasRect.left - flowNode.x,
      offsetY: event.clientY - canvasRect.top - flowNode.y,
      moved: false,
      fromSide: getAnchorSideAtPoint(flowNode, startPoint),
    };

    longPressTimerRef.current = setTimeout(() => {
      const fromSide = nodeDragRef.current?.fromSide ?? getAnchorSideAtPoint(flowNode, startPoint);
      nodeDragRef.current = null;
      const point = getCanvasMousePoint(event.nativeEvent);
      setConnectFromId(flowNode.id);
      setConnectPreview({ fromId: flowNode.id, fromSide, x: point.x, y: point.y });
      setSelectedFlowNode(flowNode);
      setSelectedConnectionId(null);
      longPressTimerRef.current = null;
    }, 420);
  }

  function handleCanvasMouseMove(event: React.MouseEvent<HTMLDivElement>) {
    const activeResize = nodeResizeRef.current;
    if (activeResize) {
      const width = Math.max(minNodeWidth, Math.round(activeResize.width + event.clientX - activeResize.startX));
      const height = Math.max(minNodeHeight, Math.round(activeResize.height + event.clientY - activeResize.startY));
      setFlowNodes((prev) =>
        prev.map((flowNode) =>
          flowNode.id === activeResize.id ? { ...flowNode, width, height } : flowNode,
        ),
      );
      setSelectedFlowNode((current) => current && current.id === activeResize.id ? { ...current, width, height } : current);
      return;
    }

    const activeConnectionDrag = connectionDragRef.current;
    if (activeConnectionDrag) {
      const point = getCanvasMousePoint(event);
      setConnections((prev) =>
        prev.map((connection) =>
          connection.id === activeConnectionDrag.id
            ? activeConnectionDrag.axis === "x"
              ? { ...connection, bendX: point.x }
              : { ...connection, bendY: point.y }
            : connection,
        ),
      );
      return;
    }

    if (connectFromId) {
      const point = getCanvasMousePoint(event);
      setConnectPreview((current) => current ? { ...current, x: point.x, y: point.y } : null);
      return;
    }

    const activeDrag = nodeDragRef.current;
    if (!activeDrag) return;

    const deltaX = event.clientX - activeDrag.startX;
    const deltaY = event.clientY - activeDrag.startY;
    if (!activeDrag.moved && Math.hypot(deltaX, deltaY) < 5) return;

    clearLongPressTimer();
    activeDrag.moved = true;
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (!canvasRect) return;
    const x = Math.max(16, Math.round(event.clientX - canvasRect.left - activeDrag.offsetX));
    const y = Math.max(16, Math.round(event.clientY - canvasRect.top - activeDrag.offsetY));

    setFlowNodes((prev) =>
      prev.map((flowNode) =>
        flowNode.id === activeDrag.id ? { ...flowNode, x, y } : flowNode,
      ),
    );
    setSelectedFlowNode((current) => current && current.id === activeDrag.id ? { ...current, x, y } : current);
  }

  function handleCanvasMouseUp() {
    clearLongPressTimer();
    connectionDragRef.current = null;
    nodeResizeRef.current = null;

    if (connectFromId) {
      const targetId = connectTargetIdRef.current;
      const targetNode = flowNodes.find((flowNode) => flowNode.id === targetId);
      if (targetNode && connectPreview) {
        createConnection(
          connectFromId,
          targetNode.id,
          connectPreview.fromSide,
          getAnchorSideAtPoint(targetNode, { x: connectPreview.x, y: connectPreview.y }),
        );
      }
      setConnectFromId(null);
      setConnectPreview(null);
      setConnectTargetId(null);
      connectTargetIdRef.current = null;
      nodeDragRef.current = null;
      return;
    }

    const activeDrag = nodeDragRef.current;
    if (activeDrag && !activeDrag.moved) {
      const flowNode = flowNodes.find((item) => item.id === activeDrag.id);
      if (flowNode) {
        setSelectedFlowNode((current) => current?.id === flowNode.id ? null : flowNode);
        setSelectedConnectionId(null);
      }
    }
    nodeDragRef.current = null;
  }

  function handleRemoveNode(id: string) {
    if (id === "workflow-end") return;
    setFlowNodes((prev) => prev.filter((flowNode) => flowNode.id !== id));
    setConnections((prev) => prev.filter((connection) => connection.fromId !== id && connection.toId !== id));
    if (selectedFlowNode?.id === id) setSelectedFlowNode(null);
    setSelectedConnectionId((current) => {
      const selectedConnection = connections.find((connection) => connection.id === current);
      return selectedConnection && (selectedConnection.fromId === id || selectedConnection.toId === id) ? null : current;
    });
    if (connectFromId === id) setConnectFromId(null);
    if (connectTargetId === id) setConnectTargetId(null);
  }

  function handleClearFlow() {
    setFlowNodes([createEndNode()]);
    setConnections([]);
    setSelectedFlowNode(null);
    setSelectedConnectionId(null);
    setConnectFromId(null);
    setConnectTargetId(null);
    setConnectPreview(null);
    connectTargetIdRef.current = null;
  }

  function getOrderedFlowNodes() {
    const nodes = flowNodes.filter((flowNode) => !flowNode.isEnd);
    const byId = new Map(nodes.map((flowNode) => [flowNode.id, flowNode]));
    const outgoing = new Map<string, FlowConnection[]>();
    const incomingCount = new Map<string, number>();

    for (const nodeItem of nodes) {
      incomingCount.set(nodeItem.id, 0);
    }

    for (const connection of connections) {
      if (!byId.has(connection.fromId) || !byId.has(connection.toId)) continue;
      outgoing.set(connection.fromId, [...(outgoing.get(connection.fromId) ?? []), connection]);
      incomingCount.set(connection.toId, (incomingCount.get(connection.toId) ?? 0) + 1);
    }

    const sortByCanvas = (left: FlowCanvasNode, right: FlowCanvasNode) =>
      left.y === right.y ? left.x - right.x : left.y - right.y;
    const starts = nodes
      .filter((flowNode) => (incomingCount.get(flowNode.id) ?? 0) === 0)
      .sort(sortByCanvas);
    const ordered: FlowCanvasNode[] = [];
    const visited = new Set<string>();

    function visit(flowNode: FlowCanvasNode) {
      if (visited.has(flowNode.id)) return;
      visited.add(flowNode.id);
      ordered.push(flowNode);
      const nextConnections = (outgoing.get(flowNode.id) ?? [])
        .map((connection) => byId.get(connection.toId))
        .filter((item): item is FlowCanvasNode => Boolean(item))
        .sort(sortByCanvas);
      for (const nextNode of nextConnections) {
        visit(nextNode);
      }
    }

    for (const start of starts) visit(start);
    for (const remaining of nodes.filter((flowNode) => !visited.has(flowNode.id)).sort(sortByCanvas)) {
      visit(remaining);
    }

    return ordered;
  }

  async function handleSaveCanvas() {
    const order = getOrderedFlowNodes().map((flowNode) => flowNode.id);
    const layout = {
      version: 2 as const,
      nodeLayouts: flowNodes.map((flowNode) => ({
        id: flowNode.id,
        x: flowNode.x,
        y: flowNode.y,
        width: flowNode.width,
        height: flowNode.height,
      })),
      connections,
      order,
      savedAt: new Date().toISOString(),
    };

    setSaveMessage("Menyimpan");
    const result = await saveWorkflowLayout(carId, workflowScopeId, layout);
    if (!result.success) {
      window.localStorage.setItem(storageKey, JSON.stringify(layout));
      onWorkflowOrderChange(order);
      setSaveMessage("Redis gagal - disimpan lokal");
      window.setTimeout(() => setSaveMessage(null), 2400);
      return;
    }

    window.localStorage.removeItem(storageKey);
    onWorkflowOrderChange(order);
    setSaveMessage("Canvas shared tersimpan");
    window.setTimeout(() => setSaveMessage(null), 1800);
  }

  function selectedDivision() {
    const fallbackValue = node.divisionId ? String(node.divisionId) : "";
    const value = createForm.divisionId || fallbackValue;
    const option = countdownReferences.divisions.find((item) => item.value === value);
    return {
      id: Number(value),
      name: option?.label ?? node.divisionName ?? "",
    };
  }

  function visibleCountdownJobTypes() {
    const selectedDivisionId = createForm.divisionId;
    if (!selectedDivisionId) return countdownReferences.jobTypes;
    const selectedDivisionOption = countdownReferences.divisions.find((division) => division.value === selectedDivisionId);
    const selectedParentId = selectedDivisionOption?.parentId ?? null;
    const selectedParentCode = (selectedDivisionOption?.parentCode ?? selectedDivisionOption?.parentName ?? "").trim().toUpperCase();
    const includeMechanicParent = selectedParentId !== null && selectedParentCode === "MECHANIC";
    return countdownReferences.jobTypes.filter((jobType) => {
      if (jobType.divisionId === null || jobType.divisionId === undefined) return true;
      if (String(jobType.divisionId) === selectedDivisionId) return true;
      return includeMechanicParent && jobType.divisionId === selectedParentId;
    });
  }

  function addCreatedSource(params: {
    type: WorkflowCreateType;
    title: string;
    meta: string;
    idSuffix: string;
  }) {
    const sourceType: WorkflowNodeType =
      params.type === "PR" ? "doc" : params.type === "WOV" ? "wov" : "job";
    const source: WorkflowNode = {
      id: `manual-${params.type.toLowerCase()}-${params.idSuffix}`,
      type: sourceType,
      typeLabel:
        params.type === "COUNTDOWN"
          ? "Countdown"
          : params.type === "WO"
          ? "WO"
          : params.type === "PR"
          ? "PR Logistik"
          : "WOV - Vendor",
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
  }

  async function handleCreateWorkflowJob() {
    const division = selectedDivision();
    const divisionId = Number.isFinite(division.id) ? division.id : 0;
    const title = createForm.title.trim() || node.label;
    const targetDate = createForm.targetDate || todayDate();
    const targetHours = parseHHMMToDecimal(createForm.targetHours || "0:00");
    const qty = Number(createForm.qty || 1);

    setCreateError(null);

    if (!divisionId && createForm.type !== "WOV") {
      setCreateError("Divisi wajib dipilih.");
      return;
    }
    if (!title.trim()) {
      setCreateError("Nama pekerjaan wajib diisi.");
      return;
    }
    if (createForm.type === "COUNTDOWN") {
      if (!createForm.sectionName.trim()) {
        setCreateError("Section wajib dipilih.");
        return;
      }
      if (!createForm.jobTypeId.trim()) {
        setCreateError("Jobdesc wajib dipilih dari master jobdesc.");
        return;
      }
      if (!Number.isFinite(targetHours) || targetHours < 0) {
        setCreateError("Target jam wajib format HHH:MM.");
        return;
      }
    }
    if (createForm.type === "WOV" && !createForm.vendorName.trim()) {
      setCreateError("Vendor wajib diisi untuk WOV.");
      return;
    }

    setIsCreating(true);
    try {
      let result:
        | Awaited<ReturnType<typeof createCountdownRecord>>
        | Awaited<ReturnType<typeof createWo>>
        | Awaited<ReturnType<typeof createPr>>
        | Awaited<ReturnType<typeof createVendor>>;

      if (createForm.type === "COUNTDOWN") {
        result = await createCountdownRecord({
          carId,
          divisionId,
          panelId: node.panelId,
          taskCategory: createForm.taskCategory,
          sectionName: createForm.sectionName.trim(),
          jobTypeId: createForm.jobTypeId.trim(),
          targetHoursInitial: targetHours,
          startDate: createForm.startDate || null,
          deadlineDate: targetDate,
          note: createForm.notes.trim() || null,
          temuanAwal: createForm.temuanAwal.trim() || null,
          keterangan: createForm.keterangan.trim() || `Panel: ${node.label}`,
          status: "PLAN",
        });
      } else if (createForm.type === "WO") {
        const woJobDetail = [`Qty: ${Number.isFinite(qty) && qty > 0 ? qty : 1}`, title]
          .filter(Boolean)
          .join("\n");
        result = await createWo({
          carId,
          toDivisionId: divisionId,
          requestDate: targetDate,
          isPriority: createForm.isPriority,
          panelName: node.label,
          jobDetail: woJobDetail,
          estimatedHours: null,
          notes: createForm.notes.trim() || null,
          items: [{
            panelName: node.label,
            sectionName: node.section,
            panelCategory: node.category,
            addPanelToMaster: false,
            jobDetail: woJobDetail,
            notes: createForm.notes.trim() || null,
            estimatedHours: null,
          }],
        });
      } else if (createForm.type === "PR") {
        result = await createPr({
          carId,
          divisionName: division.name || null,
          targetDate,
          priority: "NORMAL",
          notes: createForm.notes.trim() || null,
          items: [{
            itemName: node.label,
            description: title,
            originType: "LOKAL",
            qty: Number.isFinite(qty) && qty > 0 ? qty : 1,
            uom: createForm.uom.trim() || "pcs",
            estimatedPrice: null,
            photoUrl: null,
          }],
        });
      } else {
        result = await createVendor({
          carId,
          coreId: null,
          prId: null,
          vendorId: null,
          vendorName: createForm.vendorName.trim(),
          picVendor: null,
          itemName: node.label,
          quantity: Number.isFinite(qty) && qty > 0 ? qty : null,
          uom: createForm.uom.trim() || null,
          goodsConditionOut: createForm.notes.trim() || null,
          targetDateReturn: targetDate,
          estimatedCost: null,
          remarks: title,
          items: [{
            itemName: node.label,
            quantity: Number.isFinite(qty) && qty > 0 ? qty : null,
            uom: createForm.uom.trim() || null,
            goodsConditionOut: createForm.notes.trim() || null,
            estimatedCost: null,
          }],
        });
      }

      if (!result.success) {
        setCreateError(result.message);
        return;
      }

      const idSuffix =
        "result" in result && typeof result.result === "object"
          ? Object.values(result.result as Record<string, unknown>)[0]?.toString() ?? `${Date.now()}`
          : `${Date.now()}`;
      addCreatedSource({
        type: createForm.type,
        title,
        meta: `${node.label} - ${division.name || "Divisi mengikuti request"}`,
        idSuffix,
      });
      setIsCreateOpen(false);
      setIsCreateMinimized(false);
      setJobTypeSearch("");
      setCreateForm(createWorkflowForm(node));
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Sumber job belum bisa dibuat.");
    } finally {
      setIsCreating(false);
    }
  }

  function connectionPath(connection: FlowConnection) {
    const from = flowNodes.find((flowNode) => flowNode.id === connection.fromId);
    const to = flowNodes.find((flowNode) => flowNode.id === connection.toId);
    if (!from || !to) return null;
    return buildOrthogonalPath(
      getAnchorPoint(from, connection.fromSide),
      getAnchorPoint(to, connection.toSide),
      connection.fromSide,
      connection.toSide,
      connection.fromSide === "left" || connection.fromSide === "right" ? connection.bendX : connection.bendY,
    );
  }

  function previewPath() {
    if (!connectPreview) return null;
    const from = flowNodes.find((flowNode) => flowNode.id === connectPreview.fromId);
    if (!from) return null;
    return buildOrthogonalPath(
      getAnchorPoint(from, connectPreview.fromSide),
      { x: connectPreview.x, y: connectPreview.y },
      connectPreview.fromSide,
      getAnchorSideAtPoint(from, { x: connectPreview.x, y: connectPreview.y }),
    );
  }

  function handleDeleteSelectedConnection() {
    if (!selectedConnectionId) return;
    setConnections((prev) => prev.filter((connection) => connection.id !== selectedConnectionId));
    setSelectedConnectionId(null);
  }

  function handleCanvasKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Backspace" && event.key !== "Delete") return;
    if (!selectedConnectionId && !selectedFlowNode) return;
    event.preventDefault();

    if (selectedConnectionId) {
      handleDeleteSelectedConnection();
      return;
    }

    if (selectedFlowNode && !selectedFlowNode.isEnd) {
      handleRemoveNode(selectedFlowNode.id);
    }
  }

  function escapeXml(value: string) {
    return value.replace(/&/gu, "&amp;").replace(/</gu, "&lt;").replace(/>/gu, "&gt;").replace(/"/gu, "&quot;");
  }

  function renderExportSvg() {
    const nodes = flowNodes.length > 0 ? flowNodes : [createEndNode()];
    const maxX = Math.max(960, ...nodes.map((item) => item.x + item.width + 80));
    const maxY = Math.max(680, ...nodes.map((item) => item.y + item.height + 80));
    const connectionMarkup = connections
      .map((connection) => connectionPath(connection))
      .filter(Boolean)
      .map((path) => `<path d="${path}" fill="none" stroke="#ba7517" stroke-width="2" marker-end="url(#arrow)" />`)
      .join("");
    const nodeMarkup = nodes
      .map((item) => {
        const stroke = item.isEnd ? "#10b981" : item.type === "handover" ? "#185fa5" : item.type === "doc" ? "#993c1d" : item.type === "wov" ? "#534ab7" : "#ba7517";
        return `
          <g>
            <rect x="${item.x}" y="${item.y}" width="${item.width}" height="${item.height}" fill="#111114" stroke="${stroke}" stroke-width="1.5" />
            <text x="${item.x + 12}" y="${item.y + 22}" fill="${stroke}" font-family="monospace" font-size="10">${escapeXml(item.typeLabel)}</text>
            <text x="${item.x + 12}" y="${item.y + 42}" fill="#f5f5f5" font-family="monospace" font-size="13">${escapeXml(item.title.slice(0, 28))}</text>
            <text x="${item.x + 12}" y="${item.y + 62}" fill="#8a8a8a" font-family="monospace" font-size="10">${escapeXml(item.meta.slice(0, 36))}</text>
          </g>
        `;
      })
      .join("");

    return `
      <svg xmlns="http://www.w3.org/2000/svg" width="${maxX}" height="${maxY}" viewBox="0 0 ${maxX} ${maxY}">
        <defs>
          <marker id="arrow" markerHeight="7" markerWidth="7" orient="auto" refX="6" refY="3.5">
            <path d="M 0 0 L 7 3.5 L 0 7 z" fill="#ba7517" />
          </marker>
          <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M 24 0 H 0 V 24" fill="none" stroke="#202024" stroke-width="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="#0a0a0c" />
        <rect width="100%" height="100%" fill="url(#grid)" opacity="0.65" />
        ${connectionMarkup}
        ${nodeMarkup}
      </svg>
    `;
  }

  function handleExportPng() {
    const svg = renderExportSvg();
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext("2d");
      if (!context) return;
      context.drawImage(image, 0, 0);
      URL.revokeObjectURL(url);
      const anchor = document.createElement("a");
      anchor.href = canvas.toDataURL("image/png");
      anchor.download = `${node.label.replace(/[^\w-]+/gu, "_") || "workflow"}.png`;
      anchor.click();
    };
    image.src = url;
  }

  function handlePrintA4() {
    setPrintSvg(renderExportSvg());
    window.setTimeout(() => window.print(), 50);
  }

  const borderAccentClass: Record<WorkflowNodeType, string> = {
    handover: "[border-left-color:#185fa5]",
    job: "[border-left-color:#ba7517]",
    doc: "[border-left-color:#993c1d]",
    wov: "[border-left-color:#534ab7]",
  };
  const typeColorClass: Record<WorkflowNodeType, string> = {
    handover: "text-[#185fa5]",
    job: "text-[#ba7517]",
    doc: "text-[#993c1d]",
    wov: "text-[#534ab7]",
  };
  const statusConfig = {
    done: "border-emerald-500/20 bg-emerald-500/[0.04] text-emerald-400",
    progress: "border-amber-500/30 bg-amber-500/[0.04] text-amber-500",
    plan: "border-white/10 text-white/40",
    open: "border-red-500/20 bg-red-500/[0.04] text-red-400",
  } as const;
  const orderedFlowNodes = getOrderedFlowNodes();
  const canCreateWorkflowSource = allowedCreateTypes.length > 0;
  const createTypeLabels: Record<WorkflowCreateType, string> = {
    COUNTDOWN: "Countdown",
    WO: "WO",
    PR: "PR",
    WOV: "WOV",
  };
  const countdownJobTypeOptions = visibleCountdownJobTypes();
  const showJobTypeSearch = countdownJobTypeOptions.length > 3;

  return (
    <>
    <div className="grid min-h-[400px] grid-cols-[200px_1fr] border border-white/5">
      <div className="flex flex-col border-r border-white/5">
        <div className="flex items-center gap-2 border-b border-white/5 bg-[#0a0a0c] px-3 py-2">
          <p className="flex-1 text-[10px] font-mono uppercase tracking-[0.12em] text-white/30">
            Sumber Job
            {localWorkflowSources.filter((s) => !flowNodes.find((n) => n.id === s.id)).length > 0 && (
              <span className="ml-1 opacity-50">
                ({localWorkflowSources.filter((s) => !flowNodes.find((n) => n.id === s.id)).length})
              </span>
            )}
          </p>
          {canCreateWorkflowSource ? (
            <button
              type="button"
              onClick={() => {
                setCreateForm(createWorkflowForm(node, defaultCreateType));
                setCreateError(null);
                setJobTypeSearch("");
                setIsCreateMinimized(false);
                setIsCreateOpen(true);
              }}
              className="flex h-7 w-7 items-center justify-center border border-amber-500/30 bg-amber-500/[0.06] text-amber-400 transition-colors hover:border-amber-500/60 hover:bg-amber-500/[0.12]"
              title="Tambah sumber job"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
        <div className="flex-1 space-y-1.5 overflow-y-auto bg-[#0d0d10] p-2">
          {localWorkflowSources.map((src) => {
            const used = !!flowNodes.find((n) => n.id === src.id);
            return (
              <div
                key={src.id}
                draggable={!used}
                onDragStart={() => handleListDragStart(src.id)}
                className={[
                  "border border-l-2 px-2.5 py-2 select-none transition-all",
                  "border-white/5 bg-[#111114]",
                  borderAccentClass[src.type],
                  used
                    ? "opacity-25 pointer-events-none"
                    : "cursor-grab hover:border-amber-500/25 hover:bg-[#151518]",
                ].join(" ")}
              >
                <p className={`text-[9px] font-mono uppercase tracking-[0.08em] ${typeColorClass[src.type]}`}>
                  {src.typeLabel}
                </p>
                <p className="mt-0.5 text-[11px] leading-snug text-white/80">{src.title}</p>
                <p className="mt-0.5 text-[9px] text-white/35">{src.meta}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex min-w-0 flex-col">
        <div className="flex items-center gap-2 border-b border-white/5 px-3 py-2">
          <p className="flex-1 text-[10px] font-mono uppercase tracking-[0.12em] text-white/30">
            Flow Canvas
            {flowNodes.filter((item) => !item.isEnd).length > 0 && (
              <span className="ml-1 opacity-50">- {flowNodes.filter((item) => !item.isEnd).length} step</span>
            )}
          </p>
          <p className="text-[9px] font-mono uppercase tracking-[0.08em] text-white/25">
            {saveMessage ?? "Tarik titik biru untuk panah"}
          </p>
          {selectedConnectionId ? (
            <button
              type="button"
              onClick={handleDeleteSelectedConnection}
              className="border border-red-500/20 bg-red-500/[0.04] px-2 py-0.5 text-[9px] font-mono uppercase tracking-[0.08em] text-red-400 transition-colors hover:border-red-500/35"
            >
              Hapus panah
            </button>
          ) : null}
          {canSaveCanvas ? (
            <button
              type="button"
              onClick={handleSaveCanvas}
              className="inline-flex items-center gap-1 border border-white/10 px-2 py-0.5 text-[9px] font-mono uppercase tracking-[0.08em] text-white/35 transition-colors hover:border-emerald-500/20 hover:text-emerald-400"
            >
              <Save className="h-3 w-3" />
              Save
            </button>
          ) : null}
          <button
            type="button"
            onClick={handlePrintA4}
            className="border border-white/10 px-2 py-0.5 text-[9px] font-mono uppercase tracking-[0.08em] text-white/35 transition-colors hover:border-amber-500/20 hover:text-amber-400"
          >
            Print
          </button>
          <button
            type="button"
            onClick={handleExportPng}
            className="border border-white/10 px-2 py-0.5 text-[9px] font-mono uppercase tracking-[0.08em] text-white/35 transition-colors hover:border-amber-500/20 hover:text-amber-400"
          >
            PNG
          </button>
          {(flowNodes.filter((item) => !item.isEnd).length > 0 || connections.length > 0) && (
            <button
              type="button"
              onClick={handleClearFlow}
              className="border border-white/10 px-2 py-0.5 text-[9px] font-mono uppercase tracking-[0.08em] text-white/30 transition-colors hover:border-red-500/20 hover:text-red-400"
            >
              Reset
            </button>
          )}
        </div>

        <div className="flex min-h-0 flex-1">
          <div
            ref={canvasRef}
            tabIndex={0}
            className="relative min-h-[520px] flex-1 overflow-auto bg-[#0a0a0c]"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleCanvasDrop}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}
            onKeyDown={handleCanvasKeyDown}
          >
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.18]"
              style={{
                backgroundImage: "linear-gradient(rgba(255,255,255,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.12) 1px, transparent 1px)",
                backgroundSize: "24px 24px",
              }}
            />
            <svg className="absolute left-0 top-0 z-[1] h-[1200px] w-[1600px]">
              <defs>
                <marker id="workflow-arrow" markerHeight="7" markerWidth="7" orient="auto" refX="6" refY="3.5">
                  <path d="M 0 0 L 7 3.5 L 0 7 z" fill="rgba(245,158,11,0.45)" />
                </marker>
              </defs>
              {connections.map((connection) => {
                const path = connectionPath(connection);
                const bendPoint = connectionBendPoint(connection);
                const selected = selectedConnectionId === connection.id;
                return path ? (
                  <g key={connection.id}>
                    <path
                      d={path}
                      fill="none"
                      stroke="transparent"
                      strokeLinecap="square"
                      strokeWidth="14"
                      className="cursor-pointer"
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setSelectedConnectionId(connection.id);
                        setSelectedFlowNode(null);
                      }}
                    />
                    <path
                      d={path}
                      fill="none"
                      markerEnd="url(#workflow-arrow)"
                      pointerEvents="none"
                      stroke={selected ? "rgba(56,189,248,0.72)" : "rgba(245,158,11,0.42)"}
                      strokeDasharray={selected ? "0" : "4 4"}
                      strokeWidth={selected ? "2" : "1.5"}
                    />
                    {selected && bendPoint ? (
                      <rect
                        x={bendPoint.x - 4}
                        y={bendPoint.y - 4}
                        width="8"
                        height="8"
                        fill="#38bdf8"
                        stroke="#bae6fd"
                        strokeWidth="1"
                        className={bendPoint.axis === "x" ? "cursor-ew-resize" : "cursor-ns-resize"}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          connectionDragRef.current = { id: connection.id, axis: bendPoint.axis };
                          setSelectedConnectionId(connection.id);
                          setSelectedFlowNode(null);
                        }}
                      />
                    ) : null}
                  </g>
                ) : null;
              })}
              {previewPath() ? (
                <path
                  d={previewPath() ?? undefined}
                  fill="none"
                  markerEnd="url(#workflow-arrow)"
                  stroke="rgba(245,158,11,0.62)"
                  strokeDasharray="4 4"
                  strokeWidth="1.5"
                />
              ) : null}
            </svg>

            {flowNodes.filter((item) => !item.isEnd).length === 0 ? (
              <div className="absolute left-4 right-4 top-4 border border-dashed border-white/10 px-4 py-10 text-center text-[10px] font-mono uppercase tracking-[0.08em] text-white/20">
                Drag job dari kiri ke sini untuk menyusun alur kerja
              </div>
            ) : (
              <div className="pointer-events-none relative z-[2] h-[1200px] w-[1600px]">
                {flowNodes.map((fn) => {
                  const isSelected = selectedFlowNode?.id === fn.id;
                  const isConnectSource = connectFromId === fn.id;
                  const statusClass = statusConfig[fn.status];
                  return (
                    <div
                      key={fn.id}
                      onMouseDown={(e) => handleNodeMouseDown(fn, e)}
                      onMouseEnter={() => {
                        if (connectFromId && connectFromId !== fn.id) {
                          connectTargetIdRef.current = fn.id;
                          setConnectTargetId(fn.id);
                        }
                      }}
                      onMouseLeave={() => {
                        if (connectTargetIdRef.current === fn.id) {
                          connectTargetIdRef.current = null;
                          setConnectTargetId(null);
                        }
                      }}
                      className={[
                        "group absolute min-h-[86px] w-[220px] border border-l-2 px-3 py-2",
                        "pointer-events-auto select-none transition-all",
                        connectFromId ? "cursor-crosshair" : "cursor-grab",
                        borderAccentClass[fn.type],
                        fn.isEnd
                          ? "border-emerald-500/35 bg-emerald-500/[0.035]"
                          : isSelected || isConnectSource || connectTargetId === fn.id
                          ? "border-amber-500/35 bg-amber-500/[0.04]"
                          : "border-white/5 bg-[#111114] hover:border-white/10",
                      ].join(" ")}
                      style={{ left: fn.x, top: fn.y, width: fn.width, minHeight: fn.height }}
                      >
                      <div
                        className={[
                          "absolute inset-0 transition-opacity",
                          isSelected || isConnectSource || connectTargetId === fn.id
                            ? "opacity-100"
                            : "opacity-0 group-hover:opacity-100",
                        ].join(" ")}
                      >
                        <button
                          type="button"
                          aria-label="Tarik panah dari atas"
                          onMouseDown={(e) => startConnectionFromHandle(fn, "top", e)}
                          className="absolute left-1/2 top-[-5px] h-2.5 w-2.5 -translate-x-1/2 cursor-crosshair border border-sky-200 bg-sky-400"
                        />
                        <button
                          type="button"
                          aria-label="Tarik panah dari bawah"
                          onMouseDown={(e) => startConnectionFromHandle(fn, "bottom", e)}
                          className="absolute bottom-[-5px] left-1/2 h-2.5 w-2.5 -translate-x-1/2 cursor-crosshair border border-sky-200 bg-sky-400"
                        />
                        <button
                          type="button"
                          aria-label="Tarik panah dari kiri"
                          onMouseDown={(e) => startConnectionFromHandle(fn, "left", e)}
                          className="absolute left-[-5px] top-1/2 h-2.5 w-2.5 -translate-y-1/2 cursor-crosshair border border-sky-200 bg-sky-400"
                        />
                        <button
                          type="button"
                          aria-label="Tarik panah dari kanan"
                          onMouseDown={(e) => startConnectionFromHandle(fn, "right", e)}
                          className="absolute right-[-5px] top-1/2 h-2.5 w-2.5 -translate-y-1/2 cursor-crosshair border border-sky-200 bg-sky-400"
                        />
                        <span className="pointer-events-none absolute left-1/2 top-[-22px] h-3 w-px -translate-x-1/2 bg-sky-400/35" />
                        <span className="pointer-events-none absolute bottom-[-22px] left-1/2 h-3 w-px -translate-x-1/2 bg-sky-400/35" />
                        <span className="pointer-events-none absolute left-[-22px] top-1/2 h-px w-3 -translate-y-1/2 bg-sky-400/35" />
                        <span className="pointer-events-none absolute right-[-22px] top-1/2 h-px w-3 -translate-y-1/2 bg-sky-400/35" />
                      </div>
                      <button
                        type="button"
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveNode(fn.id);
                        }}
                        className={[
                          "absolute right-2 top-1.5 text-[10px] font-mono transition-colors",
                          fn.isEnd ? "hidden" : "text-white/0 group-hover:text-white/25 hover:!text-red-400",
                        ].join(" ")}
                      >
                        x
                      </button>
                      <p className={`text-[9px] font-mono uppercase tracking-[0.08em] ${typeColorClass[fn.type]}`}>
                        {fn.sourceLabel ?? fn.typeLabel}
                      </p>
                      <p className="mt-0.5 text-[12px] font-mono leading-snug text-white/80">{fn.title}</p>
                      <p className="mt-0.5 text-[10px] text-white/30">{fn.divisionLabel ?? fn.meta}</p>
                      {(fn.hourLabel || fn.progressLabel) ? (
                        <div className="mt-2 grid grid-cols-2 gap-1 text-[9px] font-mono uppercase tracking-[0.06em] text-white/25">
                          <span>{fn.hourLabel ?? "Jam -"}</span>
                          <span>{fn.progressLabel ?? "0%"}</span>
                        </div>
                      ) : null}
                      <div className="mt-2 flex items-center gap-2">
                        <span className={`border px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-[0.06em] ${statusClass}`}>
                          {fn.statusLabel}
                        </span>
                        {fn.hasPhotos && (
                          <span className="text-[9px] font-mono text-white/20">- foto</span>
                        )}
                      </div>
                      <span
                        className="absolute bottom-[-4px] right-[-4px] h-3 w-3 cursor-nwse-resize border border-sky-300 bg-sky-400"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          clearLongPressTimer();
                          nodeResizeRef.current = {
                            id: fn.id,
                            startX: e.clientX,
                            startY: e.clientY,
                            width: fn.width,
                            height: fn.height,
                          };
                          setSelectedFlowNode(fn);
                          setSelectedConnectionId(null);
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {(selectedFlowNode || orderedFlowNodes.length > 0) && (
            <div className="flex w-[200px] flex-shrink-0 flex-col border-l border-white/5">
              <div className="flex items-center justify-between border-b border-white/5 px-3 py-2">
                <p className="text-[10px] font-mono uppercase tracking-[0.08em] text-white/30">
                  {selectedFlowNode ? "Detail" : "Urutan Flow"}
                </p>
                {selectedFlowNode ? (
                  <button
                    type="button"
                    onClick={() => setSelectedFlowNode(null)}
                    className="text-[10px] font-mono text-white/20 hover:text-white/60"
                  >
                    x
                  </button>
                ) : null}
              </div>
              <div className="flex-1 space-y-4 overflow-y-auto p-3">
                {selectedFlowNode ? (
                  <>
                    <div>
                      <p className="mb-1 text-[9px] font-mono uppercase tracking-[0.08em] text-white/25">Sumber</p>
                      <p className="text-[11px] font-mono leading-snug text-white/80">{selectedFlowNode.sourceLabel ?? selectedFlowNode.typeLabel}</p>
                    </div>
                    <div>
                      <p className="mb-1 text-[9px] font-mono uppercase tracking-[0.08em] text-white/25">Master Jobdesc</p>
                      <p className="text-[11px] font-mono leading-snug text-white/80">{selectedFlowNode.title}</p>
                      <p className="mt-1 text-[10px] text-white/30">{selectedFlowNode.meta}</p>
                    </div>
                    <div>
                      <p className="mb-1 text-[9px] font-mono uppercase tracking-[0.08em] text-white/25">Divisi</p>
                      <p className="text-[10px] font-mono text-white/55">{selectedFlowNode.divisionLabel ?? "-"}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="mb-1 text-[9px] font-mono uppercase tracking-[0.08em] text-white/25">Jam</p>
                        <p className="text-[10px] font-mono text-white/55">{selectedFlowNode.hourLabel ?? "-"}</p>
                      </div>
                      <div>
                        <p className="mb-1 text-[9px] font-mono uppercase tracking-[0.08em] text-white/25">Progress</p>
                        <p className="text-[10px] font-mono text-white/55">{selectedFlowNode.progressLabel ?? "-"}</p>
                      </div>
                    </div>
                    {selectedFlowNode.detail ? (
                      <div>
                        <p className="mb-1 text-[9px] font-mono uppercase tracking-[0.08em] text-white/25">Detail</p>
                        <p className="text-[10px] leading-relaxed text-white/45">{selectedFlowNode.detail}</p>
                      </div>
                    ) : null}
                    <div>
                      <p className="mb-1 text-[9px] font-mono uppercase tracking-[0.08em] text-white/25">Status</p>
                      <span className={`border px-2 py-0.5 text-[9px] font-mono uppercase tracking-[0.06em] ${statusConfig[selectedFlowNode.status]}`}>
                        {selectedFlowNode.statusLabel}
                      </span>
                    </div>
                    <div>
                      <p className="mb-1 text-[9px] font-mono uppercase tracking-[0.08em] text-white/25">Bukti Foto</p>
                      {selectedFlowNode.hasPhotos ? (
                        <button
                          type="button"
                          onClick={onNavigateToPhotos}
                          className="w-full border border-white/10 px-2 py-1 text-left text-[9px] font-mono uppercase tracking-[0.06em] text-white/35 transition-colors hover:border-amber-500/20 hover:text-amber-400"
                        >
                          Lihat Galeri -&gt;
                        </button>
                      ) : (
                        <p className="text-[10px] font-mono text-white/20">Belum ada foto</p>
                      )}
                    </div>
                    <div>
                      <p className="mb-1 text-[9px] font-mono uppercase tracking-[0.08em] text-white/25">Bahan & Tools</p>
                      {selectedFlowNode.hasMaterials ? (
                        <button
                          type="button"
                          onClick={onNavigateToDocuments}
                          className="w-full border border-white/10 px-2 py-1 text-left text-[9px] font-mono uppercase tracking-[0.06em] text-white/35 transition-colors hover:border-amber-500/20 hover:text-amber-400"
                        >
                          Lihat Logistik -&gt;
                        </button>
                      ) : (
                        <p className="text-[10px] font-mono text-white/20">Belum ada data</p>
                      )}
                    </div>
                  </>
                ) : null}
                {orderedFlowNodes.length > 0 ? (
                  <div>
                    <p className="mb-2 text-[9px] font-mono uppercase tracking-[0.08em] text-white/25">Urutan</p>
                    <div className="space-y-1.5">
                      {orderedFlowNodes.map((flowNode, index) => (
                        <button
                          key={flowNode.id}
                          type="button"
                          onClick={() => {
                            setSelectedFlowNode(flowNode);
                            setSelectedConnectionId(null);
                          }}
                          className="w-full border border-white/5 px-2 py-1.5 text-left transition-colors hover:border-amber-500/20"
                        >
                          <p className="text-[9px] font-mono uppercase tracking-[0.08em] text-white/25">
                            {String(index + 1).padStart(2, "0")} - {flowNode.sourceLabel ?? flowNode.typeLabel}
                          </p>
                          <p className="mt-0.5 line-clamp-2 text-[10px] text-white/70">{flowNode.title}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    {isCreateOpen && isCreateMinimized ? (
      <div className="fixed bottom-4 right-4 z-[80] w-[min(360px,calc(100vw-32px))] border border-white/10 bg-[#0d0d10] shadow-2xl">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[10px] font-mono uppercase tracking-[0.12em] text-amber-500">Tambah Sumber Job</p>
            <p className="truncate text-[12px] text-white/55">{createForm.title || node.label}</p>
          </div>
          <button
            type="button"
            onClick={() => setIsCreateMinimized(false)}
            className="border border-white/10 px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.1em] text-white/55 hover:text-white"
          >
            Buka
          </button>
          <button
            type="button"
            onClick={() => {
              setIsCreateOpen(false);
              setIsCreateMinimized(false);
            }}
            className="flex h-7 w-7 items-center justify-center border border-white/10 text-white/35 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    ) : isCreateOpen ? (
      <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/75 px-3 py-6 backdrop-blur-[2px]">
        <div className="flex max-h-[calc(100vh-48px)] w-full max-w-3xl flex-col overflow-hidden border border-white/10 bg-[#0d0d10] shadow-2xl">
          <div className="flex shrink-0 items-center justify-between border-b border-white/10 bg-[#111114] px-4 py-3">
            <div>
              <p className="text-[11px] font-mono uppercase tracking-[0.12em] text-amber-500">Tambah Sumber Job</p>
              <p className="mt-1 text-[13px] text-white/70">{node.label}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsCreateMinimized(true)}
                className="flex h-8 w-8 items-center justify-center border border-white/10 text-white/45 hover:text-white"
                title="Minimize"
              >
                <span className="mb-1 text-lg leading-none">-</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsCreateOpen(false);
                  setIsCreateMinimized(false);
                }}
                className="flex h-8 w-8 items-center justify-center border border-white/10 text-white/45 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="grid flex-1 gap-3 overflow-y-auto px-4 py-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <span className="block text-[11px] font-mono uppercase tracking-[0.12em] text-white/35">Jenis</span>
              <div className="grid grid-cols-2 gap-1 border border-white/10 bg-black p-1 sm:grid-cols-4">
                {allowedCreateTypes.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      setCreateForm((current) => ({ ...current, type }));
                      setJobTypeSearch("");
                    }}
                    className={[
                      "h-9 text-[10px] font-mono uppercase tracking-[0.1em] transition-colors",
                      createForm.type === type
                        ? "bg-amber-500 text-black"
                        : "text-white/40 hover:bg-white/[0.04] hover:text-white/70",
                    ].join(" ")}
                  >
                    {createTypeLabels[type]}
                  </button>
                ))}
              </div>
            </div>
            <label className="space-y-1.5">
              <span className="block text-[11px] font-mono uppercase tracking-[0.12em] text-white/35">Divisi</span>
              <select
                value={createForm.divisionId}
                onChange={(event) => {
                  setCreateForm((current) => ({ ...current, divisionId: event.target.value, jobTypeId: "" }));
                  setJobTypeSearch("");
                }}
                disabled={createForm.type === "WOV"}
                className="h-10 w-full border border-white/10 bg-black px-3 text-[13px] text-white outline-none focus:border-amber-500/45 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <option value="">{node.divisionName ?? "Pilih divisi"}</option>
                {countdownReferences.divisions.map((division) => (
                  <option key={division.value} value={division.value}>{division.label}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="block text-[11px] font-mono uppercase tracking-[0.12em] text-white/35">Unit</span>
              <input
                value={carId}
                readOnly
                className="h-10 w-full border border-white/10 bg-white/[0.03] px-3 text-[13px] text-white/55 outline-none"
              />
            </label>
            <label className="space-y-1.5">
              <span className="block text-[11px] font-mono uppercase tracking-[0.12em] text-white/35">Panel / Part</span>
              <input
                value={node.label}
                readOnly
                className="h-10 w-full border border-white/10 bg-white/[0.03] px-3 text-[13px] text-white/55 outline-none"
              />
            </label>
            <label className="space-y-1.5 sm:col-span-2">
              <span className="block text-[11px] font-mono uppercase tracking-[0.12em] text-white/35">Pekerjaan</span>
              <input
                value={createForm.title}
                onChange={(event) => setCreateForm((current) => ({ ...current, title: event.target.value }))}
                className="h-10 w-full border border-white/10 bg-black px-3 text-[13px] text-white outline-none focus:border-amber-500/45"
              />
            </label>
            {createForm.type === "COUNTDOWN" ? (
              <>
                <label className="space-y-1.5">
                  <span className="block text-[11px] font-mono uppercase tracking-[0.12em] text-white/35">Tipe</span>
                  <select
                    value={createForm.taskCategory}
                    onChange={(event) => setCreateForm((current) => ({ ...current, taskCategory: event.target.value as WorkflowCreateFormState["taskCategory"] }))}
                    className="h-10 w-full border border-white/10 bg-black px-3 text-[13px] text-white outline-none focus:border-amber-500/45"
                  >
                    <option value="MAIN">Main</option>
                    <option value="ADDITIONAL">Additional</option>
                  </select>
                </label>
                <label className="space-y-1.5">
                  <span className="block text-[11px] font-mono uppercase tracking-[0.12em] text-white/35">Section</span>
                  <select
                    value={createForm.sectionName}
                    onChange={(event) => setCreateForm((current) => ({ ...current, sectionName: event.target.value }))}
                    className="h-10 w-full border border-white/10 bg-black px-3 text-[13px] text-white outline-none focus:border-amber-500/45"
                  >
                    <option value="">Pilih section</option>
                    {countdownReferences.sections.map((section) => (
                      <option key={section.value} value={section.value}>{section.label}</option>
                    ))}
                    {node.section && !countdownReferences.sections.some((section) => section.value === node.section) ? (
                      <option value={node.section}>{node.section}</option>
                    ) : null}
                  </select>
                </label>
                <label className="space-y-1.5 sm:col-span-2">
                  <span className="block text-[11px] font-mono uppercase tracking-[0.12em] text-white/35">Jobdesc</span>
                  {showJobTypeSearch ? (
                    <JobTypeCombobox
                      options={countdownJobTypeOptions}
                      selectedValue={createForm.jobTypeId}
                      searchValue={jobTypeSearch}
                      onSearchChange={setJobTypeSearch}
                      onSelect={(jobTypeId) => setCreateForm((current) => ({ ...current, jobTypeId }))}
                    />
                  ) : (
                    <select
                      value={createForm.jobTypeId}
                      onChange={(event) => setCreateForm((current) => ({ ...current, jobTypeId: event.target.value }))}
                      className="h-10 w-full border border-white/10 bg-black px-3 text-[13px] text-white outline-none focus:border-amber-500/45"
                    >
                      <option value="">Pilih jobdesc</option>
                      {countdownJobTypeOptions.map((jobType) => (
                        <option key={jobType.value} value={jobType.value}>{jobType.label}</option>
                      ))}
                    </select>
                  )}
                </label>
                <label className="space-y-1.5">
                  <span className="block text-[11px] font-mono uppercase tracking-[0.12em] text-white/35">Target Awal</span>
                  <input
                    value={createForm.targetHours}
                    onChange={(event) => setCreateForm((current) => ({ ...current, targetHours: event.target.value }))}
                    placeholder="001:00"
                    className="h-10 w-full border border-white/10 bg-black px-3 text-[13px] text-white outline-none focus:border-amber-500/45"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="block text-[11px] font-mono uppercase tracking-[0.12em] text-white/35">Start Date</span>
                  <input
                    type="date"
                    value={createForm.startDate}
                    onChange={(event) => setCreateForm((current) => ({ ...current, startDate: event.target.value }))}
                    className="h-10 w-full border border-white/10 bg-black px-3 text-[13px] text-white outline-none focus:border-amber-500/45 [color-scheme:dark]"
                  />
                </label>
                <label className="space-y-1.5 sm:col-span-2">
                  <span className="block text-[11px] font-mono uppercase tracking-[0.12em] text-white/35">Temuan Awal</span>
                  <textarea
                    value={createForm.temuanAwal}
                    onChange={(event) => setCreateForm((current) => ({ ...current, temuanAwal: event.target.value }))}
                    rows={2}
                    className="w-full resize-none border border-white/10 bg-black px-3 py-2 text-[13px] text-white outline-none focus:border-amber-500/45"
                  />
                </label>
                <label className="space-y-1.5 sm:col-span-2">
                  <span className="block text-[11px] font-mono uppercase tracking-[0.12em] text-white/35">Keterangan</span>
                  <textarea
                    value={createForm.keterangan}
                    onChange={(event) => setCreateForm((current) => ({ ...current, keterangan: event.target.value }))}
                    rows={2}
                    className="w-full resize-none border border-white/10 bg-black px-3 py-2 text-[13px] text-white outline-none focus:border-amber-500/45"
                  />
                </label>
              </>
            ) : null}
            {createForm.type === "WO" ? (
              <>
                <label className="space-y-1.5">
                  <span className="block text-[11px] font-mono uppercase tracking-[0.12em] text-white/35">Qty</span>
                  <input
                    type="number"
                    min="1"
                    value={createForm.qty}
                    onChange={(event) => setCreateForm((current) => ({ ...current, qty: event.target.value }))}
                    className="h-10 w-full border border-white/10 bg-black px-3 text-[13px] text-white outline-none focus:border-amber-500/45"
                  />
                </label>
                <label className="flex h-10 items-center gap-2 self-end border border-white/10 bg-black px-3 text-[12px] font-semibold text-white/65">
                  <input
                    type="checkbox"
                    checked={createForm.isPriority}
                    onChange={(event) => setCreateForm((current) => ({ ...current, isPriority: event.target.checked }))}
                    className="h-4 w-4 accent-amber-500"
                  />
                  Urgent / Prioritas
                </label>
              </>
            ) : null}
            {(createForm.type === "PR" || createForm.type === "WOV") ? (
              <>
                <label className="space-y-1.5">
                  <span className="block text-[11px] font-mono uppercase tracking-[0.12em] text-white/35">Qty</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={createForm.qty}
                    onChange={(event) => setCreateForm((current) => ({ ...current, qty: event.target.value }))}
                    className="h-10 w-full border border-white/10 bg-black px-3 text-[13px] text-white outline-none focus:border-amber-500/45"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="block text-[11px] font-mono uppercase tracking-[0.12em] text-white/35">Satuan</span>
                  <input
                    value={createForm.uom}
                    onChange={(event) => setCreateForm((current) => ({ ...current, uom: event.target.value }))}
                    className="h-10 w-full border border-white/10 bg-black px-3 text-[13px] text-white outline-none focus:border-amber-500/45"
                  />
                </label>
              </>
            ) : null}
            {createForm.type === "WOV" ? (
              <label className="space-y-1.5">
                <span className="block text-[11px] font-mono uppercase tracking-[0.12em] text-white/35">Vendor</span>
                <input
                  value={createForm.vendorName}
                  onChange={(event) => setCreateForm((current) => ({ ...current, vendorName: event.target.value }))}
                  className="h-10 w-full border border-white/10 bg-black px-3 text-[13px] text-white outline-none focus:border-amber-500/45"
                />
              </label>
            ) : null}
            <label className="space-y-1.5">
              <span className="block text-[11px] font-mono uppercase tracking-[0.12em] text-white/35">
                {createForm.type === "WOV" ? "Target Kembali" : createForm.type === "WO" ? "Target Selesai" : "Deadline"}
              </span>
              <input
                type="date"
                value={createForm.targetDate}
                onChange={(event) => setCreateForm((current) => ({ ...current, targetDate: event.target.value }))}
                className="h-10 w-full border border-white/10 bg-black px-3 text-[13px] text-white outline-none focus:border-amber-500/45 [color-scheme:dark]"
              />
            </label>
            <label className="space-y-1.5 sm:col-span-2">
              <span className="block text-[11px] font-mono uppercase tracking-[0.12em] text-white/35">Catatan</span>
              <textarea
                value={createForm.notes}
                onChange={(event) => setCreateForm((current) => ({ ...current, notes: event.target.value }))}
                rows={2}
                className="w-full resize-none border border-white/10 bg-black px-3 py-2 text-[13px] text-white outline-none focus:border-amber-500/45"
              />
            </label>
          </div>

          {createError ? (
            <div className="mx-4 mb-3 border border-red-500/20 bg-red-500/[0.04] px-3 py-2 text-[11px] text-red-400">
              {createError}
            </div>
          ) : null}

          <div className="flex shrink-0 justify-end gap-2 border-t border-white/10 bg-[#111114] px-4 py-3">
            <button
              type="button"
              onClick={() => {
                setIsCreateOpen(false);
                setIsCreateMinimized(false);
              }}
              className="border border-white/10 px-4 py-2 text-[11px] font-mono uppercase tracking-[0.12em] text-white/55 hover:text-white"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={isCreating}
              onClick={() => {
                void handleCreateWorkflowJob();
              }}
              className="border border-amber-500/35 bg-amber-500 px-5 py-2 text-[11px] font-mono uppercase tracking-[0.12em] text-black disabled:cursor-not-allowed disabled:opacity-45"
            >
              {isCreating ? "Menyimpan..." : "Buat"}
            </button>
          </div>
        </div>
      </div>
    ) : null}
    <div className="workflow-print-root" dangerouslySetInnerHTML={{ __html: printSvg }} />
    <style>{`
      .workflow-print-root {
        display: none;
      }
      @media print {
        @page {
          size: A4 portrait;
          margin: 12mm;
        }
        body * {
          visibility: hidden !important;
        }
        .workflow-print-root,
        .workflow-print-root * {
          visibility: visible !important;
        }
        .workflow-print-root {
          display: block !important;
          position: fixed;
          inset: 0;
          width: 100%;
          min-height: 100%;
          background: white;
          padding: 0;
        }
        .workflow-print-root svg {
          width: 100%;
          height: auto;
          max-height: 100vh;
          display: block;
        }
      }
    `}</style>
    </>
  );
}
