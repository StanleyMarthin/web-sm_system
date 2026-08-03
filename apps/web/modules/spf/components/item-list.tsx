"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Check, Edit3, X } from "lucide-react";
import type { ItemRequest, SpfItem, SpfPagination, SpfSourceStatus } from "@/shared/api/spf-contracts";
import type { SpfRole } from "@/shared/auth/admin-session";
import { mutateSpf } from "@/shared/api/spf";
import { ActionButton, CompactInput, CompactTextarea, EmptyRow } from "@/shared/ui/compact";
import { useSweetAlert } from "@/shared/ui/sweet-alert";
import { SpfDataTable } from "./spf-data-table";
import { SpfSourceBadge } from "./spf-source-badge";
import { SpfSourceStatusBadge } from "./spf-status-badge";

interface ItemListProps {
  rows: readonly SpfItem[];
  meta: SpfPagination;
  role: SpfRole;
  editable?: boolean;
}

type DraftEdit = {
  customer_description: string;
  work_status: string;
  progress: number;
};

export function CuratedItemEditor({ rows, role, editable = true }: ItemListProps) {
  const router = useRouter();
  const { alertElement, notifyError, notifySuccess } = useSweetAlert();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftEdit | null>(null);
  const [isPending, startTransition] = useTransition();
  const canEdit = editable && role === "ADMIN";

  function startEdit(item: SpfItem) {
    setEditingId(item.id);
    setDraft({
      customer_description: item.customer_description,
      work_status: item.work_status,
      progress: item.progress,
    });
  }

  function updateItem(item: SpfItem, patch: Partial<SpfItem> & { spf_status?: SpfSourceStatus }) {
    startTransition(async () => {
      const payload: ItemRequest = {
        mode: "UPDATE",
        item_id: item.id,
        customer_description: patch.customer_description,
        work_status: patch.work_status,
        progress: patch.progress,
        display_order: patch.display_order,
        spf_status: patch.spf_status,
      };
      const result = await mutateSpf("item", payload);
      if (!result.success) {
        notifyError(result.status === 409 ? "Data telah berubah" : "Gagal menyimpan", result.message);
        if (result.status === 409) router.refresh();
        return;
      }
      notifySuccess("Tersimpan", "Kurasi item diperbarui.");
      setEditingId(null);
      setDraft(null);
      router.refresh();
    });
  }

  function saveEdit(item: SpfItem) {
    if (!draft) return;
    if (!draft.customer_description.trim()) {
      notifyError("Validasi", "Customer description wajib diisi.");
      return;
    }
    if (draft.progress < 0 || draft.progress > 100) {
      notifyError("Validasi", "Progress wajib 0-100.");
      return;
    }
    updateItem(item, {
      customer_description: draft.customer_description.trim(),
      work_status: draft.work_status.trim() || item.work_status,
      progress: draft.progress,
    });
  }

  function move(item: SpfItem, direction: -1 | 1) {
    updateItem(item, { display_order: Math.max(0, item.display_order + direction) });
  }

  if (rows.length === 0) {
    return <EmptyRow message="Belum ada item dalam periode ini." />;
  }

  return (
    <div className="space-y-3">
      {alertElement}
      <SpfDataTable
        rows={rows}
        minWidth={1180}
        emptyMessage="Belum ada item SPF."
        columns={[
          { key: "source", label: "Sumber", render: (item) => <SpfSourceBadge value={item.source_type} /> },
          {
            key: "desc",
            label: "Isi Laporan",
            render: (item) => editingId === item.id && draft ? (
              <div className="space-y-2">
                <CompactTextarea
                  rows={3}
                  value={draft.customer_description}
                  onChange={(event) => setDraft({ ...draft, customer_description: event.target.value })}
                />
                <p className="text-[12px] text-muted-foreground">{item.original_description || "-"}</p>
              </div>
            ) : (
              <div className="max-w-[420px]">
                <Link href={`/spf/items/${item.id}`} className="font-medium text-foreground hover:text-app-accent-ink hover:underline">
                  {item.customer_description}
                </Link>
                <p className="mt-1 text-[12px] text-muted-foreground">{item.original_description || "-"}</p>
              </div>
            ),
          },
          { key: "panel", label: "Panel/Part", render: (item) => item.panel_name ?? item.panel ?? item.panel_id ?? "-" },
          {
            key: "status",
            label: "Status",
            render: (item) => editingId === item.id && draft ? (
              <CompactInput value={draft.work_status} onChange={(event) => setDraft({ ...draft, work_status: event.target.value })} />
            ) : item.work_status,
          },
          {
            key: "progress",
            label: "Progress",
            render: (item) => editingId === item.id && draft ? (
              <CompactInput
                type="number"
                min={0}
                max={100}
                value={draft.progress}
                onChange={(event) => setDraft({ ...draft, progress: Number(event.target.value) })}
              />
            ) : `${item.progress}%`,
          },
          { key: "docs", label: "Dok.", render: (item) => item.documentation_count },
          { key: "spf", label: "SPF", render: (item) => <SpfSourceStatusBadge status={item.spf_status} /> },
          {
            key: "order",
            label: "Urut",
            render: (item) => (
              <div className="flex items-center gap-1">
                <span className="font-mono text-[12px]">{item.display_order}</span>
                {canEdit && item.spf_status === "INCLUDED" ? (
                  <>
                    <button type="button" onClick={() => move(item, -1)} className="border border-border p-1 text-muted-foreground hover:bg-muted">
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => move(item, 1)} className="border border-border p-1 text-muted-foreground hover:bg-muted">
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                  </>
                ) : null}
              </div>
            ),
          },
          {
            key: "action",
            label: "Aksi",
            render: (item) => {
              if (!canEdit) return <span className="text-[12px] text-muted-foreground">Read-only</span>;
              if (editingId === item.id) {
                return (
                  <div className="flex flex-wrap gap-1.5">
                    <ActionButton variant="success" disabled={isPending} onClick={() => saveEdit(item)}><Check className="h-3.5 w-3.5" />Simpan</ActionButton>
                    <ActionButton disabled={isPending} onClick={() => { setEditingId(null); setDraft(null); }}><X className="h-3.5 w-3.5" />Batal</ActionButton>
                  </div>
                );
              }
              return (
                <div className="flex flex-wrap gap-1.5">
                  <ActionButton onClick={() => startEdit(item)} disabled={isPending}>
                    <Edit3 className="h-3.5 w-3.5" />Edit
                  </ActionButton>
                  {item.spf_status === "INCLUDED" ? (
                    <ActionButton variant="danger" disabled={isPending} onClick={() => updateItem(item, { spf_status: "EXCLUDED" })}>Exclude</ActionButton>
                  ) : (
                    <ActionButton variant="success" disabled={isPending} onClick={() => updateItem(item, { spf_status: "INCLUDED" })}>Include</ActionButton>
                  )}
                </div>
              );
            },
          },
        ]}
      />
    </div>
  );
}

export function ItemList(props: ItemListProps) {
  return <CuratedItemEditor {...props} />;
}
