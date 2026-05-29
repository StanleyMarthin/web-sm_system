"use client";

import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const isDark = theme === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="flex w-full items-center gap-2 px-3 py-1.5 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-gray-500 transition-colors hover:text-gray-700 dark:text-white/30 dark:hover:text-gray-600 dark:text-white/60"
    >
      {isDark ? (
        <Sun className="h-3 w-3 text-amber-500" />
      ) : (
        <Moon className="h-3 w-3" />
      )}
      {isDark ? "Light Mode" : "Dark Mode"}
    </button>
  );
}
