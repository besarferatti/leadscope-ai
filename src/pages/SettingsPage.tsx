import React, { useEffect, useState } from 'react';
import {
  Key, Building2, Globe, Save, Eye, EyeOff, CheckCircle, ShieldCheck,
  User, CreditCard, Shield, BarChart3, MessageSquare, Users as UsersIcon,
  TrendingUp, Clock, Zap,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { ErrorAlert } from '../components/ui/ErrorAlert';
import { LANGUAGES, TONES } from '../lib/utils';
import {
  isAdmin, getPlanLimits, getTrialDaysLeft, isTrialExpired,
  getPlanBadgeColor, getSubscriptionStatusColor, PLANS, CHANGEABLE_PLANS, PlanId,
  getStripePriceId,
} from '../lib/plans';
import { createCheckoutSession, createPortalSession } from '../lib/stripe';

type Tab = 'profile' | 'api-keys' | 'billing' | 'security';

interface ApiKeySettings {
  agency_name: string;
  agency_website: string;
  default_language: string;
  default_tone: string;
}

const defaults: ApiKeySettings = {
  agency_name: '',
  agency_website: '',
  default_language: 'English',
  default_tone: 'Professional',
};

interface Props {
  onNavigate?: (page: string, params?: Record<string, string>) => void;
  initialTab?: Tab;
}

function UsageBar({ label, used, limit, icon: Icon }: { label: string; used: number; limit: number; icon: React.ElementType }) {
  const pct = limit === -1 ? 0 : Math.min(100, Math.round((used / limit) * 100));
  const color = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-blue-500';
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2 text-slate-400 text-sm">
          <Icon className="w-3.5 h-3.5" />
          {label}
        </div>
        <span className="text-slate-300 text-sm font-medium">
          {limit === -1 ? `${used.toLocaleString()} / ∞` : `${used.toLocaleString()} / ${limit.toLocaleString()}`}
        </span>
      </div>
      {limit !== -1 && (
        <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
          <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}

export function SettingsPage({ onNavigate, initialTab }: Props) {
  const { user, profile, refreshProfile } = useAuth();
  const [tab, setTab] = useState<Tab>(initialTab ?? (profile?.current_plan === 'free_trial' ? 'billing' : 'profile'));
  const [apiSettings, setApiSettings] = useState<ApiKeySettings>(defaults);
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [upgradingTo, setUpgradingTo] = useState<PlanId | null>(null);
  const [upgradeMsg, setUpgradeMsg] = useState('');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [portalLoading, setPortalLoading] = useState(false);

  const admin = isAdmin(profile);
  const limits = getPlanLimits(profile);
  const trialDays = getTrialDaysLeft(profile);
  const trialExpired = isTrialExpired(profile);
  const planName = profile ? (PLANS[profile.current_plan]?.name ?? profile.current_plan) : '';
  const planBadge = profile ? getPlanBadgeColor(profile.current_plan) : '';
  const statusBadge = profile ? getSubscriptionStatusColor(profile.subscription_status) : '';

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('user_settings').select('*').maybeSingle();
      if (data) {
        setApiSettings({
          agency_name: data.agency_name ?? '',
          agency_website: data.agency_website ?? '',
          default_language: data.default_language ?? 'English',
          default_tone: data.default_tone ?? 'Professional',
        });
      }
      setFullName(profile?.full_name ?? '');
      setLoading(false);
    }
    load();
  }, [user, profile?.full_name]);

  function showSaved() {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    const { error: err } = await supabase
      .from('user_profiles')
      .update({ full_name: fullName.trim(), updated_at: new Date().toISOString() })
      .eq('id', user!.id);
    if (err) setError(err.message);
    else { await refreshProfile(); showSaved(); }
    setSaving(false);
  }

  async function handleSaveApiKeys(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    const { error: err } = await supabase
      .from('user_settings')
      .upsert({ id: user!.id, ...apiSettings, updated_at: new Date().toISOString() }, { onConflict: 'id' });
    if (err) setError(err.message);
    else showSaved();
    setSaving(false);
  }

  async function handleUpgrade(planId: PlanId) {
    if (planId === 'enterprise') {
      window.location.href = 'mailto:sales@leadscope.pro';
      return;
    }
    // Users with an active paid subscription must use the portal to change plans —
    // creating a new checkout would open a second subscription (double billing).
    if (profile?.current_plan && profile.current_plan !== 'free_trial') {
      return handleManageBilling();
    }
    setUpgradingTo(planId);
    setUpgradeMsg('');
    const { url, error } = await createCheckoutSession(planId, billingCycle);
    if (error) {
      setUpgradeMsg('Error: ' + error);
      setUpgradingTo(null);
      return;
    }
    if (url) window.location.href = url;
    setUpgradingTo(null);
  }

  async function handleManageBilling() {
    setPortalLoading(true);
    const { url, error } = await createPortalSession();
    if (error) { setUpgradeMsg('Error: ' + error); setPortalLoading(false); return; }
    if (url) window.location.href = url;
    setPortalLoading(false);
  }

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'api-keys', label: 'API Keys', icon: Key },
    { id: 'billing', label: 'Billing', icon: CreditCard },
    { id: 'security', label: 'Security', icon: Shield },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-slate-400 text-sm mt-1">Manage your account, API keys, billing, and security.</p>
      </div>

      <div className="flex flex-wrap gap-1 p-1 bg-slate-900 border border-slate-800 rounded-xl w-fit">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setError(''); setSaved(false); setUpgradeMsg(''); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {error && <ErrorAlert message={error} onClose={() => setError('')} />}
      {saved && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium">Saved successfully.</p>
        </div>
      )}
      {upgradeMsg && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium">{upgradeMsg}</p>
        </div>
      )}

      {tab === 'profile' && (
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center">
              <User className="w-4 h-4 text-blue-400" />
            </div>
            <h2 className="text-white font-semibold">Profile</h2>
          </div>
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-1.5">Full Name</label>
              <input className="input" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your full name" />
            </div>
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-1.5">Email</label>
              <input className="input bg-slate-800/50 cursor-not-allowed opacity-60" value={user?.email ?? ''} readOnly disabled />
              <p className="text-slate-600 text-xs mt-1">Email cannot be changed.</p>
            </div>
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-1.5">Role</label>
              <span className={`badge ${admin ? 'bg-red-500/20 text-red-400' : 'bg-slate-700 text-slate-300'}`}>
                {admin ? 'Admin' : 'User'}
              </span>
            </div>
            <div className="flex justify-end pt-2">
              <button type="submit" disabled={saving} className="btn-primary px-6">
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </form>
        </div>
      )}

      {tab === 'api-keys' && (
        <form onSubmit={handleSaveApiKeys} className="space-y-6">
          <div className="card p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center">
                <Key className="w-4 h-4 text-blue-400" />
              </div>
              <h2 className="text-white font-semibold">API Keys</h2>
            </div>
            <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
              <ShieldCheck className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <p className="text-blue-100/80 text-sm leading-relaxed">
                API access is managed securely by LeadScope AI. You do not need to add your own OpenAI or Google Places API keys.
              </p>
            </div>
          </div>
          <div className="card p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                <Building2 className="w-4 h-4 text-emerald-400" />
              </div>
              <h2 className="text-white font-semibold">Agency Profile & Defaults</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-1.5">Agency Name</label>
                <input className="input" placeholder="Your Agency Name" value={apiSettings.agency_name} onChange={e => setApiSettings(p => ({ ...p, agency_name: e.target.value }))} />
              </div>
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-1.5">Agency Website</label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input className="input pl-9" placeholder="https://youragency.com" value={apiSettings.agency_website} onChange={e => setApiSettings(p => ({ ...p, agency_website: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-1.5">Default Language</label>
                <select className="select" value={apiSettings.default_language} onChange={e => setApiSettings(p => ({ ...p, default_language: e.target.value }))}>
                  {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-1.5">Default Tone</label>
                <select className="select" value={apiSettings.default_tone} onChange={e => setApiSettings(p => ({ ...p, default_tone: e.target.value }))}>
                  {TONES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={saving} className="btn-primary px-8 py-2.5">
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      )}

      {tab === 'billing' && (
        <div className="space-y-6">
          <div className="card p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center">
                <CreditCard className="w-4 h-4 text-blue-400" />
              </div>
              <h2 className="text-white font-semibold">Current Plan</h2>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-slate-800/50 rounded-lg p-3">
                <p className="text-slate-500 text-xs mb-1">Plan</p>
                <span className={`badge ${planBadge}`}>{planName}</span>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-3">
                <p className="text-slate-500 text-xs mb-1">Status</p>
                <span className={`badge ${statusBadge}`}>{profile?.subscription_status ?? '—'}</span>
              </div>
              {profile?.current_plan === 'free_trial' && (
                <div className="bg-slate-800/50 rounded-lg p-3 col-span-2">
                  <p className="text-slate-500 text-xs mb-1">Trial Ends</p>
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <p className="text-slate-300 text-sm">
                      {trialExpired ? 'Expired' : `${trialDays} day${trialDays !== 1 ? 's' : ''} remaining`}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="card p-6">
            <h2 className="text-white font-semibold mb-4">Monthly Usage</h2>
            {admin ? (
              <div className="flex items-center gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                <Shield className="w-5 h-5 text-red-400" />
                <p className="text-red-400 text-sm font-medium">Admin Unlimited — No usage limits apply.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <UsageBar label="Leads" used={profile?.leads_used_this_month ?? 0} limit={limits.leadsLimit} icon={UsersIcon} />
                <UsageBar label="AI Audits" used={profile?.audits_used_this_month ?? 0} limit={limits.auditsLimit} icon={BarChart3} />
                <UsageBar label="Outreach Messages" used={profile?.messages_used_this_month ?? 0} limit={limits.messagesLimit} icon={MessageSquare} />
              </div>
            )}
          </div>

          {!admin && (
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <h2 className="text-white font-semibold">
                      {profile?.current_plan !== 'free_trial' ? 'Change Plan' : 'Upgrade Plan'}
                    </h2>
                    <p className="text-slate-500 text-xs">
                      {profile?.current_plan !== 'free_trial'
                        ? 'Manage your subscription via the billing portal'
                        : 'Secure checkout powered by Stripe'}
                    </p>
                  </div>
                </div>
                {/* Billing cycle toggle */}
                <div className="flex items-center gap-1 p-1 bg-slate-800 border border-slate-700 rounded-lg">
                  <button
                    onClick={() => setBillingCycle('monthly')}
                    className={`px-3 py-1 rounded text-xs font-medium transition-all ${billingCycle === 'monthly' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    Monthly
                  </button>
                  <button
                    onClick={() => setBillingCycle('yearly')}
                    className={`px-3 py-1 rounded text-xs font-medium transition-all flex items-center gap-1 ${billingCycle === 'yearly' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    Yearly
                    <span className={`text-xs px-1 rounded-full font-semibold ${billingCycle === 'yearly' ? 'bg-white/20 text-white' : 'bg-emerald-500/20 text-emerald-400'}`}>-20%</span>
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {CHANGEABLE_PLANS.filter(p => p.id !== 'admin_unlimited' && p.id !== 'free_trial').map(p => {
                  const plan = PLANS[p.id];
                  const isCurrent = profile?.current_plan === p.id;
                  const price = billingCycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;
                  const hasPriceId = !!getStripePriceId(p.id, billingCycle);
                  return (
                    <button
                      key={p.id}
                      onClick={() => handleUpgrade(p.id)}
                      disabled={isCurrent || upgradingTo !== null}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        isCurrent
                          ? 'border-blue-500/40 bg-blue-500/10 cursor-default'
                          : 'border-slate-700 bg-slate-800/50 hover:border-blue-500/40 hover:bg-blue-500/5'
                      }`}
                    >
                      <p className="text-slate-200 text-sm font-medium">{plan.name}</p>
                      <p className="text-slate-500 text-xs mt-0.5">
                        {price === null ? 'Custom' : `€${price}${billingCycle === 'yearly' ? '/yr' : '/mo'}`}
                      </p>
                      {!hasPriceId && p.id !== 'enterprise' && (
                        <p className="text-amber-400 text-xs mt-1">Price ID not set</p>
                      )}
                      {isCurrent && <p className="text-blue-400 text-xs mt-1">Current</p>}
                      {upgradingTo === p.id && <p className="text-slate-400 text-xs mt-1">Redirecting...</p>}
                    </button>
                  );
                })}
              </div>
              {profile?.current_plan !== 'free_trial' && (
                <button
                  onClick={handleManageBilling}
                  disabled={portalLoading}
                  className="btn-secondary text-xs py-2 mt-4"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  {portalLoading ? 'Opening...' : 'Manage Billing & Invoices'}
                </button>
              )}
              {onNavigate && (
                <button onClick={() => onNavigate('pricing')} className="btn-secondary text-xs py-2 mt-2 ml-2">
                  <Zap className="w-3.5 h-3.5" /> View Pricing Page
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'security' && (
        <div className="card overflow-hidden">
          <div className="p-6 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center">
                <Shield className="w-4 h-4 text-slate-400" />
              </div>
              <h2 className="text-white font-semibold">Change Password</h2>
            </div>
          </div>
          <div className="p-6">
            <PasswordChangeForm onSuccess={showSaved} />
          </div>
        </div>
      )}
    </div>
  );
}

function PasswordChangeForm({ onSuccess }: { onSuccess: () => void }) {
  const { user, profile, refreshProfile } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (next.length < 8) { setError('New password must be at least 8 characters.'); return; }
    if (next !== confirm) { setError('Passwords do not match.'); return; }
    if (current === next) { setError('New password must differ from current password.'); return; }
    setLoading(true);

    const email = user?.email ?? profile?.email ?? '';
    const { error: verifyError } = await supabase.auth.signInWithPassword({ email, password: current });
    if (verifyError) { setError('Current password is incorrect.'); setLoading(false); return; }

    const { error: updateError } = await supabase.auth.updateUser({ password: next });
    if (updateError) { setError(updateError.message); setLoading(false); return; }

    await supabase.from('user_profiles').update({ must_change_password: false, updated_at: new Date().toISOString() }).eq('id', user!.id);
    await refreshProfile();
    setCurrent(''); setNext(''); setConfirm('');
    onSuccess();
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-sm">
      {error && <ErrorAlert message={error} onClose={() => setError('')} />}
      <div>
        <label className="block text-slate-300 text-sm font-medium mb-1.5">Current Password</label>
        <div className="relative">
          <input type={showCurrent ? 'text' : 'password'} className="input pr-10" placeholder="Current password" value={current} onChange={e => setCurrent(e.target.value)} required />
          <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
            {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>
      <div>
        <label className="block text-slate-300 text-sm font-medium mb-1.5">New Password</label>
        <div className="relative">
          <input type={showNext ? 'text' : 'password'} className="input pr-10" placeholder="Min. 8 characters" value={next} onChange={e => setNext(e.target.value)} required minLength={8} />
          <button type="button" onClick={() => setShowNext(!showNext)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
            {showNext ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>
      <div>
        <label className="block text-slate-300 text-sm font-medium mb-1.5">Confirm New Password</label>
        <input type="password" className={`input ${confirm && confirm !== next ? 'border-red-500/50' : ''}`} placeholder="Repeat new password" value={confirm} onChange={e => setConfirm(e.target.value)} required />
        {confirm && confirm !== next && <p className="text-red-400 text-xs mt-1">Passwords do not match</p>}
      </div>
      <button type="submit" disabled={loading || !current || !next || !confirm} className="btn-primary">
        <Save className="w-4 h-4" />
        {loading ? 'Updating...' : 'Update Password'}
      </button>
    </form>
  );
}
