"use client";

import { useState, useTransition } from "react";
import { Copy, ExternalLink, Eye, Link2, Mail, MessageCircle, RotateCcw } from "lucide-react";
import { generateSpfPortalUrl, mutateSpf } from "@/shared/api/spf";
import type { SpfClient } from "@/shared/api/spf-contracts";
import { ActionButton, CompactInput, SectionCard } from "@/shared/ui/compact";
import { useSweetAlert } from "@/shared/ui/sweet-alert";

interface ClientAccessShareTabProps {
  client: SpfClient;
  canGenerateUrl?: boolean;
  canManageAccess?: boolean;
  canPreview?: boolean;
}

export function ClientAccessShareTab({ client, canGenerateUrl = false, canManageAccess = false, canPreview = false }: ClientAccessShareTabProps) {
  const accountId = client.account_id ?? "";
  const ownerSlug = client.owner_slug ?? "";
  const [accessCode, setAccessCode] = useState("");
  const [newAccessCode, setNewAccessCode] = useState<string | null>(null);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const sweetAlert = useSweetAlert();
  const { alertElement, notifyError, notifySuccess } = sweetAlert;
  const clientLabel = client.display_name;

  function generateUrl() {
    if (!canGenerateUrl) return;
    if (!accountId.trim() && !ownerSlug.trim()) {
      notifyError("Data identitas client belum tersedia", "Lengkapi data identitas client terlebih dahulu.");
      return;
    }

    startTransition(async () => {
      const result = await generateSpfPortalUrl({
        account_id: accountId.trim() || undefined,
        owner_slug: ownerSlug.trim() || undefined,
      });
      if (!result.success) {
        notifyError("Gagal membuat URL", result.message);
        return;
      }
      setGeneratedUrl(result.data.url);
      notifySuccess("URL siap", "Link portal client berhasil dibuat.");
    });
  }

  function revealCredentials() {
    if (!canManageAccess) return;
    startTransition(async () => {
      const result = await mutateSpf<{ portal_url?: string | null; access_code?: string | null }>("client", { mode: "REVEAL_CREDENTIALS", client_id: client.id });
      if (!result.success) return notifyError("Data akses belum dapat ditampilkan", result.message);
      setGeneratedUrl(result.data.portal_url ?? null);
      setNewAccessCode(result.data.access_code ?? null);
      notifySuccess("Data akses ditampilkan", "URL dan access code dibuka untuk sesi admin ini.");
    });
  }

  function previewClient() {
    if (!canPreview) return;
    const previewWindow = window.open("about:blank", "_blank");
    if (!previewWindow) return notifyError("Preview diblokir browser", "Izinkan pop-up untuk membuka POV client.");
    previewWindow.opener = null;
    startTransition(async () => {
      const result = await mutateSpf<{ url?: string }>("client", { mode: "PREVIEW", client_id: client.id });
      if (!result.success) {
        previewWindow.close();
        return notifyError("Preview belum dapat dibuka", result.message);
      }
      if (!result.data.url) {
        previewWindow.close();
        return notifyError("Preview belum dapat dibuka", "URL preview tidak tersedia.");
      }
      previewWindow.location.replace(result.data.url);
    });
  }

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      notifySuccess("Disalin", label);
    } catch {
      notifyError("Gagal menyalin", "Clipboard browser tidak tersedia.");
    }
  }

  async function resetAccessCode() {
    if (!canManageAccess) return;
    const confirmed = await sweetAlert.confirm({
      title: "Buat ulang access code?",
      description: "Access code lama akan langsung tidak berlaku. Kode baru hanya ditampilkan satu kali.",
      tone: "warning",
      confirmLabel: "Buat ulang",
    });
    if (!confirmed) return;
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
    if (!canManageAccess || accessCode.trim().length < 8) {
      notifyError("Access code tidak valid", "Masukkan minimal 8 karakter.");
      return;
    }
    startTransition(async () => {
      const result = await mutateSpf<{ access_code?: string }>("client", { mode: "SET_ACCESS_CODE", client_id: client.id, access_code: accessCode.trim() });
      if (!result.success) {
        notifyError("Gagal menyimpan access code", result.message);
        return;
      }
      setAccessCode("");
      setNewAccessCode(result.data.access_code ?? accessCode.trim());
      notifySuccess("Access code diperbarui", "Kode tersimpan dengan aman dan dapat ditampilkan kembali oleh admin berizin.");
    });
  }

  const whatsappTemplate = generatedUrl
    ? `Halo ${clientLabel}, laporan progress kendaraan sudah tersedia: ${generatedUrl}`
    : "";
  const emailTemplate = generatedUrl
    ? `Subject: Laporan Progress Kendaraan\n\nHalo ${clientLabel},\n\nLaporan progress kendaraan sudah tersedia melalui link berikut:\n${generatedUrl}\n\nTerima kasih.`
    : "";

  const reviewUrl = generatedUrl;
  const portalUrl = reviewUrl;
  const isDevUrl = (() => {
    if (!portalUrl) return false;
    try {
      const host = new URL(portalUrl).hostname;
      return host === "localhost" || host === "127.0.0.1" || host.endsWith(".local");
    } catch {
      return false;
    }
  })();

  return (
    <div className="space-y-4">
      {alertElement}
      <SectionCard label="Akses Portal">
          <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
            <div className="space-y-3">
              <div className="border border-border bg-muted/30 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Link Portal Client</p>
                  {isDevUrl ? <span className="border border-primary/30 bg-primary/10 px-2 py-1 font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-app-accent-ink">Mode Pengembangan</span> : null}
                </div>
                <p className="mt-2 break-all font-mono text-[11px] text-foreground">{portalUrl ?? "Belum dibuat. Klik Buat Link Review saat akan digunakan."}</p>
              </div>
              <p className="text-[12px] text-muted-foreground">
                URL portal client tersimpan selama masa aktif link. Link baru menggantikan link sebelumnya.
              </p>
              <div className="flex flex-wrap gap-2">
                {canGenerateUrl ? (
                  <ActionButton variant="primary" disabled={isPending} onClick={generateUrl}>
                    <Link2 className="h-3.5 w-3.5" />{isPending ? "Menyiapkan..." : "Buat URL Portal"}
                  </ActionButton>
                ) : null}
                {canManageAccess ? <ActionButton disabled={isPending} onClick={revealCredentials}><Eye className="h-3.5 w-3.5" />Tampilkan Data Tersimpan</ActionButton> : null}
                {canPreview ? <ActionButton disabled={isPending} onClick={previewClient}><Eye className="h-3.5 w-3.5" />Review POV Client</ActionButton> : null}
                {reviewUrl ? (
                  <a href={reviewUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 border border-primary/35 px-3 font-mono text-[12px] font-semibold uppercase tracking-[0.08em] text-app-accent-ink hover:bg-primary/10">
                    <ExternalLink className="h-3.5 w-3.5" />Review di Portal Client
                  </a>
                ) : null}
                {portalUrl ? <ActionButton onClick={() => { void copy(portalUrl, "Link portal disalin."); }}><Copy className="h-3.5 w-3.5" />Salin Link</ActionButton> : null}
                {reviewUrl ? <ActionButton onClick={() => { void copy(whatsappTemplate, "Template WhatsApp disalin."); }}><MessageCircle className="h-3.5 w-3.5" />Template WA</ActionButton> : null}
                {reviewUrl ? <ActionButton onClick={() => { void copy(emailTemplate, "Template email disalin."); }}><Mail className="h-3.5 w-3.5" />Template Email</ActionButton> : null}
              </div>
            </div>

            <div className="space-y-3 border-t border-border pt-4 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Access Code</p>
                <p className="mt-1 text-[13px] text-foreground">{client.access_code_status === "SET" ? "Sudah diatur" : "Belum diatur"}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">Kode disimpan dengan aman. Gunakan Tampilkan Data Tersimpan bila perlu melihatnya.</p>
              </div>
              {canManageAccess ? (
                <>
                  <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                    <CompactInput type="password" value={accessCode} onChange={(event) => setAccessCode(event.target.value)} placeholder="Access code baru" disabled={isPending} />
                    <ActionButton disabled={isPending} onClick={handleSetAccessCode}>Simpan</ActionButton>
                  </div>
                  <ActionButton disabled={isPending} onClick={() => { void resetAccessCode(); }}><RotateCcw className="h-3.5 w-3.5" />Buat Ulang Access Code</ActionButton>
                </>
              ) : null}
              {newAccessCode ? (
                <div className="border border-primary/25 bg-primary/8 p-3">
                  <p className="text-[11px] text-muted-foreground">Access code aktif</p>
                  <p className="mt-2 font-mono text-[13px] font-semibold text-foreground">{newAccessCode}</p>
                  <ActionButton onClick={() => { void copy(newAccessCode, "Access code disalin."); }}><Copy className="h-3.5 w-3.5" />Salin Kode</ActionButton>
                </div>
              ) : null}
            </div>
          </div>
      </SectionCard>
    </div>
  );
}
