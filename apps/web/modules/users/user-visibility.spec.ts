import { describe, expect, test } from "bun:test";
import { isUserVisible } from "./user-visibility";

describe("filter pengguna", () => {
  test("menampilkan pegawai aktif secara default dan nonaktif saat dicari", () => {
    expect(isUserVisible("ACTIVE", "ACTIVE", "")).toBe(true);
    expect(isUserVisible("INACTIVE", "ACTIVE", "  ")).toBe(false);
    expect(isUserVisible("INACTIVE", "ACTIVE", "nama")).toBe(true);
  });

  test("menghormati filter tidak aktif dan semua pengguna", () => {
    expect(isUserVisible("ACTIVE", "INACTIVE", "nama")).toBe(false);
    expect(isUserVisible("INACTIVE", "INACTIVE", "")).toBe(true);
    expect(isUserVisible("INACTIVE", "ALL", "")).toBe(true);
  });
});
