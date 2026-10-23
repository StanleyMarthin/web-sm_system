const revisionStatusLabels: Record<string, string> = {
  REQUESTED: "Menunggu KP",
  MO_REVIEW: "Menunggu MO",
  APPROVED: "Disetujui",
  REJECTED: "Ditolak",
};

export function formatCountdownRevisionStatus(status: string | null | undefined): string {
  if (!status) return "Belum ada pengajuan";
  return revisionStatusLabels[status] ?? status.toLowerCase().split("_").map((word) => word[0]?.toUpperCase() + word.slice(1)).join(" ");
}
