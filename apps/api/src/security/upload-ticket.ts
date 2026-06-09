import { randomUUID, createHash } from "node:crypto";
import { getApiEnv } from "@/config/env";
import { getRedisClient } from "@/redis/client";

const UPLOAD_TICKET_TTL_SECONDS = 10 * 60;

const IMAGE_EXTENSIONS_BY_CONTENT_TYPE = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

type AllowedImageContentType = keyof typeof IMAGE_EXTENSIONS_BY_CONTENT_TYPE;

interface UploadTicketRecord {
  nonce: string;
  employeeId: string;
  objectKey: string;
  createdAt: string;
}

const memoryTickets = new Map<string, { record: UploadTicketRecord; expiresAt: number }>();
const memoryObjectIndex = new Map<string, { nonce: string; expiresAt: number }>();

function hashObjectKey(objectKey: string): string {
  return createHash("sha256").update(objectKey).digest("hex");
}

function getTicketKey(nonce: string): string {
  return `upload-ticket:${nonce}`;
}

function getObjectKeyIndexKey(objectKey: string): string {
  return `upload-ticket-object:${hashObjectKey(objectKey)}`;
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/$/u, "");
}

function shouldUseMemoryUploadTickets(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.SM_TEST_MEMORY_UPLOAD_TICKETS === "1"
  );
}

export function normalizeAllowedImageContentType(
  contentType: string,
): AllowedImageContentType {
  const normalized = contentType.split(";")[0]?.trim().toLowerCase();
  if (
    normalized === "image/jpeg" ||
    normalized === "image/png" ||
    normalized === "image/webp"
  ) {
    return normalized;
  }

  throw new Error("INVALID_UPLOAD_CONTENT_TYPE");
}

export function extensionForImageContentType(
  contentType: AllowedImageContentType,
): string {
  return IMAGE_EXTENSIONS_BY_CONTENT_TYPE[contentType];
}

export function createUploadNonce(): string {
  return randomUUID();
}

export async function storeUploadTicket(input: {
  nonce: string;
  employeeId: string;
  objectKey: string;
}): Promise<void> {
  const record: UploadTicketRecord = {
    ...input,
    createdAt: new Date().toISOString(),
  };

  let client;
  try {
    if (shouldUseMemoryUploadTickets()) {
      throw new Error("MEMORY_UPLOAD_TICKETS_ENABLED");
    }
    client = await getRedisClient();
  } catch (error) {
    if (process.env.NODE_ENV === "production") {
      throw error;
    }

    const expiresAt = Date.now() + UPLOAD_TICKET_TTL_SECONDS * 1_000;
    memoryTickets.set(getTicketKey(input.nonce), { record, expiresAt });
    memoryObjectIndex.set(getObjectKeyIndexKey(input.objectKey), {
      nonce: input.nonce,
      expiresAt,
    });
    return;
  }

  await Promise.all([
    client.set(getTicketKey(input.nonce), JSON.stringify(record), {
      expiration: {
        type: "EX",
        value: UPLOAD_TICKET_TTL_SECONDS,
      },
    }),
    client.set(getObjectKeyIndexKey(input.objectKey), input.nonce, {
      expiration: {
        type: "EX",
        value: UPLOAD_TICKET_TTL_SECONDS,
      },
    }),
  ]);
}

export function objectKeyFromPublicUrl(publicUrl: string): string {
  const env = getApiEnv();
  if (!env.R2_PUBLIC_URL) {
    throw new Error("GALLERY_UPLOAD_NOT_CONFIGURED");
  }

  const parsedPublicUrl = new URL(publicUrl);
  const publicBase = new URL(stripTrailingSlash(env.R2_PUBLIC_URL));
  if (parsedPublicUrl.origin !== publicBase.origin) {
    throw new Error("INVALID_UPLOAD_TICKET");
  }

  const basePath = publicBase.pathname.replace(/\/$/u, "");
  if (basePath && !parsedPublicUrl.pathname.startsWith(`${basePath}/`)) {
    throw new Error("INVALID_UPLOAD_TICKET");
  }

  const objectPath = basePath
    ? parsedPublicUrl.pathname.slice(basePath.length + 1)
    : parsedPublicUrl.pathname.replace(/^\//u, "");
  const objectKey = decodeURIComponent(objectPath);
  if (!objectKey) {
    throw new Error("INVALID_UPLOAD_TICKET");
  }

  return objectKey;
}

export async function consumeUploadTicketForPublicUrl(input: {
  employeeId: string;
  publicUrl: string;
}): Promise<string> {
  const objectKey = objectKeyFromPublicUrl(input.publicUrl);
  let client;
  try {
    if (shouldUseMemoryUploadTickets()) {
      throw new Error("MEMORY_UPLOAD_TICKETS_ENABLED");
    }
    client = await getRedisClient();
  } catch (error) {
    if (process.env.NODE_ENV === "production") {
      throw error;
    }

    const now = Date.now();
    const indexKey = getObjectKeyIndexKey(objectKey);
    const indexed = memoryObjectIndex.get(indexKey);
    if (!indexed || indexed.expiresAt <= now || !objectKey.includes(indexed.nonce)) {
      throw new Error("INVALID_UPLOAD_TICKET");
    }

    const ticketKey = getTicketKey(indexed.nonce);
    const ticket = memoryTickets.get(ticketKey);
    if (
      !ticket ||
      ticket.expiresAt <= now ||
      ticket.record.employeeId !== input.employeeId ||
      ticket.record.objectKey !== objectKey
    ) {
      throw new Error("INVALID_UPLOAD_TICKET");
    }

    memoryTickets.delete(ticketKey);
    memoryObjectIndex.delete(indexKey);
    return objectKey;
  }

  const nonce = await client.get(getObjectKeyIndexKey(objectKey));
  if (!nonce || !objectKey.includes(nonce)) {
    throw new Error("INVALID_UPLOAD_TICKET");
  }

  const rawRecord = await client.get(getTicketKey(nonce));
  if (!rawRecord) {
    throw new Error("INVALID_UPLOAD_TICKET");
  }

  const record = JSON.parse(rawRecord) as UploadTicketRecord;
  if (record.employeeId !== input.employeeId || record.objectKey !== objectKey) {
    throw new Error("INVALID_UPLOAD_TICKET");
  }

  await Promise.all([
    client.del(getTicketKey(nonce)),
    client.del(getObjectKeyIndexKey(objectKey)),
  ]);

  return objectKey;
}
