import { useEffect } from 'react';
import { Check, ChevronLeft } from 'lucide-react';
import { BrandLogo } from '../components/BrandLogo';
import { trackEvent } from '../lib/analytics';
import type { BillingCycle, PlanId } from '../lib/plans';
import { TOP_UP_PACKS } from '../lib/stripe';

interface Props {
  onGetStarted?: () => void;
  onLogin?: () => void;
  onBack?: () => void;
  currentPlan?: PlanId;
  onSelectPlan?: (plan: PlanId, cycle: BillingCycle) => void;
  embedded?: boolean;
}

export function PricingPage({ onGetStarted, onLogin, onBack, currentPlan, onSelectPlan, embedded }: Props) {
  useEffect(() => {
    trackEvent('pricing_viewed', { embedded: Boolean(embedded) });
  }, [embedded]);

  return (
    <div className={embedded ? '' : 'min-h-screen bg-slate-950 px-4 py-12'}>
      {!embedded && (
        <div className="mx-auto mb-12 flex max-w-5xl flex-wrap items-center justify-between gap-4">
          <BrandLogo />
          <div className="flex items-center gap-4">
            {onBack && <button onClick={onBack} className="btn-secondary"><ChevronLeft size={16} /> Back</button>}
            {onLogin && <button onClick={onLogin} className="btn-secondary">Sign In</button>}
          </div>
        </div>
      )}
      <div className="mx-auto max-w-lg space-y-6">
        {!embedded && (
          <div className="text-center">
            <h1 className="text-4xl font-bold text-white">LeadScope AI Pricing</h1>
            <p className="mt-3 text-slate-400">Core CRM is free. Use credits for lead search, AI, and outreach.</p>
          </div>
        )}
        <section className="card border-blue-500/40 p-6">
          <h2 className="text-xl font-semibold text-white">PRO</h2>
          <p className="mt-2 text-3xl font-bold text-white">€69 <span className="text-sm font-normal text-slate-400">/ month</span></p>
          <ul className="my-5 space-y-2 text-sm text-slate-300">
            <li className="flex gap-2"><Check size={16} className="text-emerald-400" /> 7,400 credits per billing cycle, including 500 bonus credits</li>
            <li className="flex gap-2"><Check size={16} className="text-emerald-400" /> Monthly credits expire at the end of the billing cycle</li>
            <li className="flex gap-2"><Check size={16} className="text-emerald-400" /> Monthly credits are used before top-ups</li>
          </ul>
          <button className="btn-primary w-full justify-center" disabled={currentPlan === 'pro'}
            onClick={() => onSelectPlan ? onSelectPlan('pro', 'monthly') : onGetStarted?.()}>
            {currentPlan === 'pro' ? 'Current plan' : 'Subscribe to PRO'}
          </button>
        </section>
        <section className="card p-6">
          <h2 className="font-semibold text-white">Wallet top-ups</h2>
          <p className="mt-1 text-sm text-slate-400">Top-ups are charged in USD. These credits never expire.</p>
          <dl className="mt-3 space-y-2 text-sm text-slate-300">
            {TOP_UP_PACKS.map(pack => (
              <div className="flex justify-between" key={pack.cents}>
                <dt>${pack.cents / 100}</dt><dd>{pack.credits.toLocaleString()} credits</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </div>
  );
}
