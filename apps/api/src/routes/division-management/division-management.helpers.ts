export function createsDivisionCycle(
  divisionId: number | null,
  parentId: number,
  parents: ReadonlyMap<number, number | null>,
): boolean {
  const visited = new Set<number>();
  let currentId: number | null = parentId;
  while (currentId !== null) {
    if (currentId === divisionId || visited.has(currentId)) return true;
    visited.add(currentId);
    currentId = parents.get(currentId) ?? null;
  }

  return false;
}
