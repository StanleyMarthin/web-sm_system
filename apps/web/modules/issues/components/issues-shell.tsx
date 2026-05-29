"use client";

import type {
  IssueQuery,
  IssueRecord,
  IssueReferences,
  IssueSeverity,
  IssueSummary,
} from "@smsystem/contracts/issue";
import type { GridFilter } from "@smsystem/contracts/grid";
import { AlertTriangle, Plus, RefreshCcw } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { createIssue } from "@/shared/api/issues";
import { SmartDataGrid } from "@/shared/datagrid/smart-data-grid";
import type {
  SmartDataGridColumn,
  SmartDataGridFilterDefinition,
  SmartDataGridSavedView,
  SmartDataGridSortOption,
} from "@/shared/datagrid/types";
import { IssueCreateForm, type IssueCreateFormValues } from "./forms/issue-create-form";

interface IssuesShellProps {
  rows: IssueRecord[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  state: IssueQuery;
  references: IssueReferences;
  summary: IssueSummary;
  urgentRows: IssueRecord[];
  canCreate: boolean;
}



function SummaryCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="border border-gray-300 dark:border-white/[0.05] bg-white dark:bg-[#111114] px-3 py-2">
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-gray-500 dark:text-white/30">{label}</p>
      <p className="mt-1 font-mono text-[13px] text-gray-950 dark:text-white">{value}</p>
      <p className="mt-1 text-[11px] text-gray-400 dark:text-white/40">{helper}</p>
    </div>
  );
}

const sortOptions: SmartDataGridSortOption[] = [
  { label: "Dibuat", value: "createdAt" },
  { label: "Diperbarui", value: "updatedAt" },
  { label: "Unit", value: "unitName" },
  { label: "Status", value: "status" },
  { label: "Tingkat", value: "severity" },
];

const savedViews: SmartDataGridSavedView[] = [
  {
    id: "all-issues",
    label: "Semua",
    sortBy: "createdAt",
    sortDirection: "desc",
    filters: [],
  },
  {
    id: "open-only",
    label: "Terbuka",
    sortBy: "createdAt",
    sortDirection: "desc",
    filters: [
      {
        field: "status",
        operator: "eq",
        value: "OPEN",
      } satisfies GridFilter,
    ],
  },
  {
    id: "urgent-only",
    label: "Prioritas Tinggi",
    sortBy: "createdAt",
    sortDirection: "desc",
    filters: [
      {
        field: "severity",
        operator: "eq",
        value: "HIGH",
      } satisfies GridFilter,
    ],
  },
];

export function IssuesShell({
  rows,
  meta,
  state,
  references,
  summary,
  urgentRows,
  canCreate,
}: IssuesShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const columns = useMemo<SmartDataGridColumn[]>(
    () => [
      {
        key: "createdAt",
        label: "Dibuat",
        sticky: true,
        kind: "text",
        renderCell: (value, row) => (
          <span className="font-mono text-[11px] text-gray-500 dark:text-white/55">{String(value)}</span>
        ),
      },
      {
        key: "severity",
        label: "Tingkat",
        kind: "status",
        filterKey: "severity",
        filterOptions: references.severities,
      },
      {
        key: "title",
        label: "Judul",
        renderCell: (value, row) => (
          <div className="min-w-0">
            <Link
              href={`/issues/${String(row.issueId)}`}
              className="font-medium text-gray-950 dark:text-white transition-colors hover:text-amber-300"
            >
              {String(value)}
            </Link>
            <p className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-[0.12em] text-gray-500 dark:text-white/30">
              {String(row.issueNumber ?? "-")} · {String(row.unitName ?? "-")} · {String(row.divisionName ?? "-")}
            </p>
          </div>
        ),
      },
      {
        key: "assignedToName",
        label: "PIC",
      },
      {
        key: "status",
        label: "Status",
        kind: "status",
        filterKey: "status",
        filterOptions: references.statuses,
      },
      {
        key: "sourceType",
        label: "Sumber",
        kind: "mono",
      },
    ],
    [references],
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filters: SmartDataGridFilterDefinition[] = [
    {
      field: "status",
      label: "Status",
      options: references.statuses,
    },
    {
      field: "severity",
      label: "Tingkat",
      options: references.severities,
    },
    {
      field: "divisionId",
      label: "Divisi",
      options: references.divisions,
    },
    {
      field: "carId",
      label: "Unit",
      options: references.units,
    },
  ];

  async function handleCreateIssue(data: IssueCreateFormValues) {
    setIsSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const result = await createIssue({
        carId: data.carId,
        divisionId: data.divisionId ? Number.parseInt(data.divisionId, 10) : null,
        issueType: data.issueType.trim(),
        severity: data.severity as IssueSeverity,
        title: data.title.trim(),
        description: data.description.trim(),
      });

      if (!result.success) {
        setError(result.message);
        return;
      }

      setMessage("Issue manual berhasil dibuat.");
      router.push(`/issues/${result.result.issueId}`);
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-3">
      <section className="grid gap-2 md:grid-cols-3">
        <SummaryCard
          label="Issue Terbuka"
          value={String(summary.openCount)}
          helper="Issue yang belum selesai atau belum di-waive."
        />
        <SummaryCard
          label="Issue Prioritas"
          value={String(summary.urgentCount)}
          helper="Priority tinggi yang butuh penanganan cepat."
        />
        <SummaryCard
          label="Escalated"
          value={String(summary.escalatedCount)}
          helper="Issue yang sudah naik level penanganan."
        />
      </section>

      <section className="grid gap-3 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
        <div className="border border-gray-300 dark:border-white/[0.05] bg-white dark:bg-[#111114] px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center border border-gray-300 dark:border-white/[0.08] bg-slate-50 dark:bg-[#0a0a0c]">
              <AlertTriangle className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-gray-500 dark:text-white/30">
                Urgent Board
              </p>
              <h2 className="mt-1 text-[13px] font-medium text-gray-950 dark:text-white">Issue prioritas tinggi</h2>
            </div>
          </div>

          <div className="mt-3 space-y-2">
            {urgentRows.length === 0 ? (
              <div className="border border-dashed border-gray-300 dark:border-white/[0.08] bg-slate-50 dark:bg-[#0a0a0c] px-3 py-4 text-[11px] text-gray-500 dark:text-white/35">
                Tidak ada urgent issue di scope saat ini.
              </div>
            ) : null}
            {urgentRows.slice(0, 5).map((issue) => (
              <Link
                key={issue.issueId}
                href={`/issues/${issue.issueId}`}
                className="block border border-gray-300 dark:border-white/[0.05] bg-slate-50 dark:bg-[#0a0a0c] px-3 py-3 transition-colors hover:bg-gray-100 dark:hover:bg-white/[0.03]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-gray-400 dark:text-white/40">{issue.issueNumber}</p>
                    <p className="mt-1 text-[12px] text-gray-950 dark:text-white">{issue.title}</p>
                    <p className="mt-1 text-[11px] text-gray-600 dark:text-white/45">
                      {issue.unitName} · {issue.divisionName ?? "-"}
                    </p>
                  </div>
                  <div className="shrink-0 border border-red-500/30 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-red-300">
                    {issue.status}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="border border-gray-300 dark:border-white/[0.05] bg-white dark:bg-[#111114] px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center border border-gray-300 dark:border-white/[0.08] bg-slate-50 dark:bg-[#0a0a0c]">
              <Plus className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-gray-500 dark:text-white/30">
                Manual Issue
              </p>
              <h2 className="mt-1 text-[13px] font-medium text-gray-950 dark:text-white">Buat issue baru</h2>
            </div>
          </div>

          {!canCreate ? (
            <p className="mt-3 border border-dashed border-gray-300 dark:border-white/[0.08] bg-slate-50 dark:bg-[#0a0a0c] px-3 py-4 text-[11px] text-gray-500 dark:text-white/35">
              Aksi create issue dibatasi untuk user dengan permission submit QC.
            </p>
          ) : (
            <IssueCreateForm
              references={references}
              isSubmitting={isSubmitting}
              message={message}
              error={error}
              onSubmit={(data) => {
                void handleCreateIssue(data);
              }}
            />
          )}
        </div>
      </section>

      <SmartDataGrid
        title="Issue Log"
        description="Server-side grid untuk issue QC reject, temuan teknis, hambatan produksi, dan issue manual."
        rows={rows}
        columns={columns}
        meta={meta}
        state={state}
        filters={filters}
        sortOptions={sortOptions}
        savedViews={savedViews}
        searchPlaceholder="Cari issue number, unit, title, atau deskripsi..."
        headerActions={
          <button
            type="button"
            onClick={() => {
              const nextParams = new URLSearchParams(searchParams.toString());
              router.push(`${pathname}?${nextParams.toString()}`);
              router.refresh();
            }}
            className="inline-flex h-8 items-center gap-2 border border-gray-300 dark:border-white/[0.08] bg-transparent px-3 font-mono text-[10px] uppercase tracking-[0.12em] text-gray-700 dark:text-white/60 hover:text-gray-900 dark:text-white/80"
          >
            <RefreshCcw className="h-3.5 w-3.5" />
            Refresh
          </button>
        }
      />
    </div>
  );
}
