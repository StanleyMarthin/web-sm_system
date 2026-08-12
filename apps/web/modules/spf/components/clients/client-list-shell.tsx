"use client";
/* Hallmark · component: client-create-form · genre: modern-minimal · theme: existing dark admin tokens (Lexend Deca + JetBrains Mono, amber accent)
 * states: default · hover · focus · active · disabled · loading · error · success
 * contrast: pass */

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Copy, Eye, Plus, Search } from "lucide-react";
import { mutateSpf } from "@/shared/api/spf";
import { ActionButton, CompactInput, PageHeader, SectionCard } from "@/shared/ui/compact";
import { useSweetAlert } from "@/shared/ui/sweet-alert";
import { SpfDataTable } from "../spf-data-table";
import type { ClientWorkspaceRow } from "./client-workspace";

function accessLabel(status?: string | null) {
  return status === "SET" ? "Sudah diatur" : "Belum diatur";
}

function portalStatus(client: ClientWorkspaceRow) {
  if (!client.portalConfigured) return "Belum disiapkan";
  return client.status === "ACTIVE" ? "Aktif" : "Nonaktif";
}

function StatusBadge({ client }: { client: ClientWorkspaceRow }) {
  const active = client.portalConfigured && client.status === "ACTIVE";
  return <span className={`inline-flex border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.08em] ${active ? "border-success/25 bg-success/10 text-success" : "border-border bg-muted/40 text-muted-foreground"}`}>{portalStatus(client)}</span>;
}

function formatDate(value?: string | null) {
  return value
    ? new Date(value).toLocaleString("id-ID", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "-";
}

type RevealedCredentials = {
  portalUrl: string | null;
  accessCode: string | null;
};

export function ClientListShell({
  rows,
  totalUnits,
  canPreview = false,
  canCreate = false,
}: {
  rows: readonly ClientWorkspaceRow[];
  totalUnits: number;
  canPreview?: boolean;
  canCreate?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sweetAlert = useSweetAlert();

  const [revealed, setRevealed] = useState<Record<string, RevealedCredentials>>({});
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createPending, setCreatePending] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => () => setRevealed({}), []);

  function reveal(client: ClientWorkspaceRow) {
    if (!client.portalConfigured) return;

    setPendingId(client.id);

    startTransition(async () => {
      const result = await mutateSpf<{
        portal_url?: string | null;
        access_code?: string | null;
      }>("client", {
        mode: "REVEAL_CREDENTIALS",
        client_id: client.id,
      });

      setPendingId(null);

      if (!result.success) {
        sweetAlert.notifyError(
          "Data akses belum dapat ditampilkan",
          result.message,
        );
        return;
      }

      setRevealed((current) => ({
        ...current,
        [client.id]: {
          portalUrl: result.data.portal_url ?? null,
          accessCode: result.data.access_code ?? null,
        },
      }));
    });
  }

  function preview(client: ClientWorkspaceRow) {
    const previewWindow = window.open("about:blank", "_blank");

    if (!previewWindow) {
      sweetAlert.notifyError(
        "Preview diblokir browser",
        "Izinkan pop-up untuk membuka POV client.",
      );
      return;
    }

    previewWindow.opener = null;

    startTransition(async () => {
      const result = await mutateSpf<{ url?: string }>("client", {
        mode: "PREVIEW",
        client_id: client.id,
      });

      if (!result.success) {
        previewWindow.close();
        sweetAlert.notifyError("Preview belum dapat dibuka", result.message);
        return;
      }

      if (!result.data.url) {
        previewWindow.close();
        sweetAlert.notifyError(
          "Preview belum dapat dibuka",
          "URL preview tidak tersedia.",
        );
        return;
      }

      previewWindow.location.replace(result.data.url);
    });
  }

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      sweetAlert.notifySuccess("Disalin", label);
    } catch {
      sweetAlert.notifyError(
        "Gagal menyalin",
        "Clipboard browser tidak tersedia.",
      );
    }
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const params = new URLSearchParams(searchParams.toString());
    const search = String(formData.get("search") ?? "").trim();

    if (search) params.set("search", search);
    else params.delete("search");

    params.set("page", "1");
    router.push(`?${params.toString()}`);
  }

  function createClient(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (createPending) return;

    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") ?? "").trim();
    const status = String(formData.get("status") ?? "ACTIVE") === "INACTIVE" ? "INACTIVE" : "ACTIVE";
    const accessCode = String(formData.get("access_code") ?? "").trim();

    if (!name) {
      sweetAlert.notifyError("Nama client wajib diisi", "Isi nama sesuai customer di modul Unit.");
      return;
    }
    if (accessCode && accessCode.length < 8) {
      sweetAlert.notifyError("Access code terlalu pendek", "Minimal 8 karakter, atau kosongkan dulu.");
      return;
    }

    setCreatePending(true);
    startTransition(async () => {
      const result = await mutateSpf("client", {
        mode: "CREATE",
        name,
        status,
        access_code: accessCode || undefined,
      });
      setCreatePending(false);
      if (!result.success) {
        sweetAlert.notifyError("Client belum dapat dibuat", result.message);
        return;
      }
      sweetAlert.notifySuccess("Client dibuat", "Profil portal tersimpan dan unit otomatis terhubung.");
      setCreateOpen(false);
      router.push(`?clientName=${encodeURIComponent(name)}`);
    });
  }

  return (
    <section className="space-y-4">
      {sweetAlert.alertElement}

      <PageHeader
        eyebrow="SPF Admin · sumber data Unit"
        title="Client / Customer"
        actions={canCreate ? (
          <ActionButton variant="primary" onClick={() => setCreateOpen((open) => !open)}>
            <Plus className="h-3.5 w-3.5" />
            Tambah Client
          </ActionButton>
        ) : undefined}
      />

      {createOpen ? (
        <SectionCard label="Tambah Client Portal">
          <form onSubmit={createClient} className="grid gap-3 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
            <div>
              <label className="mb-1 block font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                Nama Client
              </label>
              <CompactInput
                name="name"
                required
                disabled={createPending}
                placeholder="Contoh: Mr. JAMES"
                className="w-full"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Harus sama dengan nama customer di modul Unit. Semua unit dengan nama itu otomatis terhubung.
              </p>
            </div>
            <div>
              <label className="mb-1 block font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                Access Code <span className="normal-case text-muted-foreground/60">(opsional)</span>
              </label>
              <CompactInput
                name="access_code"
                type="password"
                minLength={8}
                disabled={createPending}
                placeholder="Min. 8 karakter"
                className="w-full"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Kosongkan dulu bila kode diatur belakangan.
              </p>
            </div>
            <div>
              <label className="mb-1 block font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                Status
              </label>
              <select
                name="status"
                defaultValue="ACTIVE"
                disabled={createPending}
                className="h-9 w-full border border-border bg-background px-3 text-[13px] text-foreground outline-none focus:border-primary/55 sm:w-[140px]"
              >
                <option value="ACTIVE">Aktif</option>
                <option value="INACTIVE">Nonaktif</option>
              </select>
            </div>
            <div className="flex flex-wrap gap-2">
              <ActionButton type="submit" variant="primary" disabled={createPending}>
                {createPending ? "Menyimpan..." : "Buat Client"}
              </ActionButton>
              <ActionButton disabled={createPending} onClick={() => setCreateOpen(false)}>
                Batal
              </ActionButton>
            </div>
          </form>
        </SectionCard>
      ) : null}

      <SectionCard label="Filter">
        <form
          onSubmit={submit}
          className="flex flex-wrap items-end gap-2"
        >
          <div className="min-w-[260px] flex-1">
            <label className="mb-1 block font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
              Search
            </label>
            <CompactInput
              name="search"
              defaultValue={searchParams.get("search") ?? ""}
              placeholder="Cari nama client atau unit"
            />
          </div>

          <ActionButton type="submit" variant="primary">
            <Search className="h-3.5 w-3.5" />
            Filter
          </ActionButton>
        </form>
      </SectionCard>

      <SpfDataTable
        rows={rows}
        minWidth={1180}
        emptyMessage="Belum ada nama client pada data Unit."
        onRowClick={(client) =>
          router.push(`?clientName=${encodeURIComponent(client.display_name)}`)
        }
        columns={[
          {
            key: "client",
            label: "Client",
            render: (client) => (
              <p className="font-semibold text-foreground">
                {client.display_name}
              </p>
            ),
          },
          {
            key: "units",
            label: "Jumlah Unit",
            render: (client) => client.unit_count,
          },
          {
            key: "last",
            label: "Laporan Terakhir",
            render: (client) => (
              <div>
                <p className="max-w-[280px] text-foreground">
                  {client.last_report_title ?? "Belum ada laporan terbit"}
                </p>
                <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                  {formatDate(client.last_report_at)}
                </p>
              </div>
            ),
          },
          {
            key: "url",
            label: "URL Portal",
            render: (client) => {
              const value = revealed[client.id]?.portalUrl;

              if (!client.portalConfigured) {
                return <span className="text-muted-foreground">Belum terhubung</span>;
              }

              if (value) {
                return (
                  <div
                    className="flex max-w-[260px] items-center gap-2"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <a
                      href={value}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate font-mono text-[10px] text-app-accent-ink hover:underline"
                    >
                      {value}
                    </a>
                    <button
                      type="button"
                      aria-label="Salin URL portal"
                      onClick={() => {
                        void copy(value, "URL portal disalin.");
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              }

              if (revealed[client.id]) {
                return <span className="text-muted-foreground">Belum dibuat</span>;
              }

              return (
                <button
                  type="button"
                  disabled={pendingId === client.id}
                  onClick={(event) => {
                    event.stopPropagation();
                    reveal(client);
                  }}
                  className="font-mono text-[10px] uppercase text-app-accent-ink hover:underline disabled:opacity-50"
                >
                  <Eye className="mr-1 inline h-3.5 w-3.5" />
                  {pendingId === client.id ? "Memuat..." : "Tampilkan"}
                </button>
              );
            },
          },
          {
            key: "access",
            label: "Access Code",
            render: (client) => {
              const value = revealed[client.id]?.accessCode;

              if (!client.portalConfigured) {
                return <span className="text-muted-foreground">Belum terhubung</span>;
              }

              if (value) {
                return (
                  <div
                    className="flex items-center gap-2"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <span className="font-mono text-[11px] font-semibold text-foreground">
                      {value}
                    </span>
                    <button
                      type="button"
                      aria-label="Salin access code"
                      onClick={() => {
                        void copy(value, "Access code disalin.");
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              }

              if (revealed[client.id]) {
                return <span className="text-muted-foreground">Belum diatur</span>;
              }

              return (
                <button
                  type="button"
                  disabled={pendingId === client.id}
                  onClick={(event) => {
                    event.stopPropagation();
                    reveal(client);
                  }}
                  className="font-mono text-[10px] uppercase text-app-accent-ink hover:underline disabled:opacity-50"
                >
                  {accessLabel(client.access_code_status)} · Tampilkan
                </button>
              );
            },
          },
          {
            key: "status",
            label: "Status",
            render: (client) => <StatusBadge client={client} />,
          },
          {
            key: "actions",
            label: "Aksi",
            render: (client) => (
              <div
                className="flex flex-wrap gap-2"
                onClick={(event) => event.stopPropagation()}
              >
                {canPreview && client.portalConfigured ? (
                  <button
                    type="button"
                    onClick={() => preview(client)}
                    className="inline-flex h-8 items-center gap-1.5 border border-primary/35 px-2.5 font-mono text-[11px] uppercase tracking-[0.08em] text-app-accent-ink hover:bg-primary/10"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Review POV
                  </button>
                ) : null}

                <Link
                  href={`?clientName=${encodeURIComponent(client.display_name)}`}
                  className="inline-flex h-8 items-center gap-1.5 border border-border px-2.5 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground hover:bg-muted"
                >
                  <ArrowRight className="h-3.5 w-3.5" />
                  Detail
                </Link>
              </div>
            ),
          },
        ]}
      />

      <p className="font-mono text-[11px] text-muted-foreground">
        {rows.length} client dari {totalUnits} unit
      </p>
    </section>
  );
}
