# Credit wallet staging checklist

New subscriptions use the existing `STRIPE_PRO_MONTHLY` price. In staging, set this to an active USD 6,900-cent monthly test price. Keep the legacy price IDs for subscription status sync. Existing Stripe subscriptions, orders, and historical counters are retained. Active legacy Stripe customers keep included access while their subscription remains active.

1. Start from a staging database with the existing Stripe and profile schema. Apply the profile authorization migration from PR #121 before the credit wallet migration. Fresh schema replay remains blocked by duplicate historical Stripe migrations.
2. Configure the Stripe test webhook for `invoice.paid`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `checkout.session.completed`, and `checkout.session.async_payment_succeeded`. The Supabase webhook endpoint must accept Stripe's signed requests without a Supabase JWT.
3. Set `STRIPE_MANAGE_ONLY_PORTAL_CONFIG` to an active staging portal configuration with subscription updates disabled. Enable cancellation, invoice history, and payment method updates as appropriate. The application rejects portal configurations that allow plan switches.
4. Verify a new PRO Checkout, a renewal, and a current paid PRO account from before the wallet. The Billing page's **Refresh wallet** button reconciles the current paid cycle for existing PRO customers. Replay the paid invoice and confirm the grant remains 7,400 credits. Verify that a stale invoice cannot add spendable credits after its period ends.
5. Run each of the four test-mode top-ups and replay its Checkout events. Verify that each grants once, appears in order history, and has no expiry. Confirm monthly credits are spent first, including when one debit spans both pools.
6. Verify that legacy Checkout prices are rejected and legacy subscription history is still visible. Confirm that two simultaneous actions competing for a balance sufficient for only one produce a single debit and one insufficient-credit response.

The configured price is charged once per started provider attempt, including attempts without results. An automatic discovery retry starts a new attempt. Stripe refunds and disputes require manual wallet reconciliation before production rollout.
