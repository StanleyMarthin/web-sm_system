import type { AuthService } from "@/services/auth/auth.service";
import { errorResponse } from "@/http/response";
import type { WebSession } from "@/services/auth/session.service";

export async function requireSession(
  request: Request,
  authService: AuthService,
): Promise<{ session: WebSession } | { response: Response }> {
  const session = await authService.getCurrentSession(request);
  if (!session) {
    return {
      response: errorResponse(
        request,
        "Sesi tidak valid atau sudah berakhir.",
        401,
        "INVALID_SESSION",
      ),
    };
  }

  return { session };
}
