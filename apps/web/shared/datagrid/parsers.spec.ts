import { describe, expect, it } from "bun:test";
import {
  normalizeSmsDurationText,
  normalizeSmsTimeText,
  parseSmsBoolean,
  parseSmsDate,
  parseSmsDurationMinutes,
  parseSmsInteger,
  parseSmsNumber,
  parseSmsReference,
  parseSmsTime,
  parseSmsTrimmedText,
} from "./parsers";

describe("sms grid parsers", () => {
  it("trims text", () => {
    expect(parseSmsTrimmedText("  BODY WORK  ").value).toBe("BODY WORK");
  });

  it("parses number and integer", () => {
    expect(parseSmsNumber("12,5").value).toBe(12.5);
    expect(parseSmsInteger("12").value).toBe(12);
    expect(parseSmsInteger("12.5").error).toBe("Angka harus bilangan bulat.");
  });

  it("parses date, time, and duration", () => {
    expect(parseSmsDate("14/09/2026").value).toBe("2026-09-14");
    expect(parseSmsTime("8:05").value).toBe("08:05");
    expect(parseSmsTime("8").value).toBe("08:00");
    expect(parseSmsTime("830").value).toBe("08:30");
    expect(normalizeSmsTimeText("8:5").value).toBe("08:05");
    expect(parseSmsTime("2360").error).toBe("Jam tidak valid.");
    expect(parseSmsDurationMinutes("03:30").value).toBe(210);
    expect(parseSmsDurationMinutes("32").value).toBe(1920);
    expect(normalizeSmsDurationText("32").value).toBe("32:00");
    expect(normalizeSmsDurationText("10:5").value).toBe("10:05");
  });

  it("parses human boolean aliases", () => {
    expect(parseSmsBoolean("Ya").value).toBe(true);
    expect(parseSmsBoolean("Normal").value).toBe(false);
  });

  it("resolves reference by label, code, alias, or value", () => {
    const options = [
      { value: "7", label: "BODY WORK", code: "BODY", aliases: ["BW"] },
      { value: "8", label: "INTERIOR", code: "INT" },
    ];

    expect(parseSmsReference("BODY WORK", options, "Divisi").value).toBe("7");
    expect(parseSmsReference("body", options, "Divisi").value).toBe("7");
    expect(parseSmsReference("BW", options, "Divisi").value).toBe("7");
    expect(parseSmsReference("8", options, "Divisi").value).toBe("8");
  });

  it("rejects unknown or ambiguous reference", () => {
    expect(parseSmsReference("UNKNOWN", [], "Divisi").error).toBe('Divisi "UNKNOWN" tidak ditemukan.');
    expect(parseSmsReference("BODY", [
      { value: "7", label: "BODY", code: "BW1" },
      { value: "9", label: "BODY", code: "BW2" },
    ], "Divisi").error).toBe('Divisi "BODY" ambigu.');
  });
});
