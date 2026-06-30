import React, { useEffect, useState, useRef } from 'react';
import {
  Plus, Download, Upload, Filter, Star, ChevronRight, Trash2,
  Globe, Phone, Mail, Search, X, AlertCircle,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Lead, LeadSearch, LeadStatus } from '../types';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorAlert } from '../components/ui/ErrorAlert';
import { StatusBadge } from '../components/ui/StatusBadge';
import { ScoreBadge } from '../components/ui/ScoreBadge';
import { UpgradeModal } from '../components/ui/UpgradeModal';
import { exportLeadsCSV, LEAD_STATUSES, INDUSTRIES } from '../lib/utils';
import {
  canGenerateLead, canExportCSV, canUseBulkActions, isAdmin, incrementUsage,
} from '../lib/plans';

interface Props {
  onNavigate: (page: string, params?: Record<string, string>) => void;
  initialSearchId?: string;
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
  business_name: '',
  industry: '',
  location: '',
  address: '',
  website: '',
  phone: '',
  email: '',
  google_rating: '',
  reviews_count: '',
  google_maps_url: '',
  lead_search_id: '',
};

export function LeadsPage({ onNavigate, initialSearchId }: Props) {
  const { user, profile, refreshProfile } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [searches, setSearches] = useState<LeadSearch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...defaultForm, lead_search_id: initialSearchId ?? '' });
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [upgradeMsg, setUpgradeMsg] = useState('');

  const [filterStatus, setFilterStatus] = useState('');
  const [filterSearch, setFilterSearch] = useState(initialSearchId ?? '');
  const [filterQuery, setFilterQuery] = useState('');
  const [sortBy, setSortBy] = useState<'created_at' | 'lead_score' | 'business_name'>('created_at');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const csvAllowed = canExportCSV(profile);
  const bulkAllowed = canUseBulkActions(profile);

  useEffect(() => {
    console.log('[LeadsPage] component mounted');
    console.log('[LeadsPage] user id value', { userId: user?.id ?? null });
    loadData();
  }, []);

  async function loadData() {
    console.log('[LeadsPage] load function started', { userId: user?.id ?? null });
    setLoading(true);
    const [leadsRes, searchesRes] = await Promise.all([
      supabase.from('leads').select('*').order('created_at', { ascending: false }),
      supabase.from('lead_searches').select('id, niche, location').order('created_at', { ascending: false }),
    ]);
    if (leadsRes.error) {
      console.log('[LeadsPage] query error', { source: 'leads', error: leadsRes.error.message });
      setError(leadsRes.error.message);
    } else {
      console.log('[LeadsPage] query success', { source: 'leads', count: leadsRes.data?.length ?? 0 });
      setLeads(leadsRes.data ?? []);
    }
    if (searchesRes.error) {
      console.log('[LeadsPage] query error', { source: 'searches', error: searchesRes.error.message });
    } else {
      console.log('[LeadsPage] query success', { source: 'searches', count: searchesRes.data?.length ?? 0 });
    }
    setSearches((searchesRes.data as unknown as LeadSearch[]) ?? []);
    console.log('[LeadsPage] finally setLoading(false)');
    setLoading(false);
  }

  async function handleAddLead(e: React.FormEvent) {
    e.preventDefault();
    if (!form.business_name.trim()) { setError('Business name is required.'); return; }

    // Limit check (skip for admin)
    if (!isAdmin(profile)) {
      const check = canGenerateLead(profile);
      if (!check.allowed) {
        setUpgradeMsg(check.message ?? '');
        return;
      }
    }

    setSaving(true);
    setError('');
    const { error: insertError } = await supabase.from('leads').insert({
      business_name: form.business_name.trim(),
      industry: form.industry,
      location: form.location.trim(),
      address: form.address.trim(),
      website: form.website.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      google_rating: form.google_rating ? parseFloat(form.google_rating) : null,
      reviews_count: form.reviews_count ? parseInt(form.reviews_count) : 0,
      google_maps_url: form.google_maps_url.trim(),
      lead_search_id: form.lead_search_id || null,
      lead_score: 0,
      status: 'New',
    });
    if (insertError) {
      setError(insertError.message);
    } else {
      if (user && !isAdmin(profile)) await incrementUsage(user.id, 'leads', 1);
      await refreshProfile();
      setForm({ ...defaultForm, lead_search_id: initialSearchId ?? '' });
      setShowForm(false);
      await loadData();
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    const { error: delError } = await supabase.from('leads').delete().eq('id', id);
    if (delError) setError(delError.message);
    else setLeads(prev => prev.filter(l => l.id !== id));
    setDeleteId(null);
  }

  function handleImportCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!csvAllowed && !isAdmin(profile)) {
      setUpgradeMsg('CSV export is available on Starter and higher plans.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length < 2) { setError('CSV must have a header row and at least one data row.'); return; }
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, '').toLowerCase().replace(/ /g, '_'));
      const rows = lines.slice(1).map(line => {
        const vals = line.split(',').map(v => v.trim().replace(/"/g, ''));
        const obj: Record<string, string> = {};
        headers.forEach((h, i) => { obj[h] = vals[i] ?? ''; });
        return obj;
      });

      const inserts = rows.filter(r => r.business_name).map(r => ({
        business_name: r.business_name || '',
        industry: r.industry || '',
        location: r.location || '',
        address: r.address || '',
        website: r.website || '',
        phone: r.phone || '',
        email: r.email || '',
        google_rating: r.google_rating ? parseFloat(r.google_rating) : null,
        reviews_count: r.reviews_count ? parseInt(r.reviews_count) : 0,
        google_maps_url: r.google_maps_url || '',
        lead_score: r.lead_score ? parseInt(r.lead_score) : 0,
        status: 'New' as LeadStatus,
        lead_search_id: initialSearchId || null,
      }));

      if (!inserts.length) { setError('No valid rows found.'); return; }

      const { error: insertError } = await supabase.from('leads').insert(inserts);
      if (insertError) setError(insertError.message);
      else {
        if (user && !isAdmin(profile)) await incrementUsage(user.id, 'leads', inserts.length);
        await refreshProfile();
        await loadData();
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleExport() {
    if (!csvAllowed) {
      setUpgradeMsg('CSV export is available on Starter and higher plans.');
      return;
    }
    const data = filteredLeads.map(l => ({
      business_name: l.business_name, industry: l.industry, location: l.location,
      address: l.address, website: l.website, phone: l.phone, email: l.email,
      google_rating: l.google_rating, reviews_count: l.reviews_count,
      lead_score: l.lead_score, status: l.status, created_at: l.created_at,
    }));
    exportLeadsCSV(data as unknown as Array<Record<string, unknown>>, 'leads-export.csv');
  }

  const filteredLeads = leads
    .filter(l => {
      if (filterStatus && l.status !== filterStatus) return false;
      if (filterSearch && l.lead_search_id !== filterSearch) return false;
      if (filterQuery) {
        const q = filterQuery.toLowerCase();
        return l.business_name.toLowerCase().includes(q) || l.location.toLowerCase().includes(q) || l.industry.toLowerCase().includes(q) || l.email.toLowerCase().includes(q);
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'lead_score') return b.lead_score - a.lead_score;
      if (sortBy === 'business_name') return a.business_name.localeCompare(b.business_name);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  if (loading) return <LoadingSpinner message="Loading leads..." />;

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
          <h1 className="text-2xl font-bold text-white">Leads</h1>
          <p className="text-slate-400 text-sm mt-1">{leads.length} total leads</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleImportCSV} />
          <div className="relative group">
            <button onClick={() => fileInputRef.current?.click()} className="btn-secondary text-xs py-2">
              <Upload className="w-3.5 h-3.5" /> Import CSV
            </button>
          </div>
          <div className="relative group">
            <button
              onClick={handleExport}
              disabled={!filteredLeads.length}
              className={`btn-secondary text-xs py-2 ${!csvAllowed ? 'opacity-50' : ''}`}
            >
              <Download className="w-3.5 h-3.5" /> Export CSV
              {!csvAllowed && <AlertCircle className="w-3 h-3 text-amber-400" />}
            </button>
            {!csvAllowed && (
              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-56 bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-300 hidden group-hover:block z-10 pointer-events-none">
                Upgrade to Starter or higher to export leads.
              </div>
            )}
          </div>
          {bulkAllowed && (
            <span className="badge bg-violet-500/20 text-violet-400 text-xs">Bulk Actions Enabled</span>
          )}
          <button onClick={() => setShowForm(!showForm)} className="btn-primary text-xs py-2">
            <Plus className="w-3.5 h-3.5" /> Add Lead
          </button>
        </div>
      </div>

      {error && <ErrorAlert message={error} onClose={() => setError('')} />}

      {showForm && (
        <div className="card p-6">
          <h2 className="text-white font-semibold mb-5">Add Lead Manually</h2>
          <form onSubmit={handleAddLead} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-1.5">Business Name *</label>
              <input className="input" value={form.business_name} onChange={e => setForm(p => ({ ...p, business_name: e.target.value }))} placeholder="e.g. Smith Dental" />
            </div>
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-1.5">Industry</label>
              <select className="select" value={form.industry} onChange={e => setForm(p => ({ ...p, industry: e.target.value }))}>
                <option value="">Select industry</option>
                {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-1.5">Location</label>
              <input className="input" value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} placeholder="City, State" />
            </div>
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-1.5">Website</label>
              <input className="input" value={form.website} onChange={e => setForm(p => ({ ...p, website: e.target.value }))} placeholder="https://..." />
            </div>
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-1.5">Phone</label>
              <input className="input" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="+1 (555) 000-0000" />
            </div>
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-1.5">Email</label>
              <input className="input" type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="contact@business.com" />
            </div>
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-1.5">Google Rating</label>
              <input className="input" type="number" min="1" max="5" step="0.1" value={form.google_rating} onChange={e => setForm(p => ({ ...p, google_rating: e.target.value }))} placeholder="4.5" />
            </div>
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-1.5">Reviews Count</label>
              <input className="input" type="number" min="0" value={form.reviews_count} onChange={e => setForm(p => ({ ...p, reviews_count: e.target.value }))} placeholder="124" />
            </div>
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-1.5">Lead Search</label>
              <select className="select" value={form.lead_search_id} onChange={e => setForm(p => ({ ...p, lead_search_id: e.target.value }))}>
                <option value="">None</option>
                {searches.map(s => <option key={s.id} value={s.id}>{s.niche} — {s.location}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2 lg:col-span-3 flex gap-3 justify-end pt-2">
              <button type="button" onClick={() => { setShowForm(false); setError(''); }} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Add Lead'}</button>
            </div>
          </form>
        </div>
      )}

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input className="input pl-9" placeholder="Search leads..." value={filterQuery} onChange={e => setFilterQuery(e.target.value)} />
          {filterQuery && (
            <button onClick={() => setFilterQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <select className="select w-auto" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All Statuses</option>
          {LEAD_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="select w-auto" value={filterSearch} onChange={e => setFilterSearch(e.target.value)}>
          <option value="">All Searches</option>
          {searches.map(s => <option key={s.id} value={s.id}>{s.niche} — {s.location}</option>)}
        </select>
        <select className="select w-auto" value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}>
          <option value="created_at">Newest First</option>
          <option value="lead_score">Highest Score</option>
          <option value="business_name">A → Z</option>
        </select>
        {(filterStatus || filterSearch || filterQuery) && (
          <button onClick={() => { setFilterStatus(''); setFilterSearch(''); setFilterQuery(''); }} className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200 text-sm transition-colors">
            <X className="w-3.5 h-3.5" /> Clear
          </button>
        )}
      </div>

      {filteredLeads.length === 0 ? (
        <EmptyState
          icon={Filter}
          title={leads.length === 0 ? 'No leads yet' : 'No leads match your filters'}
          description={leads.length === 0 ? 'Add your first lead manually or import a CSV file.' : 'Try adjusting your filters.'}
          action={leads.length === 0 ? (
            <button onClick={() => setShowForm(true)} className="btn-primary">
              <Plus className="w-4 h-4" /> Add First Lead
            </button>
          ) : undefined}
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left px-5 py-3 text-slate-400 font-medium">Business</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium hidden md:table-cell">Industry</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium hidden lg:table-cell">Contact</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium hidden sm:table-cell">Rating</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Score</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Status</th>
                  <th className="text-right px-5 py-3 text-slate-400 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredLeads.map(lead => (
                  <tr key={lead.id} className="hover:bg-slate-800/30 transition-colors group">
                    <td className="px-5 py-3.5">
                      <div className="font-medium text-slate-200 truncate max-w-[180px]">{lead.business_name}</div>
                      <div className="text-slate-500 text-xs truncate max-w-[180px]">{lead.location}</div>
                    </td>
                    <td className="px-4 py-3.5 text-slate-400 hidden md:table-cell">{lead.industry || '—'}</td>
                    <td className="px-4 py-3.5 hidden lg:table-cell">
                      <div className="flex flex-col gap-1">
                        {lead.website && (
                          <a href={lead.website} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="flex items-center gap-1.5 text-blue-400 hover:text-blue-300 text-xs transition-colors truncate max-w-[160px]">
                            <Globe className="w-3 h-3 flex-shrink-0" />
                            {lead.website.replace(/^https?:\/\//, '')}
                          </a>
                        )}
                        {lead.email && (
                          <div className="flex items-center gap-1.5 text-slate-400 text-xs truncate max-w-[160px]">
                            <Mail className="w-3 h-3 flex-shrink-0" />
                            {lead.email}
                          </div>
                        )}
                        {lead.phone && (
                          <div className="flex items-center gap-1.5 text-slate-400 text-xs">
                            <Phone className="w-3 h-3 flex-shrink-0" />
                            {lead.phone}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 hidden sm:table-cell">
                      {lead.google_rating ? (
                        <div className="flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                          <span className="text-slate-300 text-xs">{lead.google_rating}</span>
                          <span className="text-slate-600 text-xs">({lead.reviews_count})</span>
                        </div>
                      ) : <span className="text-slate-600">—</span>}
                    </td>
                    <td className="px-4 py-3.5"><ScoreBadge score={lead.lead_score} size="sm" /></td>
                    <td className="px-4 py-3.5"><StatusBadge status={lead.status} /></td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2 justify-end">
                        <button onClick={() => setDeleteId(lead.id)} className="text-slate-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => onNavigate('lead-detail', { id: lead.id })} className="text-slate-400 hover:text-blue-400 transition-colors">
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-slate-800 text-slate-500 text-xs">
            Showing {filteredLeads.length} of {leads.length} leads
          </div>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="card p-6 w-full max-w-sm">
            <h3 className="text-white font-semibold mb-2">Delete Lead?</h3>
            <p className="text-slate-400 text-sm mb-6">This will permanently delete this lead and all its audits and messages.</p>
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
