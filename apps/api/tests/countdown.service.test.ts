import type { AuthUser } from "@smsystem/contracts/auth";
import type { CountdownImportResult, CountdownTemplateRow } from "@smsystem/contracts/countdown";
import { describe, expect, test } from "bun:test";
import * as XLSX from "xlsx";
import type { CountdownRepository } from "@/repositories/countdown.repo";
import { DefaultCountdownService } from "@/services/countdown.service";
import type { WebSession } from "@/services/auth/session.service";

const sampleUser: AuthUser = {
  employeeId: "SM-03.004",
  fullName: "Sahrul Riswanto",
  email: null,
  roleId: 20,
  roleName: "mis",
  divisionId: 3,
  divisionName: "MANAGEMENT INFORMATION SYSTEM",
  grade: "MIS",
  permissions: ["PROFILE_VIEW", "view_all_units"],
  scope: {
    canViewAllUnits: true,
    canViewAssignedUnits: false,
    divisionIds: [3],
    managedDivisionIds: [3],
    unitIds: [],
  },
};

const sampleSession: WebSession = {
  sessionId: "session-1",
  sessionKey: "session:SM-03.004:session-1",
  employeeId: sampleUser.employeeId,
  refreshToken: "refresh-1",
  mobileSessionKey: "session:SM-03.004",
  deviceId: "web-device-1",
  user: sampleUser,
  createdAt: "2026-05-13T00:00:00.000Z",
};

function createStubRepository(
  captured: {
    params: {
      employeeId: string;
      scope: WebSession["user"]["scope"];
    } | null;
    rows: CountdownTemplateRow[];
  },
): CountdownRepository {
  return {
    async createCountdownImports(
      params: {
        employeeId: string;
        scope: WebSession["user"]["scope"];
      },
      rows: CountdownTemplateRow[],
    ) {
      captured.params = params;
      captured.rows = rows;
      return {
        inserted: rows.length,
        updated: 0,
        rejected: 0,
        issues: [],
      } satisfies CountdownImportResult;
    },
  } as unknown as CountdownRepository;
}

function buildWorkbook(headers: string[], row: Array<string | number>): Uint8Array {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([headers, row]);
  XLSX.utils.book_append_sheet(workbook, sheet, "countdown-template");
  return XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx",
  }) as Uint8Array;
}

describe("DefaultCountdownService", () => {
  test("builds a human-friendly template workbook", () => {
    const service = new DefaultCountdownService();
    const workbook = XLSX.read(service.buildTemplateWorkbook(), {
      type: "buffer",
    });

    expect(workbook.SheetNames).toEqual(["countdown-template", "panduan"]);

    const sheet = workbook.Sheets["countdown-template"];
    const rows = XLSX.utils.sheet_to_json<string[]>(sheet, {
      header: 1,
      raw: false,
      defval: "",
    });

    expect(rows[0]).toEqual([
      "Kode Unit/Mobil",
      "Nama Unit",
      "Kode Divisi",
      "Nama Divisi",
      "Kode Panel",
      "Nama Panel",
      "Kategori Pekerjaan",
      "Nama Section",
      "Kode Job Type",
      "Nama Job Type",
      "Target Jam Awal",
      "Tanggal Mulai",
      "Tanggal Deadline",
      "Kode Prasyarat Core",
      "Referensi WO",
      "Catatan",
      "Temuan Awal",
      "Keterangan",
    ]);
  });

  test("imports rows using human-friendly template headers", async () => {
    const captured = {
      params: null as {
        employeeId: string;
        scope: WebSession["user"]["scope"];
      } | null,
      rows: [] as CountdownTemplateRow[],
    };

    const service = new DefaultCountdownService(createStubRepository(captured));
    const buffer = buildWorkbook(
      [
        "Kode Unit/Mobil",
        "Nama Unit",
        "Kode Divisi",
        "Nama Divisi",
        "Kode Panel",
        "Nama Panel",
        "Kategori Pekerjaan",
        "Nama Section",
        "Kode Job Type",
        "Nama Job Type",
        "Target Jam Awal",
        "Tanggal Mulai",
        "Tanggal Deadline",
        "Kode Prasyarat Core",
        "Referensi WO",
        "Catatan",
      ],
      [
        "MB500SEL_MRSILMY",
        "MB 500 SEL",
        "12",
        "INTERIOR",
        "457",
        "KARPET COVER BAWAH DASHBOARD",
        "MAIN",
        "KARPET COVER BAWAH DASHBOARD",
        "6294bc6d-4845-11f1-bec2-5a91b00d579f",
        "PASANG KE UNIT",
        8,
        "2026-05-15",
        "2026-05-18",
        "",
        "",
        "Template MAIN",
      ],
    );

    const result = await service.importWorkbook(sampleSession, "countdown.xlsx", buffer);

    expect(result.inserted).toBe(1);
    expect(captured.params?.employeeId).toBe(sampleSession.user.employeeId);
    expect(captured.rows[0]).toMatchObject({
      carId: "MB500SEL_MRSILMY",
      unitName: "MB 500 SEL",
      divisionId: "12",
      divisionName: "INTERIOR",
      panelId: "457",
      panelName: "KARPET COVER BAWAH DASHBOARD",
      taskCategory: "MAIN",
      sectionName: "KARPET COVER BAWAH DASHBOARD",
      jobTypeId: "6294bc6d-4845-11f1-bec2-5a91b00d579f",
      jobTypeName: "PASANG KE UNIT",
      targetHoursInitial: 8,
      startDate: "2026-05-15",
      deadlineDate: "2026-05-18",
      note: "Template MAIN",
    });
  });

  test("imports rows using legacy technical headers", async () => {
    const captured = {
      params: null as {
        employeeId: string;
        scope: WebSession["user"]["scope"];
      } | null,
      rows: [] as CountdownTemplateRow[],
    };

    const service = new DefaultCountdownService(createStubRepository(captured));
    const buffer = buildWorkbook(
      [
        "carId",
        "unitName",
        "divisionId",
        "divisionName",
        "panelId",
        "panelName",
        "taskCategory",
        "sectionName",
        "jobTypeId",
        "jobTypeName",
        "targetHoursInitial",
        "startDate",
        "deadlineDate",
        "prerequisiteCoreId",
        "refWoId",
        "note",
      ],
      [
        "MB500SEL_MRSILMY",
        "MB 500 SEL",
        "12",
        "INTERIOR",
        "",
        "",
        "wov",
        "KARPET COVER BAWAH DASHBOARD",
        "",
        "",
        5,
        "2026-05-15",
        "2026-05-18",
        "",
        "",
        "Template WOV",
      ],
    );

    const result = await service.importWorkbook(sampleSession, "legacy.xlsx", buffer);

    expect(result.inserted).toBe(1);
    expect(captured.params?.employeeId).toBe(sampleSession.user.employeeId);
    expect(captured.rows[0]).toMatchObject({
      carId: "MB500SEL_MRSILMY",
      taskCategory: "WOV",
      targetHoursInitial: 5,
      note: "Template WOV",
    });
  });
});
