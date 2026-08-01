"use client";

import { useState, useTransition } from "react";
import { Check, Copy, ExternalLink, Link2, Mail, MessageCircle, RotateCcw } from "lucide-react";
import { generateSpfPortalUrl, mutateSpf } from "@/shared/api/spf";
import type { SpfClient, SpfPeriod } from "@/shared/api/spf-contracts";
import { ActionButton, CompactInput, FieldLabel, PageHeader, SectionCard } from "@/shared/ui/compact";
import { useSweetAlert } from "@/shared/ui/sweet-alert";

interface ClientAccessShareTabProps {
  client?: SpfClient;
  publishedPeriods?: readonly SpfPeriod[];
  initialPeriodId?: string;
}

export function ClientAccessShareTab({ client, publishedPeriods = [], initialPeriodId = "" }: ClientAccessShareTabProps) {
  const [periodId, setPeriodId] = useState(initialPeriodId);
  const [accountId, setAccountId] = useState(client?.account_id ?? "");
  const [ownerSlug, setOwnerSlug] = useState(client?.owner_slug ?? "");
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [expiry, setExpiry] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { alertElement, notifyError, notifySuccess } = useSweetAlert();
  const identifierLocked = Boolean(client);
  const clientLabel = client?.display_name ?? ownerSlug ?? accountId ?? "Client";

  function generateUrl(event: React.FormEvent) {
    event.preventDefault();
    if (!periodId.trim()) {
      notifyError("Form belum lengkap", "Pilih periode PUBLISHED.");
      return;
    }
    if (!accountId.trim() && !ownerSlug.trim()) {
      notifyError("Identifier client kosong", "Gunakan account_id atau owner_slug dari data client.");
      return;
    }

    startTransition(async () => {
      const result = await generateSpfPortalUrl({
        period_id: periodId.trim(),
        account_id: accountId.trim() || undefined,
        owner_slug: ownerSlug.trim() || undefined,
      });
      if (!result.success) {
        notifyError("Gagal generate URL", result.message);
        return;
      }
      setGeneratedUrl(result.data.url);
      setExpiry(result.data.expires_at ?? null);
      notifySuccess("URL siap", "Link portal client berhasil dibuat.");
    });
  }

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      notifySuccess("Disalin", label);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      notifyError("Gagal menyalin", "Clipboard browser tidak tersedia.");
    }
  }

  function resetAccessCode() {
    if (!client) return;
    startTransition(async () => {
      const result = await mutateSpf("client", { mode: "RESET_ACCESS_CODE", client_id: client.id });
      if (!result.success) {
        notifyError("Gagal reset access code", result.message);
        return;
      }
      notifySuccess("Access code direset", "Plaintext access code lama tidak ditampilkan.");
    });
  }

  const whatsappTemplate = generatedUrl
    ? `Halo ${clientLabel}, laporan progress kendaraan sudah tersedia: ${generatedUrl}`
    : "";
  const emailTemplate = generatedUrl
    ? `Subject: Laporan Progress Kendaraan\n\nHalo ${clientLabel},\n\nLaporan progress kendaraan sudah tersedia melalui link berikut:\n${generatedUrl}\n\nTerima kasih.`
    : "";

  return (
    <div className="space-y-4">
      {alertElement}
      <SectionCard label="Akses & Berbagi">
        <div className="grid gap-4 lg:grid-cols-2">
          <form onSubmit={generateUrl} className="space-y-3">
            <div className="border border-border bg-muted/30 px-3 py-2 text-[12px] text-muted-foreground dark:border-white/[0.06]">
              Status access code: <span className="font-semibold text-foreground">{client?.access_code_status ?? "Tidak diketahui"}</span>. Plaintext access code lama tidak ditampilkan.
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <FieldLabel>account_id</FieldLabel>
                <CompactInput value={accountId} onChange={(event) => setAccountId(event.target.value)} disabled={identifierLocked || isPending} />
              </div>
              <div>
                <FieldLabel>owner_slug</FieldLabel>
                <CompactInput value={ownerSlug} onChange={(event) => setOwnerSlug(event.target.value)} disabled={identifierLocked || isPending} />
              </div>
            </div>

            <div>
              <FieldLabel required>Periode PUBLISHED</FieldLabel>
              {publishedPeriods.length > 0 ? (
                <select
                  value={periodId}
                  onChange={(event) => setPeriodId(event.target.value)}
                  disabled={isPending}
                  className="h-9 w-full border border-border bg-card px-3 text-[13px] text-foreground outline-none focus:border-primary/55 dark:border-white/[0.08] dark:bg-muted"
                >
                  <option value="">Pilih periode</option>
                  {publishedPeriods.map((period) => (
                    <option key={period.id} value={period.id}>{period.car_id} · {period.title}</option>
                  ))}
                </select>
              ) : (
                <CompactInput value={periodId} onChange={(event) => setPeriodId(event.target.value)} placeholder="period_id PUBLISHED" disabled={isPending} />
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <ActionButton type="submit" variant="primary" disabled={isPending}>
                <Link2 className="h-3.5 w-3.5" />
                {isPending ? "Generate..." : "Generate URL"}
              </ActionButton>
              {client ? (
                <ActionButton disabled={isPending} onClick={resetAccessCode}>
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset Access Code
                </ActionButton>
              ) : null}
            </div>
          </form>

          <div className="space-y-3">
            {generatedUrl ? (
              <>
                <div className="border border-primary/25 bg-primary/8 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-app-accent-ink">URL Portal</p>
                    {expiry ? <p className="font-mono text-[11px] text-muted-foreground">Expiry: {expiry}</p> : null}
                  </div>
                  <p className="mt-2 break-all font-mono text-[12px] text-foreground">{generatedUrl}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <ActionButton variant={copied ? "success" : "primary"} onClick={() => { void copy(generatedUrl, "URL portal disalin."); }}>
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    Copy URL
                  </ActionButton>
                  <a href={generatedUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 border border-border px-3 font-mono text-[12px] uppercase tracking-[0.08em] text-muted-foreground hover:bg-muted">
                    <ExternalLink className="h-3.5 w-3.5" />
                    Uji Buka
                  </a>
                </div>
                <ActionButton onClick={() => { void copy(whatsappTemplate, "Template WhatsApp disalin."); }}>
                  <MessageCircle className="h-3.5 w-3.5" />
                  Template WhatsApp
                </ActionButton>
                <ActionButton onClick={() => { void copy(emailTemplate, "Template email disalin."); }}>
                  <Mail className="h-3.5 w-3.5" />
                  Template Email
                </ActionButton>
              </>
            ) : (
              <div className="border border-dashed border-border px-3 py-8 text-center text-[13px] text-muted-foreground dark:border-white/[0.08]">
                URL portal akan muncul setelah generate berhasil.
              </div>
            )}
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

export function UrlGeneratorShell({
  publishedPeriods,
  initialPeriodId = "",
}: {
  publishedPeriods?: SpfPeriod[];
  initialOwnerName?: string;
  initialPeriodId?: string;
}) {
  return (
    <div className="space-y-4">
      <PageHeader eyebrow="SM-SPF Administrator" title="Portal URL Generator" />
      <ClientAccessShareTab publishedPeriods={publishedPeriods ?? []} initialPeriodId={initialPeriodId} />
    </div>
  );
}
