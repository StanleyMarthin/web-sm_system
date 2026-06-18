export default function ForbiddenPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <div className="max-w-md rounded-[18px] border border-border bg-white p-8 text-center shadow-sm dark:border-white/[0.06] dark:bg-white/[0.03] dark:shadow-none">
        <p className="text-[11px] uppercase tracking-[0.16em] text-app-accent-ink dark:text-app-accent-ink/70">
          Access Denied
        </p>
        <h1 className="mt-4 text-2xl font-semibold dark:font-light">Izin akses tidak mencukupi</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground dark:text-foreground/45">
          Endpoint dashboard bootstrap ditolak oleh permission guard backend.
        </p>
      </div>
    </div>
  );
}
