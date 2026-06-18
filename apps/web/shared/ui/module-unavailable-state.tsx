import Link from "next/link";

interface ModuleUnavailableStateProps {
  module: string;
  title: string;
  message: string;
  backHref?: string;
  backLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}

export function ModuleUnavailableState({
  module,
  title,
  message,
  backHref = "/dashboard",
  backLabel = "Ke Dashboard",
  secondaryHref,
  secondaryLabel,
}: ModuleUnavailableStateProps) {
  return (
    <div className="space-y-6">
      <div className="rounded-[18px] border border-border bg-white p-6 shadow-sm dark:border-white/[0.06] dark:bg-card dark:shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
        <p className="text-[11px] uppercase tracking-[0.16em] text-app-accent-ink dark:text-app-accent-ink/70">{module}</p>
        <h1 className="mt-3 text-2xl font-semibold text-foreground dark:font-light dark:text-foreground">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground dark:text-foreground/45">{message}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href={backHref}
            className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm text-foreground hover:border-border hover:bg-muted hover:text-foreground dark:border-white/[0.08] dark:text-foreground/65 dark:hover:text-foreground"
          >
            {backLabel}
          </Link>
          {secondaryHref && secondaryLabel ? (
            <Link
              href={secondaryHref}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-foreground hover:bg-primary dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary"
            >
              {secondaryLabel}
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
