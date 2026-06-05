"use client";

// ============================================================
// MinScreenBlocker — blocks usage when viewport is too small.
// This is a web-only ERP app; small screens are not supported.
// Shows a full-screen overlay when width < 1024px.
// ============================================================

import { useEffect, useState } from "react";
import { Monitor } from "lucide-react";
import { SERIF_STYLE } from "@/lib/constants";

const MIN_WIDTH = 1024;

export function MinScreenBlocker() {
  const [tooSmall, setTooSmall] = useState(false);

  useEffect(() => {
    function check() {
      setTooSmall(window.innerWidth < MIN_WIDTH);
    }

    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  if (!tooSmall) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background p-8 text-center text-foreground">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute left-1/2 top-1/2 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-500/[0.08] blur-3xl dark:bg-amber-500/[0.04]" />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-5 max-w-xs">
        <div className="rounded-2xl bg-amber-100 p-4 dark:bg-amber-500/10">
          <Monitor className="h-10 w-10 text-amber-700 dark:text-amber-500" />
        </div>

        <h1
          className="text-lg font-semibold uppercase tracking-[0.16em] text-gray-950 dark:font-light dark:text-white"
          style={SERIF_STYLE}
        >
          Layar Terlalu Kecil
        </h1>

        <p className="text-sm leading-relaxed text-gray-600 dark:text-white/40">
          Aplikasi ini dirancang untuk tampilan desktop. Silakan buka di jendela
          yang lebih besar{" "}
          <span className="text-amber-700 dark:text-amber-500/70">(minimal {MIN_WIDTH}px)</span>.
        </p>

        <div className="mt-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-gray-400 dark:text-white/20">
          <span className="h-px w-6 bg-gray-200 dark:bg-white/10" />
          Stanley Marthin System
          <span className="h-px w-6 bg-gray-200 dark:bg-white/10" />
        </div>
      </div>
    </div>
  );
}
