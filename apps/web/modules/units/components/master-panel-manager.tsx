"use client";

import type { UnitPanelGeneralRecord, UnitPanelRecord } from "@smsystem/contracts/unit-panel";
import { ArrowUpRight, Boxes, ChevronDown, ChevronRight, Plus, RefreshCw, Search } from "lucide-react";
import Link from "next/link";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  createUnitPanel,
  deleteUnitPanel,
  fetchUnitPanelGeneralTemplates,
  fetchUnitPanels,
  updateUnitPanel,
} from "@/shared/api/units";
import {
  buildPayload,
  CONDITION_LABEL,
  emptyForm,
  formForChild,
  formFromRecord,
  LOCATION_LABEL,
  type PanelFormState,
  STOCK_STATUS_LABEL,
  stockStatusForLocation,
} from "@/modules/units/helpers/unit-panel-form";
import { SearchableField, type SearchOption } from "./shared/SearchableField";

const PAGE_SIZE = 20;
const ICON_STROKE_WIDTH = 2.5;

function displayCategory(value: string | null | undefined): string {
  return value?.trim() || "Lainnya";
}

function optionKey(value: string): string {
  return value.trim().toLowerCase();
}

function flattenGeneralPanelRecords(rows: UnitPanelGeneralRecord[]): UnitPanelGeneralRecord[] {
  const records: UnitPanelGeneralRecord[] = [];
  for (const row of rows) {
    records.push(row);
    records.push(...flattenGeneralPanelRecords(row.children));
  }
  return records;
}

function panelRecordOptionKey(record: Pick<UnitPanelRecord | UnitPanelGeneralRecord, "nodeType" | "category" | "section" | "name">): string {
  return `${record.nodeType}:${optionKey(displayCategory(record.category))}:${optionKey(record.section)}:${optionKey(record.name)}`;
}

function mergeOptions(unitOptions: SearchOption[], generalOptions: SearchOption[]): SearchOption[] {
  const seen = new Set<string>();
  const merged: SearchOption[] = [];
  for (const option of [...unitOptions, ...generalOptions]) {
    const key = option.dedupeKey ?? `${optionKey(option.value)}:${optionKey(option.label ?? "")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(option);
  }
  return merged;
}

type FormMode =
  | { type: "create"; sectionMode: "existing" | "new" }
  | { type: "edit"; record: UnitPanelRecord }
  | null;

interface MasterPanelManagerProps {
  unitId: string;
  canManage: boolean;
  initialRows?: UnitPanelRecord[];
}

function buildPanelDetailHref(unitId: string, recordId: number): string {
  return `/units/${unitId}/panels/panel-${recordId}`;
}

export function MasterPanelManager({ unitId, canManage, initialRows }: MasterPanelManagerProps) {
  const [rows, setRows] = useState<UnitPanelRecord[]>(() => initialRows ?? []);
  const [generalRows, setGeneralRows] = useState<UnitPanelGeneralRecord[]>([]);
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
  const flatGeneralRecords = useMemo(() => flattenGeneralPanelRecords(generalRows), [generalRows]);

  useEffect(() => {
    if (!canManage) return;

    let cancelled = false;
    void fetchUnitPanelGeneralTemplates("").then((result) => {
      if (cancelled) return;
      setGeneralRows(result.payload?.data.tree ?? []);
    });

    return () => {
      cancelled = true;
    };
  }, [canManage]);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    for (const row of rows) {
      if (row.category) cats.add(row.category);
    }
    return ["ALL", ...Array.from(cats).sort()];
  }, [rows]);

  const generalCategories = useMemo(() => {
    const cats = new Set<string>();
    for (const row of flatGeneralRecords) {
      cats.add(displayCategory(row.category));
    }
    return Array.from(cats).sort();
  }, [flatGeneralRecords]);

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

  const generalRowsInSelectedCategory = useMemo(() => {
    return flatGeneralRecords.filter(row => displayCategory(row.category) === form.category);
  }, [flatGeneralRecords, form.category]);

  const formSections = useMemo(() => {
    return Array.from(new Set(rowsInSelectedCategory.map(row => row.section))).sort();
  }, [rowsInSelectedCategory]);

  const generalFormSections = useMemo(() => {
    return Array.from(new Set(generalRowsInSelectedCategory.map(row => row.section))).sort();
  }, [generalRowsInSelectedCategory]);

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
    () => mergeOptions(
      formSections.map(section => ({ value: section, dedupeKey: `${optionKey(form.category)}:${optionKey(section)}` })),
      generalFormSections.map(section => ({
        value: section,
        label: "GENERAL",
        dedupeKey: `${optionKey(form.category)}:${optionKey(section)}`,
      })),
    ),
    [form.category, formSections, generalFormSections],
  );
  const parentPanelOptions = useMemo<SearchOption[]>(
    () => panelsBySelectedSection.map(panel => ({
      value: panel.name,
      label: panel.category ?? panel.section,
    })),
    [panelsBySelectedSection],
  );
  const categoryOptions = useMemo<SearchOption[]>(
    () => mergeOptions(
      categories
        .filter(category => category !== "ALL")
        .map(category => ({ value: category, dedupeKey: optionKey(category) })),
      generalCategories.map(category => ({ value: category, label: "GENERAL", dedupeKey: optionKey(category) })),
    ),
    [categories, generalCategories],
  );
  const nameOptions = useMemo<SearchOption[]>(() => {
    const unitOptions = rows
      .flatMap(row => [row, ...row.children])
      .filter(record => record.nodeType === form.nodeType)
      .map(record => ({
        value: record.name,
        label: [displayCategory(record.category), record.section, "UNIT"].filter(Boolean).join(" > "),
        dedupeKey: panelRecordOptionKey(record),
      }));
    const generalOptions = flatGeneralRecords
      .filter(record => record.nodeType === form.nodeType)
      .map(record => ({
        value: record.name,
        label: [displayCategory(record.category), record.section, "GENERAL"].filter(Boolean).join(" > "),
        dedupeKey: panelRecordOptionKey(record),
      }));
    return mergeOptions(unitOptions, generalOptions);
  }, [flatGeneralRecords, form.nodeType, rows]);

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
      setForm(c => ({
        ...c,
        nodeType: "PANEL",
        nodeTypeName: value,
        parentId: "",
        parentName: "",
        sourceGeneralId: "",
        generalTemplateName: "",
      }));
      return;
    }

    setForm(c => ({
      ...c,
      nodeType: "PART",
      nodeTypeName: value,
      parentId: "",
      parentName: "",
      sourceGeneralId: "",
      generalTemplateName: "",
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

  function selectNameSuggestion(option: SearchOption) {
    const unitRecords = rows.flatMap(row => [row, ...row.children]);
    const unitRecord = unitRecords.find(
      record => record.nodeType === form.nodeType && panelRecordOptionKey(record) === option.dedupeKey,
    );
    if (unitRecord) {
      setForm(c => ({
        ...c,
        sourceGeneralId: "",
        generalTemplateName: "",
        name: unitRecord.name,
        category: unitRecord.category ?? "",
        section: unitRecord.section,
        qty: String(unitRecord.qty ?? 1),
        defaultLocationType: unitRecord.defaultLocationType,
        defaultStockStatus: unitRecord.defaultStockStatus,
        defaultConditionType: unitRecord.defaultConditionType,
        parentId: c.nodeType === "PART" ? c.parentId : "",
        parentName: c.nodeType === "PART" ? c.parentName : "",
      }));
      return;
    }

    const generalRecord = flatGeneralRecords.find(
      record => record.nodeType === form.nodeType && panelRecordOptionKey(record) === option.dedupeKey,
    );
    setForm(c => ({
      ...c,
      sourceGeneralId: generalRecord ? String(generalRecord.id) : "",
      generalTemplateName: generalRecord?.name ?? c.generalTemplateName,
      name: generalRecord?.name ?? option.value,
      category: generalRecord?.category ?? c.category,
      section: generalRecord?.section ?? c.section,
      sortOrder: generalRecord ? String(generalRecord.sortOrder) : c.sortOrder,
      parentId: c.nodeType === "PART" ? c.parentId : "",
      parentName: c.nodeType === "PART" ? c.parentName : "",
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
      ...buildPayload(effectiveForm, { includeParentId: true }),
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
            sourceGeneralId: Number.parseInt(effectiveForm.sourceGeneralId, 10) || null,
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
    <section className="border border-border bg-card">

      {/* ── HEADER ── */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <div>
          <p className="text-[14px] font-mono uppercase tracking-[0.12em] text-muted-foreground">Master Panel</p>
          <h3 className="text-[15px] font-mono text-foreground">Panel dan Breakdown Part</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[14px] text-muted-foreground">{rootCount} panel · {partCount} part</span>
          <div className="w-px h-4 bg-muted" />
          <button type="button" onClick={() => void loadPanels()}
            className="inline-flex items-center gap-1.5 border border-border px-2 py-1 text-[14px] font-mono uppercase text-foreground hover:text-foreground hover:border-border transition-colors">
            <RefreshCw className="h-3 w-3" strokeWidth={ICON_STROKE_WIDTH} /> Refresh
          </button>
          {canManage && (
            <>
              <button type="button" onClick={openCreateRoot}
                className="inline-flex items-center gap-1.5 border border-primary/30 bg-primary/[0.04] px-2 py-1 text-[14px] font-mono uppercase text-app-accent-ink hover:bg-primary/10 transition-colors">
                <Plus className="h-3 w-3" strokeWidth={ICON_STROKE_WIDTH} /> Tambah Panel
              </button>
              <button type="button" onClick={openCreateSection}
                className="inline-flex items-center gap-1.5 border border-border px-2 py-1 text-[14px] font-mono uppercase text-foreground hover:border-border hover:text-foreground transition-colors">
                <Plus className="h-3 w-3" strokeWidth={ICON_STROKE_WIDTH} /> Tambah Panel + Section
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── SEARCH + CATEGORY TABS ── */}
      <div className="border-b border-border bg-background">
        {/* Search bar + Section dropdown */}
        <div className="flex items-center gap-2 border-b border-border px-4 py-2">
          {/* Search input — flex-1 */}
          <div className="flex flex-1 items-center gap-2 border border-border bg-card px-3">
            <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={ICON_STROKE_WIDTH} />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Cari panel, part, section..."
              className="h-8 w-full bg-transparent text-[15px] font-mono text-foreground outline-none placeholder:text-muted-foreground"
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setCurrentPage(1);
                }}
                className="text-[14px] font-mono text-muted-foreground transition-colors hover:text-foreground">
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
              className="h-8 min-w-[160px] max-w-[220px] cursor-pointer appearance-none border border-border bg-card pl-3 pr-7 text-[14px] font-mono uppercase tracking-[0.08em] text-foreground outline-none focus:border-primary/40 dark:[color-scheme:dark]"
            >
              {sections.map(sec => (
                <option key={sec} value={sec}>{sec}</option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[14px] text-muted-foreground">▾</span>
          </div>
        </div>

        {/* Category tabs */}
        <div className="flex overflow-x-auto border-b border-border px-4 gap-0 scrollbar-none">
          <p className="shrink-0 self-center border-r border-border mr-3 pr-3 text-[15px] font-mono uppercase tracking-[0.12em] text-muted-foreground">
            Kategori
          </p>
          {categories.map(cat => (
            <button key={cat} type="button" onClick={() => handleCategoryChange(cat)}
              className={`whitespace-nowrap px-3 py-2 text-[14px] font-mono uppercase tracking-[0.12em] border-b-2 transition-colors ${
                activeCategory === cat
                  ? "border-primary text-app-accent-ink"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* ── MAIN GRID: TABLE + FORM ── */}
      <div className={mode !== null
        ? "grid min-h-[300px] divide-x divide-border xl:grid-cols-[minmax(0,1fr)_300px]"
        : "min-h-[300px]"
      }>

        {/* LEFT — Tabel */}
        <div className="overflow-auto">
          {message && (
            <div className="border-b border-success/20 bg-success/[0.04] px-4 py-2 text-[15px] font-mono text-success">
              {message}
            </div>
          )}
          {error && (
            <div className="border-b border-destructive/20 bg-destructive/[0.04] px-4 py-2 text-[15px] font-mono text-destructive">
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="px-4 py-6 text-[15px] font-mono text-muted-foreground">Memuat master panel...</div>
          ) : filteredRows.length === 0 ? (
            <div className="m-4 border border-dashed border-border px-4 py-8 text-center text-[15px] font-mono text-muted-foreground">
              {search ? `Tidak ada hasil untuk "${search}"` : "Belum ada panel pada filter ini."}
            </div>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="sticky top-0 border-b border-border bg-background">
                  <th className="px-4 py-2 text-[14px] font-mono uppercase tracking-[0.12em] text-muted-foreground">Kategori</th>
                  <th className="px-4 py-2 text-[14px] font-mono uppercase tracking-[0.12em] text-muted-foreground">Section</th>
                  <th className="px-4 py-2 text-[14px] font-mono uppercase tracking-[0.12em] text-muted-foreground">Panel / Part</th>
                  <th className="px-4 py-2 text-right text-[14px] font-mono uppercase tracking-[0.12em] text-muted-foreground">Qty</th>
                  <th className="px-4 py-2 text-[14px] font-mono uppercase tracking-[0.12em] text-muted-foreground">Lokasi</th>
                  <th className="px-4 py-2 text-[14px] font-mono uppercase tracking-[0.12em] text-muted-foreground">Posisi</th>
                  <th className="px-4 py-2 text-[14px] font-mono uppercase tracking-[0.12em] text-muted-foreground">Kondisi Barang</th>
                  <th className="px-4 py-2 text-[14px] font-mono uppercase tracking-[0.12em] text-muted-foreground text-center">Part</th>
                  <th className="px-4 py-2 text-[14px] font-mono uppercase tracking-[0.12em] text-muted-foreground">Aktif</th>
                  {canManage && (
                    <th className="px-4 py-2 text-right text-[14px] font-mono uppercase tracking-[0.12em] text-muted-foreground">Aksi</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {paginatedRows.map((row) => (
                  <React.Fragment key={row.id}>
                    {/* Panel row */}
                    <tr className="group border-b border-border transition-colors hover:bg-muted">
                      <td className="align-middle px-4 py-1.5 text-[14px] font-mono text-muted-foreground">
                        {row.category ?? "-"}
                      </td>
                      <td className="align-middle px-4 py-1.5 text-[14px] font-mono uppercase text-muted-foreground">
                        {row.section}
                      </td>
                      <td className="px-4 py-1.5 align-middle">
                        <div className="flex items-center gap-2">
                          {/* Toggle expand */}
                          {row.children.length > 0 ? (
                            <button
                              type="button"
                              onClick={() => togglePanel(String(row.id))}
                              className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
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
                            <p className="text-[15px] font-mono text-foreground truncate">{row.name}</p>
                            <Link
                              href={buildPanelDetailHref(unitId, row.id)}
                              className="shrink-0 text-muted-foreground opacity-0 transition-[color,opacity] group-hover:opacity-100 group-focus-within:opacity-100 hover:text-app-accent-ink focus-visible:opacity-100"
                              title="Buka detail workflow"
                            >
                              <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={ICON_STROKE_WIDTH} />
                            </Link>
                            {row.countdownUsageCount > 0 && (
                              <span className="shrink-0 border border-primary/20 px-1.5 py-0.5 text-[14px] font-mono text-app-accent-ink/60">
                                {row.countdownUsageCount}cd
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="align-middle px-4 py-1.5 text-right font-mono text-[14px] text-muted-foreground">
                        {row.qty}
                      </td>
                      <td className="align-middle px-4 py-1.5 font-mono text-[14px] text-muted-foreground">
                        {LOCATION_LABEL[row.defaultLocationType]}
                      </td>
                      <td className="align-middle px-4 py-1.5 font-mono text-[14px] text-muted-foreground">
                        {STOCK_STATUS_LABEL[row.defaultStockStatus]}
                      </td>
                      <td className="align-middle px-4 py-1.5 font-mono text-[14px] text-muted-foreground">
                        {CONDITION_LABEL[row.defaultConditionType]}
                      </td>
                      <td className="px-4 py-1.5 text-center align-middle">
                        <span className={`font-mono text-[15px] ${row.childCount > 0 ? "text-muted-foreground" : "text-muted-foreground"}`}>
                          {row.childCount}
                        </span>
                      </td>
                      <td className="align-middle px-4 py-1.5">
                        {row.isActive
                          ? <span className="border border-success/20 bg-success/[0.04] px-2 py-0.5 text-[15px] font-mono text-success">AKTIF</span>
                          : <span className="border border-border px-2 py-0.5 text-[15px] font-mono text-muted-foreground">NONAKTIF</span>
                        }
                      </td>
                      {canManage && (
                        <td className="align-middle px-4 py-1.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button type="button" onClick={() => openEdit(row)}
                              className="border border-border px-2 py-0.5 text-[15px] font-mono text-muted-foreground transition-colors hover:border-border hover:text-foreground">
                              Edit
                            </button>
                            <button type="button" onClick={() => openCreateChild(row)}
                              className="border border-border px-2 py-0.5 text-[15px] font-mono text-muted-foreground transition-colors hover:border-border hover:text-foreground">
                              + Part
                            </button>
                            <button type="button" onClick={() => void handleDelete(row)}
                              className="border border-destructive/20 px-2 py-0.5 text-[15px] font-mono text-destructive/50 transition-colors hover:border-destructive/40 hover:text-destructive">
                              Hapus
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>

                    {/* Child part rows */}
                    {expandedPanelIds.has(String(row.id)) && row.children.map((child) => (
                      <tr key={child.id} className="group border-b border-border bg-background/30 transition-colors hover:bg-muted">
                        <td className="align-middle px-4 py-1 text-[15px] font-mono text-muted-foreground">{row.category ?? ""}</td>
                        <td className="align-middle px-4 py-1 text-[15px] font-mono text-muted-foreground">{row.section}</td>
                        <td className="px-4 py-1 align-middle">
                          <div className="flex items-center gap-2" style={{ paddingLeft: "20px" }}>
                            <span className="text-muted-foreground text-[15px] shrink-0">└</span>
                            <span className="text-[14px] font-mono text-muted-foreground truncate">{child.name}</span>
                            <Link
                              href={buildPanelDetailHref(unitId, child.id)}
                              className="shrink-0 text-muted-foreground opacity-0 transition-[color,opacity] group-hover:opacity-100 group-focus-within:opacity-100 hover:text-app-accent-ink focus-visible:opacity-100"
                              title="Buka detail workflow"
                            >
                              <ArrowUpRight className="h-3 w-3" strokeWidth={ICON_STROKE_WIDTH} />
                            </Link>
                            {child.countdownUsageCount > 0 && (
                              <span className="shrink-0 border border-primary/15 px-1 py-0.5 text-[14px] font-mono text-app-accent-ink/40">
                                {child.countdownUsageCount}cd
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="align-middle px-4 py-1 text-right font-mono text-[15px] text-muted-foreground">{child.qty}</td>
                        <td className="align-middle px-4 py-1 font-mono text-[15px] text-muted-foreground">{LOCATION_LABEL[child.defaultLocationType]}</td>
                        <td className="align-middle px-4 py-1 font-mono text-[15px] text-muted-foreground">{STOCK_STATUS_LABEL[child.defaultStockStatus]}</td>
                        <td className="align-middle px-4 py-1 font-mono text-[15px] text-muted-foreground">{CONDITION_LABEL[child.defaultConditionType]}</td>
                        <td className="align-middle px-4 py-1 text-center">
                          <span className="border border-border px-1.5 py-0.5 text-[14px] font-mono text-muted-foreground">PART</span>
                        </td>
                        <td className="align-middle px-4 py-1">
                          {child.isActive
                            ? <span className="border border-success/15 px-1.5 py-0.5 text-[14px] font-mono text-success/60">AKTIF</span>
                            : <span className="border border-border px-1.5 py-0.5 text-[14px] font-mono text-muted-foreground">NONAKTIF</span>
                          }
                        </td>
                        {canManage && (
                          <td className="align-middle px-4 py-1 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button type="button" onClick={() => openEdit(child)}
                                className="border border-border px-1.5 py-0.5 text-[14px] font-mono text-muted-foreground transition-colors hover:text-foreground">
                                Edit
                              </button>
                              <button type="button" onClick={() => void handleDelete(child)}
                                className="border border-destructive/15 px-1.5 py-0.5 text-[14px] font-mono text-destructive/40 transition-colors hover:text-destructive">
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
            <div className="flex items-center justify-between border-t border-border bg-background px-4 py-2">
              <span className="font-mono text-[14px] text-muted-foreground">
                {filteredRows.length} panel · hal {currentPage} dari {totalPages}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="border border-border px-2 py-1 text-[14px] font-mono text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-20"
                >
                  «
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="border border-border px-2 py-1 text-[14px] font-mono text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-20"
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
                      <span key={`ellipsis-${idx}`} className="px-2 text-[14px] font-mono text-muted-foreground">...</span>
                    ) : (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setCurrentPage(item)}
                        className={`border px-2.5 py-1 text-[14px] font-mono transition-colors ${
                          currentPage === item
                            ? "border-primary/40 bg-primary/[0.06] text-app-accent-ink"
                            : "border-border text-muted-foreground hover:text-foreground"
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
                  className="border border-border px-2 py-1 text-[14px] font-mono text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-20"
                >
                  ›
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="border border-border px-2 py-1 text-[14px] font-mono text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-20"
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
            <span className="text-[14px] font-mono uppercase tracking-[0.12em] text-muted-foreground">
              {mode.type === "edit" ? `Edit ${mode.record.nodeType === "PANEL" ? "Panel" : "Part"}`
                : mode.sectionMode === "new" ? "Tambah Panel + Section"
                : form.nodeType === "PART" ? "Tambah Part"
                : "Tambah Panel"}
            </span>
          </div>

            <form className="space-y-3" onSubmit={(event) => void handleSubmit(event)}>
              {mode.type === "create" && mode.sectionMode === "existing" && (
                <div className="space-y-1">
                  <span className="text-[14px] font-mono uppercase tracking-[0.12em] text-muted-foreground">Buat</span>
                  <div className="grid grid-cols-2 gap-1 border border-border bg-card p-1">
                    <button
                      type="button"
                      onClick={() => selectNodeType("Panel")}
                      className={`px-2 py-1.5 text-[14px] font-mono uppercase tracking-[0.12em] transition-colors ${
                        form.nodeType === "PANEL"
                          ? "bg-primary/[0.08] text-app-accent-ink"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Panel
                    </button>
                    <button
                      type="button"
                      onClick={() => selectNodeType("Part")}
                      className={`px-2 py-1.5 text-[14px] font-mono uppercase tracking-[0.12em] transition-colors ${
                        form.nodeType === "PART"
                          ? "bg-primary/[0.08] text-app-accent-ink"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Part
                    </button>
                  </div>
                </div>
              )}

              {mode.type === "create" && mode.sectionMode === "existing" && (
                <label className="block space-y-1">
                  <span className="text-[14px] font-mono uppercase tracking-[0.12em] text-muted-foreground">Kategori</span>
                  <SearchableField
                    value={form.category}
                    options={categoryOptions}
                    onChange={selectCategory}
                    placeholder="Pilih kategori"
                    heightClassName="h-8"
                    menuZClassName="z-30"
                    iconStrokeWidth={ICON_STROKE_WIDTH}
                    closeOnInputBlurDelay
                    maxVisibleOptions={5}
                    minSearchLength={3}
                  />
                </label>
              )}

              <label className="block space-y-1">
                <span className="text-[14px] font-mono uppercase tracking-[0.12em] text-muted-foreground">Section</span>
                {mode.type === "create" && mode.sectionMode === "new" ? (
                  <SearchableField
                    value={form.section}
                    options={sectionOptions}
                    onChange={(section) => setForm(c => ({ ...c, section }))}
                    placeholder="Nama section baru"
                    heightClassName="h-8"
                    menuZClassName="z-30"
                    iconStrokeWidth={ICON_STROKE_WIDTH}
                    closeOnInputBlurDelay
                    maxVisibleOptions={5}
                    minSearchLength={3}
                  />
                ) : (
                  <SearchableField
                    value={form.section}
                    options={sectionOptions}
                    onChange={selectSection}
                    placeholder={form.category ? "Pilih section" : "Pilih kategori dulu"}
                    disabled={mode.type === "create" && mode.sectionMode === "existing" && !form.category}
                    heightClassName="h-8"
                    menuZClassName="z-30"
                    iconStrokeWidth={ICON_STROKE_WIDTH}
                    closeOnInputBlurDelay
                    maxVisibleOptions={5}
                    minSearchLength={3}
                  />
                )}
              </label>

              {mode.type === "create" && form.nodeType === "PART" && (
                <label className="block space-y-1">
                  <span className="text-[14px] font-mono uppercase tracking-[0.12em] text-muted-foreground">Panel Parent</span>
                  <SearchableField
                    value={parentPanelValue}
                    options={parentPanelOptions}
                    onChange={selectParentPanel}
                    placeholder={form.section ? "Pilih panel parent" : "Pilih section dulu"}
                    disabled={!form.section}
                    heightClassName="h-8"
                    menuZClassName="z-30"
                    iconStrokeWidth={ICON_STROKE_WIDTH}
                    closeOnInputBlurDelay
                    maxVisibleOptions={5}
                    minSearchLength={3}
                  />
                </label>
              )}

              <>
                {mode.type === "edit" && mode.record.nodeType === "PART" && selectedParentPanel && (
                  <div className="border border-primary/20 bg-primary/[0.04] px-3 py-2 text-[14px] font-mono text-app-accent-ink">
                    Parent: {selectedParentPanel.name}
                  </div>
                )}

                <label className="block space-y-1">
                  <span className="text-[14px] font-mono uppercase tracking-[0.12em] text-muted-foreground">
                    {mode.type === "create" && mode.sectionMode === "new"
                      ? "Nama Panel Pertama"
                      : form.nodeType === "PART"
                        ? "Nama Part"
                        : "Nama Panel"}
                  </span>
                  <SearchableField
                    value={form.name}
                    options={nameOptions}
                    onChange={(name) => setForm(c => ({ ...c, name }))}
                    onSelect={selectNameSuggestion}
                    placeholder={mode.type === "create" && mode.sectionMode === "new" ? "Contoh: Body Depan" : undefined}
                    heightClassName="h-8"
                    menuZClassName="z-30"
                    iconStrokeWidth={ICON_STROKE_WIDTH}
                    closeOnInputBlurDelay
                    maxVisibleOptions={5}
                    minSearchLength={3}
                  />
                </label>
              </>

              {mode.type !== "create" || mode.sectionMode !== "existing" ? (
                <label className="block space-y-1">
                  <span className="text-[14px] font-mono uppercase tracking-[0.12em] text-muted-foreground">Kategori</span>
                  <SearchableField
                    value={form.category}
                    options={categoryOptions}
                    onChange={(category) => setForm(c => ({ ...c, category }))}
                    placeholder="Pilih kategori"
                    heightClassName="h-8"
                    menuZClassName="z-30"
                    iconStrokeWidth={ICON_STROKE_WIDTH}
                    closeOnInputBlurDelay
                    maxVisibleOptions={5}
                    minSearchLength={3}
                  />
                </label>
              ) : null}

              <label className="flex items-center gap-3 border border-border bg-card px-3 py-2">
                <input type="checkbox" checked={form.isActive}
                  onChange={(e) => setForm(c => ({ ...c, isActive: e.target.checked }))}
                  className="h-4 w-4 border-border bg-transparent" />
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
                      onChange={(e) => setForm(c => ({ ...c, qty: e.target.value }))}
                      className="h-8 w-full border border-border bg-card px-3 text-[15px] font-mono text-foreground outline-none transition-colors focus:border-primary/40"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-[14px] font-mono uppercase tracking-[0.12em] text-muted-foreground">Lokasi</span>
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
                      className="h-8 w-full border border-border bg-card px-2 text-[14px] font-mono text-foreground outline-none transition-colors focus:border-primary/40 dark:[color-scheme:dark]"
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
                      onChange={(e) => setForm(c => ({ ...c, defaultStockStatus: e.target.value as PanelFormState["defaultStockStatus"] }))}
                      disabled={form.defaultLocationType === "UNIT"}
                      className="h-8 w-full border border-border bg-card px-2 text-[14px] font-mono text-foreground outline-none transition-colors focus:border-primary/40 disabled:cursor-not-allowed disabled:text-muted-foreground dark:[color-scheme:dark]"
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
                      onChange={(e) => setForm(c => ({ ...c, defaultConditionType: e.target.value as PanelFormState["defaultConditionType"] }))}
                      className="h-8 w-full border border-border bg-card px-2 text-[14px] font-mono text-foreground outline-none transition-colors focus:border-primary/40 dark:[color-scheme:dark]"
                    >
                      <option value="BEKAS">{CONDITION_LABEL.BEKAS}</option>
                      <option value="RESTORE">{CONDITION_LABEL.RESTORE}</option>
                      <option value="BARU">{CONDITION_LABEL.BARU}</option>
                    </select>
                  </label>
              </div>

              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={isSubmitting}
                  className="border border-primary/40 bg-primary/[0.06] px-3 py-1.5 text-[14px] font-mono uppercase tracking-[0.12em] text-app-accent-ink transition-colors hover:bg-primary/10 disabled:opacity-30">
                  {isSubmitting ? "Menyimpan..." : "Simpan"}
                </button>
                <button type="button" onClick={closeForm}
                  className="border border-border px-3 py-1.5 text-[14px] font-mono uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-foreground">
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
