"use client";

import type {
  QaGridQuery,
  QaInspectionRecord,
  QaReferences,
  QaUpdateInspectionRequest,
} from "@smsystem/contracts/qa";
import type { ColDef, ICellRendererParams, RowClickedEvent } from "ag-grid-community";
import { CheckCircle2, ClipboardList, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SmsAgGrid } from "@/shared/datagrid/sms-ag-grid";
import { DataGridStatusBadge } from "@/shared/datagrid/status-badge";
import { SearchableSelect } from "@/shared/ui/compact";
import { useDataGridState } from "@/shared/datagrid/use-data-grid-state";
import { updateQaInspection } from "@/shared/api/qa/qa";
import { QaInspectionForm } from "./forms/qa-inspection-form";

const GRID_SCROLL_LIMIT = 100;
type QaHistoryRow = QaInspectionRecord & {
  historyKey: string;
  inspections: QaInspectionRecord[];
};

interface QaWorkspaceShellProps {
  rows: QaInspectionRecord[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  state: QaGridQuery;
  references: QaReferences;
  canEdit: boolean;
}

function StatusCell({ value }: ICellRendererParams<QaHistoryRow>) {
  return <DataGridStatusBadge value={value ? String(value) : "-"} />;
}

function textValue(value: unknown) {
  return value === null || value === undefined || value === "" ? "-" : String(value);
}

function timeOnly(value: string | null | undefined) {
  if (!value) return "-";
  const match = value.match(/\b(\d{2}:\d{2})/u);
  return match?.[1] ?? value;
}

function qcLevelLabel(value: QaInspectionRecord["qcLevel"]) {
  if (value === "QC_KD") return "QC KD";
  if (value === "QC_QA") return "QC QA";
  if (value === "QC_ADVISOR") return "QC Advisor";
  return value ? value.replace("_", " ") : "QC";
}

function compareInspection(a: QaInspectionRecord, b: QaInspectionRecord) {
  return b.inspectionDate.localeCompare(a.inspectionDate);
}

function groupByJobdesc(rows: QaInspectionRecord[]): QaHistoryRow[] {
  const groups = new Map<string, QaInspectionRecord[]>();

  for (const row of rows) {
    const key = row.coreId || row.qcId;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  return Array.from(groups.entries()).map(([historyKey, inspections]) => {
    const sorted = [...inspections].sort(compareInspection);
    return { ...sorted[0]!, historyKey, inspections: sorted };
  });
}

function QcHistoryCell({ data }: ICellRendererParams<QaHistoryRow>) {
  if (!data) return "-";

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5 py-1">
      {data.inspections.map((inspection) => (
        <span
          key={inspection.qcId}
          className={[
            "inline-flex items-center border px-2 py-1 text-[11px] font-semibold",
            inspection.resultStatus === "LOLOS"
              ? "border-success/25 bg-success/10 text-success"
              : "border-destructive/35 bg-destructive/10 text-destructive",
          ].join(" ")}
        >
          {qcLevelLabel(inspection.qcLevel)} · {inspection.resultStatus === "LOLOS" ? "Lolos" : "Tidak lolos"}
        </span>
      ))}
    </div>
  );
}

function filterValue(state: QaGridQuery, field: string) {
  return state.filters.find((filter) => filter.field === field)?.value ?? "";
}

export function QaWorkspaceShell({
  rows,
  meta,
  state,
  references,
  canEdit,
}: QaWorkspaceShellProps) {
  const router = useRouter();
  const gridState = useDataGridState(state);
  const [selectedHistoryKey, setSelectedHistoryKey] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [quickFilter, setQuickFilter] = useState("");

  const groupedRows = useMemo(() => groupByJobdesc(rows), [rows]);
  const selectedInspection = useMemo(
    () => groupedRows.find((row) => row.historyKey === selectedHistoryKey) ?? null,
    [groupedRows, selectedHistoryKey],
  );

  useEffect(() => {
    setMessage(null);
    setError(null);
  }, [selectedHistoryKey, selectedInspection]);

  useEffect(() => {
    if (state.limit !== GRID_SCROLL_LIMIT) {
      gridState.setLimit(GRID_SCROLL_LIMIT);
    }
  }, [state.limit]);

  const columns = useMemo<ColDef<QaHistoryRow>[]>(
    () => [
      { field: "unitName", headerName: "Unit", pinned: "left", minWidth: 190 },
      { field: "divisionName", headerName: "Divisi", valueFormatter: ({ value }) => textValue(value), width: 145 },
      { field: "panelName", headerName: "Panel", valueFormatter: ({ value }) => textValue(value), minWidth: 190 },
      { field: "jobName", headerName: "Jobdesc", minWidth: 210, flex: 1 },
      { colId: "qcHistory", headerName: "Riwayat QC", cellRenderer: QcHistoryCell, minWidth: 260 },
      {
        colId: "inspectionCount",
        headerName: "Pemeriksaan",
        width: 130,
        valueGetter: ({ data }) => data?.inspections.length ?? 0,
      },
      { field: "inspectionDate", headerName: "Terakhir", width: 120, valueFormatter: ({ value }) => timeOnly(value) },
      { field: "priorityLevel", headerName: "Prioritas", cellRenderer: StatusCell, width: 135 },
      { field: "followupStatus", headerName: "Follow-up", cellRenderer: StatusCell, width: 150 },
    ],
    [],
  );

  async function handleSave(data: QaUpdateInspectionRequest) {
    if (!selectedInspection) {
      return;
    }

    setIsSaving(true);
    setMessage(null);
    setError(null);

    try {
      const result = await updateQaInspection(selectedInspection.qcId, data);
      if (!result.success) {
        setError(result.message);
        return;
      }

      setMessage("Analisa QA berhasil disimpan.");
      router.refresh();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-[10px] border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
          <div>
            <p className="text-[14px] font-semibold text-foreground">Riwayat inspeksi</p>
            <p className="text-[12px] text-muted-foreground">
              {rows.length > 0
                ? `${groupedRows.length} jobdesc dari ${rows.length} pemeriksaan`
                : "0 dari 0 baris"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={quickFilter}
              onChange={(event) => setQuickFilter(event.target.value)}
              placeholder="Cari di halaman ini"
              className="h-9 w-56 border border-border bg-muted px-3 text-[13px] text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/55"
            />
            <SearchableSelect
              value={filterValue(state, "unitId")}
              onChange={(value) => gridState.setFilter("unitId", value)}
              options={references.units}
              placeholder="Unit"
              className="w-40"
            />
            <SearchableSelect
              value={filterValue(state, "resultStatus")}
              onChange={(value) => gridState.setFilter("resultStatus", value)}
              options={references.resultStatuses}
              placeholder="Status QC"
              className="w-36"
            />
            <SearchableSelect
              value={filterValue(state, "priorityLevel")}
              onChange={(value) => gridState.setFilter("priorityLevel", value)}
              options={references.priorityLevels}
              placeholder="Prioritas"
              className="w-36"
            />
            <SearchableSelect
              value={filterValue(state, "followupStatus")}
              onChange={(value) => gridState.setFilter("followupStatus", value)}
              options={references.followupStatuses}
              placeholder="Follow-up"
              className="w-36"
            />
            <SearchableSelect
              value={filterValue(state, "divisionId")}
              onChange={(value) => gridState.setFilter("divisionId", value)}
              options={references.divisions}
              placeholder="Divisi"
              className="w-36"
            />
            <button
              type="button"
              disabled={!meta.hasPrev || gridState.isPending}
              onClick={() => gridState.setPage(meta.page - 1)}
              className="h-9 border border-border px-3 text-[12px] text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
            >
              Sebelumnya
            </button>
            <button
              type="button"
              disabled={!meta.hasNext || gridState.isPending}
              onClick={() => gridState.setPage(meta.page + 1)}
              className="h-9 border border-primary/40 bg-primary/[0.08] px-3 text-[12px] font-semibold text-app-accent-ink hover:bg-primary/15 disabled:opacity-30"
            >
              Berikutnya
            </button>
          </div>
        </div>
        <SmsAgGrid<QaHistoryRow>
          heightClassName="h-[calc(100svh-280px)] min-h-[28rem]"
          rowData={groupedRows}
          columnDefs={columns}
          quickFilterText={quickFilter}
          onRowClicked={(event: RowClickedEvent<QaHistoryRow>) => {
            if (event.data?.historyKey) setSelectedHistoryKey(event.data.historyKey);
          }}
          emptyMessage="Belum ada riwayat QC pada filter ini."
        />
      </section>

      {selectedInspection ? (
        <div className="fixed inset-0 z-[80] bg-black/80">
          <div className="absolute inset-y-0 right-0 w-full max-w-2xl overflow-y-auto border-l border-white/[0.08] bg-popover shadow-2xl">
            <div className="sticky top-0 z-10 border-b border-white/[0.06] bg-popover/95 px-5 py-4 backdrop-blur">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.16em] text-app-accent-ink/80">Investigasi QA</p>
                  <h3 className="mt-1 text-lg font-semibold text-foreground">{selectedInspection.unitName}</h3>
                  <p className="mt-1 text-sm text-foreground/45">{selectedInspection.jobName}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedHistoryKey(null)}
                  className="rounded-full border border-white/[0.08] p-2 text-foreground/55 transition hover:text-foreground"
                >
                  <XCircle className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="space-y-6 px-5 py-5">
              <section className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
                <div className="mb-4 flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-app-accent-ink" />
                  <p className="text-sm font-semibold text-foreground">Riwayat QC jobdesc</p>
                </div>
                <div className="space-y-3">
                  {selectedInspection.inspections.map((inspection) => (
                    <div key={inspection.qcId} className="border border-white/[0.06] bg-black/15 p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">{qcLevelLabel(inspection.qcLevel)}</span>
                        <DataGridStatusBadge value={inspection.resultStatus === "LOLOS" ? "Lolos" : "Tidak lolos"} />
                        <span className="text-[12px] text-foreground/40">{timeOnly(inspection.inspectionDate)}</span>
                      </div>
                      <div className="mt-3 grid gap-3 text-sm text-foreground/70 md:grid-cols-3">
                        <div>
                          <p className="text-foreground/35">Pemeriksa</p>
                          <p className="mt-1 text-foreground">{inspection.inspectorName ?? "-"}</p>
                        </div>
                        <div>
                          <p className="text-foreground/35">Durasi</p>
                          <p className="mt-1 text-foreground">
                            {inspection.inspectionDurationMinutes == null ? "-" : `${inspection.inspectionDurationMinutes} menit`}
                          </p>
                        </div>
                        <div>
                          <p className="text-foreground/35">Foto</p>
                          <p className="mt-1 text-foreground">
                            {[inspection.photoBeforeUrl, inspection.evidencePhotoUrl].filter(Boolean).length} file
                          </p>
                        </div>
                        <div className="md:col-span-3">
                          <p className="text-foreground/35">Catatan QC</p>
                          <p className="mt-1 whitespace-pre-wrap break-words text-foreground">{inspection.qcNotes ?? "-"}</p>
                        </div>
                        {[inspection.photoBeforeUrl, inspection.evidencePhotoUrl].some(Boolean) ? (
                          <div className="flex flex-wrap gap-2 md:col-span-3">
                            {inspection.photoBeforeUrl ? (
                              <a
                                href={inspection.photoBeforeUrl}
                                target="_blank"
                                rel="noreferrer"
                                download
                                className="border border-white/[0.08] px-3 py-1.5 text-[12px] text-foreground/70 hover:text-foreground"
                              >
                                Foto sebelum
                              </a>
                            ) : null}
                            {inspection.evidencePhotoUrl ? (
                              <a
                                href={inspection.evidencePhotoUrl}
                                target="_blank"
                                rel="noreferrer"
                                download
                                className="border border-white/[0.08] px-3 py-1.5 text-[12px] text-foreground/70 hover:text-foreground"
                              >
                                Foto bukti
                              </a>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                  </div>
              </section>

              {selectedInspection.resultStatus !== "LOLOS" && (
                <section className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
                  <div className="mb-4 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <p className="text-sm font-semibold text-foreground">QA enrichment form</p>
                </div>

                <QaInspectionForm
                  initialValues={selectedInspection}
                  references={references}
                  canEdit={canEdit}
                  isPending={isSaving}
                  onSubmit={(data) => {
                    void handleSave(data);
                  }}
                />

                {message ? <p className="mt-4 text-sm text-success">{message}</p> : null}
                {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
                </section>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
