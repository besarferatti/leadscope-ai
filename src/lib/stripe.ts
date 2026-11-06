import { supabase } from './supabase';
import type { BillingCycle, PlanId } from './plans';
import { functionErrorMessage } from './functionErrors';

export const TOP_UP_PACKS = [
  { cents: 1000, credits: 1000 }, { cents: 2500, credits: 2625 },
  { cents: 5000, credits: 5500 }, { cents: 10000, credits: 11500 },
] as const;

type CheckoutResult = { url: string | null; error: string | null };

export function createCheckoutSession(planId: PlanId, billingCycle: BillingCycle): Promise<CheckoutResult> {
  if (planId !== 'pro' || billingCycle !== 'monthly') {
    return Promise.resolve({ url: null, error: 'Only PRO monthly is available for new subscriptions.' });
  }
  return checkout({ mode: 'subscription' });
}

export function createTopUpSession(amount: (typeof TOP_UP_PACKS)[number]['cents']) {
  return checkout({ mode: 'payment', amount });
}

async function checkout(option: { mode: 'subscription' } | { mode: 'payment'; amount: number }): Promise<CheckoutResult> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { url: null, error: 'Not authenticated.' };

  const origin = window.location.origin;
  const { data, error } = await supabase.functions.invoke('stripe-checkout', {
    body: {
      ...option,
      success_url: origin + (option.mode === 'payment' ? '/?wallet=success' : '/?checkout=success'),
      cancel_url: origin + (option.mode === 'payment' ? '/?wallet=cancel' : '/?checkout=cancel'),
    },
    headers: { Authorization: 'Bearer ' + session.access_token },
  });
  if (error) return { url: null, error: await functionErrorMessage(error) };
  return { url: data?.url ?? null, error: data?.error ?? null };
}

export async function createPortalSession(): Promise<CheckoutResult> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { url: null, error: 'Not authenticated.' };

  const { data, error } = await supabase.functions.invoke('stripe-portal', {
    body: { return_url: window.location.origin + '/?portal=return' },
    headers: { Authorization: 'Bearer ' + session.access_token },
  });

  if (error) return { url: null, error: await functionErrorMessage(error) };
  if (data?.error) return { url: null, error: data.error };
  return { url: data?.url ?? null, error: null };
}
