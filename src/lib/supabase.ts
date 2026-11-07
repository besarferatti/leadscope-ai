import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const googleOAuthStorageKey = 'leadscope-google-oauth';
let googleOAuthClient: ReturnType<typeof createClient> | undefined;

export function createGoogleOAuthClient() {
  // Keep Google PKCE separate from the existing email confirmation and recovery flow.
  googleOAuthClient ??= createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      flowType: 'pkce',
      detectSessionInUrl: false,
      autoRefreshToken: false,
      storage: window.sessionStorage,
      storageKey: googleOAuthStorageKey,
    },
  });
  return googleOAuthClient;
}

export async function getFreshAccessToken(): Promise<string> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session) {
    throw new Error('Your session has expired. Please sign in again.');
  }

  const { data: refreshedData, error: refreshError } = await supabase.auth.refreshSession();
  const accessToken = refreshedData.session?.access_token;
  if (refreshError || !accessToken) {
    throw new Error('Your session has expired. Please sign in again.');
  }

  return accessToken;
}
