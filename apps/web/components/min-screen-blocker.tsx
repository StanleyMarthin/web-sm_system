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
    <div className="fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center p-8 text-center">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-amber-500/[0.04] blur-3xl" />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-5 max-w-xs">
        <div className="p-4 rounded-2xl bg-amber-500/10">
          <Monitor className="w-10 h-10 text-amber-500" />
        </div>

        <h1
          className="text-white text-lg font-light tracking-[0.2em] uppercase"
          style={SERIF_STYLE}
        >
          Layar Terlalu Kecil
        </h1>

        <p className="text-white/40 text-sm leading-relaxed">
          Aplikasi ini dirancang untuk tampilan desktop. Silakan buka di jendela
          yang lebih besar{" "}
          <span className="text-amber-500/70">(minimal {MIN_WIDTH}px)</span>.
        </p>

        <div className="mt-2 flex items-center gap-2 text-[10px] text-white/20 uppercase tracking-[0.15em]">
          <span className="w-6 h-px bg-white/10" />
          Stanley Marthin System
          <span className="w-6 h-px bg-white/10" />
        </div>
      </div>
    </div>
  );
}
