/*
Tujuan: Halaman tambah catalog unit berbasis spreadsheet ringkas.
Caller: route /units/[unitId]/catalog/new.
Dependensi: AG Grid, API unit-catalog, helper spreadsheet.
Main Functions: pilih panel, input code/number part/name parts/qty, paste/drop gambar, simpan batch.
Side Effects: HTTP create/open panel, upload gambar, save catalog workspace.
*/

"use client";

import type { ColDef } from "ag-grid-community";
import { AllCommunityModule, ModuleRegistry } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import type { CatalogOverview } from "@smsystem/contracts/unit-catalog";
import { ArrowLeft, ImagePlus, MapPin, Save, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  appendEmptyCatalogDraftRow,
  catalogImageMaxBytes,
  catalogPositionFromPoint,
  createCatalogDraftRow,
  createCatalogWorkspaceDraft,
  getCatalogImageFilesFromClipboardItems,
  getCatalogImageHoverPosition,
  isValidCatalogImageFile,
  parseCatalogPositionMarker,
  removeCatalogDraftImage,
  removeCatalogDraftRows,
  resolveCatalogPanelImagesForSave,
  serializeCatalogDraftRows,
  stageCatalogImageFiles,
  updateCatalogDraftCell,
  type CatalogDraftRow,
  type CatalogWorkspaceDraft,
} from "@/modules/units/helpers/unit-catalog-sheet";
import {
  fetchUnitCatalog,
  openUnitCatalogPanel,
  saveUnitCatalogPanelWorkspace,
} from "@/shared/api/units/unit-catalog";
import { getApiBaseUrl, getProxiedImageUrl } from "@/shared/api/config/config";
import { ActionButton, CompactInput, PageHeader, SectionCard } from "@/shared/ui/compact";
import { useSweetAlert } from "@/shared/ui/sweet-alert";

ModuleRegistry.registerModules([AllCommunityModule]);

interface UnitCatalogCreatePageProps {
  unitId: string;
  unitName: string;
}

function formatBytes(value: number) {
  return `${Math.round(value / 1024 / 1024)} MB`;
}

function rowTitle(row: CatalogDraftRow | null) {
  if (!row) return "-";
  return row.itemName || row.partNumber || row.code || "Item belum bernama";
}

function firstActiveRow(rows: CatalogDraftRow[]) {
  return rows.find((row) => row.itemName.trim() || row.partNumber.trim() || row.code.trim() || row.qtyNormal.trim()) ?? null;
}

const createCatalogGridFields = ["code", "partNumber", "itemName", "qtyNormal"] as const;
type CreateCatalogGridField = typeof createCatalogGridFields[number];

const createCatalogGridHeaders: Record<CreateCatalogGridField, string> = {
  code: "CODE",
  partNumber: "NumberPart",
  itemName: "NAME PARTS",
  qtyNormal: "QTY NORMAL",
};

function createRowHasValue(row: CatalogDraftRow) {
  return createCatalogGridFields.some((field) => row[field].trim());
}

function normalizeCreateCatalogHeader(value: string) {
  const normalized = value.trim().toUpperCase().replace(/[^A-Z0-9]/gu, "");
  const aliases: Record<string, CreateCatalogGridField> = {
    CODE: "code",
    KODE: "code",
    NUMBERPART: "partNumber",
    NOPART: "partNumber",
    PARTNO: "partNumber",
    PARTNUMBER: "partNumber",
    NAMEPART: "itemName",
    NAMEPARTS: "itemName",
    NAMAPART: "itemName",
    NAMAPARTS: "itemName",
    PARTNAME: "itemName",
    ITEMNAME: "itemName",
    ORIGINALNAME: "itemName",
    QTY: "qtyNormal",
    QTYNORMAL: "qtyNormal",
    JUMLAH: "qtyNormal",
  };
  return aliases[normalized] ?? null;
}

function parseCreateCatalogRows(text: string) {
  return text
    .split(/\r?\n/u)
    .map((line) => line.split("\t"))
    .filter((cells) => cells.some((cell) => cell.trim().length > 0));
}

function resolveCreateCatalogPasteFields(cells: string[], fallbackStartField: CreateCatalogGridField) {
  const mapped = cells.map(normalizeCreateCatalogHeader);
  const hasHeader = mapped.filter(Boolean).length >= 2 && cells.every((cell, index) => !cell.trim() || Boolean(mapped[index]));
  if (hasHeader) return { hasHeader, fields: mapped };

  const startIndex = createCatalogGridFields.indexOf(fallbackStartField);
  return {
    hasHeader,
    fields: createCatalogGridFields.slice(Math.max(0, startIndex)),
  };
}

function applyCreateCatalogPaste(
  rows: CatalogDraftRow[],
  input: { rowIndex: number; column: CreateCatalogGridField; text: string },
) {
  const parsedRows = parseCreateCatalogRows(input.text);
  if (parsedRows.length === 0) return rows;

  const { hasHeader, fields } = resolveCreateCatalogPasteFields(parsedRows[0] ?? [], input.column);
  const dataRows = hasHeader ? parsedRows.slice(1) : parsedRows;
  if (dataRows.length === 0) return rows;

  const nextRows = [...rows];
  while (nextRows.length < input.rowIndex + dataRows.length) {
    nextRows.push(createCatalogDraftRow());
  }

  return nextRows.map((row, rowIndex) => {
    const pastedRow = dataRows[rowIndex - input.rowIndex];
    if (!pastedRow || row.promotedPanelId) return row;
    const next = { ...row };
    fields.forEach((field, columnIndex) => {
      if (!field) return;
      next[field] = (pastedRow[columnIndex] ?? "").replace(/\r/gu, "");
    });
    return next;
  });
}

function createCatalogRowsToClipboardTsv(rows: CatalogDraftRow[]) {
  const lines = [
    createCatalogGridFields.map((field) => createCatalogGridHeaders[field]),
    ...rows.map((row) => createCatalogGridFields.map((field) => row[field])),
  ];
  return lines
    .map((cells) => cells.map((cell) => cell.replace(/\r?\n/gu, " ").replace(/\t/gu, " ").trim()).join("\t"))
    .join("\n");
}

interface UnitCatalogCreateGridProps {
  rows: CatalogDraftRow[];
  searchValue: string;
  selectedRowIds: string[];
  onSearchChange: (value: string) => void;
  onRowsChange: (rows: CatalogDraftRow[]) => void;
  onSelectedRowIdsChange: (rowIds: string[]) => void;
  onAddRow: () => void;
  onDeleteSelected: () => void;
}

function qtyCellClass(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return "";
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? "" : "catalog-cell-invalid";
}

function UnitCatalogCreateGrid({
  rows,
  searchValue,
  selectedRowIds,
  onSearchChange,
  onRowsChange,
  onSelectedRowIdsChange,
  onAddRow,
  onDeleteSelected,
}: UnitCatalogCreateGridProps) {
  const gridRef = useRef<AgGridReact<CatalogDraftRow>>(null);

  useEffect(() => {
    const lastRow = rows.at(-1);
    if (!lastRow || createRowHasValue(lastRow)) onAddRow();
  }, [onAddRow, rows]);

  const columnDefs = useMemo<ColDef<CatalogDraftRow>[]>(() => ([
    {
      field: "code",
      headerName: createCatalogGridHeaders.code,
      minWidth: 120,
      editable: (params) => !params.data?.promotedPanelId,
    },
    {
      field: "partNumber",
      headerName: createCatalogGridHeaders.partNumber,
      minWidth: 160,
      editable: (params) => !params.data?.promotedPanelId,
    },
    {
      field: "itemName",
      headerName: createCatalogGridHeaders.itemName,
      minWidth: 240,
      flex: 1,
      editable: (params) => !params.data?.promotedPanelId,
    },
    {
      field: "qtyNormal",
      headerName: createCatalogGridHeaders.qtyNormal,
      minWidth: 120,
      editable: (params) => !params.data?.promotedPanelId,
      cellClass: (params) => qtyCellClass(params.value),
    },
  ]), []);

  function handlePaste(text: string) {
    const focused = gridRef.current?.api?.getFocusedCell();
    const rowIndex = focused?.rowIndex ?? 0;
    const column = focused?.column?.getColId() as CreateCatalogGridField | undefined;
    const targetColumn = column && createCatalogGridFields.includes(column) ? column : "code";
    onRowsChange(applyCreateCatalogPaste(rows, { rowIndex, column: targetColumn, text }));
  }

  function getRowsForCopy() {
    const selected = gridRef.current?.api?.getSelectedRows() ?? [];
    if (selected.length > 0) return selected;
    const visible: CatalogDraftRow[] = [];
    gridRef.current?.api?.forEachNodeAfterFilterAndSort((node) => {
      if (node.data) visible.push(node.data);
    });
    return visible.length > 0 ? visible : rows;
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <div className="min-w-[14rem] flex-1">
          <CompactInput
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Cari code, number part, atau name parts"
          />
        </div>
        <ActionButton onClick={onAddRow}>+ Baris</ActionButton>
        <ActionButton disabled={selectedRowIds.length === 0} onClick={onDeleteSelected}>
          <Trash2 className="h-3.5 w-3.5" />
          Hapus
        </ActionButton>
      </div>
      <div className="border-b border-border px-4 py-2 text-[12px] text-muted-foreground">
        Urutan paste Excel: CODE, NumberPart, NAME PARTS, QTY NORMAL.
      </div>
      <div
        className="ag-theme-alpine sms-ag-grid h-full min-h-[30rem] w-full"
        onKeyDownCapture={(event) => {
          const activeElement = document.activeElement;
          if (activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement) return;
          if ((event.key === "Delete" || event.key === "Backspace") && selectedRowIds.length > 0) {
            event.preventDefault();
            onDeleteSelected();
          }
        }}
        onPasteCapture={(event) => {
          const text = event.clipboardData.getData("text/plain");
          if (!text.trim()) return;
          event.preventDefault();
          handlePaste(text);
        }}
        onCopyCapture={(event) => {
          const activeElement = document.activeElement;
          if (activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement) return;
          event.preventDefault();
          event.clipboardData.setData("text/plain", createCatalogRowsToClipboardTsv(getRowsForCopy()));
        }}
      >
        <AgGridReact<CatalogDraftRow>
          ref={gridRef}
          rowData={rows}
          columnDefs={columnDefs}
          rowSelection="multiple"
          animateRows={false}
          suppressMovableColumns
          suppressClipboardPaste
          quickFilterText={searchValue}
          getRowId={(params) => params.data.rowId}
          defaultColDef={{
            sortable: true,
            resizable: true,
            editable: true,
          }}
          onSelectionChanged={(event) => {
            onSelectedRowIdsChange(event.api.getSelectedRows().map((row) => row.rowId));
          }}
          onCellValueChanged={(event) => {
            const field = event.colDef.field;
            if (!field || !createCatalogGridFields.includes(field as CreateCatalogGridField)) return;
            onRowsChange(updateCatalogDraftCell(rows, event.data.rowId, field as CreateCatalogGridField, String(event.newValue ?? "")));
          }}
        />
      </div>
    </div>
  );
}

export function UnitCatalogCreatePage({ unitId, unitName }: UnitCatalogCreatePageProps) {
  const router = useRouter();
  const sweetAlert = useSweetAlert();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const panelImagesRef = useRef<CatalogWorkspaceDraft["panelImages"]>([]);
  const [overview, setOverview] = useState<CatalogOverview | null>(null);
  const [draft, setDraft] = useState<CatalogWorkspaceDraft>(createCatalogWorkspaceDraft());
  const [componentCode, setComponentCode] = useState("");
  const [panelName, setPanelName] = useState("");
  const [gridSearch, setGridSearch] = useState("");
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const [selectedMediaIndex, setSelectedMediaIndex] = useState(0);
  const [imageUrlInput, setImageUrlInput] = useState("");
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [markerRowId, setMarkerRowId] = useState<string | null>(null);

  const selectedComponent = overview?.components.find((component) => component.code === componentCode) ?? null;
  const panelChoices = useMemo(() => {
    if (!overview || !selectedComponent) return [];
    return overview.panels
      .filter((panel) => panel.componentId === selectedComponent.id)
      .map((panel) => panel.panelName)
      .sort((left, right) => left.localeCompare(right));
  }, [overview, selectedComponent]);
  const currentMedia = draft.panelImages[selectedMediaIndex] ?? null;
  const currentMediaSrc = currentMedia?.fileUrl ? getProxiedImageUrl(currentMedia.fileUrl) : undefined;
  const markerRow = markerRowId ? draft.rows.find((row) => row.rowId === markerRowId) ?? null : null;
  const markerPosition = parseCatalogPositionMarker(markerRow?.position);
  const selectedRow = selectedRowIds[0] ? draft.rows.find((row) => row.rowId === selectedRowIds[0]) ?? null : null;

  useEffect(() => {
    void loadOverview();
  }, [unitId]);

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const files = getCatalogImageFilesFromClipboardItems(Array.from(event.clipboardData?.items ?? []));
      if (files.length === 0) return;
      event.preventDefault();
      stageImages(files);
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, []);

  useEffect(() => {
    panelImagesRef.current = draft.panelImages;
  }, [draft.panelImages]);

  useEffect(() => {
    return () => {
      panelImagesRef.current.forEach((image) => {
        if (image.file && image.fileUrl.startsWith("blob:")) URL.revokeObjectURL(image.fileUrl);
      });
    };
  }, []);

  async function loadOverview() {
    setLoading(true);
    const result = await fetchUnitCatalog(unitId);
    setLoading(false);
    if (!result.success) {
      sweetAlert.notifyError("Catalog belum dapat dimuat", result.message);
      return;
    }
    setOverview(result.payload.data.overview);
    const firstComponent = result.payload.data.overview.components[0];
    if (firstComponent) setComponentCode((current) => current || firstComponent.code);
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
    sweetAlert.notifySuccess("Gambar masuk draft", `${validFiles.length} gambar siap disimpan.`);
  }

  function addImageFromUrl() {
    const value = imageUrlInput.trim();
    if (!value) return;
    setDraft((current) => ({
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
    }));
    setSelectedMediaIndex(draft.panelImages.length);
    setImageUrlInput("");
  }

  const addRow = useCallback(() => {
    setDraft((current) => ({ ...current, rows: appendEmptyCatalogDraftRow(current.rows) }));
  }, []);

  const deleteSelectedRows = useCallback(() => {
    setDraft((current) => ({ ...current, rows: removeCatalogDraftRows(current.rows, selectedRowIds) }));
    setSelectedRowIds([]);
  }, [selectedRowIds]);

  function removeCurrentImage() {
    if (!currentMedia) return;
    setDraft((current) => ({
      ...current,
      panelImages: removeCatalogDraftImage(current.panelImages, selectedMediaIndex).images,
    }));
    if (currentMedia.file && currentMedia.fileUrl.startsWith("blob:")) URL.revokeObjectURL(currentMedia.fileUrl);
    setSelectedMediaIndex((current) => Math.max(0, current - 1));
  }

  function startMarkPosition(row: CatalogDraftRow) {
    if (!currentMedia) {
      sweetAlert.notifyError("Gambar belum ada", "Tambahkan atau paste gambar dulu sebelum menandai posisi item.");
      return;
    }
    setMarkerRowId(row.rowId);
    sweetAlert.notifySuccess("Mode tandai", "Klik titik item pada gambar referensi.");
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

  async function saveCatalog() {
    const cleanPanelName = panelName.trim();
    if (!componentCode) {
      sweetAlert.notifyError("Komponen wajib dipilih");
      return;
    }
    if (!cleanPanelName) {
      sweetAlert.notifyError("Nama panel wajib diisi");
      return;
    }

    let items;
    let panelImages;
    try {
      items = serializeCatalogDraftRows(draft.rows);
      if (items.length === 0) {
        sweetAlert.notifyError("Item catalog masih kosong", "Isi minimal satu baris item di grid.");
        return;
      }
      panelImages = await resolveCatalogPanelImagesForSave(draft.panelImages, uploadImageFile);
    } catch (error) {
      sweetAlert.notifyError(
        error instanceof Error && error.message.startsWith("QTY_INVALID:") ? "Qty belum valid" : "Catalog belum siap disimpan",
        error instanceof Error ? error.message.replace("QTY_INVALID:", "Isi qty tidak valid: ") : "Periksa kembali data.",
      );
      return;
    }

    setSaving(true);
    const opened = await openUnitCatalogPanel(unitId, {
      componentCode: componentCode as "ENGINE" | "UNDERCARRIAGE" | "ELECTRICAL" | "BODY" | "INTERIOR",
      panelName: cleanPanelName,
    });
    if (!opened.success) {
      setSaving(false);
      sweetAlert.notifyError("Panel belum bisa dibuat", opened.message);
      return;
    }

    const targetPanelId = opened.payload.data.workspace.panel.id;
    const saved = await saveUnitCatalogPanelWorkspace(unitId, targetPanelId, {
      items,
      deletedItemIds: [],
      panelImages,
      deletedPanelImageIds: [],
    });
    setSaving(false);

    if (!saved.success) {
      sweetAlert.notifyError("Catalog belum tersimpan", saved.message);
      return;
    }

    sweetAlert.notifySuccess("Catalog tersimpan", "Data baru sudah masuk ke database.");
    router.push(`/units/${encodeURIComponent(unitId)}?tab=catalog`);
  }

  const activeRows = draft.rows.filter((row) => row.itemName.trim() || row.partNumber.trim() || row.code.trim() || row.qtyNormal.trim());
  const activeMarkerRow = markerRow ?? firstActiveRow(draft.rows);

  return (
    <div className="space-y-4">
      {sweetAlert.alertElement}
      <PageHeader
        eyebrow={`Unit / Catalog · ${unitName}`}
        title="Tambah Catalog Baru"
        actions={(
          <>
            <Link href={`/units/${encodeURIComponent(unitId)}?tab=catalog`}>
              <ActionButton>
                <ArrowLeft className="h-3.5 w-3.5" />
                Kembali
              </ActionButton>
            </Link>
            <ActionButton variant="primary" disabled={saving || loading} onClick={() => { void saveCatalog(); }}>
              <Save className="h-3.5 w-3.5" />
              {saving ? "Menyimpan" : "Simpan Catalog"}
            </ActionButton>
          </>
        )}
      />

      <SectionCard label="Panel Tujuan">
        <div className="grid gap-3 md:grid-cols-[minmax(12rem,0.7fr)_minmax(18rem,1fr)]">
          <label className="text-[11px] text-muted-foreground">
            Komponen
            <select
              value={componentCode}
              onChange={(event) => {
                setComponentCode(event.target.value);
                setPanelName("");
              }}
              className="mt-1 h-9 w-full border border-border bg-card px-3 text-[13px] text-foreground outline-none focus:border-primary/55"
            >
              {overview?.components.map((component) => (
                <option key={component.id} value={component.code}>
                  {component.componentName}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[11px] text-muted-foreground">
            Nama Panel
            <input
              list="unit-catalog-panel-options"
              value={panelName}
              onChange={(event) => setPanelName(event.target.value)}
              className="mt-1 h-9 w-full border border-border bg-card px-3 text-[13px] text-foreground outline-none focus:border-primary/55"
              placeholder="Ketik panel baru atau pilih panel existing"
            />
            <datalist id="unit-catalog-panel-options">
              {panelChoices.map((name) => <option key={name} value={name} />)}
            </datalist>
          </label>
        </div>
      </SectionCard>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(22rem,0.75fr)]">
        <SectionCard label="Daftar Item" count={activeRows.length} className="min-h-[38rem]">
          <div className="h-[34rem] border border-border">
            <UnitCatalogCreateGrid
              rows={draft.rows}
              searchValue={gridSearch}
              selectedRowIds={selectedRowIds}
              onSearchChange={setGridSearch}
              onRowsChange={(rows) => setDraft((current) => ({ ...current, rows }))}
              onSelectedRowIdsChange={setSelectedRowIds}
              onAddRow={addRow}
              onDeleteSelected={deleteSelectedRows}
            />
          </div>
        </SectionCard>

        <SectionCard label="Gambar Referensi" count={draft.panelImages.length} className="min-h-[38rem]">
          <div className="space-y-3">
            <div
              className={`relative flex min-h-[22rem] items-center justify-center overflow-hidden border border-border bg-muted/30 ${markerRowId ? "cursor-crosshair" : ""}`}
              onClick={(event) => {
                if (!markerRowId || !currentMedia) return;
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
                setMarkerRowId(null);
                sweetAlert.notifySuccess("Lokasi item ditandai");
              }}
            >
              {currentMediaSrc ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={currentMediaSrc} alt="Gambar referensi catalog" className="h-full max-h-[32rem] w-full object-contain" draggable={false} />
                  {markerPosition ? (
                    <div
                      className="pointer-events-none absolute -translate-x-1/2 -translate-y-full text-primary drop-shadow"
                      style={{ left: `${markerPosition.x}%`, top: `${markerPosition.y}%` }}
                    >
                      <MapPin className="h-7 w-7 fill-primary/20" />
                    </div>
                  ) : null}
                  {markerRowId ? (
                    <div className="absolute left-3 top-3 border border-primary/35 bg-background/90 px-3 py-2 text-xs font-medium text-foreground shadow-sm">
                      Tandai: {rowTitle(activeMarkerRow)}
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="px-6 text-center text-sm text-muted-foreground">
                  Belum ada gambar. drop file, pilih file, atau tempel URL.
                </div>
              )}
            </div>

            {currentMedia ? (
              <div className="space-y-2">
                <CompactInput
                  value={currentMedia.caption}
                  onChange={(event) => setDraft((current) => ({
                    ...current,
                    panelImages: current.panelImages.map((image, index) => (
                      index === selectedMediaIndex ? { ...image, caption: event.target.value } : image
                    )),
                  }))}
                  placeholder="Keterangan gambar"
                />
                <ActionButton disabled={!selectedRow || !currentMedia} onClick={() => selectedRow && startMarkPosition(selectedRow)}>
                  <MapPin className="h-3.5 w-3.5" />
                  Tandai Baris Dipilih
                </ActionButton>
              </div>
            ) : null}

            {draft.panelImages.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {draft.panelImages.map((image, index) => (
                  <button
                    key={`${image.id ?? "new"}-${index}`}
                    type="button"
                    onClick={() => setSelectedMediaIndex(index)}
                    className={`aspect-[4/3] overflow-hidden border ${selectedMediaIndex === index ? "border-primary" : "border-border"}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={getProxiedImageUrl(image.fileUrl)} alt={`Referensi ${index + 1}`} className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            ) : null}

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
              className={`flex min-h-28 cursor-pointer flex-col items-center justify-center gap-1 border border-dashed px-4 py-4 text-center transition ${
                isDraggingImage ? "border-primary bg-primary/5" : "border-border bg-muted/20"
              }`}
            >
              <ImagePlus className="h-5 w-5 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">Drop atau paste gambar</p>
              <p className="text-xs text-muted-foreground">JPG, PNG, WEBP maksimal {formatBytes(catalogImageMaxBytes)}</p>
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
                + URL
              </ActionButton>
              <ActionButton disabled={!currentMedia} onClick={removeCurrentImage}>
                <Trash2 className="h-3.5 w-3.5" />
                Hapus
              </ActionButton>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
