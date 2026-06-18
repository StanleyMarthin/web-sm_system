"use client";

import type { GridFilter, GridQueryState } from "@smsystem/contracts/grid";
import type { UserGridReference, UserRecord } from "@smsystem/contracts/user";
import { Plus, RefreshCcw, UserCog } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { deactivateUser } from "@/shared/api/users";
import { UserCreateForm } from "./forms/user-create-form";
import { UserEditForm } from "./forms/user-edit-form";
import { UserResetPasswordForm } from "./forms/user-reset-password-form";
import { SmartDataGrid } from "@/shared/datagrid/smart-data-grid";
import type {
  SmartDataGridColumn,
  SmartDataGridFilterDefinition,
  SmartDataGridSavedView,
  SmartDataGridSortOption,
} from "@/shared/datagrid/types";
import { useSweetAlert } from "@/shared/ui/sweet-alert";

interface UserManagementShellProps {
  rows: UserRecord[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  state: GridQueryState;
  references: UserGridReference;
  exportHref: string;
}

type EditorMode = "create" | "edit" | "reset" | null;
type RoleReference = UserGridReference["roles"][number];

const sortOptions: SmartDataGridSortOption[] = [
  { label: "ID Pegawai", value: "employeeId" },
  { label: "Nama Lengkap", value: "fullName" },
  { label: "Email", value: "email" },
  { label: "Role", value: "roleName" },
  { label: "Divisi", value: "divisionName" },
  { label: "Golongan", value: "grade" },
  { label: "Status", value: "status" },
  { label: "Login Terakhir", value: "lastLoginAt" },
  { label: "Jumlah Perangkat", value: "deviceCount" },
  { label: "Dibuat", value: "createdAt" },
];

const savedViews: SmartDataGridSavedView[] = [
  {
    id: "all-records",
    label: "Semua",
    sortBy: "employeeId",
    sortDirection: "asc",
    filters: [],
  },
  {
    id: "active-only",
    label: "Aktif",
    sortBy: "fullName",
    sortDirection: "asc",
    filters: [
      {
        field: "status",
        operator: "eq",
        value: "ACTIVE",
      } satisfies GridFilter,
    ],
  },
  {
    id: "inactive-only",
    label: "Nonaktif",
    sortBy: "fullName",
    sortDirection: "asc",
    filters: [
      {
        field: "status",
        operator: "eq",
        value: "INACTIVE",
      } satisfies GridFilter,
    ],
  },
];

function buildScopeSummary(row: UserRecord): string {
  if (row.managedDivisionNames.length > 0) {
    return `Divisi: ${row.managedDivisionNames.join(", ")}`;
  }

  if (row.activeUnitIds.length > 0) {
    return `Unit aktif: ${row.activeUnitIds.length}`;
  }

  if (row.divisionName) {
    return `Divisi utama: ${row.divisionName}`;
  }

  return "Mengikuti data pegawai";
}

export function UserManagementShell({
  rows,
  meta,
  state,
  references,
  exportHref,
}: UserManagementShellProps) {
  const router = useRouter();
  const sweetAlert = useSweetAlert();
  const [isPending, startTransition] = useTransition();
  const [editorMode, setEditorMode] = useState<EditorMode>(null);
  const [activeUser, setActiveUser] = useState<UserRecord | null>(null);
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

  const filters: SmartDataGridFilterDefinition[] = [
    {
      field: "status",
      label: "Status",
      options: [
        { label: "Aktif", value: "ACTIVE" },
        { label: "Nonaktif", value: "INACTIVE" },
      ],
    },
    {
      field: "roleId",
      label: "Role",
      options: references.roles,
    },
    {
      field: "divisionId",
      label: "Divisi",
      options: references.divisions,
    },
  ];

  function closeEditor() {
    setEditorMode(null);
    setActiveUser(null);
  }

  function openCreateEditor() {
    setError(null);
    setMessage(null);
    setEditorMode("create");
    setActiveUser(null);
  }

  function openEditEditor(user: UserRecord) {
    setError(null);
    setMessage(null);
    setEditorMode("edit");
    setActiveUser(user);
  }

  function openResetEditor(user: UserRecord) {
    setError(null);
    setMessage(null);
    setEditorMode("reset");
    setActiveUser(user);
  }

  function runAsyncAction(action: () => Promise<void>) {
    startTransition(() => {
      void action();
    });
  }

  async function submitDeactivate(user: UserRecord) {
    setError(null);
    setMessage(null);

    const shouldDeactivate = await sweetAlert.confirm({
      title: "Nonaktifkan pengguna?",
      description: `${user.employeeId} · ${user.fullName} tidak akan bisa login lagi sampai diaktifkan ulang.`,
      tone: "warning",
      confirmLabel: "Nonaktifkan",
    });
    if (!shouldDeactivate) {
      return;
    }

    const result = await deactivateUser(user.employeeId);
    if (!result.success) {
      setError(result.message);
      return;
    }

    setMessage(`Pengguna ${user.employeeId} berhasil dinonaktifkan.`);
    router.refresh();
  }

  const columns: SmartDataGridColumn[] = [
    { key: "employeeId", label: "ID Pegawai", kind: "mono", sticky: true },
    { key: "fullName", label: "Nama Lengkap" },
    { key: "email", label: "Email" },
    { key: "roleName", label: "Role" },
    { key: "divisionName", label: "Divisi" },
    { key: "grade", label: "Golongan" },
    { key: "scopeSummary", label: "Lingkup Akses" },
    { key: "activeUnitsText", label: "Unit Aktif" },
    { key: "status", label: "Status", kind: "status", align: "center" },
    { key: "lastLoginAt", label: "Login Terakhir" },
    { key: "deviceCount", label: "Perangkat", kind: "number", align: "right" },
    { key: "createdAt", label: "Dibuat" },
    {
      key: "actions",
      label: "Tindakan",
      renderCell: (_value, row) => {
        const employeeId = String(row.employeeId ?? "");
        const user = rows.find((item) => item.employeeId === employeeId);
        if (!user) {
          return null;
        }

        return (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => openEditEditor(user)}
              className="rounded-full border border-border dark:border-white/[0.08] px-3 py-1 text-[11px] uppercase tracking-[0.13em] text-foreground dark:text-foreground/70 hover:text-foreground dark:text-foreground"
            >
              Ubah
            </button>
            <button
              type="button"
              onClick={() => openResetEditor(user)}
              className="rounded-full border border-primary/30 px-3 py-1 text-[11px] uppercase tracking-[0.13em] text-app-accent-ink hover:text-app-accent-ink"
            >
              Reset Sandi
            </button>
            <button
              type="button"
              onClick={() => runAsyncAction(() => submitDeactivate(user))}
              className="rounded-full border border-destructive/30 px-3 py-1 text-[11px] uppercase tracking-[0.13em] text-destructive hover:text-destructive"
            >
              Nonaktifkan
            </button>
          </div>
        );
      },
      align: "right",
      widthClassName: "min-w-[250px]",
    },
  ];

  const gridRows = rows.map((row) => ({
    employeeId: row.employeeId,
    fullName: row.fullName,
    email: row.email,
    roleName: row.roleName,
    divisionName: row.divisionName,
    grade: row.grade,
    scopeSummary: buildScopeSummary(row),
    activeUnitsText:
      row.activeUnitIds.length > 0 ? row.activeUnitIds.join(", ") : "-",
    status: row.status,
    lastLoginAt: row.lastLoginAt,
    deviceCount: row.deviceCount,
    createdAt: row.createdAt,
    actions: row.employeeId,
  }));

  return (
    <div className="space-y-4">
      {sweetAlert.alertElement}

      <SmartDataGrid
        viewportClassName="max-h-[calc(100svh-260px)]"
        title="Pengguna"
        description=""
        columns={columns}
        rows={gridRows}
        meta={meta}
        state={state}
        searchPlaceholder="Cari ID pegawai, nama, email, role, divisi, atau jabatan..."
        filters={filters}
        sortOptions={sortOptions}
        savedViews={savedViews}
        exportHref={exportHref}
        headerActions={
          <button
            type="button"
            onClick={openCreateEditor}
            className="inline-flex items-center gap-2 rounded-full border border-success/35 bg-success/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-success hover:bg-success/20"
          >
            <Plus className="h-3.5 w-3.5" />
            Tambah Pengguna
          </button>
        }
      />

      {editorMode ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 backdrop-blur-[1px]">
          <div className="w-full max-w-3xl rounded-3xl border border-border dark:border-white/[0.08] bg-background p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg text-foreground dark:text-foreground">
                {editorMode === "create"
                  ? "Buat Pengguna"
                  : editorMode === "edit"
                    ? `Ubah ${activeUser?.employeeId ?? ""}`
                    : `Reset Sandi ${activeUser?.employeeId ?? ""}`}
              </h3>
              <button
                type="button"
                onClick={closeEditor}
                className="rounded-full border border-border dark:border-white/[0.08] px-3 py-1 text-xs uppercase tracking-[0.15em] text-muted-foreground dark:text-foreground/50 hover:text-foreground dark:text-foreground"
              >
                Tutup
              </button>
            </div>

            {editorMode === "reset" && activeUser && (
              <UserResetPasswordForm
                user={activeUser}
                onSuccess={setMessage}
                onError={setError}
                onClose={closeEditor}
              />
            )}
            
            {editorMode === "create" && (
              <UserCreateForm
                references={references}
                onSuccess={setMessage}
                onError={setError}
                onClose={closeEditor}
              />
            )}
            
            {editorMode === "edit" && activeUser && (
              <UserEditForm
                user={activeUser}
                references={references}
                onSuccess={setMessage}
                onError={setError}
                onClose={closeEditor}
              />
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
