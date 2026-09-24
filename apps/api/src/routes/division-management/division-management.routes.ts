import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { permissionCodes } from "@smsystem/permissions";
import { getMySqlPool } from "@/db/mysql";
import { parseJsonBody } from "@/http/request";
import { errorResponse, successResponse } from "@/http/response";
import { requireSession } from "@/middleware/auth.middleware";
import { requirePermission } from "@/middleware/permission.middleware";
import type { AuthService } from "@/services/auth/auth.service";

const createMasterJobdescRequestSchema = z.object({
  jobName: z.string().trim().min(1).max(255),
  isTeknis: z.boolean().optional().default(true),
});

const updateMasterJobdescRequestSchema = createMasterJobdescRequestSchema;

const createDivisionRequestSchema = z.object({
  name: z.string().trim().min(1).max(100),
  code: z.string().trim().min(1).max(10),
  isTeknis: z.boolean().optional().default(true),
  parentId: z.number().int().positive().nullable().optional().default(null),
});

const updateDivisionRequestSchema = createDivisionRequestSchema;

interface DivisionRow extends RowDataPacket {
  id: number;
  name: string;
  code: string;
  isTeknis: number;
  parentId: number | null;
  userCount: number;
  activeUserCount: number;
  managedByCount: number;
}

interface JobTypeRow extends RowDataPacket {
  id: string;
  divisionId: number | null;
  jobName: string;
  isTeknis: number;
}

async function requireDivisionManagementSession(
  request: Request,
  authService: AuthService,
) {
  const sessionResult = await requireSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult;
  }

  const permissionResult = requirePermission(
    request,
    sessionResult.session,
    permissionCodes.manageUsers,
  );
  if ("response" in permissionResult) {
    return permissionResult;
  }

  if (!sessionResult.session.user.scope.canViewAllUnits) {
    return {
      response: errorResponse(
        request,
        "Divisi management hanya boleh untuk scope global.",
        403,
        "SCOPE_FORBIDDEN",
      ),
    };
  }

  return { session: sessionResult.session };
}

function mapDivisionManagementError(request: Request, error: unknown): Response {
  if (error instanceof Error) {
    if (error.message === "DIVISION_NOT_FOUND") {
      return errorResponse(request, "Divisi tidak ditemukan.", 404, "DIVISION_NOT_FOUND");
    }

    if (error.message === "DIVISION_IN_USE") {
      return errorResponse(
        request,
        "Divisi masih dipakai data user, jobdesc, countdown, atau transaksi operasional.",
        409,
        "DIVISION_IN_USE",
      );
    }

    if (error.message === "JOB_TYPE_NOT_FOUND") {
      return errorResponse(request, "Master jobdesc tidak ditemukan.", 404, "JOB_TYPE_NOT_FOUND");
    }

    if (error.message === "JOB_TYPE_IN_USE") {
      return errorResponse(
        request,
        "Master jobdesc sudah dipakai di countdown, tidak bisa dihapus.",
        409,
        "JOB_TYPE_IN_USE",
      );
    }
  }

  return errorResponse(
    request,
    "Terjadi kesalahan internal pada divisi management.",
    500,
    "DIVISION_MANAGEMENT_FAILED",
  );
}

async function findDivisionUsageCount(divisionId: number): Promise<number> {
  const pool = getMySqlPool();
  const [rows] = await pool.query<Array<RowDataPacket & { total: number }>>(
    `
      SELECT SUM(total) AS total
      FROM (
        SELECT COUNT(*) AS total FROM sm_employee WHERE division_id = ?
        UNION ALL SELECT COUNT(*) FROM employee_managed_divisions WHERE division_id = ?
        UNION ALL SELECT COUNT(*) FROM master_job_types WHERE division_id = ?
        UNION ALL SELECT COUNT(*) FROM sm_jobdesc_countdown WHERE division_id = ?
        UNION ALL SELECT COUNT(*) FROM sm_weekly_plan_division_inputs WHERE division_id = ?
        UNION ALL SELECT COUNT(*) FROM sm_weekly_plan_overtime WHERE division_id = ?
        UNION ALL SELECT COUNT(*) FROM sm_weekly_plan_units WHERE division_id = ?
        UNION ALL SELECT COUNT(*) FROM sm_issue_log WHERE division_id = ?
        UNION ALL SELECT COUNT(*) FROM sm_work_ledger WHERE division_id = ?
        UNION ALL SELECT COUNT(*) FROM sm_unit_budgets WHERE division_id = ?
      ) usage_counts
    `,
    Array.from({ length: 10 }, () => divisionId),
  );

  return Number(rows[0]?.total ?? 0);
}

async function readDivisionById(divisionId: number) {
  const pool = getMySqlPool();
  const [rows] = await pool.query<DivisionRow[]>(
    `
      SELECT
        d.id,
        d.name,
        d.code,
        d.isteknis AS isTeknis,
        d.parent_id AS parentId,
        COUNT(DISTINCT e.employee_id) AS userCount,
        COUNT(DISTINCT CASE WHEN COALESCE(e.is_active, 1) = 1 THEN e.employee_id END) AS activeUserCount,
        COUNT(DISTINCT emd.employee_id) AS managedByCount
      FROM sm_divisi d
      LEFT JOIN sm_employee e ON e.division_id = d.id
      LEFT JOIN employee_managed_divisions emd ON emd.division_id = d.id
      WHERE d.id = ?
      GROUP BY d.id, d.name, d.code, d.isteknis, d.parent_id
      LIMIT 1
    `,
    [divisionId],
  );

  const row = rows[0];
  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    code: row.code,
    isTeknis: row.isTeknis === 1,
    parentId: row.parentId,
    userCount: Number(row.userCount),
    activeUserCount: Number(row.activeUserCount),
    managedByCount: Number(row.managedByCount),
    jobTypes: [],
  };
}

function normalizeJobTypeKey(row: Pick<JobTypeRow, "divisionId" | "jobName">): string {
  return `${row.divisionId ?? "general"}:${row.jobName.trim().toLowerCase()}`;
}

function uniqueJobTypes(rows: JobTypeRow[]): JobTypeRow[] {
  const seen = new Set<string>();
  const uniqueRows: JobTypeRow[] = [];

  for (const row of rows) {
    const key = normalizeJobTypeKey(row);
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueRows.push(row);
  }

  return uniqueRows;
}

export async function handleDivisionCreateRoute(
  request: Request,
  authService: AuthService,
): Promise<Response> {
  const sessionResult = await requireDivisionManagementSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  const parsedBody = await parseJsonBody(request, createDivisionRequestSchema);
  if (!parsedBody.success) {
    return parsedBody.response;
  }

  try {
    const pool = getMySqlPool();
    const [result] = await pool.query<ResultSetHeader>(
      `
        INSERT INTO sm_divisi (name, code, isteknis, parent_id)
        VALUES (?, ?, ?, ?)
      `,
      [
        parsedBody.data.name,
        parsedBody.data.code,
        parsedBody.data.isTeknis ? 1 : 0,
        parsedBody.data.parentId,
      ],
    );

    const division = await readDivisionById(result.insertId);
    return successResponse(request, "Divisi berhasil ditambahkan.", { division }, { status: 201 });
  } catch (error) {
    return mapDivisionManagementError(request, error);
  }
}

export async function handleDivisionManagementListRoute(
  request: Request,
  authService: AuthService,
): Promise<Response> {
  const sessionResult = await requireDivisionManagementSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const pool = getMySqlPool();
    const [divisionRows, jobTypeRows] = await Promise.all([
      pool.query<DivisionRow[]>(
        `
          SELECT
            d.id,
            d.name,
            d.code,
            d.isteknis AS isTeknis,
            d.parent_id AS parentId,
            COUNT(DISTINCT e.employee_id) AS userCount,
            COUNT(DISTINCT CASE WHEN COALESCE(e.is_active, 1) = 1 THEN e.employee_id END) AS activeUserCount,
            COUNT(DISTINCT emd.employee_id) AS managedByCount
          FROM sm_divisi d
          LEFT JOIN sm_employee e ON e.division_id = d.id
          LEFT JOIN employee_managed_divisions emd ON emd.division_id = d.id
          GROUP BY d.id, d.name, d.code, d.isteknis, d.parent_id
          ORDER BY d.name ASC
        `,
      ),
      pool.query<JobTypeRow[]>(
        `
          SELECT
            id,
            division_id AS divisionId,
            job_name AS jobName,
            is_teknis AS isTeknis
          FROM master_job_types
          ORDER BY job_name ASC
        `,
      ),
    ]);

    const jobTypesByDivision = new Map<number, JobTypeRow[]>();
    const generalJobTypes: JobTypeRow[] = [];
    for (const row of uniqueJobTypes(jobTypeRows[0])) {
      if (row.divisionId === null) {
        generalJobTypes.push(row);
        continue;
      }
      const current = jobTypesByDivision.get(row.divisionId) ?? [];
      current.push(row);
      jobTypesByDivision.set(row.divisionId, current);
    }

    return successResponse(request, "Divisi management ready", {
      divisions: divisionRows[0].map((row) => ({
        id: row.id,
        name: row.name,
        code: row.code,
        isTeknis: row.isTeknis === 1,
        parentId: row.parentId,
        userCount: Number(row.userCount),
        activeUserCount: Number(row.activeUserCount),
        managedByCount: Number(row.managedByCount),
        jobTypes: (jobTypesByDivision.get(row.id) ?? []).map((jobType) => ({
          id: jobType.id,
          divisionId: jobType.divisionId,
          jobName: jobType.jobName,
          isTeknis: jobType.isTeknis === 1,
        })),
      })),
      generalJobTypes: generalJobTypes.map((jobType) => ({
        id: jobType.id,
        divisionId: null,
        jobName: jobType.jobName,
        isTeknis: jobType.isTeknis === 1,
      })),
    });
  } catch (error) {
    return mapDivisionManagementError(request, error);
  }
}

export async function handleDivisionUpdateRoute(
  request: Request,
  divisionId: number,
  authService: AuthService,
): Promise<Response> {
  const sessionResult = await requireDivisionManagementSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  const parsedBody = await parseJsonBody(request, updateDivisionRequestSchema);
  if (!parsedBody.success) {
    return parsedBody.response;
  }

  try {
    const pool = getMySqlPool();
    const [result] = await pool.query<ResultSetHeader>(
      `
        UPDATE sm_divisi
        SET name = ?, code = ?, isteknis = ?, parent_id = ?
        WHERE id = ?
      `,
      [
        parsedBody.data.name,
        parsedBody.data.code,
        parsedBody.data.isTeknis ? 1 : 0,
        parsedBody.data.parentId,
        divisionId,
      ],
    );

    if (result.affectedRows === 0) {
      throw new Error("DIVISION_NOT_FOUND");
    }

    const division = await readDivisionById(divisionId);
    return successResponse(request, "Divisi berhasil diperbarui.", { division });
  } catch (error) {
    return mapDivisionManagementError(request, error);
  }
}

export async function handleDivisionDeleteRoute(
  request: Request,
  divisionId: number,
  authService: AuthService,
): Promise<Response> {
  const sessionResult = await requireDivisionManagementSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const usageCount = await findDivisionUsageCount(divisionId);
    if (usageCount > 0) {
      throw new Error("DIVISION_IN_USE");
    }

    const pool = getMySqlPool();
    const [result] = await pool.query<ResultSetHeader>(
      "DELETE FROM sm_divisi WHERE id = ?",
      [divisionId],
    );

    if (result.affectedRows === 0) {
      throw new Error("DIVISION_NOT_FOUND");
    }

    return successResponse(request, "Divisi berhasil dihapus.", {
      deletedId: divisionId,
    });
  } catch (error) {
    return mapDivisionManagementError(request, error);
  }
}

export async function handleJobTypeUpdateRoute(
  request: Request,
  jobTypeId: string,
  authService: AuthService,
): Promise<Response> {
  const sessionResult = await requireDivisionManagementSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  const parsedBody = await parseJsonBody(request, updateMasterJobdescRequestSchema);
  if (!parsedBody.success) {
    return parsedBody.response;
  }

  try {
    const pool = getMySqlPool();
    const [result] = await pool.query<ResultSetHeader>(
      `
        UPDATE master_job_types
        SET job_name = ?, is_teknis = ?
        WHERE id = ?
      `,
      [
        parsedBody.data.jobName,
        parsedBody.data.isTeknis ? 1 : 0,
        jobTypeId,
      ],
    );

    if (result.affectedRows === 0) {
      throw new Error("JOB_TYPE_NOT_FOUND");
    }

    const [rows] = await pool.query<JobTypeRow[]>(
      `
        SELECT
          id,
          division_id AS divisionId,
          job_name AS jobName,
          is_teknis AS isTeknis
        FROM master_job_types
        WHERE id = ?
        LIMIT 1
      `,
      [jobTypeId],
    );
    const row = rows[0];

    return successResponse(request, "Master jobdesc berhasil diperbarui.", {
      jobType: {
        id: row.id,
        divisionId: row.divisionId,
        jobName: row.jobName,
        isTeknis: row.isTeknis === 1,
      },
    });
  } catch (error) {
    return mapDivisionManagementError(request, error);
  }
}

export async function handleJobTypeDeleteRoute(
  request: Request,
  jobTypeId: string,
  authService: AuthService,
): Promise<Response> {
  const sessionResult = await requireDivisionManagementSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const pool = getMySqlPool();
    const [usageRows] = await pool.query<Array<RowDataPacket & { total: number }>>(
      "SELECT COUNT(*) AS total FROM sm_jobdesc_countdown WHERE job_type_id = ?",
      [jobTypeId],
    );

    if (Number(usageRows[0]?.total ?? 0) > 0) {
      throw new Error("JOB_TYPE_IN_USE");
    }

    const [result] = await pool.query<ResultSetHeader>(
      "DELETE FROM master_job_types WHERE id = ?",
      [jobTypeId],
    );

    if (result.affectedRows === 0) {
      throw new Error("JOB_TYPE_NOT_FOUND");
    }

    return successResponse(request, "Master jobdesc berhasil dihapus.", {
      deletedId: jobTypeId,
    });
  } catch (error) {
    return mapDivisionManagementError(request, error);
  }
}

async function createMasterJobdesc(
  request: Request,
  divisionId: number | null,
  authService: AuthService,
): Promise<Response> {
  const sessionResult = await requireDivisionManagementSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  const parsedBody = await parseJsonBody(request, createMasterJobdescRequestSchema);
  if (!parsedBody.success) {
    return parsedBody.response;
  }

  try {
    const pool = getMySqlPool();
    if (divisionId !== null) {
      const [divisionRows] = await pool.query<RowDataPacket[]>(
        "SELECT id FROM sm_divisi WHERE id = ? LIMIT 1",
        [divisionId],
      );

      if (divisionRows.length === 0) {
        throw new Error("DIVISION_NOT_FOUND");
      }
    }

    const jobTypeId = randomUUID();
    await pool.query<ResultSetHeader>(
      `
        INSERT INTO master_job_types (id, division_id, job_name, is_teknis)
        VALUES (?, ?, ?, ?)
      `,
      [
        jobTypeId,
        divisionId,
        parsedBody.data.jobName,
        parsedBody.data.isTeknis ? 1 : 0,
      ],
    );

    return successResponse(
      request,
      "Master jobdesc berhasil ditambahkan.",
      {
        jobType: {
          id: jobTypeId,
          divisionId,
          jobName: parsedBody.data.jobName,
          isTeknis: parsedBody.data.isTeknis,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return mapDivisionManagementError(request, error);
  }
}

export async function handleDivisionJobTypeCreateRoute(
  request: Request,
  divisionId: number,
  authService: AuthService,
): Promise<Response> {
  return createMasterJobdesc(request, divisionId, authService);
}

export async function handleGeneralJobTypeCreateRoute(
  request: Request,
  authService: AuthService,
): Promise<Response> {
  return createMasterJobdesc(request, null, authService);
}
