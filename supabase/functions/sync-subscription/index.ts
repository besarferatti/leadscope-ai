import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!);
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Find this user's Stripe customer record
    const { data: customerRow } = await supabase
      .from('stripe_customers')
      .select('customer_id')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .maybeSingle();

    if (!customerRow?.customer_id) {
      return new Response(JSON.stringify({ plan: 'free_trial', synced: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const customerId = customerRow.customer_id;

    // Fetch latest subscription directly from Stripe
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      limit: 1,
      status: 'all',
      expand: ['data.default_payment_method'],
    });

    if (subscriptions.data.length === 0) {
      return new Response(JSON.stringify({ plan: 'free_trial', synced: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const subscription = subscriptions.data[0];
    const priceId = subscription?.items?.data[0]?.price?.id ?? null;

    // Map price IDs to plan slugs using edge function secrets
    const priceMap: Record<string, string> = {
      [Deno.env.get('STRIPE_STARTER_MONTHLY') ?? '']: 'starter',
      [Deno.env.get('STRIPE_STARTER_YEARLY') ?? '']: 'starter',
      [Deno.env.get('STRIPE_PRO_MONTHLY') ?? '']: 'pro',
      [Deno.env.get('STRIPE_PRO_YEARLY') ?? '']: 'pro',
      [Deno.env.get('STRIPE_AGENCY_MONTHLY') ?? '']: 'agency',
      [Deno.env.get('STRIPE_AGENCY_YEARLY') ?? '']: 'agency',
    };

    const planId = priceId ? (priceMap[priceId] ?? null) : null;
    const isActive = subscription.status === 'active' || subscription.status === 'trialing';

    // Sync stripe_subscriptions
    await supabase.from('stripe_subscriptions').upsert(
      {
        customer_id: customerId,
        subscription_id: subscription.id,
        price_id: priceId,
        current_period_start: subscription.current_period_start,
        current_period_end: subscription.current_period_end,
        cancel_at_period_end: subscription.cancel_at_period_end,
        ...(subscription.default_payment_method &&
          typeof subscription.default_payment_method !== 'string'
          ? {
              payment_method_brand: subscription.default_payment_method.card?.brand ?? null,
              payment_method_last4: subscription.default_payment_method.card?.last4 ?? null,
            }
          : {}),
        status: subscription.status,
      },
      { onConflict: 'customer_id' },
    );

    // Build user_profiles updates
    const updates: Record<string, string> = {
      subscription_status: subscription.status,
      updated_at: new Date().toISOString(),
    };

    if (planId && isActive) {
      updates.current_plan = planId;
    } else if (
      subscription.status === 'canceled' ||
      subscription.status === 'unpaid'
    ) {
      updates.current_plan = 'free_trial';
    }

    await supabase.from('user_profiles').update(updates).eq('id', user.id);

    const resolvedPlan = updates.current_plan ?? 'free_trial';
    console.info(`Synced user ${user.id} → plan=${resolvedPlan} status=${subscription.status}`);

    return new Response(
      JSON.stringify({ plan: resolvedPlan, status: subscription.status, synced: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error: any) {
    console.error('sync-subscription error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
