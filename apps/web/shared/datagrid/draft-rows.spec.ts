import { describe, expect, it } from "bun:test";
import {
  addSmsDraftRow,
  addSmsDraftRows,
  cancelSmsDraftRows,
  enforceSmsPasteRowLimit,
  hasSmsDraftChanges,
  markSmsDraftRowError,
  SMS_GRID_PASTE_ROW_LIMIT,
  type SmsDraftRowState,
} from "./draft-rows";

interface Row extends SmsDraftRowState {
  id: string;
  name: string;
}

function draft(): Row {
  return { id: "draft", name: "", isNew: true, error: null };
}

describe("sms grid draft rows", () => {
  it("adds one draft row immutably", () => {
    const rows: Row[] = [{ id: "1", name: "Persisted" }];
    const next = addSmsDraftRow(rows, draft);

    expect(rows).toHaveLength(1);
    expect(next).toHaveLength(2);
    expect(next[1]?.isNew).toBe(true);
  });

  it("adds multiple draft rows with paste limit", () => {
    expect(addSmsDraftRows([], 3, draft)).toHaveLength(3);
    expect(() => addSmsDraftRows([], SMS_GRID_PASTE_ROW_LIMIT + 1, draft)).toThrow("Maksimal 500 baris");
  });

  it("cancels draft rows only", () => {
    const next = cancelSmsDraftRows([
      { id: "1", name: "Persisted" },
      draft(),
    ]);

    expect(next).toEqual([{ id: "1", name: "Persisted" }]);
  });

  it("detects unsaved draft state", () => {
    expect(hasSmsDraftChanges([{ id: "1", name: "Persisted" }])).toBe(false);
    expect(hasSmsDraftChanges([{ id: "1", name: "Dirty", isDirty: true }])).toBe(true);
  });

  it("marks row errors without mutating siblings", () => {
    const rows = [
      { id: "1", name: "A", isNew: true, error: null },
      { id: "2", name: "B", isNew: true, error: null },
    ];
    const next = markSmsDraftRowError(rows, (row) => row.id === "2", "Wajib diisi");

    expect(rows[1]?.error).toBeNull();
    expect(next[0]?.error).toBeNull();
    expect(next[1]?.error).toBe("Wajib diisi");
  });

  it("returns friendly paste limit message", () => {
    expect(enforceSmsPasteRowLimit(10)).toBeNull();
    expect(enforceSmsPasteRowLimit(501)).toBe("Paste maksimal 500 baris.");
  });
});
