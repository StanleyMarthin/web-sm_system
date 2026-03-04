import { memo } from "react";
import { cn } from "@/lib/utils";

// ============================================================
// DarkCard — darkcard reusable (luxury dark theme)
// ============================================================

interface DarkCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * `true` → tambah efek hover border (untuk card yang bisa diklik/detail).
   * Default hanya hover background saja.
   */
  interactive?: boolean;
}

/**
 * darkcard standar yang dipakai hampir di seluruh halaman.
 *
 * ```tsx
 * <DarkCard className="p-4 flex items-center gap-3">
 *   ...konten...
 * </DarkCard>
 *
 * <DarkCard interactive className="px-4 pt-4">
 *   ...konten card yang bisa diklik...
 * </DarkCard>
 * ```
 */
export const DarkCard = memo(function DarkCard({
  className,
  interactive,
  ...props
}: DarkCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05]",
        interactive
          ? "hover:border-white/[0.1] transition-all"
          : "transition-colors",
        className,
      )}
      {...props}
    />
  );
});
