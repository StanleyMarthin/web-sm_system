import type { GridQueryState } from "@smsystem/contracts/grid";
import {
  galleryGridSortFieldSchema,
  galleryQuerySchema,
  type GalleryQuery,
} from "@smsystem/contracts/gallery";

export function sanitizeGalleryGridQuery(
  query: GridQueryState & {
    date: string;
    unitId?: string | null;
    divisionId?: string | null;
    panelId?: string | null;
    status?: string | null;
    part?: string;
    jobSearch?: string;
  },
): GalleryQuery {
  const parsedSortBy = galleryGridSortFieldSchema.safeParse(query.sortBy);

  return galleryQuerySchema.parse({
    ...query,
    limit: Math.min(query.limit, 100),
    page: Math.max(query.page, 1),
    sortBy: parsedSortBy.success ? parsedSortBy.data : "latestPhotoAt",
    unitId: query.unitId?.trim() || null,
    divisionId: query.divisionId?.trim() || null,
    panelId: query.panelId?.trim() || null,
    status: query.status?.trim() || null,
    part: query.part?.trim() || "",
    jobSearch: query.jobSearch?.trim() || "",
  });
}
