import type { WebSession } from "@/services/auth/session.service";

export function applyRequestsVisibilityScope(session: WebSession): WebSession {
  return session;
}
