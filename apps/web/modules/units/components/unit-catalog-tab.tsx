"use client";

import {
  parseCatalogSpreadsheetText,
  type CatalogItem,
  type CatalogReference,
} from "@smsystem/contracts/unit-catalog";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  addUnitCatalogItemMedia,
  confirmUnitCatalogSurvey,
  createUnitCatalogReference,
  createUnitCatalogPanelJobdescs,
  fetchUnitCatalog,
  fetchUnitCatalogMasterPanel,
  fetchUnitCatalogReference,
  requestUnitCatalogUploadTicket,
  replaceUnitCatalogItems,
  saveUnitCatalogSurvey,
} from "@/shared/api/unit-catalog";

interface UnitCatalogTabProps {
  unitId: string;
  unitName: string;
}

type MarkerDraft = {
  catalogReferenceMediaId: number;
  xPercent: number;
  yPercent: number;
};

type SurveyForm = {
  qtyOpname: string;
  actualName: string;
  availabilityStatus: "UNKNOWN" | "AVAILABLE" | "NOT_AVAILABLE";
  conditionStatus: "UNKNOWN" | "GOOD" | "RESTORE" | "NOT_USABLE";
  actionType: "UNDECIDED" | "NO_ACTION" | "JOBDESC" | "JOBDESC_ORDER";
  location: string;
  notes: string;
  photoFile: File | null;
};

type MasterPanelMedia = {
  fileUrl?: unknown;
  file_url?: unknown;
  mediaType?: unknown;
  media_type?: unknown;
  caption?: unknown;
};

type MasterPanelDetail = Record<string, unknown> & {
  media?: MasterPanelMedia[];
};

type CatalogImportForm = {
  componentName: string;
  panelName: string;
  diagramImageUrl: string;
  referenceUrl: string;
  notes: string;
  spreadsheetText: string;
};

const defaultSurveyForm: SurveyForm = {
  qtyOpname: "",
  actualName: "",
  availabilityStatus: "UNKNOWN",
  conditionStatus: "UNKNOWN",
  actionType: "UNDECIDED",
  location: "",
  notes: "",
  photoFile: null,
};

const statusLabels: Record<CatalogItem["surveyStatus"], string> = {
  NOT_STARTED: "Belum didata",
  DRAFT: "Draft",
  CONFIRMED: "Confirmed",
};

const defaultImportForm: CatalogImportForm = {
  componentName: "",
  panelName: "",
  diagramImageUrl: "",
  referenceUrl: "",
  notes: "",
  spreadsheetText: "",
};

function toNumberOrNull(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function initialForm(item: CatalogItem): SurveyForm {
  return {
    qtyOpname: item.qtyOpname == null ? "" : String(item.qtyOpname),
    actualName: item.actualName ?? "",
    availabilityStatus: item.availabilityStatus,
    conditionStatus: item.conditionStatus,
    actionType: item.actionType,
    location: item.location ?? "",
    notes: item.notes ?? "",
    photoFile: null,
  };
}

function unique(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function panelText(panel: MasterPanelDetail | null, key: string) {
  const value = panel?.[key];
  if (typeof value === "string" && value.trim()) return value;
  if (typeof value === "number") return String(value);
  return "-";
}

function panelMediaUrl(media: MasterPanelMedia) {
  const value = media.fileUrl ?? media.file_url;
  return typeof value === "string" ? value : null;
}

function panelMediaType(media: MasterPanelMedia) {
  const value = media.mediaType ?? media.media_type;
  return typeof value === "string" ? value.toUpperCase() : "";
}

function countCatalogSpreadsheetRows(text: string) {
  try {
    return parseCatalogSpreadsheetText(text).length;
  } catch {
    return 0;
  }
}

export function UnitCatalogTab({ unitId, unitName }: UnitCatalogTabProps) {
  const [references, setReferences] = useState<CatalogReference[]>([]);
  const [reference, setReference] = useState<CatalogReference | null>(null);
  const [selectedItem, setSelectedItem] = useState<CatalogItem | null>(null);
  const [markerDraft, setMarkerDraft] = useState<MarkerDraft | null>(null);
  const [surveyOpen, setSurveyOpen] = useState(false);
  const [form, setForm] = useState<SurveyForm>(defaultSurveyForm);
  const [jobdescOpen, setJobdescOpen] = useState(false);
  const [jobdescPanel, setJobdescPanel] = useState<MasterPanelDetail | null>(null);
  const [jobdescPanelLoading, setJobdescPanelLoading] = useState(false);
  const [jobdesc, setJobdesc] = useState({
    divisionId: "",
    jobTypeId: "",
    description: "",
    targetHoursInitial: "",
  });
  const [importForm, setImportForm] = useState<CatalogImportForm>(defaultImportForm);
  const [importOpen, setImportOpen] = useState(false);
  const [filters, setFilters] = useState({ component: "", panel: "", search: "", status: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchUnitCatalog(unitId).then((result) => {
      if (!active) return;
      if (!result.success) {
        setError(result.message);
        setLoading(false);
        return;
      }
      const rows = result.payload.data.references;
      setReferences(rows);
      setLoading(false);
      const firstId = rows[0]?.id;
      if (firstId) void loadReference(firstId);
    });
    return () => {
      active = false;
    };
  }, [unitId]);

  async function loadReference(referenceId: number) {
    setError(null);
    const result = await fetchUnitCatalogReference(unitId, referenceId);
    if (!result.success) {
      setError(result.message);
      return;
    }
    setReference(result.payload.data.reference);
    setSelectedItem(null);
    setMarkerDraft(null);
  }

  const media = reference?.media ?? [];
  const selectedMedia = media[0] ?? null;

  const filteredItems = useMemo(() => {
    const query = filters.search.trim().toLowerCase();
    return (reference?.items ?? []).filter((item) => {
      const text = [item.positionCode, item.partNumber, item.partName, item.actualName]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (filters.status && item.surveyStatus !== filters.status) return false;
      if (query && !text.includes(query)) return false;
      return true;
    });
  }, [filters.search, filters.status, reference?.items]);

  const visibleReferences = useMemo(() => {
    return references.filter((row) => {
      if (filters.component && row.componentName !== filters.component) return false;
      if (filters.panel && row.panelName !== filters.panel) return false;
      return true;
    });
  }, [filters.component, filters.panel, references]);

  function openSurvey(item: CatalogItem, marker: MarkerDraft | null) {
    setSelectedItem(item);
    setMarkerDraft(marker);
    setForm(initialForm(item));
    setSurveyOpen(true);
  }

  function handleImageClick(event: React.MouseEvent<HTMLDivElement>) {
    if (!selectedItem || selectedItem.surveyStatus === "CONFIRMED" || !selectedMedia) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const marker = {
      catalogReferenceMediaId: selectedMedia.id,
      xPercent: ((event.clientX - rect.left) / rect.width) * 100,
      yPercent: ((event.clientY - rect.top) / rect.height) * 100,
    };
    if (!window.confirm(`Tandai posisi ini untuk item ${selectedItem.partName ?? selectedItem.positionCode ?? selectedItem.id}?`)) return;
    openSurvey(selectedItem, marker);
  }

  async function submitDraft() {
    if (!selectedItem) return;
    setSaving(true);
    setError(null);
    const result = await saveUnitCatalogSurvey(unitId, selectedItem.id, {
      qtyOpname: toNumberOrNull(form.qtyOpname),
      actualName: form.actualName || null,
      availabilityStatus: form.availabilityStatus,
      conditionStatus: form.conditionStatus,
      actionType: form.actionType,
      location: form.location || null,
      notes: form.notes || null,
      mapping: markerDraft,
    });
    setSaving(false);
    if (!result.success) {
      setError(result.message);
      return;
    }
    await loadReference(selectedItem.catalogReferenceId);
    setSurveyOpen(false);
  }

  async function submitConfirm() {
    if (!selectedItem) return;
    setSaving(true);
    setError(null);
    if (form.photoFile) {
      const ticketResult = await requestUnitCatalogUploadTicket({
        unitId,
        filename: form.photoFile.name,
        contentType: form.photoFile.type || "image/jpeg",
        size: form.photoFile.size,
      });
      if (!ticketResult.success) {
        setSaving(false);
        setError(ticketResult.message);
        return;
      }
      const uploadResponse = await fetch(ticketResult.result.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": form.photoFile.type || "image/jpeg" },
        body: form.photoFile,
      });
      if (!uploadResponse.ok) {
        setSaving(false);
        setError("Upload foto aktual gagal.");
        return;
      }
      const mediaResult = await addUnitCatalogItemMedia(unitId, selectedItem.id, {
        fileUrl: ticketResult.result.publicUrl,
        caption: "Foto aktual pendataan",
      });
      if (!mediaResult.success) {
        setSaving(false);
        setError(mediaResult.message);
        return;
      }
    }
    const result = await confirmUnitCatalogSurvey(unitId, selectedItem.id, {
      qtyOpname: toNumberOrNull(form.qtyOpname),
      actualName: form.actualName || null,
      availabilityStatus: form.availabilityStatus,
      conditionStatus: form.conditionStatus,
      actionType: form.actionType,
      location: form.location || null,
      notes: form.notes || null,
      mapping: markerDraft,
    });
    setSaving(false);
    if (!result.success) {
      setError(result.message);
      return;
    }
    await loadReference(selectedItem.catalogReferenceId);
    setSurveyOpen(false);
  }

  async function submitJobdesc() {
    if (!selectedItem?.promotedPanelId) return;
    setSaving(true);
    setError(null);
    const result = await createUnitCatalogPanelJobdescs(unitId, selectedItem.promotedPanelId, {
      jobs: [{
        divisionId: Number(jobdesc.divisionId),
        jobTypeId: jobdesc.jobTypeId,
        description: jobdesc.description,
        targetHoursInitial: Number(jobdesc.targetHoursInitial),
        picPlan: null,
        requiredGrade: null,
        standardHours: null,
        startDate: null,
        deadlineDate: null,
        notes: null,
        taskCategory: "MAIN",
      }],
    });
    setSaving(false);
    if (!result.success) {
      setError(result.message);
      return;
    }
    setJobdescOpen(false);
    setJobdescPanel(null);
    setJobdesc({ divisionId: "", jobTypeId: "", description: "", targetHoursInitial: "" });
  }

  async function openJobdescModal() {
    if (!selectedItem?.promotedPanelId) return;
    setJobdescOpen(true);
    setJobdescPanel(null);
    setJobdescPanelLoading(true);
    setError(null);
    const result = await fetchUnitCatalogMasterPanel(unitId, selectedItem.promotedPanelId);
    setJobdescPanelLoading(false);
    if (!result.success) {
      setError(result.message);
      return;
    }
    setJobdescPanel(result.payload.data.panel as MasterPanelDetail);
  }

  async function submitCatalogImport() {
    let items: ReturnType<typeof parseCatalogSpreadsheetText>;
    try {
      items = parseCatalogSpreadsheetText(importForm.spreadsheetText);
    } catch {
      setError("Format spreadsheet catalog tidak valid.");
      return;
    }
    if (!importForm.componentName.trim() || !importForm.panelName.trim() || items.length === 0) {
      setError("Component, Panel, dan minimal satu row catalog wajib diisi.");
      return;
    }

    setSaving(true);
    setError(null);
    const referenceResult = await createUnitCatalogReference(unitId, {
      componentName: importForm.componentName.trim(),
      panelName: importForm.panelName.trim(),
      diagramImageUrl: importForm.diagramImageUrl.trim() || null,
      referenceUrl: importForm.referenceUrl.trim() || null,
      notes: importForm.notes.trim() || null,
    });
    if (!referenceResult.success) {
      setSaving(false);
      setError(referenceResult.message);
      return;
    }

    const referenceId = referenceResult.payload.data.reference.id;
    const itemsResult = await replaceUnitCatalogItems(unitId, referenceId, { items });
    setSaving(false);
    if (!itemsResult.success) {
      setError(itemsResult.message);
      return;
    }

    setImportForm(defaultImportForm);
    setImportOpen(false);
    await loadReference(referenceId);
    const listResult = await fetchUnitCatalog(unitId);
    if (listResult.success) {
      setReferences(listResult.payload.data.references);
    }
  }

  const components = unique(references.map((row) => row.componentName));
  const panels = unique(references.map((row) => row.panelName));
  const confirmedMarker = selectedItem?.mappings.find((mapping) => mapping.catalogReferenceMediaId === selectedMedia?.id);
  const displayMarker = markerDraft ?? confirmedMarker ?? null;
  const panelMedia = Array.isArray(jobdescPanel?.media) ? jobdescPanel.media : [];
  const actualPanelMedia = panelMedia.filter((media) => panelMediaType(media) === "ACTUAL");
  const referencePanelMedia = panelMedia.filter((media) => panelMediaType(media) === "REFERENCE");

  if (loading) return <div className="border border-border bg-card px-4 py-5 text-sm text-muted-foreground">Memuat catalog...</div>;

  return (
    <section className="space-y-4">
      <div className="grid gap-3 border border-border bg-card p-4 lg:grid-cols-5">
        <select className="border border-border bg-background px-3 py-2 text-sm" value={filters.component} onChange={(event) => setFilters({ ...filters, component: event.target.value })}>
          <option value="">Semua Component</option>
          {components.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
        <select className="border border-border bg-background px-3 py-2 text-sm" value={filters.panel} onChange={(event) => setFilters({ ...filters, panel: event.target.value })}>
          <option value="">Semua Panel</option>
          {panels.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
        <input className="border border-border bg-background px-3 py-2 text-sm" placeholder="Part/Search" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} />
        <select className="border border-border bg-background px-3 py-2 text-sm" value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
          <option value="">Semua Status Pendataan</option>
          <option value="NOT_STARTED">Belum didata</option>
          <option value="DRAFT">Draft</option>
          <option value="CONFIRMED">Confirmed</option>
        </select>
        <p className="text-sm text-muted-foreground">{unitName}</p>
      </div>

      <div className="border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Input Catalog</p>
            <p className="text-xs text-muted-foreground">Paste dari Excel/Google Sheets. Catalog tetap staging, bukan data operasional.</p>
          </div>
          <button type="button" className="border border-border px-3 py-2 text-sm" onClick={() => setImportOpen((value) => !value)}>
            {importOpen ? "Tutup" : "Input Catalog"}
          </button>
        </div>
        {importOpen ? (
          <div className="mt-4 grid gap-3">
            <div className="grid gap-3 md:grid-cols-2">
              <input className="border border-border bg-background px-3 py-2 text-sm" placeholder="Component" value={importForm.componentName} onChange={(event) => setImportForm({ ...importForm, componentName: event.target.value })} />
              <input className="border border-border bg-background px-3 py-2 text-sm" placeholder="Panel" value={importForm.panelName} onChange={(event) => setImportForm({ ...importForm, panelName: event.target.value })} />
              <input className="border border-border bg-background px-3 py-2 text-sm" placeholder="URL gambar catalog (opsional)" value={importForm.diagramImageUrl} onChange={(event) => setImportForm({ ...importForm, diagramImageUrl: event.target.value })} />
              <input className="border border-border bg-background px-3 py-2 text-sm" placeholder="Reference URL (opsional)" value={importForm.referenceUrl} onChange={(event) => setImportForm({ ...importForm, referenceUrl: event.target.value })} />
            </div>
            <textarea className="min-h-20 border border-border bg-background px-3 py-2 text-sm" placeholder="Notes reference" value={importForm.notes} onChange={(event) => setImportForm({ ...importForm, notes: event.target.value })} />
            <textarea className="min-h-40 font-mono text-xs border border-border bg-background px-3 py-2" placeholder={"CODE\tPARTS NUMBER\tNAME\tQTY NORMAL\tQTY OPNAME\tSTATUS\tKONDISI\tTINDAKAN\tLOKASI\tKETERANGAN"} value={importForm.spreadsheetText} onChange={(event) => setImportForm({ ...importForm, spreadsheetText: event.target.value })} />
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">Row terbaca: {countCatalogSpreadsheetRows(importForm.spreadsheetText)}</p>
              <button type="button" disabled={saving} onClick={submitCatalogImport} className="border border-primary bg-primary px-3 py-2 text-sm text-primary-foreground">Simpan Catalog</button>
            </div>
          </div>
        ) : null}
      </div>

      {error ? <div className="border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div> : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(360px,0.95fr)_minmax(420px,1.05fr)]">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {visibleReferences.map((row) => (
              <button key={row.id} type="button" onClick={() => loadReference(row.id)} className={`border px-3 py-2 text-left text-xs ${reference?.id === row.id ? "border-primary text-app-accent-ink" : "border-border text-muted-foreground"}`}>
                <span className="block font-mono uppercase">{row.componentName}</span>
                <span>{row.panelName}</span>
              </button>
            ))}
          </div>

          <div className="overflow-hidden border border-border bg-card">
            <div className="grid grid-cols-[72px_1fr_92px] border-b border-border px-3 py-2 text-xs uppercase tracking-[0.12em] text-muted-foreground">
              <span>Code</span>
              <span>Part</span>
              <span>Status</span>
            </div>
            {filteredItems.map((item) => (
              <button key={item.id} type="button" onClick={() => setSelectedItem(item)} className={`grid w-full grid-cols-[72px_1fr_92px] gap-2 border-b border-border px-3 py-2 text-left text-sm hover:bg-muted/40 ${selectedItem?.id === item.id ? "bg-muted/60" : ""}`}>
                <span className="font-mono">{item.positionCode ?? "-"}</span>
                <span>
                  <span className="block text-foreground">{item.partName ?? item.actualName ?? "Part tanpa nama"}</span>
                  <span className="text-xs text-muted-foreground">{item.partNumber ?? "PN kosong"} · Qty {item.qtyNormal ?? "-"}</span>
                </span>
                <span className="text-xs text-muted-foreground">{statusLabels[item.surveyStatus]}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="border border-border bg-card p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-sm font-medium">{reference ? `${reference.componentName} · ${reference.panelName}` : "Gambar catalog"}</p>
              {selectedItem && selectedItem.surveyStatus !== "CONFIRMED" ? (
                <button type="button" className="border border-border px-3 py-1.5 text-xs" onClick={() => openSurvey(selectedItem, null)}>Data Item</button>
              ) : null}
            </div>
            {selectedMedia ? (
              <div className="relative cursor-crosshair overflow-hidden border border-border" onClick={handleImageClick}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={selectedMedia.fileUrl} alt={selectedMedia.caption ?? "Catalog"} className="h-auto w-full select-none" />
                {displayMarker ? (
                  <span className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-primary shadow" style={{ left: `${displayMarker.xPercent}%`, top: `${displayMarker.yPercent}%` }} />
                ) : null}
              </div>
            ) : (
              <div className="border border-dashed border-border px-4 py-12 text-center text-sm text-muted-foreground">Reference belum punya gambar. Pilih item lalu klik Data Item.</div>
            )}
          </div>

          {selectedItem?.surveyStatus === "CONFIRMED" ? (
            <div className="flex flex-wrap gap-2 border border-border bg-card p-3">
              <button type="button" className="border border-border px-3 py-2 text-sm" onClick={() => openSurvey(selectedItem, null)}>+ Tambah Foto Fisik</button>
              <button type="button" className="border border-border px-3 py-2 text-sm" disabled={!selectedItem.promotedPanelId} onClick={() => { void openJobdescModal(); }}>Buat Countdown</button>
              <Link className="border border-border px-3 py-2 text-sm" href={`/wo?carId=${encodeURIComponent(unitId)}&panelId=${selectedItem.promotedPanelId ?? ""}`}>Buat WO</Link>
              <Link className="border border-border px-3 py-2 text-sm" href={`/requests/list?carId=${encodeURIComponent(unitId)}&panelId=${selectedItem.promotedPanelId ?? ""}`}>Ajukan PR</Link>
            </div>
          ) : null}
        </div>
      </div>

      {surveyOpen && selectedItem ? (
        <div className="fixed inset-0 z-50 bg-background/80 p-4">
          <div className="ml-auto h-full max-w-xl overflow-auto border border-border bg-card p-4 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Pendataan</p>
                <h2 className="text-lg font-semibold">{selectedItem.partName ?? selectedItem.positionCode ?? "Item"}</h2>
              </div>
              <button type="button" onClick={() => setSurveyOpen(false)} className="text-sm text-muted-foreground">Tutup</button>
            </div>
            <div className="mt-4 grid gap-3">
              <input className="border border-border bg-background px-3 py-2 text-sm" placeholder="Qty Opname" value={form.qtyOpname} onChange={(event) => setForm({ ...form, qtyOpname: event.target.value })} />
              <input className="border border-border bg-background px-3 py-2 text-sm" placeholder="Nama Aktual jika perlu" value={form.actualName} onChange={(event) => setForm({ ...form, actualName: event.target.value })} />
              <select className="border border-border bg-background px-3 py-2 text-sm" value={form.availabilityStatus} onChange={(event) => setForm({ ...form, availabilityStatus: event.target.value as SurveyForm["availabilityStatus"] })}>
                <option value="UNKNOWN">UNKNOWN</option>
                <option value="AVAILABLE">AVAILABLE</option>
                <option value="NOT_AVAILABLE">NOT_AVAILABLE</option>
              </select>
              <select className="border border-border bg-background px-3 py-2 text-sm" value={form.conditionStatus} onChange={(event) => setForm({ ...form, conditionStatus: event.target.value as SurveyForm["conditionStatus"] })}>
                <option value="UNKNOWN">UNKNOWN</option>
                <option value="GOOD">GOOD</option>
                <option value="RESTORE">RESTORE</option>
                <option value="NOT_USABLE">NOT_USABLE</option>
              </select>
              <select className="border border-border bg-background px-3 py-2 text-sm" value={form.actionType} onChange={(event) => setForm({ ...form, actionType: event.target.value as SurveyForm["actionType"] })}>
                <option value="UNDECIDED">UNDECIDED</option>
                <option value="NO_ACTION">NO_ACTION</option>
                <option value="JOBDESC">JOBDESC</option>
                <option value="JOBDESC_ORDER">JOBDESC_ORDER</option>
              </select>
              <input className="border border-border bg-background px-3 py-2 text-sm" placeholder="Lokasi" value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} />
              <textarea className="min-h-24 border border-border bg-background px-3 py-2 text-sm" placeholder="Keterangan" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
              <input className="border border-border bg-background px-3 py-2 text-sm" type="file" accept="image/*" capture="environment" onChange={(event) => setForm({ ...form, photoFile: event.target.files?.[0] ?? null })} />
              {form.photoFile ? <p className="text-xs text-muted-foreground">Foto aktual: {form.photoFile.name}</p> : null}
              {markerDraft ? <p className="text-xs text-muted-foreground">Marker: {markerDraft.xPercent.toFixed(2)}%, {markerDraft.yPercent.toFixed(2)}%</p> : null}
              <div className="flex justify-end gap-2">
                <button type="button" disabled={saving} onClick={submitDraft} className="border border-border px-3 py-2 text-sm">Simpan Draft</button>
                <button type="button" disabled={saving} onClick={submitConfirm} className="border border-primary bg-primary px-3 py-2 text-sm text-primary-foreground">Simpan Pendataan</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {jobdescOpen && selectedItem?.promotedPanelId ? (
        <div className="fixed inset-0 z-50 bg-background/80 p-4">
          <div className="ml-auto h-full max-w-xl overflow-auto border border-border bg-card p-4 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Buat Countdown</p>
                <h2 className="text-lg font-semibold">{panelText(jobdescPanel, "name")}</h2>
              </div>
              <button type="button" onClick={() => { setJobdescOpen(false); setJobdescPanel(null); }} className="text-sm text-muted-foreground">Tutup</button>
            </div>
            <div className="mt-4 grid gap-3">
              {jobdescPanelLoading ? (
                <div className="border border-border bg-background px-3 py-2 text-sm text-muted-foreground">Memuat detail Master Panel...</div>
              ) : (
                <div className="grid gap-3 border border-border bg-background p-3 text-sm">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <p><span className="text-muted-foreground">Component:</span> {panelText(jobdescPanel, "componentName")}</p>
                    <p><span className="text-muted-foreground">Panel Name:</span> {panelText(jobdescPanel, "name")}</p>
                    <p><span className="text-muted-foreground">Part Number:</span> {panelText(jobdescPanel, "partNumber")}</p>
                    <p><span className="text-muted-foreground">Position Code:</span> {panelText(jobdescPanel, "positionCode")}</p>
                    <p><span className="text-muted-foreground">Initial Condition:</span> {panelText(jobdescPanel, "initialCondition")}</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="mb-2 text-xs uppercase tracking-[0.12em] text-muted-foreground">Foto Aktual</p>
                      <div className="grid grid-cols-2 gap-2">
                        {actualPanelMedia.length ? actualPanelMedia.map((media, index) => {
                          const url = panelMediaUrl(media);
                          return url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img key={`${url}-${index}`} src={url} alt={typeof media.caption === "string" ? media.caption : "Foto aktual"} className="h-24 w-full object-cover" />
                          ) : null;
                        }) : <p className="text-xs text-muted-foreground">Belum ada foto aktual.</p>}
                      </div>
                    </div>
                    <div>
                      <p className="mb-2 text-xs uppercase tracking-[0.12em] text-muted-foreground">Foto Catalog</p>
                      <div className="grid grid-cols-2 gap-2">
                        {referencePanelMedia.length ? referencePanelMedia.map((media, index) => {
                          const url = panelMediaUrl(media);
                          return url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img key={`${url}-${index}`} src={url} alt={typeof media.caption === "string" ? media.caption : "Foto catalog"} className="h-24 w-full object-cover" />
                          ) : null;
                        }) : <p className="text-xs text-muted-foreground">Belum ada foto catalog.</p>}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <input className="border border-border bg-background px-3 py-2 text-sm" placeholder="Division ID" value={jobdesc.divisionId} onChange={(event) => setJobdesc({ ...jobdesc, divisionId: event.target.value })} />
              <input className="border border-border bg-background px-3 py-2 text-sm" placeholder="Job Type ID" value={jobdesc.jobTypeId} onChange={(event) => setJobdesc({ ...jobdesc, jobTypeId: event.target.value })} />
              <textarea className="min-h-24 border border-border bg-background px-3 py-2 text-sm" placeholder="Deskripsi pekerjaan" value={jobdesc.description} onChange={(event) => setJobdesc({ ...jobdesc, description: event.target.value })} />
              <input className="border border-border bg-background px-3 py-2 text-sm" placeholder="Target Jam" value={jobdesc.targetHoursInitial} onChange={(event) => setJobdesc({ ...jobdesc, targetHoursInitial: event.target.value })} />
              <button type="button" disabled={saving} onClick={submitJobdesc} className="border border-primary bg-primary px-3 py-2 text-sm text-primary-foreground">Simpan Countdown</button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
