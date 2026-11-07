import assert from 'node:assert/strict';
import { test } from 'node:test';
import { completeGoogleSignIn, GOOGLE_SIGN_IN_ERROR, startGoogleSignIn } from '../src/lib/googleOAuth.ts';

const origin = 'https://development.example.test';
const callback = new URL('/auth/callback?code=example', origin);

function stubSignIn({ active = true, exchangeFails = false, profileFails = false, sessionFails = false } = {}) {
  const calls = [];
  const session = { user: { id: 'existing-user-id' }, access_token: 'access', refresh_token: 'refresh' };
  const client = {
    auth: {
      async exchangeCodeForSession(code) {
        calls.push(['exchange', code]);
        return exchangeFails
          ? { data: { session: null }, error: new Error('expired code') }
          : { data: { session }, error: null };
      },
    },
    from(table) {
      assert.equal(table, 'user_profiles');
      return {
        select(columns) {
          assert.equal(columns, 'is_active');
          return {
            eq(column, id) {
              assert.equal(column, 'id');
              calls.push(['read profile', id]);
              return {
                async maybeSingle() {
                  return {
                    data: active === null ? null : { is_active: active },
                    error: profileFails ? new Error('unavailable') : null,
                  };
                },
              };
            },
          };
        },
      };
    },
  };
  const appAuth = {
    async setSession(tokens) {
      calls.push(['set session', tokens]);
      return { error: sessionFails ? new Error('invalid session') : null };
    },
  };

  return { calls, complete: (url = callback) => completeGoogleSignIn(url, () => client, appAuth) };
}

test('starts Google OAuth using the current environment callback', async () => {
  await startGoogleSignIn({
    async signInWithOAuth(options) {
      assert.deepEqual(options, {
        provider: 'google',
        options: { redirectTo: `${origin}/auth/callback` },
      });
      return { error: null };
    },
  }, origin);
});

test('uses the authenticated user ID and reads the profile before setting the app session', async () => {
  const { calls, complete } = stubSignIn();
  assert.equal(await complete(), null);
  assert.deepEqual(calls, [
    ['exchange', 'example'],
    ['read profile', 'existing-user-id'],
    ['set session', { access_token: 'access', refresh_token: 'refresh' }],
  ]);
});

test('leaves missing profiles to the existing app provisioning flow', async () => {
  const { calls, complete } = stubSignIn({ active: null });
  assert.equal(await complete(), null);
  assert.equal(calls.at(-1)[0], 'set session');
});

test('rejects incomplete and cancelled callbacks without contacting Supabase', async () => {
  const { calls, complete } = stubSignIn();
  for (const suffix of ['', '?error=access_denied', '?code=example#error=access_denied']) {
    assert.equal(await complete(new URL(`/auth/callback${suffix}`, origin)), GOOGLE_SIGN_IN_ERROR);
  }
  assert.deepEqual(calls, []);
});

test('a failed code exchange or profile check never establishes an app session', async () => {
  for (const failure of [{ exchangeFails: true }, { profileFails: true }]) {
    const { calls, complete } = stubSignIn(failure);
    assert.equal(await complete(), GOOGLE_SIGN_IN_ERROR);
    assert.ok(calls.every(([action]) => action !== 'set session'));
  }
});

test('inactive accounts cannot establish an app session', async () => {
  const { calls, complete } = stubSignIn({ active: false });
  assert.match(await complete(), /inactive/);
  assert.deepEqual(calls.map(([action]) => action), ['exchange', 'read profile']);
});

test('a failure to establish the app session returns a retry message', async () => {
  const { complete } = stubSignIn({ sessionFails: true });
  assert.equal(await complete(), GOOGLE_SIGN_IN_ERROR);
});
