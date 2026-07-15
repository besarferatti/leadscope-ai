import { useEffect, useState } from 'react';
import {
  ArrowLeft, Globe, Phone, Mail, MapPin, Star, ExternalLink,
  Zap, MessageSquare, Loader2, ChevronDown, ChevronUp, Copy, Check,
  BarChart3, Shield, Megaphone, Lightbulb, AlertCircle, Search, FileText, DollarSign, Link2, Monitor, Bookmark, BookmarkCheck,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Lead, LeadAudit, OutreachMessage, LeadStatus, WebsitePreview } from '../types';
import { StatusBadge } from '../components/ui/StatusBadge';
import { ScoreBadge } from '../components/ui/ScoreBadge';
import { ErrorAlert } from '../components/ui/ErrorAlert';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { UpgradeModal } from '../components/ui/UpgradeModal';
import { LEAD_STATUSES, LANGUAGES, TONES, formatDate, getScoreColor, getScoreBg } from '../lib/utils';
import { canRunAudit, canGenerateMessage, isAdmin } from '../lib/plans';
import { trackEvent } from '../lib/analytics';

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
  const [shareLoading, setShareLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [websitePreviewToken, setWebsitePreviewToken] = useState<string | null>(null);
  const [websitePreviewCreatedAt, setWebsitePreviewCreatedAt] = useState<string | null>(null);
  const [msgLoading, setMsgLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [msgExpanded, setMsgExpanded] = useState<string | null>(null);
  const [upgradeMsg, setUpgradeMsg] = useState('');
  const seoPack = audit?.seo_content_pack;

  // Outreach form
  const [msgChannel, setMsgChannel] = useState<'email' | 'dm'>('email');
  const [msgLanguage, setMsgLanguage] = useState('English');
  const [msgTone, setMsgTone] = useState('Professional');

  useEffect(() => {
    loadAll();
  }, [leadId]);

  async function loadAll() {
    setLoading(true);
    const [leadRes, auditRes, msgsRes, previewRes] = await Promise.all([
      supabase.from('leads').select('*').eq('id', leadId).maybeSingle(),
      supabase.from('lead_audits').select('*').eq('lead_id', leadId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('outreach_messages').select('*').eq('lead_id', leadId).order('created_at', { ascending: false }),
      supabase
        .from('website_previews')
        .select('preview_token, created_at')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    if (leadRes.error) setError(leadRes.error.message);
    else setLead(leadRes.data);
    setAudit(auditRes.data ?? null);
    setMessages(msgsRes.data ?? []);
    const latestPreview = previewRes.data as WebsitePreview | null;
    setWebsitePreviewToken(latestPreview?.preview_token ?? null);
    setWebsitePreviewCreatedAt(latestPreview?.created_at ?? null);
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

      trackEvent('website_audit_generated', { lead_id: leadId });
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

      trackEvent('outreach_message_generated', { lead_id: leadId, channel: msgChannel, language: msgLanguage, tone: msgTone });
      await refreshProfile();
      await loadAll();
      setMsgExpanded('new');
    } catch (e: unknown) {
      setError((e as Error).message ?? 'Failed to generate message.');
    }
    setMsgLoading(false);
  }


  function getWebsitePreviewLink(token = websitePreviewToken) {
    return token ? `${window.location.origin}/preview/${token}` : '';
  }

  async function handleCopyWebsitePreviewLink() {
    if (!websitePreviewToken) {
      await handleGenerateWebsitePreview();
      return;
    }

    await copyText(getWebsitePreviewLink(), 'website-preview-link');
  }

  function handleOpenWebsitePreview() {
    const previewLink = getWebsitePreviewLink();
    if (previewLink) window.open(previewLink, '_blank', 'noopener,noreferrer');
  }

  async function handleGenerateWebsitePreview() {
    if (!lead) return;
    setPreviewLoading(true);
    setError('');

    try {
      const { data, error: functionError } = await supabase.functions.invoke('generate-website-preview', {
        body: { lead_id: leadId },
      });

      if (functionError) throw new Error(functionError.message);
      if ((data as { error?: string } | null)?.error) throw new Error((data as { error: string }).error);

      const preview = (data as { preview?: { preview_token?: string; created_at?: string } } | null)?.preview;
      const token = preview?.preview_token;
      if (!token) throw new Error('Website preview was created but no preview token was returned.');

      setWebsitePreviewToken(token);
      setWebsitePreviewCreatedAt(preview?.created_at ?? new Date().toISOString());
      await copyText(getWebsitePreviewLink(token), 'website-preview-link');
      trackEvent('website_preview_generated', { lead_id: leadId });
    } catch (e: unknown) {
      setError((e as Error).message ?? 'Failed to generate website preview.');
    }

    setPreviewLoading(false);
  }


  function createShareToken() {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  async function handleShareAudit(language: 'en' | 'sq' | 'mk') {
    if (!audit) return;
    setShareLoading(true);
    setError('');

    try {
      let token = audit.share_token;

      if (!token) {
        token = createShareToken();
        const sharedAt = new Date().toISOString();
        const { data, error: updateError } = await supabase
          .from('lead_audits')
          .update({ share_token: token, shared_at: sharedAt })
          .eq('id', audit.id)
          .select('*')
          .single();

        if (updateError) throw new Error(updateError.message);
        setAudit(data as LeadAudit);
      }

      await copyText(`${window.location.origin}/audit/share/${token}?lang=${language}`, `audit-share-link-${language}`);
    } catch (e: unknown) {
      setError((e as Error).message ?? 'Failed to create share link.');
    }

    setShareLoading(false);
  }

  async function handleToggleSaved() {
    if (!lead) return;
    const savedAt = lead.saved_at ? null : new Date().toISOString();
    const { error } = await supabase.from('leads').update({ saved_at: savedAt }).eq('id', leadId);
    if (error) setError(error.message);
    else setLead(prev => prev ? { ...prev, saved_at: savedAt } : prev);
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
          <button
            onClick={handleToggleSaved}
            className={lead.saved_at ? 'btn-secondary text-xs py-2 text-blue-200' : 'btn-secondary text-xs py-2'}
            title={lead.saved_at ? 'Remove from Saved' : 'Save Lead'}
          >
            {lead.saved_at ? <BookmarkCheck className="w-3.5 h-3.5" /> : <Bookmark className="w-3.5 h-3.5" />}
            {lead.saved_at ? 'Saved' : 'Save Lead'}
          </button>
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
                <span className="text-slate-500">Saved</span>
                <span className={lead.saved_at ? 'text-blue-300' : 'text-slate-500'}>{lead.saved_at ? formatDate(lead.saved_at) : 'No'}</span>
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
              <div className="flex items-center gap-2 flex-wrap justify-end">
                {audit && (
                  <>

                    <button
                      onClick={handleCopyWebsitePreviewLink}
                      disabled={previewLoading}
                      className="btn-secondary text-xs py-2"
                      title={websitePreviewCreatedAt ? `Latest preview created ${formatDate(websitePreviewCreatedAt)}` : undefined}
                    >
                      {previewLoading ? (
                        <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Creating...</>
                      ) : copied === 'website-preview-link' ? (
                        <><Check className="w-3.5 h-3.5 text-emerald-400" /> Preview link copied</>
                      ) : websitePreviewToken ? (
                        <><Copy className="w-3.5 h-3.5" /> Copy Website Preview Link</>
                      ) : (
                        <><Monitor className="w-3.5 h-3.5" /> Create Website Preview</>
                      )}
                    </button>
                    {websitePreviewToken && (
                      <>
                        <button
                          onClick={handleOpenWebsitePreview}
                          className="btn-secondary text-xs py-2"
                        >
                          <ExternalLink className="w-3.5 h-3.5" /> Open Preview
                        </button>
                        <button
                          onClick={handleGenerateWebsitePreview}
                          disabled={previewLoading}
                          className="btn-secondary text-xs py-2"
                        >
                          {previewLoading ? (
                            <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Regenerating...</>
                          ) : (
                            <><Monitor className="w-3.5 h-3.5" /> Regenerate Preview</>
                          )}
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => handleShareAudit('en')}
                      disabled={shareLoading}
                      className="btn-secondary text-xs py-2"
                    >
                      {shareLoading ? (
                        <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Creating...</>
                      ) : copied === 'audit-share-link-en' ? (
                        <><Check className="w-3.5 h-3.5 text-emerald-400" /> English copied</>
                      ) : (
                        <><Link2 className="w-3.5 h-3.5" /> {audit.share_token ? 'Copy English Link' : 'Create English Link'}</>
                      )}
                    </button>
                    <button
                      onClick={() => handleShareAudit('sq')}
                      disabled={shareLoading}
                      className="btn-secondary text-xs py-2"
                    >
                      {shareLoading ? (
                        <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Creating...</>
                      ) : copied === 'audit-share-link-sq' ? (
                        <><Check className="w-3.5 h-3.5 text-emerald-400" /> Albanian copied</>
                      ) : (
                        <><Link2 className="w-3.5 h-3.5" /> {audit.share_token ? 'Copy Albanian Link' : 'Create Albanian Link'}</>
                      )}
                    </button>
                    <button
                      onClick={() => handleShareAudit('mk')}
                      disabled={shareLoading}
                      className="btn-secondary text-xs py-2"
                    >
                      {shareLoading ? (
                        <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Creating...</>
                      ) : copied === 'audit-share-link-mk' ? (
                        <><Check className="w-3.5 h-3.5 text-emerald-400" /> Macedonian copied</>
                      ) : (
                        <><Link2 className="w-3.5 h-3.5" /> {audit.share_token ? 'Copy Macedonian Link' : 'Create Macedonian Link'}</>
                      )}
                    </button>
                  </>
                )}
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

                {/* SEO & Content Opportunities */}
                {seoPack && (
                  <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4 space-y-4">
                    <div className="flex items-center gap-2">
                      <Search className="w-4 h-4 text-purple-300" />
                      <h3 className="text-purple-200 font-medium text-sm">SEO & Content Opportunities</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {([
                        ['Primary', seoPack.suggested_keywords?.primary],
                        ['Local', seoPack.suggested_keywords?.local],
                        ['Service', seoPack.suggested_keywords?.service],
                        ['Long-tail', seoPack.suggested_keywords?.long_tail],
                      ] as const).map(([label, keywords]) => (
                        <div key={label} className="bg-slate-900/40 rounded-lg p-3">
                          <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-2">{label} keywords</p>
                          <div className="flex flex-wrap gap-1.5">
                            {(keywords ?? []).map(keyword => (
                              <span key={keyword} className="px-2 py-1 rounded-md bg-purple-500/10 text-purple-100 text-xs border border-purple-500/20">
                                {keyword}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="bg-slate-900/40 rounded-lg p-3">
                        <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">Meta title</p>
                        <p className="text-slate-200 text-sm">{seoPack.meta_title}</p>
                      </div>
                      <div className="bg-slate-900/40 rounded-lg p-3">
                        <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">Meta description</p>
                        <p className="text-slate-200 text-sm">{seoPack.meta_description}</p>
                      </div>
                      <div className="bg-slate-900/40 rounded-lg p-3">
                        <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">H1 suggestion</p>
                        <p className="text-slate-200 text-sm">{seoPack.h1_suggestion}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {([
                        ['Service pages', seoPack.service_page_ideas],
                        ['Blog posts', seoPack.blog_post_ideas],
                        ['Google Business posts', seoPack.google_business_posts],
                      ] as const).map(([label, ideas]) => (
                        <div key={label} className="bg-slate-900/40 rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <FileText className="w-3.5 h-3.5 text-purple-300" />
                            <p className="text-slate-300 text-xs font-medium uppercase tracking-wider">{label}</p>
                          </div>
                          <ul className="space-y-1.5">
                            {(ideas ?? []).map(idea => <li key={idea} className="text-slate-300 text-sm">• {idea}</li>)}
                          </ul>
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="bg-slate-900/40 rounded-lg p-3">
                        <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-2">Homepage copy</p>
                        <p className="text-white text-sm font-semibold">{seoPack.homepage_copy?.headline}</p>
                        <p className="text-slate-300 text-sm mt-1">{seoPack.homepage_copy?.subheadline}</p>
                        <p className="text-purple-200 text-sm mt-2">CTA: {seoPack.homepage_copy?.cta}</p>
                      </div>
                      <div className="bg-slate-900/40 rounded-lg p-3">
                        <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-2">Recommended service</p>
                        <p className="text-white text-sm font-semibold">{seoPack.recommended_service?.service_name}</p>
                        <p className="text-slate-300 text-sm mt-1">{seoPack.recommended_service?.why_sell_this}</p>
                        <ul className="mt-2 space-y-1">
                          {(seoPack.recommended_service?.deliverables ?? []).map(item => <li key={item} className="text-slate-300 text-sm">• {item}</li>)}
                        </ul>
                      </div>
                    </div>

                    <div className="bg-slate-900/40 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <DollarSign className="w-3.5 h-3.5 text-purple-300" />
                        <p className="text-slate-300 text-xs font-medium uppercase tracking-wider">Suggested pricing</p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-sm">
                        <p><span className="text-slate-500">Market:</span> <span className="text-slate-200">{seoPack.suggested_pricing?.market_detected}</span></p>
                        <p><span className="text-slate-500">Setup:</span> <span className="text-slate-200">{seoPack.suggested_pricing?.one_time_setup}</span></p>
                        <p><span className="text-slate-500">Retainer:</span> <span className="text-slate-200">{seoPack.suggested_pricing?.monthly_retainer}</span></p>
                        <p><span className="text-slate-500">Currency:</span> <span className="text-slate-200">{seoPack.suggested_pricing?.currency}</span></p>
                      </div>
                      <p className="text-slate-400 text-xs mt-2">{seoPack.suggested_pricing?.pricing_reason}</p>
                    </div>
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
