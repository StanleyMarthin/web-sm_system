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
      icon: <CheckCircle2 className="h-5 w-5 text-emerald-700 dark:text-emerald-300" />,
      ring: "border-emerald-700/20 bg-emerald-50 text-emerald-800 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-200",
      button: "success" as const,
    };
  }

  if (tone === "error") {
    return {
      icon: <XCircle className="h-5 w-5 text-red-700 dark:text-red-300" />,
      ring: "border-red-600/20 bg-red-50 text-red-800 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-200",
      button: "danger" as const,
    };
  }

  if (tone === "warning") {
    return {
      icon: <AlertTriangle className="h-5 w-5 text-amber-700 dark:text-amber-300" />,
      ring: "border-amber-600/20 bg-amber-50 text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-100",
      button: "primary" as const,
    };
  }

  return {
    icon: <Info className="h-5 w-5 text-sky-700 dark:text-sky-300" />,
    ring: "border-sky-600/20 bg-sky-50 text-sky-800 dark:border-sky-500/25 dark:bg-sky-500/10 dark:text-sky-100",
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
                    <p className="text-sm font-semibold text-gray-950 dark:text-white">{notice.title}</p>
                    {notice.description ? (
                      <p className="mt-1 text-[12px] leading-5 text-gray-600 dark:text-white/75">{notice.description}</p>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {confirmState ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-gray-950/35 p-4 backdrop-blur-[1px] dark:bg-black/80">
          <div className="w-full max-w-md rounded-[16px] border border-gray-200 bg-white p-5 shadow-2xl dark:border-white/[0.08] dark:bg-[#090909]">
            <div className="flex items-start gap-3">
              <div className={`mt-0.5 rounded-full border p-2 ${toneStyles(confirmState.tone).ring}`}>
                {toneStyles(confirmState.tone).icon}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-[0.16em] text-amber-700 dark:text-amber-500/70">
                  Konfirmasi
                </p>
                <h3 className="mt-1 text-base font-semibold text-gray-950 dark:font-medium dark:text-white">{confirmState.title}</h3>
                <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-white/65">{confirmState.description}</p>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2 border-t border-gray-200 pt-4 dark:border-white/[0.05]">
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
