"use client";

import type {
  CreateUnitPanelRequest,
  UnitPanelRecord,
  UpdateUnitPanelRequest,
} from "@smsystem/contracts/unit-panel";
import { ArrowUpRight, Boxes, ChevronDown, ChevronRight, Plus, RefreshCw, Search } from "lucide-react";
import Link from "next/link";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  createUnitPanel,
  deleteUnitPanel,
  fetchUnitPanels,
  updateUnitPanel,
} from "@/shared/api/units";

const PAGE_SIZE = 20;
const ICON_STROKE_WIDTH = 2.5;

type FormMode =
  | { type: "create"; sectionMode: "existing" | "new" }
  | { type: "edit"; record: UnitPanelRecord }
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

interface MasterPanelManagerProps {
  unitId: string;
  canManage: boolean;
  initialRows?: UnitPanelRecord[];
}

interface SearchOption {
  value: string;
  label?: string;
}

interface SearchableFieldProps {
  value: string;
  options: SearchOption[];
  onChange: (value: string) => void;
  onSelect?: (option: SearchOption) => void;
  placeholder?: string;
  disabled?: boolean;
}

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
  const filteredOptions = options.filter(option => {
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
      <div className="flex h-8 items-center border border-white/10 bg-card transition-colors focus-within:border-primary/40">
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
          className="h-full min-w-0 flex-1 bg-transparent px-3 text-[11px] font-mono text-foreground/70 outline-none placeholder:text-foreground/20 disabled:cursor-not-allowed disabled:opacity-40"
        />
        <button
          type="button"
          disabled={disabled}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setIsOpen(open => !open)}
          className="flex h-full w-8 shrink-0 items-center justify-center text-foreground/45 transition-colors hover:text-foreground/80 disabled:cursor-not-allowed disabled:opacity-35"
        >
          <ChevronDown className="h-3 w-3" strokeWidth={ICON_STROKE_WIDTH} />
        </button>
      </div>

      {isOpen && !disabled && (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-30 max-h-44 overflow-auto border border-white/10 bg-card py-1 shadow-xl shadow-black/40">
          {filteredOptions.length > 0 ? (
            filteredOptions.map(option => (
              <button
                key={`${option.value}:${option.label ?? ""}`}
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  chooseOption(option);
                }}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-[11px] font-mono text-foreground/65 transition-colors hover:bg-primary/[0.07] hover:text-app-accent-ink"
              >
                <span className="min-w-0 truncate">{option.value}</span>
                {option.label && <span className="shrink-0 text-[9px] uppercase tracking-[0.12em] text-foreground/25">{option.label}</span>}
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-[10px] font-mono text-foreground/25">
              Tidak ada data cocok. Tekan Simpan untuk memakai teks ini.
            </div>
          )}
        </div>
      )}
    </div>
  );
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
    parentId: form.nodeType === "PART" ? (Number.parseInt(form.parentId, 10) || null) : null,
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

function buildPanelDetailHref(unitId: string, recordId: number): string {
  return `/units/${unitId}/panels/panel-${recordId}`;
}

export function MasterPanelManager({ unitId, canManage, initialRows }: MasterPanelManagerProps) {
  const [rows, setRows] = useState<UnitPanelRecord[]>(() => initialRows ?? []);
  const [isLoading, setIsLoading] = useState(() => initialRows === undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [mode, setMode] = useState<FormMode>(null);
  const [form, setForm] = useState<PanelFormState>(emptyForm());

  const [activeCategory, setActiveCategory] = useState<string>("ALL");
  const [activeSection, setActiveSection] = useState<string>("ALL");
  const [search, setSearch] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedPanelIds, setExpandedPanelIds] = useState<Set<string>>(new Set());

  const categories = useMemo(() => {
    const cats = new Set<string>();
    for (const row of rows) {
      if (row.category) cats.add(row.category);
    }
    return ["ALL", ...Array.from(cats).sort()];
  }, [rows]);

  const sections = useMemo(() => {
    const secs = new Set<string>();
    for (const row of rows) {
      if (activeCategory === "ALL" || row.category === activeCategory) {
        secs.add(row.section);
      }
    }
    return ["ALL", ...Array.from(secs).sort()];
  }, [rows, activeCategory]);

  const rowsInSelectedCategory = useMemo(() => {
    return rows.filter(row => (row.category ?? "") === form.category);
  }, [rows, form.category]);

  const formSections = useMemo(() => {
    return Array.from(new Set(rowsInSelectedCategory.map(row => row.section))).sort();
  }, [rowsInSelectedCategory]);

  const panelsBySelectedSection = useMemo(() => {
    return rows.filter(row =>
      (row.category ?? "") === form.category &&
      row.section === form.section
    );
  }, [rows, form.category, form.section]);

  const selectedParentPanel = useMemo(() => {
    if (!form.parentId) return null;
    return rows.find(row => String(row.id) === form.parentId) ?? null;
  }, [rows, form.parentId]);

  const parentPanelValue = selectedParentPanel?.name ?? form.parentName;
  const sectionOptions = useMemo<SearchOption[]>(
    () => formSections.map(section => ({ value: section })),
    [formSections],
  );
  const parentPanelOptions = useMemo<SearchOption[]>(
    () => panelsBySelectedSection.map(panel => ({
      value: panel.name,
      label: panel.category ?? panel.section,
    })),
    [panelsBySelectedSection],
  );
  const categoryOptions = useMemo<SearchOption[]>(
    () => categories
      .filter(category => category !== "ALL")
      .map(category => ({ value: category })),
    [categories],
  );

  const filteredRows = useMemo(() => {
    return rows.filter(row => {
      const matchCat = activeCategory === "ALL" || row.category === activeCategory;
      const matchSec = activeSection === "ALL" || row.section === activeSection;
      const matchSearch = !search.trim() ||
        row.name.toLowerCase().includes(search.toLowerCase()) ||
        row.section.toLowerCase().includes(search.toLowerCase()) ||
        (row.category ?? "").toLowerCase().includes(search.toLowerCase()) ||
        row.children.some(child =>
          child.name.toLowerCase().includes(search.toLowerCase())
        );
      return matchCat && matchSec && matchSearch;
    });
  }, [rows, activeCategory, activeSection, search]);

  const totalPages = Math.ceil(filteredRows.length / PAGE_SIZE);
  const paginatedRows = filteredRows.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  function handleCategoryChange(cat: string) {
    setActiveCategory(cat);
    setActiveSection("ALL");
    setCurrentPage(1);
  }

  function togglePanel(id: string) {
    setExpandedPanelIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const rootCount = rows.length;
  const partCount = useMemo(
    () => rows.reduce((total, row) => total + row.children.length, 0),
    [rows],
  );

  const loadPanels = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const result = await fetchUnitPanels("", unitId);
    if (!result.payload) {
      setRows([]);
      setError("Master panel unit belum bisa dimuat.");
      setIsLoading(false);
      return;
    }

    setRows(result.payload.data.tree);
    setIsLoading(false);
  }, [unitId]);

  useEffect(() => {
    if (initialRows !== undefined) {
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial client fetch when server data is unavailable.
    void loadPanels();
  }, [initialRows, loadPanels]);

  function openCreateRoot() {
    setMode({ type: "create", sectionMode: rows.length > 0 ? "existing" : "new" });
    setForm(emptyForm());
    setMessage(null);
    setError(null);
  }

  function openCreateSection() {
    setMode({ type: "create", sectionMode: "new" });
    setForm(emptyForm());
    setMessage(null);
    setError(null);
  }

  function openCreateChild(parent: UnitPanelRecord) {
    setMode({ type: "create", sectionMode: "existing" });
    setForm(formForChild(parent));
    setMessage(null);
    setError(null);
  }

  function openEdit(record: UnitPanelRecord) {
    setMode({ type: "edit", record });
    setForm(formFromRecord(record));
    setMessage(null);
    setError(null);
  }

  function closeForm() {
    setMode(null);
    setForm(emptyForm());
  }

  function getNextSortOrder(parentId: number | null, section: string) {
    if (parentId !== null) {
      const parent = rows.find(row => row.id === parentId);
      if (!parent) return 0;
      return parent.children.reduce((max, child) => Math.max(max, child.sortOrder), -1) + 1;
    }

    return rows
      .filter(row => row.section === section)
      .reduce((max, row) => Math.max(max, row.sortOrder), -1) + 1;
  }

  function selectNodeType(value: string) {
    const normalized = value.trim().toLowerCase();
    if (normalized !== "panel" && normalized !== "part") {
      setForm(c => ({ ...c, nodeTypeName: value }));
      return;
    }

    const nextType = normalized === "part" ? "PART" : "PANEL";
    if (nextType === "PANEL") {
      setForm(c => ({ ...c, nodeType: "PANEL", nodeTypeName: value, parentId: "", parentName: "" }));
      return;
    }

    setForm(c => ({
      ...c,
      nodeType: "PART",
      nodeTypeName: value,
      parentId: "",
      parentName: "",
    }));
  }

  function selectCategory(value: string) {
    setForm(c => ({
      ...c,
      category: value,
      section: "",
      parentId: "",
      parentName: "",
    }));
  }

  function selectSection(value: string) {
    setForm(c => ({
      ...c,
      section: value,
      parentId: "",
      parentName: "",
    }));
  }

  function selectParentPanel(value: string) {
    const normalized = value.trim().toLowerCase();
    const panel = panelsBySelectedSection.find(row => row.name.toLowerCase() === normalized);
    setForm(c => ({
      ...c,
      parentId: panel ? String(panel.id) : "",
      parentName: value,
      section: panel?.section ?? c.section,
      category: panel?.category ?? c.category,
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage || !mode) {
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setMessage(null);

    const parsedParentId = Number.parseInt(form.parentId, 10);
    const parentId =
      form.nodeType === "PART" && Number.isFinite(parsedParentId) ? parsedParentId : null;

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
        ? await updateUnitPanel(unitId, mode.record.id, { ...payload, parentId })
        : await createUnitPanel(unitId, {
            ...payload,
            parentId,
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
    await loadPanels();
    setIsSubmitting(false);
  }

  async function handleDelete(record: UnitPanelRecord) {
    if (!canManage) {
      return;
    }

    const confirmed = window.confirm(
      `Hapus ${record.nodeType === "PANEL" ? "panel" : "part"} "${record.name}"?`,
    );
    if (!confirmed) {
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setMessage(null);

    const result = await deleteUnitPanel(unitId, record.id);
    if (!result.success) {
      setError(result.message);
      setIsSubmitting(false);
      return;
    }

    setMessage(`${record.nodeType === "PANEL" ? "Panel" : "Part"} berhasil dihapus.`);
    await loadPanels();
    setIsSubmitting(false);
  }

  return (
    <section className="border border-white/5 bg-card">

      {/* ── HEADER ── */}
      <div className="flex items-center justify-between border-b border-white/5 px-4 py-2">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-[0.12em] text-foreground/30">Master Panel</p>
          <h3 className="text-[13px] font-mono text-foreground/80">Panel dan Breakdown Part</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-foreground/30">{rootCount} panel · {partCount} part</span>
          <div className="w-px h-4 bg-white/10" />
          <button type="button" onClick={() => void loadPanels()}
            className="inline-flex items-center gap-1.5 border border-white/10 px-2 py-1 text-[10px] font-mono uppercase text-foreground/55 hover:text-foreground hover:border-white/30 transition-colors">
            <RefreshCw className="h-3 w-3" strokeWidth={ICON_STROKE_WIDTH} /> Refresh
          </button>
          {canManage && (
            <>
              <button type="button" onClick={openCreateRoot}
                className="inline-flex items-center gap-1.5 border border-primary/30 bg-primary/[0.04] px-2 py-1 text-[10px] font-mono uppercase text-app-accent-ink hover:bg-primary/10 transition-colors">
                <Plus className="h-3 w-3" strokeWidth={ICON_STROKE_WIDTH} /> Tambah Panel
              </button>
              <button type="button" onClick={openCreateSection}
                className="inline-flex items-center gap-1.5 border border-white/10 px-2 py-1 text-[10px] font-mono uppercase text-foreground/60 hover:border-white/30 hover:text-foreground transition-colors">
                <Plus className="h-3 w-3" strokeWidth={ICON_STROKE_WIDTH} /> Tambah Panel + Section
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── SEARCH + CATEGORY TABS ── */}
      <div className="border-b border-white/5 bg-background">
        {/* Search bar + Section dropdown */}
        <div className="flex items-center gap-2 border-b border-white/5 px-4 py-2">
          {/* Search input — flex-1 */}
          <div className="flex flex-1 items-center gap-2 border border-white/10 bg-card px-3">
            <Search className="h-3.5 w-3.5 shrink-0 text-foreground/50" strokeWidth={ICON_STROKE_WIDTH} />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Cari panel, part, section..."
              className="h-8 w-full bg-transparent text-[11px] font-mono text-foreground/70 outline-none placeholder:text-foreground/20"
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setCurrentPage(1);
                }}
                className="text-[10px] font-mono text-foreground/30 transition-colors hover:text-foreground">
                ✕
              </button>
            )}
          </div>

          {/* Section dropdown — compact, fixed width */}
          <div className="relative shrink-0">
            <select
              value={activeSection}
              onChange={(e) => {
                setActiveSection(e.target.value);
                setCurrentPage(1);
              }}
              className="h-8 min-w-[160px] max-w-[220px] cursor-pointer appearance-none border border-white/10 bg-card pl-3 pr-7 text-[10px] font-mono uppercase tracking-[0.08em] text-foreground/60 outline-none focus:border-primary/40 [color-scheme:dark]"
            >
              {sections.map(sec => (
                <option key={sec} value={sec}>{sec}</option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-foreground/20">▾</span>
          </div>
        </div>

        {/* Category tabs */}
        <div className="flex overflow-x-auto border-b border-white/5 px-4 gap-0 scrollbar-none">
          <p className="shrink-0 self-center border-r border-white/5 mr-3 pr-3 text-[9px] font-mono uppercase tracking-[0.12em] text-foreground/20">
            Kategori
          </p>
          {categories.map(cat => (
            <button key={cat} type="button" onClick={() => handleCategoryChange(cat)}
              className={`whitespace-nowrap px-3 py-2 text-[10px] font-mono uppercase tracking-[0.12em] border-b-2 transition-colors ${
                activeCategory === cat
                  ? "border-primary text-app-accent-ink"
                  : "border-transparent text-foreground/35 hover:text-foreground/60"
              }`}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* ── MAIN GRID: TABLE + FORM ── */}
      <div className={mode !== null
        ? "grid min-h-[300px] divide-x divide-white/5 xl:grid-cols-[minmax(0,1fr)_300px]"
        : "min-h-[300px]"
      }>

        {/* LEFT — Tabel */}
        <div className="overflow-auto">
          {message && (
            <div className="border-b border-success/20 bg-success/[0.04] px-4 py-2 text-[11px] font-mono text-success">
              {message}
            </div>
          )}
          {error && (
            <div className="border-b border-destructive/20 bg-destructive/[0.04] px-4 py-2 text-[11px] font-mono text-destructive">
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="px-4 py-6 text-[11px] font-mono text-foreground/30">Memuat master panel...</div>
          ) : filteredRows.length === 0 ? (
            <div className="m-4 border border-dashed border-white/10 px-4 py-8 text-center text-[11px] font-mono text-foreground/25">
              {search ? `Tidak ada hasil untuk "${search}"` : "Belum ada panel pada filter ini."}
            </div>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="sticky top-0 border-b border-white/5 bg-background">
                  <th className="px-4 py-2 text-[10px] font-mono uppercase tracking-[0.12em] text-foreground/25">Kategori</th>
                  <th className="px-4 py-2 text-[10px] font-mono uppercase tracking-[0.12em] text-foreground/25">Section</th>
                  <th className="px-4 py-2 text-[10px] font-mono uppercase tracking-[0.12em] text-foreground/25">Panel / Part</th>
                  <th className="px-4 py-2 text-right text-[10px] font-mono uppercase tracking-[0.12em] text-foreground/25">Qty</th>
                  <th className="px-4 py-2 text-[10px] font-mono uppercase tracking-[0.12em] text-foreground/25">Lokasi</th>
                  <th className="px-4 py-2 text-[10px] font-mono uppercase tracking-[0.12em] text-foreground/25">Posisi</th>
                  <th className="px-4 py-2 text-[10px] font-mono uppercase tracking-[0.12em] text-foreground/25">Kondisi Barang</th>
                  <th className="px-4 py-2 text-[10px] font-mono uppercase tracking-[0.12em] text-foreground/25 text-center">Part</th>
                  <th className="px-4 py-2 text-[10px] font-mono uppercase tracking-[0.12em] text-foreground/25">Aktif</th>
                  {canManage && (
                    <th className="px-4 py-2 text-right text-[10px] font-mono uppercase tracking-[0.12em] text-foreground/25">Aksi</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {paginatedRows.map((row) => (
                  <React.Fragment key={row.id}>
                    {/* Panel row */}
                    <tr className="group border-b border-white/[0.04] transition-colors hover:bg-white/[0.015]">
                      <td className="align-middle px-4 py-1.5 text-[10px] font-mono text-foreground/25">
                        {row.category ?? "-"}
                      </td>
                      <td className="align-middle px-4 py-1.5 text-[10px] font-mono uppercase text-foreground/35">
                        {row.section}
                      </td>
                      <td className="px-4 py-1.5 align-middle">
                        <div className="flex items-center gap-2">
                          {/* Toggle expand */}
                          {row.children.length > 0 ? (
                            <button
                              type="button"
                              onClick={() => togglePanel(String(row.id))}
                              className="shrink-0 text-foreground/45 hover:text-foreground/80 transition-colors"
                            >
                              {expandedPanelIds.has(String(row.id))
                                ? <ChevronDown className="h-3 w-3" strokeWidth={ICON_STROKE_WIDTH} />
                                : <ChevronRight className="h-3 w-3" strokeWidth={ICON_STROKE_WIDTH} />
                              }
                            </button>
                          ) : (
                            <span className="w-3 shrink-0" />
                          )}

                          {/* Panel name + inline badges */}
                          <div className="flex items-center gap-2 flex-wrap min-w-0">
                            <p className="text-[11px] font-mono text-foreground/80 truncate">{row.name}</p>
                            <Link
                              href={buildPanelDetailHref(unitId, row.id)}
                              className="shrink-0 text-foreground/10 opacity-0 transition-[color,opacity] group-hover:opacity-100 group-focus-within:opacity-100 hover:text-app-accent-ink focus-visible:opacity-100"
                              title="Buka detail workflow"
                            >
                              <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={ICON_STROKE_WIDTH} />
                            </Link>
                            {row.countdownUsageCount > 0 && (
                              <span className="shrink-0 border border-primary/20 px-1.5 py-0.5 text-[8px] font-mono text-app-accent-ink/60">
                                {row.countdownUsageCount}cd
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="align-middle px-4 py-1.5 text-right font-mono text-[10px] text-foreground/50">
                        {row.qty}
                      </td>
                      <td className="align-middle px-4 py-1.5 font-mono text-[10px] text-foreground/35">
                        {LOCATION_LABEL[row.defaultLocationType]}
                      </td>
                      <td className="align-middle px-4 py-1.5 font-mono text-[10px] text-foreground/35">
                        {STOCK_STATUS_LABEL[row.defaultStockStatus]}
                      </td>
                      <td className="align-middle px-4 py-1.5 font-mono text-[10px] text-foreground/35">
                        {CONDITION_LABEL[row.defaultConditionType]}
                      </td>
                      <td className="px-4 py-1.5 text-center align-middle">
                        <span className={`font-mono text-[11px] ${row.childCount > 0 ? "text-foreground/50" : "text-foreground/15"}`}>
                          {row.childCount}
                        </span>
                      </td>
                      <td className="align-middle px-4 py-1.5">
                        {row.isActive
                          ? <span className="border border-success/20 bg-success/[0.04] px-2 py-0.5 text-[9px] font-mono text-success">AKTIF</span>
                          : <span className="border border-white/10 px-2 py-0.5 text-[9px] font-mono text-foreground/25">NONAKTIF</span>
                        }
                      </td>
                      {canManage && (
                        <td className="align-middle px-4 py-1.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button type="button" onClick={() => openEdit(row)}
                              className="border border-white/10 px-2 py-0.5 text-[9px] font-mono text-foreground/35 transition-colors hover:border-white/30 hover:text-foreground">
                              Edit
                            </button>
                            <button type="button" onClick={() => openCreateChild(row)}
                              className="border border-white/10 px-2 py-0.5 text-[9px] font-mono text-foreground/35 transition-colors hover:border-white/30 hover:text-foreground">
                              + Part
                            </button>
                            <button type="button" onClick={() => void handleDelete(row)}
                              className="border border-destructive/20 px-2 py-0.5 text-[9px] font-mono text-destructive/50 transition-colors hover:border-destructive/40 hover:text-destructive">
                              Hapus
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>

                    {/* Child part rows */}
                    {expandedPanelIds.has(String(row.id)) && row.children.map((child) => (
                      <tr key={child.id} className="group border-b border-white/[0.025] bg-background/30 transition-colors hover:bg-white/[0.01]">
                        <td className="align-middle px-4 py-1 text-[9px] font-mono text-foreground/15">{row.category ?? ""}</td>
                        <td className="align-middle px-4 py-1 text-[9px] font-mono text-foreground/15">{row.section}</td>
                        <td className="px-4 py-1 align-middle">
                          <div className="flex items-center gap-2" style={{ paddingLeft: "20px" }}>
                            <span className="text-foreground/15 text-[9px] shrink-0">└</span>
                            <span className="text-[10px] font-mono text-foreground/50 truncate">{child.name}</span>
                            <Link
                              href={buildPanelDetailHref(unitId, child.id)}
                              className="shrink-0 text-foreground/10 opacity-0 transition-[color,opacity] group-hover:opacity-100 group-focus-within:opacity-100 hover:text-app-accent-ink focus-visible:opacity-100"
                              title="Buka detail workflow"
                            >
                              <ArrowUpRight className="h-3 w-3" strokeWidth={ICON_STROKE_WIDTH} />
                            </Link>
                            {child.countdownUsageCount > 0 && (
                              <span className="shrink-0 border border-primary/15 px-1 py-0.5 text-[8px] font-mono text-app-accent-ink/40">
                                {child.countdownUsageCount}cd
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="align-middle px-4 py-1 text-right font-mono text-[9px] text-foreground/35">{child.qty}</td>
                        <td className="align-middle px-4 py-1 font-mono text-[9px] text-foreground/25">{LOCATION_LABEL[child.defaultLocationType]}</td>
                        <td className="align-middle px-4 py-1 font-mono text-[9px] text-foreground/25">{STOCK_STATUS_LABEL[child.defaultStockStatus]}</td>
                        <td className="align-middle px-4 py-1 font-mono text-[9px] text-foreground/25">{CONDITION_LABEL[child.defaultConditionType]}</td>
                        <td className="align-middle px-4 py-1 text-center">
                          <span className="border border-white/5 px-1.5 py-0.5 text-[8px] font-mono text-foreground/20">PART</span>
                        </td>
                        <td className="align-middle px-4 py-1">
                          {child.isActive
                            ? <span className="border border-success/15 px-1.5 py-0.5 text-[8px] font-mono text-success/60">AKTIF</span>
                            : <span className="border border-white/10 px-1.5 py-0.5 text-[8px] font-mono text-foreground/20">NONAKTIF</span>
                          }
                        </td>
                        {canManage && (
                          <td className="align-middle px-4 py-1 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button type="button" onClick={() => openEdit(child)}
                                className="border border-white/10 px-1.5 py-0.5 text-[8px] font-mono text-foreground/30 transition-colors hover:text-foreground">
                                Edit
                              </button>
                              <button type="button" onClick={() => void handleDelete(child)}
                                className="border border-destructive/15 px-1.5 py-0.5 text-[8px] font-mono text-destructive/40 transition-colors hover:text-destructive">
                                Hapus
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-white/5 bg-background px-4 py-2">
              <span className="font-mono text-[10px] text-foreground/30">
                {filteredRows.length} panel · hal {currentPage} dari {totalPages}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="border border-white/10 px-2 py-1 text-[10px] font-mono text-foreground/40 transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-20"
                >
                  «
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="border border-white/10 px-2 py-1 text-[10px] font-mono text-foreground/40 transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-20"
                >
                  ‹
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(page => {
                    if (totalPages <= 5) return true;
                    if (page === 1 || page === totalPages) return true;
                    if (Math.abs(page - currentPage) <= 1) return true;
                    return false;
                  })
                  .reduce<(number | "...")[]>((acc, page, idx, arr) => {
                    if (idx > 0 && typeof arr[idx - 1] === "number" && page - arr[idx - 1] > 1) {
                      acc.push("...");
                    }
                    acc.push(page);
                    return acc;
                  }, [])
                  .map((item, idx) =>
                    item === "..." ? (
                      <span key={`ellipsis-${idx}`} className="px-2 text-[10px] font-mono text-foreground/20">...</span>
                    ) : (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setCurrentPage(item)}
                        className={`border px-2.5 py-1 text-[10px] font-mono transition-colors ${
                          currentPage === item
                            ? "border-primary/40 bg-primary/[0.06] text-app-accent-ink"
                            : "border-white/10 text-foreground/40 hover:text-foreground"
                        }`}
                      >
                        {item}
                      </button>
                    ),
                  )
                }

                <button
                  type="button"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="border border-white/10 px-2 py-1 text-[10px] font-mono text-foreground/40 transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-20"
                >
                  ›
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="border border-white/10 px-2 py-1 text-[10px] font-mono text-foreground/40 transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-20"
                >
                  »
                </button>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT — Form Sidebar (hanya tampil saat sedang tambah/edit) */}
        {mode !== null && (
        <div className="sticky top-0 self-start bg-background px-4 py-3">
          <div className="mb-3 flex items-center gap-2">
            <Boxes className="h-3.5 w-3.5 text-app-accent-ink" strokeWidth={ICON_STROKE_WIDTH} />
            <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-foreground/30">
              {mode.type === "edit" ? `Edit ${mode.record.nodeType === "PANEL" ? "Panel" : "Part"}`
                : mode.sectionMode === "new" ? "Tambah Panel + Section"
                : form.nodeType === "PART" ? "Tambah Part"
                : "Tambah Panel"}
            </span>
          </div>

            <form className="space-y-3" onSubmit={(event) => void handleSubmit(event)}>
              {mode.type === "create" && mode.sectionMode === "existing" && (
                <div className="space-y-1">
                  <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-foreground/30">Buat</span>
                  <div className="grid grid-cols-2 gap-1 border border-white/10 bg-card p-1">
                    <button
                      type="button"
                      onClick={() => selectNodeType("Panel")}
                      className={`px-2 py-1.5 text-[10px] font-mono uppercase tracking-[0.12em] transition-colors ${
                        form.nodeType === "PANEL"
                          ? "bg-primary/[0.08] text-app-accent-ink"
                          : "text-foreground/35 hover:text-foreground"
                      }`}
                    >
                      Panel
                    </button>
                    <button
                      type="button"
                      onClick={() => selectNodeType("Part")}
                      className={`px-2 py-1.5 text-[10px] font-mono uppercase tracking-[0.12em] transition-colors ${
                        form.nodeType === "PART"
                          ? "bg-primary/[0.08] text-app-accent-ink"
                          : "text-foreground/35 hover:text-foreground"
                      }`}
                    >
                      Part
                    </button>
                  </div>
                </div>
              )}

              {mode.type === "create" && mode.sectionMode === "existing" && (
                <label className="block space-y-1">
                  <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-foreground/30">Kategori</span>
                  <SearchableField
                    value={form.category}
                    options={categoryOptions}
                    onChange={selectCategory}
                    placeholder="Pilih kategori"
                  />
                </label>
              )}

              <label className="block space-y-1">
                <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-foreground/30">Section</span>
                {mode.type === "create" && mode.sectionMode === "new" ? (
                  <input
                    value={form.section}
                    onChange={(e) => setForm(c => ({ ...c, section: e.target.value }))}
                    placeholder="Nama section baru"
                    className="h-8 w-full border border-white/10 bg-card px-3 text-[11px] font-mono text-foreground/70 outline-none transition-colors placeholder:text-foreground/20 focus:border-primary/40"
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

              {mode.type === "create" && form.nodeType === "PART" && (
                <label className="block space-y-1">
                  <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-foreground/30">Panel Parent</span>
                  <SearchableField
                    value={parentPanelValue}
                    options={parentPanelOptions}
                    onChange={selectParentPanel}
                    placeholder={form.section ? "Pilih panel parent" : "Pilih section dulu"}
                    disabled={!form.section}
                  />
                </label>
              )}

              <>
                {mode.type === "edit" && mode.record.nodeType === "PART" && selectedParentPanel && (
                  <div className="border border-primary/20 bg-primary/[0.04] px-3 py-2 text-[10px] font-mono text-app-accent-ink">
                    Parent: {selectedParentPanel.name}
                  </div>
                )}

                <label className="block space-y-1">
                  <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-foreground/30">
                    {mode.type === "create" && mode.sectionMode === "new"
                      ? "Nama Panel Pertama"
                      : form.nodeType === "PART"
                        ? "Nama Part"
                        : "Nama Panel"}
                  </span>
                  <input value={form.name}
                    onChange={(e) => setForm(c => ({ ...c, name: e.target.value }))}
                    placeholder={mode.type === "create" && mode.sectionMode === "new" ? "Contoh: Body Depan" : undefined}
                    className="h-8 w-full border border-white/10 bg-card px-3 text-[11px] font-mono text-foreground/70 outline-none transition-colors placeholder:text-foreground/20 focus:border-primary/40" />
                </label>
              </>

              {mode.type !== "create" || mode.sectionMode !== "existing" ? (
                <label className="block space-y-1">
                  <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-foreground/30">Kategori</span>
                  <SearchableField
                    value={form.category}
                    options={categoryOptions}
                    onChange={(category) => setForm(c => ({ ...c, category }))}
                    placeholder="Pilih kategori"
                  />
                </label>
              ) : null}

              <label className="flex items-center gap-3 border border-white/5 bg-card px-3 py-2">
                <input type="checkbox" checked={form.isActive}
                  onChange={(e) => setForm(c => ({ ...c, isActive: e.target.checked }))}
                  className="h-4 w-4 border-white/20 bg-transparent" />
                <span className="text-[10px] font-mono text-foreground/50">Aktifkan {form.nodeType === "PART" ? "part" : "panel"} ini</span>
              </label>

              <div className="grid grid-cols-2 gap-2">
                  <label className="block space-y-1">
                    <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-foreground/30">Qty</span>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={form.qty}
                      onChange={(e) => setForm(c => ({ ...c, qty: e.target.value }))}
                      className="h-8 w-full border border-white/10 bg-card px-3 text-[11px] font-mono text-foreground/70 outline-none transition-colors focus:border-primary/40"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-foreground/30">Lokasi</span>
                    <select
                      value={form.defaultLocationType}
                      onChange={(e) => {
                        const defaultLocationType = e.target.value as PanelFormState["defaultLocationType"];
                        setForm(c => ({
                          ...c,
                          defaultLocationType,
                          defaultStockStatus: stockStatusForLocation(defaultLocationType),
                        }));
                      }}
                      className="h-8 w-full border border-white/10 bg-card px-2 text-[10px] font-mono text-foreground/70 outline-none transition-colors focus:border-primary/40 [color-scheme:dark]"
                    >
                      <option value="UNIT">{LOCATION_LABEL.UNIT}</option>
                      <option value="WORKSHOP">{LOCATION_LABEL.WORKSHOP}</option>
                      <option value="GUDANG">{LOCATION_LABEL.GUDANG}</option>
                    </select>
                  </label>
                  <label className="block space-y-1">
                    <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-foreground/30">Posisi</span>
                    <select
                      value={form.defaultStockStatus}
                      onChange={(e) => setForm(c => ({ ...c, defaultStockStatus: e.target.value as PanelFormState["defaultStockStatus"] }))}
                      disabled={form.defaultLocationType === "UNIT"}
                      className="h-8 w-full border border-white/10 bg-card px-2 text-[10px] font-mono text-foreground/70 outline-none transition-colors focus:border-primary/40 disabled:cursor-not-allowed disabled:text-foreground/40 [color-scheme:dark]"
                    >
                      <option value="INSTALLED">{STOCK_STATUS_LABEL.INSTALLED}</option>
                      <option value="IN_STORAGE">{STOCK_STATUS_LABEL.IN_STORAGE}</option>
                      <option value="RETRIEVED">{STOCK_STATUS_LABEL.RETRIEVED}</option>
                      <option value="LOST">{STOCK_STATUS_LABEL.LOST}</option>
                    </select>
                  </label>
                  <label className="block space-y-1">
                    <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-foreground/30">Kondisi Barang</span>
                    <select
                      value={form.defaultConditionType}
                      onChange={(e) => setForm(c => ({ ...c, defaultConditionType: e.target.value as PanelFormState["defaultConditionType"] }))}
                      className="h-8 w-full border border-white/10 bg-card px-2 text-[10px] font-mono text-foreground/70 outline-none transition-colors focus:border-primary/40 [color-scheme:dark]"
                    >
                      <option value="BEKAS">{CONDITION_LABEL.BEKAS}</option>
                      <option value="RESTORE">{CONDITION_LABEL.RESTORE}</option>
                      <option value="BARU">{CONDITION_LABEL.BARU}</option>
                    </select>
                  </label>
              </div>

              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={isSubmitting}
                  className="border border-primary/40 bg-primary/[0.06] px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.12em] text-app-accent-ink transition-colors hover:bg-primary/10 disabled:opacity-30">
                  {isSubmitting ? "Menyimpan..." : "Simpan"}
                </button>
                <button type="button" onClick={closeForm}
                  className="border border-white/10 px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.12em] text-foreground/40 transition-colors hover:text-foreground">
                  Batal
                </button>
              </div>
            </form>
        </div>
        )}

      </div>
    </section>
  );
}