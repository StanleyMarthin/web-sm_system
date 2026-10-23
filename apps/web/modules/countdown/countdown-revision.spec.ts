import { describe, expect, it } from "bun:test";
import { formatCountdownRevisionStatus } from "./countdown-revision";

describe("countdown revision UI", () => {
  it("uses human revision status labels", () => {
    expect(formatCountdownRevisionStatus("REQUESTED")).toBe("Menunggu KP");
    expect(formatCountdownRevisionStatus("MO_REVIEW")).toBe("Menunggu MO");
    expect(formatCountdownRevisionStatus(null)).toBe("Belum ada pengajuan");
  });
});
