"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { mutateSpf } from "@/shared/api/spf";
import type { SpfPeriodStatus, SpfPeriod } from "@/shared/api/spf-contracts";
import type { SpfRole } from "@/shared/auth/admin-session";
import { ActionButton, CompactTextarea, FieldLabel, Toast } from "@/shared/ui/compact";
import { useSweetAlert } from "@/shared/ui/sweet-alert";

// ─── Workflow matrix ──────────────────────────────────────────────────────────
type WorkflowAction = "SUBMIT" | "APPROVE" | "REJECT" | "PUBLISH" | "UNPUBLISH";

function getAllowedActions(
  role: SpfRole,
  status: SpfPeriodStatus,
): readonly WorkflowAction[] {
  if (role === "ADMIN") {
    if (status === "DRAFT" || status === "REJECTED") return ["SUBMIT"];
  }
  if (role === "APPROVER") {
    if (status === "WAITING_APPROVAL") return ["APPROVE", "REJECT"];
  }
  if (role === "PUBLISHER") {
    if (status === "APPROVED") return ["PUBLISH"];
    if (status === "PUBLISHED") return ["UNPUBLISH"];
  }
  return [];
}

const ACTION_LABELS: Record<WorkflowAction, string> = {
  SUBMIT: "Ajukan",
  APPROVE: "Setujui",
  REJECT: "Tolak",
  PUBLISH: "Publikasi",
  UNPUBLISH: "Cabut Publikasi",
};

const ACTION_VARIANTS: Record<
  WorkflowAction,
  "default" | "primary" | "danger" | "success"
> = {
  SUBMIT: "primary",
  APPROVE: "success",
  REJECT: "danger",
  PUBLISH: "success",
  UNPUBLISH: "danger",
};

// ─── Props ────────────────────────────────────────────────────────────────────
interface PeriodWorkflowActionsProps {
  periodId: number;
  status: SpfPeriodStatus;
  role: SpfRole;
}

export function PeriodWorkflowActions({
  periodId,
  status,
  role,
}: PeriodWorkflowActionsProps) {
  const router = useRouter();
  const { alertElement, confirm, notifySuccess, notifyError } = useSweetAlert();
  const [isPending, startTransition] = useTransition();
  const [rejectReason, setRejectReason] = useState("");
  const [rejectError, setRejectError] = useState<string | null>(null);
  const [pendingReject, setPendingReject] = useState(false);

  const allowedActions = getAllowedActions(role, status);

  if (allowedActions.length === 0) return null;

  async function executeAction(action: WorkflowAction) {
    // REJECT: tampilkan textarea terpisah, eksekusi dari tombol confirm di dalam textarea
    if (action === "REJECT") {
      setPendingReject(true);
      return;
    }

    const confirmed = await confirm({
      title: `${ACTION_LABELS[action]} Periode`,
      description: `Apakah Anda yakin ingin melanjutkan aksi ini? Perubahan status tidak dapat diurungkan kecuali melalui workflow selanjutnya.`,
      tone:
        action === "APPROVE" || action === "PUBLISH"
          ? "success"
          : action === "UNPUBLISH"
            ? "warning"
            : "info",
      confirmLabel: ACTION_LABELS[action],
      cancelLabel: "Batal",
    });

    if (!confirmed) return;

    startTransition(async () => {
      const result = await mutateSpf("period", {
        mode: action,
        period_id: periodId,
      });

      if (!result.success) {
        // 409: status berubah oleh user lain → refresh tanpa error toast
        if (result.status === 409) {
          notifyError(
            "Status berubah",
            "Status periode telah diperbarui oleh pengguna lain. Halaman akan diperbarui.",
          );
          router.refresh();
          return;
        }
        notifyError("Gagal", result.message);
        return;
      }

      notifySuccess(`Periode berhasil di-${ACTION_LABELS[action].toLowerCase()}.`);
      router.refresh();
    });
  }

  async function handleRejectSubmit() {
    setRejectError(null);
    const reason = rejectReason.trim();
    if (!reason) {
      setRejectError("Alasan penolakan wajib diisi.");
      return;
    }
    if (reason.length > 2000) {
      setRejectError("Alasan maksimal 2000 karakter.");
      return;
    }

    startTransition(async () => {
      const result = await mutateSpf("period", {
        mode: "REJECT",
        period_id: periodId,
        reason,
      });

      if (!result.success) {
        if (result.status === 409) {
          notifyError(
            "Status berubah",
            "Status periode telah diperbarui oleh pengguna lain. Halaman akan diperbarui.",
          );
          setPendingReject(false);
          router.refresh();
          return;
        }
        setRejectError(result.message);
        return;
      }

      notifySuccess("Periode berhasil ditolak.");
      setPendingReject(false);
      setRejectReason("");
      router.refresh();
    });
  }

  return (
    <>
      {alertElement}

      {/* Reject form overlay */}
      {pendingReject && (
        <div className="space-y-3 rounded-none border border-destructive/20 bg-destructive/5 p-4 dark:border-destructive/15 dark:bg-destructive/8">
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-destructive dark:text-destructive/80">
            Alasan Penolakan
          </p>
          <div>
            <FieldLabel required>Alasan</FieldLabel>
            <CompactTextarea
              id="reject-reason"
              rows={3}
              placeholder="Tuliskan alasan penolakan (maks. 2000 karakter)"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              disabled={isPending}
              aria-describedby={rejectError ? "reject-reason-err" : undefined}
            />
            {rejectError && (
              <p id="reject-reason-err" className="mt-1 text-[12px] text-destructive">
                {rejectError}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <ActionButton
              type="button"
              variant="danger"
              disabled={isPending}
              onClick={handleRejectSubmit}
            >
              {isPending ? "Memproses…" : "Konfirmasi Tolak"}
            </ActionButton>
            <ActionButton
              type="button"
              variant="default"
              disabled={isPending}
              onClick={() => {
                setPendingReject(false);
                setRejectReason("");
                setRejectError(null);
              }}
            >
              Batal
            </ActionButton>
          </div>
        </div>
      )}

      {/* Workflow action buttons */}
      {!pendingReject && (
        <div className="flex flex-wrap items-center gap-2">
          {allowedActions.map((action) => (
            <ActionButton
              key={action}
              type="button"
              variant={ACTION_VARIANTS[action]}
              disabled={isPending}
              onClick={() => executeAction(action)}
            >
              {isPending ? "Memproses…" : ACTION_LABELS[action]}
            </ActionButton>
          ))}
        </div>
      )}
    </>
  );
}
