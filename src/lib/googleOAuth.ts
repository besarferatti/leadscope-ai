import type { SupabaseClient } from '@supabase/supabase-js';

export const GOOGLE_CALLBACK_PATH = '/auth/callback';
export const GOOGLE_SIGN_IN_ERROR = 'Google sign-in could not be completed. Please try again.';
const INACTIVE_ACCOUNT_ERROR = 'Your account is inactive. Please contact support.';

export async function startGoogleSignIn(auth: Pick<SupabaseClient['auth'], 'signInWithOAuth'>, origin: string) {
  return auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: new URL(GOOGLE_CALLBACK_PATH, origin).href,
    },
  });
}

export async function completeGoogleSignIn(
  callbackUrl: URL,
  createClient: () => Pick<SupabaseClient, 'auth' | 'from'>,
  appAuth: Pick<SupabaseClient['auth'], 'setSession'>,
): Promise<string | null> {
  const code = callbackUrl.searchParams.get('code');
  const fragment = new URLSearchParams(callbackUrl.hash.slice(1));
  if (!code || callbackUrl.searchParams.has('error') || fragment.has('error')) {
    return GOOGLE_SIGN_IN_ERROR;
  }

  try {
    const client = createClient();
    const { data, error } = await client.auth.exchangeCodeForSession(code);
    if (error || !data.session) return GOOGLE_SIGN_IN_ERROR;

    const { data: profile, error: profileError } = await client
      .from('user_profiles')
      .select('is_active')
      .eq('id', data.session.user.id)
      .maybeSingle();
    if (profileError) return GOOGLE_SIGN_IN_ERROR;
    if (profile?.is_active === false) return INACTIVE_ACCOUNT_ERROR;

    const { error: sessionError } = await appAuth.setSession({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    });
    return sessionError ? GOOGLE_SIGN_IN_ERROR : null;
  } catch {
    return GOOGLE_SIGN_IN_ERROR;
  }
}
