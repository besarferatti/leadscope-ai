import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const user = '00000000-0000-4000-8000-000000000001';
const other = '00000000-0000-4000-8000-000000000002';
const admin = '00000000-0000-4000-8000-000000000003';
const inactive = '00000000-0000-4000-8000-000000000004';
const missing = '00000000-0000-4000-8000-000000000005';
const migration = '20261016000000_harden_profile_authorization.sql';
async function migrate(name) {
  await db.exec(await readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8'));
}
// Every scenario rolls back, including failures. No network or real customer data.
async function asRole(role, id, action) {
  await db.exec('BEGIN');
  try {
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [id ?? '']);
    await db.exec(`SET LOCAL ROLE ${role}`);
    return await action();
  } finally {
    await db.exec('ROLLBACK');
  }
}
before(async () => {
  await db.exec(`
    CREATE ROLE anon NOLOGIN;
    CREATE ROLE authenticated NOLOGIN;
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users (
      id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb DEFAULT '{}',
      created_at timestamptz DEFAULT now()
    );
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;
    GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
    GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
  `);
  await migrate('20260626041515_create_user_profiles.sql');
  await migrate('20260626120459_fix_user_profiles_rls_recursion.sql');
  await migrate('20260626122319_fix_security_advisor_warnings.sql');
  await db.exec('GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_profiles TO authenticated, service_role');
  for (const id of [user, other, admin, inactive, missing]) {
    await db.query("INSERT INTO auth.users (id, email, created_at, raw_user_meta_data) VALUES ($1, 'fixture@example.invalid', now() - interval '90 days', '{\"full_name\":\"Fixture\",\"role\":\"admin\",\"current_plan\":\"enterprise\"}')", [id]);
  }
  await db.query("UPDATE public.user_profiles SET role = 'admin' WHERE id IN ($1, $2)", [admin, inactive]);
  await db.query('UPDATE public.user_profiles SET is_active = false WHERE id = $1', [inactive]);
  await db.query('DELETE FROM public.user_profiles WHERE id = $1', [missing]);
  await migrate(migration);
});
after(async () => db.close());

for (const [field, value] of Object.entries({
  role: 'admin', current_plan: 'admin_unlimited', billing_cycle: 'yearly',
  subscription_status: 'active', trial_started_at: '2099-01-01',
  trial_ends_at: '2099-01-01', is_active: false, email: 'attacker@example.invalid',
  created_at: '2099-01-01', id: '00000000-0000-4000-8000-000000000099',
})) {
  test(`owner cannot change protected ${field}`, async () => {
    await assert.rejects(asRole('authenticated', user, () => db.query(
      `UPDATE public.user_profiles SET ${field} = $1 WHERE id = $2`, [value, user]
    )), { code: '42501' });
  });
}
test('owner can edit name and complete existing password-change flow', async () => {
  const result = await asRole('authenticated', user, () => db.query(
    "UPDATE public.user_profiles SET full_name = 'Edited', must_change_password = false, updated_at = now() WHERE id = $1 RETURNING full_name", [user]
  ));
  assert.equal(result.rows[0].full_name, 'Edited');
});
test('existing usage accounting remains compatible pending separate atomic accounting batch', async () => {
  const result = await asRole('authenticated', user, () => db.query(
    'UPDATE public.user_profiles SET leads_used_this_month = 1 WHERE id = $1 RETURNING leads_used_this_month', [user]
  ));
  assert.equal(result.rows[0].leads_used_this_month, 1);
});
test('owner cannot view or update another profile', async () => {
  await asRole('authenticated', user, async () => {
    assert.equal((await db.query('SELECT id FROM public.user_profiles WHERE id = $1', [other])).rows.length, 0);
    assert.equal((await db.query("UPDATE public.user_profiles SET full_name = 'Attacked' WHERE id = $1 RETURNING id", [other])).rows.length, 0);
  });
});
test('owner cannot insert a profile with elevated privileges', async () => {
  await assert.rejects(asRole('authenticated', missing, () => db.query(
    "INSERT INTO public.user_profiles (id, role, current_plan) VALUES ($1, 'admin', 'enterprise')", [missing]
  )), { code: '42501' });
});
test('owner cannot use upsert to bypass field guard', async () => {
  await assert.rejects(asRole('authenticated', user, () => db.query(
    "INSERT INTO public.user_profiles (id, role) VALUES ($1, 'admin') ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role", [user]
  )), { code: '42501' });
});
test('trusted recovery ignores authorization metadata and uses original signup time', async () => {
  await asRole('authenticated', missing, async () => {
    const { rows } = await db.query('SELECT (public.ensure_user_profile()).*');
    assert.equal(rows[0].id, missing);
    assert.equal(rows[0].role, 'user');
    assert.equal(rows[0].current_plan, 'free_trial');
    assert.equal(rows[0].full_name, 'Fixture');
    assert.ok(new Date(rows[0].trial_ends_at).getTime() < Date.now());
    assert.equal((await db.query('SELECT (public.ensure_user_profile()).id')).rows[0].id, missing);
  });
});
test('recovery leaves existing paid profile intact', async () => {
  // Test in one transaction so the trusted write remains present for recovery.
  await db.exec('BEGIN');
  try {
    await db.query("UPDATE public.user_profiles SET current_plan = 'pro' WHERE id = $1", [user]);
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [user]);
    await db.exec('SET LOCAL ROLE authenticated');
    assert.equal((await db.query('SELECT (public.ensure_user_profile()).current_plan')).rows[0].current_plan, 'pro');
  } finally { await db.exec('ROLLBACK'); }
});
test('anonymous callers cannot provision profiles', async () => {
  await assert.rejects(asRole('anon', null, () => db.query('SELECT public.ensure_user_profile()')), { code: '42501' });
});
test('authenticated role without user identity cannot provision profiles', async () => {
  await assert.rejects(asRole('authenticated', null, () => db.query('SELECT public.ensure_user_profile()')), { code: '42501' });
});
test('active admin can manage another account', async () => {
  const result = await asRole('authenticated', admin, () => db.query(
    "UPDATE public.user_profiles SET current_plan = 'pro', is_active = false WHERE id = $1 RETURNING current_plan", [other]
  ));
  assert.equal(result.rows[0].current_plan, 'pro');
});
test('inactive admin cannot reactivate itself or change plans', async () => {
  await assert.rejects(asRole('authenticated', inactive, () => db.query(
    'UPDATE public.user_profiles SET is_active = true WHERE id = $1', [inactive]
  )), { code: '42501' });
  await asRole('authenticated', inactive, async () => {
    assert.equal((await db.query('SELECT public.is_admin_user() AS allowed')).rows[0].allowed, false);
  });
});
test('service role can synchronize Stripe entitlement fields', async () => {
  const result = await asRole('service_role', null, () => db.query(
    "UPDATE public.user_profiles SET current_plan = 'pro', subscription_status = 'active' WHERE id = $1 RETURNING current_plan", [user]
  ));
  assert.equal(result.rows[0].current_plan, 'pro');
});
test('signup trigger still works after execution privileges are revoked', async () => {
  await db.exec('BEGIN');
  try {
    const id = '00000000-0000-4000-8000-000000000010';
    await db.query("INSERT INTO auth.users (id, email) VALUES ($1, 'new@example.invalid')", [id]);
    assert.equal((await db.query('SELECT role FROM public.user_profiles WHERE id = $1', [id])).rows[0].role, 'user');
  } finally { await db.exec('ROLLBACK'); }
});
test('migration can be reapplied without losing existing profiles', async () => {
  await migrate(migration);
  assert.equal((await db.query('SELECT count(*)::int AS count FROM public.user_profiles')).rows[0].count, 4);
});
