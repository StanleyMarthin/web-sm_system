"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckSquare, Square } from "lucide-react";
import type { SpfPagination, SpfSource } from "@/shared/api/spf-contracts";
import { mutateSpfCollect } from "@/shared/api/spf";
import { ActionButton, EmptyRow } from "@/shared/ui/compact";
import { useSweetAlert } from "@/shared/ui/sweet-alert";
import { SpfDataTable } from "./spf-data-table";
import { SpfSourceBadge } from "./spf-source-badge";
import { SpfSourceStatusBadge } from "./spf-status-badge";

interface TechnicalJobdescSelectorProps {
  sources: readonly SpfSource[];
  meta?: SpfPagination;
  selectedIds?: readonly string[];
  onSelectionChange?: (ids: string[]) => void;
  readonly?: boolean;
}

function sourceKey(source: Pick<SpfSource, "source_type" | "source_id" | "id">) {
  return `${source.source_type ?? "SYSTEM"}:${source.source_id ?? source.id}`;
}

export function TechnicalJobdescSelector({
  sources,
  meta,
  selectedIds,
  onSelectionChange,
  readonly = false,
}: TechnicalJobdescSelectorProps) {
  const router = useRouter();
  const { alertElement, notifyError, notifySuccess } = useSweetAlert();
  const [internalIds, setInternalIds] = useState<string[]>([]);
  const [isCollecting, startCollectTransition] = useTransition();
  const effectiveSelectedIds = selectedIds ?? internalIds;

  const selectableSources = useMemo(
    () => sources.filter((source) => source.spf_status === "READY" && !source.collected),
    [sources],
  );
  const selectedSet = useMemo(() => new Set(effectiveSelectedIds), [effectiveSelectedIds]);

  function setSelected(next: string[]) {
    if (onSelectionChange) {
      onSelectionChange(next);
      return;
    }
    setInternalIds(next);
  }

  function toggle(source: SpfSource) {
    const key = sourceKey(source);
    if (source.spf_status !== "READY" || source.collected || readonly) return;
    setSelected(selectedSet.has(key) ? effectiveSelectedIds.filter((id) => id !== key) : [...effectiveSelectedIds, key]);
  }

  function toggleAll() {
    if (readonly) return;
    const keys = selectableSources.map(sourceKey);
    const allSelected = keys.length > 0 && keys.every((key) => selectedSet.has(key));
    setSelected(allSelected ? effectiveSelectedIds.filter((id) => !keys.includes(id)) : Array.from(new Set([...effectiveSelectedIds, ...keys])));
  }

  function handleCollectSubmit() {
    if (effectiveSelectedIds.length === 0) return;
    startCollectTransition(async () => {
      const sourceIds = effectiveSelectedIds.map((key) => key.split(":").slice(1).join(":"));
      const result = await mutateSpfCollect(sourceIds);
      if (!result.success) {
        notifyError("Gagal collect", result.message);
        return;
      }
      notifySuccess("Collect sukses", `${result.data.inserted ?? 0} item ditambahkan, ${result.data.ignored ?? 0} diabaikan.`);
      setSelected([]);
      router.refresh();
    });
  }

  const allSelected = selectableSources.length > 0 && selectableSources.every((source) => selectedSet.has(sourceKey(source)));

  return (
    <div className="space-y-3">
      {alertElement}
      <div className="flex flex-wrap items-center justify-between gap-2 border border-border bg-card px-3 py-2 dark:border-white/[0.05]">
        <button
          type="button"
          onClick={toggleAll}
          disabled={readonly || selectableSources.length === 0}
          className="inline-flex h-9 items-center gap-2 border border-border px-3 font-mono text-[12px] uppercase tracking-[0.08em] text-muted-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/[0.08]"
        >
          {allSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
          Pilih READY
        </button>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] text-muted-foreground">{effectiveSelectedIds.length} source dipilih</span>
          {!onSelectionChange ? (
            <ActionButton variant="success" disabled={effectiveSelectedIds.length === 0 || isCollecting} onClick={handleCollectSubmit}>
              {isCollecting ? "Collect..." : "Collect Source"}
            </ActionButton>
          ) : null}
        </div>
      </div>

      {sources.length === 0 ? (
        <EmptyRow message="Tidak ada jobdesc teknis dari sistem untuk unit dan rentang tanggal ini." />
      ) : (
        <SpfDataTable
          rows={sources}
          minWidth={1100}
          emptyMessage="Tidak ada source SPF."
          columns={[
            {
              key: "select",
              label: "",
              className: "w-12 text-center",
              render: (source) => {
                const key = sourceKey(source);
                const disabled = readonly || source.spf_status !== "READY" || source.collected;
                return (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => toggle(source)}
                    aria-label={`Pilih source ${source.source_id ?? source.id}`}
                    className="inline-flex h-7 w-7 items-center justify-center text-muted-foreground disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    {selectedSet.has(key) ? <CheckSquare className="h-4 w-4 text-success" /> : <Square className="h-4 w-4" />}
                  </button>
                );
              },
            },
            { key: "source", label: "Source", render: (source) => <SpfSourceBadge value={source.source_type} /> },
            {
              key: "jobdesc",
              label: "Jobdesc",
              render: (source) => (
                <div className="max-w-[360px]">
                  <p className="font-medium text-foreground">{source.customer_description || source.description}</p>
                  <p className="mt-1 text-[12px] text-muted-foreground">{source.original_description || "-"}</p>
                </div>
              ),
            },
            { key: "panel", label: "Panel/Part", render: (source) => source.panel_name ?? source.panel ?? source.panel_id ?? "-" },
            { key: "divisi", label: "Divisi", render: (source) => source.divisi ?? source.work_type ?? "-" },
            { key: "pic", label: "PIC", render: (source) => source.pic ?? "-" },
            { key: "status", label: "Status", render: (source) => <SpfSourceStatusBadge status={source.spf_status} /> },
            { key: "date", label: "Tanggal", render: (source) => source.work_date ?? source.created_at ?? "-" },
            { key: "progress", label: "Progress", render: (source) => `${source.progress}%` },
            { key: "docs", label: "Dok.", render: (source) => source.documentation_count ?? 0 },
          ]}
        />
      )}

      {meta ? (
        <p className="font-mono text-[11px] text-muted-foreground">
          {meta.total} total · offset {meta.offset} · limit {meta.limit}
        </p>
      ) : null}
    </div>
  );
}

export function SourceCollector({ sources, meta }: { sources: readonly SpfSource[]; meta: SpfPagination }) {
  return <TechnicalJobdescSelector sources={sources} meta={meta} />;
}
