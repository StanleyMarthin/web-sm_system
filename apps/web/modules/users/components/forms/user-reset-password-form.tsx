"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTransition } from "react";
import { RefreshCcw } from "lucide-react";
import { resetUserPassword } from "@/shared/api/users";
import type { UserRecord } from "@smsystem/contracts/user";

const resetPasswordSchema = z.object({
  newPassword: z.string().min(8, "Kata sandi minimal 8 karakter"),
});

type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

interface UserResetPasswordFormProps {
  user: UserRecord;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
  onClose: () => void;
}

export function UserResetPasswordForm({ user, onSuccess, onError, onClose }: UserResetPasswordFormProps) {
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      newPassword: "",
    },
    mode: "onChange",
  });

  const onSubmit = (data: ResetPasswordFormValues) => {
    startTransition(async () => {
      const result = await resetUserPassword(user.employeeId, {
        newPassword: data.newPassword,
      });

      if (!result.success) {
        onError(result.message);
        return;
      }

      onSuccess(`Kata sandi ${user.employeeId} berhasil direset.`);
      onClose();
    });
  };

  return (
    <form className="mt-5 space-y-4" onSubmit={handleSubmit(onSubmit)}>
      <div className="space-y-1">
        <input
          type="password"
          {...register("newPassword")}
          placeholder="Kata sandi baru, minimal 8 karakter"
          className="h-11 w-full rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-foreground outline-none focus:border-primary/40"
        />
        {errors.newPassword && <p className="text-xs text-destructive">{errors.newPassword.message}</p>}
      </div>

      <div className="flex justify-end gap-2">
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
          <RefreshCcw className="h-4 w-4" />
          Reset Sandi
        </button>
      </div>
    </form>
  );
}
