/**
 * usePagination — client-side pagination state manager
 *
 * Usage:
 *   const pg = usePagination({ total: data?.total ?? 0 });
 *
 *   // Render:
 *   <Paginator
 *     page={pg.page}
 *     hasNext={pg.hasNext}
 *     hasPrev={pg.hasPrev}
 *     onNext={pg.goNext}
 *     onPrev={pg.goPrev}
 *   />
 *
 *   // Query (pass page + pageSize to the API):
 *   useQuery({ queryKey: ['items', pg.page, pg.pageSize], ... })
 */

import { useCallback, useState } from 'react';
import type { PaginationState } from '../types';

// ── Options ───────────────────────────────────────────────────────────────────

interface UsePaginationOptions {
  /** Total number of records (from API response) */
  total: number;
  /** Initial page (1-based). Default: 1 */
  initialPage?: number;
  /** Initial page size. Default: 20 */
  initialPageSize?: number;
}

// ── Return shape ──────────────────────────────────────────────────────────────

interface UsePaginationReturn extends PaginationState {
  /** Last available page number (always >= 1) */
  lastPage: number;
  /** True if there is a next page */
  hasNext: boolean;
  /** True if there is a previous page */
  hasPrev: boolean;
  /** Advance to the next page (no-op if already on last) */
  goNext: () => void;
  /** Go back to the previous page (no-op if already on first) */
  goPrev: () => void;
  /** Jump to an arbitrary page (clamped to [1, lastPage]) */
  goPage: (page: number) => void;
  /** Change the page size and reset to page 1 */
  setPageSize: (size: number) => void;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function usePagination({
  total,
  initialPage = 1,
  initialPageSize = 20,
}: UsePaginationOptions): UsePaginationReturn {
  const [page, setPage] = useState<number>(initialPage);
  const [pageSize, setPageSizeState] = useState<number>(initialPageSize);

  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  const hasNext = page < lastPage;
  const hasPrev = page > 1;

  const goNext = useCallback(() => {
    setPage((p) => Math.min(p + 1, lastPage));
  }, [lastPage]);

  const goPrev = useCallback(() => {
    setPage((p) => Math.max(p - 1, 1));
  }, []);

  const goPage = useCallback(
    (target: number) => {
      const clamped = Math.max(1, Math.min(target, lastPage));
      setPage(clamped);
    },
    [lastPage],
  );

  const setPageSize = useCallback((size: number) => {
    if (size < 1) return;
    setPageSizeState(size);
    setPage(1); // reset to first page whenever page size changes
  }, []);

  return {
    page,
    pageSize,
    total,
    lastPage,
    hasNext,
    hasPrev,
    goNext,
    goPrev,
    goPage,
    setPageSize,
  };
}
