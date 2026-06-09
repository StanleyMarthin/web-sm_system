import { SESSION_COOKIE_NAME } from "@smsystem/contracts/auth";
import type { AuthUser } from "@smsystem/contracts/auth";
import type { CountdownDetail } from "@smsystem/contracts/countdown";
import { permissionCodes } from "@smsystem/permissions";
import { describe, expect, test } from "bun:test";
import { createApiFetchHandler } from "@/app";
import type { AuthService } from "@/services/auth/auth.service";
import type { CountdownService } from "@/services/countdown.service";
import type { WebSession } from "@/services/auth/session.service";

const sampleUser: AuthUser = {
  employeeId: "SM-08.005",
  fullName: "YUDHA AGUSTIANA",
  email: null,
  roleId: 19,
  roleName: "kepala_produksi",
  divisionId: 29,
  divisionName: "MANAGER PRODUKSI",
  grade: "KEPALA PRODUKSI",
  permissions: [permissionCodes.viewCountdown],
  scope: {
    canViewAllUnits: false,
    canViewAssignedUnits: true,
    divisionIds: [29],
    managedDivisionIds: [],
    unitIds: [],
  },
};

const sampleSession: WebSession = {
  sessionId: "session-1",
  sessionKey: "session:SM-08.005:session-1",
  employeeId: sampleUser.employeeId,
  refreshToken: "refresh-1",
  mobileSessionKey: "session:SM-08.005",
  deviceId: "web-device-1",
  user: sampleUser,
  createdAt: "2026-05-13T00:00:00.000Z",
};

const sampleDetail: CountdownDetail = {
  countdownId: "cd-1",
  carId: "MB500SEL_MRSILMY",
  unitName: "MB 500 SEL",
  customerName: "Mr. SILMY",
  divisionId: 12,
  divisionName: "INTERIOR",
  panelId: 457,
  panelName: "KARPET COVER BAWAH DASHBOARD",
  sectionName: "KARPET COVER BAWAH DASHBOARD",
  taskCategory: "MAIN",
  jobTypeId: "6294bc6d-4845-11f1-bec2-5a91b00d579f",
  jobTypeName: "PASANG KE UNIT",
  targetHoursInitial: 8,
  timeExtensionHours: 0,
  targetHoursRevised: 8,
  totalActualHours: 1.25,
  remainingHours: 6.75,
  actualProgressPercent: 15,
  status: "PROSES",
  startDate: "2026-05-15",
  deadlineDate: "2026-05-18",
  createdAt: "2026-05-14 10:00:00",
  updatedAt: "2026-05-14 10:00:00",
  isOverdue: false,
  details: [
    {
      detailId: "detail-1",
      entryType: "WORK",
      employeeId: "SM-11.003",
      employeeName: "AGUS RUSMAWAN",
      employeeRole: "HELPER III",
      workDate: "2026-05-14",
      startTime: "09:00",
      finishTime: "10:00",
      billedHours: 1,
      progressPercent: 15,
      taskStatus: "ON_PROGRESS",
    },
  ],
};

function createStubAuthService(overrides: Partial<AuthService> = {}): AuthService {
  return {
    async login() {
      throw new Error("Not implemented");
    },
    async logout() {
      return [];
    },
    async refresh() {
      throw new Error("Not implemented");
    },
    async getCurrentSession() {
      return sampleSession;
    },
    async getCurrentUser() {
      return sampleUser;
    },
    async getCurrentPermissions() {
      return sampleUser.permissions;
    },
    ...overrides,
  };
}

function createStubCountdownService(overrides: Partial<CountdownService> = {}): CountdownService {
  return {
    async list(_session, _query) {
      return {
        data: [
          {
            countdownId: "cd-1",
            carId: "MB500SEL_MRSILMY",
            unitName: "MB 500 SEL",
            customerName: "Mr. SILMY",
            divisionId: 12,
            divisionName: "INTERIOR",
            panelId: 457,
            panelName: "KARPET COVER BAWAH DASHBOARD",
            sectionName: "KARPET COVER BAWAH DASHBOARD",
            taskCategory: "MAIN",
            jobTypeId: "6294bc6d-4845-11f1-bec2-5a91b00d579f",
            jobTypeName: "PASANG KE UNIT",
            targetHoursInitial: 8,
            timeExtensionHours: 0,
            targetHoursRevised: 8,
            totalActualHours: 1.25,
            remainingHours: 6.75,
            actualProgressPercent: 15,
            status: "PROSES",
            startDate: "2026-05-15",
            deadlineDate: "2026-05-18",
            createdAt: "2026-05-14 10:00:00",
            updatedAt: "2026-05-14 10:00:00",
            isOverdue: false,
          },
        ],
        references: {
          divisions: [{ label: "INTERIOR", value: "12" }],
          units: [{ label: "MB 500 SEL", value: "MB500SEL_MRSILMY" }],
          panels: [{ label: "KARPET COVER BAWAH DASHBOARD", value: "457" }],
          jobTypes: [{ label: "PASANG KE UNIT", value: "6294bc6d-4845-11f1-bec2-5a91b00d579f" }],
        },
        canManage: false,
        meta: {
          page: 1,
          limit: 25,
          total: 1,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
        query: {
          page: 1,
          limit: 25,
          search: "",
          sortBy: "updatedAt",
          sortDirection: "desc",
          view: null,
          filters: [],
        },
      };
    },
    async detail(_session, _countdownId) {
      return sampleDetail;
    },
    async create(_session, _input) {
      return sampleDetail;
    },
    async update(_session, _countdownId, _input) {
      return sampleDetail;
    },
    async remove(_session, _countdownId) {
      return true;
    },
    async buildTemplateWorkbook() {
      return new Uint8Array([0x01, 0x02, 0x03]);
    },
    async importWorkbook() {
      return {
        inserted: 2,
        updated: 0,
        rejected: 0,
        issues: [],
      };
    },
    ...overrides,
  };
}

describe("countdown routes", () => {
  test("lists and returns detail countdown", async () => {
    const fetchHandler = createApiFetchHandler({
      authService: createStubAuthService(),
      countdownService: createStubCountdownService(),
    });

    const listResponse = await fetchHandler(
      new Request("http://localhost/api/countdown?page=1&limit=25", {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=session:SM-08.005:session-1`,
        },
      }),
    );

    expect(listResponse.status).toBe(200);
    const listBody = await listResponse.json();
    expect(listBody.data[0].countdownId).toBe("cd-1");

    const detailResponse = await fetchHandler(
      new Request("http://localhost/api/countdown/cd-1", {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=session:SM-08.005:session-1`,
        },
      }),
    );

    expect(detailResponse.status).toBe(200);
    const detailBody = await detailResponse.json();
    expect(detailBody.data.countdown.countdownId).toBe("cd-1");
    expect(detailBody.data.countdown.details.length).toBe(1);
  });

  test("returns template workbook stream", async () => {
    const fetchHandler = createApiFetchHandler({
      authService: createStubAuthService(),
      countdownService: createStubCountdownService(),
    });

    const response = await fetchHandler(
      new Request("http://localhost/api/countdown/template", {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=session:SM-08.005:session-1`,
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("spreadsheetml");
    expect(response.headers.get("content-disposition")).toContain(
      "countdown-template.xlsx",
    );
  });

  test("processes countdown import with uploaded file", async () => {
    const fetchHandler = createApiFetchHandler({
      authService: createStubAuthService({
        async getCurrentSession() {
          return {
            ...sampleSession,
            user: {
              ...sampleUser,
              permissions: [permissionCodes.viewCountdown, permissionCodes.updatePlan],
              scope: {
                ...sampleUser.scope,
                canViewAllUnits: true,
              },
            },
          };
        },
      }),
      countdownService: createStubCountdownService(),
    });

    const formData = new FormData();
    formData.set(
      "file",
      new File([new Uint8Array([0x01, 0x02])], "countdown.xlsx", {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
    );

    const response = await fetchHandler(
      new Request("http://localhost/api/countdown/import", {
        method: "POST",
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=session:SM-08.005:session-1`,
        },
        body: formData,
      }),
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.data.inserted).toBe(2);
  });

  test("blocks countdown route when permission missing", async () => {
    const fetchHandler = createApiFetchHandler({
      authService: createStubAuthService({
        async getCurrentSession() {
          return {
            ...sampleSession,
            user: {
              ...sampleUser,
              permissions: [],
            },
          };
        },
      }),
      countdownService: createStubCountdownService(),
    });

    const response = await fetchHandler(
      new Request("http://localhost/api/countdown"),
    );

    expect(response.status).toBe(403);
  });

  test("allows countdown manager to create countdown", async () => {
    const capturedInputs: Array<Parameters<CountdownService["create"]>[1]> = [];
    const fetchHandler = createApiFetchHandler({
      authService: createStubAuthService({
        async getCurrentSession() {
          return {
            ...sampleSession,
            user: {
              ...sampleUser,
              permissions: [permissionCodes.viewCountdown, permissionCodes.updatePlan],
              scope: {
                ...sampleUser.scope,
                canViewAllUnits: true,
              },
            },
          };
        },
      }),
      countdownService: createStubCountdownService({
        async create(_session, input) {
          capturedInputs.push(input);
          return {
            ...sampleDetail,
            temuanAwal: input.temuanAwal ?? null,
            keterangan: input.keterangan ?? null,
          };
        },
      }),
    });

    const response = await fetchHandler(
      new Request("http://localhost/api/countdown", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `${SESSION_COOKIE_NAME}=session:SM-08.005:session-1`,
        },
        body: JSON.stringify({
          carId: "MB500SEL_MRSILMY",
          divisionId: 12,
          panelId: 457,
          taskCategory: "MAIN",
          sectionName: "KARPET COVER BAWAH DASHBOARD",
          jobTypeId: "6294bc6d-4845-11f1-bec2-5a91b00d579f",
          targetHoursInitial: 8,
          startDate: "2026-05-15",
          deadlineDate: "2026-05-18",
          temuanAwal: "Baret fender depan",
          keterangan: "Kerjakan pengecekan awal sebelum bongkar",
          status: "PLAN",
        }),
      }),
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.canManage).toBe(true);
    expect(capturedInputs[0]?.temuanAwal).toBe("Baret fender depan");
    expect(capturedInputs[0]?.keterangan).toBe("Kerjakan pengecekan awal sebelum bongkar");
    expect(body.data.countdown.temuanAwal).toBe("Baret fender depan");
    expect(body.data.countdown.keterangan).toBe("Kerjakan pengecekan awal sebelum bongkar");
  });

  test("blocks countdown create when global manage access is missing", async () => {
    const fetchHandler = createApiFetchHandler({
      authService: createStubAuthService(),
      countdownService: createStubCountdownService(),
    });

    const response = await fetchHandler(
      new Request("http://localhost/api/countdown", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `${SESSION_COOKIE_NAME}=session:SM-08.005:session-1`,
        },
        body: JSON.stringify({
          carId: "MB500SEL_MRSILMY",
          divisionId: 12,
          sectionName: "KARPET COVER BAWAH DASHBOARD",
          targetHoursInitial: 8,
          deadlineDate: "2026-05-18",
        }),
      }),
    );

    expect(response.status).toBe(403);
  });

  test("blocks countdown import when global manage access is missing", async () => {
    const fetchHandler = createApiFetchHandler({
      authService: createStubAuthService(),
      countdownService: createStubCountdownService(),
    });

    const formData = new FormData();
    formData.set(
      "file",
      new File([new Uint8Array([0x01, 0x02])], "countdown.xlsx", {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
    );

    const response = await fetchHandler(
      new Request("http://localhost/api/countdown/import", {
        method: "POST",
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=session:SM-08.005:session-1`,
        },
        body: formData,
      }),
    );

    expect(response.status).toBe(403);
  });
});
