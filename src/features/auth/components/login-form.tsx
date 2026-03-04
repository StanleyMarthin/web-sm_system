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
import { DEMO_USERS } from "@/lib/dummy-data";
import { LogIn, User, Lock, Loader2, ChevronRight } from "lucide-react";
import { SERIF_STYLE } from "@/lib/constants";

export function LoginForm() {
  const [employeeId, setEmployeeId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showDemo, setShowDemo] = useState(false);
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const year = useMemo(() => new Date().getFullYear(), []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await loginService({ employeeId, password });
      if (result.success && result.user && result.token) {
        login(result.user, result.token);
        router.push("/dashboard");
      } else {
        setError(result.error ?? "Login gagal");
      }
    } catch {
      setError("Terjadi kesalahan jaringan");
    } finally {
      setLoading(false);
    }
  }

  function handleQuickLogin(empId: string, pwd: string) {
    setEmployeeId(empId);
    setPassword(pwd);
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
                placeholder="emp-004"
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

        {/* Demo Quick Login */}
        <div className="mt-8">
          <button
            type="button"
            onClick={() => setShowDemo(!showDemo)}
            className="w-full flex items-center justify-center gap-2 text-white/30 hover:text-white/50 transition-colors py-2"
          >
            <span className="text-[10px] uppercase tracking-[0.2em]">
              Demo Accounts
            </span>
            <ChevronRight
              className={`w-3 h-3 transition-transform ${showDemo ? "rotate-90" : ""}`}
            />
          </button>

          {showDemo && (
            <div className="mt-3 grid grid-cols-2 gap-1.5">
              {DEMO_USERS.map((u) => (
                <button
                  key={u.employeeId}
                  type="button"
                  onClick={() => handleQuickLogin(u.employeeId, u.password)}
                  className="text-left px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] hover:border-amber-500/30 hover:bg-white/[0.06] transition-all group"
                >
                  <p className="text-[11px] text-white/70 group-hover:text-white truncate leading-tight">
                    {u.fullName}
                  </p>
                  <p className="text-[9px] uppercase tracking-wider text-amber-500/50 group-hover:text-amber-500/80 mt-0.5">
                    {u.role}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-white/15 text-[10px] tracking-[0.15em] uppercase mt-10">
          &copy; {year} Stanley Marthin Restoration
        </p>
      </div>
    </div>
  );
}
