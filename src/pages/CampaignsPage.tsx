import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, ChevronDown, ChevronUp, Mail, Megaphone, Pause, Play, Plus, Search, ShieldCheck, Users, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorAlert } from '../components/ui/ErrorAlert';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { Lead, OutreachCampaign, OutreachCampaignMode, OutreachCampaignStatus } from '../types';

interface CampaignLeadRow {
  campaign_id: string;
  status: string;
}

const DEFAULT_DELAYS = [0, 3, 7];

function statusStyle(status: OutreachCampaignStatus) {
  if (status === 'active') return 'bg-emerald-500/15 text-emerald-300';
  if (status === 'paused') return 'bg-amber-500/15 text-amber-300';
  if (status === 'completed') return 'bg-blue-500/15 text-blue-300';
  return 'bg-slate-700 text-slate-300';
}

export function CampaignsPage() {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<OutreachCampaign[]>([]);
  const [eligibleLeads, setEligibleLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [name, setName] = useState('');
  const [mode, setMode] = useState<OutreachCampaignMode>('review');
  const [language, setLanguage] = useState('English');
  const [tone, setTone] = useState('Professional');
  const [dailyLimit, setDailyLimit] = useState(10);
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    setError('');
    const [{ data: campaignData, error: campaignError }, { data: leadData, error: leadError }] = await Promise.all([
      supabase.from('outreach_campaigns').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('leads').select('*').eq('user_id', user.id).not('email', 'is', null).neq('email', '').order('lead_score', { ascending: false }),
    ]);
    if (campaignError || leadError) {
      setError(campaignError?.message.includes('outreach_campaigns')
        ? 'Campaign database is not ready yet. Apply the new Supabase migration first.'
        : 'Unable to load campaigns and leads.');
      setLoading(false);
      return;
    }

    const rows = (campaignData ?? []) as OutreachCampaign[];
    if (rows.length) {
      const { data: membershipData } = await supabase
        .from('outreach_campaign_leads')
        .select('campaign_id, status')
        .in('campaign_id', rows.map(item => item.id));
      const memberships = (membershipData ?? []) as CampaignLeadRow[];
      setCampaigns(rows.map(item => ({
        ...item,
        lead_count: memberships.filter(row => row.campaign_id === item.id).length,
        sent_count: memberships.filter(row => row.campaign_id === item.id && row.status === 'sent').length,
      })));
    } else {
      setCampaigns([]);
    }
    setEligibleLeads((leadData ?? []) as Lead[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { void loadData(); }, [loadData]);

  const filteredLeads = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return eligibleLeads;
    return eligibleLeads.filter(lead => [lead.business_name, lead.email, lead.location, lead.industry]
      .some(value => value?.toLowerCase().includes(query)));
  }, [eligibleLeads, search]);

  function toggleLead(id: string) {
    setSelectedLeadIds(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function resetForm() {
    setName(''); setMode('review'); setLanguage('English'); setTone('Professional');
    setDailyLimit(10); setSelectedLeadIds(new Set()); setSearch(''); setShowCreate(false);
  }

  async function createCampaign() {
    if (!user || !name.trim() || selectedLeadIds.size === 0) return;
    setSaving(true);
    setError('');
    const { data: campaign, error: campaignError } = await supabase.from('outreach_campaigns').insert({
      user_id: user.id,
      name: name.trim(),
      mode,
      language,
      tone,
      daily_limit: dailyLimit,
      status: 'draft',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    }).select().single();

    if (campaignError || !campaign) {
      setError(campaignError?.message ?? 'Unable to create the campaign.');
      setSaving(false);
      return;
    }

    const [{ error: stepsError }, { error: leadsError }] = await Promise.all([
      supabase.from('outreach_campaign_steps').insert(DEFAULT_DELAYS.map((delay, index) => ({
        campaign_id: campaign.id, step_order: index + 1, delay_days: delay,
      }))),
      supabase.from('outreach_campaign_leads').insert([...selectedLeadIds].map(leadId => ({
        campaign_id: campaign.id, lead_id: leadId, status: 'pending',
      }))),
    ]);

    if (stepsError || leadsError) {
      await supabase.from('outreach_campaigns').delete().eq('id', campaign.id);
      setError(stepsError?.message ?? leadsError?.message ?? 'Unable to add the selected leads.');
      setSaving(false);
      return;
    }
    resetForm();
    await loadData();
    setSaving(false);
  }

  async function setCampaignStatus(id: string, status: OutreachCampaignStatus) {
    setError('');
    const { error: updateError } = await supabase.from('outreach_campaigns')
      .update({ status, updated_at: new Date().toISOString() }).eq('id', id);
    if (updateError) setError(updateError.message);
    else setCampaigns(current => current.map(item => item.id === id ? { ...item, status } : item));
  }

  if (loading) return <LoadingSpinner message="Loading campaigns..." />;

  return <div className="max-w-7xl mx-auto">
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
      <div><h1 className="text-2xl font-bold text-white">Campaigns</h1><p className="text-slate-400 mt-1">Organize personalized outreach and follow-ups without losing control.</p></div>
      <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center justify-center gap-2"><Plus className="w-4 h-4" /> New campaign</button>
    </div>

    {error && <div className="mb-5"><ErrorAlert message={error} /></div>}

    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <div className="card p-5"><div className="flex items-center justify-between"><p className="text-slate-500 text-xs uppercase tracking-wide">Campaigns</p><Megaphone className="w-5 h-5 text-blue-400" /></div><p className="text-white text-2xl font-semibold mt-2">{campaigns.length}</p></div>
      <div className="card p-5"><div className="flex items-center justify-between"><p className="text-slate-500 text-xs uppercase tracking-wide">Active</p><Play className="w-5 h-5 text-emerald-400" /></div><p className="text-white text-2xl font-semibold mt-2">{campaigns.filter(item => item.status === 'active').length}</p></div>
      <div className="card p-5"><div className="flex items-center justify-between"><p className="text-slate-500 text-xs uppercase tracking-wide">Leads enrolled</p><Users className="w-5 h-5 text-violet-400" /></div><p className="text-white text-2xl font-semibold mt-2">{campaigns.reduce((sum, item) => sum + (item.lead_count ?? 0), 0)}</p></div>
    </div>

    <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-4 mb-6 flex gap-3">
      <ShieldCheck className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
      <div><p className="text-blue-200 text-sm font-medium">Safe launch mode</p><p className="text-blue-300/70 text-xs mt-1">New campaigns stay in Draft. Review Mode requires approval before sending; daily limits and suppression rules are enforced by design.</p></div>
    </div>

    {campaigns.length === 0 ? <div className="card"><EmptyState icon={Megaphone} title="No campaigns yet" description="Create a campaign, choose leads with email addresses, and prepare a safe outreach sequence." /></div> :
      <div className="space-y-3">{campaigns.map(campaign => {
        const expanded = expandedId === campaign.id;
        return <div className="card p-5" key={campaign.id}>
          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
            <div className="flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="text-white font-semibold">{campaign.name}</h2><span className={`badge capitalize ${statusStyle(campaign.status)}`}>{campaign.status}</span><span className="badge bg-slate-800 text-slate-300 capitalize">{campaign.mode}</span></div><p className="text-slate-500 text-xs mt-2">{campaign.lead_count ?? 0} leads · {campaign.sent_count ?? 0} sent · max {campaign.daily_limit}/day · {campaign.language}</p></div>
            <div className="flex flex-wrap items-center gap-2">
              {campaign.status === 'active' ? <button onClick={() => void setCampaignStatus(campaign.id, 'paused')} className="btn-secondary text-sm flex items-center gap-1.5"><Pause className="w-4 h-4" /> Pause</button> : campaign.status !== 'completed' && <button onClick={() => void setCampaignStatus(campaign.id, 'active')} className="btn-secondary text-sm flex items-center gap-1.5"><Play className="w-4 h-4" /> Activate</button>}
              <button onClick={() => setExpandedId(expanded ? null : campaign.id)} className="btn-secondary text-sm flex items-center gap-1.5">Details {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</button>
            </div>
          </div>
          {expanded && <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-5 pt-5 border-t border-slate-800 text-sm">
            <div className="bg-slate-900 rounded-lg p-3"><p className="text-slate-500 text-xs">Sequence</p><p className="text-slate-200 mt-1">Day 0, 3 and 7</p></div>
            <div className="bg-slate-900 rounded-lg p-3"><p className="text-slate-500 text-xs">Send window</p><p className="text-slate-200 mt-1">{campaign.send_window_start.slice(0, 5)}–{campaign.send_window_end.slice(0, 5)}</p></div>
            <div className="bg-slate-900 rounded-lg p-3"><p className="text-slate-500 text-xs">Tone</p><p className="text-slate-200 mt-1">{campaign.tone}</p></div>
            <div className="bg-slate-900 rounded-lg p-3"><p className="text-slate-500 text-xs">Sending</p><p className="text-slate-200 mt-1">{campaign.mode === 'review' ? 'Approval required' : 'Autopilot after activation'}</p></div>
          </div>}
        </div>;
      })}</div>}

    {showCreate && <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onMouseDown={event => { if (event.target === event.currentTarget) resetForm(); }}>
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-slate-950 border border-slate-700 shadow-2xl">
        <div className="sticky top-0 bg-slate-950 border-b border-slate-800 px-6 py-4 flex items-center justify-between z-10"><div><h2 className="text-white font-semibold text-lg">Create campaign</h2><p className="text-slate-500 text-xs mt-1">Campaign will be saved as Draft.</p></div><button onClick={resetForm} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button></div>
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><label className="sm:col-span-2 text-sm text-slate-300">Campaign name<input value={name} onChange={event => setName(event.target.value)} maxLength={120} className="input mt-2" placeholder="e.g. New York Medspas – September" /></label><label className="text-sm text-slate-300">Language<select value={language} onChange={event => setLanguage(event.target.value)} className="input mt-2"><option>English</option><option>Albanian</option><option>German</option></select></label><label className="text-sm text-slate-300">Tone<select value={tone} onChange={event => setTone(event.target.value)} className="input mt-2"><option>Professional</option><option>Friendly</option><option>Direct</option></select></label><label className="text-sm text-slate-300">Daily limit<input type="number" min={1} max={100} value={dailyLimit} onChange={event => setDailyLimit(Math.min(100, Math.max(1, Number(event.target.value))))} className="input mt-2" /></label><label className="text-sm text-slate-300">Mode<select value={mode} onChange={event => setMode(event.target.value as OutreachCampaignMode)} className="input mt-2"><option value="review">Review before sending</option><option value="autopilot">Autopilot</option></select></label></div>
          {mode === 'autopilot' && <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 flex gap-2"><AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" /><p className="text-amber-200/80 text-xs">Autopilot will only run after the campaign is activated and SMTP is configured. Start with a small daily limit.</p></div>}
          <div><div className="flex items-end justify-between gap-3 mb-3"><div><p className="text-slate-200 text-sm font-medium">Select leads</p><p className="text-slate-500 text-xs mt-1">Only leads with an email address are shown.</p></div><button onClick={() => setSelectedLeadIds(selectedLeadIds.size === filteredLeads.length ? new Set() : new Set(filteredLeads.map(lead => lead.id)))} className="text-blue-400 hover:text-blue-300 text-xs">{selectedLeadIds.size === filteredLeads.length && filteredLeads.length ? 'Clear visible' : 'Select visible'}</button></div>
            <label className="relative block mb-3"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" /><input value={search} onChange={event => setSearch(event.target.value)} className="input pl-9" placeholder="Search business, email, location..." /></label>
            <div className="border border-slate-800 rounded-xl max-h-72 overflow-y-auto divide-y divide-slate-800">{filteredLeads.length === 0 ? <p className="p-5 text-sm text-slate-500 text-center">No leads with email addresses found.</p> : filteredLeads.map(lead => <button key={lead.id} onClick={() => toggleLead(lead.id)} className="w-full flex items-center gap-3 p-3 text-left hover:bg-slate-900 transition-colors"><span className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 ${selectedLeadIds.has(lead.id) ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-600'}`}>{selectedLeadIds.has(lead.id) && <Check className="w-3.5 h-3.5" />}</span><div className="min-w-0 flex-1"><p className="text-slate-200 text-sm truncate">{lead.business_name}</p><p className="text-slate-500 text-xs truncate">{lead.email} · {lead.location}</p></div><span className="text-slate-500 text-xs">Score {lead.lead_score}</span></button>)}</div>
          </div>
          <div className="rounded-lg bg-slate-900 p-4 flex items-center gap-3"><Mail className="w-5 h-5 text-violet-400" /><div><p className="text-slate-200 text-sm">Default sequence: 3 emails</p><p className="text-slate-500 text-xs mt-1">Initial email, follow-up after 3 days, final follow-up after 7 days.</p></div></div>
        </div>
        <div className="sticky bottom-0 bg-slate-950 border-t border-slate-800 px-6 py-4 flex items-center justify-between gap-3"><p className="text-slate-500 text-xs">{selectedLeadIds.size} lead{selectedLeadIds.size === 1 ? '' : 's'} selected</p><div className="flex gap-2"><button onClick={resetForm} className="btn-secondary">Cancel</button><button disabled={saving || !name.trim() || selectedLeadIds.size === 0} onClick={() => void createCampaign()} className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed">{saving ? 'Creating...' : 'Create draft'}</button></div></div>
      </div>
    </div>}
  </div>;
}
