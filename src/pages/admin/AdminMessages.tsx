import { supabase } from '../../lib/supabase';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorAlert } from '../../components/ui/ErrorAlert';
import { formatDate } from '../../lib/utils';
import { AdminPagination } from './AdminPagination';
import { loadAdminOwnerEmails, useAdminPage } from './useAdminPage';

interface MessageRow {
  id: string;
  lead: { business_name: string; user_id: string | null } | null;
  channel: string;
  language: string;
  tone: string;
  created_at: string;
}

async function loadPage(from: number, to: number) {
  const result = await supabase.from('outreach_messages').select('id,channel,language,tone,created_at,lead:leads(business_name,user_id)', { count: 'exact' })
    .order('created_at', { ascending: false }).order('id', { ascending: false }).range(from, to).returns<MessageRow[]>();
  if (result.error) return { data: null, count: result.count, error: result.error };
  const rows = result.data ?? [];
  const owners = await loadAdminOwnerEmails(rows.map(row => row.lead?.user_id));
  return {
    count: result.count,
    error: null,
    data: rows.map(row => ({ ...row, owner: row.lead?.user_id ? owners.get(row.lead.user_id) ?? row.lead.user_id.slice(0, 8) : 'Unknown owner' })),
  };
}

export function AdminMessages() {
  const { rows: messages, page, total, setPage, loading, error, setError } = useAdminPage(loadPage);

  if (loading) return <LoadingSpinner message="Loading messages..." />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Outreach Messages</h1>
        <p className="text-slate-400 text-sm mt-1">{total.toLocaleString()} total messages generated</p>
      </div>

      {error && <ErrorAlert message={error} onClose={() => setError('')} />}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Business</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium hidden md:table-cell">Owner</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium hidden sm:table-cell">Channel</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium hidden lg:table-cell">Language</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium hidden lg:table-cell">Tone</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium hidden sm:table-cell">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {messages.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">No messages found.</td>
                </tr>
              ) : messages.map(m => (
                <tr key={m.id} className="hover:bg-slate-800/30">
                  <td className="px-4 py-3 text-slate-200 font-medium truncate max-w-[160px]">{m.lead?.business_name ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs hidden md:table-cell">{m.owner}</td>
                  <td className="px-4 py-3 text-slate-400 hidden sm:table-cell capitalize">{m.channel || '—'}</td>
                  <td className="px-4 py-3 text-slate-400 hidden lg:table-cell capitalize">{m.language || '—'}</td>
                  <td className="px-4 py-3 text-slate-400 hidden lg:table-cell capitalize">{m.tone || '—'}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs hidden sm:table-cell">{formatDate(m.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <AdminPagination page={page} total={total} onPage={setPage} loading={loading} />
      </div>
    </div>
  );
}
