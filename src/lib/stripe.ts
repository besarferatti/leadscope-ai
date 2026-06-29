import { supabase } from './supabase';
import { BillingCycle, PlanId, getStripePriceId } from './plans';

export async function createCheckoutSession(
  planId: PlanId,
  billingCycle: BillingCycle,
): Promise<{ url: string | null; error: string | null }> {
  const priceId = getStripePriceId(planId, billingCycle);
  if (!priceId) {
    return { url: null, error: 'No Stripe price configured for this plan. Please contact support.' };
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { url: null, error: 'Not authenticated.' };

  const origin = window.location.origin;
  const { data, error } = await supabase.functions.invoke('stripe-checkout', {
    body: {
      price_id: priceId,
      mode: 'subscription',
      success_url: `${origin}/?checkout=success`,
      cancel_url: `${origin}/?checkout=cancel`,
    },
    headers: { Authorization: `Bearer ${session.access_token}` },
  });

  if (error) return { url: null, error: error.message };
  if (data?.error) return { url: null, error: data.error };
  return { url: data?.url ?? null, error: null };
}

export async function createPortalSession(): Promise<{ url: string | null; error: string | null }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { url: null, error: 'Not authenticated.' };

  const { data, error } = await supabase.functions.invoke('stripe-portal', {
    body: { return_url: `${window.location.origin}/?portal=return` },
    headers: { Authorization: `Bearer ${session.access_token}` },
  });

  if (error) return { url: null, error: error.message };
  if (data?.error) return { url: null, error: data.error };
  return { url: data?.url ?? null, error: null };
}
