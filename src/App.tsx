import { useState, useEffect } from 'react';
import { CheckCircle, X, ArrowRight, Loader2, AlertCircle, Mail } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LandingPage } from './pages/LandingPage';
import { AuthPage } from './pages/AuthPage';
import { PricingPage } from './pages/PricingPage';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { DashboardPage } from './pages/DashboardPage';
import { LeadSearchesPage } from './pages/LeadSearchesPage';
import { LeadsPage } from './pages/LeadsPage';
import { LeadDetailPage } from './pages/LeadDetailPage';
import { SettingsPage } from './pages/SettingsPage';
import { ChangePasswordPage } from './pages/ChangePasswordPage';
import { AdminPage } from './pages/admin/AdminPage';
import { LoadingSpinner } from './components/ui/LoadingSpinner';
import { createCheckoutSession } from './lib/stripe';
import { supabase } from './lib/supabase';
import { PlanId, BillingCycle } from './lib/plans';

type AppPage =
  | 'landing'
  | 'login'
  | 'register'
  | 'pricing'
  | 'change-password'
  | 'dashboard'
  | 'searches'
  | 'leads'
  | 'lead-detail'
  | 'settings'
  | 'admin';

const PUBLIC_PAGES: AppPage[] = ['landing', 'login', 'register', 'pricing'];
const ADMIN_PAGES: AppPage[] = ['admin'];
const DASH_PAGES: AppPage[] = ['dashboard', 'searches', 'leads', 'lead-detail', 'settings', 'change-password'];


function VerifyEmailScreen() {
  const { session, signOut } = useAuth();
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const email = session?.user.email ?? '';

  async function handleResend() {
    if (!email) return;
    setResending(true);
    setMessage('');
    setError('');
    const { error: resendError } = await supabase.auth.resend({
      type: 'signup',
      email,
    });
    if (resendError) setError(resendError.message);
    else setMessage('Verification email sent. Please check your inbox.');
    setResending(false);
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="max-w-md w-full card p-8 text-center">
        <div className="w-12 h-12 rounded-xl bg-blue-500/15 flex items-center justify-center mx-auto mb-5">
          <Mail className="w-6 h-6 text-blue-400" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Verify your email</h1>
        <p className="text-slate-400 text-sm leading-relaxed mb-5">
          Please verify <span className="text-slate-200">{email}</span> before accessing LeadScope AI. This keeps your account secure.
        </p>
        {message && <p className="text-emerald-400 text-sm mb-4">{message}</p>}
        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button onClick={handleResend} disabled={resending || !email} className="btn-primary">
            {resending ? 'Sending...' : 'Resend verification email'}
          </button>
          <button onClick={() => signOut()} className="btn-secondary">Sign out</button>
        </div>
      </div>
    </div>
  );
}

function PlanPickerScreen({ onDismiss }: { onDismiss: () => void }) {
  const { profile } = useAuth();
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState('');

  async function handleSelectPlan(planId: PlanId, billingCycle: BillingCycle) {
    if (planId === 'enterprise') {
      window.location.href = 'mailto:sales@leadscope.pro';
      return;
    }
    setCheckoutLoading(planId);
    setCheckoutError('');
    const { url, error } = await createCheckoutSession(planId, billingCycle);
    if (error) {
      setCheckoutError(error);
      setCheckoutLoading(null);
      return;
    }
    if (url) window.location.href = url;
    setCheckoutLoading(null);
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
            <span className="text-white text-xs font-bold">L</span>
          </div>
          <span className="text-white font-bold">LeadScope<span className="text-blue-400"> AI</span></span>
        </div>
        <button
          onClick={onDismiss}
          className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200 text-sm transition-colors"
        >
          Continue with free trial
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-auto py-10 px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Choose your plan</h1>
          <p className="text-slate-400 text-sm">
            You're on the Free Trial. Upgrade now to unlock more leads, AI audits, and outreach messages.
          </p>
          {checkoutError && (
            <div className="flex items-center justify-center gap-2 mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 max-w-lg mx-auto">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <p className="text-red-300 text-sm">{checkoutError}</p>
            </div>
          )}
          {checkoutLoading && (
            <div className="flex items-center justify-center gap-2 mt-4 text-blue-400 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Redirecting to checkout...
            </div>
          )}
        </div>
        <PricingPage
          embedded
          currentPlan={profile?.current_plan}
          onSelectPlan={handleSelectPlan}
        />
      </div>
    </div>
  );
}

function AppInner() {
  const { session, loading, profile, profileLoading, profileError, refreshProfile } = useAuth();
  const [page, setPage] = useState<AppPage>('dashboard');
  const [pageParams, setPageParams] = useState<Record<string, string>>({});
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [checkoutBanner, setCheckoutBanner] = useState<'success' | 'cancel' | null>(null);
  const [planPickerDismissed, setPlanPickerDismissed] = useState(
    () => sessionStorage.getItem('plan_picker_dismissed') === '1'
  );
  const [activatingPlan, setActivatingPlan] = useState(false);

  function navigate(p: string, params?: Record<string, string>) {
    setPage(p as AppPage);
    setPageParams(params ?? {});
    window.scrollTo(0, 0);
  }

  function dismissPlanPicker() {
    sessionStorage.setItem('plan_picker_dismissed', '1');
    setPlanPickerDismissed(true);
  }

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes('type=recovery')) {
      navigate('change-password');
    }
    const params = new URLSearchParams(window.location.search);
    const checkout = params.get('checkout');
    const portal = params.get('portal');
    if (checkout === 'success' || checkout === 'cancel' || portal === 'return') {
      window.history.replaceState({}, '', window.location.pathname);
      sessionStorage.setItem('plan_picker_dismissed', '1');
      setPlanPickerDismissed(true);
      if (checkout === 'success') {
        setActivatingPlan(true);
      } else if (checkout === 'cancel') {
        setCheckoutBanner('cancel');
      }
      // portal=return: silently refresh profile in the background (no spinner needed)
    }
  }, []);


  useEffect(() => {
    if (loading || !session) return;
    if (PUBLIC_PAGES.includes(page) || (!DASH_PAGES.includes(page) && !ADMIN_PAGES.includes(page) && page !== 'change-password')) {
      setPage('dashboard');
    }
    if (ADMIN_PAGES.includes(page) && profile && profile.role !== 'admin') {
      setPage('dashboard');
    }
  }, [loading, session, page, profile?.role]);

  // Fallback: auth finished loading but no session — can't sync, clear the activating screen
  useEffect(() => {
    if (!activatingPlan || loading || session?.user?.id) return;
    // Give onAuthStateChange 2 seconds to fire before giving up
    const t = setTimeout(() => setActivatingPlan(false), 2000);
    return () => clearTimeout(t);
  }, [activatingPlan, loading, session?.user?.id]);

  // Once session is available after checkout=success, sync plan directly from Stripe
  useEffect(() => {
    if (!activatingPlan || !session?.user?.id || !session.access_token) return;
    let cancelled = false;

    // Hard cap: never show activating screen longer than 15 seconds total
    const hardCap = setTimeout(() => {
      if (!cancelled) { cancelled = true; setActivatingPlan(false); }
    }, 15000);

    async function syncAndActivate() {
      try {
        await Promise.race([
          supabase.functions.invoke('sync-subscription', {
            headers: { Authorization: `Bearer ${session!.access_token}` },
          }),
          new Promise(r => setTimeout(r, 6000)),
        ]);
      } catch (_) {
        // proceed to dashboard regardless
      }
      if (cancelled) return;
      // Refresh profile but don't let it block forever
      try {
        await Promise.race([refreshProfile(), new Promise(r => setTimeout(r, 5000))]);
      } catch (_) { /* ignore */ }
      if (cancelled) return;
      clearTimeout(hardCap);
      cancelled = true;
      setActivatingPlan(false);
      setCheckoutBanner('success');
    }

    syncAndActivate();
    return () => { cancelled = true; clearTimeout(hardCap); };
  }, [activatingPlan, session?.user?.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <LoadingSpinner message="Loading..." />
      </div>
    );
  }

  if (activatingPlan) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 rounded-full border-4 border-blue-600 border-t-transparent animate-spin" />
        <p className="text-white font-semibold text-lg">Activating your plan...</p>
        <p className="text-slate-400 text-sm">This usually takes just a few seconds.</p>
      </div>
    );
  }

  // Public pricing page — accessible without auth
  if (page === 'pricing') {
    return (
      <PricingPage
        onGetStarted={() => { setAuthMode('register'); navigate('register'); }}
        onLogin={() => { setAuthMode('login'); navigate('login'); }}
        onBack={() => navigate('landing')}
      />
    );
  }

  // Unauthenticated flow
  if (!session) {
    if (page === 'login' || page === 'register') {
      return (
        <AuthPage
          mode={authMode}
          onModeChange={m => setAuthMode(m)}
          onBack={() => navigate('landing')}
          onSuccess={() => navigate('dashboard')}
        />
      );
    }
    return (
      <LandingPage
        onGetStarted={() => { setAuthMode('register'); navigate('register'); }}
        onLogin={() => { setAuthMode('login'); navigate('login'); }}
        onPricing={() => navigate('pricing')}
      />
    );
  }

  // Authenticated pages are normalized by the redirect effect above.

  if (profileError) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl bg-slate-900 border border-red-500/30 p-6 text-center">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-white mb-2">We couldn't load your account</h1>
          <p className="text-slate-400 text-sm mb-5">{profileError}</p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => refreshProfile()} className="btn btn-primary" disabled={profileLoading}>Retry</button>
            <button onClick={() => window.location.reload()} className="btn btn-secondary">Reload</button>
          </div>
        </div>
      </div>
    );
  }

  const emailVerified = Boolean(session.user.email_confirmed_at);
  const adminBypass = profile?.role === 'admin' || session.user.email?.toLowerCase() === 'admin@leadscope.pro';
  if (!emailVerified && !adminBypass) {
    return <VerifyEmailScreen />;
  }

  // Must change password check
  if (profile?.must_change_password && page !== 'change-password') {
    return (
      <ChangePasswordPage
        required
        onSuccess={() => navigate('dashboard')}
      />
    );
  }

  // Change password page (standalone, no dashboard layout)
  if (page === 'change-password') {
    return (
      <ChangePasswordPage
        required={profile?.must_change_password}
        onSuccess={() => navigate('settings')}
        onCancel={() => navigate('settings')}
      />
    );
  }

  // Admin route — only admins
  if (ADMIN_PAGES.includes(page)) {
    if (profileLoading) {
      return <LoadingSpinner message="Loading account..." />;
    }

    if (profile?.role === 'admin') {
      return <AdminPage onNavigate={navigate} adminPage={pageParams.admin_page ?? 'overview'} />;
    }

    return <DashboardPage onNavigate={navigate} />;
  }

  // Show plan picker for free trial users (once per session, not for admins)
  if (
    profile?.current_plan === 'free_trial' &&
    profile?.role !== 'admin' &&
    !planPickerDismissed
  ) {
    return <PlanPickerScreen onDismiss={dismissPlanPicker} />;
  }

  // Dashboard pages
  const activePage = (['dashboard', 'searches', 'leads', 'settings'] as AppPage[]).includes(page)
    ? page
    : page === 'lead-detail' ? 'leads' : 'dashboard';

  const renderContent = () => {
    switch (page) {
      case 'dashboard':
        return <DashboardPage onNavigate={navigate} />;
      case 'searches':
        return <LeadSearchesPage onNavigate={navigate} />;
      case 'leads':
        return <LeadsPage onNavigate={navigate} initialSearchId={pageParams.search_id} />;
      case 'lead-detail':
        return <LeadDetailPage leadId={pageParams.id} onBack={() => navigate('leads')} onNavigate={navigate} />;
      case 'settings':
        return <SettingsPage onNavigate={navigate} initialTab={pageParams.tab as 'profile' | 'api-keys' | 'billing' | 'security' | undefined} />;
      default:
        return <DashboardPage onNavigate={navigate} />;
    }
  };


  return (
    <DashboardLayout currentPage={activePage} onNavigate={navigate}>
      {checkoutBanner === 'success' && (
        <div className="flex items-center justify-between gap-3 p-4 mb-4 rounded-xl bg-emerald-500/10 border border-emerald-500/25">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <div>
              <p className="text-emerald-300 font-medium text-sm">Payment successful! Your plan has been upgraded.</p>
              <p className="text-emerald-400/70 text-xs mt-0.5">It may take a moment to reflect.</p>
            </div>
          </div>
          <button onClick={() => setCheckoutBanner(null)} className="text-emerald-400/60 hover:text-emerald-300 transition-colors flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {checkoutBanner === 'cancel' && (
        <div className="flex items-center justify-between gap-3 p-4 mb-4 rounded-xl bg-slate-800 border border-slate-700">
          <p className="text-slate-400 text-sm">Checkout was cancelled. You can upgrade anytime from Settings &gt; Billing.</p>
          <button onClick={() => setCheckoutBanner(null)} className="text-slate-500 hover:text-slate-300 transition-colors flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {renderContent()}
    </DashboardLayout>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}

export default App;
