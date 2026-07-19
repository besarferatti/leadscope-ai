import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Mail, Search, Send, XCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorAlert } from '../components/ui/ErrorAlert';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { OutreachEmailSend } from '../types';
import { formatDate } from '../lib/utils';

interface LeadSummary {
  id: string;
  business_name: string;
  location: string;
  website: string;
}

interface Props {
  onNavigate: (page: string, params?: Record<string, string>) => void;
}

type StatusFilter = 'all' | 'sent' | 'failed';

function formatDateTime(date: string | null) {
  if (!date) return '—';
  return new Date(date).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function EmailOutreachPage({ onNavigate }: Props) {
  const { user } = useAuth();
  const [emails, setEmails] = useState<OutreachEmailSend[]>([]);
  const [leadsById, setLeadsById] = useState<Record<string, LeadSummary>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [expandedEmailId, setExpandedEmailId] = useState<string | null>(null);

  useEffect(() => {
    void loadEmails();
  }, [user?.id]);

  async function loadEmails() {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    const { data, error: emailsError } = await supabase
      .from('outreach_email_sends')
      .select('id, lead_id, outreach_message_id, to_email, from_email, subject, body, status, error_message, provider, sent_at, created_at')
      .eq('user_id', user.id)
      .order('sent_at', { ascending: false });

    if (emailsError) {
      setError('Unable to load email outreach history.');
      setLoading(false);
      return;
    }

    const sentEmails = (data ?? []) as OutreachEmailSend[];
    setEmails(sentEmails);

    const leadIds = [...new Set(sentEmails.map(email => email.lead_id))];
    if (leadIds.length) {
      const { data: leads } = await supabase
        .from('leads')
        .select('id, business_name, location, website')
        .in('id', leadIds);
      setLeadsById(Object.fromEntries(((leads ?? []) as LeadSummary[]).map(lead => [lead.id, lead])));
    } else {
      setLeadsById({});
    }
    setLoading(false);
  }

  const filteredEmails = useMemo(() => {
    const query = search.trim().toLowerCase();
    return emails.filter(email => {
      if (filter !== 'all' && email.status !== filter) return false;
      if (!query) return true;
      const lead = leadsById[email.lead_id];
      return [email.subject, email.to_email, email.from_email, lead?.business_name].some(value => value?.toLowerCase().includes(query));
    });
  }, [emails, filter, leadsById, search]);

  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sent = emails.filter(email => email.status === 'sent');
    return {
      totalSent: sent.length,
      failed: emails.filter(email => email.status === 'failed').length,
      sentToday: sent.filter(email => email.sent_at && new Date(email.sent_at) >= today).length,
      lastSent: sent[0]?.sent_at ?? sent[0]?.created_at ?? null,
    };
  }, [emails]);

  if (loading) return <LoadingSpinner message="Loading email outreach history..." />;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Email Outreach</h1>
        <p className="text-slate-400 mt-1">Track outreach emails sent from LeadScope AI.</p>
      </div>

      {error ? <ErrorAlert message={error} /> : <>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
          {[
            ['Total sent', String(stats.totalSent), Send, 'text-emerald-400'],
            ['Failed', String(stats.failed), XCircle, 'text-red-400'],
            ['Sent today', String(stats.sentToday), Mail, 'text-blue-400'],
            ['Last sent email', stats.lastSent ? formatDate(stats.lastSent) : '—', Mail, 'text-slate-400'],
          ].map(([label, value, Icon, color]) => {
            const CardIcon = Icon as typeof Mail;
            return <div key={label as string} className="card p-5 flex items-center justify-between gap-4">
              <div><p className="text-slate-500 text-xs font-medium uppercase tracking-wide">{label as string}</p><p className="text-white text-xl font-semibold mt-2">{value as string}</p></div>
              <CardIcon className={`w-5 h-5 ${color as string}`} />
            </div>;
          })}
        </div>

        {emails.length > 0 && <div className="card mb-6 p-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="flex gap-1 rounded-lg bg-slate-900 p-1 self-start">
            {(['all', 'sent', 'failed'] as StatusFilter[]).map(status => <button key={status} onClick={() => setFilter(status)} className={`px-3 py-1.5 rounded-md text-sm capitalize transition-colors ${filter === status ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>{status}</button>)}
          </div>
          <label className="relative w-full sm:w-80"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" /><input value={search} onChange={event => setSearch(event.target.value)} className="input pl-9 text-sm" placeholder="Search emails or leads" /></label>
        </div>}

        {emails.length === 0 ? <div className="card"><EmptyState icon={Mail} title="No outreach emails sent yet." description="Emails sent from Lead Detail will appear here." /></div> : filteredEmails.length === 0 ? <div className="card"><EmptyState icon={Search} title="No matching emails" description="Try a different status or search term." /></div> : <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm"><thead className="bg-slate-900/70 text-slate-500 text-xs uppercase"><tr><th className="p-4">Status</th><th className="p-4">Subject</th><th className="p-4">To / From</th><th className="p-4">Lead</th><th className="p-4">Sent</th><th className="p-4">Provider</th><th className="p-4">Actions</th></tr></thead>
              <tbody className="divide-y divide-slate-800">{filteredEmails.map(email => {
                const lead = leadsById[email.lead_id]; const expanded = expandedEmailId === email.id; const failed = email.status === 'failed';
                return <tr key={email.id} className="text-slate-300 align-top"><td className="p-4"><span className={`badge ${failed ? 'bg-red-500/15 text-red-300' : 'bg-emerald-500/15 text-emerald-300'}`}>{failed ? 'Failed' : 'Sent'}</span></td><td className="p-4 min-w-48"><p className="font-medium text-slate-100">{email.subject}</p>{expanded && <div className="mt-4 space-y-3 min-w-80"><div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs"><p className="bg-slate-800/60 rounded-lg p-3"><span className="block text-slate-500 uppercase mb-1">To</span>{email.to_email}</p><p className="bg-slate-800/60 rounded-lg p-3"><span className="block text-slate-500 uppercase mb-1">From</span>{email.from_email}</p><p className="bg-slate-800/60 rounded-lg p-3"><span className="block text-slate-500 uppercase mb-1">Status</span>{failed ? 'Failed' : 'Sent'}</p><p className="bg-slate-800/60 rounded-lg p-3"><span className="block text-slate-500 uppercase mb-1">Provider / sent</span>{email.provider.toUpperCase()} · {formatDateTime(email.sent_at ?? email.created_at)}</p></div>{failed && email.error_message && <p className="text-red-400 text-xs">{email.error_message}</p>}<div className="bg-slate-800/60 rounded-lg p-3"><span className="text-slate-500 text-xs uppercase">Email body</span><pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed mt-1">{email.body}</pre></div></div>}</td><td className="p-4 text-xs"><p>{email.to_email}</p><p className="text-slate-500 mt-1">{email.from_email}</p></td><td className="p-4 text-xs">{lead ? <><p>{lead.business_name}</p><p className="text-slate-500 mt-1">{lead.location}</p></> : <span className="text-slate-500">Lead unavailable</span>}</td><td className="p-4 text-xs whitespace-nowrap">{formatDateTime(email.sent_at ?? email.created_at)}</td><td className="p-4 text-xs uppercase">{email.provider}</td><td className="p-4"><div className="flex gap-3 text-xs whitespace-nowrap"><button onClick={() => setExpandedEmailId(expanded ? null : email.id)} className="text-blue-400 hover:text-blue-300 flex items-center gap-1">View {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}</button><button onClick={() => onNavigate('lead-detail', { id: email.lead_id })} className="text-blue-400 hover:text-blue-300">Open Lead</button></div></td></tr>;
              })}</tbody></table>
          </div>
        </div>}
      </>}
    </div>
  );
}
