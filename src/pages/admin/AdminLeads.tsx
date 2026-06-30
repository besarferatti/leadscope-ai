import { useEffect, useState } from 'react';
import { Trash2, ChevronRight, Search, X, Star } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Lead } from '../../types';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorAlert } from '../../components/ui/ErrorAlert';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { ScoreBadge } from '../../components/ui/ScoreBadge';
import { UserProfile } from '../../lib/plans';
import { LEAD_STATUSES } from '../../lib/utils';

interface Props {
  onNavigate?: (page: string, params?: Record<string, string>) => void;
}

export function AdminLeads({ onNavigate }: Props) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [leadsRes, usersRes] = await Promise.all([
      supabase.from('leads').select('*').order('created_at', { ascending: false }),
      supabase.from('user_profiles').select('id, email, full_name'),
    ]);
    setLeads(leadsRes.data ?? []);
    setUsers((usersRes.data ?? []) as UserProfile[]);
    setLoading(false);
  }

  async function handleDelete(id: string) {
    const { error: err } = await supabase.from('leads').delete().eq('id', id);
    if (err) setError(err.message);
    else setLeads(prev => prev.filter(l => l.id !== id));
    setDeleteId(null);
  }

  function getUserEmail(userId: string) {
    const u = users.find(u => u.id === userId);
    return u?.email ?? userId.slice(0, 8);
  }

  const filtered = leads.filter(l => {
    if (filterStatus && l.status !== filterStatus) return false;
    if (filterUser && l.user_id !== filterUser) return false;
    if (query) {
      const q = query.toLowerCase();
      return l.business_name.toLowerCase().includes(q) || l.location.toLowerCase().includes(q);
    }
    return true;
  });

  if (loading) return <LoadingSpinner message="Loading leads..." />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">All Leads</h1>
        <p className="text-slate-400 text-sm mt-1">{leads.length} total leads across all users</p>
      </div>

      {error && <ErrorAlert message={error} onClose={() => setError('')} />}

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input className="input pl-9" placeholder="Search leads..." value={query} onChange={e => setQuery(e.target.value)} />
          {query && <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"><X className="w-3.5 h-3.5" /></button>}
        </div>
        <select className="select w-auto" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All Statuses</option>
          {LEAD_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="select w-auto" value={filterUser} onChange={e => setFilterUser(e.target.value)}>
          <option value="">All Users</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.email}</option>)}
        </select>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Business</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium hidden md:table-cell">Owner</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium hidden lg:table-cell">Rating</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Score</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Status</th>
                <th className="text-right px-4 py-3 text-slate-400 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filtered.map(lead => (
                <tr key={lead.id} className="hover:bg-slate-800/30 transition-colors group">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-200 truncate max-w-[160px]">{lead.business_name}</div>
                    <div className="text-slate-500 text-xs">{lead.location} · {lead.industry}</div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-slate-400 text-xs">{getUserEmail(lead.user_id)}</td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {lead.google_rating ? (
                      <div className="flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                        <span className="text-slate-300 text-xs">{lead.google_rating}</span>
                      </div>
                    ) : <span className="text-slate-600">—</span>}
                  </td>
                  <td className="px-4 py-3"><ScoreBadge score={lead.lead_score} size="sm" /></td>
                  <td className="px-4 py-3"><StatusBadge status={lead.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      {onNavigate && (
                        <button onClick={() => onNavigate('lead-detail', { id: lead.id })} className="text-slate-400 hover:text-blue-400 transition-colors">
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      )}
                      <button onClick={() => setDeleteId(lead.id)} className="text-slate-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-slate-800 text-slate-500 text-xs">
          Showing {filtered.length} of {leads.length} leads
        </div>
      </div>

      {deleteId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="card p-6 w-full max-w-sm">
            <h3 className="text-white font-semibold mb-2">Delete Lead?</h3>
            <p className="text-slate-400 text-sm mb-6">This will permanently delete this lead.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteId(null)} className="btn-secondary">Cancel</button>
              <button onClick={() => handleDelete(deleteId)} className="btn-danger">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
