import { useState } from 'react';
import {
  Check, X, Zap, Crosshair, ChevronLeft, Star,
} from 'lucide-react';
import { PLANS, PLAN_DISPLAY_ORDER, PlanId, BillingCycle } from '../lib/plans';

interface Props {
  onGetStarted?: () => void;
  onLogin?: () => void;
  onBack?: () => void;
  // When used inside the app (logged-in user upgrading)
  currentPlan?: PlanId;
  onSelectPlan?: (planId: PlanId, billingCycle: BillingCycle) => void;
  embedded?: boolean;
}

const PLAN_FEATURES: Record<PlanId, string[]> = {
  free_trial: [
    'Basic lead search',
    'Manual lead add',
    '50 leads / month',
    '25 AI website audits',
    '25 AI outreach messages',
    'Basic dashboard',
  ],
  starter: [
    '500 leads per month',
    '100 AI website audits',
    '100 AI outreach messages',
    'Manual lead import',
    'Google Places search',
    'CSV export',
    'Lead status tracking',
    'Basic lead scoring',
  ],
  pro: [
    '2,500 leads per month',
    '500 AI website audits',
    '500 AI outreach messages',
    'Google Places lead search',
    'Advanced filters',
    'CSV export',
    '3 team members',
    'Saved outreach templates',
    'Bulk analyze up to 50 leads',
    'Priority AI generation',
  ],
  agency: [
    '10,000 leads per month',
    '2,000 AI website audits',
    '2,000 AI outreach messages',
    '10 team members',
    'Multiple workspaces',
    'Advanced lead scoring',
    'Bulk analyze up to 500 leads',
    'Bulk outreach message generation',
    'Saved templates',
    'Priority support',
  ],
  enterprise: [
    'Custom monthly limits',
    'API access',
    'White-label option',
    'Custom integrations',
    'Dedicated onboarding',
    'Dedicated support',
    'Best for larger agencies',
  ],
  admin_unlimited: [],
};

const DISABLED_FEATURES: Record<PlanId, string[]> = {
  free_trial: ['CSV export', 'Bulk actions', 'Team members'],
  starter: ['Bulk actions', 'Team members', 'Saved templates'],
  pro: ['Multiple workspaces', 'Custom lead scoring', 'Priority support'],
  agency: ['API access', 'White-label'],
  enterprise: [],
  admin_unlimited: [],
};

const PLAN_BUTTON_TEXT: Record<PlanId, string> = {
  free_trial: 'Start Free Trial',
  starter: 'Get Starter',
  pro: 'Upgrade to Pro',
  agency: 'Get Agency',
  enterprise: 'Contact Sales',
  admin_unlimited: '',
};

export function PricingPage({ onGetStarted, onLogin, onBack, currentPlan, onSelectPlan, embedded }: Props) {
  const [billing, setBilling] = useState<BillingCycle>('monthly');

  function handleSelect(planId: PlanId) {
    if (onSelectPlan) {
      onSelectPlan(planId, billing);
    } else if (planId === 'enterprise') {
      window.location.href = 'mailto:sales@leadscope.pro';
    } else {
      onGetStarted?.();
    }
  }

  return (
    <div className={`min-h-screen bg-slate-950 ${embedded ? '' : 'py-16 px-4'}`}>
      {!embedded && (
        <div className="max-w-6xl mx-auto">
          {/* Nav */}
          <div className="flex items-center justify-between mb-16">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                <Crosshair className="w-4 h-4 text-white" />
              </div>
              <span className="text-white font-bold text-lg">LeadScope<span className="text-blue-400"> AI</span></span>
            </div>
            <div className="flex items-center gap-4">
              {onBack && (
                <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors">
                  <ChevronLeft className="w-4 h-4" />
                  Back
                </button>
              )}
              {onLogin && (
                <button onClick={onLogin} className="btn-secondary text-sm py-2">Sign In</button>
              )}
              {onGetStarted && (
                <button onClick={onGetStarted} className="btn-primary text-sm py-2">Get Started</button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className={`${embedded ? '' : 'max-w-6xl mx-auto'}`}>
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4 leading-tight">
            Simple pricing for agencies<br className="hidden sm:block" /> that want better leads.
          </h1>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto mb-8">
            Find local businesses with weak websites, poor SEO, and missing booking systems. LeadScope AI helps web design, SEO, and marketing agencies discover real opportunities and generate personalized outreach messages.
          </p>

          {/* Billing toggle */}
          <div className="inline-flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-xl p-1.5">
            <button
              onClick={() => setBilling('monthly')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                billing === 'monthly'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBilling('yearly')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                billing === 'yearly'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Yearly
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                billing === 'yearly' ? 'bg-white/20 text-white' : 'bg-emerald-500/20 text-emerald-400'
              }`}>
                -20%
              </span>
            </button>
          </div>
          {billing === 'yearly' && (
            <p className="text-emerald-400 text-sm mt-3 font-medium">Save 20% with yearly billing</p>
          )}
        </div>

        {/* Plans grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
          {PLAN_DISPLAY_ORDER.map(planId => {
            const plan = PLANS[planId];
            const isPopular = plan.popular;
            const isCurrent = currentPlan === planId;
            const price = billing === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;
            const features = PLAN_FEATURES[planId];
            const disabled = DISABLED_FEATURES[planId];

            return (
              <div
                key={planId}
                className={`relative flex flex-col rounded-2xl border p-6 transition-all duration-200 ${
                  isPopular
                    ? 'bg-blue-600/10 border-blue-500/50 shadow-lg shadow-blue-500/10'
                    : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                } ${isCurrent ? 'ring-2 ring-blue-500' : ''}`}
              >
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="flex items-center gap-1.5 bg-blue-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
                      <Star className="w-3 h-3 fill-white" />
                      Most Popular
                    </span>
                  </div>
                )}
                {isCurrent && (
                  <div className="absolute -top-3 right-4">
                    <span className="bg-emerald-600 text-white text-xs font-semibold px-3 py-1 rounded-full">Current</span>
                  </div>
                )}

                <div className="mb-5">
                  <h3 className="text-white font-bold text-lg mb-1">{plan.name}</h3>
                  {planId === 'enterprise' ? (
                    <div className="mt-2">
                      <span className="text-3xl font-black text-white">Custom</span>
                    </div>
                  ) : (
                    <div className="flex items-end gap-1 mt-2">
                      <span className="text-3xl font-black text-white">€{price}</span>
                      <span className="text-slate-400 text-sm mb-1">
                        {billing === 'yearly' ? '/year' : '/mo'}
                      </span>
                    </div>
                  )}
                  {billing === 'yearly' && plan.monthlyPrice !== null && plan.monthlyPrice > 0 && (
                    <p className="text-slate-500 text-xs mt-1">
                      €{Math.round((plan.yearlyPrice ?? 0) / 12)}/mo billed annually
                    </p>
                  )}
                </div>

                {/* Limits summary */}
                <div className="mb-5 p-3 rounded-lg bg-slate-800/60 space-y-1 text-xs">
                  <div className="flex justify-between text-slate-300">
                    <span>Leads/mo</span>
                    <span className="font-semibold">{plan.leadsLimit === -1 ? 'Unlimited' : plan.leadsLimit.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>AI Audits/mo</span>
                    <span className="font-semibold">{plan.auditsLimit === -1 ? 'Unlimited' : plan.auditsLimit.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Messages/mo</span>
                    <span className="font-semibold">{plan.messagesLimit === -1 ? 'Unlimited' : plan.messagesLimit.toLocaleString()}</span>
                  </div>
                </div>

                {/* Features */}
                <ul className="space-y-2 flex-1 mb-6">
                  {features.map(f => (
                    <li key={f} className="flex items-start gap-2 text-sm text-slate-300">
                      <Check className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                  {disabled.map(f => (
                    <li key={f} className="flex items-start gap-2 text-sm text-slate-600">
                      <X className="w-4 h-4 text-slate-700 flex-shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleSelect(planId)}
                  disabled={isCurrent}
                  className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
                    isCurrent
                      ? 'bg-slate-800 text-slate-500 cursor-default'
                      : isPopular
                      ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                  }`}
                >
                  {isCurrent ? 'Current Plan' : (
                    <>
                      <Zap className="w-4 h-4" />
                      {PLAN_BUTTON_TEXT[planId]}
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer note */}
        <p className="text-center text-slate-600 text-sm mt-10">
          All plans include a 7-day free trial. No credit card required to start. Cancel anytime.
        </p>
      </div>
    </div>
  );
}
