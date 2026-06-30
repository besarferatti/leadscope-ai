import { useEffect, useState } from 'react';
import { Users, Search, FileText, MessageSquare, TrendingUp, UserCheck, Zap } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';

interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  trialUsers: number;
  paidUsers: number;
  totalLeads: number;
  totalAudits: number;
  totalMessages: number;
  leadsThisMonth: number;
  auditsThisMonth: number;
  messagesThisMonth: number;
}

export function AdminOverview() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const [usersRes, leadsRes, auditsRes, messagesRes] = await Promise.all([
        supabase.from('user_profiles').select('subscription_status, is_active'),
        supabase.from('leads').select('created_at'),
        supabase.from('lead_audits').select('created_at'),
        supabase.from('outreach_messages').select('created_at'),
      ]);

      const users = usersRes.data ?? [];
      const leads = leadsRes.data ?? [];
      const audits = auditsRes.data ?? [];
      const messages = messagesRes.data ?? [];

      setStats({
        totalUsers: users.length,
        activeUsers: users.filter(u => u.is_active).length,
        trialUsers: users.filter(u => u.subscription_status === 'trialing').length,
        paidUsers: users.filter(u => u.subscription_status === 'active').length,
        totalLeads: leads.length,
        totalAudits: audits.length,
        totalMessages: messages.length,
        leadsThisMonth: leads.filter(l => l.created_at >= monthStart).length,
        auditsThisMonth: audits.filter(a => a.created_at >= monthStart).length,
        messagesThisMonth: messages.filter(m => m.created_at >= monthStart).length,
      });
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <LoadingSpinner message="Loading stats..." />;
  if (!stats) return null;

  const cards = [
    { label: 'Total Users', value: stats.totalUsers, icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: 'Active Users', value: stats.activeUsers, icon: UserCheck, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'Trial Users', value: stats.trialUsers, icon: Zap, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { label: 'Paid Users', value: stats.paidUsers, icon: TrendingUp, color: 'text-violet-400', bg: 'bg-violet-500/10' },
    { label: 'Total Leads', value: stats.totalLeads, icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: 'Total Audits', value: stats.totalAudits, icon: FileText, color: 'text-slate-400', bg: 'bg-slate-700' },
    { label: 'Total Messages', value: stats.totalMessages, icon: MessageSquare, color: 'text-violet-400', bg: 'bg-violet-500/10' },
    { label: 'Leads This Month', value: stats.leadsThisMonth, icon: Search, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'Audits This Month', value: stats.auditsThisMonth, icon: FileText, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: 'Messages This Month', value: stats.messagesThisMonth, icon: MessageSquare, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Admin Overview</h1>
        <p className="text-slate-400 text-sm mt-1">System-wide statistics for LeadScope AI.</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {cards.map(card => (
          <div key={card.label} className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-slate-400 text-xs">{card.label}</p>
              <div className={`w-8 h-8 rounded-lg ${card.bg} flex items-center justify-center`}>
                <card.icon className={`w-4 h-4 ${card.color}`} />
              </div>
            </div>
            <p className="text-2xl font-bold text-white">{card.value.toLocaleString()}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
