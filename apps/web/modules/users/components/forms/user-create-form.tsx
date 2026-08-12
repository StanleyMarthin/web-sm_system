"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTransition } from "react";
import { UserCog } from "lucide-react";
import { createUser } from "@/shared/api/users";
import type { UserGridReference } from "@smsystem/contracts/user";
import { useRouter } from "next/navigation";
import { groupDivisionOptions } from "../../division-options";

const createUserSchema = z.object({
  employeeId: z.string().min(1, "ID Pegawai wajib diisi"),
  fullName: z.string().min(1, "Nama lengkap wajib diisi"),
  email: z.string().email("Email tidak valid").or(z.literal("")).optional(),
  roleId: z.string().min(1, "Role wajib dipilih"),
  divisionId: z.string().min(1, "Divisi wajib dipilih"),
  grade: z.string().optional(),
  password: z.string().min(8, "Kata sandi minimal 8 karakter"),
  managedDivisionIds: z.array(z.string()),
});

type CreateUserFormValues = z.infer<typeof createUserSchema>;

interface UserCreateFormProps {
  references: UserGridReference;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
  onClose: () => void;
}

function buildScopeHint(role: UserGridReference["roles"][number] | undefined): string {
  if (!role) {
    return "Pilih role untuk melihat lingkup akses pengguna.";
  }

  switch (role?.scopeBasis) {
    case "GLOBAL":
      return "Role ini dapat melihat seluruh data sesuai permission yang dicentang.";
    case "ASSIGNED_DIVISIONS":
      return "Role ini mengikuti daftar divisi pegangan yang dicentang di bawah.";
    case "ASSIGNED_UNITS":
      return "Role ini mengikuti unit yang sedang dipegang pada assignment operasional. Daftar unit tidak diatur manual dari layar ini.";
    case "SELF_ONLY":
      return "Role ini hanya memakai data milik user itu sendiri.";
    case "OWN_DIVISION":
      return "Role ini mengikuti divisi utama user.";
    default:
      return "Lingkup akses role ini belum ditentukan.";
  }
}

export function UserCreateForm({ references, onSuccess, onError, onClose }: UserCreateFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isValid },
  } = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      employeeId: "",
      fullName: "",
      email: "",
      roleId: "",
      divisionId: "",
      grade: "",
      password: "",
      managedDivisionIds: [],
    },
    mode: "onChange",
  });

  const selectedRoleId = watch("roleId");
  const selectedRoleDefinition = references.roles.find((r) => r.value === selectedRoleId);
  const managedDivisionIds = watch("managedDivisionIds");
  const divisionGroups = groupDivisionOptions(references.divisions);

  const onSubmit = (data: CreateUserFormValues) => {
    startTransition(async () => {
      const createResult = await createUser({
        employeeId: data.employeeId.trim(),
        fullName: data.fullName.trim(),
        email: data.email?.trim() || null,
        password: data.password,
        roleId: Number(data.roleId),
        divisionId: Number(data.divisionId),
        grade: data.grade?.trim() || null,
        managedDivisionIds: data.managedDivisionIds.map(Number),
      });

      if (!createResult.success) {
        onError(createResult.message);
        return;
      }

      onSuccess(`Pengguna ${createResult.user?.employeeId || data.employeeId} berhasil dibuat.`);
      onClose();
      router.refresh();
    });
  };

  return (
    <form
      className="mt-4 grid min-h-0 overflow-y-auto overscroll-contain pr-1 gap-4 md:grid-cols-2"
      onSubmit={handleSubmit(onSubmit)}
    >
      <label className="space-y-1">
        <span className="text-xs uppercase tracking-[0.14em] text-foreground/45">ID Pegawai</span>
        <input
          {...register("employeeId")}
          className="h-11 w-full rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-foreground outline-none focus:border-primary/40"
        />
        {errors.employeeId && <p className="text-xs text-destructive">{errors.employeeId.message}</p>}
      </label>

      <label className="space-y-1">
        <span className="text-xs uppercase tracking-[0.14em] text-foreground/45">Nama Lengkap</span>
        <input
          {...register("fullName")}
          className="h-11 w-full rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-foreground outline-none focus:border-primary/40"
        />
        {errors.fullName && <p className="text-xs text-destructive">{errors.fullName.message}</p>}
      </label>

      <label className="space-y-1">
        <span className="text-xs uppercase tracking-[0.14em] text-foreground/45">Email</span>
        <input
          {...register("email")}
          className="h-11 w-full rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-foreground outline-none focus:border-primary/40"
        />
        {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
      </label>

      <label className="space-y-1">
        <span className="text-xs uppercase tracking-[0.14em] text-foreground/45">Jabatan / Grade</span>
        <input
          {...register("grade")}
          className="h-11 w-full rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-foreground outline-none focus:border-primary/40"
        />
      </label>

      <label className="space-y-1">
        <span className="text-xs uppercase tracking-[0.14em] text-foreground/45">Role Akses</span>
        <select
          {...register("roleId")}
          onChange={(e) => {
            setValue("roleId", e.target.value, { shouldValidate: true });
            const roleDef = references.roles.find((r) => r.value === e.target.value);
            if (roleDef?.scopeBasis !== "ASSIGNED_DIVISIONS") {
              setValue("managedDivisionIds", []);
            }
          }}
          className="h-11 w-full rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-foreground outline-none focus:border-primary/40"
        >
          <option value="">Pilih role</option>
          {references.roles.map((role) => (
            <option key={role.value} value={role.value}>
              {role.label}
            </option>
          ))}
        </select>
        {errors.roleId && <p className="text-xs text-destructive">{errors.roleId.message}</p>}
      </label>

      <label className="space-y-1">
        <span className="text-xs uppercase tracking-[0.14em] text-foreground/45">Divisi / Team Utama</span>
        <select
          {...register("divisionId")}
          className="h-11 w-full rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-foreground outline-none focus:border-primary/40"
        >
          <option value="">Pilih divisi</option>
          {divisionGroups.map((division) => division.teams.length > 0 ? (
            <optgroup key={division.value} label={division.label}>
              <option value={division.value}>{division.label} (induk)</option>
              {division.teams.map((team) => (
                <option key={team.value} value={team.value}>{team.label}</option>
              ))}
            </optgroup>
          ) : <option key={division.value} value={division.value}>{division.label}</option>)}
        </select>
        <p className="text-xs text-muted-foreground">Pilih team untuk anggota operasional; pilih induk bila divisi belum dibagi team.</p>
        {errors.divisionId && <p className="text-xs text-destructive">{errors.divisionId.message}</p>}
      </label>

      <div className="md:col-span-2 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
        <p className="text-xs uppercase tracking-[0.14em] text-foreground/45">Ringkasan Lingkup</p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {buildScopeHint(selectedRoleDefinition)}
        </p>
      </div>

      {selectedRoleDefinition?.scopeBasis === "ASSIGNED_DIVISIONS" && (
        <div className="space-y-3 md:col-span-2">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-foreground/45">Divisi Pegangan</p>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {divisionGroups.flatMap((division) => [division, ...division.teams]).map((division) => {
              const checked = managedDivisionIds.includes(division.value);
              return (
                <label
                  key={division.value}
                  className={[
                    "flex items-start gap-3 rounded-2xl border px-4 py-3 transition-colors cursor-pointer",
                    checked
                      ? "border-primary/30 bg-primary/10"
                      : "border-white/[0.06] bg-black/20",
                  ].join(" ")}
                >
                  <input
                    type="checkbox"
                    value={division.value}
                    {...register("managedDivisionIds")}
                    className="mt-1 h-4 w-4 rounded border-white/20 bg-transparent text-app-accent-ink"
                  />
                  <span className="text-sm text-foreground">{division.label}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      <label className="space-y-1 md:col-span-2">
        <span className="text-xs uppercase tracking-[0.14em] text-foreground/45">Kata Sandi</span>
        <input
          type="password"
          {...register("password")}
          placeholder="Minimal 8 karakter"
          className="h-11 w-full rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-foreground outline-none focus:border-primary/40"
        />
        {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
      </label>

      <div className="sticky bottom-0 z-10 -mx-1 flex flex-col-reverse gap-2 border-t border-border bg-background px-1 py-3 sm:flex-row sm:justify-end md:col-span-2">
        <button
          type="button"
          onClick={onClose}
          disabled={isPending}
          className="h-11 whitespace-nowrap rounded-full border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Batal
        </button>
        <button
          type="submit"
          disabled={isPending || !isValid}
          className="inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-40"
        >
          <UserCog className="h-4 w-4" />
          Simpan Pengguna
        </button>
      </div>
    </form>
  );
}
