import { describe, expect, it } from "bun:test";
import { detectAllowedImageContentType } from "./upload-ticket";

describe("detectAllowedImageContentType", () => {
  it("detects jpeg from magic bytes", () => {
    expect(detectAllowedImageContentType(new Uint8Array([0xff, 0xd8, 0xff, 0xdb]))).toBe("image/jpeg");
  });

  it("detects png from magic bytes", () => {
    expect(detectAllowedImageContentType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
  });

  it("detects webp from magic bytes", () => {
    expect(detectAllowedImageContentType(new Uint8Array([
      0x52,
      0x49,
      0x46,
      0x46,
      0x00,
      0x00,
      0x00,
      0x00,
      0x57,
      0x45,
      0x42,
      0x50,
    ]))).toBe("image/webp");
  });

  it("rejects unknown image bytes", () => {
    expect(detectAllowedImageContentType(new Uint8Array([0x00, 0x01, 0x02]))).toBe(null);
  });
});
