/**
 * Shared list query parsing for server pagination / filter / sort.
 * Additive params — callers without them keep legacy defaults.
 */

export type ListSortDir = "asc" | "desc";

export type ParsedListQuery = {
  /** Page size (clamped). */
  take: number;
  /** Offset skip (from page or skip). */
  skip: number;
  /** 1-based page when provided. */
  page: number;
  /** Opaque cursor string when provided. */
  cursor: string | null;
  /** Free-text search. */
  q: string | null;
  /** Sort field (caller-validated). */
  sort: string | null;
  /** Sort direction. */
  dir: ListSortDir;
  /** True when the client requested pagination (take/page/cursor/skip present). */
  paginated: boolean;
};

export type ListPageInfo = {
  take: number;
  skip: number;
  page: number;
  hasMore: boolean;
  nextCursor: string | null;
  total: number | null;
};

const DEFAULT_TAKE = 50;
const MAX_TAKE = 200;

export function parseListQuery(
  sp: URLSearchParams,
  opts?: { defaultTake?: number; maxTake?: number }
): ParsedListQuery {
  const defaultTake = opts?.defaultTake ?? DEFAULT_TAKE;
  const maxTake = opts?.maxTake ?? MAX_TAKE;

  const takeRaw = sp.get("take");
  const pageRaw = sp.get("page");
  const skipRaw = sp.get("skip");
  const cursor = sp.get("cursor");
  const q = sp.get("q")?.trim() || null;
  const sort = sp.get("sort")?.trim() || null;
  const dirRaw = (sp.get("dir") || sp.get("order") || "desc").toLowerCase();
  const dir: ListSortDir = dirRaw === "asc" ? "asc" : "desc";

  const paginated =
    takeRaw != null ||
    pageRaw != null ||
    skipRaw != null ||
    (cursor != null && cursor.length > 0);

  let take = defaultTake;
  if (takeRaw != null) {
    const n = Number(takeRaw);
    if (Number.isFinite(n) && n > 0) take = Math.min(Math.floor(n), maxTake);
  }

  let page = 1;
  if (pageRaw != null) {
    const n = Number(pageRaw);
    if (Number.isFinite(n) && n >= 1) page = Math.floor(n);
  }

  let skip = (page - 1) * take;
  if (skipRaw != null) {
    const n = Number(skipRaw);
    if (Number.isFinite(n) && n >= 0) skip = Math.floor(n);
  }

  return {
    take,
    skip,
    page,
    cursor: cursor && cursor.length > 0 ? cursor : null,
    q,
    sort,
    dir,
    paginated,
  };
}

export function buildPageInfo(input: {
  take: number;
  skip: number;
  page: number;
  /** rows fetched (may include +1 sentinel). */
  fetchedCount: number;
  /** items returned to client after trimming sentinel. */
  returnedCount: number;
  nextCursor?: string | null;
  total?: number | null;
}): ListPageInfo {
  const hasMore =
    input.fetchedCount > input.returnedCount ||
    (input.total != null && input.skip + input.returnedCount < input.total);

  return {
    take: input.take,
    skip: input.skip,
    page: input.page,
    hasMore,
    nextCursor: hasMore ? (input.nextCursor ?? null) : null,
    total: input.total ?? null,
  };
}

/** Encode updatedAt + id cursor for keyset pagination. */
export function encodeTimeIdCursor(updatedAt: string | Date, id: string): string {
  const iso =
    typeof updatedAt === "string" ? updatedAt : updatedAt.toISOString();
  return `${iso}|${id}`;
}

export function decodeTimeIdCursor(
  cursor: string | null | undefined
): { at: Date; id: string } | null {
  if (!cursor) return null;
  const i = cursor.indexOf("|");
  if (i <= 0) return null;
  const at = new Date(cursor.slice(0, i));
  const id = cursor.slice(i + 1);
  if (!id || Number.isNaN(at.getTime())) return null;
  return { at, id };
}
