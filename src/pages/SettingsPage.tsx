import React, { useEffect, useState } from 'react';
import {
  Key, Building2, Globe, Save, Eye, EyeOff, CheckCircle, ShieldCheck,
  User, CreditCard, Shield, Zap, Mail,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { ErrorAlert } from '../components/ui/ErrorAlert';
import { LANGUAGES, TONES } from '../lib/utils';
import {
  isAdmin, getPlanBadgeColor, getSubscriptionStatusColor, PLANS,
} from '../lib/plans';
import { createCheckoutSession, createPortalSession } from '../lib/stripe';
import { CreditWallet } from '../components/CreditWallet';
import type { SmtpSettings } from '../types';

type Tab = 'profile' | 'api-keys' | 'smtp' | 'billing' | 'security' | 'email-preferences';

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

const smtpDefaults: SmtpSettings = {
  from_name: '',
  from_email: '',
  reply_to_email: '',
  smtp_host: '',
  smtp_port: '',
  smtp_username: '',
  smtp_secure: true,
  is_configured: false,
};

interface Props {
  onNavigate?: (page: string, params?: Record<string, string>) => void;
  initialTab?: Tab;
}

export function SettingsPage({ onNavigate, initialTab }: Props) {
  const { user, profile, refreshProfile } = useAuth();
  const [tab, setTab] = useState<Tab>(initialTab ?? (profile?.current_plan === 'free_trial' ? 'billing' : 'profile'));
  const [apiSettings, setApiSettings] = useState<ApiKeySettings>(defaults);
  const [smtpSettings, setSmtpSettings] = useState<SmtpSettings>(smtpDefaults);
  const [smtpPassword, setSmtpPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [savedMessage, setSavedMessage] = useState('Saved successfully.');
  const [upgrading, setUpgrading] = useState(false);
  const [upgradeMsg, setUpgradeMsg] = useState('');
  const [portalLoading, setPortalLoading] = useState(false);
  const [productUpdatesEnabled, setProductUpdatesEnabled] = useState(true);
  const [emailPreferencesSaving, setEmailPreferencesSaving] = useState(false);

  const admin = isAdmin(profile);
  const planName = profile ? (PLANS[profile.current_plan]?.name ?? profile.current_plan) : '';
  const planBadge = profile ? getPlanBadgeColor(profile.current_plan) : '';
  const statusBadge = profile ? getSubscriptionStatusColor(profile.subscription_status) : '';

  useEffect(() => {
    async function load() {
      const [{ data: settingsData }, { data: smtpData }, { data: emailPreferencesData, error: emailPreferencesError }] = await Promise.all([
        supabase.from('user_settings').select('*').maybeSingle(),
        supabase
          .from('user_smtp_settings')
          .select('from_name, from_email, reply_to_email, smtp_host, smtp_port, smtp_username, smtp_secure, is_configured, updated_at')
          .maybeSingle(),
        supabase
          .from('user_email_preferences')
          .select('product_updates_enabled')
          .maybeSingle(),
      ]);
      const data = settingsData;
      if (data) {
        setApiSettings({
          agency_name: data.agency_name ?? '',
          agency_website: data.agency_website ?? '',
          default_language: data.default_language ?? 'English',
          default_tone: data.default_tone ?? 'Professional',
        });
      }
      if (smtpData) {
        setSmtpSettings({
          from_name: smtpData.from_name ?? '',
          from_email: smtpData.from_email ?? '',
          reply_to_email: smtpData.reply_to_email ?? '',
          smtp_host: smtpData.smtp_host ?? '',
          smtp_port: smtpData.smtp_port ?? '',
          smtp_username: smtpData.smtp_username ?? '',
          smtp_secure: smtpData.smtp_secure ?? true,
          is_configured: smtpData.is_configured ?? false,
          updated_at: smtpData.updated_at,
        });
      }
      if (emailPreferencesData) {
        setProductUpdatesEnabled(emailPreferencesData.product_updates_enabled);
      } else if (!emailPreferencesError && user?.email) {
        await supabase.from('user_email_preferences').insert({
          user_id: user.id,
          email: user.email,
          product_updates_enabled: true,
          unsubscribe_token: createUnsubscribeToken(),
        });
      }
      setFullName(profile?.full_name ?? '');
      setLoading(false);
    }
    load();
  }, [user, profile?.full_name]);

  function showSaved(message = 'Saved successfully.') {
    setSavedMessage(message);
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

  async function handleSaveSmtpSettings(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    const { data, error: functionError } = await supabase.functions.invoke('save-smtp-settings', {
      body: { ...smtpSettings, smtp_password: smtpPassword },
    });
    if (functionError) {
      setError(functionError.message);
    } else if (data?.error) {
      setError(data.error);
    } else if (data?.settings) {
      setSmtpSettings(data.settings as SmtpSettings);
      setSmtpPassword('');
      showSaved('SMTP settings saved');
    } else {
      setError('Unable to save SMTP settings.');
    }
    setSaving(false);
  }

  async function handleTestSmtpConnection() {
    setTestingSmtp(true);
    setError('');
    setSaved(false);

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      if (sessionError || !accessToken) {
        setError('You must be logged in to test SMTP connection.');
        return;
      }

      const response = await fetch('/api/test-smtp-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const data = await response.json().catch(() => null) as { error?: string; success?: boolean } | null;

      if (response.ok && data?.success) {
        showSaved('SMTP test email sent successfully.');
      } else {
        setError(data?.error ?? 'Unable to test SMTP connection.');
      }
    } catch {
      setError('Unable to test SMTP connection.');
    } finally {
      setTestingSmtp(false);
    }
  }

  async function handleUpgrade() {
    setUpgrading(true);
    setUpgradeMsg('');
    const { url, error } = await createCheckoutSession('pro', 'monthly');
    if (url) window.location.assign(url);
    else setUpgradeMsg(error ?? 'Could not open checkout.');
    setUpgrading(false);
  }

  async function handleManageBilling() {
    setPortalLoading(true);
    const { url, error } = await createPortalSession();
    if (error) { setUpgradeMsg('Error: ' + error); setPortalLoading(false); return; }
    if (url) window.location.href = url;
    setPortalLoading(false);
  }

  function createUnsubscribeToken() {
    const bytes = crypto.getRandomValues(new Uint8Array(24));
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  async function handleProductUpdatesChange(enabled: boolean) {
    if (!user?.email) return;
    setEmailPreferencesSaving(true);
    setError('');
    const now = new Date().toISOString();
    const preference = {
      user_id: user.id,
      email: user.email,
      product_updates_enabled: enabled,
      unsubscribed_at: enabled ? null : now,
      updated_at: now,
    };
    const { data: existingPreference, error: lookupError } = await supabase
      .from('user_email_preferences')
      .select('user_id')
      .maybeSingle();
    const { error: saveError } = lookupError
      ? { error: lookupError }
      : existingPreference
        ? await supabase.from('user_email_preferences').update(preference).eq('user_id', user.id)
        : await supabase.from('user_email_preferences').insert({ ...preference, unsubscribe_token: createUnsubscribeToken() });
    if (saveError) {
      setError(saveError.message);
    } else {
      setProductUpdatesEnabled(enabled);
      showSaved(enabled ? 'Product update emails enabled.' : 'Product update emails disabled.');
    }
    setEmailPreferencesSaving(false);
  }

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'api-keys', label: 'API Keys', icon: Key },
    { id: 'smtp', label: 'Email / SMTP', icon: Mail },
    { id: 'email-preferences', label: 'Email Preferences', icon: Mail },
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
          <p className="text-sm font-medium">{savedMessage}</p>
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

      {tab === 'smtp' && (
        <form onSubmit={handleSaveSmtpSettings} className="card p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-violet-500/15 flex items-center justify-center">
              <Mail className="w-4 h-4 text-violet-400" />
            </div>
            <div>
              <h2 className="text-white font-semibold">Email Sending / SMTP</h2>
              <p className="text-slate-500 text-xs mt-0.5">Save the connection details used for future email sending.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-1.5">From Name</label>
              <input className="input" value={smtpSettings.from_name} onChange={e => setSmtpSettings(p => ({ ...p, from_name: e.target.value }))} placeholder="Your name or company" />
            </div>
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-1.5">From Email</label>
              <input type="email" required className="input" value={smtpSettings.from_email} onChange={e => setSmtpSettings(p => ({ ...p, from_email: e.target.value }))} placeholder="you@example.com" />
            </div>
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-1.5">Reply-To Email</label>
              <input type="email" className="input" value={smtpSettings.reply_to_email} onChange={e => setSmtpSettings(p => ({ ...p, reply_to_email: e.target.value }))} placeholder="replies@example.com" />
            </div>
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-1.5">SMTP Host</label>
              <input required className="input" value={smtpSettings.smtp_host} onChange={e => setSmtpSettings(p => ({ ...p, smtp_host: e.target.value }))} placeholder="smtp.example.com" />
            </div>
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-1.5">SMTP Port</label>
              <input required type="number" min="1" max="65535" className="input" value={smtpSettings.smtp_port} onChange={e => setSmtpSettings(p => ({ ...p, smtp_port: e.target.value === '' ? '' : Number(e.target.value) }))} placeholder="465" />
            </div>
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-1.5">SMTP Username</label>
              <input required className="input" value={smtpSettings.smtp_username} onChange={e => setSmtpSettings(p => ({ ...p, smtp_username: e.target.value }))} placeholder="SMTP username" autoComplete="username" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-slate-300 text-sm font-medium mb-1.5">SMTP Password / App Password</label>
              <input type="password" className="input" value={smtpPassword} onChange={e => setSmtpPassword(e.target.value)} placeholder={smtpSettings.is_configured ? 'Leave blank to keep existing password' : 'SMTP password or app password'} autoComplete="new-password" required={!smtpSettings.is_configured} />
              <p className="text-slate-500 text-xs mt-1.5">Use an app password when required by your email provider.</p>
            </div>
          </div>
          <label className="flex items-center gap-3 text-sm text-slate-300 cursor-pointer w-fit">
            <input type="checkbox" checked={smtpSettings.smtp_secure} onChange={e => setSmtpSettings(p => ({ ...p, smtp_secure: e.target.checked }))} className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-600 focus:ring-blue-500" />
            Secure connection
          </label>
          <div className="flex flex-wrap justify-end gap-3 pt-1">
            <button type="button" disabled={testingSmtp} onClick={handleTestSmtpConnection} className="btn-secondary px-6">
              <Mail className="w-4 h-4" />
              {testingSmtp ? 'Testing...' : 'Test SMTP Connection'}
            </button>
            <button type="submit" disabled={saving} className="btn-primary px-6">
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save SMTP Settings'}
            </button>
          </div>
        </form>
      )}

      {tab === 'email-preferences' && (
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center">
              <Mail className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h2 className="text-white font-semibold">Email Preferences</h2>
              <p className="text-slate-500 text-xs mt-0.5">Choose whether to receive LeadScope AI product update emails.</p>
            </div>
          </div>
          <div className="mt-6 flex items-center justify-between gap-5 rounded-xl border border-slate-800 bg-slate-800/40 p-4">
            <div>
              <p className="text-sm font-medium text-slate-200">Receive product update emails</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">Learn about new LeadScope AI features and improvements.</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={productUpdatesEnabled}
              aria-label="Receive product update emails"
              disabled={emailPreferencesSaving}
              onClick={() => handleProductUpdatesChange(!productUpdatesEnabled)}
              className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${productUpdatesEnabled ? 'bg-blue-600' : 'bg-slate-600'}`}
            >
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${productUpdatesEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>
        </div>
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
                <span className={`badge ${statusBadge}`}>{profile?.current_plan === 'free_trial' ? 'Free CRM' : profile?.subscription_status ?? '—'}</span>
              </div>
            </div>
          </div>

          {!admin && (
            <>
              <div className="card p-6">
                <h2 className="mb-4 font-semibold text-white">Credit wallet</h2>
                <CreditWallet />
              </div>
              <div className="card space-y-4 p-6">
                <h2 className="font-semibold text-white">PRO subscription</h2>
                <p className="text-sm text-slate-300">€69 per month · 7,400 credits each paid cycle</p>
                <div className="flex flex-wrap gap-3">
                  {(profile?.current_plan === 'free_trial' ||
                    !['active', 'trialing', 'past_due', 'unpaid', 'paused', 'incomplete'].includes(profile?.subscription_status ?? '')) && (
                    <button onClick={() => void handleUpgrade()} disabled={upgrading} className="btn-primary">
                      {upgrading ? 'Opening checkout…' : 'Subscribe to PRO'}
                    </button>
                  )}
                  <button onClick={() => void handleManageBilling()} disabled={portalLoading} className="btn-secondary">
                    {portalLoading ? 'Opening…' : 'Manage billing and invoices'}
                  </button>
                  {onNavigate && (
                    <button onClick={() => onNavigate('pricing')} className="btn-secondary">
                      <Zap className="w-3.5 h-3.5" /> View pricing
                    </button>
                  )}
                </div>
              </div>
            </>
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
