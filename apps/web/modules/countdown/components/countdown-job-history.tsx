"use client";

import type { JobPlanV2ReadItem } from "@smsystem/contracts/job-plan-v2";
import { encodeGridFilterToken } from "@smsystem/contracts/grid";
import type { ColDef, ICellRendererParams, RowClickedEvent } from "ag-grid-community";
import { ChevronDown, Moon, Plus, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { humanizeCodeLabel } from "@/shared/format/humanize";
import { DataGridStatusBadge } from "@/shared/datagrid/status-badge";
import { SmsAgGrid } from "@/shared/datagrid/sms-ag-grid";
import { ActionButton } from "@/shared/ui/compact";

interface CountdownJobHistoryProps {
  carId: string;
  divisionId: number | null;
  divisionName: string | null;
  items: JobPlanV2ReadItem[];
  employeeNames: Record<string, string>;
  error: string | null;
  canCreate: boolean;
  jobPlanHref: (mode: "normal" | "overtime") => string;
}

type HistoryRow = JobPlanV2ReadItem;

const approvalLabels: Record<string, string> = {
  DRAFT: "Draft",
  DIVISION_REVIEW: "Review Divisi",
  UNIT_REVIEW: "Review Unit",
  MANAGEMENT_REVIEW: "Review Manajemen",
  APPROVED: "Disetujui",
  REJECTED: "Ditolak",
  CANCELLED: "Dibatalkan",
};

const executionLabels: Record<string, string> = {
  NOT_STARTED: "Belum Mulai",
  RUNNING: "Berjalan",
  HOLD: "Ditahan",
  FINISHED_PENDING_VALIDATION: "Menunggu Validasi",
  VALIDATED: "Tervalidasi",
};

export function fmtMinutes(value: number | null | undefined): string {
  const minutes = Number(value ?? 0);
  if (!Number.isFinite(minutes) || minutes <= 0) return "-";
  const hours = minutes / 60;
  const rounded = hours % 1 === 0 ? String(hours) : hours.toFixed(1);
  return `${rounded} Jam`;
}

function fmtClockMinutes(value: number): string {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function actualMinutes(row: HistoryRow): number {
  return Number(row.accumulated_work_minutes ?? 0) > 0
    ? Number(row.accumulated_work_minutes ?? 0)
    : Number(row.persisted_work_minutes ?? 0);
}

export function progressPercent(row: HistoryRow): number | null {
  const planned = Number(row.planned_work_minutes ?? 0);
  if (planned <= 0) return null;
  return Math.min(100, Math.round((actualMinutes(row) / planned) * 100));
}

function picLabel(row: HistoryRow, employeeNames: Record<string, string>): string {
  const employeeId = row.employee_id ?? "";
  return employeeId ? employeeNames[employeeId] ?? employeeId : "-";
}

function HistoryStatusBadges({ row }: { row: HistoryRow }) {
  if (row.legacy_status) {
    return <DataGridStatusBadge value={humanizeCodeLabel(row.legacy_status)} />;
  }

  return (
    <span className="inline-flex flex-wrap gap-1">
      <DataGridStatusBadge value={approvalLabels[row.approval_state] ?? row.approval_state} />
      <DataGridStatusBadge value={executionLabels[row.execution_state] ?? row.execution_state} />
    </span>
  );
}

function JobHistoryDetailDrawer({ row, onClose, carId, divisionId, employeeNames, divisionName }: {
  row: HistoryRow;
  onClose: () => void;
  carId: string;
  divisionId: number | null;
  divisionName: string | null;
  employeeNames: Record<string, string>;
}) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const monitoringParams = new URLSearchParams();
  monitoringParams.set("mode", "all");
  monitoringParams.append("filter", encodeGridFilterToken({ field: "carId", operator: "eq", value: carId }));
  if (divisionId !== null) {
    monitoringParams.append("filter", encodeGridFilterToken({ field: "divisionId", operator: "eq", value: String(divisionId) }));
  }

  return (
    <div className="fixed inset-0 z-[80] flex justify-end bg-black/65 backdrop-blur-[1px]" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside role="dialog" aria-modal="true" aria-labelledby="countdown-job-detail-title" className="flex h-full w-full max-w-xl flex-col border-l border-border bg-background shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Job Plan Detail</p>
            <h2 id="countdown-job-detail-title" className="mt-1 break-words text-[16px] font-semibold text-foreground">{row.jobdescription ?? "-"}</h2>
            <div className="mt-2"><HistoryStatusBadges row={row} /></div>
          </div>
          <button type="button" onClick={onClose} className="inline-flex h-9 w-9 shrink-0 items-center justify-center border border-border text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Tutup detail">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          <section className="border border-border bg-card">
            <p className="border-b border-border px-3 py-2 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Job Plan Detail</p>
            <dl className="grid gap-3 px-3 py-3 sm:grid-cols-2">
              <div className="min-w-0">
                <dt className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Job Description</dt>
                <dd className="mt-1 break-words text-[13px] text-foreground">{row.jobdescription ?? "-"}</dd>
              </div>
              <div className="min-w-0">
                <dt className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">PIC</dt>
                <dd className="mt-1 text-[13px] text-foreground">{picLabel(row, employeeNames)}</dd>
              </div>
              <div className="min-w-0">
                <dt className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Divisi</dt>
                <dd className="mt-1 text-[13px] text-foreground">{divisionName ?? "-"}</dd>
              </div>
              <div className="min-w-0">
                <dt className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Target</dt>
                <dd className="mt-1 text-[13px] text-foreground">{fmtMinutes(row.planned_work_minutes)}</dd>
              </div>
              <div className="min-w-0">
                <dt className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Status</dt>
                <dd className="mt-1"><HistoryStatusBadges row={row} /></dd>
              </div>
              <div className="min-w-0">
                <dt className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Tanggal Rencana</dt>
                <dd className="mt-1 text-[13px] text-foreground">{row.task_date}</dd>
              </div>
            </dl>
          </section>

          <section className="border border-border bg-card">
            <p className="border-b border-border px-3 py-2 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Actual Summary</p>
            <dl className="grid gap-3 px-3 py-3 sm:grid-cols-2">
              <div className="min-w-0">
                <dt className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Rencana Mulai</dt>
                <dd className="mt-1 text-[13px] text-foreground">{fmtClockMinutes(row.planned_start_minute)}</dd>
              </div>
              <div className="min-w-0">
                <dt className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Rencana Selesai</dt>
                <dd className="mt-1 text-[13px] text-foreground">{fmtClockMinutes(row.planned_finish_minute)}</dd>
              </div>
              <div className="min-w-0">
                <dt className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Aktual Jam Kerja</dt>
                <dd className="mt-1 text-[13px] text-foreground">{fmtMinutes(actualMinutes(row))}</dd>
              </div>
              <div className="min-w-0">
                <dt className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Status Eksekusi</dt>
                <dd className="mt-1 text-[13px] text-foreground">{executionLabels[row.execution_state] ?? row.execution_state}</dd>
              </div>
            </dl>
          </section>

          <div className="flex flex-wrap gap-2 border-t border-border pt-3">
            <Link href={`/monitoring?${monitoringParams.toString()}`} className="inline-flex h-9 items-center gap-1.5 border border-primary/35 px-3 font-mono text-[12px] font-medium uppercase tracking-[0.08em] text-app-accent-ink transition-colors hover:bg-primary/10">
              Lihat Job Actual
            </Link>
          </div>
        </div>
      </aside>
    </div>
  );
}

function CreateJobPlanMenu({ jobPlanHref }: { jobPlanHref: (mode: "normal" | "overtime") => string }) {
  return (
    <details className="group relative">
      <summary className="inline-flex h-9 cursor-pointer list-none items-center gap-1.5 border border-success/30 bg-success/10 px-3 font-mono text-[12px] font-medium uppercase tracking-[0.08em] text-success transition-colors hover:bg-success/20">
        <Plus className="h-3.5 w-3.5" />
        Buat Job Plan
        <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
      </summary>
      <div className="absolute right-0 z-20 mt-1 min-w-44 border border-border bg-card p-1 shadow-xl">
        <Link
          href={jobPlanHref("normal")}
          className="flex items-center gap-2 px-3 py-2 text-sm text-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
        >
          <Plus className="h-4 w-4 text-success" />
          Normal
        </Link>
        <Link
          href={jobPlanHref("overtime")}
          className="flex items-center gap-2 px-3 py-2 text-sm text-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
        >
          <Moon className="h-4 w-4 text-info" />
          Lembur
        </Link>
      </div>
    </details>
  );
}

function HistoryEmptyState({ canCreate, jobPlanHref }: { canCreate: boolean; jobPlanHref: (mode: "normal" | "overtime") => string }) {
  return (
    <div className="flex flex-col items-center gap-2 px-3 py-10 text-center">
      <p className="text-sm font-medium text-foreground">Belum ada pekerjaan untuk panel ini.</p>
      <p className="text-xs text-muted-foreground">Buat Job Plan pertama dari countdown ini.</p>
      {canCreate ? (
        <div className="mt-2">
          <CreateJobPlanMenu jobPlanHref={jobPlanHref} />
        </div>
      ) : null}
    </div>
  );
}

export function CountdownJobHistory({
  carId,
  divisionId,
  divisionName,
  items,
  employeeNames,
  error,
  canCreate,
  jobPlanHref,
}: CountdownJobHistoryProps) {
  const [selectedRow, setSelectedRow] = useState<HistoryRow | null>(null);

  const columnDefs: ColDef<HistoryRow>[] = [
    { headerName: "Tanggal", field: "task_date", minWidth: 110 },
    { headerName: "Divisi", minWidth: 120, valueGetter: () => divisionName ?? "-" },
    { headerName: "Job Description", field: "jobdescription", minWidth: 200, flex: 1.2 },
    {
      headerName: "PIC",
      minWidth: 140,
      valueGetter: ({ data }) => (data ? picLabel(data, employeeNames) : "-"),
    },
    { headerName: "Target", field: "planned_work_minutes", minWidth: 90, valueFormatter: ({ value }) => fmtMinutes(Number(value ?? 0)) },
    { headerName: "Aktual Jam Kerja", minWidth: 110, valueGetter: ({ data }) => (data ? fmtMinutes(actualMinutes(data)) : "-") },
    {
      headerName: "Progress",
      minWidth: 90,
      valueGetter: ({ data }) => (data ? progressPercent(data) : null),
      valueFormatter: ({ value }) => (value === null || value === undefined ? "-" : `${value}%`),
    },
    {
      headerName: "Status",
      minWidth: 170,
      cellRenderer: ({ data }: ICellRendererParams<HistoryRow>) => (data ? <HistoryStatusBadges row={data} /> : null),
    },
  ];

  function handleRowClicked(event: RowClickedEvent<HistoryRow>) {
    if (event.data) setSelectedRow(event.data);
  }

  return (
    <section className="border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-3 py-2.5">
        <div className="flex items-center gap-2">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Riwayat Pekerjaan</h2>
          <span className="border border-border px-2 py-0.5 font-mono text-[11px] text-muted-foreground">{items.length}</span>
        </div>
        {canCreate && items.length > 0 ? (
          <CreateJobPlanMenu jobPlanHref={jobPlanHref} />
        ) : null}
      </div>

      {error ? (
        <p className="px-3 py-5 text-sm text-muted-foreground">
          Riwayat pekerjaan tidak dapat dimuat: {error}
        </p>
      ) : items.length === 0 ? (
        <HistoryEmptyState canCreate={canCreate} jobPlanHref={jobPlanHref} />
      ) : (
        <SmsAgGrid<HistoryRow>
          heightClassName="h-80"
          rowData={items}
          columnDefs={columnDefs}
          getRowId={(params) => params.data.plan_id}
          onRowClicked={handleRowClicked}
          emptyMessage="Belum ada Job Plan untuk countdown ini."
        />
      )}

      {selectedRow ? (
        <JobHistoryDetailDrawer
          row={selectedRow}
          onClose={() => setSelectedRow(null)}
          carId={carId}
          divisionId={divisionId}
          divisionName={divisionName}
          employeeNames={employeeNames}
        />
      ) : null}
    </section>
  );
}
