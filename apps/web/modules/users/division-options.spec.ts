import { describe, expect, it } from "bun:test";
import { groupDivisionOptions } from "./division-options";

describe("groupDivisionOptions", () => {
  it("groups every child by parent without division-name hardcoding", () => {
    expect(groupDivisionOptions([
      { value: "63", label: "Mechanic", parentId: null },
      { value: "7", label: "Mechanic / Team Fiki", parentId: 63 },
      { value: "80", label: "Body Work", parentId: null },
      { value: "81", label: "Body Work / Team A", parentId: 80 },
    ])).toEqual([
      { value: "63", label: "Mechanic", parentId: null, teams: [
        { value: "7", label: "Mechanic / Team Fiki", parentId: 63 },
      ] },
      { value: "80", label: "Body Work", parentId: null, teams: [
        { value: "81", label: "Body Work / Team A", parentId: 80 },
      ] },
    ]);
  });
});
