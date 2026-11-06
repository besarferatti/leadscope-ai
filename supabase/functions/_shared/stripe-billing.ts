import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

export const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!);
export const billingDb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
export const proPriceId = Deno.env.get('STRIPE_PRO_MONTHLY');
export const proCurrency = 'eur';
export const proAmount = 6900;
export const walletProduct = 'leadscope_credit_topup_v1';
export const topUpAmounts = [1000, 2500, 5000, 10000];

export function stripeId(value: string | { id: string } | null | undefined) {
  return typeof value === 'string' ? value : value?.id;
}

export async function grantPaidInvoice(invoice: Stripe.Invoice, customer: string) {
  const subscription = stripeId(invoice.subscription);
  if (!subscription || !proPriceId || invoice.status !== 'paid' || invoice.amount_paid <= 0 || invoice.currency !== proCurrency
      || !['subscription_create', 'subscription_cycle'].includes(invoice.billing_reason ?? '')) return;

  // Read the full line collection from the SDK's API version, independent of the event payload version.
  for await (const line of stripe.invoices.listLineItems(invoice.id)) {
    if (line.price?.id !== proPriceId || line.type !== 'subscription' || line.proration
        || line.quantity !== 1 || line.amount !== proAmount) continue;
    const { error } = await billingDb.rpc('grant_monthly_credits', {
      p_customer: customer,
      p_subscription: subscription,
      p_start: line.period.start,
      p_end: line.period.end,
    });
    if (error) throw error;
  }
}

export async function syncCustomerSubscription(customer: string, reconcileCredits = false) {
  const { data: mapping, error: mappingError } = await billingDb.from('stripe_customers')
    .select('user_id').eq('customer_id', customer).is('deleted_at', null).maybeSingle();
  if (mappingError) throw mappingError;
  if (!mapping) return null;

  const { data: subscriptions } = await stripe.subscriptions.list({
    customer, limit: 10, status: 'all', expand: ['data.default_payment_method'],
  });
  const subscription = subscriptions.find(s => s.status === 'active' || s.status === 'trialing') ?? subscriptions[0];
  if (!subscription) return null;

  const price = subscription.items.data[0]?.price;
  const paymentMethod = subscription.default_payment_method;
  const { error: subError } = await billingDb.from('stripe_subscriptions').upsert({
    customer_id: customer,
    subscription_id: subscription.id,
    price_id: price?.id ?? null,
    current_period_start: subscription.current_period_start,
    current_period_end: subscription.current_period_end,
    cancel_at_period_end: subscription.cancel_at_period_end,
    payment_method_brand: typeof paymentMethod === 'object' ? paymentMethod?.card?.brand ?? null : null,
    payment_method_last4: typeof paymentMethod === 'object' ? paymentMethod?.card?.last4 ?? null : null,
    status: subscription.status,
  }, { onConflict: 'customer_id' });
  if (subError) throw subError;

  const historicalPrices = {
    STRIPE_STARTER_MONTHLY: 'starter', STRIPE_STARTER_YEARLY: 'starter',
    STRIPE_PRO_MONTHLY: 'pro', STRIPE_PRO_YEARLY: 'pro',
    STRIPE_AGENCY_MONTHLY: 'agency', STRIPE_AGENCY_YEARLY: 'agency',
  };
  const plan = Object.entries(historicalPrices).find(([key]) => price?.id && price.id === Deno.env.get(key))?.[1];
  const status = subscription.status;
  const updates: Record<string, string> = { subscription_status: status, updated_at: new Date().toISOString() };
  if (plan && (status === 'active' || status === 'trialing')) {
    updates.current_plan = plan;
    updates.billing_cycle = price?.recurring?.interval === 'year' ? 'yearly' : 'monthly';
  } else if (status === 'canceled' || status === 'unpaid' || status === 'incomplete_expired') {
    updates.current_plan = 'free_trial';
  }
  const { data: profile, error: profileError } = await billingDb.from('user_profiles')
    .update(updates).eq('id', mapping.user_id).select('current_plan').single();
  if (profileError) throw profileError;

  if (reconcileCredits && price?.id === proPriceId && (status === 'active' || status === 'past_due')) {
    // Covers existing PRO customers whose current-cycle payment predates the wallet.
    const { data: invoices } = await stripe.invoices.list({
      customer, subscription: subscription.id, status: 'paid', limit: 10,
    });
    for (const invoice of invoices.filter(i => i.period_end >= subscription.current_period_start)) {
      await grantPaidInvoice(invoice, customer);
    }
  }
  return { plan: profile.current_plan, status };
}
