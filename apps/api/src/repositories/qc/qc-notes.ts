export function parseQcNotes(value: string | null | undefined): Record<string, unknown> | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const envelope = parsed as Record<string, unknown>;
    return envelope.jobPlanDraft && typeof envelope.jobPlanDraft === "object"
      && !Array.isArray(envelope.jobPlanDraft)
      && ["DRAFT", "SUBMITTED", "DISMISSED"].includes(String(envelope.jobPlanDraftState))
      ? envelope : null;
  } catch {
    return null;
  }
}

export function readQcNotesText(value: string | null | undefined): string | null {
  const envelope = parseQcNotes(value);
  return envelope ? (typeof envelope.notes === "string" ? envelope.notes : null) : value ?? null;
}

export function qcNotesTextSql(column: string): string {
  return `(CASE WHEN JSON_VALID(${column}) THEN
    CASE WHEN JSON_TYPE(JSON_EXTRACT(${column}, '$.jobPlanDraft')) = 'OBJECT'
      AND JSON_UNQUOTE(JSON_EXTRACT(${column}, '$.jobPlanDraftState')) IN ('DRAFT', 'SUBMITTED', 'DISMISSED')
      THEN CASE WHEN JSON_TYPE(JSON_EXTRACT(${column}, '$.notes')) = 'STRING'
        THEN JSON_UNQUOTE(JSON_EXTRACT(${column}, '$.notes')) ELSE NULL END
      ELSE ${column} END
    ELSE ${column} END)`;
}

export function qcReworkValueSql(column: string, path: string): string {
  return `(CASE WHEN JSON_VALID(${column}) THEN
    CASE WHEN JSON_TYPE(JSON_EXTRACT(${column}, '$.jobPlanDraft')) = 'OBJECT'
      THEN NULLIF(JSON_UNQUOTE(JSON_EXTRACT(${column}, '${path}')), 'null') ELSE NULL END
    ELSE NULL END)`;
}
