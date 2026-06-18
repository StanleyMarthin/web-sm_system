"use client";

import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActionButton } from "@/shared/ui/compact";

type SweetAlertTone = "success" | "error" | "warning" | "info";

interface ConfirmState {
  title: string;
  description: string;
  tone: SweetAlertTone;
  confirmLabel: string;
  cancelLabel: string;
  resolve: (value: boolean) => void;
}

interface NoticeState {
  id: string;
  title: string;
  description?: string;
  tone: SweetAlertTone;
}

function toneStyles(tone: SweetAlertTone) {
  if (tone === "success") {
    return {
      icon: <CheckCircle2 className="h-5 w-5 text-success dark:text-success" />,
      ring: "border-success/20 bg-success/10 text-success dark:border-success/25 dark:bg-success/10 dark:text-success",
      button: "success" as const,
    };
  }

  if (tone === "error") {
    return {
      icon: <XCircle className="h-5 w-5 text-destructive dark:text-destructive" />,
      ring: "border-destructive/20 bg-destructive/10 text-destructive dark:border-destructive/25 dark:bg-destructive/10 dark:text-destructive",
      button: "danger" as const,
    };
  }

  if (tone === "warning") {
    return {
      icon: <AlertTriangle className="h-5 w-5 text-app-accent-ink dark:text-app-accent-ink" />,
      ring: "border-primary/20 bg-primary/10 text-app-accent-ink dark:border-primary/25 dark:bg-primary/10 dark:text-app-accent-ink",
      button: "primary" as const,
    };
  }

  return {
    icon: <Info className="h-5 w-5 text-info dark:text-info" />,
    ring: "border-info/20 bg-info/10 text-info dark:border-info/25 dark:bg-info/10 dark:text-info",
    button: "default" as const,
  };
}

export function useSweetAlert() {
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [notices, setNotices] = useState<NoticeState[]>([]);

  useEffect(() => {
    if (notices.length === 0) {
      return;
    }

    const timers = notices.map((notice) =>
      window.setTimeout(() => {
        setNotices((currentValue) => currentValue.filter((item) => item.id !== notice.id));
      }, 3200),
    );

    return () => {
      for (const timer of timers) {
        window.clearTimeout(timer);
      }
    };
  }, [notices]);

  const alertElement = useMemo(() => (
    <>
      {notices.length > 0 ? (
        <div className="fixed right-4 top-4 z-[80] flex w-full max-w-sm flex-col gap-2">
          {notices.map((notice) => {
            const styles = toneStyles(notice.tone);

            return (
              <div
                key={notice.id}
                className={`rounded-[14px] border px-4 py-3 shadow-xl backdrop-blur-sm dark:shadow-2xl ${styles.ring}`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">{styles.icon}</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground dark:text-foreground">{notice.title}</p>
                    {notice.description ? (
                      <p className="mt-1 text-[12px] leading-5 text-muted-foreground dark:text-foreground/75">{notice.description}</p>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {confirmState ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-foreground/35 p-4 backdrop-blur-[1px] dark:bg-background/80">
          <div className="w-full max-w-md rounded-[16px] border border-border bg-white p-5 shadow-2xl dark:border-white/[0.08] dark:bg-popover">
            <div className="flex items-start gap-3">
              <div className={`mt-0.5 rounded-full border p-2 ${toneStyles(confirmState.tone).ring}`}>
                {toneStyles(confirmState.tone).icon}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-[0.16em] text-app-accent-ink dark:text-app-accent-ink/70">
                  Konfirmasi
                </p>
                <h3 className="mt-1 text-base font-semibold text-foreground dark:font-medium dark:text-foreground">{confirmState.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground dark:text-foreground/65">{confirmState.description}</p>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2 border-t border-border pt-4 dark:border-white/[0.05]">
              <ActionButton
                onClick={() => {
                  confirmState.resolve(false);
                  setConfirmState(null);
                }}
              >
                {confirmState.cancelLabel}
              </ActionButton>
              <ActionButton
                variant={toneStyles(confirmState.tone).button}
                onClick={() => {
                  confirmState.resolve(true);
                  setConfirmState(null);
                }}
              >
                {confirmState.confirmLabel}
              </ActionButton>
            </div>
          </div>
        </div>
      ) : null}
    </>
  ), [confirmState, notices]);

  const pushNotice = useCallback((tone: SweetAlertTone, title: string, description?: string) => {
    setNotices((currentValue) => [
      ...currentValue,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        tone,
        title,
        description,
      },
    ]);
  }, []);

  const confirm = useCallback((options: {
    title: string;
    description: string;
    tone?: SweetAlertTone;
    confirmLabel?: string;
    cancelLabel?: string;
  }) => {
    return new Promise<boolean>((resolve) => {
      setConfirmState({
        title: options.title,
        description: options.description,
        tone: options.tone ?? "warning",
        confirmLabel: options.confirmLabel ?? "Lanjutkan",
        cancelLabel: options.cancelLabel ?? "Batal",
        resolve,
      });
    });
  }, []);

  const notifySuccess = useCallback((title: string, description?: string) => {
    pushNotice("success", title, description);
  }, [pushNotice]);

  const notifyError = useCallback((title: string, description?: string) => {
    pushNotice("error", title, description);
  }, [pushNotice]);

  const notifyWarning = useCallback((title: string, description?: string) => {
    pushNotice("warning", title, description);
  }, [pushNotice]);

  const notifyInfo = useCallback((title: string, description?: string) => {
    pushNotice("info", title, description);
  }, [pushNotice]);

  return {
    alertElement,
    confirm,
    notifySuccess,
    notifyError,
    notifyWarning,
    notifyInfo,
  };
}
