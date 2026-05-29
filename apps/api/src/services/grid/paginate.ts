import type { GridMeta } from "@smsystem/contracts/grid";

export function buildGridMeta(total: number, page: number, limit: number): GridMeta {
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}
