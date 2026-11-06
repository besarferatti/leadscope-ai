import { ADMIN_PAGE_SIZE } from './useAdminPage';

export function AdminPagination({ page, total, onPage, loading }: {
  page: number;
  total: number;
  onPage: (page: number) => void;
  loading: boolean;
}) {
  if (!total) return null;
  const from = page * ADMIN_PAGE_SIZE;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 px-4 py-3">
      <span className="text-xs text-slate-400">
        Showing {Math.min(from + 1, total).toLocaleString()}–{Math.min(from + ADMIN_PAGE_SIZE, total).toLocaleString()} of {total.toLocaleString()}
      </span>
      <div className="flex gap-2">
        <button type="button" className="btn-secondary text-xs" disabled={loading || page === 0} onClick={() => onPage(page - 1)}>Previous</button>
        <button type="button" className="btn-secondary text-xs" disabled={loading || from + ADMIN_PAGE_SIZE >= total} onClick={() => onPage(page + 1)}>Next</button>
      </div>
    </div>
  );
}
