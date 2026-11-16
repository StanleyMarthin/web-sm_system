import { describe, expect, it } from "bun:test";
import { getRoleDisplayName } from "@/shared/auth/role-display";

describe("getRoleDisplayName", () => {
  it("keeps the stored role name", () => {
    expect(getRoleDisplayName("mis")).toBe("mis");
    expect(getRoleDisplayName("MIS")).toBe("MIS");
  });

  it("keeps other roles unchanged", () => {
    expect(getRoleDisplayName("kepala_produksi")).toBe("kepala_produksi");
  });
});
