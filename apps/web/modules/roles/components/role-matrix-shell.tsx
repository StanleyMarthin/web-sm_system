"use client";

import type {
  PermissionRecord,
  RoleDivisionScopeMode,
  RoleRecord,
  RoleReferenceOption,
  RoleScopeBasis,
  RoleScopePreset,
  RoleUnitScopeMode,
} from "@smsystem/contracts/rbac";
import {
  CheckCircle2,
  ChevronRight,
  Pencil,
  Plus,
  Save,
  Search,
  Settings2,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { Fragment, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  createRole,
  fetchRolePermissions,
  saveRolePermissions,
  updateRole,
} from "@/shared/api/roles";

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

interface ApprovalBlueprint {
  key: string;
  label: string;
  roleLevel: string;
  approvalRank: string;
  note: string;
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

const approvalBlueprints: ApprovalBlueprint[] = [
  {
    key: "support_staff",
    label: "Staff Support",
    roleLevel: "100",
    approvalRank: "",
    note: "Operasional harian, tidak masuk rantai approval.",
  },
  {
    key: "coordinator_support",
    label: "Koordinator Support",
    roleLevel: "140",
    approvalRank: "",
    note: "Gudang, finance, atau admin spesialis tanpa approval proyek.",
  },
  {
    key: "division_lead",
    label: "Ketua Divisi",
    roleLevel: "180",
    approvalRank: "1",
    note: "Pemeriksa pertama dari divisi yang memegang pekerjaan.",
  },
  {
    key: "advisor",
    label: "Advisor",
    roleLevel: "220",
    approvalRank: "2",
    note: "Pengawas teknis dan validasi lintas pekerjaan divisi.",
  },
  {
    key: "project_head",
    label: "KP / Kepala Produksi",
    roleLevel: "320",
    approvalRank: "3",
    note: "Penanggung jawab unit atau proyek pada tahap akhir operasional.",
  },
  {
    key: "global_management",
    label: "PM / MP / MIS",
    roleLevel: "900",
    approvalRank: "9",
    note: "Kontrol global lintas unit, approval pusat, dan audit penuh.",
  },
];

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
      return "Runtime scope: semua unit";
    case "ASSIGNED_UNITS":
      return "Runtime scope: unit pegangan";
    case "ASSIGNED_DIVISIONS":
      return "Runtime scope: divisi pegangan";
    case "OWN_DIVISION":
      return "Runtime scope: divisi utama user";
    default:
      return "Runtime scope: diri sendiri";
  }
}

function sectionTitle(audience: PermissionRecord["audience"] | undefined): string {
  switch (audience) {
    case "WEB":
      return "Dipakai di Web";
    case "MOBILE":
      return "Dipakai di Mobile";
    default:
      return "Dipakai di Web dan Mobile";
  }
}

function isReservedSuperAdminRole(roleName: string | undefined): boolean {
  return roleName?.trim().toLowerCase() === "mis";
}

function resolveApprovalBlueprintKey(form: RoleFormState): string {
  const match = approvalBlueprints.find(
    (blueprint) =>
      blueprint.roleLevel === form.roleLevel &&
      blueprint.approvalRank === form.approvalRank,
  );
  return match?.key ?? "legacy";
}

function buildApprovalChoices(form: RoleFormState): ApprovalBlueprint[] {
  const activeKey = resolveApprovalBlueprintKey(form);
  if (activeKey !== "legacy") {
    return approvalBlueprints;
  }

  return [
    ...approvalBlueprints,
    {
      key: "legacy",
      label: "Nilai Lama",
      roleLevel: form.roleLevel || "0",
      approvalRank: form.approvalRank,
      note: "Nilai lama masih terbaca. Pilih lane standar agar admin lebih mudah mengelolanya.",
    },
  ];
}

function mapIdsToLabels(values: string[], options: RoleReferenceOption[]): string[] {
  if (values.length === 0) {
    return [];
  }

  const optionMap = new Map(options.map((option) => [option.value, option.label]));
  return values.map((value) => optionMap.get(value) ?? value);
}

function humanizePermissionCode(permissionCode: string): string {
  return permissionCode
    .split("_")
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0) + chunk.slice(1).toLowerCase())
    .join(" ");
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

    setMode(initialMode);
    setSelectedIds(initialIds);
    setSearch("");
    setPickerValue("");
    setActiveRowValue("");
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
      <div className="mx-auto flex h-full max-w-4xl flex-col border border-gray-300 dark:border-white/10 bg-slate-50 dark:bg-[#0a0a0c]">
        <div className="flex items-start justify-between gap-4 border-b border-gray-300 dark:border-white/5 px-6 py-4">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-[0.12em] text-gray-500 dark:text-white/30">
              {isDivision ? "Scope Divisi" : "Scope Unit"}
            </p>
            <h3 className="text-[13px] font-mono text-gray-950 dark:text-white mt-0.5">
              {isDivision ? "Atur lingkup divisi" : "Atur lingkup unit"}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="border border-gray-300 dark:border-white/10 p-1.5 text-gray-400 dark:text-white/40 hover:text-gray-950 dark:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 gap-6 overflow-hidden px-6 py-5 lg:grid-cols-[380px_minmax(0,1fr)]">
          <div className="border border-gray-300 dark:border-white/5 bg-white dark:bg-[#111114] p-4">
            <p className="text-[10px] font-mono uppercase tracking-[0.12em] text-gray-500 dark:text-white/30">
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
                        ? "border-amber-500/30 bg-amber-500/[0.04]"
                        : "border-gray-300 dark:border-white/5 bg-slate-50 dark:bg-[#0a0a0c] hover:border-gray-300 dark:border-white/10",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-[11px] font-mono text-gray-950 dark:text-white">{option.label}</p>
                      {selected ? (
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 text-amber-400" />
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex min-h-0 flex-col border border-gray-300 dark:border-white/5 bg-white dark:bg-[#111114] p-4">
            <div className="flex items-start justify-between gap-4">
              <p className="text-[10px] font-mono uppercase tracking-[0.12em] text-gray-500 dark:text-white/30">
                {listTitle}
              </p>
              {usesList ? (
                <button
                  type="button"
                  onClick={removeSelectedValue}
                  disabled={!canEdit || !activeRowValue}
                  className="border border-red-500/20 px-2 py-1 text-[10px] font-mono uppercase text-red-400 hover:border-red-500/40 transition-colors disabled:opacity-40"
                >
                  Hapus
                </button>
              ) : null}
            </div>

            {usesList ? (
              <>
                <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_240px_auto]">
                  <label className="space-y-1">
                    <span className="text-[11px] uppercase tracking-[0.14em] text-gray-400 dark:text-white/40">
                      Cari {isDivision ? "divisi" : "unit"}
                    </span>
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      disabled={!canEdit}
                      placeholder={`Ketik nama ${isDivision ? "divisi" : "unit"}`}
                      className="h-8 w-full border border-gray-300 dark:border-white/10 bg-slate-50 dark:bg-[#0a0a0c] px-2 text-[11px] font-mono text-gray-950 dark:text-white outline-none focus:border-amber-500/40"
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-gray-500 dark:text-white/30">
                      Pilih data
                    </span>
                    <select
                      value={pickerValue}
                      onChange={(event) => setPickerValue(event.target.value)}
                      disabled={!canEdit}
                      className="h-8 w-full border border-gray-300 dark:border-white/10 bg-slate-50 dark:bg-[#0a0a0c] px-2 text-[11px] font-mono text-gray-950 dark:text-white outline-none focus:border-amber-500/40"
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
                      className="inline-flex h-8 items-center justify-center border border-amber-500/30 bg-amber-500/[0.04] px-3 text-amber-400 hover:bg-amber-500/10 transition-colors disabled:opacity-40"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-4 min-h-0 flex-1 overflow-hidden border border-gray-300 dark:border-white/5">
                  <div className="grid grid-cols-[48px_minmax(0,1fr)] border-b border-gray-300 dark:border-white/5 px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.12em] text-gray-500 dark:text-white/25">
                    <span>No</span>
                    <span>{isDivision ? "Divisi" : "Unit"}</span>
                  </div>
                  <div className="max-h-[340px] overflow-y-auto">
                    {selectedIds.length === 0 ? (
                      <div className="px-3 py-6 text-[11px] font-mono text-gray-500 dark:text-white/25">
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
                                ? "bg-amber-500/[0.06] text-gray-950 dark:text-white"
                                : "text-gray-700 dark:text-white/60 hover:bg-gray-100 dark:hover:bg-white/[0.02]",
                            ].join(" ")}
                          >
                            <span className="text-[10px] font-mono text-gray-500 dark:text-white/25">{index + 1}</span>
                            <span className="text-[11px] font-mono">{option?.label ?? value}</span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="mt-4 border border-gray-300 dark:border-white/5 px-3 py-4 text-[11px] font-mono text-gray-500 dark:text-white/30">
                — Mode ini tidak memerlukan daftar pegangan.
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-gray-300 dark:border-white/5 px-6 py-3">
          <button
            type="button"
            onClick={onClose}
            className="border border-gray-300 dark:border-white/10 px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.12em] text-gray-500 dark:text-white/50 hover:text-gray-950 dark:text-white transition-colors"
          >
            Tutup
          </button>
          <button
            type="button"
            onClick={applyChanges}
            disabled={!canEdit}
            className="inline-flex items-center gap-1.5 border border-amber-500/40 bg-amber-500/[0.06] px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.12em] text-amber-500 hover:bg-amber-500/10 transition-colors disabled:opacity-40"
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
  const [editorMode, setEditorMode] = useState<EditorMode>("edit");
  const [isEditing, setIsEditing] = useState(false);
  const [roleSearch, setRoleSearch] = useState(
    roles.find((role) => role.id === activeRoleId)?.roleName ?? "",
  );
  const [scopeDialog, setScopeDialog] = useState<"division" | "unit" | null>(null);
  const [permissionViewFilter, setPermissionViewFilter] = useState<
    "WEB" | "MOBILE"
  >("WEB");
  const [permissionSearch, setPermissionSearch] = useState("");
  const [form, setForm] = useState<RoleFormState>(() =>
    roleToForm(roles.find((role) => role.id === activeRoleId)),
  );
  const [isFetchingPermissions, setIsFetchingPermissions] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const permissionCacheRef = useRef<Record<number, number[]>>({});

  const selectedRole = roleCatalog.find((role) => role.id === selectedRoleId);
  const isReservedSuperAdmin = isReservedSuperAdminRole(selectedRole?.roleName);
  const canEditProfile = editorMode === "create" || isEditing;
  const approvalChoices = useMemo(() => buildApprovalChoices(form), [form]);
  const selectedApprovalKey = resolveApprovalBlueprintKey(form);

  const filteredRoles = useMemo(() => {
    const keyword = roleSearch.trim().toLowerCase();
    if (!keyword) {
      return roleCatalog.slice(0, 8);
    }

    return roleCatalog.filter((role) => {
      const haystack = `${role.roleName} ${role.description ?? ""}`.toLowerCase();
      return haystack.includes(keyword);
    });
  }, [roleCatalog, roleSearch]);

  const permissionRows = useMemo(() => {
    return [...permissions]
      .filter((permission) => {
        return permission.platforms?.includes(permissionViewFilter) ?? false;
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
      const moduleName = permission.moduleName?.trim() || "General";
      const existing = grouped.get(moduleName) ?? [];
      existing.push(permission);
      grouped.set(moduleName, existing);
    }

    return Array.from(grouped.entries()).map(([moduleName, items]) => ({
      moduleName,
      items,
    }));
  }, [permissionRows]);

  const filteredPermissionGroups = permissionSearch.trim()
    ? permissionGroups.filter(
        (group) =>
          group.moduleName.toLowerCase().includes(permissionSearch.toLowerCase()) ||
          group.items.some((item) =>
            item.permissionCode.toLowerCase().includes(permissionSearch.toLowerCase()),
          ),
      )
    : permissionGroups;

  const derivedScopeBasis = deriveScopeBasis(form.scopePreset);
  const divisionLabels = mapIdsToLabels(form.scopePreset.divisionIds, references.divisions);
  const unitLabels = mapIdsToLabels(form.scopePreset.unitIds, references.units);

  const showSearchResults =
    roleSearch.trim().length > 0 &&
    !(
      filteredRoles.length === 1 &&
      filteredRoles[0]?.id === selectedRoleId &&
      filteredRoles[0]?.roleName.toLowerCase() === roleSearch.trim().toLowerCase()
    );

  useEffect(() => {
    setRoleCatalog(roles);
  }, [roles]);

  useEffect(() => {
    if (activeRoleId > 0 && activePermissionIds.length > 0) {
      permissionCacheRef.current[activeRoleId] = activePermissionIds;
    }
  }, [activePermissionIds, activeRoleId]);

  useEffect(() => {
    if (editorMode === "create") {
      return;
    }

    setForm(roleToForm(selectedRole));
    if (selectedRole?.roleName) {
      setRoleSearch(selectedRole.roleName);
    }
  }, [editorMode, selectedRole]);

  useEffect(() => {
    if (selectedRoleId <= 0) {
      setDraftPermissionIds([]);
      return;
    }

    const cachedPermissionIds = permissionCacheRef.current[selectedRoleId];
    if (cachedPermissionIds) {
      setDraftPermissionIds(cachedPermissionIds);
      return;
    }

    let isCancelled = false;
    setIsFetchingPermissions(true);
    setError(null);
    setMessage(null);

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
        setDraftPermissionIds(permissionIds);
      } finally {
        if (!isCancelled) {
          setIsFetchingPermissions(false);
        }
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [selectedRoleId]);

  function togglePermission(permissionId: number) {
    setDraftPermissionIds((currentValue) =>
      currentValue.includes(permissionId)
        ? currentValue.filter((value) => value !== permissionId)
        : [...currentValue, permissionId],
    );
  }

  function openCreateRole() {
    setEditorMode("create");
    setSelectedRoleId(0);
    setDraftPermissionIds([]);
    setIsEditing(true);
    setError(null);
    setMessage(null);
    setRoleSearch("");
    setForm(emptyRoleForm());
  }

  function selectExistingRole(roleId: number) {
    setEditorMode("edit");
    setSelectedRoleId(roleId);
    setIsEditing(false);
    setError(null);
    setMessage(null);
  }

  function startEditing() {
    if (editorMode === "create") {
      return;
    }
    if (isReservedSuperAdmin) {
      setError(null);
      setMessage("Role MIS selalu menjadi Super Admin. Profil intinya tidak bisa diturunkan dari panel ini.");
      return;
    }
    setIsEditing(true);
    setError(null);
    setMessage(null);
  }

  function cancelEditing() {
    setError(null);
    setMessage(null);
    if (editorMode === "create") {
      const fallbackRole = roleCatalog.find((role) => role.id === activeRoleId) ?? roleCatalog[0];
      if (fallbackRole) {
        setEditorMode("edit");
        setSelectedRoleId(fallbackRole.id);
        setForm(roleToForm(fallbackRole));
        setRoleSearch(fallbackRole.roleName);
      } else {
        setForm(emptyRoleForm());
        setSelectedRoleId(0);
      }
      setIsEditing(false);
      return;
    }

    setForm(roleToForm(selectedRole));
    setIsEditing(false);
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

  function submitRoleProfile() {
    if (isReservedSuperAdmin) {
      setError(null);
      setMessage("Role MIS selalu menjadi Super Admin. Profil intinya tidak bisa diturunkan dari panel ini.");
      return;
    }

    setMessage(null);
    setError(null);

    const payload = {
      roleName: form.roleName.trim(),
      description: form.description.trim() || null,
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

    startTransition(() => {
      void (async () => {
        if (editorMode === "create") {
          const result = await createRole(payload);
          if (!result.success) {
            setError(result.message);
            return;
          }

          setRoleCatalog((currentValue) =>
            [...currentValue, result.role].sort((left, right) =>
              left.roleName.localeCompare(right.roleName),
            ),
          );
          setSelectedRoleId(result.role.id);
          setEditorMode("edit");
          setIsEditing(false);
          setForm(roleToForm(result.role));
          setRoleSearch(result.role.roleName);
          permissionCacheRef.current[result.role.id] = [];
          setMessage(`Role ${result.role.roleName} berhasil dibuat.`);
          return;
        }

        if (!selectedRoleId) {
          return;
        }

        const result = await updateRole(selectedRoleId, payload);
        if (!result.success) {
          setError(result.message);
          return;
        }

        setRoleCatalog((currentValue) =>
          currentValue
            .map((role) => (role.id === result.role.id ? result.role : role))
            .sort((left, right) => left.roleName.localeCompare(right.roleName)),
        );
        setForm(roleToForm(result.role));
        setRoleSearch(result.role.roleName);
        setIsEditing(false);
        setMessage(`Role ${result.role.roleName} berhasil diperbarui.`);
      })();
    });
  }

  function submitPermissionMatrix() {
    if (selectedRoleId <= 0 || !canEditProfile) {
      return;
    }

    if (isReservedSuperAdmin) {
      setError(null);
      setMessage("Role MIS selalu membawa seluruh checklist akses. Tidak perlu disimpan manual.");
      return;
    }

    setMessage(null);
    setError(null);

    startTransition(() => {
      void (async () => {
        const result = await saveRolePermissions(selectedRoleId, draftPermissionIds);
        if (!result.success) {
          setError(result.message);
          return;
        }

        permissionCacheRef.current[selectedRoleId] = [...draftPermissionIds];
        setMessage("Checklist akses berhasil disimpan.");
      })();
    });
  }

  return (
    <div className="space-y-4">
      {message ? (
        <div className="border border-emerald-500/20 bg-emerald-500/[0.04] px-3 py-2 text-[11px] font-mono text-emerald-400">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="border border-red-500/20 bg-red-500/[0.04] px-3 py-2 text-[11px] font-mono text-red-400">
          {error}
        </div>
      ) : null}

      <div className="border border-gray-300 dark:border-white/5 bg-white dark:bg-[#111114] p-4">
        <div className="flex flex-col gap-3 border-b border-gray-300 dark:border-white/5 pb-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-[0.12em] text-gray-500 dark:text-white/30">
              Role Management
            </p>
            <h2 className="text-[13px] font-mono text-gray-900 dark:text-white/80 mt-0.5">
              Cari role, cek ringkasannya, lalu buka edit bila perlu
            </h2>
          </div>

          <button
            type="button"
            onClick={openCreateRole}
            className="flex items-center gap-1.5 border border-gray-300 dark:border-white/10 bg-slate-50 dark:bg-[#0a0a0c] px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.12em] text-gray-500 dark:text-white/50 hover:text-gray-950 dark:text-white hover:border-white/30 transition-colors"
          >
            <Plus className="h-3 w-3" />
            Tambah Role
          </button>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,390px)_minmax(0,1fr)]">
          <div className="space-y-0">
            <label className="space-y-1">
              <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-gray-500 dark:text-white/30">
                Cari nama role
              </span>
              <div className="flex items-center gap-2 border-b border-gray-300 dark:border-white/10 px-2">
                <Search className="h-3.5 w-3.5 text-gray-500 dark:text-white/25 shrink-0" />
                <input
                  value={roleSearch}
                  onChange={(event) => setRoleSearch(event.target.value)}
                  placeholder="Ketik nama role..."
                  className="h-8 w-full bg-transparent text-[11px] font-mono text-gray-950 dark:text-white outline-none placeholder:text-gray-400 dark:text-white/20"
                />
              </div>
            </label>

            {showSearchResults ? (
              <div className="border border-gray-300 dark:border-white/5 bg-slate-50 dark:bg-[#0a0a0c]">
                <div className="max-h-[260px] overflow-y-auto">
                  {filteredRoles.length === 0 ? (
                    <div className="px-3 py-3 text-[10px] font-mono text-gray-500 dark:text-white/25">
                      — Role tidak ditemukan.
                    </div>
                  ) : (
                    filteredRoles.map((role) => {
                      const selected = editorMode === "edit" && selectedRoleId === role.id;
                      return (
                        <button
                          key={role.id}
                          type="button"
                          onClick={() => selectExistingRole(role.id)}
                          className={[
                            "w-full border-b border-gray-300 dark:border-white/5 px-3 py-2 text-left transition-colors",
                            selected
                              ? "bg-amber-500/[0.06] border-l-2 border-l-amber-500"
                              : "hover:bg-gray-100 dark:hover:bg-white/[0.02]",
                          ].join(" ")}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-[11px] font-mono text-gray-950 dark:text-white">{role.roleName}</p>
                              <p className="text-[10px] text-gray-500 dark:text-white/30 mt-0.5">
                                {role.description ?? "Belum ada catatan role."}
                              </p>
                            </div>
                            <span className="font-mono text-[10px] text-gray-500 dark:text-white/30 border border-gray-300 dark:border-white/10 px-1.5 py-0.5 shrink-0">
                              L{role.profile?.roleLevel ?? "-"}
                            </span>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            ) : null}
          </div>

          <div className="border border-gray-300 dark:border-white/5 bg-slate-50 dark:bg-[#0a0a0c] p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <p className="text-[10px] font-mono uppercase tracking-[0.12em] text-gray-500 dark:text-white/30">
                  Role aktif
                </p>
                <h3 className="text-[13px] font-mono text-gray-950 dark:text-white mt-0.5">
                  {editorMode === "create"
                    ? "Role baru"
                    : selectedRole?.roleName ?? "Belum ada role terpilih"}
                </h3>
              </div>

              <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[420px]">
                <div className="border border-gray-300 dark:border-white/5 bg-white dark:bg-[#111114] px-3 py-2">
                  <p className="text-[10px] font-mono uppercase tracking-[0.12em] text-gray-500 dark:text-white/30">
                    Level
                  </p>
                  <p className="text-[12px] font-mono text-gray-950 dark:text-white mt-0.5">{form.roleLevel || "-"}</p>
                </div>
                <div className="border border-gray-300 dark:border-white/5 bg-white dark:bg-[#111114] px-3 py-2">
                  <p className="text-[10px] font-mono uppercase tracking-[0.12em] text-gray-500 dark:text-white/30">
                    Approval
                  </p>
                  <p className="text-[12px] font-mono text-gray-950 dark:text-white mt-0.5">{form.approvalRank || "-"}</p>
                </div>
                <div className="border border-gray-300 dark:border-white/5 bg-white dark:bg-[#111114] px-3 py-2">
                  <p className="text-[10px] font-mono uppercase tracking-[0.12em] text-gray-500 dark:text-white/30">
                    Runtime Scope
                  </p>
                  <p className="text-[12px] font-mono text-gray-950 dark:text-white mt-0.5">{humanizeDerivedScope(derivedScopeBasis)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="border border-gray-300 dark:border-white/5 bg-white dark:bg-[#111114] p-4">
        <div className="flex flex-col gap-3 border-b border-gray-300 dark:border-white/5 pb-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-[0.12em] text-gray-500 dark:text-white/30">
              Pengaturan Role
            </p>
            <h1 className="text-[13px] font-mono text-gray-950 dark:text-white mt-0.5">
              {editorMode === "create" ? "Role Baru" : selectedRole?.roleName ?? "Pilih Role"}
            </h1>
            {isReservedSuperAdmin ? (
              <p className="mt-2 border border-amber-500/25 bg-amber-500/[0.04] px-2 py-1.5 text-[10px] font-mono text-amber-400">
                Role MIS dikunci sebagai Super Admin.
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {editorMode === "edit" ? (
              <button
                type="button"
                onClick={isEditing ? cancelEditing : startEditing}
                className="flex items-center gap-1.5 border border-gray-300 dark:border-white/10 px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.12em] text-gray-500 dark:text-white/50 hover:text-gray-950 dark:text-white transition-colors"
              >
                {isEditing ? <X className="h-3 w-3" /> : <Pencil className="h-3 w-3" />}
                {isEditing ? "Batal Ubah" : "Buka Edit"}
              </button>
            ) : null}

            <button
              type="button"
              onClick={submitRoleProfile}
              disabled={
                isPending ||
                !canEditProfile ||
                !form.roleName.trim() ||
                !form.roleLevel.trim() ||
                (!form.webEnabled && !form.mobileEnabled)
              }
              className="flex items-center gap-1.5 border border-amber-500/40 bg-amber-500/[0.06] px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.12em] text-amber-500 hover:bg-amber-500/10 transition-colors disabled:opacity-30"
            >
              <Save className="h-3 w-3" />
              Simpan Role
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-gray-500 dark:text-white/30">
              Nama Role
            </span>
            <input
              value={form.roleName}
              onChange={(event) =>
                setForm((currentValue) => ({
                  ...currentValue,
                  roleName: event.target.value,
                }))
              }
              disabled={!canEditProfile || isReservedSuperAdmin}
              className="h-8 w-full border border-gray-300 dark:border-white/10 bg-slate-50 dark:bg-[#0a0a0c] px-2 text-[11px] font-mono text-gray-950 dark:text-white outline-none focus:border-amber-500/40 disabled:cursor-not-allowed disabled:opacity-70"
            />
          </label>

          <label className="space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-gray-500 dark:text-white/30">
              Catatan Role
            </span>
            <input
              value={form.description}
              onChange={(event) =>
                setForm((currentValue) => ({
                  ...currentValue,
                  description: event.target.value,
                }))
              }
              disabled={!canEditProfile || isReservedSuperAdmin}
              className="h-8 w-full border border-gray-300 dark:border-white/10 bg-slate-50 dark:bg-[#0a0a0c] px-2 text-[11px] font-mono text-gray-950 dark:text-white outline-none focus:border-amber-500/40 disabled:cursor-not-allowed disabled:opacity-70"
              placeholder="Contoh: advisor upholstery, admin gudang bahan"
            />
          </label>

          <div className="md:col-span-2 border border-gray-300 dark:border-white/5 bg-slate-50 dark:bg-[#0a0a0c] p-4">
            <div className="flex items-start justify-between gap-4">
              <p className="text-[10px] font-mono uppercase tracking-[0.12em] text-gray-500 dark:text-white/30">
                Lane Approval &amp; Tingkatan
              </p>
              <div className="border border-gray-300 dark:border-white/5 bg-white dark:bg-[#111114] px-3 py-2 text-right shrink-0">
                <p className="text-[10px] font-mono uppercase tracking-[0.12em] text-gray-500 dark:text-white/30">Nilai aktif</p>
                <p className="text-[12px] font-mono text-gray-950 dark:text-white mt-0.5">
                  Level {form.roleLevel || "-"} · Approval {form.approvalRank || "-"}
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-2 xl:grid-cols-3">
              {approvalChoices.map((blueprint) => {
                const selected = blueprint.key === selectedApprovalKey;
                return (
                  <button
                    key={blueprint.key}
                    type="button"
                    onClick={() => applyApprovalBlueprint(blueprint)}
                    disabled={!canEditProfile || isReservedSuperAdmin}
                    className={[
                      "border px-4 py-3 text-left transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-40",
                      selected
                        ? "border-amber-500/30 bg-amber-500/[0.04]"
                        : "border-gray-300 dark:border-white/5 bg-white dark:bg-[#111114] hover:border-gray-300 dark:border-white/10",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-[11px] font-mono text-gray-950 dark:text-white">{blueprint.label}</p>
                      {selected ? (
                        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 text-amber-400 shrink-0" />
                      ) : null}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-mono uppercase tracking-[0.12em] text-gray-500 dark:text-white/30">
                      <span>L{blueprint.roleLevel}</span>
                      <span>Rank {blueprint.approvalRank || "-"}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="md:col-span-2 border border-gray-300 dark:border-white/5 bg-slate-50 dark:bg-[#0a0a0c] p-4">
            <div className="flex items-start justify-between gap-4">
              <p className="text-[10px] font-mono uppercase tracking-[0.12em] text-gray-500 dark:text-white/30">
                Lingkup Data
              </p>
              <div className="border border-gray-300 dark:border-white/5 bg-white dark:bg-[#111114] px-3 py-1.5 text-[11px] font-mono text-gray-500 dark:text-white/50 shrink-0">
                {humanizeDerivedScope(derivedScopeBasis)}
              </div>
            </div>

            <div className="mt-4 grid gap-3 xl:grid-cols-2">
              <div className="border border-gray-300 dark:border-white/5 bg-white dark:bg-[#111114] px-4 py-3">
                <div className="flex items-start justify-between gap-4">
                  <p className="text-[11px] font-mono text-gray-950 dark:text-white">Akses Divisi</p>
                  <button
                    type="button"
                    onClick={() => setScopeDialog("division")}
                    disabled={!canEditProfile || isReservedSuperAdmin}
                    className="border border-gray-300 dark:border-white/10 px-2 py-1 text-[10px] font-mono uppercase text-gray-400 dark:text-white/40 hover:text-gray-950 dark:text-white transition-colors disabled:opacity-40"
                  >
                    Atur
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  <span className="border border-gray-300 dark:border-white/10 px-2 py-0.5 text-[10px] font-mono uppercase text-gray-400 dark:text-white/40">
                    {divisionModeOptions.find(
                      (option) => option.value === form.scopePreset.divisionMode,
                    )?.label ?? "Tidak dipakai"}
                  </span>
                  {divisionLabels.slice(0, 4).map((label) => (
                    <span
                      key={label}
                      className="border border-amber-500/20 px-2 py-0.5 text-[10px] font-mono text-amber-400"
                    >
                      {label}
                    </span>
                  ))}
                  {divisionLabels.length > 4 ? (
                    <span className="border border-gray-300 dark:border-white/10 px-2 py-0.5 text-[10px] font-mono text-gray-500 dark:text-white/30">
                      +{divisionLabels.length - 4} divisi
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="border border-gray-300 dark:border-white/5 bg-white dark:bg-[#111114] px-4 py-3">
                <div className="flex items-start justify-between gap-4">
                  <p className="text-[11px] font-mono text-gray-950 dark:text-white">Akses Unit</p>
                  <button
                    type="button"
                    onClick={() => setScopeDialog("unit")}
                    disabled={!canEditProfile || isReservedSuperAdmin}
                    className="border border-gray-300 dark:border-white/10 px-2 py-1 text-[10px] font-mono uppercase text-gray-400 dark:text-white/40 hover:text-gray-950 dark:text-white transition-colors disabled:opacity-40"
                  >
                    Atur
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  <span className="border border-gray-300 dark:border-white/10 px-2 py-0.5 text-[10px] font-mono uppercase text-gray-400 dark:text-white/40">
                    {unitModeOptions.find(
                      (option) => option.value === form.scopePreset.unitMode,
                    )?.label ?? "Tidak dipakai"}
                  </span>
                  {unitLabels.slice(0, 4).map((label) => (
                    <span
                      key={label}
                      className="border border-amber-500/20 px-2 py-0.5 text-[10px] font-mono text-amber-400"
                    >
                      {label}
                    </span>
                  ))}
                  {unitLabels.length > 4 ? (
                    <span className="border border-gray-300 dark:border-white/10 px-2 py-0.5 text-[10px] font-mono text-gray-500 dark:text-white/30">
                      +{unitLabels.length - 4} unit
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <label className="space-y-1 md:col-span-2">
            <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-gray-500 dark:text-white/30">
              Catatan Teknis
            </span>
            <textarea
              value={form.notes}
              onChange={(event) =>
                setForm((currentValue) => ({
                  ...currentValue,
                  notes: event.target.value,
                }))
              }
              disabled={!canEditProfile || isReservedSuperAdmin}
              rows={3}
              className="w-full border border-gray-300 dark:border-white/10 bg-slate-50 dark:bg-[#0a0a0c] px-2 py-2 text-[11px] font-mono text-gray-950 dark:text-white outline-none focus:border-amber-500/40 disabled:cursor-not-allowed disabled:opacity-70"
              placeholder="Catatan teknis role..."
            />
          </label>

          <div className="grid gap-2 md:col-span-2 md:grid-cols-2">
            <label className="flex items-center gap-3 border border-gray-300 dark:border-white/5 bg-slate-50 dark:bg-[#0a0a0c] px-4 py-2">
              <input
                type="checkbox"
                checked={form.webEnabled}
                onChange={(event) =>
                  setForm((currentValue) => ({
                    ...currentValue,
                    webEnabled: event.target.checked,
                  }))
                }
                disabled={!canEditProfile || isReservedSuperAdmin}
                className="h-4 w-4 rounded border-white/20 bg-transparent text-amber-500"
              />
              <p className="text-[11px] font-mono text-gray-950 dark:text-white">Aktif di Web</p>
            </label>

            <label className="flex items-center gap-3 border border-gray-300 dark:border-white/5 bg-slate-50 dark:bg-[#0a0a0c] px-4 py-2">
              <input
                type="checkbox"
                checked={form.mobileEnabled}
                onChange={(event) =>
                  setForm((currentValue) => ({
                    ...currentValue,
                    mobileEnabled: event.target.checked,
                  }))
                }
                disabled={!canEditProfile || isReservedSuperAdmin}
                className="h-4 w-4 rounded border-white/20 bg-transparent text-amber-500"
              />
              <p className="text-[11px] font-mono text-gray-950 dark:text-white">Aktif di Mobile</p>
            </label>
          </div>
        </div>
      </div>

      <div className="border border-gray-300 dark:border-white/5 bg-white dark:bg-[#111114] p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-[0.12em] text-gray-500 dark:text-white/30">
              Checklist Akses
            </p>
            <h2 className="text-[13px] font-mono text-gray-900 dark:text-white/80 mt-0.5">
              Permission per Fitur
            </h2>
            {isReservedSuperAdmin ? (
              <p className="mt-1 text-[10px] font-mono text-amber-400/80">
                Checklist role MIS selalu penuh.
              </p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={submitPermissionMatrix}
            disabled={
              isPending ||
              isFetchingPermissions ||
              selectedRoleId <= 0 ||
              editorMode === "create" ||
              isReservedSuperAdmin ||
              !canEditProfile
            }
            className="flex items-center gap-1.5 border border-amber-500/40 bg-amber-500/[0.06] px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.12em] text-amber-500 hover:bg-amber-500/10 transition-colors disabled:opacity-30"
          >
            <Save className="h-3 w-3" />
            Simpan Checklist
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="flex border-b border-gray-300 dark:border-white/5">
            {[
              { key: "WEB", label: "Web" },
              { key: "MOBILE", label: "Mobile" },
            ].map((filter) => {
              const selected = permissionViewFilter === filter.key;
              return (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() => setPermissionViewFilter(filter.key as "WEB" | "MOBILE")}
                  className={[
                    "px-4 py-1.5 text-[11px] font-mono uppercase tracking-[0.12em] transition-colors",
                    selected
                      ? "text-amber-500 border-b-2 border-amber-500"
                      : "text-gray-500 dark:text-white/30 hover:text-gray-700 dark:text-white/60",
                  ].join(" ")}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>

          <div className="border border-gray-300 dark:border-white/5 px-2 py-0.5 text-[10px] font-mono text-gray-500 dark:text-white/30">
            {permissionViewFilter === "WEB"
              ? "Lane akses web aktif"
              : "Lane akses mobile aktif"}
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <div className="border border-gray-300 dark:border-white/5 bg-slate-50 dark:bg-[#0a0a0c] px-3 py-2">
            <p className="text-[10px] font-mono uppercase tracking-[0.12em] text-gray-500 dark:text-white/30">Ringkasan lane</p>
            <p className="text-[11px] font-mono text-gray-950 dark:text-white mt-0.5">
              {permissionGroups.length} modul · {permissionRows.length} permission
            </p>
          </div>
        </div>

        {editorMode === "create" ? (
          <p className="mt-4 text-sm text-gray-600 dark:text-white/45">
            Simpan role baru dulu, setelah itu checklist akses akan aktif.
          </p>
        ) : null}
        {isFetchingPermissions ? (
          <p className="mt-4 text-sm text-gray-600 dark:text-white/45">
            Checklist akses sedang dimuat...
          </p>
        ) : null}

        <input
          value={permissionSearch}
          onChange={(e) => setPermissionSearch(e.target.value)}
          placeholder="Filter modul atau kode permission..."
          className="h-7 w-full border-b border-gray-300 dark:border-white/10 bg-transparent px-4 text-[11px] font-mono text-gray-700 dark:text-white/60 outline-none placeholder:text-gray-400 dark:text-white/20"
        />

        <div className="mt-0 border border-gray-300 dark:border-white/5 overflow-hidden">
          <div className="overflow-auto max-h-[480px]">
            <table className="min-w-full text-left">
              <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-[#0a0a0c] text-[11px] uppercase tracking-[0.12em] text-gray-500 dark:text-white/30 border-b border-gray-300 dark:border-white/10">
                <tr>
                  <th className="px-4 py-1.5 font-mono">Akses</th>
                  <th className="px-4 py-1.5 font-mono">Catatan</th>
                  <th className="px-4 py-1.5 text-center font-mono">Otorisasi</th>
                </tr>
              </thead>
              <tbody>
                {filteredPermissionGroups.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-4 py-10 text-center text-sm text-gray-500 dark:text-white/35"
                    >
                      Belum ada permission pada lane platform ini.
                    </td>
                  </tr>
                ) : (
                  filteredPermissionGroups.map((group) => (
                    <Fragment key={group.moduleName}>
                      <tr className="border-t border-gray-300 dark:border-white/5 bg-slate-50 dark:bg-[#0a0a0c]">
                        <td colSpan={3} className="px-4 py-1.5">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-gray-500 dark:text-white/30">
                              {group.moduleName}
                            </span>
                            <span className="border border-gray-300 dark:border-white/10 px-1.5 py-0.5 text-[10px] font-mono text-gray-500 dark:text-white/30">
                              {group.items.length}
                            </span>
                          </div>
                        </td>
                      </tr>

                      {group.items.map((permission) => {
                        const checked = draftPermissionIds.includes(permission.id);
                        return (
                          <tr
                            key={permission.id}
                            className="border-t border-white/[0.04] hover:bg-gray-100 dark:hover:bg-white/[0.02] transition-colors"
                          >
                            <td className="px-4 py-1.5">
                              <p className="text-[11px] font-mono text-gray-800 dark:text-white/70">
                                {humanizePermissionCode(permission.permissionCode)}
                              </p>
                              <p className="text-[10px] font-mono text-gray-500 dark:text-white/25 mt-0.5">
                                {permission.permissionCode}
                              </p>
                            </td>
                            <td className="px-4 py-1.5 text-[10px] text-gray-500 dark:text-white/30">
                              {permission.description ?? "Belum ada catatan permission."}
                            </td>
                            <td className="px-4 py-1.5 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => togglePermission(permission.id)}
                                  disabled={
                                    editorMode === "create" ||
                                    isReservedSuperAdmin ||
                                    !canEditProfile
                                  }
                                  className="h-4 w-4 rounded border-white/20 bg-transparent text-amber-500 disabled:opacity-40"
                                />
                                <span className="text-[10px] font-mono text-gray-500 dark:text-white/30">
                                  {checked ? "Aktif" : "Mati"}
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <ScopeDialog
        open={scopeDialog !== null}
        kind={scopeDialog}
        canEdit={canEditProfile && !isReservedSuperAdmin}
        options={scopeDialog === "division" ? references.divisions : references.units}
        initialMode={
          scopeDialog === "division"
            ? form.scopePreset.divisionMode
            : form.scopePreset.unitMode
        }
        initialIds={
          scopeDialog === "division"
            ? form.scopePreset.divisionIds
            : form.scopePreset.unitIds
        }
        onClose={() => setScopeDialog(null)}
        onApply={applyScopeDialog}
      />
    </div>
  );
}
