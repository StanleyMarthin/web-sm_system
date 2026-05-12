"use client";

// ============================================================
// Login Form — Cinematic design inspired by stanleymarthin.com
//
// Design language:
// - Pure black background, white text, gold (#D4A853) accent
// - Wide letter-spacing, elegant serif vibe
// - Dramatic negative space, minimal chrome
// - Moody, luxury automotive aesthetic
// ============================================================

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuthStore } from "@/features/auth/stores/auth-store";
import { loginService } from "@/features/auth/services/auth-service";
import { LogIn, User, Lock, Loader2 } from "lucide-react";
import { SERIF_STYLE } from "@/lib/constants";

export function LoginForm() {
  const [employeeId, setEmployeeId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState("");
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const year = useMemo(() => new Date().getFullYear(), []);

  async function handleSubmit(e?: React.FormEvent, force: boolean = false) {
    if (e) e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await loginService({ employeeId, password, force });
      if (result.success && result.user && result.token) {
        login(result.user, result.token);
        router.push("/dashboard");
      } else if (result.requiresConfirmation) {
        setConfirmMessage(result.confirmationMessage || "Sesi aktif di perangkat lain.");
        setShowConfirm(true);
      } else {
        setError(result.error ?? "Login gagal");
      }
    } catch {
      setError("Terjadi kesalahan jaringan");
    } finally {
      setLoading(false);
    }
  }

  function handleForceLogin() {
    setShowConfirm(false);
    handleSubmit(undefined, true);
  }

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center relative overflow-hidden">
      {/* Ambient glow — subtle gold radial behind form */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-amber-500/[0.03] blur-3xl" />
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-sm px-6 sm:px-0">
        {/* Logo + Brand */}
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

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Employee ID */}
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
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                required
                className="w-full h-11 pl-11 pr-4 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white placeholder:text-white/20 outline-none focus:border-amber-500/40 focus:bg-white/[0.07] transition-all"
              />
            </div>
          </div>

          {/* Password */}
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
                type="password"
                placeholder="••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full h-11 pl-11 pr-4 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white placeholder:text-white/20 outline-none focus:border-amber-500/40 focus:bg-white/[0.07] transition-all"
              />
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 rounded-lg bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-black font-semibold text-sm tracking-wide flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <LogIn className="w-4 h-4" />
            )}
            Masuk
          </button>
        </form>

        {/* Footer */}
        <p className="text-center text-white/15 text-[10px] tracking-[0.15em] uppercase mt-10">
          &copy; {year} Stanley Marthin Restoration
        </p>
      </div>

      {/* Confirmation Overlay */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
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
                onClick={handleForceLogin}
                className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black transition-colors text-sm font-semibold"
              >
                Lanjutkan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
