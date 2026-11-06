import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { billingDb, syncCustomerSubscription } from '../_shared/stripe-billing.ts';

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

    const { data, error } = await billingDb.from('stripe_customers')
      .select('customer_id').eq('user_id', user.id).is('deleted_at', null).maybeSingle();
    if (error) throw error;
    const subscription = data ? await syncCustomerSubscription(data.customer_id, true) : null;
    return json(subscription ? { ...subscription, synced: true } : { plan: 'free_trial', synced: false });
  } catch (error) {
    console.error('Subscription sync failed:', error);
    return json({ error: 'Unable to sync billing.' }, 503);
  }
});
