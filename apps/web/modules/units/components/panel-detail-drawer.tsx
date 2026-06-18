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
  Camera,
  CheckCircle2,
  ClipboardList,
  Download,
  Eye,
  FileText,
  FolderOpen,
  MapPin,
  PackageCheck,
  PackageSearch,
  ShoppingCart,
  Trash2,
  Truck,
  Upload,
  Wrench,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
import { fmtDateTime } from "@/shared/format/humanize";

type DrawerTab = "timeline" | "photos" | "documents";
type TriageTone = "good" | "repair" | "replace" | "unknown";

interface PanelDetailDrawerProps {
  node: UnitBomNode | null;
  isOpen: boolean;
  canManagePhotos: boolean;
  canDownloadPhotos: boolean;
  onClose: () => void;
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

function nodeNameLabel(node: UnitBomNode): string {
  if (node.nodeType === "CATEGORY") return "Nama Category";
  if (node.nodeType === "SECTION") return "Nama Section";
  return "Nama Panel / Part";
}

function buildTimeline(node: UnitBomNode): TimelineItem[] {
  const items: TimelineItem[] = [];

  if (node.detail?.timeline.length) {
    items.push(
      ...node.detail.timeline.map((item) => ({
        eventType: item.eventType,
        title: item.title,
        detail: item.description,
        date: formatShortDate(item.occurredAt),
        icon: timelineIcon(item.eventType),
        tone: timelineTone(item.eventType),
      }))
    );
  } else {
    const divisionName = node.divisionName ?? "Divisi terkait";
    items.push({
      title: "Pendataan awal",
      detail: `Didata untuk ${divisionName}`,
      date: "12 Mei",
      icon: Truck,
      tone: "border-info/30 bg-info/10 text-info",
    });
    items.push({
      title: "Pekerjaan job plan",
      detail: "Dempul dasar oleh Budi (4 jam) - Lolos QC",
      date: "13 Mei",
      icon: Wrench,
      tone: "border-primary/30 bg-primary/10 text-app-accent-ink",
    });
    items.push({
      title: "Pemeriksaan akhir",
      detail: `Progress terakhir ${Math.round(node.progressPercent ?? 0)}%`,
      date: "Hari ini",
      icon: CheckCircle2,
      tone: "border-success/30 bg-success/10 text-success",
    });
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

export function PanelDetailDrawer({ node, isOpen, canManagePhotos, canDownloadPhotos, onClose }: PanelDetailDrawerProps) {
  const router = useRouter();
  const replaceInputRef = useRef<HTMLInputElement | null>(null);
  const [activeTab, setActiveTab] = useState<DrawerTab>("timeline");
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
  const documents = useMemo(() => (node ? buildDocuments(node) : []), [node]);
  const galleryPhotos = useMemo(
    () => (galleryState.actualId === node?.actualId ? galleryState.photos : []),
    [galleryState.actualId, galleryState.photos, node?.actualId],
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
    const actualId = isOpen ? node?.actualId ?? null : null;

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
  }, [isOpen, node?.actualId]);

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

  if (!isOpen || !node) return null;

  const location = triage.tone === "good" ? "Gudang" : node.divisionName ?? "Belum ditentukan";

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-background/80 dark:bg-black/75 px-4 py-6" role="dialog" aria-modal="true">
      <button type="button" aria-label="Tutup panel detail" className="absolute inset-0 cursor-default" onClick={onClose} />
      <aside className="relative flex w-full max-w-[900px] max-h-[90vh] flex-col border border-border bg-background">
        <header className="sticky top-0 z-10 border-b border-border bg-background px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[14px] font-mono uppercase tracking-[0.12em] text-muted-foreground">Panel Detail</p>
              <div className="mt-3 grid gap-2 text-[15px] font-mono sm:grid-cols-3">
                <div className="min-w-0">
                  <p className="text-[15px] uppercase tracking-[0.12em] text-muted-foreground">Category</p>
                  <p className="mt-0.5 break-words text-foreground">{node.category ?? "Belum tercatat"}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-[15px] uppercase tracking-[0.12em] text-muted-foreground">Section</p>
                  <p className="mt-0.5 break-words text-foreground">{node.section ?? "Belum tercatat"}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-[15px] uppercase tracking-[0.12em] text-muted-foreground">{nodeNameLabel(node)}</p>
                  <h2 className="mt-0.5 break-words text-[15px] text-foreground/90">{node.label}</h2>
                </div>
              </div>
              <p className="mt-2 text-[14px] font-mono text-muted-foreground">{hierarchyLabel(node)}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="border border-border p-1.5 text-muted-foreground transition-colors hover:border-primary/35 hover:bg-muted hover:text-foreground"
              aria-label="Tutup"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Badge className={triage.className}>
              <Archive className="h-3.5 w-3.5" />
              Kondisi: {triage.label}
            </Badge>
            <Badge className="border-border text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              Lokasi: {location}
            </Badge>
            <Badge className="border-border text-foreground">
              <Wrench className="h-3.5 w-3.5" />
              Status: {node.detail?.workStatusLabel ?? workStatusLabel(node)}
            </Badge>
          </div>

          <nav className="mt-3 flex border-b border-border">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={["px-4 py-2 text-[14px] font-mono uppercase tracking-[0.12em] border-b-2 -mb-px transition-colors",
                    isActive
                      ? "border-primary text-app-accent-ink"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  ].join(" ")}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
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
                    timeline.map((item, index) => {
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
                              <p className="line-clamp-2 text-xs text-foreground">
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
        </div>
      </aside>
    </div>
  );
}
