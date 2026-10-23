"use client";

import type { ColDef } from "ag-grid-community";
import type { UserGridReference, UserRecord } from "@smsystem/contracts/user";
import { KeyRound, Pencil, Plus, RefreshCcw, Search, UserX } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { deactivateUser } from "@/shared/api/users/users";
import { SmsAgGrid } from "@/shared/datagrid/sms-ag-grid";
import { useSweetAlert } from "@/shared/ui/sweet-alert";
import { UserCreateForm } from "./forms/user-create-form";
import { UserEditForm } from "./forms/user-edit-form";
import { UserResetPasswordForm } from "./forms/user-reset-password-form";

interface UserManagementShellProps {
  rows: UserRecord[];
  references: UserGridReference;
}

type EditorMode = "create" | "edit" | "reset" | null;

function buildScopeSummary(row: UserRecord): string {
  if (row.managedDivisionNames.length > 0) return row.managedDivisionNames.join(", ");
  if (row.activeUnitIds.length > 0) return `${row.activeUnitIds.length} unit aktif`;
  return row.divisionName || "-";
}

export function UserManagementShell({ rows, references }: UserManagementShellProps) {
  const router = useRouter();
  const sweetAlert = useSweetAlert();
  const [isPending, startTransition] = useTransition();
  const [editorMode, setEditorMode] = useState<EditorMode>(null);
  const [activeUser, setActiveUser] = useState<UserRecord | null>(null);
  const [quickFilterText, setQuickFilterText] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!message) return;
    sweetAlert.notifySuccess("Berhasil", message);
    setMessage(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message]);

  useEffect(() => {
    if (!error) return;
    sweetAlert.notifyError("Aksi belum jalan", error);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error]);

  function closeEditor() {
    setEditorMode(null);
    setActiveUser(null);
  }

  function openEditor(mode: Exclude<EditorMode, null>, user: UserRecord | null = null) {
    setError(null);
    setMessage(null);
    setEditorMode(mode);
    setActiveUser(user);
  }

  async function submitDeactivate(user: UserRecord) {
    const shouldDeactivate = await sweetAlert.confirm({
      title: "Nonaktifkan pengguna?",
      description: `${user.employeeId} · ${user.fullName} tidak akan bisa login sampai diaktifkan kembali.`,
      tone: "warning",
      confirmLabel: "Nonaktifkan",
    });
    if (!shouldDeactivate) return;

    const result = await deactivateUser(user.employeeId);
    if (!result.success) {
      setError(result.message);
      return;
    }

    setMessage(`Pengguna ${user.employeeId} berhasil dinonaktifkan.`);
    router.refresh();
  }

  const columnDefs = useMemo<ColDef<UserRecord>[]>(
    () => [
      { field: "employeeId", headerName: "ID Pegawai", pinned: "left", width: 145 },
      { field: "fullName", headerName: "Nama", minWidth: 190, flex: 1 },
      { field: "roleName", headerName: "Role", minWidth: 150 },
      { field: "divisionName", headerName: "Divisi / Team", minWidth: 165 },
      { field: "grade", headerName: "Jabatan", minWidth: 145, valueFormatter: ({ value }) => value || "-" },
      { headerName: "Pegangan", minWidth: 190, valueGetter: ({ data }) => (data ? buildScopeSummary(data) : "-") },
      {
        field: "status",
        headerName: "Status",
        width: 110,
        valueFormatter: ({ value }) => (value === "ACTIVE" ? "Aktif" : "Nonaktif"),
        cellClass: ({ value }) => (value === "ACTIVE" ? "text-success font-medium" : "text-muted-foreground"),
      },
      { field: "lastLoginAt", headerName: "Login Terakhir", minWidth: 165, valueFormatter: ({ value }) => value || "-" },
      {
        headerName: "Aksi",
        pinned: "right",
        sortable: false,
        filter: false,
        width: 130,
        cellRenderer: ({ data }: { data?: UserRecord }) => {
          if (!data) return null;
          return (
            <div className="flex h-full items-center justify-center gap-1">
              <button type="button" title="Ubah pengguna" aria-label={`Ubah ${data.fullName}`} onClick={() => openEditor("edit", data)} className="inline-flex h-7 w-7 items-center justify-center border border-border text-muted-foreground hover:bg-muted hover:text-foreground">
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button type="button" title="Reset kata sandi" aria-label={`Reset kata sandi ${data.fullName}`} onClick={() => openEditor("reset", data)} className="inline-flex h-7 w-7 items-center justify-center border border-border text-muted-foreground hover:bg-muted hover:text-foreground">
                <KeyRound className="h-3.5 w-3.5" />
              </button>
              {data.status === "ACTIVE" ? (
                <button type="button" title="Nonaktifkan pengguna" aria-label={`Nonaktifkan ${data.fullName}`} disabled={isPending} onClick={() => startTransition(() => void submitDeactivate(data))} className="inline-flex h-7 w-7 items-center justify-center border border-destructive/35 text-destructive hover:bg-destructive/10 disabled:opacity-40">
                  <UserX className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
          );
        },
      },
    ],
    [isPending],
  );

  return (
    <div className="space-y-3">
      {sweetAlert.alertElement}
      <div className="flex flex-col gap-2 border border-border bg-card p-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-md">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={quickFilterText} onChange={(event) => setQuickFilterText(event.target.value)} placeholder="Cari ID, nama, role, divisi, atau jabatan" className="h-9 w-full border border-border bg-background pl-9 pr-3 text-sm outline-none focus:border-primary/55" />
        </div>
        <div className="flex items-center gap-2">
          <button type="button" title="Muat ulang" aria-label="Muat ulang daftar pengguna" onClick={() => router.refresh()} className="inline-flex h-9 w-9 items-center justify-center border border-border text-muted-foreground hover:bg-muted hover:text-foreground">
            <RefreshCcw className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => openEditor("create")} className="inline-flex h-9 items-center gap-2 border border-primary/40 bg-primary/[0.06] px-3 text-[12px] font-medium text-app-accent-ink hover:bg-primary/10">
            <Plus className="h-4 w-4" /> Tambah pengguna
          </button>
        </div>
      </div>

      <SmsAgGrid<UserRecord>
        rowData={rows}
        columnDefs={columnDefs}
        quickFilterText={quickFilterText}
        getRowId={({ data }) => data.employeeId}
        heightClassName="h-[calc(100svh-250px)] min-h-[28rem]"
        defaultColDef={{ filter: true, floatingFilter: true }}
        emptyMessage="Belum ada pengguna."
      />

      {editorMode ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-2 backdrop-blur-[1px] sm:p-4">
          <div className="flex max-h-[calc(100svh-1rem)] w-full max-w-3xl flex-col overflow-hidden border border-border bg-background p-4 dark:border-white/[0.08] sm:max-h-[calc(100svh-2rem)] sm:p-6">
            <div className="flex shrink-0 items-center justify-between gap-4">
              <h3 className="min-w-0 break-words text-lg text-foreground">
                {editorMode === "create" ? "Tambah Pengguna" : editorMode === "edit" ? `Ubah ${activeUser?.employeeId ?? ""}` : `Reset Sandi ${activeUser?.employeeId ?? ""}`}
              </h3>
              <button type="button" onClick={closeEditor} className="h-9 border border-border px-3 text-xs text-muted-foreground hover:text-foreground">Tutup</button>
            </div>

            {editorMode === "reset" && activeUser ? <UserResetPasswordForm user={activeUser} onSuccess={setMessage} onError={setError} onClose={closeEditor} /> : null}
            {editorMode === "create" ? <UserCreateForm references={references} onSuccess={setMessage} onError={setError} onClose={closeEditor} /> : null}
            {editorMode === "edit" && activeUser ? <UserEditForm user={activeUser} references={references} onSuccess={setMessage} onError={setError} onClose={closeEditor} /> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
