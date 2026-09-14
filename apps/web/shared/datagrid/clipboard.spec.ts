import { describe, expect, it } from "bun:test";
import {
  applyGridPaste,
  copyFocusedGridCell,
  copySelectedGridRows,
  createEnumPasteParser,
  isCopyShortcut,
  isPasteShortcut,
  parseClipboardTsv,
  type SmsGridClipboardColumn,
} from "./clipboard";

interface Row extends Record<string, unknown> {
  id: string;
  name: string;
  status: string;
  divisionId: number | null;
  action: string;
  isDraft: boolean;
}

const divisionParser = createEnumPasteParser([
  { value: "7", label: "BODY WORK" },
  { value: "8", label: "INTERIOR" },
]);

const columns: Array<SmsGridClipboardColumn<Row>> = [
  { key: "id", header: "ID", system: true },
  { key: "name", header: "Nama", editable: true },
  {
    key: "status",
    header: "Status",
    editable: true,
    format: (value) => value === "DONE" ? "Selesai" : "Menunggu",
    parse: createEnumPasteParser([
      { value: "WAITING", label: "Menunggu" },
      { value: "DONE", label: "Selesai" },
    ]),
  },
  {
    key: "divisionId",
    header: "Divisi",
    editable: true,
    format: (value) => value === 7 ? "BODY WORK" : "INTERIOR",
    parse: (value) => {
      const parsed = divisionParser(value);
      return parsed.error ? parsed : { value: Number(parsed.value) };
    },
  },
  { key: "action", header: "Aksi", action: true },
];

function draft(): Row {
  return {
    id: `draft-${Math.random()}`,
    name: "",
    status: "WAITING",
    divisionId: null,
    action: "",
    isDraft: true,
  };
}

describe("shared AG Grid clipboard helpers", () => {
  it("copies one focused human-readable value", () => {
    expect(copyFocusedGridCell(draft(), columns[2])).toBe("Menunggu");
  });

  it("copies selected rows as TSV with visible business columns only", () => {
    expect(copySelectedGridRows([
      { ...draft(), id: "1", name: "Repair bumper", status: "DONE", divisionId: 7 },
      { ...draft(), id: "2", name: "Install carpet", status: "WAITING", divisionId: 8 },
    ], columns)).toBe("Repair bumper\tSelesai\tBODY WORK\nInstall carpet\tMenunggu\tINTERIOR");
  });

  it("excludes action and internal columns from focused copy", () => {
    expect(copyFocusedGridCell(draft(), columns[0])).toBe("");
    expect(copyFocusedGridCell(draft(), columns[4])).toBe("");
  });

  it("parses one pasted cell", () => {
    const result = applyGridPaste({
      rows: [draft()],
      columns,
      startRowIndex: 0,
      startColumnKey: "name",
      text: "Repair bumper",
      createDraftRow: draft,
      isRowEditable: (row) => row.isDraft,
    });

    expect(result.rows[0]?.name).toBe("Repair bumper");
  });

  it("parses multi-column TSV", () => {
    const result = applyGridPaste({
      rows: [draft()],
      columns,
      startRowIndex: 0,
      startColumnKey: "name",
      text: "Repair bumper\tSelesai\tBODY WORK",
      createDraftRow: draft,
      isRowEditable: (row) => row.isDraft,
    });

    expect(result.rows[0]).toMatchObject({
      name: "Repair bumper",
      status: "DONE",
      divisionId: 7,
    });
  });

  it("parses multi-row TSV and appends draft rows", () => {
    const result = applyGridPaste({
      rows: [draft()],
      columns,
      startRowIndex: 0,
      startColumnKey: "name",
      text: "Repair bumper\nInstall carpet",
      createDraftRow: draft,
      isRowEditable: (row) => row.isDraft,
    });

    expect(result.rows.map((row) => row.name)).toEqual(["Repair bumper", "Install carpet"]);
  });

  it("does not overwrite immutable persisted rows", () => {
    const persisted: Row = {
      id: "1",
      name: "Persisted",
      status: "WAITING",
      divisionId: null,
      action: "",
      isDraft: false,
    };
    const result = applyGridPaste({
      rows: [persisted],
      columns,
      startRowIndex: 0,
      startColumnKey: "name",
      text: "Draft value",
      createDraftRow: draft,
      isRowEditable: (row) => row.isDraft,
    });

    expect(result.rows[0]?.name).toBe("Persisted");
    expect(result.rows[1]?.name).toBe("Draft value");
  });

  it("resolves enum by human label or canonical value", () => {
    expect(columns[2].parse?.("Selesai", draft()).value).toBe("DONE");
    expect(columns[2].parse?.("WAITING", draft()).value).toBe("WAITING");
  });

  it("returns validation error for unknown references", () => {
    const result = applyGridPaste({
      rows: [draft()],
      columns,
      startRowIndex: 0,
      startColumnKey: "divisionId",
      text: "UNKNOWN DIVISION",
      createDraftRow: draft,
      isRowEditable: (row) => row.isDraft,
    });

    expect(result.errors[0]).toMatchObject({
      columnKey: "divisionId",
      message: "Pilihan tidak dikenal: UNKNOWN DIVISION",
    });
  });

  it("detects Ctrl and Cmd shortcuts", () => {
    expect(isCopyShortcut({ key: "c", ctrlKey: true, metaKey: false })).toBe(true);
    expect(isPasteShortcut({ key: "V", ctrlKey: false, metaKey: true })).toBe(true);
  });

  it("parses CRLF clipboard text", () => {
    expect(parseClipboardTsv("A\tB\r\nC\tD\r\n")).toEqual([["A", "B"], ["C", "D"]]);
  });

  it("does not depend on AG Grid Enterprise", async () => {
    const packageJson = await Bun.file("apps/web/package.json").json();
    const enterprisePackage = ["ag-grid", "enterprise"].join("-");
    const enterpriseClipboardPackage = [`@${["ag-grid", "enterprise"].join("-")}`, "clipboard"].join("/");

    expect(packageJson.dependencies?.[enterprisePackage]).toBeUndefined();
    expect(packageJson.dependencies?.[enterpriseClipboardPackage]).toBeUndefined();
  });
});
