import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { LeadSearch } from '../../types';
import { UserProfile } from '../../lib/plans';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { formatDate, getSearchStatusColor } from '../../lib/utils';

export function AdminSearches() {
  const [searches, setSearches] = useState<LeadSearch[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [searchRes, usersRes] = await Promise.all([
        supabase.from('lead_searches').select('*').order('created_at', { ascending: false }),
        supabase.from('user_profiles').select('id, email'),
      ]);
      setSearches(searchRes.data ?? []);
      setUsers((usersRes.data ?? []) as UserProfile[]);
      setLoading(false);
    }
    load();
  }, []);

  function getUserEmail(userId: string) {
    return users.find(u => u.id === userId)?.email ?? userId.slice(0, 8);
  }

  if (loading) return <LoadingSpinner message="Loading searches..." />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Lead Searches</h1>
        <p className="text-slate-400 text-sm mt-1">{searches.length} total searches</p>
      </div>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Niche</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium hidden sm:table-cell">Location</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium hidden lg:table-cell">Service Offer</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium hidden md:table-cell">Owner</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Status</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium hidden sm:table-cell">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {searches.map(s => (
                <tr key={s.id} className="hover:bg-slate-800/30">
                  <td className="px-4 py-3 text-slate-200 font-medium">{s.niche}</td>
                  <td className="px-4 py-3 text-slate-400 hidden sm:table-cell">{s.location}</td>
                  <td className="px-4 py-3 text-slate-400 hidden lg:table-cell">{s.service_offer || '—'}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs hidden md:table-cell">{getUserEmail(s.user_id)}</td>
                  <td className="px-4 py-3"><span className={`badge text-xs ${getSearchStatusColor(s.status)}`}>{s.status}</span></td>
                  <td className="px-4 py-3 text-slate-500 text-xs hidden sm:table-cell">{formatDate(s.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
