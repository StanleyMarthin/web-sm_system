export interface DivisionTechnicalReference {
  value?: string | number | null;
  label?: string | null;
  code?: string | null;
  isTeknis?: boolean | null;
  isTechnical?: boolean | null;
}

export function isNonTechnicalDivisionReference(
  division: DivisionTechnicalReference | null | undefined,
): boolean {
  if (!division) {
    return false;
  }

  if (division.isTeknis === false || division.isTechnical === false) {
    return true;
  }

  if (division.isTeknis === true || division.isTechnical === true) {
    return false;
  }

  return false;
}

export function isNonTechnicalDivision(
  divisionId: string,
  divisions: DivisionTechnicalReference[],
): boolean {
  const division = divisions.find((item) => String(item.value ?? "") === divisionId);
  return isNonTechnicalDivisionReference(division);
}
