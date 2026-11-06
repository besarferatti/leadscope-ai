import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import type Stripe from 'npm:stripe@17.7.0';
import { billingDb, grantPaidInvoice, stripe, stripeId, syncCustomerSubscription, walletProduct } from '../_shared/stripe-billing.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const signature = req.headers.get('stripe-signature');
  if (!signature) return new Response('Missing signature', { status: 400 });

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      await req.text(), signature, Deno.env.get('STRIPE_WEBHOOK_SECRET')!,
    );
  } catch (error) {
    console.error('Invalid Stripe signature:', error);
    return new Response('Invalid signature', { status: 400 });
  }

  try {
    await handleEvent(event);
    return Response.json({ received: true });
  } catch (error) {
    console.error('Stripe webhook processing failed:', event.id, error);
    return new Response('Retry webhook', { status: 500 });
  }
});

async function handleEvent(event: Stripe.Event) {
  switch (event.type) {
    case 'invoice.paid': {
      const invoice = await stripe.invoices.retrieve(event.data.object.id);
      const customer = stripeId(invoice.customer);
      if (!customer || !invoice.subscription) return;
      if (await syncCustomerSubscription(customer)) await grantPaidInvoice(invoice, customer);
      return;
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const customer = stripeId(event.data.object.customer);
      if (customer) await syncCustomerSubscription(customer);
      return;
    }
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded': {
      const session = event.data.object;
      const customer = stripeId(session.customer);
      if (!customer) return;
      if (session.mode === 'subscription') {
        await syncCustomerSubscription(customer, true);
        return;
      }
      if (session.mode !== 'payment' || session.payment_status !== 'paid') return;
      const intent = stripeId(session.payment_intent);
      if (!intent) throw new Error('Paid Checkout session is missing its PaymentIntent');
      const { error } = await billingDb.rpc('record_paid_checkout', {
        p_customer: customer, p_session: session.id, p_intent: intent,
        p_subtotal: session.amount_subtotal, p_total: session.amount_total,
        p_currency: session.currency, p_wallet: session.metadata?.leadscope === walletProduct,
      });
      if (error) throw error;
    }
  }
}
