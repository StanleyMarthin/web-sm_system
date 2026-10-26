import { afterEach, describe, expect, it } from "bun:test";
import { resetLoginFailures } from "@/services/auth/login-attempts";
import { SmLoginAdapterError } from "@/services/auth/sm-login.adapter";
import { handleLoginRoute } from "./auth.routes";

const employeeId = "SM-00.998";

afterEach(async () => {
  await resetLoginFailures(employeeId);
});

describe("handleLoginRoute", () => {
  for (const upstreamMessage of ["Employee ID tidak ditemukan.", "Password salah."]) {
    it(`does not reveal credential detail for ${upstreamMessage}`, async () => {
      const response = await handleLoginRoute(
        new Request("http://127.0.0.1:3001/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ employeeId, password: "wrong-password", force: true }),
        }),
        {
          async login() {
            throw new SmLoginAdapterError(upstreamMessage, 401, "AUTH_LOGIN_FAILED", {});
          },
        } as any,
      );

      expect(response.status).toBe(401);
      expect(await response.json()).toMatchObject({
        success: false,
        message: "Employee ID atau password salah.",
        errorCode: "INVALID_CREDENTIALS",
      });
    });
  }
});
