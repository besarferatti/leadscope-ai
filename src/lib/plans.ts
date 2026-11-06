export type PlanId = 'free_trial' | 'starter' | 'pro' | 'agency' | 'enterprise' | 'admin_unlimited';
export type BillingCycle = 'monthly' | 'yearly';

export interface PlanConfig {
  id: PlanId;
  name: string;
  monthlyPrice: number | null;
  yearlyPrice: number | null;
  leadsLimit: number; // -1 = unlimited
  auditsLimit: number;
  messagesLimit: number;
  websitePreviewsLimit: number;
  usersLimit: number;
  csvExport: boolean;
  bulkActions: boolean;
  googlePlacesSearch: boolean;
  savedTemplates: boolean;
  multipleWorkspaces: boolean;
  customLeadScoring: boolean;
  prioritySupport: boolean;
  apiAccess: boolean;
  whiteLabel: boolean;
  popular?: boolean;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'user';
  current_plan: PlanId;
  billing_cycle: BillingCycle;
  subscription_status: string;
  trial_started_at: string;
  trial_ends_at: string;
  leads_used_this_month: number;
  audits_used_this_month: number;
  messages_used_this_month: number;
  usage_cycle_started_at: string;
  is_active: boolean;
  must_change_password: boolean;
  created_at: string;
  updated_at: string;
}

export const PLANS: Record<PlanId, PlanConfig> = {
  free_trial: {
    id: 'free_trial',
    name: 'Free CRM',
    monthlyPrice: 0,
    yearlyPrice: 0,
    leadsLimit: 100,
    auditsLimit: 25,
    messagesLimit: 25,
    websitePreviewsLimit: 5,
    usersLimit: 1,
    csvExport: false,
    bulkActions: false,
    googlePlacesSearch: true,
    savedTemplates: false,
    multipleWorkspaces: false,
    customLeadScoring: false,
    prioritySupport: false,
    apiAccess: false,
    whiteLabel: false,
  },
  starter: {
    id: 'starter',
    name: 'Starter',
    monthlyPrice: 29,
    yearlyPrice: 290,
    leadsLimit: 500,
    auditsLimit: 100,
    messagesLimit: 100,
    websitePreviewsLimit: 25,
    usersLimit: 1,
    csvExport: true,
    bulkActions: false,
    googlePlacesSearch: true,
    savedTemplates: false,
    multipleWorkspaces: false,
    customLeadScoring: false,
    prioritySupport: false,
    apiAccess: false,
    whiteLabel: false,
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    monthlyPrice: 69,
    yearlyPrice: 690,
    leadsLimit: 2500,
    auditsLimit: 500,
    messagesLimit: 500,
    websitePreviewsLimit: 150,
    usersLimit: 3,
    csvExport: true,
    bulkActions: true,
    googlePlacesSearch: true,
    savedTemplates: true,
    multipleWorkspaces: false,
    customLeadScoring: false,
    prioritySupport: false,
    apiAccess: false,
    whiteLabel: false,
    popular: true,
  },
  agency: {
    id: 'agency',
    name: 'Agency',
    monthlyPrice: 149,
    yearlyPrice: 1490,
    leadsLimit: 10000,
    auditsLimit: 2000,
    messagesLimit: 2000,
    websitePreviewsLimit: 500,
    usersLimit: 10,
    csvExport: true,
    bulkActions: true,
    googlePlacesSearch: true,
    savedTemplates: true,
    multipleWorkspaces: true,
    customLeadScoring: true,
    prioritySupport: true,
    apiAccess: false,
    whiteLabel: false,
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    monthlyPrice: null,
    yearlyPrice: null,
    leadsLimit: -1,
    auditsLimit: -1,
    messagesLimit: -1,
    websitePreviewsLimit: -1,
    usersLimit: -1,
    csvExport: true,
    bulkActions: true,
    googlePlacesSearch: true,
    savedTemplates: true,
    multipleWorkspaces: true,
    customLeadScoring: true,
    prioritySupport: true,
    apiAccess: true,
    whiteLabel: true,
  },
  admin_unlimited: {
    id: 'admin_unlimited',
    name: 'Admin Unlimited',
    monthlyPrice: null,
    yearlyPrice: null,
    leadsLimit: -1,
    auditsLimit: -1,
    messagesLimit: -1,
    websitePreviewsLimit: -1,
    usersLimit: -1,
    csvExport: true,
    bulkActions: true,
    googlePlacesSearch: true,
    savedTemplates: true,
    multipleWorkspaces: true,
    customLeadScoring: true,
    prioritySupport: true,
    apiAccess: true,
    whiteLabel: true,
  },
};

export const CHANGEABLE_PLANS: { id: PlanId; label: string }[] = [
  { id: 'free_trial', label: 'Free Trial' },
  { id: 'starter', label: 'Starter' },
  { id: 'pro', label: 'Pro' },
  { id: 'agency', label: 'Agency' },
  { id: 'enterprise', label: 'Enterprise' },
  { id: 'admin_unlimited', label: 'Admin Unlimited' },
];

export function isAdmin(profile: UserProfile | null): boolean {
  return profile?.role === 'admin';
}

export function getPlanLimits(profile: UserProfile | null): PlanConfig {
  if (!profile) return PLANS.free_trial;
  if (isAdmin(profile)) return PLANS.admin_unlimited;
  return PLANS[profile.current_plan] ?? PLANS.free_trial;
}

export function isTrialExpired(profile: UserProfile | null): boolean {
  if (!profile || isAdmin(profile)) return false;
  if (profile.current_plan !== 'free_trial') return false;
  return new Date(profile.trial_ends_at) < new Date();
}

export function getTrialDaysLeft(profile: UserProfile | null): number {
  if (!profile || profile.current_plan !== 'free_trial') return 0;
  const diff = new Date(profile.trial_ends_at).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export function canRunAudit(profile: UserProfile | null): { allowed: boolean; message?: string } {
  if (!profile?.is_active) return { allowed: false, message: 'An active account is required.' };
  return { allowed: true };
}

export const canGenerateMessage = canRunAudit;

export function canExportCSV(profile: UserProfile | null): boolean {
  return Boolean(profile?.is_active);
}

export function getPlanBadgeColor(plan: PlanId | string): string {
  switch (plan) {
    case 'free_trial': return 'bg-slate-700 text-slate-300';
    case 'starter': return 'bg-blue-500/20 text-blue-400';
    case 'pro': return 'bg-violet-500/20 text-violet-400';
    case 'agency': return 'bg-amber-500/20 text-amber-400';
    case 'enterprise': return 'bg-emerald-500/20 text-emerald-400';
    case 'admin_unlimited': return 'bg-red-500/20 text-red-400';
    default: return 'bg-slate-700 text-slate-300';
  }
}

export function getSubscriptionStatusColor(status: string): string {
  switch (status) {
    case 'active': return 'bg-emerald-500/20 text-emerald-400';
    case 'trialing': return 'bg-blue-500/20 text-blue-400';
    case 'trial_expired': return 'bg-red-500/20 text-red-400';
    case 'canceled': return 'bg-red-500/20 text-red-400';
    case 'past_due': return 'bg-amber-500/20 text-amber-400';
    default: return 'bg-slate-700 text-slate-300';
  }
}
