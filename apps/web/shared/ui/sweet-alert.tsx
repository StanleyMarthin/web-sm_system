"use client";

import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
      icon: <CheckCircle2 className="h-5 w-5 text-emerald-300" />,
      ring: "border-emerald-500/25 bg-emerald-500/10 text-emerald-200",
      button: "success" as const,
    };
  }

  if (tone === "error") {
    return {
      icon: <XCircle className="h-5 w-5 text-red-300" />,
      ring: "border-red-500/25 bg-red-500/10 text-red-200",
      button: "danger" as const,
    };
  }

  if (tone === "warning") {
    return {
      icon: <AlertTriangle className="h-5 w-5 text-amber-300" />,
      ring: "border-amber-500/25 bg-amber-500/10 text-amber-100",
      button: "primary" as const,
    };
  }

  return {
    icon: <Info className="h-5 w-5 text-sky-300" />,
    ring: "border-sky-500/25 bg-sky-500/10 text-sky-100",
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
                className={`rounded-[16px] border px-4 py-3 shadow-2xl backdrop-blur-sm ${styles.ring}`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">{styles.icon}</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white">{notice.title}</p>
                    {notice.description ? (
                      <p className="mt-1 text-[12px] leading-5 text-white/75">{notice.description}</p>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {confirmState ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-4 backdrop-blur-[1px]">
          <div className="w-full max-w-md rounded-[18px] border border-white/[0.08] bg-[#090909] p-5 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className={`mt-0.5 rounded-full border p-2 ${toneStyles(confirmState.tone).ring}`}>
                {toneStyles(confirmState.tone).icon}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-[0.18em] text-amber-500/70">
                  Konfirmasi
                </p>
                <h3 className="mt-1 text-base font-medium text-white">{confirmState.title}</h3>
                <p className="mt-2 text-sm leading-6 text-white/65">{confirmState.description}</p>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2 border-t border-white/[0.05] pt-4">
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

  function pushNotice(tone: SweetAlertTone, title: string, description?: string) {
    setNotices((currentValue) => [
      ...currentValue,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        tone,
        title,
        description,
      },
    ]);
  }

  return {
    alertElement,
    confirm(options: {
      title: string;
      description: string;
      tone?: SweetAlertTone;
      confirmLabel?: string;
      cancelLabel?: string;
    }) {
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
    },
    notifySuccess(title: string, description?: string) {
      pushNotice("success", title, description);
    },
    notifyError(title: string, description?: string) {
      pushNotice("error", title, description);
    },
    notifyWarning(title: string, description?: string) {
      pushNotice("warning", title, description);
    },
    notifyInfo(title: string, description?: string) {
      pushNotice("info", title, description);
    },
  };
}
