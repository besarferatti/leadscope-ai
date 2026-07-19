import { useEffect, useMemo, useState } from 'react';
import { Check, Eye, Image, Loader2, Mail, RefreshCw, Send } from 'lucide-react';
import { productUpdates, type ProductUpdate } from '../../data/productUpdates';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

const updateGroup = 'July 2026';
type Platform = 'linkedin' | 'x' | 'tiktok';
type BufferChannel = { id: string; platform: Platform; displayName: string; service: string; avatar?: string | null };
type SocialPost = { caption: string; imageUrl: string; width: number; height: number; title?: string; channelId?: string; draft?: 'success' | 'error'; error?: string };
const socialPlatforms: Platform[] = ['linkedin', 'x', 'tiktok'];
const updateId = (update: ProductUpdate) => update.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

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
  const [testSent, setTestSent] = useState(false);
  const [eligibleCount, setEligibleCount] = useState<number | null>(null);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [campaignStatus, setCampaignStatus] = useState<'draft' | 'test_sent' | 'sending' | 'sent' | 'failed'>('draft');
  const [sendResult, setSendResult] = useState<{ sent: number; failed: number; skipped: number } | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [channels, setChannels] = useState<BufferChannel[]>([]);
  const [socialPlatformsSelected, setSocialPlatformsSelected] = useState<Platform[]>(['linkedin', 'x', 'tiktok']);
  const [socialPosts, setSocialPosts] = useState<Partial<Record<Platform, SocialPost>>>({});
  const [socialStatus, setSocialStatus] = useState('');
  const [socialError, setSocialError] = useState('');
  const [socialLoading, setSocialLoading] = useState(false);
  const selectedUpdate = selectedIndex === null ? null : productUpdates[selectedIndex];
  const formattedBody = useMemo(() => body.split('\n'), [body]);

  useEffect(() => {
    if (!user?.id) return;
    void supabase.from('user_smtp_settings').select('from_email').eq('user_id', user.id).maybeSingle().then(({ data }) => {
      setFromEmail(data?.from_email?.trim() || null);
    });
  }, [user?.id]);

  useEffect(() => {
    void loadRecipientCount();
  // Recipient eligibility is recomputed whenever the selected, tested content changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIndex, session?.access_token]);

  useEffect(() => {
    if (!session?.access_token) return;
    void fetch('/api/get-buffer-channels', { headers: { Authorization: `Bearer ${session.access_token}` } }).then(async response => {
      const data = await response.json() as { channels?: BufferChannel[]; error?: string };
      if (!response.ok) throw new Error(data.error || 'Unable to load Buffer channels.');
      setChannels(data.channels || []);
    }).catch(error => setSocialError(error instanceof Error ? error.message : 'Unable to load Buffer channels.'));
  }, [session?.access_token]);

  function selectUpdate(update: ProductUpdate, index: number) {
    setSelectedIndex(index);
    setSubject(`New in LeadScope AI: ${update.title}`);
    setBody(composeBody(update));
    setCampaignId(null);
    setTestSent(false);
    setEligibleCount(null);
    setCampaignStatus('draft');
    setSendResult(null);
    setMessage(null);
    setShowPreview(true);
    setSocialPosts({}); setSocialError(''); setSocialStatus('');
  }

  async function generateSocial(regeneratePlatform?: Platform, captionsOnly = false) {
    if (!selectedUpdate || !session?.access_token) return;
    setSocialLoading(true); setSocialError('');
    try {
      setSocialStatus(captionsOnly ? 'Generating captions...' : regeneratePlatform ? 'Generating AI artwork...' : 'Generating captions...');
      const response = await fetch('/api/generate-social-image-package', { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ updateId: updateId(selectedUpdate), platforms: regeneratePlatform ? [regeneratePlatform] : socialPlatformsSelected, regeneratePlatform: regeneratePlatform || null, regenerateCaption: captionsOnly }) });
      const data = await response.json() as Partial<Record<Platform, SocialPost>> & { error?: string };
      if (!response.ok) throw new Error(data.error || 'Unable to generate social package.');
      setSocialStatus('Applying LeadScope branding...');
      setSocialPosts(current => {
        const next = { ...current };
        socialPlatforms.forEach(platform => { const post = data[platform]; if (post) next[platform] = { ...current[platform], ...post, channelId: current[platform]?.channelId || channels.find(channel => channel.platform === platform)?.id }; });
        return next;
      });
      setSocialStatus('Images uploaded and ready for Buffer drafts.');
    } catch (error) { setSocialError(error instanceof Error ? error.message : 'Unable to generate social package.'); }
    finally { setSocialLoading(false); }
  }
  async function createDrafts() {
    if (!session?.access_token) return;
    const posts = socialPlatformsSelected.flatMap(platform => { const post = socialPosts[platform]; return post?.channelId ? [{ platform, channelId: post.channelId, caption: post.caption, title: post.title, imageUrl: post.imageUrl }] : []; });
    if (!posts.length) { setSocialError('Select a Buffer channel for at least one generated post.'); return; }
    setSocialLoading(true); setSocialError(''); setSocialStatus('Creating Buffer drafts...');
    try {
      const response = await fetch('/api/create-buffer-image-drafts', { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ posts }) });
      const data = await response.json() as { results?: Array<{ platform: Platform; success: boolean; error?: string }>; error?: string };
      if (!response.ok) throw new Error(data.error || 'Unable to create Buffer drafts.');
      setSocialPosts(current => ({ ...current, ...Object.fromEntries((data.results || []).map(result => [result.platform, { ...current[result.platform], draft: result.success ? 'success' : 'error', error: result.error }])) }));
      const failures = data.results?.filter(result => !result.success).length || 0;
      setSocialStatus(failures ? `Some drafts could not be created (${failures} failed).` : 'Created in Buffer.');
    } catch (error) { setSocialError(error instanceof Error ? error.message : 'Unable to create Buffer drafts.'); } finally { setSocialLoading(false); }
  }

  async function loadRecipientCount() {
    if (!selectedUpdate || !session?.access_token || !subject.trim() || !body.trim()) return;
    setLoadingRecipients(true);
    try {
      const response = await fetch('/api/send-product-update-campaign', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ update_id: selectedUpdate.title, subject, body, preview: true }),
      });
      const result = await response.json() as { success?: boolean; eligible_count?: number };
      if (response.ok && result.success) setEligibleCount(result.eligible_count ?? 0);
    } finally {
      setLoadingRecipients(false);
    }
  }

  async function sendCampaign() {
    if (!selectedUpdate || !session?.access_token || !campaignId || !testSent || !subject.trim() || !body.trim()) return;
    setSending(true);
    setCampaignStatus('sending');
    setMessage(null);
    try {
      const response = await fetch('/api/send-product-update-campaign', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign_id: campaignId, update_id: selectedUpdate.title, subject, body }),
      });
      const result = await response.json() as { success?: boolean; sent_count?: number; failed_count?: number; skipped_count?: number; status?: 'sent' | 'failed'; error?: string };
      if (!response.ok || !result.success) throw new Error(result.error || 'Unable to send campaign.');
      const counts = { sent: result.sent_count ?? 0, failed: result.failed_count ?? 0, skipped: result.skipped_count ?? 0 };
      setSendResult(counts);
      setCampaignStatus(result.status ?? 'sent');
      setMessage({ type: 'success', text: `Campaign complete: ${counts.sent} sent, ${counts.failed} failed, ${counts.skipped} skipped.` });
    } catch (error) {
      setCampaignStatus('failed');
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to send campaign.' });
    } finally {
      setSending(false);
      setShowConfirm(false);
    }
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
      setTestSent(true);
      setCampaignStatus('test_sent');
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
          <label className="mt-5 block text-sm font-medium text-slate-300">Subject<input value={subject} onChange={event => { setSubject(event.target.value); setTestSent(false); setCampaignStatus('draft'); }} className="mt-2 input w-full" /></label>
          <label className="mt-5 block text-sm font-medium text-slate-300">Body<textarea value={body} onChange={event => { setBody(event.target.value); setTestSent(false); setCampaignStatus('draft'); }} rows={18} className="mt-2 input w-full resize-y font-mono text-xs leading-relaxed" /></label>
          {message && <div className={`mt-4 rounded-lg border px-3 py-2 text-sm ${message.type === 'success' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-red-500/30 bg-red-500/10 text-red-300'}`}>{message.text}</div>}
          <div className="mt-5 rounded-lg border border-slate-800 bg-slate-950/50 p-4 text-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-medium text-slate-200">Registered recipients</p><p className="mt-1 text-slate-400">{loadingRecipients ? 'Calculating eligible recipients…' : `${eligibleCount ?? 0} eligible recipients`}</p></div><span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-medium capitalize text-slate-300">Campaign: {campaignStatus.replace('_', ' ')}</span></div>{sendResult && <p className="mt-3 text-slate-300">Sent: {sendResult.sent} · Failed: {sendResult.failed} · Skipped: {sendResult.skipped}</p>}</div>
          <div className="mt-5 flex flex-wrap gap-3"><button onClick={() => setShowPreview(value => !value)} className="btn-secondary flex items-center gap-2"><Eye className="h-4 w-4" />{showPreview ? 'Hide Preview' : 'Preview'}</button><button onClick={sendTestEmail} disabled={sending || !subject.trim() || !body.trim()} className="btn-primary flex items-center gap-2 disabled:opacity-60"><>{sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</>Send Test Email</button><button onClick={() => setShowConfirm(true)} disabled={sending || !testSent || !campaignId || !subject.trim() || !body.trim() || !eligibleCount} className="btn-primary flex items-center gap-2 disabled:opacity-60"><Send className="h-4 w-4" />Send to registered users</button></div>
        </div>
        {showPreview && <aside className="rounded-xl border border-slate-800 bg-slate-900/70 p-5"><h2 className="text-lg font-semibold text-white">Email preview</h2><dl className="mt-5 space-y-3 text-sm"><div><dt className="text-slate-500">From</dt><dd className="mt-0.5 text-slate-200">{fromEmail ?? 'Your connected SMTP email'}</dd></div><div><dt className="text-slate-500">To</dt><dd className="mt-0.5 flex items-center gap-2 text-slate-200"><Mail className="h-3.5 w-3.5 text-blue-400" />{user?.email ?? 'Your admin account email'}</dd></div><div><dt className="text-slate-500">Subject</dt><dd className="mt-0.5 font-medium text-white">{subject}</dd></div></dl><div className="mt-5 rounded-lg border border-slate-700 bg-slate-950 p-4 whitespace-pre-wrap text-sm leading-relaxed text-slate-300">{formattedBody.map((line, index) => <div key={`${line}-${index}`}>{line || '\u00a0'}</div>)}</div><p className="mt-4 border-t border-slate-800 pt-4 text-xs leading-relaxed text-slate-500">You are receiving this because you registered for LeadScope AI.<br />You can unsubscribe from product update emails at any time.</p></aside>}
      </section>}
      {selectedUpdate && <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
        <div className="flex items-start gap-3"><Image className="mt-1 h-5 w-5 text-blue-400" /><div><h2 className="text-lg font-semibold text-white">Social Media Image Posts</h2><p className="mt-1 text-sm text-slate-400">Generate branded image posts and save selected posts as Buffer drafts. Nothing is published or scheduled.</p></div></div>
        <div className="mt-5 flex flex-wrap gap-3">{socialPlatforms.map(platform => <label key={platform} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm capitalize text-slate-200"><input type="checkbox" checked={socialPlatformsSelected.includes(platform)} onChange={() => setSocialPlatformsSelected(current => current.includes(platform) ? current.filter(item => item !== platform) : [...current, platform])} />{platform === 'x' ? 'X' : platform === 'tiktok' ? 'TikTok photo post' : 'LinkedIn'}</label>)}</div>
        {channels.length === 0 && !socialError && <p className="mt-4 text-sm text-amber-300">No supported Buffer channels are connected yet.</p>}
        {socialError && <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{socialError}</p>}
        {socialStatus && <p className="mt-4 text-sm text-blue-300">{socialLoading && <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />}{socialStatus}</p>}
        <button onClick={() => generateSocial()} disabled={socialLoading || !socialPlatformsSelected.length} className="btn-primary mt-5 flex items-center gap-2 disabled:opacity-60">{socialLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Image className="h-4 w-4" />}Generate Social Package</button>
        <div className="mt-6 grid gap-5 xl:grid-cols-3">{socialPlatformsSelected.map(platform => { const post = socialPosts[platform]; return <article key={platform} className="rounded-xl border border-slate-800 bg-slate-950/50 p-4"><h3 className="font-semibold capitalize text-white">{platform === 'x' ? 'X' : platform === 'tiktok' ? 'TikTok photo post' : 'LinkedIn'}</h3><label className="mt-3 block text-xs text-slate-400">Buffer channel<select value={post?.channelId || ''} onChange={event => setSocialPosts(current => ({ ...current, [platform]: { ...current[platform]!, channelId: event.target.value } }))} className="input mt-1 w-full"><option value="">Select a channel</option>{channels.filter(channel => channel.platform === platform).map(channel => <option key={channel.id} value={channel.id}>{channel.displayName}</option>)}</select></label>{post && <><label className="mt-3 block text-xs text-slate-400">Caption<textarea value={post.caption} onChange={event => setSocialPosts(current => ({ ...current, [platform]: { ...current[platform]!, caption: event.target.value } }))} rows={5} className="input mt-1 w-full resize-y text-sm" /></label><p className="mt-1 text-right text-xs text-slate-500">{post.caption.length}{platform === 'x' ? ' / 280' : ' characters'}</p>{platform === 'tiktok' && <label className="mt-3 block text-xs text-slate-400">Photo-post title<input value={post.title || ''} onChange={event => setSocialPosts(current => ({ ...current, [platform]: { ...current[platform]!, title: event.target.value } }))} className="input mt-1 w-full" /></label>}<img src={post.imageUrl} alt={`${platform} branded product update`} className="mt-4 aspect-video w-full rounded-lg object-cover" /><p className="mt-1 text-xs text-slate-500">{post.width} × {post.height} JPEG</p><div className="mt-3 flex gap-2"><button onClick={() => generateSocial(platform)} disabled={socialLoading} className="btn-secondary text-xs"><RefreshCw className="mr-1 inline h-3.5 w-3.5" />Regenerate Image</button><button onClick={() => generateSocial(platform, true)} disabled={socialLoading} className="btn-secondary text-xs">Regenerate Caption</button></div>{post.draft && <p className={post.draft === 'success' ? 'mt-3 text-sm text-emerald-300' : 'mt-3 text-sm text-red-300'}>{post.draft === 'success' ? 'Created in Buffer' : post.error || 'Buffer draft failed.'}</p>}</>}</article>; })}</div>
        {!!Object.keys(socialPosts).length && <button onClick={createDrafts} disabled={socialLoading} className="btn-primary mt-6 flex items-center gap-2 disabled:opacity-60"><Send className="h-4 w-4" />Send Selected to Buffer Drafts</button>}
      </section>}
      {showConfirm && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4" role="dialog" aria-modal="true"><div className="w-full max-w-lg rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-xl"><h2 className="text-lg font-semibold text-white">Send product update?</h2><p className="mt-3 text-sm leading-relaxed text-slate-300">You are about to send this update to {eligibleCount ?? 0} registered users who are subscribed to product updates. This action cannot be undone.</p><div className="mt-6 flex justify-end gap-3"><button onClick={() => setShowConfirm(false)} disabled={sending} className="btn-secondary">Cancel</button><button onClick={sendCampaign} disabled={sending} className="btn-primary flex items-center gap-2">{sending && <Loader2 className="h-4 w-4 animate-spin" />}Confirm Send</button></div></div></div>}
    </div>
  );
}
