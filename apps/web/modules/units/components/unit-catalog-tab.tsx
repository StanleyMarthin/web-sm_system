/*
Tujuan: Workspace catalog unit berbasis AG Grid Community.
Caller: unit workspace shell.
Dependensi: API unit-catalog, helper spreadsheet, sweet alert.
Main Functions: overview panel, pilih panel, edit batch item, upload media referensi, search.
Side Effects: HTTP fetch/update catalog dan upload file reference.
*/

"use client";

import type { CatalogOverview, CatalogWorkspace } from "@smsystem/contracts/unit-catalog";
import { AlertCircle, ArrowUpDown, CheckCircle2, Eye, ImagePlus, MapPin, Maximize2, Pencil, Printer, RotateCcw, Save, Search, Settings2, Trash2, X, ZoomIn, ZoomOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { CatalogPanelManager } from "@/modules/units/components/catalog-panel-manager";
import { UnitCatalogEditor } from "@/modules/units/components/unit-catalog-editor";
import {
  appendEmptyCatalogDraftRow,
  catalogPositionFromPoint,
  catalogImageMaxBytes,
  clampCatalogImageZoom,
  createCatalogWorkspaceDraft,
  getCatalogImageFilesFromClipboardItems,
  getCatalogImageHoverPosition,
  isCatalogDraftDirty,
  isValidCatalogImageFile,
  parseCatalogPositionMarker,
  removeCatalogDraftImage,
  resolveCatalogPanelImagesForSave,
  serializeCatalogDraftRows,
  stageCatalogImageFiles,
  workspaceDraftFromWorkspace,
  type CatalogWorkspaceDraft,
} from "@/modules/units/helpers/unit-catalog-sheet";
import {
  confirmUnitCatalogSurvey,
  fetchUnitCatalog,
  fetchUnitCatalogPanelWorkspace,
  saveUnitCatalogSurvey,
  saveUnitCatalogPanelWorkspace,
  searchUnitCatalog,
} from "@/shared/api/unit-catalog";
import { getApiBaseUrl, getProxiedImageUrl } from "@/shared/api/config";
import { useSweetAlert } from "@/shared/ui/sweet-alert";
import { ActionButton, CompactInput, CompactTextarea, FieldLabel, PageHeader, SectionCard } from "@/shared/ui/compact";

interface UnitCatalogTabProps {
  unitId: string;
  unitName: string;
  canManageCatalog: boolean;
}

type SurveyForm = {
  actualName: string;
  availabilityStatus: "AVAILABLE" | "NOT_AVAILABLE" | "UNKNOWN";
  conditionStatus: "GOOD" | "RESTORE" | "NOT_USABLE";
  isRestoration: boolean;
  notes: string;
};

function groupPanelsByComponent(overview: CatalogOverview | null) {
  if (!overview) return [];
  return overview.components.map((component) => ({
    component,
    panels: overview.panels.filter((panel) => panel.componentId === component.id),
  }));
}

function formatItemCount(value: number) {
  return new Intl.NumberFormat("id-ID").format(value);
}

function formatBytes(value: number) {
  return `${Math.round(value / 1024 / 1024)} MB`;
}

function surveyStatusText(row: CatalogWorkspaceDraft["rows"][number]) {
  if (row.surveyStatus === "MASTER_PANEL_CREATED") return "Sudah jadi Master Panel";
  if (row.surveyStatus === "SUDAH_DIDATA" || row.isRestoration) return "Pendataan selesai";
  return "Belum didata";
}

function availabilityText(value: CatalogWorkspaceDraft["rows"][number]["availabilityStatus"]) {
  if (value === "AVAILABLE") return "Ada";
  if (value === "NOT_AVAILABLE") return "Tidak Ada";
  if (value === "UNKNOWN") return "Tidak Ditemukan";
  return "-";
}

function conditionText(value: CatalogWorkspaceDraft["rows"][number]["conditionStatus"]) {
  if (value === "GOOD") return "Layak";
  if (value === "RESTORE") return "Restorasi";
  if (value === "NOT_USABLE") return "Tidak Layak";
  return "-";
}

function humanizeCatalogLabel(value: string, options: { removeLeadingCode?: boolean } = {}) {
  let cleaned = value
    .replace(/[_-]+/gu, " ")
    .replace(/[`´’]/gu, "'")
    .replace(/\s+/gu, " ")
    .trim();

  if (options.removeLeadingCode) {
    cleaned = cleaned.replace(/^\d+[A-Z]?\s+/iu, "");
  }

  return cleaned
    .toLowerCase()
    .replace(/\b\p{L}/gu, (char) => char.toUpperCase());
}

function MediaThumb({
  src,
  alt,
  active,
  onClick,
}: {
  src: string;
  alt: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative aspect-[4/3] overflow-hidden border ${active ? "border-primary" : "border-border"}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={getProxiedImageUrl(src)} alt={alt} className="h-full w-full object-cover" />
    </button>
  );
}

export function UnitCatalogTab({ unitId, unitName, canManageCatalog }: UnitCatalogTabProps) {
  const router = useRouter();
  const sweetAlert = useSweetAlert();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [overview, setOverview] = useState<CatalogOverview | null>(null);
  const [workspace, setWorkspace] = useState<CatalogWorkspace | null>(null);
  const [baseline, setBaseline] = useState<CatalogWorkspaceDraft | null>(null);
  const [draft, setDraft] = useState<CatalogWorkspaceDraft>(createCatalogWorkspaceDraft());
  const [selectedPanelId, setSelectedPanelId] = useState<number | null>(null);
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const [selectedMediaIndex, setSelectedMediaIndex] = useState(0);
  const [componentFilter, setComponentFilter] = useState("");
  const [panelSearch, setPanelSearch] = useState("");
  const [gridSearch, setGridSearch] = useState("");
  const [searchHits, setSearchHits] = useState<Array<{
    itemId: number;
    panelId: number;
    panelName: string;
    componentName: string;
    code: string | null;
    partNumber: string | null;
    itemName: string | null;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPanel, setLoadingPanel] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [managePanelMode, setManagePanelMode] = useState(false);
  const [imageUrlInput, setImageUrlInput] = useState("");
  const [deletedItemIds, setDeletedItemIds] = useState<number[]>([]);
  const [deletedPanelImageIds, setDeletedPanelImageIds] = useState<number[]>([]);
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [imageZoomOpen, setImageZoomOpen] = useState(false);
  const [imageZoom, setImageZoom] = useState(1);
  const [imageHoverPosition, setImageHoverPosition] = useState<{ x: number; y: number } | null>(null);
  const [drawerRowId, setDrawerRowId] = useState<string | null>(null);
  const [markerRowId, setMarkerRowId] = useState<string | null>(null);
  const [surveySaving, setSurveySaving] = useState(false);
  const [surveyForm, setSurveyForm] = useState<SurveyForm>({
    actualName: "",
    availabilityStatus: "AVAILABLE",
    conditionStatus: "RESTORE",
    isRestoration: false,
    notes: "",
  });

  const dirty = baseline ? isCatalogDraftDirty(baseline, draft) : false;
  const groupedPanels = useMemo(() => groupPanelsByComponent(overview), [overview]);
  const drawerRow = useMemo(() => draft.rows.find((row) => row.rowId === drawerRowId) ?? null, [draft.rows, drawerRowId]);
  const markerRow = useMemo(() => draft.rows.find((row) => row.rowId === markerRowId) ?? null, [draft.rows, markerRowId]);
  const markerPosition = useMemo(() => parseCatalogPositionMarker(markerRow?.position), [markerRow?.position]);
  const selectedComponentLabel = workspace ? humanizeCatalogLabel(workspace.panel.componentName) : "";
  const selectedPanelTitle = workspace ? humanizeCatalogLabel(workspace.panel.panelName, { removeLeadingCode: true }) : "";
  const activeMarkerRow = markerRowId ? draft.rows.find((row) => row.rowId === markerRowId) ?? null : null;
  const canWriteMarker = Boolean(activeMarkerRow && !activeMarkerRow.promotedPanelId);
  const filteredGroups = useMemo(() => {
    const keyword = panelSearch.trim().toLowerCase();
    return groupedPanels
      .filter((group) => !componentFilter || String(group.component.id) === componentFilter)
      .map((group) => ({
        ...group,
        panels: group.panels.filter((panel) => !keyword || panel.panelName.toLowerCase().includes(keyword)),
      }))
      .filter((group) => group.panels.length > 0);
  }, [componentFilter, groupedPanels, panelSearch]);

  useEffect(() => {
    void loadOverview();
  }, [unitId]);

  useEffect(() => {
    if (!editMode || !workspace) return;
    const handlePaste = (event: ClipboardEvent) => {
      const files = getCatalogImageFilesFromClipboardItems(Array.from(event.clipboardData?.items ?? []));
      if (files.length === 0) return;
      event.preventDefault();
      stageImages(files);
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [editMode, workspace]);

  useEffect(() => {
    if (!panelSearch.trim() || selectedPanelId) {
      setSearchHits([]);
      return;
    }

    const timeout = window.setTimeout(async () => {
      const result = await searchUnitCatalog(unitId, { q: panelSearch.trim(), limit: 20 });
      if (!result.success) return;
      setSearchHits(result.payload.data.items.map((item) => ({
        itemId: item.itemId,
        panelId: item.panelId,
        panelName: item.panelName,
        componentName: item.componentName,
        code: item.code,
        partNumber: item.partNumber,
        itemName: item.itemName,
      })));
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [panelSearch, selectedPanelId, unitId]);

  async function loadOverview() {
    setLoading(true);
    const result = await fetchUnitCatalog(unitId);
    if (!result.success) {
      sweetAlert.notifyError("Catalog belum dapat dimuat", result.message);
      setLoading(false);
      return;
    }
    setOverview(result.payload.data.overview);
    setLoading(false);
  }

  async function openPanel(panelId: number) {
    if (dirty) {
      const confirmed = await sweetAlert.confirm({
        title: "Perubahan belum disimpan",
        description: "Perubahan di panel ini akan dibuang bila pindah sekarang.",
        confirmLabel: "Pindah panel",
        cancelLabel: "Tetap di sini",
      });
      if (!confirmed) return;
    }

    setLoadingPanel(true);
    const result = await fetchUnitCatalogPanelWorkspace(unitId, panelId);
    setLoadingPanel(false);
    if (!result.success) {
      sweetAlert.notifyError("Panel belum dapat dibuka", result.message);
      return;
    }

    const nextWorkspace = result.payload.data.workspace;
    const nextDraft = workspaceDraftFromWorkspace(nextWorkspace);
    setWorkspace(nextWorkspace);
    setBaseline(nextDraft);
    setDraft(nextDraft);
    setSelectedPanelId(panelId);
    setSelectedRowIds([]);
    setSelectedMediaIndex(0);
    setEditMode(false);
    setGridSearch("");
    setImageUrlInput("");
    setDeletedItemIds([]);
    setDeletedPanelImageIds([]);
    setDrawerRowId(null);
    setMarkerRowId(null);
  }

  function closePanel() {
    setWorkspace(null);
    setSelectedPanelId(null);
    setBaseline(null);
    setDraft(createCatalogWorkspaceDraft());
    setSelectedRowIds([]);
    setSelectedMediaIndex(0);
    setEditMode(false);
    setGridSearch("");
    setImageUrlInput("");
    setDeletedItemIds([]);
    setDeletedPanelImageIds([]);
    setDrawerRowId(null);
    setMarkerRowId(null);
  }

  async function handleSave() {
    if (!workspace || !selectedPanelId) return;

    setSaving(true);
    let items;
    let panelImages;
    try {
      items = serializeCatalogDraftRows(draft.rows);
      panelImages = await resolveCatalogPanelImagesForSave(draft.panelImages, uploadImageFile);
    } catch (error) {
      sweetAlert.notifyError(
        error instanceof Error && error.message.startsWith("QTY_INVALID:") ? "Qty belum valid" : "Gambar belum tersimpan",
        error instanceof Error ? error.message.replace("QTY_INVALID:", "Isi qty tidak valid: ") : "Periksa kembali data.",
      );
      setSaving(false);
      return;
    }

    const result = await saveUnitCatalogPanelWorkspace(unitId, selectedPanelId, {
      items,
      deletedItemIds,
      panelImages,
      deletedPanelImageIds,
    });
    setSaving(false);

    if (!result.success) {
      sweetAlert.notifyError("Catalog belum tersimpan", result.message);
      return;
    }

    const nextWorkspace = result.payload.data.workspace;
    const nextDraft = workspaceDraftFromWorkspace(nextWorkspace);
    setWorkspace(nextWorkspace);
    setBaseline(nextDraft);
    setDraft(nextDraft);
    setEditMode(false);
    setSelectedRowIds([]);
    setSelectedMediaIndex(0);
    setDeletedItemIds([]);
    setDeletedPanelImageIds([]);
    sweetAlert.notifySuccess("Catalog tersimpan", "Perubahan panel ini sudah masuk ke database.");
    void loadOverview();
  }

  function handleCancelEdit() {
    if (!baseline) return;
    setDraft(baseline);
    setEditMode(false);
    setSelectedRowIds([]);
    setSelectedMediaIndex(0);
    setDeletedItemIds([]);
    setDeletedPanelImageIds([]);
  }

  async function uploadImageFile(file: File) {
    const form = new FormData();
    form.set("unitId", unitId);
    form.set("file", file);
    const response = await fetch(`${getApiBaseUrl()}/api/units/${encodeURIComponent(unitId)}/catalog/panel-images/upload`, {
      method: "POST",
      body: form,
      credentials: "include",
      cache: "no-store",
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.success || !payload?.data?.publicUrl) {
      throw new Error(typeof payload?.message === "string" ? payload.message : "Gambar belum berhasil diupload.");
    }
    return String(payload.data.publicUrl);
  }

  function stageImages(files: File[]) {
    const validFiles = files.filter((file) => isValidCatalogImageFile(file));
    if (validFiles.length !== files.length) {
      sweetAlert.notifyError("Gambar tidak valid", `Gunakan jpg, jpeg, png, atau webp maksimal ${formatBytes(catalogImageMaxBytes)}.`);
    }
    if (validFiles.length === 0) return;
    let nextIndex = 0;
    setDraft((current) => {
      nextIndex = current.panelImages.length;
      return {
        ...current,
        panelImages: stageCatalogImageFiles(current.panelImages, validFiles, (file) => URL.createObjectURL(file)),
      };
    });
    setSelectedMediaIndex(nextIndex);
    sweetAlert.notifySuccess("Gambar siap disimpan", `${validFiles.length} gambar masuk draft.`);
  }

  function addImageFromUrl() {
    const value = imageUrlInput.trim();
    if (!value) return;
    let nextIndex = 0;
    setDraft((current) => {
      nextIndex = current.panelImages.length;
      return {
        ...current,
        panelImages: [
          ...current.panelImages,
          {
            id: null,
            fileUrl: value,
            caption: "",
            sortOrder: current.panelImages.length,
          },
        ],
      };
    });
    setSelectedMediaIndex(nextIndex);
    setImageUrlInput("");
    sweetAlert.notifySuccess("Link gambar dimasukkan");
  }

  async function removeCurrentImage() {
    if (!currentMedia) return;
    const confirmed = await sweetAlert.confirm({
      title: "Hapus gambar referensi",
      description: "Gambar ini akan dihapus saat catalog disimpan.",
      confirmLabel: "Hapus",
      cancelLabel: "Batal",
    });
    if (!confirmed) return;

    setDraft((current) => {
      const result = removeCatalogDraftImage(current.panelImages, selectedMediaIndex);
      if (result.deletedId) {
        setDeletedPanelImageIds((existing) => (
          existing.includes(result.deletedId as number) ? existing : [...existing, result.deletedId as number]
        ));
      }
      return { ...current, panelImages: result.images };
    });
    if (currentMedia.file && currentMedia.fileUrl.startsWith("blob:")) {
      URL.revokeObjectURL(currentMedia.fileUrl);
    }
    setSelectedMediaIndex((current) => Math.max(0, current - 1));
  }

  function handleDeleteSelectedRows() {
    setDraft((current) => {
      const promotedRows = current.rows.filter((row) => selectedRowIds.includes(row.rowId) && row.promotedPanelId);
      if (promotedRows.length > 0) {
        sweetAlert.notifyError("Item terkunci", "Item yang sudah jadi Master Panel tidak bisa dihapus.");
      }
      const deletedIds = current.rows
        .filter((row) => selectedRowIds.includes(row.rowId) && !row.promotedPanelId && row.persistedId != null)
        .map((row) => row.persistedId as number);
      if (deletedIds.length > 0) {
        setDeletedItemIds((existing) => [...new Set([...existing, ...deletedIds])]);
      }
      const selectedMutableIds = new Set(
        current.rows
          .filter((row) => selectedRowIds.includes(row.rowId) && !row.promotedPanelId)
          .map((row) => row.rowId),
      );
      return {
        ...current,
        rows: current.rows.filter((row) => !selectedMutableIds.has(row.rowId)).length > 0
          ? current.rows.filter((row) => !selectedMutableIds.has(row.rowId))
          : appendEmptyCatalogDraftRow([]),
      };
    });
    setSelectedRowIds([]);
  }

  function itemLabel(row: CatalogWorkspaceDraft["rows"][number] | null) {
    if (!row) return "-";
    return row.aliasName || row.itemName || row.partNumber || row.code || "Item belum bernama";
  }

  function openItemDrawer(row: CatalogWorkspaceDraft["rows"][number]) {
    setDrawerRowId(row.rowId);
    setSurveyForm({
      actualName: row.aliasName,
      availabilityStatus: row.availabilityStatus ?? "AVAILABLE",
      conditionStatus: row.conditionStatus === "UNKNOWN" || row.conditionStatus == null ? "RESTORE" : row.conditionStatus,
      isRestoration: row.isRestoration,
      notes: "",
    });
  }

  function openSurvey(row: CatalogWorkspaceDraft["rows"][number]) {
    if (row.promotedPanelId) {
      openItemDrawer(row);
      return;
    }
    if (!row.persistedId) {
      sweetAlert.notifyError("Simpan item dulu", "Item baru harus disimpan sebelum survey.");
      return;
    }
    if (dirty) {
      sweetAlert.notifyError("Simpan Data dulu", "Selesaikan perubahan catalog sebelum survey item.");
      return;
    }
    openItemDrawer(row);
  }

  function startMarkPosition(row: CatalogWorkspaceDraft["rows"][number]) {
    if (!currentMedia) {
      sweetAlert.notifyError("Gambar panel belum ada", "Tambahkan gambar referensi panel sebelum menandai lokasi item.");
      return;
    }
    if (row.promotedPanelId) {
      setMarkerRowId(row.rowId);
      setDrawerRowId(row.rowId);
      if (!parseCatalogPositionMarker(row.position)) {
        sweetAlert.notifyError("Lokasi belum ditandai", "Item ini belum memiliki marker lokasi.");
      }
      return;
    }
    if (!editMode) setEditMode(true);
    setMarkerRowId(row.rowId);
    setDrawerRowId(row.rowId);
    sweetAlert.notifySuccess("Mode tandai", "Klik posisi item pada gambar panel, lalu Simpan Data.");
  }

  function printPanelCatalog() {
    document.body.classList.add("catalog-panel-printing");
    window.addEventListener("afterprint", () => {
      document.body.classList.remove("catalog-panel-printing");
    }, { once: true });
    window.setTimeout(() => window.print(), 50);
  }

  async function saveSurvey() {
    if (!drawerRow?.persistedId) return;
    if (drawerRow.promotedPanelId) {
      sweetAlert.notifyError("Item terkunci", "Item ini sudah jadi Master Panel.");
      return;
    }
    if (dirty) {
      sweetAlert.notifyError("Simpan Data dulu", "Selesaikan perubahan catalog sebelum survey item.");
      return;
    }
    setSurveySaving(true);
    const payload = {
      actualName: surveyForm.actualName.trim() || null,
      availabilityStatus: surveyForm.availabilityStatus,
      conditionStatus: surveyForm.conditionStatus,
      isRestoration: surveyForm.isRestoration,
      actionType: "NO_ACTION" as const,
      location: "UNIT",
      notes: surveyForm.notes.trim() || null,
      mapping: null,
      qtyOpname: null,
    };
    const result = surveyForm.isRestoration
      ? await confirmUnitCatalogSurvey(unitId, drawerRow.persistedId, payload)
      : await saveUnitCatalogSurvey(unitId, drawerRow.persistedId, payload);
    setSurveySaving(false);
    if (!result.success) {
      sweetAlert.notifyError("Pendataan belum tersimpan", result.message);
      return;
    }
    if (selectedPanelId) {
      const refreshed = await fetchUnitCatalogPanelWorkspace(unitId, selectedPanelId);
      if (refreshed.success) {
        const nextWorkspace = refreshed.payload.data.workspace;
        const nextDraft = workspaceDraftFromWorkspace(nextWorkspace);
        setWorkspace(nextWorkspace);
        setBaseline(nextDraft);
        setDraft(nextDraft);
      }
    }
    setDrawerRowId(null);
    setMarkerRowId(null);
    sweetAlert.notifySuccess("Pendataan tersimpan", surveyForm.isRestoration ? "Item sudah masuk Master Panel." : "Pendataan item tersimpan.");
    void loadOverview();
  }

  const currentMedia = draft.panelImages[selectedMediaIndex] ?? null;
  const currentMediaFileUrl = currentMedia?.fileUrl;
  const currentMediaSrc = currentMediaFileUrl ? getProxiedImageUrl(currentMediaFileUrl) : undefined;

  useEffect(() => {
    setImageZoom(1);
    if (!currentMediaFileUrl) setImageZoomOpen(false);
  }, [currentMediaFileUrl]);

  useEffect(() => {
    if (!imageZoomOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setImageZoomOpen(false);
      if (event.key === "+" || event.key === "=") setImageZoom((value) => clampCatalogImageZoom(value + 0.25));
      if (event.key === "-") setImageZoom((value) => clampCatalogImageZoom(value - 0.25));
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [imageZoomOpen]);

  return (
    <>
    {selectedPanelId && workspace ? (
      <CatalogPanelPrintView
        unitName={unitName}
        componentLabel={selectedComponentLabel}
        panelTitle={selectedPanelTitle}
        imageSrc={currentMediaSrc}
        rows={draft.rows}
      />
    ) : null}
    <div className="space-y-4 print:hidden">
      {sweetAlert.alertElement}

      {imageZoomOpen && currentMediaSrc ? (
        <div className="fixed inset-0 z-50 bg-black/90 p-4 text-white" role="dialog" aria-modal="true">
          <div className="flex h-full flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <p className="truncate text-sm font-medium">{selectedPanelTitle || "Gambar Panel"}</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setImageZoom((value) => clampCatalogImageZoom(value - 0.25))}
                  className="border border-white/30 px-3 py-2 text-xs hover:bg-white/10"
                  aria-label="Perkecil gambar"
                >
                  <ZoomOut className="h-4 w-4" />
                </button>
                <span className="w-14 text-center text-xs">{Math.round(imageZoom * 100)}%</span>
                <button
                  type="button"
                  onClick={() => setImageZoom((value) => clampCatalogImageZoom(value + 0.25))}
                  className="border border-white/30 px-3 py-2 text-xs hover:bg-white/10"
                  aria-label="Perbesar gambar"
                >
                  <ZoomIn className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setImageZoom(1)}
                  className="border border-white/30 px-3 py-2 text-xs hover:bg-white/10"
                  aria-label="Reset zoom"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setImageZoomOpen(false)}
                  className="border border-white/30 px-3 py-2 text-xs hover:bg-white/10"
                  aria-label="Tutup zoom"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto border border-white/20 bg-black">
              <div className="flex min-h-full min-w-full items-start justify-center p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={currentMediaSrc}
                  alt={workspace?.panel.panelName ?? "Gambar Panel"}
                  className="h-auto max-w-none"
                  style={{ width: `${imageZoom * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <PageHeader
        eyebrow={`Unit / Catalog · ${unitName}`}
        title={managePanelMode ? "Kelola Master Panel Catalog" : selectedPanelId && workspace ? selectedPanelTitle : "Catalog Unit"}
        actions={selectedPanelId ? (
          editMode ? (
            <>
              <ActionButton onClick={printPanelCatalog}>
                <Printer className="h-3.5 w-3.5" />
                Cetak/PDF
              </ActionButton>
              <ActionButton onClick={handleCancelEdit}>
                <X className="h-3.5 w-3.5" />
                Batal
              </ActionButton>
              <ActionButton variant="primary" onClick={() => { void handleSave(); }} disabled={saving}>
                <Save className="h-3.5 w-3.5" />
                {saving ? "Menyimpan" : "Simpan Data"}
              </ActionButton>
            </>
          ) : (
            <>
              <ActionButton onClick={printPanelCatalog}>
                <Printer className="h-3.5 w-3.5" />
                Cetak/PDF
              </ActionButton>
              <ActionButton onClick={closePanel}>Kembali</ActionButton>
              {canManageCatalog ? (
                <ActionButton variant="primary" onClick={() => setEditMode(true)}>
                  <Pencil className="h-3.5 w-3.5" />
                  Edit Catalog
                </ActionButton>
              ) : null}
            </>
          )
        ) : managePanelMode || !canManageCatalog ? undefined : (
          <ActionButton variant="primary" onClick={() => setManagePanelMode(true)}>
            <Settings2 className="h-3.5 w-3.5" />
            Kelola Panel
          </ActionButton>
        )}
      />

      {managePanelMode ? (
        <CatalogPanelManager
          components={overview?.components ?? []}
          onClose={() => setManagePanelMode(false)}
          onSaved={() => { void loadOverview(); }}
        />
      ) : selectedPanelId && workspace ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.85fr)_minmax(23rem,0.85fr)]">
          <SectionCard label="Gambar Referensi Panel" count={draft.panelImages.length} className="min-h-[42rem]">
            {currentMedia ? (
              <div className="space-y-3">
                {workspace ? (
                  <div>
                    <p className="text-sm text-muted-foreground">{selectedComponentLabel}</p>
                    <h3 className="text-2xl font-semibold text-foreground">{selectedPanelTitle}</h3>
                  </div>
                ) : null}
                <div
                  className={`relative min-h-[36rem] overflow-hidden border border-border bg-muted ${canWriteMarker ? "cursor-crosshair" : ""}`}
                  onMouseMove={(event) => {
                    if (markerRowId) return;
                    const position = getCatalogImageHoverPosition(
                      event.clientX,
                      event.clientY,
                      event.currentTarget.getBoundingClientRect(),
                    );
                    setImageHoverPosition(position);
                  }}
                  onMouseLeave={() => setImageHoverPosition(null)}
                  onClick={(event) => {
                    if (!markerRowId) return;
                    if (!canWriteMarker) return;
                    const position = getCatalogImageHoverPosition(
                      event.clientX,
                      event.clientY,
                      event.currentTarget.getBoundingClientRect(),
                    );
                    setDraft((current) => ({
                      ...current,
                      rows: current.rows.map((row) => (
                        row.rowId === markerRowId
                          ? { ...row, position: catalogPositionFromPoint(position.x, position.y) }
                          : row
                      )),
                    }));
                    sweetAlert.notifySuccess("Lokasi item ditandai", "Klik Simpan Data untuk menyimpan lokasi.");
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={currentMediaSrc}
                    alt={selectedPanelTitle}
                    draggable={false}
                    className="h-full min-h-[36rem] w-full object-contain transition-transform duration-150"
                    style={{
                      transform: imageHoverPosition && !markerRowId ? "scale(1.35)" : "scale(1)",
                      transformOrigin: imageHoverPosition
                        ? `${imageHoverPosition.x}% ${imageHoverPosition.y}%`
                        : "50% 50%",
                    }}
                  />
                  {!markerRowId ? (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setImageZoom(1);
                        setImageZoomOpen(true);
                      }}
                      className="absolute right-2 top-2 flex items-center gap-1 border border-border bg-background/90 px-2 py-1 text-xs font-medium text-foreground shadow-sm hover:border-primary"
                    >
                      <Maximize2 className="h-3.5 w-3.5" />
                      Zoom
                    </button>
                  ) : null}
                  {markerPosition ? (
                    <div
                      className="pointer-events-none absolute -translate-x-1/2 -translate-y-full text-primary drop-shadow"
                      style={{ left: `${markerPosition.x}%`, top: `${markerPosition.y}%` }}
                      title="Lokasi item"
                    >
                      <MapPin className="h-7 w-7 fill-primary/20" />
                    </div>
                  ) : null}
                  {markerRowId ? (
                    <div className="absolute left-3 top-3 border border-primary/35 bg-background/90 px-3 py-2 text-xs font-medium text-foreground shadow-sm">
                      {canWriteMarker ? "📌 Tandai: " : "Lokasi item: "}{itemLabel(markerRow)}
                    </div>
                  ) : null}
                </div>
                <CompactInput
                  value={currentMedia.caption}
                  onChange={(event) => setDraft((current) => ({
                    ...current,
                    panelImages: current.panelImages.map((media, index) => (
                      index === selectedMediaIndex ? { ...media, caption: event.target.value } : media
                    )),
                  }))}
                  disabled={!editMode}
                  placeholder="Keterangan gambar"
                />
              </div>
            ) : (
              <div className="flex h-40 items-center justify-center border border-dashed border-border text-sm text-muted-foreground">
                Belum ada gambar referensi.
              </div>
            )}

            {draft.panelImages.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {draft.panelImages.map((media, index) => (
                  <MediaThumb
                    key={`${media.id ?? "new"}-${index}`}
                    src={media.fileUrl}
                    alt={`${selectedPanelTitle} ${index + 1}`}
                    active={selectedMediaIndex === index}
                    onClick={() => setSelectedMediaIndex(index)}
                  />
                ))}
              </div>
            ) : null}

            {editMode && !markerRowId ? (
              <div className="space-y-2 border-t border-border pt-3">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") fileInputRef.current?.click();
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setIsDraggingImage(true);
                  }}
                  onDragLeave={() => setIsDraggingImage(false)}
                  onDrop={(event) => {
                    event.preventDefault();
                    setIsDraggingImage(false);
                    stageImages(Array.from(event.dataTransfer.files));
                  }}
                  className={`flex min-h-32 cursor-pointer flex-col items-center justify-center gap-1 border border-dashed px-4 py-5 text-center transition ${
                    isDraggingImage ? "border-primary bg-primary/5" : "border-border bg-muted/20"
                  }`}
                >
                  <ImagePlus className="h-5 w-5 text-muted-foreground" />
                  <p className="text-sm font-medium text-foreground">Drop gambar disini</p>
                  <p className="text-xs text-muted-foreground">atau paste Ctrl+V</p>
                  <p className="text-xs text-muted-foreground">atau pilih file</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                    multiple
                    className="hidden"
                    onChange={(event) => {
                      stageImages(Array.from(event.target.files ?? []));
                      event.currentTarget.value = "";
                    }}
                  />
                </div>
                <div className="flex gap-2">
                  <CompactInput
                    value={imageUrlInput}
                    onChange={(event) => setImageUrlInput(event.target.value)}
                    placeholder="Tempel URL gambar"
                  />
                  <ActionButton onClick={addImageFromUrl}>
                    <ImagePlus className="h-3.5 w-3.5" />
                    + URL
                  </ActionButton>
                  <ActionButton onClick={() => { void removeCurrentImage(); }} disabled={!currentMedia}>
                    <Trash2 className="h-3.5 w-3.5" />
                    Hapus
                  </ActionButton>
                </div>
              </div>
            ) : null}
          </SectionCard>

          <SectionCard
            label="Daftar Item"
            count={draft.rows.length}
            className="min-h-[42rem]"
          >
            <div className="h-[34rem] border border-border">
              <UnitCatalogEditor
                rows={draft.rows}
                editMode={editMode}
                searchValue={gridSearch}
                selectedRowIds={selectedRowIds}
                onSearchChange={setGridSearch}
                onRowsChange={(rows) => setDraft((current) => ({ ...current, rows }))}
                onSelectedRowIdsChange={setSelectedRowIds}
                onAddRow={() => setDraft((current) => ({ ...current, rows: appendEmptyCatalogDraftRow(current.rows) }))}
                onDeleteSelected={handleDeleteSelectedRows}
                onOpenDetail={openItemDrawer}
                onMarkPosition={startMarkPosition}
                onSurvey={openSurvey}
              />
            </div>
          </SectionCard>
        </div>
      ) : (
        <SectionCard label="Panel Catalog" count={overview?.panels.length ?? 0}>
          <div className="flex flex-wrap gap-2">
            <select
              value={componentFilter}
              onChange={(event) => setComponentFilter(event.target.value)}
              className="h-9 min-w-[14rem] border border-border bg-card px-3 text-sm"
            >
              <option value="">Semua komponen</option>
              {overview?.components.map((component) => (
                <option key={component.id} value={component.id}>
                  {component.componentName}
                </option>
              ))}
            </select>
            <div className="min-w-[18rem] flex-1">
              <CompactInput
                value={panelSearch}
                onChange={(event) => setPanelSearch(event.target.value)}
                placeholder="Cari panel atau item"
              />
            </div>
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">Memuat daftar panel...</p>
          ) : searchHits.length > 0 ? (
            <div className="space-y-2">
              {searchHits.map((item) => (
                <button
                  key={`${item.itemId}-${item.panelId}`}
                  type="button"
                  onClick={() => { void openPanel(item.panelId); }}
                  className="flex w-full items-center justify-between border border-border px-3 py-2 text-left hover:border-primary/40 hover:bg-primary/5"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{item.itemName ?? item.partNumber ?? item.code ?? item.panelName}</p>
                    <p className="text-xs text-muted-foreground">{item.componentName} · {item.panelName}</p>
                  </div>
                  <Search className="h-4 w-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          ) : (overview?.panels.length ?? 0) === 0 ? (
            <div className="flex items-center gap-2 border border-dashed border-border px-3 py-6 text-sm text-muted-foreground">
              <AlertCircle className="h-4 w-4" />
              Belum ada panel catalog.
            </div>
          ) : filteredGroups.length > 0 ? (
            <div className="grid gap-4 xl:grid-cols-2">
              {filteredGroups.map((group) => (
                <div key={group.component.id} className="border border-border">
                  <div className="border-b border-border bg-muted/40 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                    {group.component.componentName}
                  </div>
                  <div className="divide-y divide-border">
                    {group.panels.map((panel) => (
                      <button
                        key={panel.id}
                        type="button"
                        onClick={() => { void openPanel(panel.id); }}
                        className="flex w-full items-center justify-between px-3 py-3 text-left hover:bg-primary/5"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">{panel.panelName}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatItemCount(panel.itemCount)} item · {formatItemCount(panel.restorationCount)} dipilih restorasi
                          </p>
                        </div>
                        <div className="text-right text-xs text-muted-foreground">
                          {panel.itemCount > 0 ? "Sudah ada" : "Belum diisi"}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 border border-dashed border-border px-3 py-6 text-sm text-muted-foreground">
              <AlertCircle className="h-4 w-4" />
              Tidak ada panel yang cocok dengan filter.
            </div>
          )}
        </SectionCard>
      )}

      {selectedPanelId && loadingPanel ? (
        <div className="border border-border px-3 py-4 text-sm text-muted-foreground">Memuat workspace panel...</div>
      ) : null}

      {drawerRow ? (
        <div className="fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l border-border bg-card shadow-2xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="min-w-0">
              <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Data Item</p>
              <p className="truncate text-sm font-semibold text-foreground">{itemLabel(drawerRow)}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setDrawerRowId(null);
                setMarkerRowId(null);
              }}
              className="border border-border p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Tutup detail item"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
            <div className="grid gap-3 text-sm">
              {drawerRow.aliasName?.trim() ? (
                <div>
                  <p className="text-xs text-muted-foreground">Alias Name</p>
                  <p className="font-medium text-foreground">{drawerRow.aliasName}</p>
                </div>
              ) : null}
              <div>
                <p className="text-xs text-muted-foreground">Original Name</p>
                <p className="font-medium text-foreground">{drawerRow.itemName || "-"}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Part Number</p>
                  <p className="font-medium text-foreground">{drawerRow.partNumber || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Code</p>
                  <p className="font-medium text-foreground">{drawerRow.code || "-"}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Qty</p>
                  <p className="font-medium text-foreground">{drawerRow.qtyNormal || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <p className="font-medium text-foreground">{surveyStatusText(drawerRow)}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Availability</p>
                  <p className="font-medium text-foreground">{availabilityText(drawerRow.availabilityStatus)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Condition</p>
                  <p className="font-medium text-foreground">{conditionText(drawerRow.conditionStatus)}</p>
                </div>
              </div>
            </div>

            {!drawerRow.promotedPanelId ? (
            <div className="border-t border-border pt-4">
              <FieldLabel>Pendataan</FieldLabel>
              <div className="space-y-3">
                <CompactInput
                  value={surveyForm.actualName}
                  onChange={(event) => setSurveyForm((current) => ({ ...current, actualName: event.target.value }))}
                  placeholder="Alias name"
                />
                <div>
                  <p className="mb-1.5 text-xs text-muted-foreground">Availability</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      ["AVAILABLE", "Ada"],
                      ["NOT_AVAILABLE", "Tidak Ada"],
                      ["UNKNOWN", "Tidak Ditemukan"],
                    ].map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setSurveyForm((current) => ({ ...current, availabilityStatus: value as SurveyForm["availabilityStatus"] }))}
                        className={`border px-2 py-2 text-xs ${surveyForm.availabilityStatus === value ? "border-primary bg-primary/10 text-app-accent-ink" : "border-border text-muted-foreground hover:bg-muted"}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-1.5 text-xs text-muted-foreground">Condition</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      ["GOOD", "Layak"],
                      ["RESTORE", "Restorasi"],
                      ["NOT_USABLE", "Tidak Layak"],
                    ].map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setSurveyForm((current) => ({ ...current, conditionStatus: value as SurveyForm["conditionStatus"] }))}
                        className={`border px-2 py-2 text-xs ${surveyForm.conditionStatus === value ? "border-primary bg-primary/10 text-app-accent-ink" : "border-border text-muted-foreground hover:bg-muted"}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="flex items-center gap-2 border border-border px-3 py-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={surveyForm.isRestoration}
                    onChange={(event) => setSurveyForm((current) => ({ ...current, isRestoration: event.target.checked }))}
                  />
                  Masuk Progress Restorasi
                </label>
                <CompactTextarea
                  value={surveyForm.notes}
                  onChange={(event) => setSurveyForm((current) => ({ ...current, notes: event.target.value }))}
                  placeholder="Catatan pendataan"
                  rows={3}
                />
              </div>
            </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3">
            <div className="flex items-center gap-1.5">
              <ActionButton onClick={() => startMarkPosition(drawerRow)}>
                <span aria-hidden="true" className="text-[13px] leading-none">📌</span>
                {drawerRow.promotedPanelId ? "Lihat Lokasi" : "Tandai"}
              </ActionButton>
              {drawerRow.promotedPanelId ? (
                <ActionButton onClick={() => router.push(`/units/${encodeURIComponent(unitId)}?tab=master-panel`)}>
                  <Eye className="h-3.5 w-3.5" />
                  Master Panel
                </ActionButton>
              ) : null}
            </div>
            <div className="flex items-center gap-1.5">
              <ActionButton onClick={() => {
                setDrawerRowId(null);
                setMarkerRowId(null);
              }}>
                Kembali
              </ActionButton>
              {!drawerRow.promotedPanelId ? (
                <ActionButton variant="primary" onClick={() => { void saveSurvey(); }} disabled={!drawerRow.persistedId || surveySaving}>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {surveySaving ? "Menyimpan" : "Simpan Data"}
                </ActionButton>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {selectedPanelId && workspace ? (
        <div className="flex items-center justify-between border border-border bg-card px-4 py-3 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <ArrowUpDown className="h-4 w-4" />
            {dirty ? "Ada perubahan yang belum disimpan." : "Data panel sudah sinkron dengan server."}
          </div>
          <div className="font-mono text-xs text-muted-foreground">
            {formatItemCount(serializeSafeCount(draft.rows))} row aktif
          </div>
        </div>
      ) : null}
    </div>
    </>
  );
}

function printCheck(active: boolean) {
  return active ? "✓" : "";
}

function CatalogPanelPrintView({
  unitName,
  componentLabel,
  panelTitle,
  imageSrc,
  rows,
}: {
  unitName: string;
  componentLabel: string;
  panelTitle: string;
  imageSrc?: string;
  rows: CatalogWorkspaceDraft["rows"];
}) {
  const printableRows = rows.filter((row) => (
    row.aliasName.trim() ||
    row.itemName.trim() ||
    row.partNumber.trim() ||
    row.code.trim() ||
    row.qtyNormal.trim()
  ));

  return (
    <div className="catalog-print-root hidden bg-white text-black">
      <section className="catalog-print-page catalog-print-image-page">
        <h1 className="catalog-print-title">{unitName}</h1>
        <div className="catalog-print-subtitle">{componentLabel} · {panelTitle}</div>
        <div className="catalog-print-image-frame">
          {imageSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageSrc} alt={panelTitle} />
          ) : (
            <div className="catalog-print-empty-image">Belum ada gambar referensi</div>
          )}
        </div>
      </section>

      <section className="catalog-print-page">
        <h1 className="catalog-print-title">{unitName}</h1>
        <div className="catalog-print-subtitle">{componentLabel} · {panelTitle}</div>
        <table className="catalog-print-table">
          <colgroup>
            <col className="w-[3%]" />
            <col className="w-[12%]" />
            <col className="w-[25%]" />
            <col className="w-[5%]" />
            <col className="w-[5%]" />
            <col className="w-[6%]" />
            <col className="w-[4%]" />
            <col className="w-[4%]" />
            <col className="w-[7%]" />
            <col className="w-[4%]" />
            <col className="w-[5%]" />
            <col className="w-[7%]" />
            <col className="w-[5%]" />
            <col className="w-[6%]" />
            <col className="w-[7%]" />
          </colgroup>
          <thead>
            <tr>
              <th rowSpan={2}>No.</th>
              <th rowSpan={2}>Parts Number</th>
              <th rowSpan={2}>Name</th>
              <th rowSpan={2}>Code</th>
              <th rowSpan={2}>Qty Normal</th>
              <th rowSpan={2}>Qty Opname</th>
              <th colSpan={3}>Status</th>
              <th colSpan={4}>Kondisi</th>
              <th rowSpan={2}>Lokasi</th>
              <th rowSpan={2}>Keterangan</th>
            </tr>
            <tr>
              <th>Ada</th>
              <th>Tidak</th>
              <th>Tidak Ditemukan</th>
              <th>Layak</th>
              <th>Restore</th>
              <th>Tidak Layak</th>
              <th>Progress</th>
            </tr>
          </thead>
          <tbody>
            {printableRows.map((row, index) => (
              <tr key={row.rowId}>
                <td>{index + 1}</td>
                <td>{row.partNumber}</td>
                <td>{row.aliasName || row.itemName}</td>
                <td>{row.code}</td>
                <td>{row.qtyNormal}</td>
                <td />
                <td>{printCheck(row.availabilityStatus === "AVAILABLE")}</td>
                <td>{printCheck(row.availabilityStatus === "NOT_AVAILABLE")}</td>
                <td>{printCheck(row.availabilityStatus === "UNKNOWN")}</td>
                <td>{printCheck(row.conditionStatus === "GOOD")}</td>
                <td>{printCheck(row.conditionStatus === "RESTORE")}</td>
                <td>{printCheck(row.conditionStatus === "NOT_USABLE")}</td>
                <td>{printCheck(row.isRestoration)}</td>
                <td>{parseCatalogPositionMarker(row.position) ? "Ditandai" : ""}</td>
                <td />
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function serializeSafeCount(rows: CatalogWorkspaceDraft["rows"]) {
  try {
    return serializeCatalogDraftRows(rows).length;
  } catch {
    return rows.length;
  }
}
