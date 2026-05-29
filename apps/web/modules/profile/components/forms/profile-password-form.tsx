"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTransition, useState } from "react";
import { Eye, EyeOff, Loader2, Lock, X } from "lucide-react";
import { getApiBaseUrl } from "@/shared/api/config";

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Password saat ini wajib diisi"),
  newPassword: z.string().min(6, "Password baru minimal 6 karakter"),
  confirmPassword: z.string().min(6, "Konfirmasi password minimal 6 karakter"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Password tidak cocok",
  path: ["confirmPassword"],
});

type PasswordFormValues = z.infer<typeof passwordSchema>;

interface ProfilePasswordFormProps {
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

export function ProfilePasswordForm({ onSuccess, onError }: ProfilePasswordFormProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const apiBase = getApiBaseUrl();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isValid },
  } = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
    mode: "onChange",
  });

  const newPasswordValue = watch("newPassword") || "";

  const onSubmit = (data: PasswordFormValues) => {
    startTransition(async () => {
      try {
        const res = await fetch(`${apiBase}/api/profile/password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ 
            currentPassword: data.currentPassword, 
            newPassword: data.newPassword 
          }),
        });
        const result = await res.json();
        
        if (!result.success) throw new Error(result.message || "Gagal ganti password");
        
        setIsEditing(false);
        reset();
        onSuccess("Password berhasil diperbarui!");
      } catch (err: any) {
        onError(err.message || "Terjadi kesalahan");
      }
    });
  };

  if (!isEditing) {
    return (
      <div className="bg-[#0f0f0f] border border-white/[0.06] rounded-xl p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-base font-medium text-white">Keamanan Akun</h3>
            <p className="text-xs text-white/35 mt-0.5">Ubah password akun Anda</p>
          </div>
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-1.5 text-xs text-amber-500/80 hover:text-amber-400 transition-colors"
          >
            <Lock className="w-3 h-3" />
            Ganti Password
          </button>
        </div>
        <div className="flex items-center gap-3 px-4 py-3 bg-black/30 border border-white/[0.04] rounded-lg">
          <Lock className="w-4 h-4 text-white/20 shrink-0" />
          <span className="text-xs text-white/30">Password tersimpan aman dan terenkripsi</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#0f0f0f] border border-white/[0.06] rounded-xl p-6">
      <div className="mb-5">
        <h3 className="text-base font-medium text-white">Keamanan Akun</h3>
        <p className="text-xs text-white/35 mt-0.5">Ubah password akun Anda</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Current Password */}
        <div>
          <label className="block text-xs font-medium text-white/40 mb-1.5 uppercase tracking-wider">
            Password Saat Ini
          </label>
          <div className="relative">
            <input
              type={showCurrent ? "text" : "password"}
              {...register("currentPassword")}
              className="w-full px-4 py-2.5 pr-10 bg-black/60 border border-white/10 rounded-lg text-white text-sm outline-none focus:border-amber-500/50 transition-colors"
              placeholder="••••••••"
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowCurrent((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
            >
              {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {errors.currentPassword && <p className="text-xs text-red-400 mt-1">{errors.currentPassword.message}</p>}
        </div>

        {/* New Password */}
        <div>
          <label className="block text-xs font-medium text-white/40 mb-1.5 uppercase tracking-wider">
            Password Baru
          </label>
          <div className="relative">
            <input
              type={showNew ? "text" : "password"}
              {...register("newPassword")}
              className="w-full px-4 py-2.5 pr-10 bg-black/60 border border-white/10 rounded-lg text-white text-sm outline-none focus:border-amber-500/50 transition-colors"
              placeholder="Min. 6 karakter"
            />
            <button
              type="button"
              onClick={() => setShowNew((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
            >
              {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {errors.newPassword && <p className="text-xs text-red-400 mt-1">{errors.newPassword.message}</p>}
        </div>

        {/* Confirm Password */}
        <div>
          <label className="block text-xs font-medium text-white/40 mb-1.5 uppercase tracking-wider">
            Konfirmasi Password
          </label>
          <div className="relative">
            <input
              type={showConfirm ? "text" : "password"}
              {...register("confirmPassword")}
              className={[
                "w-full px-4 py-2.5 pr-10 bg-black/60 border rounded-lg text-white text-sm outline-none transition-colors",
                errors.confirmPassword
                  ? "border-red-500/50 focus:border-red-500"
                  : "border-white/10 focus:border-amber-500/50",
              ].join(" ")}
              placeholder="Ulangi password baru"
            />
            <button
              type="button"
              onClick={() => setShowConfirm((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
            >
              {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {errors.confirmPassword && <p className="text-xs text-red-400 mt-1">{errors.confirmPassword.message}</p>}
        </div>

        {/* Strength indicator */}
        {newPasswordValue.length > 0 && (
          <div className="space-y-1">
            <div className="flex gap-1">
              {[1, 2, 3, 4].map((level) => (
                <div
                  key={level}
                  className={[
                    "h-1 flex-1 rounded-full transition-colors",
                    newPasswordValue.length >= level * 3
                      ? level <= 1
                        ? "bg-red-500"
                        : level <= 2
                        ? "bg-amber-500"
                        : level <= 3
                        ? "bg-yellow-400"
                        : "bg-emerald-500"
                      : "bg-white/10",
                  ].join(" ")}
                />
              ))}
            </div>
            <p className="text-[10px] text-white/30">
              {newPasswordValue.length < 6
                ? "Terlalu pendek"
                : newPasswordValue.length < 9
                ? "Sedang"
                : newPasswordValue.length < 12
                ? "Kuat"
                : "Sangat kuat"}
            </p>
          </div>
        )}

        <div className="flex gap-2 justify-end pt-1">
          <button
            type="button"
            onClick={() => {
              setIsEditing(false);
              reset();
            }}
            disabled={isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white/40 hover:text-white/70 rounded-lg border border-white/[0.06] hover:border-white/10 transition-colors"
          >
            <X className="w-3 h-3" />
            Batal
          </button>
          <button
            type="submit"
            disabled={isPending || !isValid}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs bg-amber-500 text-black font-medium rounded-lg hover:bg-amber-400 transition-colors disabled:opacity-60"
          >
            {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Lock className="w-3 h-3" />}
            Update Password
          </button>
        </div>
      </form>
    </div>
  );
}
