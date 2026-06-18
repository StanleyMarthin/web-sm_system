"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTransition } from "react";
import { UserCog } from "lucide-react";
import { updateUser } from "@/shared/api/users";
import type { UserGridReference, UserRecord } from "@smsystem/contracts/user";
import { useRouter } from "next/navigation";

const editUserSchema = z.object({
  employeeId: z.string(),
  fullName: z.string().min(1, "Nama lengkap wajib diisi"),
  email: z.string().email("Email tidak valid").or(z.literal("")).optional(),
  roleId: z.string().min(1, "Role wajib dipilih"),
  divisionId: z.string().min(1, "Divisi wajib dipilih"),
  grade: z.string().optional(),
  managedDivisionIds: z.array(z.string()),
});

type EditUserFormValues = z.infer<typeof editUserSchema>;

interface UserEditFormProps {
  user: UserRecord;
  references: UserGridReference;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
  onClose: () => void;
}

function buildScopeHint(role: UserGridReference["roles"][number] | undefined): string {
  switch (role?.scopeBasis) {
    case "GLOBAL":
      return "Role ini dapat melihat seluruh data sesuai permission yang dicentang.";
    case "ASSIGNED_DIVISIONS":
      return "Role ini mengikuti daftar divisi pegangan yang dicentang di bawah.";
    case "ASSIGNED_UNITS":
      return "Role ini mengikuti unit yang sedang dipegang pada assignment operasional. Daftar unit tidak diatur manual dari layar ini.";
    case "SELF_ONLY":
      return "Role ini hanya memakai data milik user itu sendiri.";
    default:
      return "Role ini mengikuti divisi utama user.";
  }
}

export function UserEditForm({ user, references, onSuccess, onError, onClose }: UserEditFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isValid },
  } = useForm<EditUserFormValues>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      employeeId: user.employeeId,
      fullName: user.fullName,
      email: user.email || "",
      roleId: user.roleId ? String(user.roleId) : "",
      divisionId: user.divisionId ? String(user.divisionId) : "",
      grade: user.grade || "",
      managedDivisionIds: user.managedDivisionIds.map(String),
    },
    mode: "onChange",
  });

  const selectedRoleId = watch("roleId");
  const selectedRoleDefinition = references.roles.find((r) => r.value === selectedRoleId);
  const managedDivisionIds = watch("managedDivisionIds");

  const onSubmit = (data: EditUserFormValues) => {
    startTransition(async () => {
      const updateResult = await updateUser(user.employeeId, {
        fullName: data.fullName.trim(),
        email: data.email?.trim() || null,
        roleId: Number(data.roleId),
        divisionId: Number(data.divisionId),
        grade: data.grade?.trim() || null,
        managedDivisionIds: data.managedDivisionIds.map(Number),
      });

      if (!updateResult.success) {
        onError(updateResult.message);
        return;
      }

      onSuccess(`Pengguna ${updateResult.user?.employeeId || data.employeeId} berhasil diperbarui.`);
      onClose();
      router.refresh();
    });
  };

  return (
    <form className="mt-5 grid gap-4 md:grid-cols-2" onSubmit={handleSubmit(onSubmit)}>
      <label className="space-y-1">
        <span className="text-xs uppercase tracking-[0.14em] text-foreground/45">ID Pegawai</span>
        <input
          {...register("employeeId")}
          disabled
          className="h-11 w-full rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-foreground outline-none focus:border-primary/40 disabled:opacity-40"
        />
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
        <span className="text-xs uppercase tracking-[0.14em] text-foreground/45">Divisi Utama</span>
        <select
          {...register("divisionId")}
          className="h-11 w-full rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-foreground outline-none focus:border-primary/40"
        >
          <option value="">Pilih divisi</option>
          {references.divisions.map((division) => (
            <option key={division.value} value={division.value}>
              {division.label}
            </option>
          ))}
        </select>
        {errors.divisionId && <p className="text-xs text-destructive">{errors.divisionId.message}</p>}
      </label>

      <div className="md:col-span-2 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
        <p className="text-xs uppercase tracking-[0.14em] text-foreground/45">Ringkasan Lingkup</p>
        {buildScopeHint(selectedRoleDefinition) ? null : null}
        {user.activeUnitIds && user.activeUnitIds.length > 0 && (
          <p className="mt-2 text-xs text-app-accent-ink/90">
            Unit aktif saat ini: {user.activeUnitIds.join(", ")}
          </p>
        )}
      </div>

      {selectedRoleDefinition?.scopeBasis === "ASSIGNED_DIVISIONS" && (
        <div className="space-y-3 md:col-span-2">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-foreground/45">Divisi Pegangan</p>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {references.divisions.map((division) => {
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

      <div className="flex justify-end gap-2 pt-2 md:col-span-2">
        <button
          type="button"
          onClick={onClose}
          disabled={isPending}
          className="rounded-full border border-white/[0.08] px-4 py-2 text-sm text-foreground/60 hover:text-foreground"
        >
          Batal
        </button>
        <button
          type="submit"
          disabled={isPending || !isValid}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary disabled:opacity-40"
        >
          <UserCog className="h-4 w-4" />
          Simpan Perubahan
        </button>
      </div>
    </form>
  );
}
