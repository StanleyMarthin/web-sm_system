"use client";

import type { UnitPanelRecord } from "@smsystem/contracts/unit-panel";
import type { ColDef } from "ag-grid-community";
import { AllCommunityModule, ModuleRegistry } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { ChevronDown, ChevronRight, Image as ImageIcon, Plus, RefreshCw, Search, X } from "lucide-react";
import Link from "next/link";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createUnitAdditionalMasterPanel } from "@/shared/api/unit-catalog";
import { fetchUnitPanels } from "@/shared/api/units";

const ICON_STROKE_WIDTH = 2.5;

ModuleRegistry.registerModules([AllCommunityModule]);

function displayCategory(value: string | null | undefined): string {
  return value?.trim() || "Lainnya";
}

interface MasterPanelManagerProps {
  unitId: string;
  canManage: boolean;
  initialRows?: UnitPanelRecord[];
}

interface AdditionalFormState {
  componentName: string;
  panelName: string;
  itemName: string;
  partNumber: string;
  deskription: string;
}

const EMPTY_ADDITIONAL_FORM: AdditionalFormState = {
  componentName: "",
  panelName: "",
  itemName: "",
  partNumber: "",
  deskription: "",
};

const CONDITION_LABEL: Record<UnitPanelRecord["defaultConditionType"], string> = {
  BARU: "Baru",
  BEKAS: "Bekas",
  RESTORE: "Restore",
};

function buildPanelDetailHref(unitId: string, recordId: number): string {
  return `/units/${unitId}/panels/panel-${recordId}`;
}

function displaySource(record: UnitPanelRecord): string {
  return record.sourcePart ?? "-";
}

function displayText(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

function displayCondition(record: UnitPanelRecord): string {
  return record.initialCondition ?? CONDITION_LABEL[record.defaultConditionType] ?? "-";
}

function displayCurrentStatus(record: UnitPanelRecord): string {
  return record.currentStatus ?? displayPanelStatus(record);
}

function displayPanelStatus(record: UnitPanelRecord): string {
  if (!record.isActive) return "Nonaktif";
  if (record.statusUsageCount > 0 || record.countdownUsageCount > 0) return "Operational";
  return "Siap";
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function progressFromHours(totalHours: number, remainingHours: number): number {
  if (totalHours <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round(((totalHours - remainingHours) / totalHours) * 100)));
}

function sumBy<T>(items: T[], read: (item: T) => number | null | undefined): number {
  return items.reduce((total, item) => total + Number(read(item) ?? 0), 0);
}

function flattenPanelRecords(records: UnitPanelRecord[]): UnitPanelRecord[] {
  return records.flatMap((record) => [record, ...flattenPanelRecords(record.children)]);
}

function conditionSummary(records: UnitPanelRecord[]): string {
  if (records.length === 0) return "-";
  const counts = records.reduce<Record<string, number>>((acc, item) => {
    const label = CONDITION_LABEL[item.defaultConditionType];
    acc[label] = (acc[label] ?? 0) + 1;
    return acc;
  }, {});

  return Object.entries(counts)
    .map(([label, count]) => `${label} ${count}`)
    .join(" · ");
}

interface MasterPanelPanelGroup {
  key: string;
  componentName: string;
  panelName: string;
  parts: UnitPanelRecord[];
  totalPart: number;
  conditionSummary: string;
  status: string;
  totalJobdesc: number;
  totalHours: number;
  remainingHours: number;
  progress: number;
}

interface MasterPanelComponentGroup {
  key: string;
  componentName: string;
  panels: MasterPanelPanelGroup[];
  totalPanel: number;
  totalPart: number;
  totalHours: number;
  remainingHours: number;
  progress: number;
}

function buildMasterPanelHierarchy(records: UnitPanelRecord[]): MasterPanelComponentGroup[] {
  const componentMap = new Map<string, Map<string, UnitPanelRecord[]>>();

  for (const record of records) {
    const componentName = displayCategory(record.category);
    const panelName = record.section.trim() || "Tanpa Panel";
    const panelMap = componentMap.get(componentName) ?? new Map<string, UnitPanelRecord[]>();
    const parts = panelMap.get(panelName) ?? [];
    parts.push(record);
    panelMap.set(panelName, parts);
    componentMap.set(componentName, panelMap);
  }

  return Array.from(componentMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([componentName, panelMap]) => {
      const panels = Array.from(panelMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([panelName, parts]) => {
          const totalHours = sumBy(parts, part => part.totalHours);
          const remainingHours = sumBy(parts, part => part.remainingHours);
          return {
            key: `${componentName}\u0000${panelName}`,
            componentName,
            panelName,
            parts,
            totalPart: parts.length,
            conditionSummary: conditionSummary(parts),
            status: parts.some((part) => displayPanelStatus(part) === "Operational") ? "Operational" : "Siap",
            totalJobdesc: sumBy(parts, part => part.totalJobdesc),
            totalHours,
            remainingHours,
            progress: progressFromHours(totalHours, remainingHours),
          };
        });
      const totalHours = sumBy(panels, panel => panel.totalHours);
      const remainingHours = sumBy(panels, panel => panel.remainingHours);
      return {
        key: componentName,
        componentName,
        panels,
        totalPanel: panels.length,
        totalPart: panels.reduce((total, panel) => total + panel.totalPart, 0),
        totalHours,
        remainingHours,
        progress: progressFromHours(totalHours, remainingHours),
      };
    });
}

function matchesPart(part: UnitPanelRecord, term: string): boolean {
  return (
    part.name.toLowerCase().includes(term) ||
    (part.partNumber ?? "").toLowerCase().includes(term) ||
    (part.code ?? "").toLowerCase().includes(term) ||
    displaySource(part).toLowerCase().includes(term)
  );
}

export function MasterPanelManager({ unitId, canManage, initialRows }: MasterPanelManagerProps) {
  const [rows, setRows] = useState<UnitPanelRecord[]>(() => initialRows ?? []);
  const [isLoading, setIsLoading] = useState(() => initialRows === undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [search, setSearch] = useState<string>("");
  const [expandedComponentKey, setExpandedComponentKey] = useState<string | null>(null);
  const [expandedPanelKey, setExpandedPanelKey] = useState<string | null>(null);
  const [selectedPart, setSelectedPart] = useState<UnitPanelRecord | null>(null);
  const [isAddingAdditional, setIsAddingAdditional] = useState(false);
  const [additionalForm, setAdditionalForm] = useState<AdditionalFormState>(EMPTY_ADDITIONAL_FORM);
  const flatRows = useMemo(() => flattenPanelRecords(rows), [rows]);
  const hierarchy = useMemo(() => buildMasterPanelHierarchy(flatRows), [flatRows]);
  const searchTerm = search.trim().toLowerCase();

  const rootCount = hierarchy.reduce((total, component) => total + component.totalPanel, 0);
  const partCount = flatRows.length;
  const expandedComponent = useMemo(
    () => hierarchy.find(component => component.key === expandedComponentKey) ?? null,
    [hierarchy, expandedComponentKey],
  );
  const expandedPanel = useMemo(
    () => expandedComponent?.panels.find(panel => panel.key === expandedPanelKey) ?? null,
    [expandedComponent, expandedPanelKey],
  );
  const filteredComponents = useMemo(() => {
    if (!searchTerm) return hierarchy;
    return hierarchy.filter(component =>
      component.componentName.toLowerCase().includes(searchTerm) ||
      component.panels.some(panel =>
        panel.panelName.toLowerCase().includes(searchTerm) ||
        panel.parts.some(part => matchesPart(part, searchTerm))
      )
    );
  }, [hierarchy, searchTerm]);
  const filteredPanels = useMemo(() => {
    if (!expandedComponent) return [];
    if (!searchTerm) return expandedComponent.panels;
    return expandedComponent.panels.filter(panel =>
      panel.panelName.toLowerCase().includes(searchTerm) ||
      panel.parts.some(part => matchesPart(part, searchTerm))
    );
  }, [searchTerm, expandedComponent]);
  const filteredParts = useMemo(() => {
    if (!expandedPanel) return [];
    if (!searchTerm) return expandedPanel.parts;
    return expandedPanel.parts.filter(part => matchesPart(part, searchTerm));
  }, [searchTerm, expandedPanel]);
  const toggleComponent = useCallback((component: MasterPanelComponentGroup) => {
    setExpandedComponentKey((current) => current === component.key ? null : component.key);
    setExpandedPanelKey(null);
  }, []);
  const togglePanel = useCallback((panel: MasterPanelPanelGroup) => {
    setExpandedPanelKey((current) => current === panel.key ? null : panel.key);
  }, []);
  const componentColumnDefs = useMemo<ColDef<MasterPanelComponentGroup>[]>(() => [
    {
      headerName: "Component",
      field: "componentName",
      minWidth: 240,
      flex: 1.7,
      cellRenderer: ({ data }: { data?: MasterPanelComponentGroup }) => (
        <button
          type="button"
          className="text-left font-semibold text-foreground hover:text-app-accent-ink"
          onClick={(event) => {
            event.stopPropagation();
            if (data) toggleComponent(data);
          }}
        >
          {data?.componentName ?? "-"}
        </button>
      ),
    },
    { headerName: "Total Panel", field: "totalPanel", width: 140, cellClass: "font-mono text-muted-foreground" },
    { headerName: "Total Part", field: "totalPart", width: 140, cellClass: "font-mono text-muted-foreground" },
    {
      headerName: "Progress",
      field: "progress",
      width: 150,
      cellRenderer: ({ data }: { data?: MasterPanelComponentGroup }) => data ? (
        <div className="flex h-full items-center gap-2">
          <div className="h-1.5 flex-1 bg-muted">
            <div className="h-full bg-primary" style={{ width: `${data.progress}%` }} />
          </div>
          <span className="w-10 text-right font-mono text-[12px] text-muted-foreground">{data.progress}%</span>
        </div>
      ) : null,
    },
    {
      headerName: "Expand",
      width: 90,
      sortable: false,
      filter: false,
      cellRenderer: ({ data }: { data?: MasterPanelComponentGroup }) => data ? (
        <button
          type="button"
          className="catalog-icon-button"
          title="Buka panel"
          onClick={(event) => {
            event.stopPropagation();
            toggleComponent(data);
          }}
        >
          {expandedComponentKey === data.key
            ? <ChevronDown className="h-3.5 w-3.5" strokeWidth={ICON_STROKE_WIDTH} />
            : <ChevronRight className="h-3.5 w-3.5" strokeWidth={ICON_STROKE_WIDTH} />}
        </button>
      ) : null,
    },
  ], [expandedComponentKey, toggleComponent]);
  const panelColumnDefs = useMemo<ColDef<MasterPanelPanelGroup>[]>(() => [
    {
      headerName: "Panel Name",
      field: "panelName",
      minWidth: 220,
      flex: 1.4,
      cellRenderer: ({ data }: { data?: MasterPanelPanelGroup }) => (
        <button
          type="button"
          className="text-left font-medium text-foreground hover:text-app-accent-ink"
          onClick={(event) => {
            event.stopPropagation();
            if (data) togglePanel(data);
          }}
        >
          {data?.panelName ?? "-"}
        </button>
      ),
    },
    {
      headerName: "Total Part",
      field: "totalPart",
      width: 120,
      cellClass: "font-mono text-muted-foreground",
    },
    {
      headerName: "Progress %",
      field: "progress",
      width: 130,
      cellRenderer: ({ data }: { data?: MasterPanelPanelGroup }) => data ? (
        <div className="flex h-full items-center gap-2">
          <div className="h-1.5 flex-1 bg-muted">
            <div className="h-full bg-primary" style={{ width: `${data.progress}%` }} />
          </div>
          <span className="w-10 text-right font-mono text-[12px] text-muted-foreground">{data.progress}%</span>
        </div>
      ) : null,
    },
    { headerName: "Total Jobdesc", field: "totalJobdesc", width: 135, cellClass: "font-mono text-muted-foreground" },
    {
      headerName: "Total Hours",
      field: "totalHours",
      width: 125,
      cellClass: "font-mono text-muted-foreground",
      valueFormatter: ({ value }) => `${formatNumber(Number(value ?? 0))}j`,
    },
    {
      headerName: "Remaining Hours",
      field: "remainingHours",
      width: 150,
      cellClass: "font-mono text-muted-foreground",
      valueFormatter: ({ value }) => `${formatNumber(Number(value ?? 0))}j`,
    },
    {
      headerName: "Expand",
      width: 90,
      sortable: false,
      filter: false,
      cellRenderer: ({ data }: { data?: MasterPanelPanelGroup }) => data ? (
        <button
          type="button"
          className="catalog-icon-button"
          title="Buka part"
          onClick={(event) => {
            event.stopPropagation();
            togglePanel(data);
          }}
        >
          {expandedPanelKey === data.key
            ? <ChevronDown className="h-3.5 w-3.5" strokeWidth={ICON_STROKE_WIDTH} />
            : <ChevronRight className="h-3.5 w-3.5" strokeWidth={ICON_STROKE_WIDTH} />}
        </button>
      ) : null,
    },
  ], [expandedPanelKey, togglePanel]);
  const partColumnDefs = useMemo<ColDef<UnitPanelRecord>[]>(() => [
    { headerName: "Code", field: "code", width: 110, valueGetter: ({ data }) => data?.code ?? "-" },
    { headerName: "Alias Name", field: "aliasName", minWidth: 150, flex: 0.8, valueGetter: ({ data }) => data?.aliasName ?? "-" },
    {
      headerName: "Name Part",
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
    {
      headerName: "Part Number",
      field: "partNumber",
      minWidth: 160,
      flex: 0.9,
      valueGetter: ({ data }) => data?.partNumber ?? "-",
    },
    {
      headerName: "Qty",
      field: "qty",
      width: 90,
      cellClass: "font-mono text-muted-foreground",
      valueFormatter: ({ value }) => formatNumber(Number(value ?? 0)),
    },
    {
      headerName: "Condition",
      valueGetter: ({ data }) => data ? displayCondition(data) : "-",
      minWidth: 130,
      flex: 0.8,
    },
    {
      headerName: "Current Status",
      valueGetter: ({ data }) => data ? displayCurrentStatus(data) : "-",
      minWidth: 140,
      flex: 0.8,
    },
  ], []);

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

  function openAdditionalForm() {
    setAdditionalForm({
      componentName: expandedPanel?.componentName ?? expandedComponent?.componentName ?? "",
      panelName: expandedPanel?.panelName ?? "",
      itemName: "",
      partNumber: "",
      deskription: "",
    });
    setMessage(null);
    setError(null);
    setIsAddingAdditional(true);
  }

  async function handleAdditionalSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage) {
      return;
    }

    const payload = {
      componentName: additionalForm.componentName.trim(),
      panelName: additionalForm.panelName.trim(),
      itemName: additionalForm.itemName.trim(),
      partNumber: additionalForm.partNumber.trim() || null,
      deskription: additionalForm.deskription.trim() || null,
    };

    if (!payload.componentName || !payload.panelName || !payload.itemName) {
      setError("Component, panel, dan item wajib diisi.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setMessage(null);
    const result = await createUnitAdditionalMasterPanel(unitId, payload);
    if (!result.success) {
      setError(result.message);
      setIsSubmitting(false);
      return;
    }

    setMessage("Item tambahan berhasil masuk Master Panel.");
    setIsAddingAdditional(false);
    setAdditionalForm(EMPTY_ADDITIONAL_FORM);
    await loadPanels();
    setIsSubmitting(false);
  }

  return (
    <section className="border border-border bg-card">

      {/* ── HEADER ── */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <div>
          <p className="text-[14px] font-mono uppercase tracking-[0.12em] text-muted-foreground">Master Panel</p>
          <h3 className="text-[15px] font-mono text-foreground">Component · Panel · Part</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[14px] text-muted-foreground">{rootCount} panel · {partCount} part</span>
          <div className="w-px h-4 bg-muted" />
          <button type="button" onClick={() => void loadPanels()}
            className="inline-flex items-center gap-1.5 border border-border px-2 py-1 text-[14px] font-mono uppercase text-foreground hover:text-foreground hover:border-border transition-colors">
            <RefreshCw className="h-3 w-3" strokeWidth={ICON_STROKE_WIDTH} /> Refresh
          </button>
          {canManage && (
            <button type="button" onClick={openAdditionalForm}
              className="inline-flex items-center gap-1.5 border border-primary/30 bg-primary/[0.04] px-2 py-1 text-[14px] font-mono uppercase text-app-accent-ink hover:bg-primary/10 transition-colors">
              <Plus className="h-3 w-3" strokeWidth={ICON_STROKE_WIDTH} /> Tambah Panel / Item Tambahan
            </button>
          )}
        </div>
      </div>

      <div className="border-b border-border bg-background">
        <div className="flex items-center gap-3 px-4 py-2">
          <div className="flex flex-1 items-center gap-2 border border-border bg-card px-3">
            <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={ICON_STROKE_WIDTH} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari component, panel, atau part..."
              className="h-8 w-full bg-transparent text-[15px] font-mono text-foreground outline-none placeholder:text-muted-foreground"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="text-[14px] font-mono text-muted-foreground transition-colors hover:text-foreground">
                x
              </button>
            )}
          </div>
          <div className="hidden shrink-0 text-[13px] font-mono uppercase tracking-[0.1em] text-muted-foreground lg:block">
            Expand component lalu panel
          </div>
        </div>
      </div>

      <div className="min-h-[300px]">

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
          ) : filteredComponents.length === 0 ? (
            <div className="m-4 border border-dashed border-border px-4 py-8 text-center text-[15px] font-mono text-muted-foreground">
              {search ? `Tidak ada hasil untuk "${search}"` : "Belum ada Master Panel."}
            </div>
          ) : (
            <div className="space-y-4 p-4">
              <div className="ag-theme-alpine sms-ag-grid h-[18rem] w-full border border-border">
                <AgGridReact<MasterPanelComponentGroup>
                  rowData={filteredComponents}
                  columnDefs={componentColumnDefs}
                  defaultColDef={{
                    sortable: true,
                    resizable: true,
                    filter: true,
                    suppressHeaderMenuButton: true,
                  }}
                  getRowId={({ data }) => data.key}
                  rowHeight={46}
                  suppressCellFocus={false}
                  suppressMovableColumns
                  onRowClicked={({ data }) => data && toggleComponent(data)}
                  overlayNoRowsTemplate="<span class='text-muted-foreground'>Belum ada component master panel.</span>"
                />
              </div>

              {expandedComponent ? (
                <div className="border border-border bg-background">
                  <div className="flex items-start justify-between gap-4 border-b border-border px-4 py-3">
                    <div>
                      <p className="text-[13px] font-mono uppercase tracking-[0.12em] text-muted-foreground">Panel</p>
                      <h4 className="mt-1 text-[18px] font-semibold text-foreground">{expandedComponent.componentName}</h4>
                      <p className="mt-1 text-[14px] text-muted-foreground">{expandedComponent.totalPanel} panel · {expandedComponent.totalPart} part</p>
                    </div>
                    {canManage ? (
                      <button
                        type="button"
                        onClick={openAdditionalForm}
                        className="inline-flex items-center gap-1.5 border border-primary/30 bg-primary/[0.04] px-2 py-1 text-[14px] font-mono uppercase text-app-accent-ink hover:bg-primary/10"
                      >
                        <Plus className="h-3 w-3" strokeWidth={ICON_STROKE_WIDTH} /> Tambah Panel Baru
                      </button>
                    ) : null}
                  </div>
                  <div className="ag-theme-alpine sms-ag-grid h-[16rem] w-full">
                    <AgGridReact<MasterPanelPanelGroup>
                      rowData={filteredPanels}
                      columnDefs={panelColumnDefs}
                      defaultColDef={{
                        sortable: true,
                        resizable: true,
                        filter: true,
                        suppressHeaderMenuButton: true,
                      }}
                      getRowId={({ data }) => data.key}
                      rowHeight={46}
                      suppressCellFocus={false}
                      suppressMovableColumns
                      onRowClicked={({ data }) => data && togglePanel(data)}
                      overlayNoRowsTemplate="<span class='text-muted-foreground'>Belum ada panel pada component ini.</span>"
                    />
                  </div>

                  {expandedPanel ? (
                    <div className="border-t border-border bg-card">
                      <div className="flex items-start justify-between gap-4 border-b border-border px-4 py-3">
                        <div>
                          <p className="text-[13px] font-mono uppercase tracking-[0.12em] text-muted-foreground">Master Panel Parts</p>
                          <h4 className="mt-1 text-[18px] font-semibold text-foreground">{expandedPanel.panelName}</h4>
                          <p className="mt-1 text-[14px] text-muted-foreground">{expandedPanel.totalPart} part · {expandedPanel.totalJobdesc} jobdesc</p>
                        </div>
                        {canManage ? (
                          <button
                            type="button"
                            onClick={openAdditionalForm}
                            className="inline-flex items-center gap-1.5 border border-primary/30 bg-primary/[0.04] px-2 py-1 text-[14px] font-mono uppercase text-app-accent-ink hover:bg-primary/10"
                          >
                            <Plus className="h-3 w-3" strokeWidth={ICON_STROKE_WIDTH} /> Tambah Item
                          </button>
                        ) : null}
                      </div>
                      <div className="ag-theme-alpine sms-ag-grid h-[24rem] w-full">
                        <AgGridReact<UnitPanelRecord>
                          rowData={filteredParts}
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
                          onRowClicked={({ data }) => data && setSelectedPart(data)}
                          overlayNoRowsTemplate="<span class='text-muted-foreground'>Belum ada part pada panel ini.</span>"
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}
        </div>

      </div>
      {isAddingAdditional ? (
        <div className="fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l border-border bg-card shadow-2xl">
          <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
            <div>
              <p className="text-[13px] font-mono uppercase tracking-[0.12em] text-muted-foreground">Item Tambahan</p>
              <h4 className="mt-1 text-[18px] font-semibold text-foreground">Tambah Panel / Item Tambahan</h4>
            </div>
            <button type="button" onClick={() => setIsAddingAdditional(false)} className="catalog-icon-button" title="Tutup">
              <X className="h-3.5 w-3.5" strokeWidth={ICON_STROKE_WIDTH} />
            </button>
          </div>
          <form className="flex flex-1 flex-col" onSubmit={(event) => void handleAdditionalSubmit(event)}>
            <div className="flex-1 space-y-3 overflow-auto px-5 py-4">
              <label className="block space-y-1">
                <span className="text-[13px] font-mono uppercase tracking-[0.12em] text-muted-foreground">Component</span>
                <input
                  value={additionalForm.componentName}
                  onChange={(event) => setAdditionalForm((current) => ({ ...current, componentName: event.target.value }))}
                  className="h-9 w-full border border-border bg-background px-3 text-[14px] text-foreground outline-none focus:border-primary/45"
                  placeholder="Contoh: BODY"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[13px] font-mono uppercase tracking-[0.12em] text-muted-foreground">Panel Name</span>
                <input
                  value={additionalForm.panelName}
                  onChange={(event) => setAdditionalForm((current) => ({ ...current, panelName: event.target.value }))}
                  className="h-9 w-full border border-border bg-background px-3 text-[14px] text-foreground outline-none focus:border-primary/45"
                  placeholder="Contoh: FRONT BUMPER"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[13px] font-mono uppercase tracking-[0.12em] text-muted-foreground">Item / Part</span>
                <input
                  value={additionalForm.itemName}
                  onChange={(event) => setAdditionalForm((current) => ({ ...current, itemName: event.target.value }))}
                  className="h-9 w-full border border-border bg-background px-3 text-[14px] text-foreground outline-none focus:border-primary/45"
                  placeholder="Contoh: Bracket Foglamp Custom"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[13px] font-mono uppercase tracking-[0.12em] text-muted-foreground">Part Number</span>
                <input
                  value={additionalForm.partNumber}
                  onChange={(event) => setAdditionalForm((current) => ({ ...current, partNumber: event.target.value }))}
                  className="h-9 w-full border border-border bg-background px-3 text-[14px] text-foreground outline-none focus:border-primary/45"
                  placeholder="Optional"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[13px] font-mono uppercase tracking-[0.12em] text-muted-foreground">Catatan</span>
                <textarea
                  value={additionalForm.deskription}
                  onChange={(event) => setAdditionalForm((current) => ({ ...current, deskription: event.target.value }))}
                  className="min-h-24 w-full resize-y border border-border bg-background px-3 py-2 text-[14px] text-foreground outline-none focus:border-primary/45"
                  placeholder="Optional"
                />
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
              <button type="button" onClick={() => setIsAddingAdditional(false)} className="border border-border px-3 py-1.5 text-[13px] font-mono uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground">
                Batal
              </button>
              <button type="submit" disabled={isSubmitting} className="border border-primary/40 bg-primary/[0.06] px-3 py-1.5 text-[13px] font-mono uppercase tracking-[0.08em] text-app-accent-ink transition-colors hover:bg-primary/10 disabled:opacity-30">
                {isSubmitting ? "Menyimpan..." : "Simpan Data"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
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
              <div className="col-span-2 border border-border bg-background px-3 py-2">
                <p className="text-[12px] font-mono uppercase tracking-[0.12em] text-muted-foreground">Name Part</p>
                <p className="mt-1 text-[14px] text-foreground">{displayText(selectedPart.name)}</p>
              </div>
              <div className="border border-border bg-background px-3 py-2">
                <p className="text-[12px] font-mono uppercase tracking-[0.12em] text-muted-foreground">Part Number</p>
                <p className="mt-1 text-[14px] text-foreground">{displayText(selectedPart.partNumber)}</p>
              </div>
              <div className="border border-border bg-background px-3 py-2">
                <p className="text-[12px] font-mono uppercase tracking-[0.12em] text-muted-foreground">Source Part</p>
                <p className="mt-1 text-[14px] text-foreground">{displaySource(selectedPart)}</p>
              </div>
              <div className="border border-border bg-background px-3 py-2">
                <p className="text-[12px] font-mono uppercase tracking-[0.12em] text-muted-foreground">Initial Condition</p>
                <p className="mt-1 text-[14px] text-foreground">{displayCondition(selectedPart)}</p>
              </div>
              <div className="border border-border bg-background px-3 py-2">
                <p className="text-[12px] font-mono uppercase tracking-[0.12em] text-muted-foreground">Current Status</p>
                <p className="mt-1 text-[14px] text-foreground">{displayCurrentStatus(selectedPart)}</p>
              </div>
              <div className="border border-border bg-background px-3 py-2">
                <p className="text-[12px] font-mono uppercase tracking-[0.12em] text-muted-foreground">Qty</p>
                <p className="mt-1 text-[14px] text-foreground">{formatNumber(selectedPart.qty)}</p>
              </div>
              <div className="border border-border bg-background px-3 py-2">
                <p className="text-[12px] font-mono uppercase tracking-[0.12em] text-muted-foreground">Location</p>
                <p className="mt-1 text-[14px] text-foreground">{displayText(selectedPart.location ?? selectedPart.defaultLocationType)}</p>
              </div>
              <div className="border border-border bg-background px-3 py-2">
                <p className="text-[12px] font-mono uppercase tracking-[0.12em] text-muted-foreground">Created At</p>
                <p className="mt-1 text-[14px] text-foreground">{displayText(selectedPart.createdAt)}</p>
              </div>
              <div className="border border-border bg-background px-3 py-2">
                <p className="text-[12px] font-mono uppercase tracking-[0.12em] text-muted-foreground">Updated At</p>
                <p className="mt-1 text-[14px] text-foreground">{displayText(selectedPart.updatedAt)}</p>
              </div>
              <div className="col-span-2 border border-border bg-background px-3 py-2">
                <p className="text-[12px] font-mono uppercase tracking-[0.12em] text-muted-foreground">Notes</p>
                <p className="mt-1 whitespace-pre-wrap text-[14px] text-foreground">{displayText(selectedPart.notes)}</p>
              </div>
            </div>
            <div className="border border-border bg-background px-3 py-3">
              <p className="text-[12px] font-mono uppercase tracking-[0.12em] text-muted-foreground">Master Panel Image</p>
              <p className="mt-2 text-[14px] text-muted-foreground">
                Foto operational dibuka dari detail Master Panel existing.
              </p>
              <div className="mt-3 flex gap-2">
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
