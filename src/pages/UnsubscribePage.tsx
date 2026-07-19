import { useEffect, useState } from 'react';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

type Status = 'loading' | 'success' | 'invalid' | 'error';

export function UnsubscribePage({ token }: { token: string }) {
  const [status, setStatus] = useState<Status>('loading');

  useEffect(() => {
    let active = true;

    async function unsubscribe() {
      if (!token) {
        if (active) setStatus('invalid');
        return;
      }

      try {
        const response = await fetch('/api/unsubscribe-product-updates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        const data = await response.json().catch(() => null) as { success?: boolean } | null;
        if (!active) return;
        setStatus(response.ok && data?.success ? 'success' : response.status === 404 ? 'invalid' : 'error');
      } catch {
        if (active) setStatus('error');
      }
    }

    unsubscribe();
    return () => { active = false; };
  }, [token]);

  const content = status === 'loading'
    ? { icon: <Loader2 className="w-10 h-10 text-blue-400 animate-spin" />, title: 'Updating your preferences...', message: 'Please wait a moment.' }
    : status === 'success'
      ? { icon: <CheckCircle className="w-10 h-10 text-emerald-400" />, title: 'You have been unsubscribed from LeadScope AI product update emails.', message: 'You can re-enable these emails anytime in your account settings.' }
      : status === 'invalid'
        ? { icon: <AlertCircle className="w-10 h-10 text-amber-400" />, title: 'Invalid or expired unsubscribe link.', message: 'Please check the link in your email or manage your preferences from Settings after signing in.' }
        : { icon: <AlertCircle className="w-10 h-10 text-red-400" />, title: 'We could not update your preferences.', message: 'Please try again later or manage your preferences from Settings after signing in.' };

  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <section className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center shadow-2xl shadow-black/20">
        <div className="w-12 h-12 mx-auto mb-5 rounded-xl bg-slate-800 flex items-center justify-center">{content.icon}</div>
        <div className="flex items-center justify-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-md bg-blue-600 flex items-center justify-center"><span className="text-white text-xs font-bold">L</span></div>
          <span className="text-white font-bold">LeadScope<span className="text-blue-400"> AI</span></span>
        </div>
        <h1 className="text-xl font-semibold text-white">{content.title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-400">{content.message}</p>
      </section>
    </main>
  );
}
