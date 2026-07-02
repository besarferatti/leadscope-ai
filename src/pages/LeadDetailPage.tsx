import { useEffect, useState } from 'react';
import {
  ArrowLeft, Globe, Phone, Mail, MapPin, Star, ExternalLink,
  Zap, MessageSquare, Loader2, ChevronDown, ChevronUp, Copy, Check,
  BarChart3, Shield, Megaphone, Lightbulb, AlertCircle,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Lead, LeadAudit, OutreachMessage, LeadStatus } from '../types';
import { StatusBadge } from '../components/ui/StatusBadge';
import { ScoreBadge } from '../components/ui/ScoreBadge';
import { ErrorAlert } from '../components/ui/ErrorAlert';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { UpgradeModal } from '../components/ui/UpgradeModal';
import { LEAD_STATUSES, LANGUAGES, TONES, formatDate, getScoreColor, getScoreBg } from '../lib/utils';
import { canRunAudit, canGenerateMessage, isAdmin } from '../lib/plans';

interface Props {
  leadId: string;
  onBack: () => void;
  onNavigate?: (page: string, params?: Record<string, string>) => void;
}

export function LeadDetailPage({ leadId, onBack, onNavigate }: Props) {
  const { profile, refreshProfile } = useAuth();
  const [lead, setLead] = useState<Lead | null>(null);
  const [audit, setAudit] = useState<LeadAudit | null>(null);
  const [messages, setMessages] = useState<OutreachMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [auditLoading, setAuditLoading] = useState(false);
  const [msgLoading, setMsgLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [msgExpanded, setMsgExpanded] = useState<string | null>(null);
  const [upgradeMsg, setUpgradeMsg] = useState('');

  // Outreach form
  const [msgChannel, setMsgChannel] = useState<'email' | 'dm'>('email');
  const [msgLanguage, setMsgLanguage] = useState('English');
  const [msgTone, setMsgTone] = useState('Professional');

  useEffect(() => {
    loadAll();
  }, [leadId]);

  async function loadAll() {
    setLoading(true);
    const [leadRes, auditRes, msgsRes] = await Promise.all([
      supabase.from('leads').select('*').eq('id', leadId).maybeSingle(),
      supabase.from('lead_audits').select('*').eq('lead_id', leadId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('outreach_messages').select('*').eq('lead_id', leadId).order('created_at', { ascending: false }),
    ]);
    if (leadRes.error) setError(leadRes.error.message);
    else setLead(leadRes.data);
    setAudit(auditRes.data ?? null);
    setMessages(msgsRes.data ?? []);
    setLoading(false);
  }

  async function handleAnalyze() {
    if (!lead) return;

    // Limit check
    if (!isAdmin(profile)) {
      const check = canRunAudit(profile);
      if (!check.allowed) {
        setUpgradeMsg(check.message ?? '');
        return;
      }
    }

    setAuditLoading(true);
    setError('');

    try {
      const { data, error: functionError } = await supabase.functions.invoke('analyze-lead', {
        body: { lead_id: leadId },
      });

      if (functionError) throw new Error(functionError.message);
      if ((data as { error?: string } | null)?.error) throw new Error((data as { error: string }).error);

      await refreshProfile();
      await loadAll();
    } catch (e: unknown) {
      setError((e as Error).message ?? 'Failed to analyze website.');
    }
    setAuditLoading(false);
  }

  async function handleGenerateMessage() {
    if (!lead) return;

    // Limit check
    if (!isAdmin(profile)) {
      const check = canGenerateMessage(profile);
      if (!check.allowed) {
        setUpgradeMsg(check.message ?? '');
        return;
      }
    }

    setMsgLoading(true);
    setError('');

    try {
      const { data, error: functionError } = await supabase.functions.invoke('generate-outreach', {
        body: {
          lead_id: leadId,
          channel: msgChannel,
          language: msgLanguage,
          tone: msgTone,
        },
      });

      if (functionError) throw new Error(functionError.message);
      if ((data as { error?: string } | null)?.error) throw new Error((data as { error: string }).error);

      await refreshProfile();
      await loadAll();
      setMsgExpanded('new');
    } catch (e: unknown) {
      setError((e as Error).message ?? 'Failed to generate message.');
    }
    setMsgLoading(false);
  }

  async function updateStatus(status: LeadStatus) {
    if (!lead) return;
    const { error } = await supabase.from('leads').update({ status }).eq('id', leadId);
    if (error) setError(error.message);
    else setLead(prev => prev ? { ...prev, status } : prev);
  }

  async function copyText(text: string, key: string) {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  if (loading) return <LoadingSpinner message="Loading lead..." />;
  if (!lead) return (
    <div className="text-center py-16">
      <p className="text-slate-400">Lead not found.</p>
      <button onClick={onBack} className="btn-secondary mt-4">Go Back</button>
    </div>
  );

  return (
    <div className="space-y-6 max-w-5xl">
      {upgradeMsg && (
        <UpgradeModal
          message={upgradeMsg}
          onViewPlans={() => { setUpgradeMsg(''); onNavigate?.('settings', { tab: 'billing' }); }}
          onClose={() => setUpgradeMsg('')}
        />
      )}
      {/* Back + header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-slate-400 hover:text-slate-200 text-sm mb-3 transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            Back to Leads
          </button>
          <h1 className="text-2xl font-bold text-white">{lead.business_name}</h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {lead.industry && <span className="text-slate-400 text-sm">{lead.industry}</span>}
            {lead.location && (
              <>
                <span className="text-slate-700">·</span>
                <div className="flex items-center gap-1 text-slate-400 text-sm">
                  <MapPin className="w-3.5 h-3.5" />
                  {lead.location}
                </div>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <ScoreBadge score={lead.lead_score} size="lg" />
          <div>
            <p className="text-slate-500 text-xs mb-1">Status</p>
            <select
              value={lead.status}
              onChange={e => updateStatus(e.target.value as LeadStatus)}
              className="select text-xs py-1.5"
            >
              {LEAD_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      </div>

      {error && <ErrorAlert message={error} onClose={() => setError('')} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-1 space-y-4">
          {/* Contact info */}
          <div className="card p-5">
            <h2 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">Contact Info</h2>
            <div className="space-y-3">
              {lead.website && (
                <div className="flex items-start gap-3">
                  <Globe className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
                  <a href={lead.website} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 text-sm break-all flex items-center gap-1 transition-colors">
                    {lead.website.replace(/^https?:\/\//, '')}
                    <ExternalLink className="w-3 h-3 flex-shrink-0" />
                  </a>
                </div>
              )}
              {lead.phone && (
                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-slate-500 flex-shrink-0" />
                  <span className="text-slate-300 text-sm">{lead.phone}</span>
                </div>
              )}
              {lead.email && (
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-slate-500 flex-shrink-0" />
                  <span className="text-slate-300 text-sm break-all">{lead.email}</span>
                </div>
              )}
              {lead.address && (
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
                  <span className="text-slate-300 text-sm">{lead.address}</span>
                </div>
              )}
              {lead.google_rating && (
                <div className="flex items-center gap-3">
                  <Star className="w-4 h-4 text-amber-400 flex-shrink-0 fill-amber-400" />
                  <span className="text-slate-300 text-sm">{lead.google_rating} ({lead.reviews_count} reviews)</span>
                </div>
              )}
              {lead.google_maps_url && (
                <a href={lead.google_maps_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm transition-colors">
                  <ExternalLink className="w-3.5 h-3.5" />
                  View on Google Maps
                </a>
              )}
              {!lead.website && !lead.phone && !lead.email && (
                <p className="text-slate-600 text-sm">No contact info added.</p>
              )}
            </div>
          </div>

          {/* Meta */}
          <div className="card p-5">
            <h2 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">Details</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Added</span>
                <span className="text-slate-300">{formatDate(lead.created_at)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Status</span>
                <StatusBadge status={lead.status} />
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Lead Score</span>
                <span className={`font-bold ${getScoreColor(lead.lead_score)}`}>{lead.lead_score}/100</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Audit section */}
          <div className="card">
            <div className="flex items-center justify-between p-5 border-b border-slate-800">
              <div>
                <h2 className="text-white font-semibold">Website Audit</h2>
                <p className="text-slate-500 text-xs mt-0.5">AI-generated analysis of this business's online presence</p>
              </div>
              <button
                onClick={handleAnalyze}
                disabled={auditLoading}
                className="btn-primary text-xs py-2"
              >
                {auditLoading ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Analyzing...</>
                ) : (
                  <><Zap className="w-3.5 h-3.5" /> {audit ? 'Re-analyze' : 'Analyze Website'}</>
                )}
              </button>
            </div>

            {audit ? (
              <div className="p-5 space-y-5">
                {/* Score bars */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[
                    { label: 'Website', score: audit.website_score, icon: Globe },
                    { label: 'SEO', score: audit.seo_score, icon: BarChart3 },
                    { label: 'Conversion', score: audit.conversion_score, icon: Megaphone },
                  ].map(item => (
                    <div key={item.label} className="bg-slate-800/50 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <item.icon className="w-4 h-4 text-slate-400" />
                        <span className="text-slate-400 text-xs font-medium uppercase tracking-wider">{item.label}</span>
                      </div>
                      <div className="flex items-end gap-2 mb-2">
                        <span className={`text-3xl font-black ${getScoreColor(item.score)}`}>{item.score}</span>
                        <span className="text-slate-600 text-sm mb-1">/100</span>
                      </div>
                      <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${getScoreBg(item.score)} rounded-full`}
                          style={{ width: `${item.score}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Issues */}
                {audit.main_issues.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <AlertCircle className="w-4 h-4 text-amber-400" />
                      <h3 className="text-white font-medium text-sm">Main Issues</h3>
                    </div>
                    <ul className="space-y-2">
                      {audit.main_issues.map((issue, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-sm text-slate-300">
                          <span className="w-5 h-5 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center text-xs flex-shrink-0 mt-0.5 font-medium">
                            {i + 1}
                          </span>
                          {issue}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Offer */}
                {audit.recommended_offer && (
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Shield className="w-4 h-4 text-blue-400" />
                      <h3 className="text-blue-300 font-medium text-sm">Recommended Offer</h3>
                    </div>
                    <p className="text-slate-300 text-sm">{audit.recommended_offer}</p>
                  </div>
                )}

                {/* Personalization angle */}
                {audit.personalization_angle && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Lightbulb className="w-4 h-4 text-emerald-400" />
                      <h3 className="text-emerald-300 font-medium text-sm">Personalization Angle</h3>
                    </div>
                    <p className="text-slate-300 text-sm">{audit.personalization_angle}</p>
                  </div>
                )}

                {/* Summary */}
                {audit.summary && (
                  <div>
                    <h3 className="text-white font-medium text-sm mb-2">Summary</h3>
                    <p className="text-slate-400 text-sm leading-relaxed">{audit.summary}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-8 text-center">
                <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center mx-auto mb-3">
                  <Zap className="w-6 h-6 text-slate-500" />
                </div>
                <p className="text-slate-400 text-sm mb-1">No audit yet</p>
                <p className="text-slate-600 text-xs">Click "Analyze Website" to generate an AI audit with lead score, issues, and recommended offer.</p>
              </div>
            )}
          </div>

          {/* Outreach messages */}
          <div className="card">
            <div className="p-5 border-b border-slate-800">
              <h2 className="text-white font-semibold mb-4">Outreach Messages</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-slate-400 text-xs mb-1">Channel</label>
                  <select className="select text-xs py-1.5" value={msgChannel} onChange={e => setMsgChannel(e.target.value as 'email' | 'dm')}>
                    <option value="email">Email</option>
                    <option value="dm">DM</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-1">Language</label>
                  <select className="select text-xs py-1.5" value={msgLanguage} onChange={e => setMsgLanguage(e.target.value)}>
                    {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-1">Tone</label>
                  <select className="select text-xs py-1.5" value={msgTone} onChange={e => setMsgTone(e.target.value)}>
                    {TONES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    onClick={handleGenerateMessage}
                    disabled={msgLoading}
                    className="btn-primary text-xs py-1.5 w-full"
                  >
                    {msgLoading ? (
                      <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating...</>
                    ) : (
                      <><MessageSquare className="w-3.5 h-3.5" /> Generate</>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {messages.length === 0 ? (
              <div className="p-8 text-center">
                <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center mx-auto mb-3">
                  <MessageSquare className="w-6 h-6 text-slate-500" />
                </div>
                <p className="text-slate-400 text-sm">No messages generated yet</p>
                <p className="text-slate-600 text-xs mt-1">Configure options above and click Generate.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800">
                {messages.map((msg, i) => {
                  const isExpanded = msgExpanded === msg.id || (msgExpanded === 'new' && i === 0);
                  return (
                    <div key={msg.id} className="p-5">
                      <div
                        className="flex items-center justify-between cursor-pointer"
                        onClick={() => setMsgExpanded(isExpanded ? null : msg.id)}
                      >
                        <div className="flex items-center gap-3">
                          <span className="badge bg-slate-700 text-slate-300 capitalize">{msg.channel}</span>
                          <span className="badge bg-slate-700 text-slate-400">{msg.language}</span>
                          <span className="badge bg-slate-700 text-slate-400">{msg.tone}</span>
                          <span className="text-slate-600 text-xs">{formatDate(msg.created_at)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={e => { e.stopPropagation(); copyText(msg.channel === 'email' ? `Subject: ${msg.subject}\n\n${msg.body}` : msg.body, msg.id); }}
                            className="text-slate-500 hover:text-slate-300 transition-colors"
                            title="Copy message"
                          >
                            {copied === msg.id ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                          </button>
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="mt-4 space-y-3">
                          {msg.channel === 'email' && msg.subject && (
                            <div className="bg-slate-800/60 rounded-lg p-3">
                              <span className="text-slate-500 text-xs font-medium uppercase">Subject</span>
                              <p className="text-slate-200 text-sm mt-1 font-medium">{msg.subject}</p>
                            </div>
                          )}
                          <div className="bg-slate-800/60 rounded-lg p-3">
                            <span className="text-slate-500 text-xs font-medium uppercase">Body</span>
                            <pre className="text-slate-300 text-sm mt-1 whitespace-pre-wrap font-sans leading-relaxed">{msg.body}</pre>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
