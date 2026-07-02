import { supabase } from './supabase';

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
    name: 'Free Trial',
    monthlyPrice: 0,
    yearlyPrice: 0,
    leadsLimit: 50,
    auditsLimit: 25,
    messagesLimit: 25,
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
    monthlyPrice: 19,
    yearlyPrice: 190,
    leadsLimit: 500,
    auditsLimit: 100,
    messagesLimit: 100,
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
    monthlyPrice: 49,
    yearlyPrice: 490,
    leadsLimit: 2500,
    auditsLimit: 500,
    messagesLimit: 500,
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
    monthlyPrice: 99,
    yearlyPrice: 990,
    leadsLimit: 10000,
    auditsLimit: 2000,
    messagesLimit: 2000,
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

export const PLAN_DISPLAY_ORDER: PlanId[] = ['free_trial', 'starter', 'pro', 'agency', 'enterprise'];

// Map plan IDs + billing cycles to Stripe price IDs.
// Replace these with your actual Stripe price IDs from the Stripe dashboard.
export const STRIPE_PRICE_IDS: Partial<Record<PlanId, { monthly: string; yearly: string }>> = {
  starter: {
    monthly: import.meta.env.VITE_STRIPE_STARTER_MONTHLY ?? '',
    yearly: import.meta.env.VITE_STRIPE_STARTER_YEARLY ?? '',
  },
  pro: {
    monthly: import.meta.env.VITE_STRIPE_PRO_MONTHLY ?? '',
    yearly: import.meta.env.VITE_STRIPE_PRO_YEARLY ?? '',
  },
  agency: {
    monthly: import.meta.env.VITE_STRIPE_AGENCY_MONTHLY ?? '',
    yearly: import.meta.env.VITE_STRIPE_AGENCY_YEARLY ?? '',
  },
};

export function getStripePriceId(planId: PlanId, billingCycle: BillingCycle): string | null {
  return STRIPE_PRICE_IDS[planId]?.[billingCycle] ?? null;
}

// Map Stripe price IDs back to plan IDs (used by webhook sync)
export function getPlanFromPriceId(priceId: string): PlanId | null {
  for (const [planId, cycles] of Object.entries(STRIPE_PRICE_IDS)) {
    if (cycles && (cycles.monthly === priceId || cycles.yearly === priceId)) {
      return planId as PlanId;
    }
  }
  return null;
}

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

function baseCheck(profile: UserProfile | null): { allowed: boolean; message?: string } | null {
  if (!profile) return { allowed: false, message: 'Not authenticated.' };
  if (!profile.is_active) return { allowed: false, message: 'Your account is inactive. Please contact support.' };
  if (isAdmin(profile)) return { allowed: true };
  if (isTrialExpired(profile)) return { allowed: false, message: 'Your free trial has ended. Upgrade your plan to continue using LeadScope AI.' };
  return null;
}

export function canGenerateLead(profile: UserProfile | null): { allowed: boolean; message?: string } {
  const base = baseCheck(profile);
  if (base) return base;
  const limits = getPlanLimits(profile);
  if (limits.leadsLimit !== -1 && profile!.leads_used_this_month >= limits.leadsLimit) {
    return { allowed: false, message: "You've reached your monthly lead limit. Upgrade your plan to continue generating more leads." };
  }
  return { allowed: true };
}

export function canRunAudit(profile: UserProfile | null): { allowed: boolean; message?: string } {
  const base = baseCheck(profile);
  if (base) return base;
  const limits = getPlanLimits(profile);
  if (limits.auditsLimit !== -1 && profile!.audits_used_this_month >= limits.auditsLimit) {
    return { allowed: false, message: "You've reached your monthly AI audit limit. Upgrade your plan to analyze more websites." };
  }
  return { allowed: true };
}

export function canGenerateMessage(profile: UserProfile | null): { allowed: boolean; message?: string } {
  const base = baseCheck(profile);
  if (base) return base;
  const limits = getPlanLimits(profile);
  if (limits.messagesLimit !== -1 && profile!.messages_used_this_month >= limits.messagesLimit) {
    return { allowed: false, message: "You've reached your monthly outreach message limit. Upgrade your plan to generate more personalized messages." };
  }
  return { allowed: true };
}

export function canExportCSV(profile: UserProfile | null): boolean {
  if (!profile) return false;
  if (isAdmin(profile)) return true;
  if (isTrialExpired(profile)) return false;
  return getPlanLimits(profile).csvExport;
}

export function canUseBulkActions(profile: UserProfile | null): boolean {
  if (!profile) return false;
  if (isAdmin(profile)) return true;
  if (isTrialExpired(profile)) return false;
  return getPlanLimits(profile).bulkActions;
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

// Increment usage counters; pass the userId since we don't want to couple to AuthContext
export async function incrementUsage(
  userId: string,
  type: 'leads' | 'audits' | 'messages',
  amount = 1
): Promise<void> {
  const field = type === 'leads'
    ? 'leads_used_this_month'
    : type === 'audits'
    ? 'audits_used_this_month'
    : 'messages_used_this_month';

  // Fetch current value then increment (Supabase doesn't support atomic increment via REST easily)
  const { data } = await supabase
    .from('user_profiles')
    .select(field)
    .eq('id', userId)
    .maybeSingle();

  const current = (data as Record<string, number> | null)?.[field] ?? 0;
  await supabase
    .from('user_profiles')
    .update({ [field]: current + amount, updated_at: new Date().toISOString() })
    .eq('id', userId);
}

// Reset monthly usage if 30+ days have passed; returns updated profile
export async function resetUsageIfNeeded(profile: UserProfile): Promise<UserProfile> {
  if (isAdmin(profile)) return profile;
  const cycleStart = new Date(profile.usage_cycle_started_at);
  const daysPassed = (Date.now() - cycleStart.getTime()) / (1000 * 60 * 60 * 24);
  if (daysPassed < 30) return profile;

  const updates = {
    leads_used_this_month: 0,
    audits_used_this_month: 0,
    messages_used_this_month: 0,
    usage_cycle_started_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  await supabase.from('user_profiles').update(updates).eq('id', profile.id);
  return { ...profile, ...updates };
}
