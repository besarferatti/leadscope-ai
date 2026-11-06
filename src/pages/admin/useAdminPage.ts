import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

export const ADMIN_PAGE_SIZE = 50;

type PageResult<T> = { data: T[] | null; count: number | null; error: { message: string; code?: string } | null };

export function useAdminPage<T>(load: (from: number, to: number) => PromiseLike<PageResult<T>>) {
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    async function run() {
      try {
        const from = page * ADMIN_PAGE_SIZE;
        const result = await load(from, from + ADMIN_PAGE_SIZE - 1);
        if (cancelled) return;
        if (result.error?.code === 'PGRST103' && page > 0) {
          setPage(0);
          return;
        }
        if (result.error) throw result.error;
        const count = result.count ?? 0;
        const lastPage = Math.max(0, Math.ceil(count / ADMIN_PAGE_SIZE) - 1);
        setTotal(count);
        if (page > lastPage) {
          setPage(lastPage);
          return;
        }
        setRows(result.data ?? []);
      } catch (failure) {
        if (cancelled) return;
        setRows([]);
        setTotal(0);
        setError(failure && typeof failure === 'object' && 'message' in failure
          ? String(failure.message) : 'Unable to load this page.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void run();
    return () => { cancelled = true; };
  }, [load, page, revision]);

  return { rows, total, page, setPage, loading, error, setError, refresh: () => setRevision(n => n + 1) };
}

export async function loadAdminOwnerEmails(ids: (string | null | undefined)[]) {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (!unique.length) return new Map<string, string>();
  const { data, error } = await supabase.from('user_profiles').select('id,email').in('id', unique);
  if (error) throw error;
  return new Map((data ?? []).map(row => [row.id as string, row.email as string]));
}
