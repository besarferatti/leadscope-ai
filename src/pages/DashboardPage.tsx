import React, { useEffect, useState } from 'react';
import {
  Users, Search, TrendingUp, Star, ArrowRight, Plus, Shield,
  AlertTriangle, Clock, BarChart3, Zap, MessageSquare,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Lead, LeadSearch } from '../types';
import { StatusBadge } from '../components/ui/StatusBadge';
import { ScoreBadge } from '../components/ui/ScoreBadge';
import { formatDate } from '../lib/utils';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import {
  isAdmin, getPlanLimits, getTrialDaysLeft, isTrialExpired,
  getPlanBadgeColor, PLANS,
} from '../lib/plans';

interface Props {
  onNavigate: (page: string, params?: Record<string, string>) => void;
}

interface Stats {
  totalLeads: number;
  totalSearches: number;
  avgScore: number;
  interestedLeads: number;
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
        <span className="text-slate-300 text-xs font-medium">
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

export function DashboardPage({ onNavigate }: Props) {
  const { user, profile } = useAuth();
  const [stats, setStats] = useState<Stats>({ totalLeads: 0, totalSearches: 0, avgScore: 0, interestedLeads: 0 });
  const [recentLeads, setRecentLeads] = useState<Lead[]>([]);
  const [recentSearches, setRecentSearches] = useState<LeadSearch[]>([]);
  const [loading, setLoading] = useState(true);

  const admin = isAdmin(profile);
  const limits = getPlanLimits(profile);
  const trialDays = getTrialDaysLeft(profile);
  const trialExpired = isTrialExpired(profile);
  const planName = profile ? (PLANS[profile.current_plan]?.name ?? profile.current_plan) : '';
  const planBadge = profile ? getPlanBadgeColor(profile.current_plan) : '';

  useEffect(() => {
    async function load() {
      try {
        const [leadsRes, searchesRes] = await Promise.all([
          supabase.from('leads').select('*').order('created_at', { ascending: false }),
          supabase.from('lead_searches').select('*').order('created_at', { ascending: false }).limit(5),
        ]);

        const leads: Lead[] = leadsRes.data ?? [];
        const searches: LeadSearch[] = searchesRes.data ?? [];
        const totalLeads = leads.length;
        const avgScore = totalLeads ? Math.round(leads.reduce((a, l) => a + (l.lead_score || 0), 0) / totalLeads) : 0;

        setStats({ totalLeads, totalSearches: searches.length, avgScore, interestedLeads: leads.filter(l => l.status === 'Interested').length });
        setRecentLeads(leads.slice(0, 5));
        setRecentSearches(searches);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user]);

  if (loading) return <LoadingSpinner message="Loading dashboard..." />;

  const statCards = [
    { label: 'Total Leads', value: stats.totalLeads, icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: 'Lead Searches', value: stats.totalSearches, icon: Search, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'Avg. Lead Score', value: stats.avgScore, icon: TrendingUp, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { label: 'Interested', value: stats.interestedLeads, icon: Star, color: 'text-violet-400', bg: 'bg-violet-500/10' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-slate-400 text-sm mt-1">
            Welcome back{profile?.full_name ? `, ${profile.full_name}` : ''} — here's your lead overview.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {admin && (
            <button
              onClick={() => onNavigate('admin', { admin_page: 'overview' })}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500/25 text-sm font-medium transition-colors"
            >
              <Shield className="w-4 h-4" />
              Admin Panel
            </button>
          )}
          <button onClick={() => onNavigate('searches')} className="btn-primary">
            <Plus className="w-4 h-4" />
            New Lead Search
          </button>
        </div>
      </div>

      {/* Trial / expired banners */}
      {!admin && trialExpired && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/25">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-red-300 font-medium text-sm">Your free trial has ended.</p>
            <p className="text-red-400/70 text-xs mt-0.5">Upgrade your plan to continue generating leads, audits, and outreach messages.</p>
          </div>
          <button onClick={() => onNavigate('settings', { tab: 'billing' })} className="btn-primary text-xs py-1.5 flex-shrink-0">Upgrade Now</button>
        </div>
      )}
      {!admin && !trialExpired && profile?.current_plan === 'free_trial' && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-500/10 border border-blue-500/25">
          <Zap className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-blue-300 font-medium text-sm">
              {trialDays <= 3
                ? `Only ${trialDays} day${trialDays !== 1 ? 's' : ''} left in your free trial!`
                : `You're on the Free Trial — ${trialDays} days remaining.`}
            </p>
            <p className="text-blue-400/70 text-xs mt-0.5">Choose a plan to unlock more leads, AI audits, and outreach messages.</p>
          </div>
          <button onClick={() => onNavigate('settings', { tab: 'billing' })} className="btn-primary text-xs py-1.5 flex-shrink-0">Choose a Plan</button>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(card => (
          <div key={card.label} className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-slate-400 text-sm">{card.label}</p>
              <div className={`w-9 h-9 rounded-lg ${card.bg} flex items-center justify-center`}>
                <card.icon className={`w-[18px] h-[18px] ${card.color}`} />
              </div>
            </div>
            <p className="text-3xl font-bold text-white">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Usage / Plan card */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-semibold text-sm">Plan & Usage</h2>
            <span className={`badge text-xs ${planBadge}`}>{planName}</span>
          </div>

          {admin ? (
            <div className="space-y-3">
              <p className="text-slate-400 text-sm">Admin accounts have unlimited access to all features.</p>
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <Shield className="w-4 h-4 text-red-400" />
                <p className="text-red-400 text-xs font-medium">Unlimited — Admin Plan</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <UsageBar label="Leads" used={profile?.leads_used_this_month ?? 0} limit={limits.leadsLimit} icon={Users} />
              <UsageBar label="AI Audits" used={profile?.audits_used_this_month ?? 0} limit={limits.auditsLimit} icon={BarChart3} />
              <UsageBar label="Messages" used={profile?.messages_used_this_month ?? 0} limit={limits.messagesLimit} icon={MessageSquare} />

              {profile?.current_plan === 'free_trial' && !trialExpired && (
                <div className="flex items-center gap-2 pt-1">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <p className="text-amber-400 text-xs">{trialDays} day{trialDays !== 1 ? 's' : ''} left in trial</p>
                </div>
              )}
              {profile?.current_plan !== 'agency' && profile?.current_plan !== 'enterprise' && (
                <button onClick={() => onNavigate('settings', { tab: 'billing' })} className="btn-primary w-full text-xs py-2 mt-1">
                  <Zap className="w-3.5 h-3.5" /> Upgrade Plan
                </button>
              )}
            </div>
          )}
        </div>

        {/* Recent Leads */}
        <div className="card lg:col-span-1">
          <div className="flex items-center justify-between p-5 border-b border-slate-800">
            <h2 className="text-white font-semibold">Recent Leads</h2>
            <button onClick={() => onNavigate('leads')} className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1 transition-colors">
              View all <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          {recentLeads.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-slate-500 text-sm">No leads yet.</p>
              <button onClick={() => onNavigate('leads')} className="btn-primary mt-4 text-xs py-1.5 px-3">Add First Lead</button>
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {recentLeads.map(lead => (
                <button
                  key={lead.id}
                  onClick={() => onNavigate('lead-detail', { id: lead.id })}
                  className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-slate-800/50 transition-colors text-left"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-200 font-medium text-sm truncate">{lead.business_name}</p>
                    <p className="text-slate-500 text-xs truncate">{lead.location || lead.industry}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <ScoreBadge score={lead.lead_score} size="sm" />
                    <StatusBadge status={lead.status} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Recent Searches */}
        <div className="card">
          <div className="flex items-center justify-between p-5 border-b border-slate-800">
            <h2 className="text-white font-semibold">Recent Searches</h2>
            <button onClick={() => onNavigate('searches')} className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1 transition-colors">
              View all <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          {recentSearches.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-slate-500 text-sm">No searches yet.</p>
              <button onClick={() => onNavigate('searches')} className="btn-primary mt-4 text-xs py-1.5 px-3">Create Search</button>
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {recentSearches.map(s => (
                <div key={s.id} className="flex items-start gap-4 px-5 py-3.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-200 font-medium text-sm truncate">{s.niche}</p>
                    <p className="text-slate-500 text-xs truncate">{s.location} · {s.service_offer}</p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <span className={`badge ${s.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-300'}`}>
                      {s.status}
                    </span>
                    <p className="text-slate-600 text-xs mt-1">{formatDate(s.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
