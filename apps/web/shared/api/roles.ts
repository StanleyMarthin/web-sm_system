import { getApiBaseUrl } from "@/shared/api/config";
import {
  createRoleRequestSchema,
  permissionsEnvelopeSchema,
  rolePermissionsEnvelopeSchema,
  roleReferencesEnvelopeSchema,
  roleRecordSchema,
  rolesEnvelopeSchema,
  updateRoleRequestSchema,
} from "@smsystem/contracts/rbac";
import type {
  CreateRoleRequest,
  UpdateRoleRequest,
} from "@smsystem/contracts/rbac";

interface ApiFailure {
  success: false;
  message: string;
  errorCode?: string;
  data?: Record<string, unknown>;
}

async function parseFailure(response: Response): Promise<ApiFailure> {
  try {
    return (await response.json()) as ApiFailure;
  } catch {
    return {
      success: false,
      message: "Response API tidak valid.",
      errorCode: "INVALID_RESPONSE",
      data: {},
    };
  }
}

export async function fetchRoles(cookieHeader: string) {
  const response = await fetch(`${getApiBaseUrl()}/api/roles`, {
    headers: cookieHeader
      ? {
          cookie: cookieHeader,
        }
      : undefined,
    cache: "no-store",
  });

  if (!response.ok) {
    return {
      payload: null,
      status: response.status,
    };
  }

  return {
    payload: rolesEnvelopeSchema.parse(await response.json()),
    status: response.status,
  };
}

export async function fetchPermissions(cookieHeader: string) {
  const response = await fetch(`${getApiBaseUrl()}/api/permissions`, {
    headers: cookieHeader
      ? {
          cookie: cookieHeader,
        }
      : undefined,
    cache: "no-store",
  });

  if (!response.ok) {
    return {
      payload: null,
      status: response.status,
    };
  }

  return {
    payload: permissionsEnvelopeSchema.parse(await response.json()),
    status: response.status,
  };
}

export async function fetchRolePermissions(cookieHeader: string, roleId: number) {
  const response = await fetch(`${getApiBaseUrl()}/api/roles/${roleId}/permissions`, {
    credentials: "include",
    headers: cookieHeader
      ? {
          cookie: cookieHeader,
        }
      : undefined,
    cache: "no-store",
  });

  if (!response.ok) {
    return {
      payload: null,
      status: response.status,
    };
  }

  return {
    payload: rolePermissionsEnvelopeSchema.parse(await response.json()),
    status: response.status,
  };
}

export async function fetchRoleReferences(cookieHeader: string) {
  const response = await fetch(`${getApiBaseUrl()}/api/roles/references`, {
    credentials: "include",
    headers: cookieHeader
      ? {
          cookie: cookieHeader,
        }
      : undefined,
    cache: "no-store",
  });

  if (!response.ok) {
    return {
      payload: null,
      status: response.status,
    };
  }

  return {
    payload: roleReferencesEnvelopeSchema.parse(await response.json()),
    status: response.status,
  };
}

export async function saveRolePermissions(roleId: number, permissionIds: number[]) {
  const response = await fetch(`${getApiBaseUrl()}/api/roles/${roleId}/permissions`, {
    method: "PUT",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ permissionIds }),
  });

  if (!response.ok) {
    const failure = await parseFailure(response);
    return {
      ...failure,
      success: false as const,
    };
  }

  return {
    success: true as const,
    payload: rolePermissionsEnvelopeSchema.parse(await response.json()),
  };
}

export async function createRole(input: CreateRoleRequest) {
  const payload = createRoleRequestSchema.parse(input);
  const response = await fetch(`${getApiBaseUrl()}/api/roles`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const failure = await parseFailure(response);
    return {
      ...failure,
      success: false as const,
    };
  }

  const body = await response.json();
  return {
    success: true as const,
    role: roleRecordSchema.parse(body.data.role),
  };
}

export async function updateRole(roleId: number, input: UpdateRoleRequest) {
  const payload = updateRoleRequestSchema.parse(input);
  const response = await fetch(`${getApiBaseUrl()}/api/roles/${roleId}`, {
    method: "PATCH",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const failure = await parseFailure(response);
    return {
      ...failure,
      success: false as const,
    };
  }

  const body = await response.json();
  return {
    success: true as const,
    role: roleRecordSchema.parse(body.data.role),
  };
}
