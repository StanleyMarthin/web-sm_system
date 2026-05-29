import type { AuthUser } from "@smsystem/contracts/auth";
import type { CreateUserRequest } from "@smsystem/contracts/user";
import { describe, expect, test } from "bun:test";
import type { UserRecord, UsersRepository } from "@/repositories/users.repo";
import { DefaultUsersService, type PasswordHasher } from "@/services/users.service";
import type { WebSession } from "@/services/auth/session.service";

const sampleActor: AuthUser = {
  employeeId: "SM-03.004",
  fullName: "Sahrul Riswanto",
  email: null,
  roleId: 20,
  roleName: "mis",
  divisionId: 3,
  divisionName: "MANAGEMENT INFORMATION SYSTEM",
  grade: "MIS",
  permissions: ["user.manage", "view_all_units"],
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
  employeeId: sampleActor.employeeId,
  refreshToken: "refresh-1",
  mobileSessionKey: "session:SM-03.004",
  deviceId: "web-device-1",
  user: sampleActor,
  createdAt: "2026-05-13T00:00:00.000Z",
};

class InMemoryUsersRepository implements UsersRepository {
  readonly created: Array<Record<string, unknown>> = [];
  readonly passwordResets: Array<{ employeeId: string; passwordHash: string }> = [];
  readonly deactivated: string[] = [];
  private readonly records = new Map<string, UserRecord>([
    [
      "SM-08.005",
      {
        employeeId: "SM-08.005",
        fullName: "YUDHA AGUSTIANA",
        email: null,
        photoUrl: null,
        roleId: 19,
        roleName: "kepala_produksi",
        divisionId: 29,
        divisionName: "MANAGER PRODUKSI",
        grade: "KEPALA PRODUKSI",
        isActive: true,
        lastLoginAt: null,
        deviceCount: 0,
        createdAt: "2026-05-01 07:30:00",
        managedDivisionIds: [29],
        managedDivisionNames: ["MANAGER PRODUKSI"],
        activeUnitIds: ["MB500SEL_MRSILMY"],
      },
    ],
  ]);

  async list() {
    return {
      rows: [],
      total: 0,
    };
  }

  async findByEmployeeId(employeeId: string) {
    return this.records.get(employeeId) ?? null;
  }

  async listRoleOptions() {
    return [
      { label: "kepala_produksi", value: "19", scopeBasis: "ASSIGNED_UNITS" },
    ];
  }

  async listDivisionOptions() {
    return [];
  }

  async create(input: CreateUserRequest & { passwordHash: string }) {
    this.created.push(input);
    return {
      employeeId: input.employeeId,
      fullName: input.fullName,
      email: input.email ?? null,
      photoUrl: null,
      roleId: input.roleId,
      roleName: "mis",
      divisionId: input.divisionId,
      divisionName: "MANAGEMENT INFORMATION SYSTEM",
      grade: input.grade ?? null,
      isActive: true,
      lastLoginAt: null,
      deviceCount: 0,
      createdAt: "2026-05-13 07:30:00",
      managedDivisionIds: input.managedDivisionIds ?? [],
      managedDivisionNames: [],
      activeUnitIds: [],
    };
  }

  async update(employeeId: string) {
    const record = this.records.get(employeeId);
    if (!record) {
      throw new Error("Not used");
    }

    return record;
  }

  async resetPassword(employeeId: string, passwordHash: string) {
    this.passwordResets.push({ employeeId, passwordHash });
  }

  async deactivate(employeeId: string) {
    this.deactivated.push(employeeId);
  }
}

describe("DefaultUsersService", () => {
  test("hashes the password before creating a user", async () => {
    const repository = new InMemoryUsersRepository();
    const service = new DefaultUsersService(
      repository,
      {
        async hash(password) {
          return `hashed:${password}`;
        },
      } satisfies PasswordHasher,
    );

    await service.create(sampleSession, {
      employeeId: "SM-99.001",
      fullName: "Demo User",
      email: "demo@example.com",
      password: "secret123",
      roleId: 20,
      divisionId: 3,
      grade: "MIS",
      managedDivisionIds: [3, 5],
    } satisfies CreateUserRequest);

    expect(repository.created[0]).toMatchObject(
      {
        employeeId: "SM-99.001",
        passwordHash: "hashed:secret123",
        managedDivisionIds: [3, 5],
      },
    );
  });

  test("hashes reset passwords and blocks self-deactivation", async () => {
    const repository = new InMemoryUsersRepository();
    const service = new DefaultUsersService(
      repository,
      {
        async hash(password) {
          return `hashed:${password}`;
        },
      } satisfies PasswordHasher,
    );

    await service.resetPassword(sampleSession, "SM-08.005", {
      newPassword: "new-secret-123",
    });

    expect(repository.passwordResets).toEqual([
      {
        employeeId: "SM-08.005",
        passwordHash: "hashed:new-secret-123",
      },
    ]);

    try {
      await service.deactivate(sampleSession, sampleSession.user.employeeId);
      throw new Error("Expected deactivate to fail");
    } catch (error) {
      expect((error as Error).message).toBe("CANNOT_DEACTIVATE_SELF");
    }
  });
});
