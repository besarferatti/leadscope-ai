import { useEffect, useMemo, useState } from 'react';
import { Check, Eye, Loader2, Mail, Send } from 'lucide-react';
import { productUpdates, type ProductUpdate } from '../../data/productUpdates';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

const updateGroup = 'July 2026';

function composeBody(update: ProductUpdate) {
  return [
    'Hi there,',
    '',
    'We have published a new LeadScope AI product update.',
    '',
    update.title,
    update.description,
    '',
    ...update.highlights.map(highlight => `- ${highlight}`),
    '',
    'Explore all product updates: https://www.leadscope.pro/updates',
    '',
    'You are receiving this because you registered for LeadScope AI.',
    'You can unsubscribe from product update emails at any time.',
  ].join('\n');
}

export function SendUpdatesPage() {
  const { session, user } = useAuth();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(true);
  const [fromEmail, setFromEmail] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const selectedUpdate = selectedIndex === null ? null : productUpdates[selectedIndex];
  const formattedBody = useMemo(() => body.split('\n'), [body]);

  useEffect(() => {
    if (!user?.id) return;
    void supabase.from('user_smtp_settings').select('from_email').eq('user_id', user.id).maybeSingle().then(({ data }) => {
      setFromEmail(data?.from_email?.trim() || null);
    });
  }, [user?.id]);

  function selectUpdate(update: ProductUpdate, index: number) {
    setSelectedIndex(index);
    setSubject(`New in LeadScope AI: ${update.title}`);
    setBody(composeBody(update));
    setCampaignId(null);
    setMessage(null);
    setShowPreview(true);
  }

  async function sendTestEmail() {
    if (!selectedUpdate || !session?.access_token || !subject.trim() || !body.trim()) return;
    setSending(true);
    setMessage(null);
    try {
      const response = await fetch('/api/send-product-update-test-email', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign_id: campaignId, update_id: selectedUpdate.title, title: selectedUpdate.title, subject, body }),
      });
      const result = await response.json() as { success?: boolean; campaign_id?: string; error?: string };
      if (!response.ok || !result.success) throw new Error(result.error || 'Unable to send test email.');
      setCampaignId(result.campaign_id ?? campaignId);
      setMessage({ type: 'success', text: `Test email sent to ${user?.email ?? 'your admin email'}.` });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to send test email.' });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-white">Send Updates</h1>
        <p className="mt-1 text-sm text-slate-400">Prepare product update emails from published LeadScope AI updates.</p>
      </header>

      <section>
        <div className="mb-4 flex items-center gap-3"><div className="h-px flex-1 bg-slate-800" /><h2 className="text-sm font-semibold text-slate-300">{updateGroup}</h2><div className="h-px flex-1 bg-slate-800" /></div>
        <div className="grid gap-4 xl:grid-cols-2">
          {productUpdates.map((update, index) => {
            const selected = selectedIndex === index;
            return <article key={update.title} className={`rounded-xl border p-5 ${selected ? 'border-blue-500 bg-blue-500/10' : 'border-slate-800 bg-slate-900/70'}`}>
              <div className="flex gap-4 justify-between"><div><h3 className="font-semibold text-white">{update.title}</h3><p className="mt-1.5 text-sm text-slate-400">{update.description}</p></div><button onClick={() => selectUpdate(update, index)} className={selected ? 'btn-secondary shrink-0 text-sm' : 'btn-primary shrink-0 text-sm'}>{selected ? 'Selected' : 'Select'}</button></div>
              <ul className="mt-4 space-y-1.5">{update.highlights.map(highlight => <li key={highlight} className="flex gap-2 text-xs text-slate-300"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-400" />{highlight}</li>)}</ul>
            </article>;
          })}
        </div>
      </section>

      {selectedUpdate && <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
          <h2 className="text-lg font-semibold text-white">Email composer</h2>
          <p className="mt-1 text-sm text-slate-400">A test email is sent only to your own admin account email.</p>
          <label className="mt-5 block text-sm font-medium text-slate-300">Subject<input value={subject} onChange={event => setSubject(event.target.value)} className="mt-2 input w-full" /></label>
          <label className="mt-5 block text-sm font-medium text-slate-300">Body<textarea value={body} onChange={event => setBody(event.target.value)} rows={18} className="mt-2 input w-full resize-y font-mono text-xs leading-relaxed" /></label>
          {message && <div className={`mt-4 rounded-lg border px-3 py-2 text-sm ${message.type === 'success' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-red-500/30 bg-red-500/10 text-red-300'}`}>{message.text}</div>}
          <div className="mt-5 flex flex-wrap gap-3"><button onClick={() => setShowPreview(value => !value)} className="btn-secondary flex items-center gap-2"><Eye className="h-4 w-4" />{showPreview ? 'Hide Preview' : 'Preview'}</button><button onClick={sendTestEmail} disabled={sending || !subject.trim() || !body.trim()} className="btn-primary flex items-center gap-2 disabled:opacity-60"><>{sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</>Send Test Email</button></div>
        </div>
        {showPreview && <aside className="rounded-xl border border-slate-800 bg-slate-900/70 p-5"><h2 className="text-lg font-semibold text-white">Email preview</h2><dl className="mt-5 space-y-3 text-sm"><div><dt className="text-slate-500">From</dt><dd className="mt-0.5 text-slate-200">{fromEmail ?? 'Your connected SMTP email'}</dd></div><div><dt className="text-slate-500">To</dt><dd className="mt-0.5 flex items-center gap-2 text-slate-200"><Mail className="h-3.5 w-3.5 text-blue-400" />{user?.email ?? 'Your admin account email'}</dd></div><div><dt className="text-slate-500">Subject</dt><dd className="mt-0.5 font-medium text-white">{subject}</dd></div></dl><div className="mt-5 rounded-lg border border-slate-700 bg-slate-950 p-4 whitespace-pre-wrap text-sm leading-relaxed text-slate-300">{formattedBody.map((line, index) => <div key={`${line}-${index}`}>{line || '\u00a0'}</div>)}</div><p className="mt-4 border-t border-slate-800 pt-4 text-xs leading-relaxed text-slate-500">You are receiving this because you registered for LeadScope AI.<br />You can unsubscribe from product update emails at any time.</p></aside>}
      </section>}
    </div>
  );
}
