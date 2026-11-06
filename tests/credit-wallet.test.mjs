import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const owner = randomUUID();
const other = randomUUID();
const admin = randomUUID();
const epoch = Math.floor(Date.now() / 1000);
const migrate = async (name) => db.exec(await readFile(new URL('../supabase/migrations/' + name, import.meta.url), 'utf8'));

async function as(role, id, query, params) {
  await db.exec('BEGIN');
  try {
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [id]);
    await db.exec('SET LOCAL ROLE ' + role);
    const result = await db.query(query, params);
    await db.exec('COMMIT');
    return result.rows;
  } catch (error) {
    await db.exec('ROLLBACK');
    throw error;
  }
}

const balance = async (id = owner) => (await as('authenticated', id, 'SELECT * FROM get_credit_balance()'))[0];
const grant = (start, end) => as('service_role', owner, 'SELECT grant_monthly_credits($1, $2, $3, $4)',
  ['cus_owner', 'sub_pro', start, end]);
const topUp = (session, intent, amount, currency = 'usd') => as('service_role', owner,
  'SELECT record_paid_checkout($1, $2, $3, $4, $4, $5, true)', ['cus_owner', session, intent, amount, currency]);
const spend = async (action, id = randomUUID(), user = owner) => (await as('service_role', user,
  'SELECT spend_credits($1, $2, $3) AS result', [user, action, id]))[0].result;
const setPrice = (credits, id = admin) => as('authenticated', id,
  "SELECT set_credit_price('website_analysis', $1)", [credits]);

before(async () => {
  await db.exec(`
    CREATE ROLE anon NOLOGIN;
    CREATE ROLE authenticated NOLOGIN;
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users (
      id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb DEFAULT '{}', created_at timestamptz DEFAULT now()
    );
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;
    GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
  `);
  await migrate('20260626041515_create_user_profiles.sql');
  await migrate('20260626120459_fix_user_profiles_rls_recursion.sql');
  await migrate('20260626122319_fix_security_advisor_warnings.sql');
  await migrate('20260626051128_calm_dust.sql');
  await migrate('20261016000000_harden_profile_authorization.sql');
  for (const user of [owner, other, admin]) {
    await db.query('INSERT INTO auth.users (id, email) VALUES ($1, $2)', [user, user + '@example.invalid']);
  }
  await db.query("UPDATE user_profiles SET role = 'admin' WHERE id = $1", [admin]);
  await db.query("INSERT INTO stripe_customers (user_id, customer_id) VALUES ($1, 'cus_owner'), ($2, 'cus_other')", [owner, other]);
  await db.exec(`INSERT INTO stripe_orders
    (checkout_session_id, payment_intent_id, customer_id, amount_subtotal, amount_total, currency, payment_status)
    VALUES ('old_session', 'old_intent', 'cus_owner', 900, 900, 'usd', 'paid'),
           ('old_session', 'old_intent', 'cus_owner', 900, 900, 'usd', 'paid')`);
  await migrate('20261106000000_credit_wallet.sql');
});
after(async () => db.close());

test('paid renewal grants 7,400 once per cycle and ignores expired credits', async () => {
  await grant(epoch - 4000, epoch - 2000);
  await grant(epoch - 2000, epoch + 2000);
  await grant(epoch - 2000, epoch + 2000);
  const current = await balance();
  assert.equal(current.monthly, 7400);
  assert.equal(current.top_up, 0);
  assert.equal(new Date(current.next_expiry).getTime(), (epoch + 2000) * 1000);
});

test('all packs have the advertised credits and retries preserve historical orders', async () => {
  for (const [amount, credits] of [[1000, 1000], [2500, 2625], [5000, 5500], [10000, 11500]]) {
    const session = 'cs_' + amount;
    const intent = 'pi_' + amount;
    await topUp(session, intent, amount);
    await topUp(session, intent, amount);
    await topUp(session, intent + '_new', amount);
    await topUp(session + '_new', intent, amount);
    const { rows } = await db.query('SELECT amount, expires_at FROM credit_grants WHERE source_key = $1', ['topup:' + intent]);
    assert.deepEqual(rows, [{ amount: credits, expires_at: null }]);
  }
  assert.equal((await balance()).top_up, 20625);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM stripe_orders')).rows[0].n, 6);
  await assert.rejects(topUp('invalid', 'invalid', 999));
  await assert.rejects(topUp('wrong_currency', 'wrong_currency', 1000, 'eur'));
  await assert.rejects(topUp(null, 'rolled_back', 1000));
  assert.equal((await balance()).top_up, 20625);
});

test('debits spend monthly first, split across pools, and record the configured price once', async () => {
  await setPrice(7450);
  const operation = randomUUID();
  assert.equal(await spend('website_analysis', operation), 'charged');
  assert.equal(await spend('website_analysis', operation), 'duplicate');
  assert.equal((await balance()).monthly, 0);
  assert.equal((await balance()).top_up, 20575);
  const { rows } = await db.query('SELECT credits FROM credit_spend_allocations WHERE operation_id = $1 ORDER BY credits', [operation]);
  assert.deepEqual(rows, [{ credits: 50 }, { credits: 7400 }]);
  const history = await as('authenticated', owner, 'SELECT * FROM get_credit_history()');
  assert.ok(history.some(entry => entry.credits === -7450 && entry.label === 'AI website analysis'));
});

test('insufficient funds, disabled accounts, and unauthorized access cannot change the wallet', async () => {
  await setPrice(20576);
  assert.equal(await spend('website_analysis'), 'insufficient');
  assert.equal((await balance()).top_up, 20575);
  await assert.rejects(setPrice(1, owner), { code: '42501' });
  await assert.rejects(setPrice(-1), { code: '23514' });
  await assert.rejects(as('authenticated', owner, 'SELECT * FROM credit_grants'), { code: '42501' });
  await assert.rejects(as('authenticated', owner, "SELECT spend_credits($1, 'lead_search', $2)", [owner, randomUUID()]), { code: '42501' });
  await assert.rejects(as('anon', owner, 'SELECT * FROM get_credit_balance()'), { code: '42501' });
  assert.equal((await balance(other)).top_up, 0);
  assert.deepEqual(await as('authenticated', other, 'SELECT * FROM get_credit_history()'), []);
  assert.equal(await spend('website_analysis', randomUUID(), admin), 'charged');
  await db.query('UPDATE user_profiles SET is_active = false WHERE id = $1', [other]);
  assert.equal(await spend('website_analysis', randomUUID(), other), 'inactive');
});

test('an existing paid legacy subscription keeps included access until its period ends', async () => {
  await db.query("UPDATE user_profiles SET is_active = true, current_plan = 'starter' WHERE id = $1", [other]);
  await db.query(`INSERT INTO stripe_subscriptions
    (customer_id, price_id, status, current_period_start, current_period_end)
    VALUES ('cus_other', 'price_legacy', 'active', $1, $2)`, [epoch - 60, epoch + 60]);
  assert.equal((await balance(other)).legacy_access, true);
  assert.equal(await spend('website_analysis', randomUUID(), other), 'charged');
  await db.query("UPDATE stripe_subscriptions SET current_period_end = $1 WHERE customer_id = 'cus_other'", [epoch - 1]);
  assert.equal((await balance(other)).legacy_access, false);
  assert.equal(await spend('website_analysis', randomUUID(), other), 'insufficient');
});
