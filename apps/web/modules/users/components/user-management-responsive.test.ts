import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const read = (file: string) => readFileSync(new URL(file, import.meta.url), "utf8");

describe("user management editor responsiveness", () => {
  test("keeps the editor inside the viewport and makes its content scrollable", () => {
    const shell = read("./user-management-shell.tsx");

    expect(shell).toContain("max-h-[calc(100svh-1rem)]");
    expect(shell).toContain("overflow-hidden");
  });

  test.each(["user-create-form.tsx", "user-edit-form.tsx"])(
    "%s scrolls within the editor and keeps actions reachable",
    (file) => {
      const form = read(`./forms/${file}`);

      expect(form).toContain("min-h-0 overflow-y-auto");
      expect(form).toContain("sticky bottom-0");
      expect(form).toMatch(/flex-col-reverse[^\"]*sm:flex-row/);
    },
  );
});
