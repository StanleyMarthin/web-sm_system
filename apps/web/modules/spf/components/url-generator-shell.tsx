"use client";

import { useEffect, useState, useTransition } from "react";
import { generateSpfPortalUrl, mutateSpf } from "@/shared/api/spf";
import type { SpfPeriod } from "@/shared/api/spf-contracts";
import { ActionButton, CompactInput, FieldLabel, PageHeader, SectionCard } from "@/shared/ui/compact";
import { useSweetAlert } from "@/shared/ui/sweet-alert";
import { Copy, ExternalLink, Link2, Check, Sparkles, ShieldCheck } from "lucide-react";

interface UrlGeneratorShellProps {
  publishedPeriods?: SpfPeriod[];
  initialOwnerName?: string;
  initialPeriodId?: string;
}

export function UrlGeneratorShell({
  publishedPeriods: initialPublishedPeriods,
  initialOwnerName = "",
  initialPeriodId = "",
}: UrlGeneratorShellProps) {
  const [ownerName, setOwnerName] = useState(initialOwnerName);
  const [periodId, setPeriodId] = useState(initialPeriodId);
  const [periods, setPeriods] = useState<SpfPeriod[]>(initialPublishedPeriods ?? []);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { alertElement, notifyError, notifySuccess } = useSweetAlert();

  useEffect(() => {
    if (initialPublishedPeriods && initialPublishedPeriods.length > 0) return;

    async function loadPublishedPeriods() {
      const res = await mutateSpf<{ periods: SpfPeriod[] }>("period", {
        mode: "LIST",
        limit: 100,
        offset: 0,
      });
      if (res.success && res.data?.periods) {
        const published = res.data.periods.filter(
          (p) => p.status === "PUBLISHED"
        );
        setPeriods(published);
      }
    }
    loadPublishedPeriods();
  }, [initialPublishedPeriods]);

  const publishedPeriods = periods;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ownerName.trim()) {
      notifyError("Form Belum Lengkap", "Silakan masukkan nama client / owner.");
      return;
    }
    if (!periodId.toString().trim()) {
      notifyError("Form Belum Lengkap", "Silakan masukkan atau pilih ID periode.");
      return;
    }

    startTransition(async () => {
      const result = await generateSpfPortalUrl(ownerName.trim(), periodId.toString().trim());
      if (result.success) {
        setGeneratedUrl(result.data.url);
        notifySuccess("URL Berhasil Digenerate", "Link akses portal siap dibagikan ke client.");
      } else {
        notifyError("Gagal Generate URL", result.message);
      }
    });
  }

  async function handleCopy() {
    if (!generatedUrl) return;
    try {
      await navigator.clipboard.writeText(generatedUrl);
      setCopied(true);
      notifySuccess("Disalin ke Clipboard", "URL portal berhasil disalin.");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      notifyError("Gagal Menyalin", "Tidak dapat menyalin URL secara otomatis.");
    }
  }

  return (
    <div className="space-y-6">
      {alertElement}

      <PageHeader
        eyebrow="SM-SPF Administrator"
        title="Portal URL Generator"
        actions={
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
              <ShieldCheck className="h-3.5 w-3.5" />
              Direct Auth Ready
            </span>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Form Card */}
        <div className="lg:col-span-6">
          <SectionCard label="Form Input Parameter URL Portal">
            <form onSubmit={handleSubmit} className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <FieldLabel required>Nama Owner / Client</FieldLabel>
                <CompactInput
                  placeholder="Contoh: Mr. ADRIAN"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  disabled={isPending}
                />
                <p className="text-[11px] text-muted-foreground">
                  Nama owner atau slug identitas client yang terdaftar di sistem.
                </p>
              </div>

              <div className="space-y-1.5">
                <FieldLabel required>ID Periode Progress (PUBLISHED)</FieldLabel>
                {publishedPeriods.length > 0 ? (
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={periodId}
                    onChange={(e) => setPeriodId(e.target.value)}
                    disabled={isPending}
                  >
                    <option value="">-- Pilih Periode Progress --</option>
                    {publishedPeriods.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title} (#{p.id})
                      </option>
                    ))}
                  </select>
                ) : (
                  <CompactInput
                    placeholder="Contoh: PORSCHE930_ADRIAN-2026-06-004"
                    value={periodId}
                    onChange={(e) => setPeriodId(e.target.value)}
                    disabled={isPending}
                  />
                )}
                <p className="text-[11px] text-muted-foreground">
                  Hanya periode yang berstatus <span className="font-semibold text-success">PUBLISHED</span> yang dapat digenerate token aksesnya.
                </p>
              </div>

              <div className="pt-2">
                <ActionButton
                  type="submit"
                  variant="primary"
                  disabled={isPending || !ownerName.trim() || !periodId.trim()}
                  className="w-full justify-center gap-2 py-2.5 font-medium shadow-md transition-all hover:shadow-lg"
                >
                  <Sparkles className="h-4 w-4" />
                  {isPending ? "Generating URL..." : "Generate URL Portal Klien"}
                </ActionButton>
              </div>
            </form>
          </SectionCard>
        </div>

        {/* Result Card */}
        <div className="lg:col-span-6">
          <SectionCard label="Hasil URL & Uji Akses">
            {generatedUrl ? (
              <div className="space-y-4 pt-2">
                <div className="rounded-lg border border-primary/25 bg-gradient-to-br from-primary/5 via-background to-primary/10 p-4 shadow-sm">
                  <div className="flex items-center justify-between pb-2">
                    <span className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-primary">
                      <Link2 className="h-4 w-4" />
                      Client Portal Link
                    </span>
                    <span className="rounded bg-success/15 px-2 py-0.5 font-mono text-[10px] uppercase font-bold text-success">
                      Token Active
                    </span>
                  </div>

                  <div className="relative my-2 rounded border border-border bg-card p-3 font-mono text-xs break-all text-foreground select-all">
                    {generatedUrl}
                  </div>

                  <div className="flex flex-wrap gap-2 pt-2">
                    <ActionButton
                      variant={copied ? "success" : "primary"}
                      onClick={handleCopy}
                      className="flex-1 justify-center gap-1.5"
                    >
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      {copied ? "Link Tersalin!" : "Salin Link URL"}
                    </ActionButton>

                    <a
                      href={generatedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent hover:text-accent-foreground"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Uji Buka Portal
                    </a>
                  </div>
                </div>

                <div className="rounded-md border border-border/80 bg-muted/40 p-3 text-xs space-y-1.5 text-muted-foreground">
                  <p className="font-semibold text-foreground">💡 Informasi Penggunaan:</p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>Kirimkan URL ini ke client (via WhatsApp, Email, atau SMS).</li>
                    <li>Client yang mengklik link ini akan otomatis terverifikasi tanpa perlu memasukkan token manual.</li>
                    <li>Sesi verifikasi tersimpan di backend hingga periode selesai atau publikasi dicabut.</li>
                  </ul>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-12 text-center">
                <div className="rounded-full bg-muted p-3 text-muted-foreground mb-3">
                  <Link2 className="h-6 w-6" />
                </div>
                <h3 className="text-sm font-medium text-foreground">Belum ada URL yang digenerate</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                  Isi form di samping lalu klik <strong>Generate URL Portal Klien</strong> untuk membuat link portal unik.
                </p>
              </div>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
