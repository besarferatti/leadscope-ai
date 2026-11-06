import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import type Stripe from 'npm:stripe@17.7.0';
import { billingDb, proAmount, proCurrency, proPriceId, stripe, topUpAmounts, walletProduct } from '../_shared/stripe-billing.ts';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};
const json = (body: object, status = 200) => Response.json(body, { status, headers });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const token = req.headers.get('Authorization')?.match(/^Bearer (.+)$/i)?.[1];
    if (!token) return json({ error: 'Unauthorized' }, 401);
    const { data: { user }, error: authError } = await billingDb.auth.getUser(token);
    if (authError || !user) return json({ error: 'Unauthorized' }, 401);

    const { mode, amount, price_id, success_url, cancel_url } = await req.json();
    const subscription = mode === 'subscription';
    if (subscription ? (!proPriceId || (price_id != null && price_id !== proPriceId))
      : (mode !== 'payment' || !topUpAmounts.includes(amount))) {
      return json({ error: 'This checkout option is unavailable.' }, 400);
    }
    const origin = req.headers.get('Origin');
    for (const value of [success_url, cancel_url]) {
      if (typeof value !== 'string') return json({ error: 'Invalid checkout return URL.' }, 400);
      const url = URL.parse(value);
      if (!url || url.origin !== origin || (url.protocol !== 'https:' && url.hostname !== 'localhost')) {
        return json({ error: 'Invalid checkout return URL.' }, 400);
      }
    }
    const { data: profile, error: profileError } = await billingDb.from('user_profiles')
      .select('is_active').eq('id', user.id).single();
    if (profileError) throw profileError;
    if (!profile.is_active) return json({ error: 'An active account is required.' }, 403);

    const { data: customer, error: mappingError } = await billingDb.from('stripe_customers')
      .select('customer_id').eq('user_id', user.id).is('deleted_at', null).maybeSingle();
    if (mappingError) throw mappingError;
    let customerId = customer?.customer_id;
    if (!customerId) {
      const created = await stripe.customers.create({ metadata: { userId: user.id } },
        { idempotencyKey: 'leadscope-customer-' + user.id });
      const { error } = await billingDb.from('stripe_customers')
        .insert({ user_id: user.id, customer_id: created.id });
      // The live schema enforces one active mapping with a partial unique index.
      // A concurrent insert can win, so read the current mapping on a conflict.
      if (error && error.code !== '23505') throw error;
      const { data: saved, error: savedError } = await billingDb.from('stripe_customers')
        .select('customer_id').eq('user_id', user.id).is('deleted_at', null).single();
      if (savedError) throw savedError;
      customerId = saved.customer_id;
    }

    const checkout: Stripe.Checkout.SessionCreateParams = {
      customer: customerId, payment_method_types: ['card'],
      mode: subscription ? 'subscription' : 'payment', success_url, cancel_url,
      line_items: subscription ? [{ price: proPriceId!, quantity: 1 }] : [{
        quantity: 1,
        price_data: { currency: 'usd', unit_amount: amount, product_data: { name: 'LeadScope AI wallet credits' } },
      }],
      metadata: { leadscope: subscription ? 'pro_monthly' : walletProduct },
    };
    if (!subscription) {
      const session = await stripe.checkout.sessions.create(checkout);
      return json({ sessionId: session.id, url: session.url });
    }

    const price = await stripe.prices.retrieve(proPriceId!);
    if (!price.active || price.currency !== proCurrency || price.unit_amount !== proAmount
        || price.recurring?.interval !== 'month' || price.recurring.interval_count !== 1) {
      throw new Error('STRIPE_PRO_MONTHLY must reference the existing €69 monthly price.');
    }

    let previous: Stripe.Checkout.Session | undefined;
    for await (const session of stripe.checkout.sessions.list({ customer: customerId, limit: 25 })) {
      if (session.mode === 'subscription') {
        previous = session;
        break;
      }
    }
    for await (const current of stripe.subscriptions.list({ customer: customerId, status: 'all' })) {
      if (current.status !== 'canceled' && current.status !== 'incomplete_expired') {
        return json({ error: 'Manage your existing subscription in the billing portal.' }, 409);
      }
    }
    if (previous?.status === 'open') {
      if (previous.metadata?.leadscope === 'pro_monthly' && previous.url) {
        return json({ sessionId: previous.id, url: previous.url });
      }
      await stripe.checkout.sessions.expire(previous.id);
    }
    const session = await stripe.checkout.sessions.create(checkout, {
      idempotencyKey: 'leadscope-pro-' + (previous?.id ?? customerId),
    });
    return json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error('Checkout creation failed:', error);
    return json({ error: 'Unable to start checkout. Try again or contact support.' }, 503);
  }
});
