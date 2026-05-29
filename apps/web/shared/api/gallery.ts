import {
  galleryGridEnvelopeSchema,
  galleryPhotoCollectionEnvelopeSchema,
  galleryPhotoDeleteEnvelopeSchema,
  galleryPhotoMutationEnvelopeSchema,
  galleryUploadTicketResponseSchema,
  type CreateGalleryPhotoRequest,
  type GalleryPhotoType,
  type UpdateGalleryPhotoRequest,
} from "@smsystem/contracts/gallery";
import { getApiBaseUrl } from "@/shared/api/config";

interface ApiFailure {
  success: false;
  message: string;
  errorCode?: string;
  data?: Record<string, unknown>;
}

function toUrlSearchParams(
  searchParams: Record<string, string | string[] | undefined>,
): URLSearchParams {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === "string") {
      params.set(key, value);
      continue;
    }

    for (const item of value ?? []) {
      params.append(key, item);
    }
  }

  return params;
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

function buildServerOrBrowserRequestInit(cookieHeader: string) {
  if (cookieHeader) {
    return {
      headers: {
        cookie: cookieHeader,
      },
      cache: "no-store" as const,
    };
  }

  return {
    credentials: "include" as const,
    cache: "no-store" as const,
  };
}

export function buildGalleryGridQueryString(
  searchParams: Record<string, string | string[] | undefined>,
): string {
  return toUrlSearchParams(searchParams).toString();
}

export async function fetchGalleryGrid(
  cookieHeader: string,
  searchParams: Record<string, string | string[] | undefined>,
) {
  const queryString = buildGalleryGridQueryString(searchParams);
  const suffix = queryString ? `?${queryString}` : "";

  try {
    const response = await fetch(`${getApiBaseUrl()}/api/gallery${suffix}`, buildServerOrBrowserRequestInit(cookieHeader));

    if (!response.ok) {
      return {
        payload: null,
        status: response.status,
      };
    }

    return {
      payload: galleryGridEnvelopeSchema.parse(await response.json()),
      status: response.status,
    };
  } catch {
    return {
      payload: null,
      status: 503,
    };
  }
}

export async function fetchGalleryPhotos(cookieHeader: string, actualId: string) {
  try {
    const response = await fetch(
      `${getApiBaseUrl()}/api/gallery/${actualId}/photos`,
      buildServerOrBrowserRequestInit(cookieHeader),
    );

    if (!response.ok) {
      return {
        payload: null,
        status: response.status,
      };
    }

    try {
      const data = await response.json();
      return {
        payload: galleryPhotoCollectionEnvelopeSchema.parse(data),
        status: response.status,
      };
    } catch (e) {
      console.error("fetchGalleryPhotos parsing error:", e);
      return {
        payload: null,
        status: 500,
      };
    }
  } catch (e) {
    console.error("fetchGalleryPhotos network error:", e);
    return {
      payload: null,
      status: 503,
    };
  }
}

export async function requestGalleryUploadTicket(input: {
  actualId: string;
  photoType: GalleryPhotoType;
  filename: string;
  contentType: string;
}) {
  const params = new URLSearchParams({
    actualId: input.actualId,
    photoType: input.photoType,
    filename: input.filename,
    contentType: input.contentType,
  });

  const response = await fetch(`${getApiBaseUrl()}/api/gallery/upload-ticket?${params}`, {
    credentials: "include",
    cache: "no-store",
  });

  if (!response.ok) {
    return {
      ...(await parseFailure(response)),
      success: false as const,
    };
  }

  const payload = galleryUploadTicketResponseSchema.parse(await response.json());
  return {
    success: true as const,
    result: payload.data,
  };
}

export async function createGalleryPhoto(input: CreateGalleryPhotoRequest) {
  const response = await fetch(`${getApiBaseUrl()}/api/gallery/photos`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    return {
      ...(await parseFailure(response)),
      success: false as const,
    };
  }

  const payload = galleryPhotoMutationEnvelopeSchema.parse(await response.json());
  return {
    success: true as const,
    result: payload.data.photo,
  };
}

export async function updateGalleryPhoto(photoId: string, input: UpdateGalleryPhotoRequest) {
  const response = await fetch(`${getApiBaseUrl()}/api/gallery/photos/${photoId}`, {
    method: "PUT",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    return {
      ...(await parseFailure(response)),
      success: false as const,
    };
  }

  const payload = galleryPhotoMutationEnvelopeSchema.parse(await response.json());
  return {
    success: true as const,
    result: payload.data.photo,
  };
}

export async function deleteGalleryPhoto(photoId: string) {
  const response = await fetch(`${getApiBaseUrl()}/api/gallery/photos/${photoId}`, {
    method: "DELETE",
    credentials: "include",
  });

  if (!response.ok) {
    return {
      ...(await parseFailure(response)),
      success: false as const,
    };
  }

  const payload = galleryPhotoDeleteEnvelopeSchema.parse(await response.json());
  return {
    success: true as const,
    result: payload.data,
  };
}
