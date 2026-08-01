"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

interface SpfDialogProps {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}

const SIZE_CLASS = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-3xl",
  xl: "max-w-5xl",
};

function getFocusable(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((node) => !node.hasAttribute("disabled") && node.tabIndex !== -1);
}

export function SpfDialog({ open, title, children, onClose, footer, size = "md" }: SpfDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const frame = window.requestAnimationFrame(() => {
      const first = dialogRef.current ? getFocusable(dialogRef.current)[0] : null;
      (first ?? dialogRef.current)?.focus();
    });

    return () => {
      window.cancelAnimationFrame(frame);
      previousFocusRef.current?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.key !== "Tab" || !dialogRef.current) return;

    const focusable = getFocusable(dialogRef.current);
    if (focusable.length === 0) {
      event.preventDefault();
      dialogRef.current.focus();
      return;
    }

    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
      return;
    }
    if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/35 p-4 backdrop-blur-[1px] dark:bg-background/80">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="spf-dialog-title"
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className={`max-h-[calc(100vh-2rem)] w-full overflow-hidden border border-border bg-card shadow-2xl outline-none dark:border-white/[0.08] ${SIZE_CLASS[size]}`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 dark:border-white/[0.06]">
          <h2 id="spf-dialog-title" className="font-mono text-[12px] font-semibold uppercase tracking-[0.08em] text-foreground">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup dialog"
            className="inline-flex h-8 w-8 items-center justify-center border border-border text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-white/[0.08]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[calc(100vh-9rem)] overflow-y-auto px-4 py-4">{children}</div>
        {footer ? <div className="border-t border-border px-4 py-3 dark:border-white/[0.06]">{footer}</div> : null}
      </div>
    </div>
  );
}
