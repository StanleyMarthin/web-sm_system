"use client";

import { useState, useTransition } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Eye, Send, UploadCloud, XCircle } from "lucide-react";
import { mutateSpf } from "@/shared/api/spf";
import type { SpfPeriodStatus } from "@/shared/api/spf-contracts";
import type { SpfRole } from "@/shared/auth/admin-session";
import { ActionButton, CompactTextarea, FieldLabel } from "@/shared/ui/compact";
import { useSweetAlert } from "@/shared/ui/sweet-alert";
import { SpfDialog } from "./spf-dialog";

type WorkflowAction = "SUBMIT" | "APPROVE" | "REJECT" | "PUBLISH" | "UNPUBLISH";

function getAllowedActions(role: SpfRole, status: SpfPeriodStatus): WorkflowAction[] {
  const actions: WorkflowAction[] = [];
  if (role === "ADMIN" && (status === "DRAFT" || status === "REJECTED")) actions.push("SUBMIT");
  if (role === "APPROVER" && status === "WAITING_APPROVAL") actions.push("APPROVE", "REJECT");
  if (role === "PUBLISHER" && status === "APPROVED") actions.push("PUBLISH");
  if (role === "PUBLISHER" && status === "PUBLISHED") actions.push("UNPUBLISH");
  return actions;
}

const ACTION_LABELS: Record<WorkflowAction, string> = {
  SUBMIT: "Ajukan",
  APPROVE: "Approve",
  REJECT: "Reject",
  PUBLISH: "Publish",
  UNPUBLISH: "Unpublish",
};

const ACTION_VARIANTS: Record<WorkflowAction, "default" | "primary" | "danger" | "success"> = {
  SUBMIT: "primary",
  APPROVE: "success",
  REJECT: "danger",
  PUBLISH: "success",
  UNPUBLISH: "danger",
};

const ACTION_ICONS: Record<WorkflowAction, ReactNode> = {
  SUBMIT: <Send className="h-3.5 w-3.5" />,
  APPROVE: <CheckCircle2 className="h-3.5 w-3.5" />,
  REJECT: <XCircle className="h-3.5 w-3.5" />,
  PUBLISH: <UploadCloud className="h-3.5 w-3.5" />,
  UNPUBLISH: <Eye className="h-3.5 w-3.5" />,
};

interface PeriodWorkflowBarProps {
  periodId: string | number;
  status: SpfPeriodStatus;
  role: SpfRole;
}

export function PeriodWorkflowBar({ periodId, status, role }: PeriodWorkflowBarProps) {
  const router = useRouter();
  const { alertElement, confirm, notifyError, notifySuccess } = useSweetAlert();
  const [isPending, startTransition] = useTransition();
  const [reasonAction, setReasonAction] = useState<"REJECT" | "UNPUBLISH" | null>(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const allowedActions = getAllowedActions(role, status);

  function onConflict(message: string) {
    notifyError("Data telah berubah", message || "Data telah berubah. Halaman akan diperbarui.");
    router.refresh();
  }

  async function execute(action: WorkflowAction, actionReason?: string) {
    if (action === "REJECT" || action === "UNPUBLISH") {
      if (!actionReason) {
        setReasonAction(action);
        setReason("");
        setReasonError(null);
        return;
      }
    } else {
      const ok = await confirm({
        title: `${ACTION_LABELS[action]} periode`,
        description: "Lanjutkan aksi workflow periode ini?",
        tone: action === "SUBMIT" ? "info" : "success",
        confirmLabel: ACTION_LABELS[action],
        cancelLabel: "Batal",
      });
      if (!ok) return;
    }

    startTransition(async () => {
      const result = await mutateSpf("period", {
        mode: action,
        period_id: String(periodId),
        ...(actionReason ? { reason: actionReason } : {}),
      } as any);

      if (!result.success) {
        if (result.status === 409) {
          onConflict(result.message);
          return;
        }
        notifyError("Gagal", result.message);
        return;
      }

      notifySuccess("Workflow diperbarui", `Periode berhasil: ${ACTION_LABELS[action]}.`);
      setReasonAction(null);
      setReason("");
      router.refresh();
    });
  }

  function submitReason() {
    const trimmed = reason.trim();
    if (!reasonAction) return;
    if (!trimmed) {
      setReasonError("Reason wajib diisi.");
      return;
    }
    if (trimmed.length > 2000) {
      setReasonError("Reason maksimal 2000 karakter.");
      return;
    }
    void execute(reasonAction, trimmed);
  }

  if (allowedActions.length === 0) return null;

  return (
    <>
      {alertElement}
      <div className="flex flex-wrap items-center gap-2">
        {allowedActions.map((action) => (
          <ActionButton key={action} variant={ACTION_VARIANTS[action]} disabled={isPending} onClick={() => { void execute(action); }}>
            {ACTION_ICONS[action]}
            {isPending ? "Memproses..." : ACTION_LABELS[action]}
          </ActionButton>
        ))}
      </div>

      <SpfDialog
        open={Boolean(reasonAction)}
        title={reasonAction === "REJECT" ? "Reason Reject" : "Reason Unpublish"}
        onClose={() => setReasonAction(null)}
        footer={
          <div className="flex justify-end gap-2">
            <ActionButton disabled={isPending} onClick={() => setReasonAction(null)}>Batal</ActionButton>
            <ActionButton variant="danger" disabled={isPending} onClick={submitReason}>
              {isPending ? "Memproses..." : "Konfirmasi"}
            </ActionButton>
          </div>
        }
      >
        <div className="space-y-2">
          <FieldLabel required>Reason</FieldLabel>
          <CompactTextarea
            rows={5}
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
              setReasonError(null);
            }}
            placeholder="Tuliskan alasan agar audit trail jelas."
            aria-describedby={reasonError ? "spf-workflow-reason-error" : undefined}
          />
          {reasonError ? <p id="spf-workflow-reason-error" className="text-[12px] text-destructive">{reasonError}</p> : null}
        </div>
      </SpfDialog>
    </>
  );
}

export function PeriodWorkflowActions(props: PeriodWorkflowBarProps) {
  return <PeriodWorkflowBar {...props} />;
}
