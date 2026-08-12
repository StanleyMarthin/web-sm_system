import type { UserGridReference } from "@smsystem/contracts/user";

type DivisionOption = UserGridReference["divisions"][number];

export function groupDivisionOptions(divisions: DivisionOption[]) {
  const parents = divisions.filter((division) => division.parentId == null);

  return parents.map((parent) => ({
    ...parent,
    teams: divisions.filter((division) => String(division.parentId) === parent.value),
  }));
}
