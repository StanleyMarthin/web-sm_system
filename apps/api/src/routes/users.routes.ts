import { parseGridQueryParams } from "@smsystem/contracts/grid";
import {
  createUserRequestSchema,
  resetPasswordRequestSchema,
  updateUserRequestSchema,
} from "@smsystem/contracts/user";
import { permissionCodes } from "@smsystem/permissions";
import { z } from "zod";
import { parseJsonBody } from "@/http/request";
import { getApiEnv } from "@/config/env";
import { getMySqlPool } from "@/db/mysql";
import {
  errorResponse,
  successResponse,
  withCors,
} from "@/http/response";
import { requireSession } from "@/middleware/auth.middleware";
import { requirePermission } from "@/middleware/permission.middleware";
import type { AuthService } from "@/services/auth/auth.service";
import type { UsersService } from "@/services/users.service";

interface UploadTicketEnvelope {
  success?: boolean;
  data?: {
    upload_url?: string;
    public_url?: string;
    uploadUrl?: string;
    publicUrl?: string;
  };
  message?: string;
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/$/u, "");
}

function resolveTasksBaseUrl(): string {
  const env = getApiEnv();
  if (env.SM_TASKS_BASE_URL) {
    return stripTrailingSlash(env.SM_TASKS_BASE_URL);
  }

  try {
    const loginUrl = new URL(env.SM_LOGIN_BASE_URL);
    loginUrl.port = "8086";
    loginUrl.pathname = "";
    loginUrl.search = "";
    loginUrl.hash = "";
    return stripTrailingSlash(loginUrl.toString());
  } catch {
    return "http://172.31.11.74:8086";
  }
}

async function requestTaskUploadTicket(objectKey: string): Promise<{
  uploadUrl: string;
  publicUrl: string;
}> {
  const ticketUrl = new URL(`${resolveTasksBaseUrl()}/sm/tasks/upload-ticket`);
  ticketUrl.searchParams.set("filename", objectKey);

  const response = await fetch(ticketUrl);
  const payload = (await response.json().catch(() => null)) as UploadTicketEnvelope | null;
  const data = payload?.data ?? {};
  const uploadUrl = data.upload_url ?? data.uploadUrl;
  const publicUrl = data.public_url ?? data.publicUrl;

  if (!response.ok || payload?.success === false || !uploadUrl || !publicUrl) {
    throw new Error(payload?.message || "UPLOAD_TICKET_FAILED");
  }

  return { uploadUrl, publicUrl };
}

async function requireManageUsersSession(
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

  return { session: sessionResult.session };
}

function mapUsersError(request: Request, error: unknown): Response {
  if (error instanceof Error) {
    if (error.message === "USER_NOT_FOUND") {
      return errorResponse(request, "User tidak ditemukan.", 404, "USER_NOT_FOUND");
    }

    if (error.message === "USER_ALREADY_EXISTS") {
      return errorResponse(
        request,
        "Employee ID sudah terdaftar.",
        409,
        "USER_ALREADY_EXISTS",
      );
    }

    if (error.message === "SCOPE_FORBIDDEN") {
      return errorResponse(
        request,
        "Aksi di luar scope user aktif.",
        403,
        "SCOPE_FORBIDDEN",
      );
    }

    if (error.message === "CANNOT_DEACTIVATE_SELF") {
      return errorResponse(
        request,
        "User aktif tidak boleh menonaktifkan dirinya sendiri.",
        400,
        "CANNOT_DEACTIVATE_SELF",
      );
    }
  }

  return errorResponse(
    request,
    "Terjadi kesalahan internal pada user management.",
    500,
    "USER_MANAGEMENT_FAILED",
  );
}

export async function handleUsersListRoute(
  request: Request,
  authService: AuthService,
  usersService: UsersService,
): Promise<Response> {
  const sessionResult = await requireManageUsersSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const query = parseGridQueryParams(new URL(request.url).searchParams);
    const result = await usersService.list(sessionResult.session, query);

    return withCors(
      request,
      Response.json({
        success: true,
        message: "User grid ready",
        data: result.data,
        meta: result.meta,
        references: result.references,
        query: result.query,
      }),
    );
  } catch (error) {
    return mapUsersError(request, error);
  }
}

export async function handleUsersExportRoute(
  request: Request,
  authService: AuthService,
  usersService: UsersService,
): Promise<Response> {
  const sessionResult = await requireManageUsersSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const query = parseGridQueryParams(new URL(request.url).searchParams);
    const csv = await usersService.exportCsv(sessionResult.session, query);

    return withCors(
      request,
      new Response(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="users.csv"',
        },
      }),
    );
  } catch (error) {
    return mapUsersError(request, error);
  }
}

export async function handleUsersDetailRoute(
  request: Request,
  employeeId: string,
  authService: AuthService,
  usersService: UsersService,
): Promise<Response> {
  const sessionResult = await requireManageUsersSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const user = await usersService.findByEmployeeId(
      sessionResult.session,
      employeeId,
    );
    if (!user) {
      return errorResponse(request, "User tidak ditemukan.", 404, "USER_NOT_FOUND");
    }

    return successResponse(request, "User detail loaded", {
      user,
    });
  } catch (error) {
    return mapUsersError(request, error);
  }
}

export async function handleUsersCreateRoute(
  request: Request,
  authService: AuthService,
  usersService: UsersService,
): Promise<Response> {
  const sessionResult = await requireManageUsersSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  const parsedBody = await parseJsonBody(request, createUserRequestSchema);
  if (!parsedBody.success) {
    return parsedBody.response;
  }

  try {
    const user = await usersService.create(sessionResult.session, parsedBody.data);
    return successResponse(
      request,
      "User berhasil dibuat.",
      {
        user,
      },
      { status: 201 },
    );
  } catch (error) {
    return mapUsersError(request, error);
  }
}

export async function handleUsersUpdateRoute(
  request: Request,
  employeeId: string,
  authService: AuthService,
  usersService: UsersService,
): Promise<Response> {
  const sessionResult = await requireManageUsersSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  const parsedBody = await parseJsonBody(request, updateUserRequestSchema);
  if (!parsedBody.success) {
    return parsedBody.response;
  }

  try {
    const user = await usersService.update(
      sessionResult.session,
      employeeId,
      parsedBody.data,
    );

    return successResponse(request, "User berhasil diupdate.", {
      user,
    });
  } catch (error) {
    return mapUsersError(request, error);
  }
}

export async function handleUsersResetPasswordRoute(
  request: Request,
  employeeId: string,
  authService: AuthService,
  usersService: UsersService,
): Promise<Response> {
  const sessionResult = await requireManageUsersSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  const parsedBody = await parseJsonBody(request, resetPasswordRequestSchema);
  if (!parsedBody.success) {
    return parsedBody.response;
  }

  try {
    await usersService.resetPassword(
      sessionResult.session,
      employeeId,
      parsedBody.data,
    );
    return successResponse(request, "Password user berhasil direset.", {});
  } catch (error) {
    return mapUsersError(request, error);
  }
}

export async function handleUsersDeactivateRoute(
  request: Request,
  employeeId: string,
  authService: AuthService,
  usersService: UsersService,
): Promise<Response> {
  const sessionResult = await requireManageUsersSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    await usersService.deactivate(sessionResult.session, employeeId);
    return successResponse(request, "User berhasil dinonaktifkan.", {});
  } catch (error) {
    return mapUsersError(request, error);
  }
}

export async function handleProfileAvatarUploadRoute(
  request: Request,
  authService: AuthService,
): Promise<Response> {
  const sessionResult = await requireSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (error) {
    return errorResponse(request, "Format form-data tidak valid", 400, "INVALID_FORM_DATA");
  }

  const file = formData.get("file");
  if (!file || typeof file === "string") {
    return errorResponse(request, "File gambar tidak ditemukan", 400, "MISSING_FILE");
  }

  const mimeType = file.type || "image/jpeg";
  const allowedMimes: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  const extension = allowedMimes[mimeType] ?? "jpg";
  const objectKey = `avatars/${sessionResult.session.employeeId}_${Date.now()}.${extension}`;

  try {
    const arrayBuffer = await file.arrayBuffer();
    const ticket = await requestTaskUploadTicket(objectKey);

    const uploadResponse = await fetch(ticket.uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "image/jpeg",
      },
      body: new Uint8Array(arrayBuffer),
    });

    if (!uploadResponse.ok) {
      const body = await uploadResponse.text().catch(() => "");
      console.error("[profile-avatar] r2 ticket upload failed", {
        status: uploadResponse.status,
        body: body.slice(0, 500),
      });
      return errorResponse(request, "Gagal mengupload foto profil", 502, "R2_UPLOAD_FAILED");
    }

    // 2. Update Database
    const pool = getMySqlPool();
    await pool.query(
      `UPDATE sm_employee SET photo_url = ? WHERE employee_id = ?`,
      [ticket.publicUrl, sessionResult.session.employeeId]
    );
    await authService.updateCurrentUserPhotoUrl?.(request, ticket.publicUrl);

    return successResponse(request, "Foto profil berhasil diupload", { photoUrl: ticket.publicUrl });
  } catch (error) {
    console.error("[profile-avatar] proxy upload error:", error);
    return errorResponse(request, "Gagal menyimpan foto profil", 500, "UPLOAD_FAILED");
  }
}

export async function handleProfileUpdateRoute(
  request: Request,
  authService: AuthService,
): Promise<Response> {
  const sessionResult = await requireSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  const schema = z.object({
    email: z.string().email("Format email tidak valid").optional(),
  });

  const parsedBody = await parseJsonBody(request, schema);
  if (!parsedBody.success) {
    return parsedBody.response;
  }

  const { email } = parsedBody.data;
  if (!email) {
    return errorResponse(request, "Tidak ada data yang diubah", 400, "NO_CHANGE");
  }

  try {
    const pool = getMySqlPool();
    const [rows] = await pool.query<any[]>(
      `SELECT employee_id FROM sm_employee WHERE email = ? AND employee_id != ? LIMIT 1`,
      [email, sessionResult.session.employeeId],
    );
    if (rows.length > 0) {
      return errorResponse(request, "Email sudah digunakan akun lain", 409, "EMAIL_TAKEN");
    }
    await pool.query(
      `UPDATE sm_employee SET email = ? WHERE employee_id = ?`,
      [email, sessionResult.session.employeeId],
    );
    return successResponse(request, "Profil berhasil diperbarui", { email });
  } catch (error) {
    console.error("[profile-update] error:", error);
    return errorResponse(request, "Gagal memperbarui profil", 500, "UPDATE_FAILED");
  }
}

export async function handleProfilePasswordRoute(
  request: Request,
  authService: AuthService,
): Promise<Response> {
  const sessionResult = await requireSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  const schema = z.object({
    currentPassword: z.string().min(1, "Password saat ini wajib diisi"),
    newPassword: z.string().min(6, "Password baru minimal 6 karakter"),
  });

  const parsedBody = await parseJsonBody(request, schema);
  if (!parsedBody.success) {
    return parsedBody.response;
  }

  const { currentPassword, newPassword } = parsedBody.data;

  try {
    const pool = getMySqlPool();
    const [rows] = await pool.query<any[]>(
      `SELECT password_hash FROM sm_employee WHERE employee_id = ? LIMIT 1`,
      [sessionResult.session.employeeId],
    );

    if (!rows[0]) {
      return errorResponse(request, "User tidak ditemukan", 404, "USER_NOT_FOUND");
    }

    const isValid = await Bun.password.verify(currentPassword, rows[0].password_hash);
    if (!isValid) {
      return errorResponse(request, "Password saat ini tidak sesuai", 401, "WRONG_PASSWORD");
    }

    const newHash = await Bun.password.hash(newPassword, { algorithm: "bcrypt", cost: 12 });
    await pool.query(
      `UPDATE sm_employee SET password_hash = ? WHERE employee_id = ?`,
      [newHash, sessionResult.session.employeeId],
    );

    return successResponse(request, "Password berhasil diperbarui", {});
  } catch (error) {
    console.error("[profile-password] error:", error);
    return errorResponse(request, "Gagal memperbarui password", 500, "UPDATE_FAILED");
  }
}
