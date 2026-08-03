"use client";

import { useState, useTransition } from "react";
import { Check, Copy, ExternalLink, Link2, Mail, MessageCircle, RotateCcw } from "lucide-react";
import { generateSpfPortalUrl, mutateSpf } from "@/shared/api/spf";
import type { SpfClient } from "@/shared/api/spf-contracts";
import { ActionButton, CompactInput, FieldLabel, PageHeader, SectionCard } from "@/shared/ui/compact";
import { useSweetAlert } from "@/shared/ui/sweet-alert";

interface ClientAccessShareTabProps {
  client?: SpfClient;
}

export function ClientAccessShareTab({ client }: ClientAccessShareTabProps) {
  const [accountId, setAccountId] = useState(client?.account_id ?? "");
  const [ownerSlug, setOwnerSlug] = useState(client?.owner_slug ?? "");
  const [accessCode, setAccessCode] = useState("");
  const [newAccessCode, setNewAccessCode] = useState<string | null>(null);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [expiry, setExpiry] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { alertElement, notifyError, notifySuccess } = useSweetAlert();
  const identifierLocked = Boolean(client);
  const clientLabel = client?.display_name ?? ownerSlug ?? accountId ?? "Client";

  function generateUrl(event: React.FormEvent) {
    event.preventDefault();
    if (!accountId.trim() && !ownerSlug.trim()) {
      notifyError("Identifier client kosong", "Gunakan account_id atau owner_slug dari data client.");
      return;
    }

    startTransition(async () => {
      const result = await generateSpfPortalUrl({
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
      const result = await mutateSpf<{ access_code?: string }>("client", { mode: "RESET_ACCESS_CODE", client_id: client.id });
      if (!result.success) {
        notifyError("Gagal reset access code", result.message);
        return;
      }
      const generated = typeof result.data.access_code === "string" ? result.data.access_code : null;
      setNewAccessCode(generated);
      notifySuccess("Access code direset", "Kode baru hanya ditampilkan pada sesi ini.");
    });
  }

  function handleSetAccessCode() {
    if (!client || accessCode.trim().length < 4) {
      notifyError("Access code tidak valid", "Masukkan minimal 4 karakter.");
      return;
    }
    startTransition(async () => {
      const result = await mutateSpf("client", { mode: "SET_ACCESS_CODE", client_id: client.id, access_code: accessCode.trim() });
      if (!result.success) {
        notifyError("Gagal menyimpan access code", result.message);
        return;
      }
      setAccessCode("");
      setNewAccessCode(null);
      notifySuccess("Access code diperbarui", "Plaintext access code lama tidak pernah ditampilkan.");
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

            <div className="flex flex-wrap gap-2">
              <ActionButton type="submit" variant="primary" disabled={isPending}>
                <Link2 className="h-3.5 w-3.5" />
                {isPending ? "Generate..." : "Generate URL"}
              </ActionButton>
              {client ? (
                <ActionButton type="button" disabled={isPending} onClick={resetAccessCode}>
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset Access Code
                </ActionButton>
              ) : null}
            </div>
            {client ? (
              <div className="grid gap-2 border-t border-border pt-3 dark:border-white/[0.08] sm:grid-cols-[1fr_auto]">
                <CompactInput type="password" value={accessCode} onChange={(event) => setAccessCode(event.target.value)} placeholder="Access code baru" disabled={isPending} />
                <ActionButton type="button" disabled={isPending} onClick={handleSetAccessCode}>Simpan Access Code</ActionButton>
              </div>
            ) : null}
            {newAccessCode ? <p className="border border-primary/25 bg-primary/8 px-3 py-2 font-mono text-[12px] text-foreground">Kode baru: {newAccessCode}</p> : null}
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
}: Record<string, never>) {
  return (
    <div className="space-y-4">
      <PageHeader eyebrow="SM-SPF Administrator" title="Portal URL Generator" />
      <ClientAccessShareTab />
    </div>
  );
}
