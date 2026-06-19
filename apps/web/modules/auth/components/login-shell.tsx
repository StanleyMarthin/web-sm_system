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
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#19191a] text-[#efeff0]">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#fdb360]/[0.05] blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-sm px-6 sm:px-0">
        <div className="flex flex-col items-center mb-10">
          <div className="mb-6 h-20 w-20 overflow-hidden rounded-2xl shadow-2xl ring-1 ring-[#4e4e50]">
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
            className="text-xl font-light uppercase tracking-[0.3em] text-[#efeff0]"
            style={SERIF_STYLE}
          >
            Stanley Marthin
          </h1>
          <div className="flex items-center gap-3 mt-2">
            <span className="h-px w-8 bg-[#fdb360]/70" />
            <p className="text-[12px] font-medium uppercase tracking-[0.25em] text-[#fdb360]">
              Classic Restoration Garage
            </p>
            <span className="h-px w-8 bg-[#fdb360]/70" />
          </div>
        </div>

        <form
          className="space-y-5"
          onSubmit={handleSubmit(submitLogin)}
        >
          <div className="space-y-1.5">
            <label
              htmlFor="employeeId"
              className="text-[12px] font-medium uppercase tracking-[0.15em] text-[#a1a0a5]"
            >
              Employee ID
            </label>
            <div className="relative group">
              <User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a1a0a5] transition-colors group-focus-within:text-[#fdb360]" />
              <input
                id="employeeId"
                placeholder="SM-00.000"
                {...register("employeeId")}
                className="h-11 w-full rounded-lg border border-[#606062] bg-[#2b2b2c] pl-11 pr-4 text-[16px] text-[#efeff0] outline-none transition-colors placeholder:text-[#8e8d91] focus:border-[#fdb360] focus:bg-[#373739] disabled:cursor-not-allowed disabled:text-[#6f6f71]"
              />
            </div>
            {errors.employeeId && <p className="text-[13px] text-[#d16552]">{errors.employeeId.message}</p>}
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="password"
              className="text-[12px] font-medium uppercase tracking-[0.15em] text-[#a1a0a5]"
            >
              Password
            </label>
            <div className="relative group">
              <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a1a0a5] transition-colors group-focus-within:text-[#fdb360]" />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••"
                {...register("password")}
                className="h-11 w-full rounded-lg border border-[#606062] bg-[#2b2b2c] pl-11 pr-11 text-[16px] text-[#efeff0] outline-none transition-colors placeholder:text-[#8e8d91] focus:border-[#fdb360] focus:bg-[#373739] disabled:cursor-not-allowed disabled:text-[#6f6f71]"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center text-[#a1a0a5] transition-colors hover:text-[#fdb360]"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && <p className="text-[13px] text-[#d16552]">{errors.password.message}</p>}
          </div>

          {error ? (
            <div className="rounded-lg border border-[#d16552]/30 bg-[#d16552]/10 px-3 py-2 text-[14px] text-[#d16552]">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting || retryAfterSeconds > 0}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#fdb360] text-[15px] font-semibold tracking-wide text-[#261910] transition-colors hover:bg-[#fda23d] active:bg-[#fc9119] disabled:cursor-not-allowed disabled:bg-[#606062] disabled:text-[#a1a0a5]"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
            {isSubmitting
              ? "Masuk..."
              : retryAfterSeconds > 0
                ? `Tunggu ${retryAfterSeconds}s`
                : "Masuk"}
          </button>
        </form>

        <p className="mt-10 text-center text-[11px] uppercase tracking-[0.15em] text-[#8e8d91]">
          &copy; {year} Stanley Marthin Restoration
        </p>
      </div>

      {showConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#19191a]/90 p-4 backdrop-blur-[1px]">
          <div className="w-full max-w-sm rounded-xl border border-[#606062] bg-[#2b2b2c] p-6 shadow-2xl">
            <h3 className="mb-3 text-lg font-medium text-[#efeff0]">Konfirmasi Login</h3>
            <p className="mb-6 text-[15px] leading-relaxed text-[#a1a0a5]">
              {confirmMessage}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                disabled={isSubmitting}
                className="rounded-lg px-4 py-2 text-[14px] font-medium text-[#a1a0a5] transition-colors hover:bg-[#444446] hover:text-[#efeff0] disabled:cursor-not-allowed disabled:text-[#6f6f71]"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={submitForceLogin}
                disabled={isSubmitting}
                className="rounded-lg bg-[#fdb360] px-4 py-2 text-[14px] font-semibold text-[#261910] transition-colors hover:bg-[#fda23d] disabled:cursor-not-allowed disabled:bg-[#606062] disabled:text-[#a1a0a5]"
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
