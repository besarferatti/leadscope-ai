import { useEffect, useState } from 'react';
import { Users, Search, FileText, MessageSquare, TrendingUp, UserCheck, Zap, DollarSign } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { PLANS, type PlanId } from '../../lib/plans';

interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  trialUsers: number;
  paidUsers: number;
  estimatedMRR: number;
  estimatedARR: number;
  averageRevenuePerPaidUser: number;
  totalLeads: number;
  totalAudits: number;
  totalMessages: number;
  leadsThisMonth: number;
  auditsThisMonth: number;
  messagesThisMonth: number;
}

const PAID_PLAN_IDS: PlanId[] = ['starter', 'pro', 'agency'];

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

export function AdminOverview() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const [usersRes, leadsRes, auditsRes, messagesRes] = await Promise.all([
        supabase.from('user_profiles').select('current_plan, billing_cycle, subscription_status, is_active, role'),
        supabase.from('leads').select('created_at'),
        supabase.from('lead_audits').select('created_at'),
        supabase.from('outreach_messages').select('created_at'),
      ]);

      const users = usersRes.data ?? [];
      const leads = leadsRes.data ?? [];
      const audits = auditsRes.data ?? [];
      const messages = messagesRes.data ?? [];

      const activePaidUsers = users.filter(user => (
        user.subscription_status === 'active' &&
        user.is_active === true &&
        user.role !== 'admin' &&
        PAID_PLAN_IDS.includes(user.current_plan as PlanId)
      ));

      const estimatedMRR = activePaidUsers.reduce((total, user) => {
        const plan = PLANS[user.current_plan as PlanId];

        if (user.billing_cycle === 'yearly') {
          return total + ((plan.yearlyPrice ?? 0) / 12);
        }

        return total + (plan.monthlyPrice ?? 0);
      }, 0);

      setStats({
        totalUsers: users.length,
        activeUsers: users.filter(u => u.is_active).length,
        trialUsers: users.filter(u => u.subscription_status === 'trialing').length,
        paidUsers: activePaidUsers.length,
        estimatedMRR,
        estimatedARR: estimatedMRR * 12,
        averageRevenuePerPaidUser: activePaidUsers.length > 0 ? estimatedMRR / activePaidUsers.length : 0,
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
    { label: 'Estimated MRR', value: formatCurrency(stats.estimatedMRR), icon: DollarSign, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'Estimated ARR', value: formatCurrency(stats.estimatedARR), icon: DollarSign, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: 'Average Revenue Per Paid User', value: formatCurrency(stats.averageRevenuePerPaidUser), icon: TrendingUp, color: 'text-amber-400', bg: 'bg-amber-500/10' },
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
            <p className="text-2xl font-bold text-white">{typeof card.value === 'number' ? card.value.toLocaleString() : card.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
