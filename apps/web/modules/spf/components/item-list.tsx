"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Edit3, Images, Minus, Plus, X } from "lucide-react";
import type { ItemRequest, SpfItem, SpfPagination, SpfSourceStatus } from "@/shared/api/spf-contracts";
import { mutateSpf } from "@/shared/api/spf";
import { ActionButton, CompactTextarea, EmptyRow } from "@/shared/ui/compact";
import { useSweetAlert } from "@/shared/ui/sweet-alert";
import { SpfDataTable } from "./spf-data-table";

interface ItemListProps {
  rows: readonly SpfItem[];
  meta: SpfPagination;
  canAdmin: boolean;
  editable?: boolean;
  onOpenDocumentation?: (itemId: string) => void;
}

type DraftEdit = {
  customer_description: string;
};

export function CuratedItemEditor({ rows, canAdmin, editable = true, onOpenDocumentation }: ItemListProps) {
  const router = useRouter();
  const { alertElement, notifyError, notifySuccess } = useSweetAlert();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftEdit | null>(null);
  const [isPending, startTransition] = useTransition();
  const canEdit = editable && canAdmin;

  function startEdit(item: SpfItem) {
    setEditingId(item.id);
    setDraft({
      customer_description: item.customer_description,
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
      notifySuccess("Tersimpan", "Isi laporan item diperbarui.");
      setEditingId(null);
      setDraft(null);
      router.refresh();
    });
  }

  function saveEdit(item: SpfItem) {
    if (!draft) return;
    if (!draft.customer_description.trim()) {
      notifyError("Validasi", "Isi laporan wajib diisi.");
      return;
    }
    updateItem(item, {
      customer_description: draft.customer_description.trim(),
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
        minWidth={1120}
        emptyMessage="Belum ada item."
        columns={[
          { key: "panel", label: "Panel / Part", render: (item) => <span className="font-semibold text-foreground">{item.panel_name ?? item.panel ?? item.panel_id ?? "-"}</span> },
          { key: "jobdesc", label: "Deskripsi Teknis", render: (item) => <span className="text-muted-foreground">{item.original_description || item.work_type || "-"}</span> },
          { key: "status", label: "Status", render: (item) => <span className="font-mono text-[11px] uppercase text-foreground">{item.work_status || "-"}</span> },
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
              <p className="max-w-[420px] whitespace-pre-wrap leading-5 text-foreground">{item.customer_description}</p>
            ),
          },
          {
            key: "order",
            label: "Urut",
            render: (item) => (
              <div className="flex items-center gap-1">
                {canEdit && item.spf_status === "INCLUDED" ? (
                  <button type="button" aria-label="Turunkan nomor urut" onClick={() => move(item, -1)} className="border border-border p-1 text-muted-foreground hover:bg-muted"><Minus className="h-3.5 w-3.5" /></button>
                ) : null}
                <span className="min-w-6 text-center font-mono text-[12px] font-semibold">{item.display_order}</span>
                {canEdit && item.spf_status === "INCLUDED" ? (
                  <button type="button" aria-label="Naikkan nomor urut" onClick={() => move(item, 1)} className="border border-border p-1 text-muted-foreground hover:bg-muted"><Plus className="h-3.5 w-3.5" /></button>
                ) : null}
              </div>
            ),
          },
          {
            key: "publish",
            label: "Publish",
            render: (item) => (
              <button
                type="button"
                role="switch"
                aria-checked={item.spf_status === "INCLUDED"}
                disabled={!canEdit || isPending}
                onClick={() => updateItem(item, { spf_status: item.spf_status === "INCLUDED" ? "EXCLUDED" : "INCLUDED" })}
                className={`inline-flex h-7 min-w-16 items-center justify-center border px-2 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] disabled:cursor-not-allowed disabled:opacity-55 ${item.spf_status === "INCLUDED" ? "border-success/35 bg-success/10 text-success" : "border-border text-muted-foreground"}`}
              >
                {item.spf_status === "INCLUDED" ? "Ready" : "Tidak"}
              </button>
            ),
          },
          {
            key: "action",
            label: "Aksi",
            render: (item) => {
              if (!canEdit) return <span className="text-[12px] text-muted-foreground">Hanya lihat</span>;
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
                  {onOpenDocumentation ? (
                    <ActionButton onClick={() => onOpenDocumentation(item.id)}>
                      <Images className="h-3.5 w-3.5" />Dokumen ({item.documentation_count})
                    </ActionButton>
                  ) : null}
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
