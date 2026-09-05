import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { ApiEnv } from "@/config/env";
import { MAX_IMAGE_UPLOAD_BYTES, MAX_VIDEO_UPLOAD_BYTES } from "@/security/upload-ticket";
import type { GalleryUploadTicketProvider } from "@/services/gallery.service";

function stripTrailingSlash(value: string): string {
  return value.replace(/\/$/u, "");
}

function hasR2Config(env: ApiEnv): boolean {
  return Boolean(
    env.R2_ENDPOINT_URL &&
      env.R2_ACCESS_KEY_ID &&
      env.R2_SECRET_ACCESS_KEY &&
      env.R2_BUCKET_NAME &&
      env.R2_PUBLIC_URL,
  );
}

export class S3GalleryUploadTicketProvider implements GalleryUploadTicketProvider {
  private readonly client: S3Client | null;

  constructor(private readonly env: ApiEnv) {
    if (!hasR2Config(env)) {
      this.client = null;
      return;
    }

    this.client = new S3Client({
      endpoint: env.R2_ENDPOINT_URL,
      region: "auto",
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID!,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
      },
      forcePathStyle: true,
    });
  }

  async createTicket(input: {
    objectKey: string;
    contentType: string;
    contentLength: number;
  }): Promise<{
    uploadUrl: string;
    publicUrl: string;
    objectKey: string;
  }> {
    if (!this.client || !this.env.R2_BUCKET_NAME || !this.env.R2_PUBLIC_URL) {
      throw new Error("GALLERY_UPLOAD_NOT_CONFIGURED");
    }
    if (!Number.isSafeInteger(input.contentLength) || input.contentLength <= 0) {
      throw new Error("INVALID_UPLOAD_SIZE");
    }
    const maxBytes = input.contentType === "video/mp4" ? MAX_VIDEO_UPLOAD_BYTES : MAX_IMAGE_UPLOAD_BYTES;
    if (input.contentLength > maxBytes) {
      throw new Error("UPLOAD_TOO_LARGE");
    }

    const command = new PutObjectCommand({
      Bucket: this.env.R2_BUCKET_NAME,
      Key: input.objectKey,
      ContentType: input.contentType,
      ContentLength: input.contentLength,
    });

    const uploadUrl = await getSignedUrl(this.client, command, {
      expiresIn: 300,
    });
    const publicUrl = `${stripTrailingSlash(this.env.R2_PUBLIC_URL)}/${input.objectKey}`;

    return {
      uploadUrl,
      publicUrl,
      objectKey: input.objectKey,
    };
  }

  async uploadObject(input: {
    objectKey: string;
    contentType: string;
    contentLength: number;
    body: Uint8Array;
  }): Promise<{
    publicUrl: string;
    objectKey: string;
  }> {
    if (!this.client || !this.env.R2_BUCKET_NAME || !this.env.R2_PUBLIC_URL) {
      throw new Error("GALLERY_UPLOAD_NOT_CONFIGURED");
    }
    if (!Number.isSafeInteger(input.contentLength) || input.contentLength <= 0) {
      throw new Error("INVALID_UPLOAD_SIZE");
    }
    if (input.contentLength > MAX_IMAGE_UPLOAD_BYTES) {
      throw new Error("UPLOAD_TOO_LARGE");
    }

    await this.client.send(new PutObjectCommand({
      Bucket: this.env.R2_BUCKET_NAME,
      Key: input.objectKey,
      ContentType: input.contentType,
      ContentLength: input.contentLength,
      Body: input.body,
    }));

    return {
      publicUrl: `${stripTrailingSlash(this.env.R2_PUBLIC_URL)}/${input.objectKey}`,
      objectKey: input.objectKey,
    };
  }
}
