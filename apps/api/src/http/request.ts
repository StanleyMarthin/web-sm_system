import type { ZodSchema } from "zod";

export async function parseJsonBody<T>(
  request: Request,
  schema: ZodSchema<T>,
): Promise<{ success: true; data: T } | { success: false; response: Response }> {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return {
      success: false,
      response: Response.json(
        {
          success: false,
          message: "Request body tidak valid.",
          errorCode: "INVALID_JSON",
          data: {},
        },
        { status: 400 },
      ),
    };
  }

  const result = schema.safeParse(payload);
  if (!result.success) {
    return {
      success: false,
      response: Response.json(
        {
          success: false,
          message: "Payload request tidak valid.",
          errorCode: "INVALID_PAYLOAD",
          data: {
            issues: result.error.issues,
          },
        },
        { status: 400 },
      ),
    };
  }

  return {
    success: true,
    data: result.data,
  };
}
