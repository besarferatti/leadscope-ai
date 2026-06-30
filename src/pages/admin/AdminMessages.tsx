import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { UserProfile } from '../../lib/plans';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorAlert } from '../../components/ui/ErrorAlert';
import { formatDate } from '../../lib/utils';

interface MessageRow {
  id: string;
  lead_id: string;
  user_id?: string;
  channel: string;
  language: string;
  tone: string;
  created_at: string;
}

interface LeadRow {
  id: string;
  business_name: string;
  user_id?: string | null;
}

export function AdminMessages() {
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');

      try {
        const [messagesRes, leadsRes] = await Promise.all([
          supabase.from('outreach_messages').select('*').order('created_at', { ascending: false }),
          supabase.from('leads').select('id, business_name, user_id'),
        ]);

        if (messagesRes.error) throw messagesRes.error;
        if (leadsRes.error) throw leadsRes.error;

        const messageRows = (messagesRes.data ?? []) as MessageRow[];
        const leadRows = (leadsRes.data ?? []) as LeadRow[];
        const userIds = [...new Set(leadRows.map(l => l.user_id).filter((id): id is string => Boolean(id)))];
        const usersRes = userIds.length
          ? await supabase.from('user_profiles').select('id, email').in('id', userIds)
          : { data: [], error: null };

        if (usersRes.error) setError(usersRes.error.message);

        setMessages(messageRows);
        setLeads(leadRows);
        setUsers((usersRes.data ?? []) as UserProfile[]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load messages.');
        setMessages([]);
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

  if (loading) return <LoadingSpinner message="Loading messages..." />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Outreach Messages</h1>
        <p className="text-slate-400 text-sm mt-1">{messages.length} total messages generated</p>
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
                  <td className="px-4 py-3 text-slate-200 font-medium truncate max-w-[160px]">{getBusinessName(m.lead_id)}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs hidden md:table-cell">{getOwnerEmail(m.lead_id)}</td>
                  <td className="px-4 py-3 text-slate-400 hidden sm:table-cell capitalize">{m.channel || '—'}</td>
                  <td className="px-4 py-3 text-slate-400 hidden lg:table-cell capitalize">{m.language || '—'}</td>
                  <td className="px-4 py-3 text-slate-400 hidden lg:table-cell capitalize">{m.tone || '—'}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs hidden sm:table-cell">{formatDate(m.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
