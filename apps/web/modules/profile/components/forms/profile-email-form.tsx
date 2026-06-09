"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTransition, useState } from "react";
import { CheckCircle2, Loader2, Pencil, X } from "lucide-react";
import type { AuthUser } from "@smsystem/contracts/auth";
import { getApiBaseUrl } from "@/shared/api/config";

const emailSchema = z.object({
  email: z.string().email("Email tidak valid").or(z.literal("")).optional(),
});

type EmailFormValues = z.infer<typeof emailSchema>;

interface ProfileEmailFormProps {
  user: AuthUser;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

export function ProfileEmailForm({ user, onSuccess, onError }: ProfileEmailFormProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const apiBase = getApiBaseUrl();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isValid },
  } = useForm<EmailFormValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: user.email || "" },
    mode: "onChange",
  });

  const onSubmit = (data: EmailFormValues) => {
    if (data.email === user.email) {
      setIsEditing(false);
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch(`${apiBase}/api/profile/me`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ email: data.email?.trim() || "" }),
        });
        const result = await res.json();
        
        if (!result.success) throw new Error(result.message || "Gagal memperbarui email");
        
        setIsEditing(false);
        onSuccess("Email berhasil diperbarui!");
      } catch (err: unknown) {
        onError(err instanceof Error ? err.message : "Terjadi kesalahan");
      }
    });
  };

  if (!isEditing) {
    return (
      <div className="bg-[#0f0f0f] border border-white/[0.06] rounded-xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-medium text-white">Informasi Kontak</h3>
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-1.5 text-xs text-amber-500/80 hover:text-amber-400 transition-colors"
          >
            <Pencil className="w-3 h-3" />
            Edit
          </button>
        </div>
        <div>
          <label className="block text-xs font-medium text-white/40 mb-1.5 uppercase tracking-wider">
            Email
          </label>
          <div className="px-4 py-2.5 bg-black/40 border border-white/[0.06] rounded-lg text-white/80 text-sm">
            {user.email || <span className="text-white/25 italic">—</span>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#0f0f0f] border border-white/[0.06] rounded-xl p-6">
      <h3 className="text-base font-medium text-white mb-5">Informasi Kontak</h3>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-white/40 mb-1.5 uppercase tracking-wider">
            Email
          </label>
          <input
            {...register("email")}
            className="w-full px-4 py-2.5 bg-black/60 border border-white/10 rounded-lg text-white text-sm outline-none focus:border-amber-500/50 transition-colors"
            placeholder="nama@email.com"
            autoFocus
          />
          {errors.email && <p className="text-xs text-red-400 mt-1">{errors.email.message}</p>}
        </div>
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={() => {
              setIsEditing(false);
              reset();
            }}
            disabled={isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white/40 hover:text-white/70 transition-colors rounded-lg border border-white/[0.06] hover:border-white/10"
          >
            <X className="w-3 h-3" />
            Batal
          </button>
          <button
            type="submit"
            disabled={isPending || !isValid}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs bg-amber-500 text-black font-medium rounded-lg hover:bg-amber-400 transition-colors disabled:opacity-60"
          >
            {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
            Simpan
          </button>
        </div>
      </form>
    </div>
  );
}
