import { describe, expect, it } from "bun:test";
import { getRoleDisplayName } from "@/shared/auth/role-display";

describe("getRoleDisplayName", () => {
  it("aliases mis role to Super Admin", () => {
    expect(getRoleDisplayName("mis")).toBe("Super Admin");
    expect(getRoleDisplayName("MIS")).toBe("Super Admin");
  });

  it("keeps other roles unchanged", () => {
    expect(getRoleDisplayName("kepala_produksi")).toBe("kepala_produksi");
  });
});
