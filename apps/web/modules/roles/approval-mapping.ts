export interface ApprovalBlueprint {
  key: string;
  label: string;
  roleLevel: string;
  approvalRank: string;
  note: string;
}

export interface ApprovalFields {
  roleLevel: string;
  approvalRank: string;
}

export const approvalBlueprints: ApprovalBlueprint[] = [
  { key: "support_staff", label: "Staff Support", roleLevel: "100", approvalRank: "", note: "Operasional harian, tidak masuk rantai approval." },
  { key: "coordinator_support", label: "Koordinator Support", roleLevel: "140", approvalRank: "", note: "Gudang, finance, atau admin spesialis tanpa approval proyek." },
  { key: "division_lead", label: "Ketua Divisi", roleLevel: "180", approvalRank: "1", note: "Pemeriksa pertama dari divisi yang memegang pekerjaan." },
  { key: "advisor", label: "QA", roleLevel: "220", approvalRank: "2", note: "Pengawas teknis dan validasi lintas pekerjaan divisi." },
  { key: "project_head", label: "KP / Kepala Produksi", roleLevel: "320", approvalRank: "3", note: "Penanggung jawab unit atau proyek pada tahap akhir operasional." },
  { key: "global_management", label: "PM / MP / MIS", roleLevel: "900", approvalRank: "9", note: "Kontrol global lintas unit, approval pusat, dan audit penuh." },
];

export function resolveApprovalBlueprintKey(form: ApprovalFields): string {
  const match = approvalBlueprints.find((blueprint) => blueprint.roleLevel === form.roleLevel && blueprint.approvalRank === form.approvalRank);
  return match?.key ?? "legacy";
}

export function closestApprovalBlueprint(form: ApprovalFields): ApprovalBlueprint {
  const level = Number(form.roleLevel) || 0;
  const rank = form.approvalRank === "" ? null : Number(form.approvalRank);
  return approvalBlueprints.reduce((closest, candidate) => {
    const score = (blueprint: ApprovalBlueprint) => Math.abs((Number(blueprint.roleLevel) || 0) - level) + (blueprint.approvalRank === "" ? rank === null ? 0 : 500 : Math.abs(Number(blueprint.approvalRank) - (rank ?? 0)) * 100);
    return score(candidate) < score(closest) ? candidate : closest;
  });
}
