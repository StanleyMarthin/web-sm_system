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
      <div className="rounded-[28px] border border-white/[0.06] bg-[#050505] p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
        <p className="text-[11px] uppercase tracking-[0.2em] text-amber-500/70">{module}</p>
        <h1 className="mt-3 text-2xl font-light text-white">{title}</h1>
        <p className="mt-2 text-sm text-white/45">{message}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href={backHref}
            className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] px-4 py-2 text-sm text-white/65 hover:text-white"
          >
            {backLabel}
          </Link>
          {secondaryHref && secondaryLabel ? (
            <Link
              href={secondaryHref}
              className="inline-flex items-center gap-2 rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-400"
            >
              {secondaryLabel}
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
