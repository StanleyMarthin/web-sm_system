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
        <div className="absolute left-1/2 top-1/2 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/[0.08] blur-3xl dark:bg-primary/[0.04]" />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-5 max-w-xs">
        <div className="rounded-2xl bg-primary/15 p-4 dark:bg-primary/10">
          <Monitor className="h-10 w-10 text-app-accent-ink dark:text-app-accent-ink" />
        </div>

        <h1
          className="text-lg font-semibold uppercase tracking-[0.16em] text-foreground dark:font-light dark:text-foreground"
          style={SERIF_STYLE}
        >
          Layar Terlalu Kecil
        </h1>

        <p className="text-sm leading-relaxed text-muted-foreground dark:text-foreground/40">
          Aplikasi ini dirancang untuk tampilan desktop. Silakan buka di jendela
          yang lebih besar{" "}
          <span className="text-app-accent-ink dark:text-app-accent-ink/70">(minimal {MIN_WIDTH}px)</span>.
        </p>

        <div className="mt-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground dark:text-foreground/20">
          <span className="h-px w-6 bg-accent dark:bg-white/10" />
          Stanley Marthin System
          <span className="h-px w-6 bg-accent dark:bg-white/10" />
        </div>
      </div>
    </div>
  );
}
