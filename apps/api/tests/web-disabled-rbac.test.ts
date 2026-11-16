import { expect, test } from "bun:test";
import { requireSession } from "@/middleware/auth.middleware";
import type { AuthService } from "@/services/auth/auth.service";

test("a stored active session cannot bypass a disabled web role", async () => {
  const auth = {getCurrentSession: async () => ({user:{permissions:["user.manage"],roleProfile:{webEnabled:false}}})} as unknown as AuthService;
  const result = await requireSession(new Request("http://api.test/api/roles"), auth);
  expect("response" in result ? result.response.status : 200).toBe(403);
});
