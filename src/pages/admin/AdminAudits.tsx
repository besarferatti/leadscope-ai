import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { UserProfile } from '../../lib/plans';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorAlert } from '../../components/ui/ErrorAlert';
import { formatDate } from '../../lib/utils';

interface AuditRow {
  id: string;
  lead_id: string;
  user_id?: string;
  website_score: number | null;
  seo_score: number | null;
  conversion_score: number | null;
  lead_score: number | null;
  created_at: string;
}

interface LeadRow {
  id: string;
  business_name: string;
  user_id?: string | null;
}

export function AdminAudits() {
  const [audits, setAudits] = useState<AuditRow[]>([]);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');

      try {
        const [auditsRes, leadsRes] = await Promise.all([
          supabase.from('lead_audits').select('*').order('created_at', { ascending: false }),
          supabase.from('leads').select('id, business_name, user_id'),
        ]);

        if (auditsRes.error) throw auditsRes.error;
        if (leadsRes.error) throw leadsRes.error;

        const auditRows = (auditsRes.data ?? []) as AuditRow[];
        const leadRows = (leadsRes.data ?? []) as LeadRow[];
        const userIds = [...new Set(leadRows.map(l => l.user_id).filter((id): id is string => Boolean(id)))];
        const usersRes = userIds.length
          ? await supabase.from('user_profiles').select('id, email').in('id', userIds)
          : { data: [], error: null };

        if (usersRes.error) setError(usersRes.error.message);

        setAudits(auditRows);
        setLeads(leadRows);
        setUsers((usersRes.data ?? []) as UserProfile[]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load audits.');
        setAudits([]);
        setLeads([]);
        setUsers([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function getBusinessName(leadId: string) {
    return leads.find(l => l.id === leadId)?.business_name ?? '—';
  }

  function getOwnerEmail(leadId: string) {
    const lead = leads.find(l => l.id === leadId);
    if (!lead?.user_id) return 'Unknown owner';

    return users.find(u => u.id === lead.user_id)?.email ?? lead.user_id.slice(0, 8);
  }

  function scoreCell(score: number | null) {
    if (score === null) return <span className="text-slate-600">—</span>;
    const color = score >= 70 ? 'text-emerald-400' : score >= 40 ? 'text-amber-400' : 'text-red-400';
    return <span className={`font-medium ${color}`}>{score}</span>;
  }

  if (loading) return <LoadingSpinner message="Loading audits..." />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">AI Audits</h1>
        <p className="text-slate-400 text-sm mt-1">{audits.length} total audits</p>
      </div>

      {error && <ErrorAlert message={error} onClose={() => setError('')} />}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Business</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium hidden md:table-cell">Owner</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium hidden sm:table-cell">Website</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium hidden sm:table-cell">SEO</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium hidden lg:table-cell">Conversion</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Lead Score</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium hidden sm:table-cell">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {audits.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">No audits found.</td>
                </tr>
              ) : audits.map(a => (
                <tr key={a.id} className="hover:bg-slate-800/30">
                  <td className="px-4 py-3 text-slate-200 font-medium truncate max-w-[160px]">{getBusinessName(a.lead_id)}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs hidden md:table-cell">{getOwnerEmail(a.lead_id)}</td>
                  <td className="px-4 py-3 hidden sm:table-cell">{scoreCell(a.website_score)}</td>
                  <td className="px-4 py-3 hidden sm:table-cell">{scoreCell(a.seo_score)}</td>
                  <td className="px-4 py-3 hidden lg:table-cell">{scoreCell(a.conversion_score)}</td>
                  <td className="px-4 py-3">{scoreCell(a.lead_score)}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs hidden sm:table-cell">{formatDate(a.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
