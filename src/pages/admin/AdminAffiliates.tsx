import { useEffect, useMemo, useState } from 'react';
import type { ElementType } from 'react';
import { CheckCircle, Clock, Copy, ExternalLink, Loader2, RefreshCw, Users, XCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorAlert } from '../../components/ui/ErrorAlert';
import { formatDate } from '../../lib/utils';

type AffiliateStatus = 'pending' | 'approved' | 'rejected';
type CommissionType = 'recurring' | 'first_payment_only';

interface AffiliateApplication {
  id: string;
  full_name: string;
  email: string;
  company_name: string | null;
  website_or_social: string | null;
  audience_type: string | null;
  audience_size: string | null;
  promotion_plan: string | null;
  preferred_payout_method: string | null;
  message: string | null;
  status: AffiliateStatus;
  commission_type: CommissionType;
  commission_rate: number;
  commission_duration_months: number;
  admin_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  referral_code: string | null;
  referral_clicks: number;
}

type ReferralStatus = 'signup' | 'paid' | 'cancelled';

interface AffiliateReferral {
  id: string;
  affiliate_application_id: string;
  referral_code: string;
  referred_email: string;
  referred_full_name: string | null;
  status: ReferralStatus;
  created_at: string;
}

export function AdminAffiliates() {
  const [applications, setApplications] = useState<AffiliateApplication[]>([]);
  const [referrals, setReferrals] = useState<Record<string, AffiliateReferral[]>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => { load(); }, []);

  const counts = useMemo(() => ({
    pending: applications.filter(app => app.status === 'pending').length,
    approved: applications.filter(app => app.status === 'approved').length,
    rejected: applications.filter(app => app.status === 'rejected').length,
  }), [applications]);

  async function load() {
    setLoading(true);
    const { data, error: err } = await supabase
      .from('affiliate_applications')
      .select('*')
      .order('created_at', { ascending: false });

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    const apps = (data ?? []) as AffiliateApplication[];
    setApplications(apps);
    await loadReferrals(apps.map(app => app.id));
    setLoading(false);
  }

  async function loadReferrals(applicationIds: string[]) {
    if (applicationIds.length === 0) {
      setReferrals({});
      return;
    }

    const { data, error: err } = await supabase
      .from('affiliate_referrals')
      .select('id, affiliate_application_id, referral_code, referred_email, referred_full_name, status, created_at')
      .in('affiliate_application_id', applicationIds)
      .order('created_at', { ascending: false });

    if (err) {
      setError(err.message);
      return;
    }

    const grouped = ((data ?? []) as AffiliateReferral[]).reduce<Record<string, AffiliateReferral[]>>((acc, referral) => {
      acc[referral.affiliate_application_id] = [...(acc[referral.affiliate_application_id] ?? []), referral];
      return acc;
    }, {});
    setReferrals(grouped);
  }

  function showSuccess(message: string) {
    setSuccess(message);
    setTimeout(() => setSuccess(''), 3000);
  }

  function updateLocal(id: string, updates: Partial<AffiliateApplication>) {
    setApplications(prev => prev.map(app => app.id === id ? { ...app, ...updates } : app));
  }

  async function saveApplication(app: AffiliateApplication, updates: Partial<AffiliateApplication>, message = 'Affiliate application updated.') {
    setSavingId(app.id);
    setError('');
    const { error: err } = await supabase
      .from('affiliate_applications')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', app.id);

    if (err) {
      setError(err.message);
    } else {
      updateLocal(app.id, updates);
      showSuccess(message);
    }
    setSavingId(null);
  }

  async function setStatus(app: AffiliateApplication, status: AffiliateStatus) {
    const referralCode = status === 'approved'
      ? normalizeReferralCode(app.referral_code) || generateReferralCode(app)
      : app.referral_code;

    await saveApplication(app, {
      ...editableFields(app),
      referral_code: referralCode,
      status,
      reviewed_at: new Date().toISOString(),
    }, status === 'approved' ? 'Affiliate approved.' : 'Affiliate rejected.');
  }

  async function saveReferralStatus(referral: AffiliateReferral, status: ReferralStatus) {
    setSavingId(referral.id);
    setError('');

    const { error: err } = await supabase
      .from('affiliate_referrals')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', referral.id);

    if (err) {
      setError(err.message);
    } else {
      setReferrals(prev => ({
        ...prev,
        [referral.affiliate_application_id]: (prev[referral.affiliate_application_id] ?? []).map(item =>
          item.id === referral.id ? { ...item, status } : item
        ),
      }));
      showSuccess('Referral status updated.');
    }

    setSavingId(null);
  }

  async function copyReferralLink(code: string | null) {
    const normalized = normalizeReferralCode(code);
    if (!normalized) return;
    await navigator.clipboard.writeText(referralLink(normalized));
    showSuccess('Referral link copied.');
  }

  if (loading) return <LoadingSpinner message="Loading affiliate applications..." />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Affiliates</h1>
          <p className="text-slate-400 text-sm mt-1">Review applications and manually set affiliate commission terms.</p>
        </div>
        <button onClick={load} className="btn-secondary" disabled={loading}>
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {error && <ErrorAlert message={error} onClose={() => setError('')} />}
      {success && <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">{success}</div>}

      <div className="grid sm:grid-cols-3 gap-4">
        <StatCard label="Pending applications" value={counts.pending} icon={Clock} color="text-amber-400" />
        <StatCard label="Approved affiliates" value={counts.approved} icon={CheckCircle} color="text-emerald-400" />
        <StatCard label="Rejected applications" value={counts.rejected} icon={XCircle} color="text-red-400" />
        <StatCard label="Referral signups" value={Object.values(referrals).reduce((total, items) => total + items.length, 0)} icon={Users} color="text-blue-400" />
      </div>

      <div className="space-y-4">
        {applications.length === 0 ? (
          <div className="card p-8 text-center text-slate-400">No affiliate applications yet.</div>
        ) : applications.map(app => (
          <div key={app.id} className="card p-5 space-y-5">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <h2 className="text-lg font-semibold text-white">{app.full_name}</h2>
                  <StatusBadge status={app.status} />
                </div>
                <div className="text-slate-400 text-sm space-y-1">
                  <p>{app.email}</p>
                  {app.company_name && <p>{app.company_name}</p>}
                  {app.website_or_social && (
                    <a href={app.website_or_social.startsWith('http') ? app.website_or_social : `https://${app.website_or_social}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300">
                      {app.website_or_social} <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
              <div className="text-slate-500 text-xs lg:text-right">
                <p>Applied {formatDate(app.created_at)}</p>
                {app.reviewed_at && <p>Reviewed {formatDate(app.reviewed_at)}</p>}
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <Info label="Audience type" value={app.audience_type} />
              <Info label="Audience size" value={app.audience_size} />
              <Info label="Preferred payout" value={app.preferred_payout_method} />
              <Info label="Message" value={app.message} />
              <div className="md:col-span-2"><Info label="Promotion plan" value={app.promotion_plan} /></div>
            </div>

            <div className="grid md:grid-cols-4 gap-4 pt-4 border-t border-slate-800">
              <label>
                <span className="block text-slate-300 text-sm font-medium mb-1.5">Commission type</span>
                <select className="select" value={app.commission_type} onChange={e => updateLocal(app.id, { commission_type: e.target.value as CommissionType })}>
                  <option value="recurring">Recurring</option>
                  <option value="first_payment_only">First payment only</option>
                </select>
              </label>
              <label>
                <span className="block text-slate-300 text-sm font-medium mb-1.5">Commission rate (%)</span>
                <input className="input" type="number" min="0" step="0.01" value={app.commission_rate} onChange={e => updateLocal(app.id, { commission_rate: Number(e.target.value) })} />
              </label>
              <label>
                <span className="block text-slate-300 text-sm font-medium mb-1.5">Duration (months)</span>
                <input className="input" type="number" min="0" step="1" value={app.commission_duration_months} onChange={e => updateLocal(app.id, { commission_duration_months: Number(e.target.value) })} />
              </label>
              <div className="flex items-end">
                <button onClick={() => saveApplication(app, editableFields(app))} disabled={savingId === app.id} className="btn-secondary w-full">
                  {savingId === app.id ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Save terms
                </button>
              </div>
              <label className="md:col-span-4">
                <span className="block text-slate-300 text-sm font-medium mb-1.5">Admin notes</span>
                <textarea className="input min-h-[90px] resize-y" value={app.admin_notes ?? ''} onChange={e => updateLocal(app.id, { admin_notes: e.target.value })} />
              </label>
            </div>

            {app.status === 'approved' && (
              <div className="space-y-4 pt-4 border-t border-slate-800">
                <div className="grid lg:grid-cols-[1fr_1fr_auto] gap-4 items-end">
                  <label>
                    <span className="block text-slate-300 text-sm font-medium mb-1.5">Referral code</span>
                    <input className="input" value={app.referral_code ?? ''} onChange={e => updateLocal(app.id, { referral_code: normalizeReferralCode(e.target.value) })} placeholder={generateReferralCode(app)} />
                  </label>
                  <div>
                    <span className="block text-slate-300 text-sm font-medium mb-1.5">Referral link</span>
                    <div className="rounded-lg bg-slate-950/60 border border-slate-800 px-3 py-2 text-slate-300 text-sm truncate">
                      {app.referral_code ? referralLink(app.referral_code) : 'Save a referral code to create a link'}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => saveApplication(app, { referral_code: normalizeReferralCode(app.referral_code) || generateReferralCode(app) }, 'Referral code saved.')} disabled={savingId === app.id} className="btn-secondary">
                      Save code
                    </button>
                    <button onClick={() => copyReferralLink(app.referral_code)} disabled={!app.referral_code} className="btn-secondary" title="Copy referral link">
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <Info label="Referral clicks" value={String(app.referral_clicks ?? 0)} />
                  <Info label="Referral signup count" value={String((referrals[app.id] ?? []).length)} />
                </div>

                <div className="rounded-lg bg-slate-950/60 border border-slate-800 overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-800">
                    <p className="text-white font-medium text-sm">Recent referrals</p>
                    <p className="text-slate-500 text-xs">Manual payout tracking only. No automatic Stripe commission tracking.</p>
                  </div>
                  {(referrals[app.id] ?? []).length === 0 ? (
                    <p className="p-4 text-slate-500 text-sm">No referral signups yet.</p>
                  ) : (
                    <div className="divide-y divide-slate-800">
                      {(referrals[app.id] ?? []).slice(0, 10).map(referral => (
                        <div key={referral.id} className="p-4 grid lg:grid-cols-[1fr_1fr_auto] gap-3 items-center text-sm">
                          <div>
                            <p className="text-slate-200">{referral.referred_email}</p>
                            <p className="text-slate-500">{referral.referred_full_name || '—'}</p>
                          </div>
                          <p className="text-slate-400">{formatDate(referral.created_at)}</p>
                          <select className="select" value={referral.status} onChange={e => saveReferralStatus(referral, e.target.value as ReferralStatus)} disabled={savingId === referral.id}>
                            <option value="signup">Signup</option>
                            <option value="paid">Paid</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-end">
              <button onClick={() => setStatus(app, 'rejected')} disabled={savingId === app.id} className="btn-danger">
                <XCircle className="w-4 h-4" /> Reject
              </button>
              <button onClick={() => setStatus(app, 'approved')} disabled={savingId === app.id} className="btn-primary">
                <CheckCircle className="w-4 h-4" /> Approve
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function editableFields(app: AffiliateApplication) {
  return {
    referral_code: normalizeReferralCode(app.referral_code) || null,
    commission_type: app.commission_type,
    commission_rate: app.commission_rate,
    commission_duration_months: app.commission_duration_months,
    admin_notes: app.admin_notes,
  };
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: ElementType; color: string }) {
  return (
    <div className="card p-5 flex items-center gap-4">
      <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center">
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <div>
        <p className="text-2xl font-bold text-white">{value}</p>
        <p className="text-slate-400 text-sm">{label}</p>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-lg bg-slate-950/60 border border-slate-800 p-3">
      <p className="text-slate-500 text-xs mb-1">{label}</p>
      <p className="text-slate-300 whitespace-pre-wrap">{value || '—'}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: AffiliateStatus }) {
  const classes = status === 'approved'
    ? 'bg-emerald-500/20 text-emerald-400'
    : status === 'rejected'
      ? 'bg-red-500/20 text-red-400'
      : 'bg-amber-500/20 text-amber-400';
  return <span className={`badge ${classes}`}>{status}</span>;
}


function normalizeReferralCode(code?: string | null) {
  return (code ?? '').toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);
}

function generateReferralCode(app: AffiliateApplication) {
  const base = app.company_name || app.full_name || app.email.split('@')[0];
  const slug = normalizeReferralCode(base).replace(/_/g, '-');
  return slug || `affiliate-${app.id.slice(0, 8)}`;
}

function referralLink(code: string) {
  return `https://www.leadscope.pro?ref=${encodeURIComponent(code)}`;
}
