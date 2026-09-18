export type CountdownEntryMode = "manual" | "upload";

export function resolveCountdownPhotoUrl(value: string): string | null {
  if (/^\/(?!\/)/u.test(value)) return value;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? value : null;
  } catch {
    return null;
  }
}

export function resolveCountdownRevisionActions(input: {
  status: string;
  extensionRequestStatus: string | null;
  canRequestRevision: boolean;
  canApproveRevision: boolean;
  canApproveMoRevision: boolean;
}) {
  const active = input.status === "PLAN" || input.status === "PROSES";

  return {
    canRequest:
      input.canRequestRevision &&
      active &&
      input.extensionRequestStatus !== "REQUESTED" &&
      input.extensionRequestStatus !== "MO_REVIEW",
    canApprove:
      input.canApproveRevision && input.extensionRequestStatus === "REQUESTED",
    canApproveMo:
      input.canApproveMoRevision && input.extensionRequestStatus === "MO_REVIEW",
  };
}

export function resolveCountdownEntryMode(
  editorMode: "create" | "edit",
  selectedMode: CountdownEntryMode,
): CountdownEntryMode {
  return editorMode === "edit" ? "manual" : selectedMode;
}

export function buildCountdownExportParams(unitId: string, divisionId: string, status: string) {
  if (!unitId) return null;
  return {
    unitId,
    ...(divisionId ? { divisionId } : {}),
    ...(status ? { status } : {}),
  };
}
