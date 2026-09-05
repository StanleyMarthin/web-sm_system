/*
Tujuan: Workspace catalog unit berbasis AG Grid Community.
Caller: unit workspace shell.
Dependensi: API unit-catalog, helper spreadsheet, sweet alert.
Main Functions: overview panel, pilih panel, edit batch item, upload media referensi, search.
Side Effects: HTTP fetch/update catalog dan upload file reference.
*/

"use client";

import type { CatalogOverview, CatalogWorkspace } from "@smsystem/contracts/unit-catalog";
import { AlertCircle, ArrowUpDown, ImagePlus, Pencil, Save, Search, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { UnitCatalogEditor } from "@/modules/units/components/unit-catalog-editor";
import {
  appendEmptyCatalogDraftRow,
  catalogImageMaxBytes,
  createCatalogWorkspaceDraft,
  getCatalogImageFilesFromClipboardItems,
  isCatalogDraftDirty,
  isValidCatalogImageFile,
  removeCatalogDraftImage,
  resolveCatalogPanelImagesForSave,
  serializeCatalogDraftRows,
  stageCatalogImageFiles,
  workspaceDraftFromWorkspace,
  type CatalogWorkspaceDraft,
} from "@/modules/units/helpers/unit-catalog-sheet";
import {
  fetchUnitCatalog,
  fetchUnitCatalogPanelWorkspace,
  saveUnitCatalogPanelWorkspace,
  searchUnitCatalog,
} from "@/shared/api/unit-catalog";
import { getApiBaseUrl } from "@/shared/api/config";
import { useSweetAlert } from "@/shared/ui/sweet-alert";
import { ActionButton, CompactInput, PageHeader, SectionCard } from "@/shared/ui/compact";

interface UnitCatalogTabProps {
  unitId: string;
  unitName: string;
}

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
      <img src={src} alt={alt} className="h-full w-full object-cover" />
    </button>
  );
}

export function UnitCatalogTab({ unitId, unitName }: UnitCatalogTabProps) {
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
  const [imageUrlInput, setImageUrlInput] = useState("");
  const [deletedItemIds, setDeletedItemIds] = useState<number[]>([]);
  const [deletedPanelImageIds, setDeletedPanelImageIds] = useState<number[]>([]);
  const [isDraggingImage, setIsDraggingImage] = useState(false);

  const dirty = baseline ? isCatalogDraftDirty(baseline, draft) : false;
  const groupedPanels = useMemo(() => groupPanelsByComponent(overview), [overview]);
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
  }

  async function handleSave() {
    if (!workspace || !selectedPanelId) return;

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
      return;
    }

    setSaving(true);
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
      const deletedIds = current.rows
        .filter((row) => selectedRowIds.includes(row.rowId) && row.persistedId != null)
        .map((row) => row.persistedId as number);
      if (deletedIds.length > 0) {
        setDeletedItemIds((existing) => [...new Set([...existing, ...deletedIds])]);
      }
      return {
        ...current,
        rows: current.rows.filter((row) => !selectedRowIds.includes(row.rowId)).length > 0
          ? current.rows.filter((row) => !selectedRowIds.includes(row.rowId))
          : appendEmptyCatalogDraftRow([]),
      };
    });
    setSelectedRowIds([]);
  }

  const currentMedia = draft.panelImages[selectedMediaIndex] ?? null;

  return (
    <div className="space-y-4">
      {sweetAlert.alertElement}

      <PageHeader
        eyebrow={`Unit / Catalog · ${unitName}`}
        title={selectedPanelId && workspace ? workspace.panel.panelName : "Catalog Unit"}
        actions={selectedPanelId ? (
          editMode ? (
            <>
              <ActionButton onClick={handleCancelEdit}>
                <X className="h-3.5 w-3.5" />
                Batal
              </ActionButton>
              <ActionButton variant="primary" onClick={() => { void handleSave(); }} disabled={saving}>
                <Save className="h-3.5 w-3.5" />
                {saving ? "Menyimpan" : "Simpan"}
              </ActionButton>
            </>
          ) : (
            <>
              <ActionButton onClick={closePanel}>Kembali</ActionButton>
              <ActionButton variant="primary" onClick={() => setEditMode(true)}>
                <Pencil className="h-3.5 w-3.5" />
                Edit Catalog
              </ActionButton>
            </>
          )
        ) : undefined}
      />

      {selectedPanelId && workspace ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.75fr)_22rem]">
          <SectionCard
            label={`${workspace.panel.componentName} / ${workspace.panel.panelName}`}
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
              />
            </div>
          </SectionCard>

          <SectionCard label="Gambar Panel" count={draft.panelImages.length} className="min-h-[42rem]">
            {currentMedia ? (
              <div className="space-y-3">
                <div className="aspect-[4/3] overflow-hidden border border-border bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={currentMedia.fileUrl} alt={workspace.panel.panelName} className="h-full w-full object-contain" />
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
                    alt={`${workspace.panel.panelName} ${index + 1}`}
                    active={selectedMediaIndex === index}
                    onClick={() => setSelectedMediaIndex(index)}
                  />
                ))}
              </div>
            ) : null}

            {editMode ? (
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
  );
}

function serializeSafeCount(rows: CatalogWorkspaceDraft["rows"]) {
  try {
    return serializeCatalogDraftRows(rows).length;
  } catch {
    return rows.length;
  }
}
