"use client";

import { Bell, History, LoaderCircle, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { getApiBaseUrl } from "@/shared/api/config";
import { parseNotifications, type WebNotification } from "./notification-mapper";

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function NotificationInbox() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<WebNotification[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "ready">("idle");
  const rootRef = useRef<HTMLDivElement>(null);

  async function load() {
    setStatus("loading");
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/notifications`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!response.ok) throw new Error("notification request failed");
      setItems(parseNotifications(await response.json()));
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }

  useEffect(() => {
    function close(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label="Riwayat notifikasi"
        aria-expanded={open}
        onClick={() => {
          setOpen((value) => !value);
          if (status === "idle") void load();
        }}
        className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Bell className="h-4 w-4" />
      </button>

      {open ? (
        <section className="absolute right-0 top-full z-50 mt-2 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-border bg-popover shadow-xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-popover-foreground">Notifikasi</p>
              <p className="text-[11px] text-muted-foreground">Riwayat pemberitahuan terbaru</p>
            </div>
            <History className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </div>

          <div className="max-h-[min(28rem,70vh)] overflow-y-auto">
            {status === "loading" ? (
              <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-muted-foreground">
                <LoaderCircle className="h-4 w-4 animate-spin" /> Memuat notifikasi...
              </div>
            ) : status === "error" ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-muted-foreground">Notifikasi gagal dimuat.</p>
                <button type="button" onClick={() => void load()} className="mt-3 inline-flex items-center gap-2 text-xs font-medium text-primary hover:underline">
                  <RefreshCw className="h-3.5 w-3.5" /> Coba lagi
                </button>
              </div>
            ) : items.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-muted-foreground">Belum ada notifikasi.</div>
            ) : (
              <ul className="divide-y divide-border">
                {items.map((item) => {
                  const content = (
                    <>
                      <p className="text-sm font-medium text-popover-foreground">{item.title}</p>
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{item.body}</p>
                      {item.createdAt ? (
                        <time className="mt-2 block text-[10px] text-muted-foreground" dateTime={item.createdAt}>
                          {Number.isNaN(Date.parse(item.createdAt)) ? item.createdAt : dateFormatter.format(new Date(item.createdAt))}
                        </time>
                      ) : null}
                    </>
                  );
                  return (
                    <li key={item.id}>
                      {item.href ? (
                        <Link href={item.href} onClick={() => setOpen(false)} className="block px-4 py-3 transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none">
                          {content}
                        </Link>
                      ) : (
                        <div className="px-4 py-3">{content}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
