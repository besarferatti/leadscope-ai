import { useEffect, useState } from 'react';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { completeGoogleSignIn, GOOGLE_SIGN_IN_ERROR } from '../lib/googleOAuth';
import { createGoogleOAuthClient, googleOAuthStorageKey, supabase } from '../lib/supabase';

let completion: Promise<string | null> | undefined;

async function finishSignIn() {
  const callbackUrl = new URL(window.location.href);
  window.history.replaceState(null, '', callbackUrl.pathname);

  try {
    return await completeGoogleSignIn(callbackUrl, createGoogleOAuthClient, supabase.auth);
  } finally {
    window.sessionStorage.removeItem(googleOAuthStorageKey);
  }
}

export function GoogleCallbackPage() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // React StrictMode can run this effect twice. A PKCE code can only be exchanged once.
    completion ??= finishSignIn().catch(() => GOOGLE_SIGN_IN_ERROR);
    let active = true;
    void completion.then(result => {
      if (!active) return;
      if (result) setError(result);
      else window.location.replace('/dashboard');
    });
    return () => { active = false; };
  }, []);

  if (!error) return <LoadingSpinner message="Completing Google sign-in..." />;

  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="card max-w-md space-y-4 p-8 text-center">
        <h1 className="text-xl font-bold text-white">Google sign-in</h1>
        <p role="alert" className="text-slate-300">{error}</p>
        <a href="/login" className="btn-primary inline-flex">Back to sign in</a>
      </div>
    </main>
  );
}
