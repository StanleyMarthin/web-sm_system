import { describe, expect, it } from "bun:test";
import { formatEmployeeId, nextEmployeeSequence } from "./users.repo";

describe("employee ID allocation", () => {
  it("keeps sequence numbers within the selected division", () => {
    expect(nextEmployeeSequence(["SM-11.001", "SM-11.003", "SM-12.014"], 11)).toBe(4);
    expect(formatEmployeeId(11, 4)).toBe("SM-11.004");
  });
});
