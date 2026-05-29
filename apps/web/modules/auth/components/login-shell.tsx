"use client";

import Image from "next/image";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogIn, Lock, User, Eye, EyeOff } from "lucide-react";
import { SERIF_STYLE } from "@/lib/constants";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { loginWithPassword } from "@/shared/auth/client";

const loginSchema = z.object({
  employeeId: z.string().min(1, "Employee ID wajib diisi"),
  password: z.string().min(1, "Password wajib diisi"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginShell() {
  const year = useMemo(() => new Date().getFullYear(), []);
  const router = useRouter();
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      employeeId: "",
      password: "",
    },
  });

  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmMessage, setConfirmMessage] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function doLogin(data: LoginFormValues, force: boolean) {
    setError(null);

    const result = await loginWithPassword({
      employeeId: data.employeeId,
      password: data.password,
      force,
    });

    if (result.success) {
      router.push("/dashboard");
      return;
    }

    if (result.errorCode === "ACTIVE_SESSION_EXISTS") {
      setConfirmMessage(result.message);
      setShowConfirm(true);
      return;
    }

    setShowConfirm(false);
    setError(result.message);
  }

  function submitLogin(data: LoginFormValues) {
    startTransition(() => {
      void doLogin(data, false);
    });
  }

  function submitForceLogin() {
    startTransition(() => {
      void doLogin(getValues(), true);
    });
  }

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-amber-500/[0.03] blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-sm px-6 sm:px-0">
        <div className="flex flex-col items-center mb-10">
          <div className="w-20 h-20 rounded-2xl overflow-hidden ring-1 ring-white/10 mb-6 shadow-2xl">
            <Image
              src="/sm.jpeg"
              alt="Stanley Marthin"
              width={80}
              height={80}
              className="object-cover w-full h-full"
              priority
            />
          </div>
          <h1
            className="text-white text-xl font-light tracking-[0.3em] uppercase"
            style={SERIF_STYLE}
          >
            Stanley Marthin
          </h1>
          <div className="flex items-center gap-3 mt-2">
            <span className="w-8 h-px bg-amber-500/60" />
            <p className="text-amber-500/80 text-[10px] tracking-[0.25em] uppercase font-medium">
              Classic Restoration Garage
            </p>
            <span className="w-8 h-px bg-amber-500/60" />
          </div>
        </div>

        <form
          className="space-y-5"
          onSubmit={handleSubmit(submitLogin)}
        >
          <div className="space-y-1.5">
            <label
              htmlFor="employeeId"
              className="text-[11px] uppercase tracking-[0.15em] text-white/50 font-medium"
            >
              Employee ID
            </label>
            <div className="relative group">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25 group-focus-within:text-amber-500/70 transition-colors" />
              <input
                id="employeeId"
                placeholder="SM-00.000"
                {...register("employeeId")}
                className="w-full h-11 pl-11 pr-4 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white placeholder:text-white/20 outline-none focus:border-amber-500/40 focus:bg-white/[0.07] transition-all"
              />
            </div>
            {errors.employeeId && <p className="text-xs text-red-400">{errors.employeeId.message}</p>}
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="password"
              className="text-[11px] uppercase tracking-[0.15em] text-white/50 font-medium"
            >
              Password
            </label>
            <div className="relative group">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25 group-focus-within:text-amber-500/70 transition-colors" />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••"
                {...register("password")}
                className="w-full h-11 pl-11 pr-11 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white placeholder:text-white/20 outline-none focus:border-amber-500/40 focus:bg-white/[0.07] transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center text-white/25 hover:text-amber-500/70 transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && <p className="text-xs text-red-400">{errors.password.message}</p>}
          </div>

          {error ? (
            <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isPending}
            className="w-full h-11 rounded-lg bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-black font-semibold text-sm tracking-wide flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
            {isPending ? "Masuk..." : "Masuk"}
          </button>
        </form>

        <p className="text-center text-amber-500/60 text-[10px] tracking-[0.15em] uppercase mt-6">
          Login web menggunakan Bun API dan mobile auth service.
        </p>

        <p className="text-center text-white/15 text-[10px] tracking-[0.15em] uppercase mt-10">
          &copy; {year} Stanley Marthin Restoration
        </p>
      </div>

      {showConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-[1px]">
          <div className="bg-[#111] border border-white/10 rounded-xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-white text-lg font-medium mb-3">Konfirmasi Login</h3>
            <p className="text-white/70 text-sm mb-6 leading-relaxed">
              {confirmMessage}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2 rounded-lg text-white/50 hover:text-white hover:bg-white/5 transition-colors text-sm font-medium"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={submitForceLogin}
                className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black transition-colors text-sm font-semibold"
              >
                Lanjutkan
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
