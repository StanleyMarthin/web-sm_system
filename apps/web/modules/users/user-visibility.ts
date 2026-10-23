import type { UserRecord } from "@smsystem/contracts/user";

export function isUserVisible(status: UserRecord["status"], filter: "ACTIVE" | "INACTIVE" | "ALL", search: string): boolean {
  return filter === "ALL" || (filter === "ACTIVE" && search.trim() !== "") || status === filter;
}
