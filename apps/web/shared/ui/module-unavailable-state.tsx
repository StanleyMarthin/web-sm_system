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
      <div className="rounded-[18px] border border-gray-200 bg-white p-6 shadow-sm dark:border-white/[0.06] dark:bg-[#050505] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
        <p className="text-[11px] uppercase tracking-[0.16em] text-amber-700 dark:text-amber-500/70">{module}</p>
        <h1 className="mt-3 text-2xl font-semibold text-gray-950 dark:font-light dark:text-white">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-white/45">{message}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href={backHref}
            className="inline-flex items-center gap-2 rounded-full border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:border-gray-400 hover:bg-gray-50 hover:text-gray-950 dark:border-white/[0.08] dark:text-white/65 dark:hover:text-white"
          >
            {backLabel}
          </Link>
          {secondaryHref && secondaryLabel ? (
            <Link
              href={secondaryHref}
              className="inline-flex items-center gap-2 rounded-full bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500 dark:bg-amber-500 dark:text-black dark:hover:bg-amber-400"
            >
              {secondaryLabel}
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
