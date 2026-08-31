"use client";

import type { UnitEtaRecord } from "@smsystem/contracts/calendar";
import type { IssueRecord, IssueStatus } from "@smsystem/contracts/issue";
import { CheckCircle2, RefreshCcw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  acknowledgeIssue,
  assignIssue,
  escalateIssue,
  markIssueQcRecheck,
  resolveIssue,
  startIssue,
  waiveIssue,
} from "@/shared/api/issues";
import { humanizeCodeLabel, fmtDateTime } from "@/shared/format/humanize";

interface IssueDetailShellProps {
  issue: IssueRecord;
  relatedIssues: IssueRecord[];
  eta: UnitEtaRecord | null;
  employeeOptions: Array<{ label: string; value: string }>;
  canSubmit: boolean;
  canValidate: boolean;
}

function SummaryCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5">
      <p className="text-[10px] uppercase tracking-[0.18em] text-foreground/35">{label}</p>
      <p className="mt-3 text-lg text-foreground">{value}</p>
      {helper ? <p className="mt-2 text-sm text-foreground/40">{helper}</p> : null}
    </div>
  );
}

function canAcknowledge(status: IssueStatus): boolean {
  return status === "OPEN";
}

function canStart(status: IssueStatus): boolean {
  return ["OPEN", "ACKNOWLEDGED", "ESCALATED"].includes(status);
}

function canQcRecheck(status: IssueStatus): boolean {
  return ["IN_PROGRESS", "RESOLVED"].includes(status);
}

function canResolve(status: IssueStatus): boolean {
  return status === "QC_RECHECK";
}

function canEscalate(status: IssueStatus): boolean {
  return ["OPEN", "ACKNOWLEDGED"].includes(status);
}

function canWaive(status: IssueStatus): boolean {
  return status === "OPEN";
}

export function IssueDetailShell({
  issue,
  relatedIssues,
  eta,
  employeeOptions,
  canSubmit,
  canValidate,
}: IssueDetailShellProps) {
  const router = useRouter();
  const [assignTo, setAssignTo] = useState(issue.assignedTo ?? "");
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [escalateNotes, setEscalateNotes] = useState("");
  const [waiveNotes, setWaiveNotes] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const flow = [
    { status: "OPEN", label: "Dibuat" },
    { status: "ACKNOWLEDGED", label: "Ditugaskan" },
    { status: "IN_PROGRESS", label: "Dikerjakan" },
    { status: "QC_RECHECK", label: "Diperiksa" },
    { status: "RESOLVED", label: "Selesai" },
  ] as const;
  const activeStep = Math.max(0, flow.findIndex((step) => step.status === issue.status));

  async function runAction(action: () => Promise<{ success: boolean; message?: string }>) {
    setIsSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const result = await action();
      if (!result.success) {
        setError(result.message ?? "Tindakan gagal diproses.");
        return;
      }

      setMessage("Issue berhasil diupdate.");
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Nomor Issue"
          value={issue.issueNumber}
          helper={humanizeCodeLabel(issue.sourceType)}
        />
        <SummaryCard
          label="Status"
          value={humanizeCodeLabel(issue.status)}
          helper={`Tingkat ${humanizeCodeLabel(issue.severity)}`}
        />
        <SummaryCard
          label="Unit"
          value={issue.unitName}
          helper={issue.divisionName ?? "-"}
        />
        <SummaryCard
          label="ETA Risk"
          value={eta?.riskLevel ? humanizeCodeLabel(eta.riskLevel) : "Belum ada"}
          helper={eta?.predictedDeliveryDate ? `ETA ${eta.predictedDeliveryDate}` : "ETA belum tersedia"}
        />
      </section>

      <section className="rounded-[28px] border border-white/[0.06] bg-card p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
        <div className="mb-6 grid grid-cols-5 gap-1" aria-label="Alur penyelesaian pembahasan">
          {flow.map((step, index) => (
            <div key={step.status} className="min-w-0 text-center">
              <div className={`h-1 ${index <= activeStep ? "bg-primary" : "bg-white/[0.08]"}`} />
              <p className={`mt-2 truncate text-[10px] ${index <= activeStep ? "text-foreground" : "text-foreground/30"}`}>{step.label}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-[11px] uppercase tracking-[0.18em] text-app-accent-ink/70">
              Detail Issue
            </p>
            <h1 className="mt-2 text-2xl font-medium text-foreground">{issue.title}</h1>
            <p className="mt-3 text-sm leading-6 text-foreground/50">{issue.description}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/issues"
              className="rounded-full bg-white/[0.03] px-3 py-1.5 text-[11px] uppercase tracking-[0.16em] text-foreground/60 ring-1 ring-white/[0.06] hover:text-foreground/80"
            >
              Kembali ke Daftar Issue
            </Link>
            <button
              type="button"
              onClick={() => router.refresh()}
              className="inline-flex items-center gap-2 rounded-full bg-white/[0.03] px-3 py-1.5 text-[11px] uppercase tracking-[0.16em] text-foreground/60 ring-1 ring-white/[0.06] hover:text-foreground/80"
            >
              <RefreshCcw className="h-3.5 w-3.5" />
              Muat Ulang
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5">
            <p className="text-[10px] uppercase tracking-[0.18em] text-foreground/35">Ringkasan</p>
            <div className="mt-4 space-y-2 text-sm text-foreground/60">
              <p>Dilaporkan oleh: {issue.reportedByName ?? "-"}</p>
              <p>Ditangani oleh: {issue.assignedToName ?? "-"}</p>
              <p>Dibuat: {fmtDateTime(issue.createdAt)}</p>
              <p>Diperbarui: {fmtDateTime(issue.updatedAt)}</p>
              <p>Penyelesaian: {issue.resolutionNotes ?? "-"}</p>
            </div>
          </div>
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5">
            <p className="text-[10px] uppercase tracking-[0.18em] text-foreground/35">Unit Terkait</p>
            <div className="mt-4 space-y-2 text-sm text-foreground/60">
              <p>Customer: {issue.customerName ?? "-"}</p>
              <p>ID Unit: {issue.carId}</p>
              <p>Countdown ID: {issue.countdownId ?? "-"}</p>
              <p>Plan ID: {issue.planId ?? "-"}</p>
              <p>Referensi: {issue.sourceRefId ?? "-"}</p>
              {issue.planId ? <p className="text-app-accent-ink">Terhubung ke jobdesc</p> : null}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-[28px] border border-white/[0.06] bg-card p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
          <p className="text-[11px] uppercase tracking-[0.18em] text-app-accent-ink/70">Tindakan</p>
          <h2 className="mt-1 text-lg font-medium text-foreground">Perbarui Alur Penanganan</h2>

          <div className="mt-5 space-y-4">
            {canValidate && canAcknowledge(issue.status) ? (
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => void runAction(() => acknowledgeIssue(issue.issueId))}
                className="inline-flex h-11 items-center gap-2 rounded-2xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary disabled:opacity-60"
              >
                <CheckCircle2 className="h-4 w-4" />
                Terima Issue
              </button>
            ) : null}

            {canValidate && ["OPEN", "ACKNOWLEDGED", "ESCALATED"].includes(issue.status) ? (
              <div className="space-y-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
                <p className="text-sm text-foreground">Tentukan PIC Issue</p>
                <select
                  value={assignTo}
                  onChange={(event) => setAssignTo(event.target.value)}
                  className="h-11 w-full rounded-2xl border border-white/[0.06] bg-black/40 px-3 text-sm text-foreground outline-none focus:border-primary/30"
                >
                  <option value="">Pilih PIC</option>
                  {employeeOptions.map((employee) => (
                    <option key={employee.value} value={employee.value}>
                      {employee.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={isSubmitting || !assignTo}
                  onClick={() =>
                    void runAction(async () => {
                      const employee = employeeOptions.find((item) => item.value === assignTo);
                      return assignIssue(issue.issueId, {
                        assignedTo: assignTo,
                        assignedToName: employee?.label ?? null,
                      });
                    })
                  }
                  className="inline-flex h-11 items-center rounded-2xl border border-white/[0.06] bg-white/[0.04] px-4 text-sm text-foreground/80 hover:text-foreground disabled:opacity-60"
                >
                  Simpan PIC
                </button>
              </div>
            ) : null}

            {canSubmit && canStart(issue.status) ? (
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => void runAction(() => startIssue(issue.issueId))}
                className="inline-flex h-11 items-center rounded-2xl border border-white/[0.06] bg-white/[0.04] px-4 text-sm text-foreground/80 hover:text-foreground disabled:opacity-60"
              >
                Mulai Progres
              </button>
            ) : null}

            {canSubmit && canQcRecheck(issue.status) ? (
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => void runAction(() => markIssueQcRecheck(issue.issueId))}
                className="inline-flex h-11 items-center rounded-2xl border border-white/[0.06] bg-white/[0.04] px-4 text-sm text-foreground/80 hover:text-foreground disabled:opacity-60"
              >
                Tandai QC Ulang
              </button>
            ) : null}

            {canValidate && canResolve(issue.status) ? (
              <div className="space-y-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
                <p className="text-sm text-foreground">Selesaikan Issue</p>
                <textarea
                  value={resolutionNotes}
                  onChange={(event) => setResolutionNotes(event.target.value)}
                  rows={3}
                  placeholder="Catatan penyelesaian"
                  className="w-full rounded-2xl border border-white/[0.06] bg-black/40 px-3 py-3 text-sm text-foreground outline-none placeholder:text-foreground/20 focus:border-primary/30"
                />
                <button
                  type="button"
                  disabled={isSubmitting || !resolutionNotes.trim()}
                  onClick={() =>
                    void runAction(() =>
                      resolveIssue(issue.issueId, {
                        resolutionNotes: resolutionNotes.trim(),
                      }),
                    )
                  }
                  className="inline-flex h-11 items-center rounded-2xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary disabled:opacity-60"
                >
                  Selesaikan
                </button>
              </div>
            ) : null}

            {canValidate && canEscalate(issue.status) ? (
              <div className="space-y-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
                <p className="text-sm text-foreground">Eskalasi Issue</p>
                <textarea
                  value={escalateNotes}
                  onChange={(event) => setEscalateNotes(event.target.value)}
                  rows={3}
                  placeholder="Alasan eskalasi"
                  className="w-full rounded-2xl border border-white/[0.06] bg-black/40 px-3 py-3 text-sm text-foreground outline-none placeholder:text-foreground/20 focus:border-primary/30"
                />
                <button
                  type="button"
                  disabled={isSubmitting || !escalateNotes.trim()}
                  onClick={() =>
                    void runAction(() =>
                      escalateIssue(issue.issueId, {
                        note: escalateNotes.trim(),
                      }),
                    )
                  }
                  className="inline-flex h-11 items-center rounded-2xl border border-white/[0.06] bg-white/[0.04] px-4 text-sm text-foreground/80 hover:text-foreground disabled:opacity-60"
                >
                  Eskalasi
                </button>
              </div>
            ) : null}

            {canValidate && canWaive(issue.status) ? (
              <div className="space-y-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
                <p className="text-sm text-foreground">Tutup dengan Pengecualian</p>
                <textarea
                  value={waiveNotes}
                  onChange={(event) => setWaiveNotes(event.target.value)}
                  rows={3}
                  placeholder="Alasan waive"
                  className="w-full rounded-2xl border border-white/[0.06] bg-black/40 px-3 py-3 text-sm text-foreground outline-none placeholder:text-foreground/20 focus:border-primary/30"
                />
                <button
                  type="button"
                  disabled={isSubmitting || !waiveNotes.trim()}
                  onClick={() =>
                    void runAction(() =>
                      waiveIssue(issue.issueId, {
                        note: waiveNotes.trim(),
                      }),
                    )
                  }
                  className="inline-flex h-11 items-center rounded-2xl border border-white/[0.06] bg-white/[0.04] px-4 text-sm text-foreground/80 hover:text-foreground disabled:opacity-60"
                >
                  Ajukan Pengecualian
                </button>
              </div>
            ) : null}

            {message ? <p className="text-sm text-success">{message}</p> : null}
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
        </div>

        <div className="rounded-[28px] border border-white/[0.06] bg-card p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
          <p className="text-[11px] uppercase tracking-[0.18em] text-app-accent-ink/70">Issue Terkait</p>
          <h2 className="mt-1 text-lg font-medium text-foreground">Issue lain pada unit ini</h2>

          <div className="mt-5 space-y-3">
            {relatedIssues.map((row) => (
              <Link
                key={row.issueId}
                href={`/issues/${row.issueId}`}
                className={[
                  "block rounded-2xl border px-4 py-4 transition-colors",
                  row.issueId === issue.issueId
                    ? "border-primary/30 bg-primary/10"
                    : "border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.04]",
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-app-accent-ink">{row.issueNumber}</p>
                    <p className="mt-2 text-sm text-foreground">{row.title}</p>
                    <p className="mt-1 text-sm text-foreground/45">{row.status} · {row.severity}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
