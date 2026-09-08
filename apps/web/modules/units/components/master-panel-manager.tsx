"use client";

import type { UnitPanelGeneralRecord, UnitPanelRecord } from "@smsystem/contracts/unit-panel";
import type { ColDef } from "ag-grid-community";
import { AllCommunityModule, ModuleRegistry } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { Boxes, Eye, Image as ImageIcon, Plus, RefreshCw, Search, X } from "lucide-react";
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

const ICON_STROKE_WIDTH = 2.5;

ModuleRegistry.registerModules([AllCommunityModule]);

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

function displaySource(record: UnitPanelRecord): "CATALOG" | "ADDITIONAL" {
  return record.componentId || record.catalogPanelId ? "CATALOG" : "ADDITIONAL";
}

function displayPanelStatus(record: UnitPanelRecord): string {
  if (!record.isActive) return "Nonaktif";
  if (record.statusUsageCount > 0 || record.countdownUsageCount > 0) return "Operational";
  return "Siap";
}

function conditionSummary(record: UnitPanelRecord): string {
  const source = record.children.length > 0 ? record.children : [record];
  const counts = source.reduce<Record<string, number>>((acc, item) => {
    const label = CONDITION_LABEL[item.defaultConditionType];
    acc[label] = (acc[label] ?? 0) + 1;
    return acc;
  }, {});

  return Object.entries(counts)
    .map(([label, count]) => `${label} ${count}`)
    .join(" · ");
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
  const [isUsingGeneralTemplate, setIsUsingGeneralTemplate] = useState(false);

  const [activeCategory, setActiveCategory] = useState<string>("ALL");
  const [activeSection, setActiveSection] = useState<string>("ALL");
  const [search, setSearch] = useState<string>("");
  const [selectedPanelId, setSelectedPanelId] = useState<number | null>(null);
  const [selectedPart, setSelectedPart] = useState<UnitPanelRecord | null>(null);
  const flatGeneralRecords = useMemo(() => flattenGeneralPanelRecords(generalRows), [generalRows]);

  useEffect(() => {
    if (!canManage || !isUsingGeneralTemplate || mode?.type !== "create") return;
    const q = form.generalTemplateName.trim();
    if (q.length < 3) {
      setGeneralRows([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void fetchUnitPanelGeneralTemplates("", { q, nodeType: form.nodeType, limit: "25" }).then((result) => {
        if (cancelled) return;
        setGeneralRows(result.payload?.data.tree ?? []);
      });
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [canManage, form.generalTemplateName, form.nodeType, isUsingGeneralTemplate, mode?.type]);

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
    () => formSections.map(section => ({ value: section, dedupeKey: `${optionKey(form.category)}:${optionKey(section)}` })),
    [form.category, formSections],
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
      .map(category => ({ value: category, dedupeKey: optionKey(category) })),
    [categories],
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
    return unitOptions;
  }, [form.nodeType, rows]);

  const generalTemplateOptions = useMemo<SearchOption[]>(() => {
    const unitKeys = new Set(rows.flatMap(row => [row, ...row.children]).map(record => panelRecordOptionKey(record)));
    return flatGeneralRecords
      .filter(record => record.nodeType === form.nodeType)
      .filter(record => !unitKeys.has(panelRecordOptionKey(record)))
      .map(record => ({
        value: record.name,
        label: [displayCategory(record.category), record.section].filter(Boolean).join(" > "),
        dedupeKey: `general:${record.id}`,
      }));
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

  function handleCategoryChange(cat: string) {
    setActiveCategory(cat);
    setActiveSection("ALL");
  }

  const rootCount = rows.length;
  const partCount = useMemo(
    () => rows.reduce((total, row) => total + row.children.length, 0),
    [rows],
  );
  const selectedPanel = useMemo(
    () => rows.find(row => row.id === selectedPanelId) ?? null,
    [rows, selectedPanelId],
  );
  const panelColumnDefs = useMemo<ColDef<UnitPanelRecord>[]>(() => [
    {
      headerName: "Component",
      valueGetter: ({ data }) => displayCategory(data?.category),
      minWidth: 150,
      flex: 0.9,
    },
    {
      headerName: "Panel",
      field: "name",
      minWidth: 220,
      flex: 1.4,
      cellRenderer: ({ data }: { data?: UnitPanelRecord }) => (
        <button
          type="button"
          className="text-left font-medium text-foreground hover:text-app-accent-ink"
          onClick={() => data && setSelectedPanelId(data.id)}
        >
          {data?.name ?? "-"}
        </button>
      ),
    },
    {
      headerName: "Total Part",
      field: "childCount",
      width: 120,
      cellClass: "font-mono text-muted-foreground",
    },
    {
      headerName: "Condition Summary",
      valueGetter: ({ data }) => data ? conditionSummary(data) : "-",
      minWidth: 190,
      flex: 1.2,
    },
    {
      headerName: "Status",
      valueGetter: ({ data }) => data ? displayPanelStatus(data) : "-",
      width: 130,
    },
    {
      headerName: "Action",
      width: canManage ? 230 : 150,
      sortable: false,
      filter: false,
      cellRenderer: ({ data }: { data?: UnitPanelRecord }) => {
        if (!data) return null;
        return (
          <div className="flex h-full items-center gap-1">
            <button
              type="button"
              onClick={() => setSelectedPanelId(data.id)}
              className="catalog-icon-button"
              title="View Detail"
            >
              <Eye className="h-3.5 w-3.5" strokeWidth={ICON_STROKE_WIDTH} />
            </button>
            <Link href={buildPanelDetailHref(unitId, data.id)} className="catalog-icon-button" title="View Image">
              <ImageIcon className="h-3.5 w-3.5" strokeWidth={ICON_STROKE_WIDTH} />
            </Link>
            {canManage ? (
              <>
                <button type="button" onClick={() => openEdit(data)} className="border border-border px-2 py-0.5 text-[13px] text-muted-foreground hover:text-foreground">
                  Edit
                </button>
                <button type="button" onClick={() => void handleDelete(data)} className="border border-destructive/20 px-2 py-0.5 text-[13px] text-destructive/60 hover:text-destructive">
                  Hapus
                </button>
              </>
            ) : null}
          </div>
        );
      },
    },
  ], [canManage, unitId]);
  const partColumnDefs = useMemo<ColDef<UnitPanelRecord>[]>(() => [
    {
      headerName: "Alias/Name",
      field: "name",
      minWidth: 230,
      flex: 1.4,
      cellRenderer: ({ data }: { data?: UnitPanelRecord }) => (
        <button
          type="button"
          className="text-left font-medium text-foreground hover:text-app-accent-ink"
          onClick={() => data && setSelectedPart(data)}
        >
          {data?.name ?? "-"}
        </button>
      ),
    },
    { headerName: "Part Number", valueGetter: () => "-", minWidth: 140, flex: 0.8 },
    {
      headerName: "Condition",
      valueGetter: ({ data }) => data ? CONDITION_LABEL[data.defaultConditionType] : "-",
      minWidth: 130,
      flex: 0.8,
    },
    {
      headerName: "Current Status",
      valueGetter: ({ data }) => data ? displayPanelStatus(data) : "-",
      minWidth: 140,
      flex: 0.8,
    },
    {
      headerName: "Source",
      valueGetter: ({ data }) => data ? displaySource(data) : "-",
      width: 120,
    },
    {
      headerName: "Action",
      width: 120,
      sortable: false,
      filter: false,
      cellRenderer: ({ data }: { data?: UnitPanelRecord }) => data ? (
        <div className="flex h-full items-center gap-1">
          <button type="button" onClick={() => setSelectedPart(data)} className="catalog-icon-button" title="View Detail">
            <Eye className="h-3.5 w-3.5" strokeWidth={ICON_STROKE_WIDTH} />
          </button>
          <Link href={buildPanelDetailHref(unitId, data.id)} className="catalog-icon-button" title="View Image">
            <ImageIcon className="h-3.5 w-3.5" strokeWidth={ICON_STROKE_WIDTH} />
          </Link>
        </div>
      ) : null,
    },
  ], [unitId]);

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
    setIsUsingGeneralTemplate(false);
    setMessage(null);
    setError(null);
  }

  function openCreateSection() {
    setMode({ type: "create", sectionMode: "new" });
    setForm(emptyForm());
    setIsUsingGeneralTemplate(false);
    setMessage(null);
    setError(null);
  }

  function openCreateChild(parent: UnitPanelRecord) {
    setMode({ type: "create", sectionMode: "existing" });
    setForm(formForChild(parent));
    setIsUsingGeneralTemplate(false);
    setMessage(null);
    setError(null);
  }

  function openEdit(record: UnitPanelRecord) {
    setMode({ type: "edit", record });
    setForm(formFromRecord(record));
    setIsUsingGeneralTemplate(false);
    setMessage(null);
    setError(null);
  }

  function closeForm() {
    setMode(null);
    setForm(emptyForm());
    setIsUsingGeneralTemplate(false);
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
      setIsUsingGeneralTemplate(false);
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
    setIsUsingGeneralTemplate(false);
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

  function selectGeneralTemplate(value: string) {
    setForm(c => ({ ...c, generalTemplateName: value, sourceGeneralId: "" }));
  }

  function selectGeneralTemplateOption(option: SearchOption) {
    const templateId = option.dedupeKey?.replace(/^general:/, "");
    const normalized = option.value.trim().toLowerCase();
    const generalRecord = flatGeneralRecords.find(
      record => record.nodeType === form.nodeType && (String(record.id) === templateId || record.name.toLowerCase() === normalized),
    );
    setForm(c => ({
      ...c,
      sourceGeneralId: generalRecord ? String(generalRecord.id) : "",
      generalTemplateName: option.value,
      name: generalRecord?.name ?? c.name,
      category: generalRecord?.category ?? c.category,
      section: generalRecord?.section ?? c.section,
      sortOrder: generalRecord ? String(generalRecord.sortOrder) : c.sortOrder,
      parentId: c.nodeType === "PART" ? c.parentId : "",
      parentName: c.nodeType === "PART" ? c.parentName : "",
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
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari panel, part, section..."
              className="h-8 w-full bg-transparent text-[15px] font-mono text-foreground outline-none placeholder:text-muted-foreground"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="text-[14px] font-mono text-muted-foreground transition-colors hover:text-foreground">
                ✕
              </button>
            )}
          </div>

          {/* Section dropdown — compact, fixed width */}
          <div className="relative shrink-0">
            <select
              value={activeSection}
              onChange={(e) => setActiveSection(e.target.value)}
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
            <div className="space-y-4 p-4">
              {selectedPanel ? (
                <div className="border border-border bg-background">
                  <div className="flex items-start justify-between gap-4 border-b border-border px-4 py-3">
                    <div>
                      <p className="text-[13px] font-mono uppercase tracking-[0.12em] text-muted-foreground">
                        {displayCategory(selectedPanel.category)} &gt; {selectedPanel.name}
                      </p>
                      <h4 className="mt-1 text-[18px] font-semibold text-foreground">{selectedPanel.name}</h4>
                      <p className="mt-1 text-[14px] text-muted-foreground">
                        {selectedPanel.childCount} part · {conditionSummary(selectedPanel)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {canManage ? (
                        <button
                          type="button"
                          onClick={() => openCreateChild(selectedPanel)}
                          className="inline-flex items-center gap-1.5 border border-primary/30 bg-primary/[0.04] px-2 py-1 text-[14px] font-mono uppercase text-app-accent-ink hover:bg-primary/10"
                        >
                          <Plus className="h-3 w-3" strokeWidth={ICON_STROKE_WIDTH} /> Add Part
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => setSelectedPanelId(null)}
                        className="border border-border px-3 py-1 text-[14px] font-mono uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground"
                      >
                        Kembali
                      </button>
                    </div>
                  </div>
                  <div className="ag-theme-alpine sms-ag-grid h-[28rem] w-full">
                    <AgGridReact<UnitPanelRecord>
                      rowData={selectedPanel.children}
                      columnDefs={partColumnDefs}
                      defaultColDef={{
                        sortable: true,
                        resizable: true,
                        filter: true,
                        suppressHeaderMenuButton: true,
                      }}
                      getRowId={({ data }) => String(data.id)}
                      rowHeight={44}
                      suppressCellFocus={false}
                      suppressMovableColumns
                      overlayNoRowsTemplate="<span class='text-muted-foreground'>Belum ada part pada panel ini.</span>"
                    />
                  </div>
                </div>
              ) : (
                <div className="ag-theme-alpine sms-ag-grid h-[34rem] w-full border border-border">
                  <AgGridReact<UnitPanelRecord>
                    rowData={filteredRows}
                    columnDefs={panelColumnDefs}
                    defaultColDef={{
                      sortable: true,
                      resizable: true,
                      filter: true,
                      suppressHeaderMenuButton: true,
                    }}
                    getRowId={({ data }) => String(data.id)}
                    rowHeight={46}
                    pagination
                    paginationPageSize={20}
                    suppressCellFocus={false}
                    suppressMovableColumns
                    onRowDoubleClicked={({ data }) => data && setSelectedPanelId(data.id)}
                  />
                </div>
              )}
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

              {mode.type === "create" ? (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setIsUsingGeneralTemplate((current) => {
                      const next = !current;
                      if (!next) setForm((formState) => ({ ...formState, sourceGeneralId: "", generalTemplateName: "" }));
                      return next;
                    })}
                    className={`h-8 w-full border px-3 text-left text-[13px] font-mono uppercase tracking-[0.08em] transition-colors ${isUsingGeneralTemplate ? "border-primary/35 bg-primary/10 text-app-accent-ink" : "border-border bg-card text-muted-foreground hover:border-primary/35 hover:text-foreground"}`}
                  >
                    Ambil template general
                  </button>
                  {isUsingGeneralTemplate ? (
                    <label className="block space-y-1">
                      <span className="text-[14px] font-mono uppercase tracking-[0.12em] text-muted-foreground">Cari Template General</span>
                      <SearchableField
                        value={form.generalTemplateName}
                        options={generalTemplateOptions}
                        onChange={selectGeneralTemplate}
                        onSelect={selectGeneralTemplateOption}
                        placeholder={`Ketik minimal 3 huruf ${form.nodeType === "PART" ? "part" : "panel"}`}
                        heightClassName="h-8"
                        menuZClassName="z-30"
                        iconStrokeWidth={ICON_STROKE_WIDTH}
                        closeOnInputBlurDelay
                        maxVisibleOptions={5}
                        minSearchLength={3}
                      />
                    </label>
                  ) : null}
                </div>
              ) : null}

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
      {selectedPart ? (
        <div className="fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l border-border bg-card shadow-2xl">
          <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
            <div>
              <p className="text-[13px] font-mono uppercase tracking-[0.12em] text-muted-foreground">Part Detail</p>
              <h4 className="mt-1 text-[18px] font-semibold text-foreground">{selectedPart.name}</h4>
            </div>
            <button
              type="button"
              onClick={() => setSelectedPart(null)}
              className="catalog-icon-button"
              title="Tutup"
            >
              <X className="h-3.5 w-3.5" strokeWidth={ICON_STROKE_WIDTH} />
            </button>
          </div>
          <div className="flex-1 space-y-4 overflow-auto px-5 py-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="border border-border bg-background px-3 py-2">
                <p className="text-[12px] font-mono uppercase tracking-[0.12em] text-muted-foreground">Part Number</p>
                <p className="mt-1 text-[14px] text-foreground">-</p>
              </div>
              <div className="border border-border bg-background px-3 py-2">
                <p className="text-[12px] font-mono uppercase tracking-[0.12em] text-muted-foreground">Source</p>
                <p className="mt-1 text-[14px] text-foreground">{displaySource(selectedPart)}</p>
              </div>
              <div className="border border-border bg-background px-3 py-2">
                <p className="text-[12px] font-mono uppercase tracking-[0.12em] text-muted-foreground">Condition</p>
                <p className="mt-1 text-[14px] text-foreground">{CONDITION_LABEL[selectedPart.defaultConditionType]}</p>
              </div>
              <div className="border border-border bg-background px-3 py-2">
                <p className="text-[12px] font-mono uppercase tracking-[0.12em] text-muted-foreground">Status</p>
                <p className="mt-1 text-[14px] text-foreground">{displayPanelStatus(selectedPart)}</p>
              </div>
            </div>
            <div className="border border-border bg-background px-3 py-3">
              <p className="text-[12px] font-mono uppercase tracking-[0.12em] text-muted-foreground">Image</p>
              <p className="mt-2 text-[14px] text-muted-foreground">
                Foto operational dibuka dari detail Master Panel existing.
              </p>
              <div className="mt-3 flex gap-2">
                <Link
                  href={buildPanelDetailHref(unitId, selectedPart.id)}
                  className="inline-flex items-center gap-1.5 border border-primary/30 bg-primary/[0.04] px-3 py-1.5 text-[13px] font-mono uppercase tracking-[0.08em] text-app-accent-ink hover:bg-primary/10"
                >
                  <Eye className="h-3.5 w-3.5" strokeWidth={ICON_STROKE_WIDTH} /> View Detail
                </Link>
                <Link
                  href={buildPanelDetailHref(unitId, selectedPart.id)}
                  className="inline-flex items-center gap-1.5 border border-border px-3 py-1.5 text-[13px] font-mono uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground"
                >
                  <ImageIcon className="h-3.5 w-3.5" strokeWidth={ICON_STROKE_WIDTH} /> View Image
                </Link>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
