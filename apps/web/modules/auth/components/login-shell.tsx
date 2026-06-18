"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [retryAfterUntil, setRetryAfterUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const submitLockRef = useRef(false);
  const retryAfterSeconds =
    retryAfterUntil === null
      ? 0
      : Math.max(0, Math.ceil((retryAfterUntil - now) / 1_000));

  useEffect(() => {
    if (retryAfterUntil === null) {
      return;
    }

    const intervalId = window.setInterval(() => {
      const nextNow = Date.now();
      setNow(nextNow);
      if (nextNow >= retryAfterUntil) {
        setRetryAfterUntil(null);
      }
    }, 1_000);

    return () => window.clearInterval(intervalId);
  }, [retryAfterUntil]);

  async function doLogin(data: LoginFormValues, force: boolean) {
    if (submitLockRef.current || retryAfterSeconds > 0) {
      return;
    }

    submitLockRef.current = true;
    setIsSubmitting(true);
    setError(null);

    try {
      const result = await loginWithPassword({
        employeeId: data.employeeId,
        password: data.password,
        force,
      });

      if (result.success) {
        setRetryAfterUntil(null);
        setShowConfirm(false);
        router.replace("/dashboard");
        router.refresh();
        return;
      }

      if (result.errorCode === "ACTIVE_SESSION_EXISTS") {
        setConfirmMessage(result.message);
        setShowConfirm(true);
        return;
      }

      const retryAfter = result.data?.retryAfterSeconds;
      if (typeof retryAfter === "number" && retryAfter > 0) {
        setNow(Date.now());
        setRetryAfterUntil(Date.now() + retryAfter * 1_000);
      }

      setShowConfirm(false);
      setError(result.message);
    } finally {
      submitLockRef.current = false;
      setIsSubmitting(false);
    }
  }

  function submitLogin(data: LoginFormValues) {
    void doLogin(data, false);
  }

  function submitForceLogin() {
    void doLogin(getValues(), true);
  }

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/[0.03] blur-3xl" />
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
            className="text-foreground text-xl font-light tracking-[0.3em] uppercase"
            style={SERIF_STYLE}
          >
            Stanley Marthin
          </h1>
          <div className="flex items-center gap-3 mt-2">
            <span className="w-8 h-px bg-primary/60" />
            <p className="text-app-accent-ink/80 text-[10px] tracking-[0.25em] uppercase font-medium">
              Classic Restoration Garage
            </p>
            <span className="w-8 h-px bg-primary/60" />
          </div>
        </div>

        <form
          className="space-y-5"
          onSubmit={handleSubmit(submitLogin)}
        >
          <div className="space-y-1.5">
            <label
              htmlFor="employeeId"
              className="text-[11px] uppercase tracking-[0.15em] text-foreground/50 font-medium"
            >
              Employee ID
            </label>
            <div className="relative group">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/25 group-focus-within:text-app-accent-ink/70 transition-colors" />
              <input
                id="employeeId"
                placeholder="SM-00.000"
                {...register("employeeId")}
                className="w-full h-11 pl-11 pr-4 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-foreground placeholder:text-foreground/20 outline-none focus:border-primary/40 focus:bg-white/[0.07] transition-all"
              />
            </div>
            {errors.employeeId && <p className="text-xs text-destructive">{errors.employeeId.message}</p>}
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="password"
              className="text-[11px] uppercase tracking-[0.15em] text-foreground/50 font-medium"
            >
              Password
            </label>
            <div className="relative group">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/25 group-focus-within:text-app-accent-ink/70 transition-colors" />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••"
                {...register("password")}
                className="w-full h-11 pl-11 pr-11 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-foreground placeholder:text-foreground/20 outline-none focus:border-primary/40 focus:bg-white/[0.07] transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center text-foreground/25 hover:text-app-accent-ink/70 transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
          </div>

          {error ? (
            <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 px-3 py-2 rounded-lg">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting || retryAfterSeconds > 0}
            className="w-full h-11 rounded-lg bg-primary hover:bg-primary active:bg-primary text-primary-foreground font-semibold text-sm tracking-wide flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
            {isSubmitting
              ? "Masuk..."
              : retryAfterSeconds > 0
                ? `Tunggu ${retryAfterSeconds}s`
                : "Masuk"}
          </button>
        </form>

        <p className="text-center text-foreground/15 text-[10px] tracking-[0.15em] uppercase mt-10">
          &copy; {year} Stanley Marthin Restoration
        </p>
      </div>

      {showConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-[1px]">
          <div className="bg-card border border-white/10 rounded-xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-foreground text-lg font-medium mb-3">Konfirmasi Login</h3>
            <p className="text-foreground/70 text-sm mb-6 leading-relaxed">
              {confirmMessage}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-lg text-foreground/50 hover:text-foreground hover:bg-white/5 transition-colors text-sm font-medium"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={submitForceLogin}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-lg bg-primary hover:bg-primary text-primary-foreground transition-colors text-sm font-semibold"
              >
                Login di sini
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
