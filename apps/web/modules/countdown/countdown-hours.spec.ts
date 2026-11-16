import { expect, test } from "bun:test";
import { formatActualHours, formatBilledHours } from "./countdown-hours";

test("billed-hours formatter preserves null, zero, and positive values", () => {
  expect(formatBilledHours(null)).toBe("Belum ditagihkan");
  expect(formatBilledHours(0)).toBe("0.00 jam");
  expect(formatBilledHours(2.5)).toBe("2.50 jam");
  expect(formatActualHours(2.5)).toBe("2.50 jam");
});
