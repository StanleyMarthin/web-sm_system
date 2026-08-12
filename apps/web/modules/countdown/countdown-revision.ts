const revisionStatusLabels: Record<string, string> = {
  REQUESTED: "Menunggu Persetujuan KP",
  MO_REVIEW: "Menunggu Persetujuan MO",
  APPROVED: "Disetujui",
  REJECTED: "Ditolak",
};

export function formatCountdownRevisionStatus(status: string | null | undefined): string {
  if (!status) return "Belum Ada Pengajuan";
  return revisionStatusLabels[status] ?? status.toLowerCase().split("_").map((word) => word[0]?.toUpperCase() + word.slice(1)).join(" ");
}
