import React, { useEffect, useState } from 'react';
import {
  Plus, Search, Trash2, ChevronRight, MapPin, Briefcase,
  Loader2, Zap, AlertCircle,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { LeadSearch } from '../types';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorAlert } from '../components/ui/ErrorAlert';
import { UpgradeModal } from '../components/ui/UpgradeModal';
import { formatDate, getSearchStatusColor, LANGUAGES } from '../lib/utils';
import { canGenerateLead, isAdmin, incrementUsage } from '../lib/plans';

interface Props {
  onNavigate: (page: string, params?: Record<string, string>) => void;
}


async function withTimeout<T>(promise: PromiseLike<T>, ms: number, message: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), ms);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timeoutId!);
  }
}

const defaultForm = {
  niche: '',
  location: '',
  service_offer: '',
  language: 'English',
};

interface FindLeadsState {
  loading: boolean;
  error: string;
  result: { inserted: number; skipped: number } | null;
}

export function LeadSearchesPage({ onNavigate }: Props) {
  const { user, profile, refreshProfile } = useAuth();
  const [searches, setSearches] = useState<LeadSearch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [upgradeMsg, setUpgradeMsg] = useState('');
  const [findState, setFindState] = useState<Record<string, FindLeadsState>>({});

  useEffect(() => {
    loadSearches();
  }, []);

  async function loadSearches() {
    setLoading(true);
    setError('');

    const loadingFailsafe = setTimeout(() => {
      setSearches([]);
      setError('Searches loading timed out.');
      setLoading(false);
    }, 8000);

    try {
      const { data, error: err } = await withTimeout(
        supabase
          .from('lead_searches')
          .select('*')
          .order('created_at', { ascending: false }),
        8000,
        'Searches loading timed out.'
      );

      if (err) {
        setSearches([]);
        setError(err.message);
      } else {
        setSearches(data ?? []);
      }
    } catch (err) {
      setSearches([]);
      setError(err instanceof Error ? err.message : 'Unable to load searches.');
    } finally {
      clearTimeout(loadingFailsafe);
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.niche.trim() || !form.location.trim()) {
      setError('Niche and location are required.');
      return;
    }
    setSaving(true);
    setError('');
    const { error: err } = await supabase.from('lead_searches').insert({
      niche: form.niche.trim(),
      location: form.location.trim(),
      service_offer: form.service_offer.trim(),
      language: form.language,
      status: 'pending',
    });
    if (err) setError(err.message);
    else { setForm(defaultForm); setShowForm(false); await loadSearches(); }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    const { error: err } = await supabase.from('lead_searches').delete().eq('id', id);
    if (err) setError(err.message);
    else setSearches(prev => prev.filter(s => s.id !== id));
    setDeleteId(null);
  }

  async function handleFindLeads(search: LeadSearch) {
    // Limit check
    if (!isAdmin(profile)) {
      const check = canGenerateLead(profile);
      if (!check.allowed) {
        setUpgradeMsg(check.message ?? '');
        return;
      }
    }

    setFindState(prev => ({ ...prev, [search.id]: { loading: true, error: '', result: null } }));

    await supabase.from('lead_searches').update({ status: 'running' }).eq('id', search.id);
    setSearches(prev => prev.map(s => s.id === search.id ? { ...s, status: 'running' } : s));

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated.');

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const res = await fetch(`${supabaseUrl}/functions/v1/find-leads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ search_id: search.id, niche: search.niche, location: search.location }),
      });

      const json = await res.json() as { error?: string; inserted?: number; skipped?: number; message?: string };

      if (!res.ok || json.error) {
        const errMsg = json.error ?? `Request failed (${res.status})`;
        setFindState(prev => ({ ...prev, [search.id]: { loading: false, error: errMsg, result: null } }));
        await supabase.from('lead_searches').update({ status: 'pending' }).eq('id', search.id);
        setSearches(prev => prev.map(s => s.id === search.id ? { ...s, status: 'pending' } : s));
        return;
      }

      const inserted = json.inserted ?? 0;
      const skipped = json.skipped ?? 0;

      // Increment usage
      if (inserted > 0 && user && !isAdmin(profile)) {
        await incrementUsage(user.id, 'leads', inserted);
        await refreshProfile();
      }

      setFindState(prev => ({ ...prev, [search.id]: { loading: false, error: '', result: { inserted, skipped } } }));
      setSearches(prev => prev.map(s => s.id === search.id ? { ...s, status: 'completed' } : s));

      if (inserted > 0) {
        setTimeout(() => onNavigate('leads', { search_id: search.id }), 1200);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong.';
      setFindState(prev => ({ ...prev, [search.id]: { loading: false, error: msg, result: null } }));
      await supabase.from('lead_searches').update({ status: 'pending' }).eq('id', search.id);
      setSearches(prev => prev.map(s => s.id === search.id ? { ...s, status: 'pending' } : s));
    }
  }

  if (loading) return <LoadingSpinner message="Loading searches..." />;

  return (
    <div className="space-y-6">
      {upgradeMsg && (
        <UpgradeModal
          message={upgradeMsg}
          onViewPlans={() => { setUpgradeMsg(''); onNavigate('settings', { tab: 'billing' }); }}
          onClose={() => setUpgradeMsg('')}
        />
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Lead Searches</h1>
          <p className="text-slate-400 text-sm mt-1">Organize your prospecting campaigns by niche and location.</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">
          <Plus className="w-4 h-4" />
          New Search
        </button>
      </div>

      {error && <ErrorAlert message={error} onClose={() => setError('')} />}

      {showForm && (
        <div className="card p-6">
          <h2 className="text-white font-semibold mb-5">Create Lead Search</h2>
          <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-1.5">Niche *</label>
              <input className="input" placeholder="e.g. Dentists, Plumbers" value={form.niche} onChange={e => setForm(p => ({ ...p, niche: e.target.value }))} />
            </div>
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-1.5">Location *</label>
              <input className="input" placeholder="e.g. Austin, TX" value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} />
            </div>
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-1.5">Service Offer</label>
              <input className="input" placeholder="e.g. Website redesign, Local SEO" value={form.service_offer} onChange={e => setForm(p => ({ ...p, service_offer: e.target.value }))} />
            </div>
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-1.5">Language</label>
              <select className="select" value={form.language} onChange={e => setForm(p => ({ ...p, language: e.target.value }))}>
                {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2 flex gap-3 justify-end pt-2">
              <button type="button" onClick={() => { setShowForm(false); setForm(defaultForm); setError(''); }} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Creating...' : 'Create Search'}</button>
            </div>
          </form>
        </div>
      )}

      {searches.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No lead searches yet"
          description="Create your first lead search to start organizing your prospecting by niche and location."
          action={
            <button onClick={() => setShowForm(true)} className="btn-primary">
              <Plus className="w-4 h-4" /> Create Search
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {searches.map(s => {
            const fs = findState[s.id];
            const isRunning = fs?.loading || s.status === 'running';

            return (
              <div key={s.id} className="card p-5 hover:border-slate-700 transition-all duration-200 group flex flex-col">
                <div className="flex items-start justify-between mb-3">
                  <span className={`badge ${getSearchStatusColor(s.status)}`}>{s.status}</span>
                  <button onClick={() => setDeleteId(s.id)} className="text-slate-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100" disabled={isRunning}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <h3 className="text-white font-semibold text-base mb-1 truncate">{s.niche}</h3>
                <div className="space-y-1 mb-4 flex-1">
                  <div className="flex items-center gap-2 text-slate-400 text-sm">
                    <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate">{s.location}</span>
                  </div>
                  {s.service_offer && (
                    <div className="flex items-center gap-2 text-slate-400 text-sm">
                      <Briefcase className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">{s.service_offer}</span>
                    </div>
                  )}
                </div>

                {fs?.error && (
                  <div className="flex items-start gap-2 p-3 mb-3 rounded-lg bg-red-500/10 border border-red-500/20">
                    <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                    <p className="text-red-300 text-xs leading-relaxed">{fs.error}</p>
                  </div>
                )}
                {fs?.result && (
                  <div className="flex items-center gap-2 p-3 mb-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <p className="text-emerald-300 text-xs">
                      {fs.result.inserted === 0
                        ? 'No leads found for this query.'
                        : `${fs.result.inserted} lead${fs.result.inserted !== 1 ? 's' : ''} found${fs.result.skipped > 0 ? ` · ${fs.result.skipped} duplicate${fs.result.skipped !== 1 ? 's' : ''} skipped` : ''}. Redirecting…`}
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-slate-800 gap-2">
                  <span className="text-slate-500 text-xs flex-shrink-0">{formatDate(s.created_at)}</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleFindLeads(s)} disabled={isRunning} className="flex items-center gap-1.5 btn-primary text-xs py-1.5 px-3">
                      {isRunning ? <><Loader2 className="w-3 h-3 animate-spin" /> Searching…</> : <><Zap className="w-3 h-3" /> Find Leads</>}
                    </button>
                    <button onClick={() => onNavigate('leads', { search_id: s.id })} className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-xs font-medium transition-colors flex-shrink-0">
                      View <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="card p-6 w-full max-w-sm">
            <h3 className="text-white font-semibold mb-2">Delete Search?</h3>
            <p className="text-slate-400 text-sm mb-6">This will permanently delete this lead search. Leads linked to this search will not be deleted.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteId(null)} className="btn-secondary">Cancel</button>
              <button onClick={() => handleDelete(deleteId)} className="btn-danger">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
