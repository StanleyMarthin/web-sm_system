"use client";

import Image from "next/image";
import type {
  QaGridQuery,
  QaInspectionRecord,
  QaIssueArea,
  QaIssueType,
  QaFollowupStatus,
  QaPriorityLevel,
  QaReferences,
  QaUpdateInspectionRequest,
} from "@smsystem/contracts/qa";
import { CheckCircle2, ClipboardList, Image as ImageIcon, RefreshCcw, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SmartDataGrid } from "@/shared/datagrid/smart-data-grid";
import type {
  SmartDataGridColumn,
  SmartDataGridFilterDefinition,
  SmartDataGridSortOption,
} from "@/shared/datagrid/types";
import { updateQaInspection } from "@/shared/api/qa";
import { QaInspectionForm } from "./forms/qa-inspection-form";

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

const inputCls =
  "h-10 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-foreground outline-none transition-colors focus:border-primary/30 [color-scheme:dark]";



function StatusBadge({
  children,
  tone,
}: {
  children: string;
  tone: "good" | "bad" | "warn" | "neutral";
}) {
  const className =
    tone === "good"
      ? "bg-success/10 text-success ring-success/20"
      : tone === "bad"
        ? "bg-destructive/10 text-destructive ring-destructive/20"
        : tone === "warn"
          ? "bg-primary/10 text-app-accent-ink ring-primary/20"
          : "bg-white/[0.04] text-foreground/65 ring-white/[0.08]";
  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ${className}`}>{children}</span>;
}

export function QaWorkspaceShell({
  rows,
  meta,
  state,
  references,
  canEdit,
}: QaWorkspaceShellProps) {
  const router = useRouter();
  const [selectedInspectionId, setSelectedInspectionId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedInspection = useMemo(
    () => rows.find((row) => row.qcId === selectedInspectionId) ?? null,
    [rows, selectedInspectionId],
  );

  useEffect(() => {
    setMessage(null);
    setError(null);
  }, [selectedInspectionId, selectedInspection]);

  const filters: SmartDataGridFilterDefinition[] = [
    { field: "unitId", label: "Unit", options: references.units },
    { field: "divisionId", label: "Divisi", options: references.divisions },
    { field: "resultStatus", label: "Status QC", options: references.resultStatuses },
    { field: "priorityLevel", label: "Prioritas", options: references.priorityLevels },
    { field: "followupStatus", label: "Follow-up", options: references.followupStatuses },
    { field: "issueArea", label: "Area", options: references.issueAreas },
  ];

  const sortOptions: SmartDataGridSortOption[] = [
    { label: "Tanggal", value: "inspectionDate" },
    { label: "Unit", value: "unitName" },
    { label: "Divisi", value: "divisionName" },
    { label: "Jobdesc", value: "jobName" },
    { label: "Status QC", value: "resultStatus" },
    { label: "Prioritas", value: "priorityLevel" },
    { label: "Follow-up", value: "followupStatus" },
  ];

  const columns: SmartDataGridColumn[] = [
    { key: "inspectionDate", label: "Tanggal", kind: "mono", sticky: true },
    { key: "unitName", label: "Unit", filterKey: "unitId", filterOptions: references.units },
    { key: "divisionName", label: "Divisi", filterKey: "divisionId", filterOptions: references.divisions },
    { key: "jobName", label: "Jobdesc" },
    {
      key: "resultStatus",
      label: "Status QC",
      filterKey: "resultStatus",
      filterOptions: references.resultStatuses,
      renderCell: (value) =>
        String(value) === "LOLOS" ? (
          <StatusBadge tone="good">Lolos</StatusBadge>
        ) : (
          <StatusBadge tone="bad">Tolak</StatusBadge>
        ),
    },
    {
      key: "priorityLevel",
      label: "Prioritas",
      filterKey: "priorityLevel",
      filterOptions: references.priorityLevels,
      renderCell: (value) => (
        <StatusBadge
          tone={String(value) === "HIGH" ? "bad" : String(value) === "MEDIUM" ? "warn" : "neutral"}
        >
          {String(value ?? "-")}
        </StatusBadge>
      ),
    },
    {
      key: "followupStatus",
      label: "Status Follow-Up",
      filterKey: "followupStatus",
      filterOptions: references.followupStatuses,
      renderCell: (value) => (
        <StatusBadge tone={String(value) === "CLOSED" ? "good" : "warn"}>{String(value ?? "-")}</StatusBadge>
      ),
    },
  ];

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


      <SmartDataGrid
        title="Riwayat inspeksi"
        description=""
        columns={columns}
        rows={rows as Array<Record<string, string | number | boolean | null>>}
        meta={meta}
        state={state}
        filters={filters}
        sortOptions={sortOptions}
        searchPlaceholder="Cari unit, divisi, jobdesc, atau inspector..."
        emptyMessage="Belum ada data inspeksi QA."
        viewportClassName="max-h-[calc(100svh-260px)]"
        onRowClick={(row) => setSelectedInspectionId(String(row.qcId ?? ""))}
        getRowAriaLabel={(row) => `Buka inspeksi QA ${String(row.unitName ?? "")}`}
      />

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
                  onClick={() => setSelectedInspectionId(null)}
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
                  <p className="text-sm font-semibold text-foreground">Data inspeksi mobile</p>
                </div>
                <div className="grid gap-3 text-sm text-foreground/70 md:grid-cols-2">
                  <div>
                    <p className="text-foreground/35">Inspektor</p>
                    <p className="mt-1 text-foreground">{selectedInspection.inspectorName ?? "-"}</p>
                  </div>
                  <div>
                    <p className="text-foreground/35">Status hasil</p>
                    <p className="mt-1 text-foreground">{selectedInspection.resultStatus}</p>
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-foreground/35">Catatan QC</p>
                    <p className="mt-1 whitespace-pre-wrap text-foreground">{selectedInspection.qcNotes ?? "-"}</p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {[selectedInspection.photoBeforeUrl, selectedInspection.evidencePhotoUrl].map((photoUrl, index) => (
                    <div
                      key={`${photoUrl ?? "empty"}-${index}`}
                      className="relative overflow-hidden rounded-xl border border-white/[0.06] bg-black/20"
                    >
                      {photoUrl ? (
                        <Image src={photoUrl} alt={index === 0 ? "Foto sebelum" : "Foto bukti"} fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover" />
                      ) : (
                        <div className="flex h-56 items-center justify-center text-foreground/25">
                          <ImageIcon className="h-6 w-6" />
                        </div>
                      )}
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
