"use client";

import type {
  PermissionRecord,
  RoleDivisionScopeMode,
  RoleRecord,
  RoleHistoryEntry,
  RoleReferenceOption,
  RoleScopeBasis,
  RoleScopePreset,
  RoleUnitScopeMode,
} from "@smsystem/contracts/rbac";
import { permissionCodes } from "@smsystem/permissions";
import {
  CheckCircle2,
  ChevronRight,
  Plus,
  Save,
  Search,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  createRole,
  fetchRolePermissions,
  fetchRoleHistory,
  updateRole,
} from "@/shared/api/roles/roles";
import { describeHistoryChange, permissionAction, permissionChanges, permissionLabel, permissionModule, type PermissionAction } from "../permission-matrix";
import { permissionPresentation } from "../permission-registry";
import { approvalBlueprints, closestApprovalBlueprint, resolveApprovalBlueprintKey, type ApprovalBlueprint } from "../approval-mapping";

interface RoleMatrixShellProps {
  roles: RoleRecord[];
  permissions: PermissionRecord[];
  references: {
    divisions: RoleReferenceOption[];
    units: RoleReferenceOption[];
  };
  activeRoleId: number;
  activePermissionIds: number[];
}

interface RoleFormState {
  roleName: string;
  description: string;
  roleLevel: string;
  approvalRank: string;
  webEnabled: boolean;
  mobileEnabled: boolean;
  notes: string;
  scopePreset: {
    divisionMode: RoleDivisionScopeMode;
    divisionIds: string[];
    unitMode: RoleUnitScopeMode;
    unitIds: string[];
  };
}

interface ScopeDialogProps {
  open: boolean;
  kind: "division" | "unit" | null;
  canEdit: boolean;
  options: RoleReferenceOption[];
  initialMode: RoleDivisionScopeMode | RoleUnitScopeMode;
  initialIds: string[];
  onClose(): void;
  onApply(payload: {
    mode: RoleDivisionScopeMode | RoleUnitScopeMode;
    ids: string[];
  }): void;
}

type EditorMode = "create" | "edit";
type RoleTab = "summary" | "settings" | "permissions" | "history";

const permissionActions: PermissionAction[] = ["View", "Create", "Approve", "Process", "Other"];

const divisionModeOptions: Array<{
  value: RoleDivisionScopeMode;
  label: string;
  note: string;
}> = [
  {
    value: "NONE",
    label: "Tidak dipakai",
    note: "Role ini tidak memakai daftar divisi sebagai lingkup kerja utama.",
  },
  {
    value: "OWN_DIVISION",
    label: "Divisi utama user",
    note: "User mengikuti divisi induknya sendiri, tanpa daftar pegangan tambahan.",
  },
  {
    value: "ASSIGNED_DIVISIONS",
    label: "Divisi pegangan",
    note: "User memakai daftar divisi pegangan yang bisa dipilih dan dikelola admin.",
  },
  {
    value: "GLOBAL",
    label: "Semua divisi",
    note: "Role ini boleh menembus seluruh divisi untuk kebutuhan pusat.",
  },
];

const unitModeOptions: Array<{
  value: RoleUnitScopeMode;
  label: string;
  note: string;
}> = [
  {
    value: "NONE",
    label: "Tidak dipakai",
    note: "Role ini tidak memakai daftar unit sebagai lingkup kerja utama.",
  },
  {
    value: "ASSIGNED_UNITS",
    label: "Unit pegangan",
    note: "User mengikuti daftar unit pegangan yang bisa disusun admin.",
  },
  {
    value: "GLOBAL",
    label: "Semua unit",
    note: "Role ini boleh melihat seluruh unit aktif.",
  },
];

function emptyRoleForm(): RoleFormState {
  return {
    roleName: "",
    description: "",
    roleLevel: "100",
    approvalRank: "",
    webEnabled: true,
    mobileEnabled: true,
    notes: "",
    scopePreset: {
      divisionMode: "OWN_DIVISION",
      divisionIds: [],
      unitMode: "NONE",
      unitIds: [],
    },
  };
}

function deriveScopePreset(scopeBasis: RoleScopeBasis | undefined): RoleScopePreset {
  switch (scopeBasis) {
    case "GLOBAL":
      return {
        divisionMode: "GLOBAL",
        divisionIds: [],
        unitMode: "GLOBAL",
        unitIds: [],
      };
    case "ASSIGNED_UNITS":
      return {
        divisionMode: "NONE",
        divisionIds: [],
        unitMode: "ASSIGNED_UNITS",
        unitIds: [],
      };
    case "ASSIGNED_DIVISIONS":
      return {
        divisionMode: "ASSIGNED_DIVISIONS",
        divisionIds: [],
        unitMode: "NONE",
        unitIds: [],
      };
    case "OWN_DIVISION":
      return {
        divisionMode: "OWN_DIVISION",
        divisionIds: [],
        unitMode: "NONE",
        unitIds: [],
      };
    default:
      return {
        divisionMode: "NONE",
        divisionIds: [],
        unitMode: "NONE",
        unitIds: [],
      };
  }
}

function roleToForm(role: RoleRecord | undefined): RoleFormState {
  if (!role) {
    return emptyRoleForm();
  }

  const scopePreset = role.profile?.scopePreset ?? deriveScopePreset(role.profile?.scopeBasis);

  return {
    roleName: role.roleName,
    description: role.description ?? "",
    roleLevel: String(role.profile?.roleLevel ?? 100),
    approvalRank:
      role.profile?.approvalRank === null || role.profile?.approvalRank === undefined
        ? ""
        : String(role.profile.approvalRank),
    webEnabled: role.profile?.webEnabled ?? true,
    mobileEnabled: role.profile?.mobileEnabled ?? true,
    notes: role.profile?.notes ?? "",
    scopePreset: {
      divisionMode: scopePreset.divisionMode,
      divisionIds: scopePreset.divisionIds.map(String),
      unitMode: scopePreset.unitMode,
      unitIds: [...scopePreset.unitIds],
    },
  };
}

function deriveScopeBasis(scopePreset: RoleFormState["scopePreset"]): RoleScopeBasis {
  if (
    scopePreset.divisionMode === "GLOBAL" ||
    scopePreset.unitMode === "GLOBAL"
  ) {
    return "GLOBAL";
  }

  if (scopePreset.unitMode === "ASSIGNED_UNITS") {
    return "ASSIGNED_UNITS";
  }

  if (scopePreset.divisionMode === "ASSIGNED_DIVISIONS") {
    return "ASSIGNED_DIVISIONS";
  }

  if (scopePreset.divisionMode === "OWN_DIVISION") {
    return "OWN_DIVISION";
  }

  return "SELF_ONLY";
}

function humanizeDerivedScope(scopeBasis: RoleScopeBasis): string {
  switch (scopeBasis) {
    case "GLOBAL":
      return "Semua unit";
    case "ASSIGNED_UNITS":
      return "Unit pegangan";
    case "ASSIGNED_DIVISIONS":
      return "Divisi pegangan";
    case "OWN_DIVISION":
      return "Divisi utama";
    default:
      return "Data sendiri";
  }
}

const approvalPermissionControls = [
  {
    code: permissionCodes.woApprove,
    label: "KD dan KP",
    note: "Boleh menyetujui tahap Ketua Divisi dan Kepala Produksi. Tahap KP juga membutuhkan level approval 3 atau lebih tinggi.",
  },
  {
    code: permissionCodes.woApproveAdvisor,
    label: "QA",
    note: "Boleh menyetujui tahap QA pada Work Order.",
  },
  {
    code: permissionCodes.woApprovePm,
    label: "PM / MP",
    note: "Boleh menyetujui tahap akhir PM atau MP pada Work Order.",
  },
] as const;

const scopePermissionCodes: ReadonlySet<string> = new Set([
  permissionCodes.viewAllUnits,
  permissionCodes.viewAssignedUnits,
]);

function mapIdsToLabels(values: string[], options: RoleReferenceOption[]): string[] {
  if (values.length === 0) {
    return [];
  }

  const optionMap = new Map(options.map((option) => [option.value, option.label]));
  return values.map((value) => optionMap.get(value) ?? value);
}

function ScopeDialog({
  open,
  kind,
  canEdit,
  options,
  initialMode,
  initialIds,
  onClose,
  onApply,
}: ScopeDialogProps) {
  const [mode, setMode] = useState<RoleDivisionScopeMode | RoleUnitScopeMode>(initialMode);
  const [selectedIds, setSelectedIds] = useState<string[]>(initialIds);
  const [search, setSearch] = useState("");
  const [pickerValue, setPickerValue] = useState("");
  const [activeRowValue, setActiveRowValue] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }

    queueMicrotask(() => {
      setMode(initialMode);
      setSelectedIds(initialIds);
      setSearch("");
      setPickerValue("");
      setActiveRowValue("");
    });
  }, [initialIds, initialMode, open]);

  if (!open || !kind) {
    return null;
  }

  const isDivision = kind === "division";
  const optionConfig = isDivision ? divisionModeOptions : unitModeOptions;
  const listTitle = isDivision ? "Daftar divisi" : "Daftar unit";
  const pickerPlaceholder = isDivision ? "Pilih divisi" : "Pilih unit";
  const usesList = isDivision
    ? mode === "ASSIGNED_DIVISIONS"
    : mode === "ASSIGNED_UNITS";

  const filteredOptions = options.filter((option) => {
    if (selectedIds.includes(option.value)) {
      return false;
    }
    if (!search.trim()) {
      return true;
    }
    return option.label.toLowerCase().includes(search.trim().toLowerCase());
  });

  function handleModeChange(nextMode: RoleDivisionScopeMode | RoleUnitScopeMode) {
    setMode(nextMode);
    if (nextMode !== "ASSIGNED_DIVISIONS" && nextMode !== "ASSIGNED_UNITS") {
      setSelectedIds([]);
      setPickerValue("");
      setActiveRowValue("");
    }
  }

  function addSelectedValue() {
    if (!pickerValue) {
      return;
    }

    setSelectedIds((currentValue) => [...currentValue, pickerValue]);
    setPickerValue("");
  }

  function removeSelectedValue() {
    if (!activeRowValue) {
      return;
    }

    setSelectedIds((currentValue) =>
      currentValue.filter((value) => value !== activeRowValue),
    );
    setActiveRowValue("");
  }

  function applyChanges() {
    onApply({
      mode,
      ids: usesList ? selectedIds : [],
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 px-4 py-6 backdrop-blur-sm">
      <div className="mx-auto flex h-full max-w-4xl flex-col border border-border dark:border-white/10 bg-muted dark:bg-background">
        <div className="flex items-start justify-between gap-4 border-b border-border dark:border-white/5 px-6 py-4">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-[0.12em] text-muted-foreground dark:text-foreground/30">
              {isDivision ? "Scope Divisi" : "Scope Unit"}
            </p>
            <h3 className="text-[13px] font-mono text-foreground dark:text-foreground mt-0.5">
              {isDivision ? "Atur lingkup divisi" : "Atur lingkup unit"}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="border border-border dark:border-white/10 p-1.5 text-muted-foreground dark:text-foreground/40 hover:text-foreground dark:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 gap-6 overflow-hidden px-6 py-5 lg:grid-cols-[380px_minmax(0,1fr)]">
          <div className="border border-border dark:border-white/5 bg-white dark:bg-card p-4">
            <p className="text-[10px] font-mono uppercase tracking-[0.12em] text-muted-foreground dark:text-foreground/30">
              Pilih model akses
            </p>
            <div className="mt-3 space-y-2">
              {optionConfig.map((option) => {
                const selected = option.value === mode;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleModeChange(option.value)}
                    disabled={!canEdit}
                    className={[
                      "w-full border px-3 py-2.5 text-left transition-colors",
                      selected
                        ? "border-primary/30 bg-primary/[0.04]"
                        : "border-border dark:border-white/5 bg-muted dark:bg-background hover:border-border dark:border-white/10",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-[11px] font-mono text-foreground dark:text-foreground">{option.label}</p>
                      {selected ? (
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 text-app-accent-ink" />
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex min-h-0 flex-col border border-border dark:border-white/5 bg-white dark:bg-card p-4">
            <div className="flex items-start justify-between gap-4">
              <p className="text-[10px] font-mono uppercase tracking-[0.12em] text-muted-foreground dark:text-foreground/30">
                {listTitle}
              </p>
              {usesList ? (
                <button
                  type="button"
                  onClick={removeSelectedValue}
                  disabled={!canEdit || !activeRowValue}
                  className="border border-destructive/20 px-2 py-1 text-[10px] font-mono uppercase text-destructive hover:border-destructive/40 transition-colors disabled:opacity-40"
                >
                  Hapus
                </button>
              ) : null}
            </div>

            {usesList ? (
              <>
                <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_240px_auto]">
                  <label className="space-y-1">
                    <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground dark:text-foreground/40">
                      Cari {isDivision ? "divisi" : "unit"}
                    </span>
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      disabled={!canEdit}
                      placeholder={`Ketik nama ${isDivision ? "divisi" : "unit"}`}
                      className="h-8 w-full border border-border dark:border-white/10 bg-muted dark:bg-background px-2 text-[11px] font-mono text-foreground dark:text-foreground outline-none focus:border-primary/40"
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-muted-foreground dark:text-foreground/30">
                      Pilih data
                    </span>
                    <select
                      value={pickerValue}
                      onChange={(event) => setPickerValue(event.target.value)}
                      disabled={!canEdit}
                      className="h-8 w-full border border-border dark:border-white/10 bg-muted dark:bg-background px-2 text-[11px] font-mono text-foreground dark:text-foreground outline-none focus:border-primary/40"
                    >
                      <option value="">{pickerPlaceholder}</option>
                      {filteredOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={addSelectedValue}
                      disabled={!canEdit || !pickerValue}
                      className="inline-flex h-8 items-center justify-center border border-primary/30 bg-primary/[0.04] px-3 text-app-accent-ink hover:bg-primary/10 transition-colors disabled:opacity-40"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-4 min-h-0 flex-1 overflow-hidden border border-border dark:border-white/5">
                  <div className="grid grid-cols-[48px_minmax(0,1fr)] border-b border-border dark:border-white/5 px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.12em] text-muted-foreground dark:text-foreground/25">
                    <span>No</span>
                    <span>{isDivision ? "Divisi" : "Unit"}</span>
                  </div>
                  <div className="max-h-[340px] overflow-y-auto">
                    {selectedIds.length === 0 ? (
                      <div className="px-3 py-6 text-[11px] font-mono text-muted-foreground dark:text-foreground/25">
                        — Belum ada data pegangan.
                      </div>
                    ) : (
                      selectedIds.map((value, index) => {
                        const option = options.find((item) => item.value === value);
                        const selected = activeRowValue === value;
                        return (
                          <button
                            key={value}
                            type="button"
                            onClick={() => setActiveRowValue(value)}
                            className={[
                              "grid w-full grid-cols-[48px_minmax(0,1fr)] border-b border-white/[0.04] px-3 py-2 text-left transition-colors",
                              selected
                                ? "bg-primary/[0.06] text-foreground dark:text-foreground"
                                : "text-foreground dark:text-foreground/60 hover:bg-muted dark:hover:bg-white/[0.02]",
                            ].join(" ")}
                          >
                            <span className="text-[10px] font-mono text-muted-foreground dark:text-foreground/25">{index + 1}</span>
                            <span className="text-[11px] font-mono">{option?.label ?? value}</span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="mt-4 border border-border dark:border-white/5 px-3 py-4 text-[11px] font-mono text-muted-foreground dark:text-foreground/30">
                — Mode ini tidak memerlukan daftar pegangan.
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-border dark:border-white/5 px-6 py-3">
          <button
            type="button"
            onClick={onClose}
            className="border border-border dark:border-white/10 px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.12em] text-muted-foreground dark:text-foreground/50 hover:text-foreground dark:text-foreground transition-colors"
          >
            Tutup
          </button>
          <button
            type="button"
            onClick={applyChanges}
            disabled={!canEdit}
            className="inline-flex items-center gap-1.5 border border-primary/40 bg-primary/[0.06] px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.12em] text-app-accent-ink hover:bg-primary/10 transition-colors disabled:opacity-40"
          >
            <Save className="h-3 w-3" />
            Gunakan Setting
          </button>
        </div>
      </div>
    </div>
  );
}

export function RoleMatrixShell({
  roles,
  permissions,
  references,
  activeRoleId,
  activePermissionIds,
}: RoleMatrixShellProps) {
  const [roleCatalog, setRoleCatalog] = useState<RoleRecord[]>(roles);
  const [selectedRoleId, setSelectedRoleId] = useState(activeRoleId);
  const [draftPermissionIds, setDraftPermissionIds] = useState<number[]>(
    activePermissionIds,
  );
  const [originalPermissionIds, setOriginalPermissionIds] = useState<number[]>([]);
  const [editorMode, setEditorMode] = useState<EditorMode>("edit");
  const [isEditing, setIsEditing] = useState(true);
  const [roleSearch, setRoleSearch] = useState("");
  const [scopeDialog, setScopeDialog] = useState<"division" | "unit" | null>(null);
  const [activeTab, setActiveTab] = useState<RoleTab>("summary");
  const [permissionViewFilter, setPermissionViewFilter] = useState<
    "WEB" | "MOBILE"
  >("WEB");
  const [permissionSearch, setPermissionSearch] = useState("");
  const [compareRoleId, setCompareRoleId] = useState(0);
  const [compareIds, setCompareIds] = useState<number[] | null>(null);
  const [form, setForm] = useState<RoleFormState>(() =>
    roleToForm(roles.find((role) => role.id === activeRoleId)),
  );
  const [isFetchingPermissions, setIsFetchingPermissions] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [outcomeUnknown, setOutcomeUnknown] = useState(false);
  const [history, setHistory] = useState<RoleHistoryEntry[] | null>(null);
  const [historyError, setHistoryError] = useState(false);
  const permissionCacheRef = useRef<Record<number, number[]>>({});
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);
  const [permissionRetry, setPermissionRetry] = useState(0);

  const selectedRole = roleCatalog.find((role) => role.id === selectedRoleId);
  const canEditProfile = true;
  const originalForm = roleToForm(selectedRole);
  const profileChanges = editorMode === "create" ? ["Role baru"] : [
    ["Nama role", form.roleName, originalForm.roleName],
    ["Keterangan", form.description, originalForm.description],
    ["Tahap approval", `${form.roleLevel}:${form.approvalRank}`, `${originalForm.roleLevel}:${originalForm.approvalRank}`],
    ["Cakupan data", JSON.stringify(form.scopePreset), JSON.stringify(originalForm.scopePreset)],
    ["Catatan internal", form.notes, originalForm.notes],
  ].filter(([, current, original]) => current !== original).map(([label]) => label);
  const permissionDiff = permissionChanges(originalPermissionIds, draftPermissionIds);
  const changeCount = profileChanges.length + permissionDiff.added.length + permissionDiff.removed.length;
  const selectedApprovalKey = resolveApprovalBlueprintKey(form);
  const selectedApprovalBlueprint = approvalBlueprints.find((choice) => choice.key === selectedApprovalKey) ?? null;
  const closestApproval = useMemo(() => closestApprovalBlueprint(form), [form]);
  const unmappedRoleCount = useMemo(
    () => roleCatalog.filter((role) => resolveApprovalBlueprintKey(roleToForm(role)) === "legacy").length,
    [roleCatalog],
  );
  const permissionIdByCode = useMemo(
    () => new Map(permissions.map((permission) => [permission.permissionCode, permission.id])),
    [permissions],
  );
  const enabledApprovalControls = approvalPermissionControls.filter((control) => {
    const permissionId = permissionIdByCode.get(control.code);
    return permissionId !== undefined && draftPermissionIds.includes(permissionId);
  });

  const filteredRoles = useMemo(() => {
    const keyword = roleSearch.trim().toLowerCase();
    if (!keyword) {
      return roleCatalog;
    }

    return roleCatalog.filter((role) => role.roleName.toLowerCase().includes(keyword));
  }, [roleCatalog, roleSearch]);

  const permissionRows = useMemo(() => {
    return [...permissions]
      .filter((permission) => {
        return (permission.platforms?.includes(permissionViewFilter) ?? false)
          && !scopePermissionCodes.has(permission.permissionCode);
      })
      .sort((left, right) => {
        const moduleCompare = (left.moduleName ?? "general").localeCompare(
          right.moduleName ?? "general",
        );
        if (moduleCompare !== 0) {
          return moduleCompare;
        }

        return left.permissionCode.localeCompare(right.permissionCode);
      });
  }, [permissions, permissionViewFilter]);

  const permissionGroups = useMemo(() => {
    const grouped = new Map<string, PermissionRecord[]>();

    for (const permission of permissionRows) {
      const moduleName = permissionModule(permission);
      const existing = grouped.get(moduleName) ?? [];
      existing.push(permission);
      grouped.set(moduleName, existing);
    }

    return Array.from(grouped.entries()).map(([moduleName, items]) => ({
      moduleName,
      items,
    }));
  }, [permissionRows]);

  const filteredPermissionGroups = useMemo(() => {
    const keyword = permissionSearch.trim().toLowerCase();
    if (!keyword) return permissionGroups;

    return permissionGroups
      .map((group) => ({
        ...group,
        items: group.items.filter(
          (item) =>
            group.moduleName.toLowerCase().includes(keyword) ||
            item.permissionCode.toLowerCase().includes(keyword) ||
            permissionLabel(item).toLowerCase().includes(keyword),
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [permissionGroups, permissionSearch]);

  const permissionMatrixRows = useMemo(
    () =>
      filteredPermissionGroups.map((group) => ({
        moduleName: group.moduleName,
        permissionCount: group.items.length,
        byAction: group.items.reduce<Record<PermissionAction, PermissionRecord[]>>(
          (result, permission) => {
            result[permissionAction(permission.permissionCode)].push(permission);
            return result;
          },
          { View: [], Create: [], Approve: [], Process: [], Other: [] },
        ),
      })),
    [filteredPermissionGroups],
  );

  const derivedScopeBasis = deriveScopeBasis(form.scopePreset);
  const divisionLabels = mapIdsToLabels(form.scopePreset.divisionIds, references.divisions);
  const unitLabels = mapIdsToLabels(form.scopePreset.unitIds, references.units);

  useEffect(() => {
    setRoleCatalog(roles);
  }, [roles]);

  useEffect(() => {
    if (editorMode === "create") {
      return;
    }

    setForm(roleToForm(selectedRole));
  }, [editorMode, selectedRole]);

  useEffect(() => {
    if (activeTab !== "history" || selectedRoleId <= 0) return;
    let cancelled = false;
    setHistory(null);
    setHistoryError(false);
    void fetchRoleHistory(selectedRoleId).then((result) => {
      if (!cancelled) {
        if (result.payload) setHistory(result.payload.data.history);
        else setHistoryError(true);
      }
    }).catch(() => { if (!cancelled) setHistoryError(true); });
    return () => { cancelled = true; };
  }, [activeTab, selectedRoleId]);

  useEffect(() => {
    if (!compareRoleId) {
      setCompareIds(null);
      return;
    }
    let cancelled = false;
    setCompareIds(null);
    void fetchRolePermissions("", compareRoleId).then((result) => {
      if (!cancelled) {
        if (result.payload) setCompareIds(result.payload.data.permissionIds);
        else setError("Izin role pembanding gagal dimuat.");
      }
    }).catch(() => { if (!cancelled) setError("Izin role pembanding gagal dimuat."); });
    return () => { cancelled = true; };
  }, [compareRoleId]);

  useEffect(() => {
    if (selectedRoleId <= 0) {
      setDraftPermissionIds([]);
      setOriginalPermissionIds([]);
      setIsFetchingPermissions(false);
      setPermissionsLoaded(editorMode === "create");
      return;
    }

    const cachedPermissionIds = permissionCacheRef.current[selectedRoleId];
    if (cachedPermissionIds) {
      setOriginalPermissionIds(cachedPermissionIds);
      setDraftPermissionIds(cachedPermissionIds);
      setPermissionsLoaded(true);
      setIsFetchingPermissions(false);
      return;
    }

    let isCancelled = false;
    setIsFetchingPermissions(true);
    setPermissionsLoaded(false);
    void (async () => {
      try {
        const result = await fetchRolePermissions("", selectedRoleId);
        if (isCancelled) {
          return;
        }

        if (!result.payload) {
          setDraftPermissionIds([]);
          setError("Checklist akses untuk role ini belum bisa dimuat.");
          return;
        }

        const permissionIds = result.payload.data.permissionIds;
        permissionCacheRef.current[selectedRoleId] = permissionIds;
        setOriginalPermissionIds(permissionIds);
        setDraftPermissionIds(permissionIds);
        setPermissionsLoaded(true);
      } catch {
        if (!isCancelled) setError("Izin role gagal dimuat. Pilih role kembali untuk mencoba lagi.");
      } finally {
        if (!isCancelled) {
          setIsFetchingPermissions(false);
        }
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [selectedRoleId, editorMode, permissionRetry]);

  function togglePermission(permissionId: number) {
    setDraftPermissionIds((currentValue) =>
      currentValue.includes(permissionId)
        ? currentValue.filter((value) => value !== permissionId)
        : [...currentValue, permissionId],
    );
  }

  function openCreateRole() {
    if (isEditing && changeCount > 0 && !window.confirm("Buang perubahan yang belum disimpan?")) return;
    setEditorMode("create");
    setSelectedRoleId(0);
    setDraftPermissionIds([]);
    setIsEditing(true);
    setError(null);
    setMessage(null);
    setRoleSearch("");
    setActiveTab("settings");
    setForm(emptyRoleForm());
  }

  function selectExistingRole(roleId: number) {
    if (isPending || (isEditing && changeCount > 0 && !window.confirm("Buang perubahan yang belum disimpan?"))) return;
    setEditorMode("edit");
    setSelectedRoleId(roleId);
    setIsEditing(true);
    setError(null);
    setMessage(null);
    setActiveTab("summary");
  }

  function selectTab(nextTab: RoleTab) {
    if (
      nextTab !== activeTab &&
      isEditing &&
      changeCount > 0 &&
      !window.confirm("Ada perubahan yang belum disimpan. Lanjutkan pindah tab tanpa menyimpan?")
    ) {
      return;
    }
    setActiveTab(nextTab);
  }

  function cancelEditing() {
    if (!window.confirm("Buang perubahan yang belum disimpan?")) return;
    setError(null);
    setMessage(null);
    if (editorMode === "create") {
      const fallbackRole = roleCatalog.find((role) => role.id === activeRoleId) ?? roleCatalog[0];
      if (fallbackRole) {
        setEditorMode("edit");
        setSelectedRoleId(fallbackRole.id);
        setForm(roleToForm(fallbackRole));
      } else {
        setForm(emptyRoleForm());
        setSelectedRoleId(0);
      }
      setIsEditing(true);
      return;
    }

    setForm(roleToForm(selectedRole));
    setDraftPermissionIds(permissionCacheRef.current[selectedRoleId] ?? []);
    setIsEditing(true);
  }

  function applyApprovalBlueprint(blueprint: ApprovalBlueprint) {
    if (!canEditProfile) {
      return;
    }

    setForm((currentValue) => ({
      ...currentValue,
      roleLevel: blueprint.roleLevel,
      approvalRank: blueprint.approvalRank,
    }));
  }

  function toggleApprovalPermission(code: string) {
    const permissionId = permissionIdByCode.get(code);
    if (!canEditProfile || !permissionId) return;
    togglePermission(permissionId);
  }

  function applyScopeDialog(payload: {
    mode: RoleDivisionScopeMode | RoleUnitScopeMode;
    ids: string[];
  }) {
    setForm((currentValue) => {
      if (scopeDialog === "division") {
        return {
          ...currentValue,
          scopePreset: {
            ...currentValue.scopePreset,
            divisionMode: payload.mode as RoleDivisionScopeMode,
            divisionIds: payload.ids,
          },
        };
      }

      if (scopeDialog === "unit") {
        return {
          ...currentValue,
          scopePreset: {
            ...currentValue.scopePreset,
            unitMode: payload.mode as RoleUnitScopeMode,
            unitIds: payload.ids,
          },
        };
      }

      return currentValue;
    });
  }

  async function submitRoleProfile() {
    setMessage(null);
    setError(null);
    if (isPending || !permissionsLoaded) return;
    const originalIds = permissionCacheRef.current[selectedRoleId] ?? [];
    const { added, removed } = permissionChanges(originalIds, draftPermissionIds);
    const changes = [...added.map((id) => `+ ${permissions.find((p) => p.id === id)?.permissionCode ?? id}`), ...removed.map((id) => `- ${permissions.find((p) => p.id === id)?.permissionCode ?? id}`)];
    if (!window.confirm(`Simpan perubahan role?${profileChanges.length ? `\n\nProfil: ${profileChanges.join(", ")}` : ""}${changes.length ? `\n\nPerubahan izin:\n${changes.join("\n")}` : "\nTidak ada perubahan izin."}`)) return;

    const payload = {
      roleName: form.roleName.trim(),
      description: form.description.trim() || null,
      permissionIds: draftPermissionIds,
      profile: {
        roleLevel: Number(form.roleLevel || "0"),
        scopeBasis: deriveScopeBasis(form.scopePreset),
        webEnabled: form.webEnabled,
        mobileEnabled: form.mobileEnabled,
        approvalRank: form.approvalRank.trim()
          ? Number(form.approvalRank)
          : null,
        notes: form.notes.trim() || null,
        scopePreset: {
          divisionMode: form.scopePreset.divisionMode,
          divisionIds: form.scopePreset.divisionIds.map((value) => Number(value)),
          unitMode: form.scopePreset.unitMode,
          unitIds: form.scopePreset.unitIds,
        },
      },
    } as const;

    setIsPending(true);
    try {
        let savedRole: RoleRecord;
        if (editorMode === "create") {
          const result = await createRole(payload);
          if (!result.success) {
            if (result.status >= 500) setOutcomeUnknown(true);
            setError(result.status >= 500 ? "Server gagal menjawab dengan pasti. Muat ulang halaman sebelum mencoba lagi." : result.message);
            return;
          }

          setRoleCatalog((currentValue) =>
            [...currentValue, result.role].sort((left, right) =>
              left.roleName.localeCompare(right.roleName),
            ),
          );
          savedRole = result.role;
        } else {
          if (!selectedRoleId) {
            return;
          }

          const result = await updateRole(selectedRoleId, { ...payload, expectedPermissionIds: originalPermissionIds });
          if (!result.success) {
            if (result.status >= 500 || result.errorCode === "ROLE_PERMISSIONS_CHANGED" || result.errorCode === "SESSION_SYNCHRONIZATION_FAILED") setOutcomeUnknown(true);
            setError(result.status >= 500 ? "Server gagal menjawab dengan pasti. Muat ulang halaman sebelum mencoba lagi." : result.message);
            return;
          }
          savedRole = result.role;
          setRoleCatalog((currentValue) =>
            currentValue
              .map((role) => (role.id === result.role.id ? result.role : role))
              .sort((left, right) => left.roleName.localeCompare(right.roleName)),
          );
        }

        permissionCacheRef.current[savedRole.id] = [...draftPermissionIds];
        setOriginalPermissionIds([...draftPermissionIds]);
        setSelectedRoleId(savedRole.id);
        setEditorMode("edit");
        setForm(roleToForm(savedRole));
        setIsEditing(true);
        setActiveTab("summary");
        setMessage(`Perubahan role ${savedRole.roleName} berhasil disimpan.`);
    } catch {
      setOutcomeUnknown(true);
      setError("Jawaban server terputus. Muat ulang halaman untuk memastikan apakah perubahan tersimpan sebelum mencoba lagi.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="space-y-3">
      {message && <div role="status" className="border border-success/30 px-3 py-2 text-sm text-success">{message}</div>}
      {error && <div role="alert" className="border border-destructive/30 px-3 py-2 text-sm text-destructive">{error}{!permissionsLoaded && !isFetchingPermissions && selectedRoleId > 0 && <> <button type="button" onClick={() => setPermissionRetry((value) => value + 1)} className="underline">Coba lagi</button></>}</div>}

      <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="min-w-0 border border-border bg-card">
          <div className="flex items-center justify-between gap-2 border-b border-border p-3">
            <div><h2 className="text-sm font-semibold">Role</h2>{unmappedRoleCount > 0 && <p className="mt-0.5 text-xs text-warning">{unmappedRoleCount} belum dipetakan</p>}</div>
            <button type="button" title="Tambah role" aria-label="Tambah role" onClick={openCreateRole} disabled={isPending} className="inline-flex h-9 w-9 items-center justify-center border border-border hover:bg-muted disabled:opacity-50"><Plus className="h-4 w-4" /></button>
          </div>
          <label className="flex items-center gap-2 border-b border-border px-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <span className="sr-only">Cari nama role</span>
            <input value={roleSearch} onChange={(event) => setRoleSearch(event.target.value)} placeholder="Cari nama role" className="h-10 min-w-0 w-full bg-transparent text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary" />
          </label>
          <div>
            {filteredRoles.length === 0 ? <p className="p-3 text-sm text-muted-foreground">Role tidak ditemukan.</p> : filteredRoles.map((role) => {
              const needsMapping = resolveApprovalBlueprintKey(roleToForm(role)) === "legacy";
              return (
              <button key={role.id} type="button" onClick={() => selectExistingRole(role.id)} aria-current={editorMode === "edit" && selectedRoleId === role.id ? "true" : undefined} className={["block w-full border-b border-border px-3 py-3 text-left hover:bg-muted", editorMode === "edit" && selectedRoleId === role.id ? "border-l-2 border-l-primary bg-primary/[0.08]" : "", needsMapping ? "bg-warning/[0.04]" : ""].join(" ")}>
                <span className="block break-words text-sm font-medium">{role.roleName}</span>
                <span className="mt-1 block text-xs text-muted-foreground">{role.userCount === 0 ? "Belum dipakai" : `${role.userCount} pegawai`} · {role.permissionCount} izin</span>
                {needsMapping && <span className="mt-1 block text-xs text-warning">Perlu pemetaan tahap approval</span>}
              </button>
            ); })}
          </div>
        </aside>

        <main className="min-w-0 border border-border bg-card">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-4">
            <div className="min-w-0">
              <h2 className="break-words text-base font-semibold">{editorMode === "create" ? "Role baru" : selectedRole?.roleName ?? "Pilih role"}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{form.description || "Tidak ada keterangan."}</p>
            </div>
          </div>
          <nav aria-label="Detail role" className="flex flex-wrap gap-1 border-b border-border px-3">
            {([["summary", "Ringkasan"], ["settings", "Pengaturan"], ["permissions", "Izin"], ["history", "Riwayat"]] as Array<[RoleTab, string]>).map(([tab, label]) => (
              <button key={tab} type="button" onClick={() => selectTab(tab)} aria-current={activeTab === tab ? "page" : undefined} className={["border-b-2 px-3 py-3 text-sm", activeTab === tab ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"].join(" ")}>{label}</button>
            ))}
          </nav>

          {activeTab === "summary" && <div className="space-y-4 p-4 text-sm">
            <dl className="grid gap-4 sm:grid-cols-2">
              <div><dt className="text-muted-foreground">Tahap utama</dt><dd className="mt-1 font-medium">{selectedApprovalBlueprint?.label ?? "Belum dipetakan"}</dd></div>
              <div><dt className="text-muted-foreground">Cakupan data</dt><dd className="mt-1 font-medium">{humanizeDerivedScope(derivedScopeBasis)}</dd></div>
              <div><dt className="text-muted-foreground">Dapat menyetujui</dt><dd className="mt-1">{enabledApprovalControls.length ? enabledApprovalControls.map((control) => control.label).join(", ") : "Tidak ada tahap approval"}</dd></div>
              <div><dt className="text-muted-foreground">Pegawai</dt><dd className="mt-1">{selectedRole?.userCount ?? 0}</dd></div>
            </dl>
            {selectedApprovalKey === "legacy" && <div className="border border-warning/40 bg-warning/10 p-3"><p className="font-medium text-warning">Tahap approval belum dipetakan</p><p className="mt-1 text-muted-foreground">Level {form.roleLevel || "-"}, approval {form.approvalRank || "tidak ada"}. Ubah role ini lalu pilih tahap standar agar konfigurasi dapat dibaca konsisten.</p></div>}
            {selectedRole?.userCount === 0 && <div className="border border-border bg-background p-3 text-muted-foreground">Role ini belum dipakai oleh pegawai mana pun.</div>}
            <div className="border border-border bg-background p-3"><p className="font-medium">Pengecualian akun sistem</p><p className="mt-1 text-muted-foreground">SM-03.004 adalah superadmin sistem. Akses tersebut tidak berasal dari role yang sedang dipilih dan selalu berlaku lintas modul.</p></div>
          </div>}

          {activeTab === "settings" && <div className="space-y-6 p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1 text-sm"><span className="text-muted-foreground">Nama role</span>{canEditProfile ? <input value={form.roleName} onChange={(event) => setForm((value) => ({ ...value, roleName: event.target.value }))} className="h-10 w-full border border-border bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-primary" /> : <span className="block py-2">{form.roleName}</span>}</label>
              <label className="space-y-1 text-sm"><span className="text-muted-foreground">Keterangan</span>{canEditProfile ? <input value={form.description} onChange={(event) => setForm((value) => ({ ...value, description: event.target.value }))} className="h-10 w-full border border-border bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-primary" /> : <span className="block py-2">{form.description || "-"}</span>}</label>
            </div>
            <section className="space-y-3">
              <div><h3 className="text-sm font-semibold">Tahap utama di alur</h3><p className="mt-1 text-sm text-muted-foreground">Tahap utama menjelaskan posisi role. Izin approval tambahan di bawah dapat membuat satu role, misalnya MIS, menyetujui lebih dari satu tahap.</p></div>
              {selectedApprovalKey === "legacy" && <div className="flex flex-wrap items-center justify-between gap-3 border border-warning/40 bg-warning/10 p-3"><div><p className="font-medium text-warning">Belum dipetakan</p><p className="mt-1 text-sm text-muted-foreground">Level {form.roleLevel || "-"} · approval {form.approvalRank || "tidak ada"} (nilai lama)</p></div>{canEditProfile && <button type="button" onClick={() => applyApprovalBlueprint(closestApproval)} className="h-9 border border-warning/50 px-3 text-sm text-warning hover:bg-warning/10">Pakai {closestApproval.label}</button>}</div>}
              <div className="flex flex-wrap gap-2" aria-label="Alur approval">{approvalBlueprints.filter((choice) => choice.approvalRank !== "").map((choice) => <span key={choice.key} className={["border px-3 py-2 text-sm", choice.key === selectedApprovalKey ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground"].join(" ")}>{choice.label}</span>)}</div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{approvalBlueprints.map((choice) => <label key={choice.key} title={choice.note} className={["flex min-h-24 cursor-pointer items-start gap-3 border p-3 text-sm", choice.key === selectedApprovalKey ? "border-primary bg-primary/10" : "border-border hover:bg-muted"].join(" ")}><input type="radio" name="approval-blueprint" checked={choice.key === selectedApprovalKey} onChange={() => applyApprovalBlueprint(choice)} disabled={isPending} className="mt-0.5 h-4 w-4 shrink-0 accent-primary" /><span><span className="block font-medium">{choice.label}</span><span className="mt-1 block text-xs text-muted-foreground">{choice.note}</span></span></label>)}</div>
            </section>
            <section className="space-y-3 border-t border-border pt-5">
              <div><h3 className="text-sm font-semibold">Tahap yang dapat disetujui</h3><p className="mt-1 text-sm text-muted-foreground">Pengaturan ini memakai izin Work Order yang sama dengan matriks Izin. Role MIS dapat mengaktifkan seluruh tahap yang diperlukan.</p></div>
              <div className="grid gap-2 sm:grid-cols-3">{approvalPermissionControls.map((control) => { const permissionId = permissionIdByCode.get(control.code); const enabled = permissionId !== undefined && draftPermissionIds.includes(permissionId); return <label key={control.code} className={["flex min-h-24 gap-3 border p-3", enabled ? "border-primary bg-primary/[0.06]" : "border-border"].join(" ")}><input type="checkbox" checked={enabled} disabled={!canEditProfile || !permissionId || isPending} onChange={() => toggleApprovalPermission(control.code)} className="mt-0.5 h-4 w-4 shrink-0 accent-primary" /><span><span className="block font-medium">{control.label}</span><span className="mt-1 block text-xs text-muted-foreground">{control.note}</span></span></label>; })}</div>
            </section>
            <section>
              <h3 className="text-sm font-semibold">Cakupan data</h3>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                {(["division", "unit"] as const).map((kind) => <div key={kind} className="border border-border p-3 text-sm">
                  <div className="flex items-center justify-between gap-2"><span className="font-medium">{kind === "division" ? "Divisi" : "Unit"}</span>{canEditProfile && <button type="button" onClick={() => setScopeDialog(kind)} className="border border-border px-2 py-1 text-xs hover:bg-muted">Atur</button>}</div>
                  <p className="mt-2 text-muted-foreground">{kind === "division" ? divisionModeOptions.find((option) => option.value === form.scopePreset.divisionMode)?.label : unitModeOptions.find((option) => option.value === form.scopePreset.unitMode)?.label}</p>
                  {(kind === "division" ? divisionLabels : unitLabels).length > 0 && <p className="mt-1 break-words">{(kind === "division" ? divisionLabels : unitLabels).join(", ")}</p>}
                </div>)}
              </div>
            </section>
            <label className="block space-y-1 text-sm"><span className="text-muted-foreground">Catatan internal</span>{canEditProfile ? <textarea value={form.notes} onChange={(event) => setForm((value) => ({ ...value, notes: event.target.value }))} rows={3} className="w-full border border-border bg-background p-3 focus-visible:outline-2 focus-visible:outline-primary" /> : <span className="block whitespace-pre-wrap py-2">{form.notes || "-"}</span>}</label>
          </div>}

          {activeTab === "history" && <section className="p-4" aria-label="Riwayat perubahan role">
            {editorMode === "create" ? <p className="text-sm text-muted-foreground">Riwayat tersedia setelah role dibuat.</p> : historyError ? <p role="alert" className="text-sm text-destructive">Riwayat gagal dimuat. Pilih tab lain lalu buka kembali untuk mencoba lagi.</p> : history === null ? <p role="status" className="text-sm text-muted-foreground">Memuat riwayat...</p> : history.length === 0 ? <p className="text-sm text-muted-foreground">Belum ada riwayat yang tercatat.</p> : <ol className="divide-y divide-border">{history.map((entry) => <li key={entry.id} className="py-3 first:pt-0"><div className="flex flex-wrap justify-between gap-2 text-sm"><span className="font-medium">{entry.actorName || "Tidak diketahui"}</span><time className="text-muted-foreground">{entry.createdAt}</time></div><p className="mt-1 text-sm">{entry.action === "role.create" ? "Role dibuat" : entry.action === "role.permissions.update" ? "Izin diubah" : "Role diubah"}</p><ul className="mt-2 space-y-1 text-sm text-muted-foreground">{describeHistoryChange(entry.oldValue, entry.newValue, permissions).map((line, index) => <li key={index} className="break-words">{line}</li>)}</ul></li>)}</ol>}
          </section>}

          {activeTab === "permissions" && <div className="space-y-3 p-4">
            <div className="flex flex-wrap items-center gap-2">
              {(["WEB", "MOBILE"] as const).map((platform) => <button key={platform} type="button" onClick={() => setPermissionViewFilter(platform)} aria-pressed={platform === permissionViewFilter} className={["border px-3 py-2 text-sm", platform === permissionViewFilter ? "border-primary bg-primary/10" : "border-border hover:bg-muted"].join(" ")}>{platform === "WEB" ? "Web" : "Mobile"}</button>)}
              <input aria-label="Cari izin" value={permissionSearch} onChange={(event) => setPermissionSearch(event.target.value)} placeholder="Cari modul atau izin" className="h-10 min-w-[180px] flex-1 border border-border bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-primary" />
              <select aria-label="Bandingkan dengan role lain" value={compareRoleId} onChange={(event) => setCompareRoleId(Number(event.target.value))} className="h-10 max-w-full border border-border bg-background px-3 text-sm"><option value={0}>Bandingkan role</option>{roleCatalog.filter((role) => role.id !== selectedRoleId).map((role) => <option key={role.id} value={role.id}>{role.roleName}</option>)}</select>
            </div>
            <p className="text-xs text-muted-foreground">Centang menunjukkan izin yang diberikan langsung ke role. Cakupan unit diatur dari tab Pengaturan, sehingga izin “lihat semua unit” dan “lihat unit pegangan” tidak diubah dari tabel ini. SM-03.004 memiliki pengecualian superadmin sistem di luar role. Perubahan sesi aktif web dan mobile disinkronkan saat penyimpanan berhasil.</p>
            {isFetchingPermissions && <p role="status" className="text-sm">Memuat izin...</p>}
            {!permissionsLoaded && !isFetchingPermissions && <p className="text-sm text-destructive">Izin belum dimuat. <button type="button" onClick={() => setPermissionRetry((value) => value + 1)} className="underline">Coba lagi</button></p>}
            <div className="overflow-x-auto border border-border">
              <table className="w-full min-w-[860px] table-fixed text-left text-sm">
                <thead className="bg-muted text-muted-foreground"><tr><th className="w-48 px-3 py-2 font-medium">Modul</th>{permissionActions.map((action) => <th key={action} className="px-3 py-2 font-medium">{({ View: "Lihat", Create: "Buat", Approve: "Approve", Process: "Proses", Other: "Lainnya" })[action]}</th>)}</tr></thead>
                <tbody>{permissionMatrixRows.map((group) => <tr key={group.moduleName} className="align-top border-t border-border">
                  <th className="px-3 py-3 font-medium"><label className="flex items-start gap-2"><input type="checkbox" aria-label={`Pilih izin yang tampil untuk ${group.moduleName}`} disabled={!canEditProfile || !permissionsLoaded || isPending} checked={Object.values(group.byAction).flat().every((item) => draftPermissionIds.includes(item.id))} ref={(element) => { if (element) { const count = Object.values(group.byAction).flat().filter((item) => draftPermissionIds.includes(item.id)).length; element.indeterminate = count > 0 && count < group.permissionCount; } }} onChange={(event) => { const ids = Object.values(group.byAction).flat().map((item) => item.id); const checked = event.target.checked; setDraftPermissionIds((current) => checked ? [...new Set([...current, ...ids])] : current.filter((id) => !ids.includes(id))); }} className="mt-0.5 h-4 w-4 shrink-0 accent-primary" /><span className="break-words">{group.moduleName}</span></label><span className="mt-1 block text-xs font-normal text-muted-foreground">{Object.values(group.byAction).flat().filter((item) => draftPermissionIds.includes(item.id)).length}/{group.permissionCount} diberikan</span></th>
                  {permissionActions.map((action) => <td key={action} className="px-2 py-2">{group.byAction[action].length === 0 ? <span className="text-muted-foreground">-</span> : group.byAction[action].map((permission) => {
                    const checked = draftPermissionIds.includes(permission.id);
                    const differs = compareIds !== null && checked !== compareIds.includes(permission.id);
                    return <label key={permission.id} title={permission.permissionCode} className={["mb-1 flex min-h-10 cursor-pointer items-start gap-2 p-1.5 focus-within:ring-2 focus-within:ring-primary", differs ? "bg-primary/10" : "hover:bg-muted"].join(" ")}>
                      <input type="checkbox" checked={checked} disabled={!canEditProfile || !permissionsLoaded || isPending} onChange={() => togglePermission(permission.id)} className="mt-0.5 h-4 w-4 shrink-0 accent-primary" />
                      <span className="min-w-0 break-words text-xs leading-5">{permissionLabel(permission)}{permissionPresentation(permission.permissionCode)?.[3] && <span title="Izin penting" className="ml-1 font-semibold text-warning">!</span>}{differs && <span className="block text-muted-foreground">Role pembanding: {compareIds?.includes(permission.id) ? "diberikan" : "tidak ada"}</span>}</span>
                    </label>;
                  })}</td>)}
                </tr>)}</tbody>
              </table>
            </div>
            {permissionMatrixRows.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">Tidak ada izin yang cocok.</p>}
          </div>}

          {canEditProfile && <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 border-t border-border bg-card p-3">
            <p className="text-sm text-muted-foreground">{changeCount} perubahan belum disimpan</p>
            <div className="flex gap-2"><button type="button" onClick={cancelEditing} disabled={isPending} className="h-9 border border-border px-3 text-sm hover:bg-muted disabled:opacity-50">Batal</button><button type="button" onClick={() => void submitRoleProfile()} disabled={isPending || outcomeUnknown || !permissionsLoaded || isFetchingPermissions || !form.roleName.trim() || changeCount === 0} className="inline-flex h-9 items-center gap-2 border border-primary bg-primary/10 px-3 text-sm text-app-accent-ink hover:bg-primary/20 disabled:opacity-50"><Save className="h-4 w-4" /> {isPending ? "Menyimpan..." : "Simpan perubahan"}</button></div>
          </div>}
        </main>
      </div>

      <ScopeDialog open={scopeDialog !== null} kind={scopeDialog} canEdit={canEditProfile} options={scopeDialog === "division" ? references.divisions : references.units} initialMode={scopeDialog === "division" ? form.scopePreset.divisionMode : form.scopePreset.unitMode} initialIds={scopeDialog === "division" ? form.scopePreset.divisionIds : form.scopePreset.unitIds} onClose={() => setScopeDialog(null)} onApply={applyScopeDialog} />
    </div>
  );
}
