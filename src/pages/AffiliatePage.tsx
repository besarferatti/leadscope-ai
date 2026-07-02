import { useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowLeft, CheckCircle, Crosshair, Loader2, Megaphone, Users, Wallet } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { trackEvent } from '../lib/analytics';

interface Props {
  onBack: () => void;
  onLogin: () => void;
}

const initialForm = {
  full_name: '',
  email: '',
  company_name: '',
  website_or_social: '',
  audience_type: '',
  audience_size: '',
  promotion_plan: '',
  preferred_payout_method: '',
  message: '',
};

export function AffiliatePage({ onBack, onLogin }: Props) {
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  function updateField(field: keyof typeof initialForm, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    const { error: err } = await supabase.from('affiliate_applications').insert({
      ...form,
      status: 'pending',
    });

    if (err) {
      setError(err.message);
      setSubmitting(false);
      return;
    }

    trackEvent('affiliate_application_submitted');
    setSuccess(true);
    setForm(initialForm);
    setSubmitting(false);
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800/60 bg-slate-950/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <button onClick={onBack} className="flex items-center gap-2.5 text-left">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <Crosshair className="w-4 h-4 text-white" />
            </div>
            <span className="text-white font-bold text-lg">LeadScope <span className="text-blue-400">AI</span></span>
          </button>
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="text-slate-400 hover:text-slate-200 text-sm transition-colors">
              Home
            </button>
            <button onClick={onLogin} className="btn-secondary text-sm py-2">Sign In</button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-16">
        <button onClick={onBack} className="inline-flex items-center gap-2 text-slate-400 hover:text-blue-400 text-sm mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to LeadScope AI
        </button>

        <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-10 items-start">
          <section className="space-y-8">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-600/10 border border-blue-500/20 text-blue-400 text-sm font-medium mb-6">
                <Megaphone className="w-3.5 h-3.5" /> Partner Program
              </div>
              <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight mb-5">Become a LeadScope AI Affiliate</h1>
              <p className="text-lg text-slate-400 leading-relaxed">
                Earn commissions by referring agencies, freelancers, and marketers who use LeadScope AI to discover leads, run AI audits, and create personalized outreach.
              </p>
            </div>

            <div className="card p-6 bg-gradient-to-br from-blue-600/10 to-slate-900 border-blue-500/20">
              <p className="text-blue-300 font-semibold mb-2">Typical starting commission: 20% for 6 months, reviewed manually.</p>
              <p className="text-slate-400 text-sm leading-relaxed">
                Phase 1 is a manual affiliate review and payout program. Approved partners receive manually assigned terms and payout instructions after review.
              </p>
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              {[
                { icon: Users, title: 'For B2B audiences', text: 'Agencies, consultants, freelancers, and marketers.' },
                { icon: Megaphone, title: 'Flexible promotion', text: 'Content, communities, newsletters, or direct referrals.' },
                { icon: Wallet, title: 'Manual payouts', text: 'Payout method and terms are confirmed after approval.' },
              ].map(item => (
                <div key={item.title} className="card p-5">
                  <item.icon className="w-5 h-5 text-blue-400 mb-3" />
                  <h3 className="text-white font-semibold text-sm mb-2">{item.title}</h3>
                  <p className="text-slate-500 text-xs leading-relaxed">{item.text}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="card p-6 sm:p-8">
            {success ? (
              <div className="text-center py-10">
                <CheckCircle className="w-14 h-14 text-emerald-400 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-white mb-2">Application submitted</h2>
                <p className="text-slate-400 mb-6">Thanks for applying. Our team will review your affiliate application manually and follow up by email.</p>
                <button onClick={() => setSuccess(false)} className="btn-primary">Submit another application</button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <h2 className="text-2xl font-bold text-white">Affiliate application</h2>
                  <p className="text-slate-400 text-sm mt-1">Tell us about your audience and how you plan to promote LeadScope AI.</p>
                </div>

                {error && <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-sm">{error}</div>}

                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="Full name" value={form.full_name} onChange={v => updateField('full_name', v)} required />
                  <Field label="Email" type="email" value={form.email} onChange={v => updateField('email', v)} required />
                  <Field label="Company/brand name" value={form.company_name} onChange={v => updateField('company_name', v)} />
                  <Field label="Website or LinkedIn/social profile" value={form.website_or_social} onChange={v => updateField('website_or_social', v)} />
                  <Field label="Audience type" value={form.audience_type} onChange={v => updateField('audience_type', v)} placeholder="Agency owners, freelancers, marketers..." />
                  <Field label="Audience size" value={form.audience_size} onChange={v => updateField('audience_size', v)} placeholder="Newsletter, followers, community size..." />
                </div>

                <TextArea label="How will you promote LeadScope AI?" value={form.promotion_plan} onChange={v => updateField('promotion_plan', v)} />
                <Field label="Preferred payout method" value={form.preferred_payout_method} onChange={v => updateField('preferred_payout_method', v)} placeholder="PayPal, bank transfer, Wise..." />
                <TextArea label="Message" value={form.message} onChange={v => updateField('message', v)} />

                <button type="submit" disabled={submitting} className="btn-primary w-full py-3 rounded-xl">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Submit application
                </button>
              </form>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', required = false, placeholder = '' }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="block text-slate-300 text-sm font-medium mb-1.5">{label}{required && <span className="text-red-400"> *</span>}</span>
      <input className="input" type={type} value={value} onChange={e => onChange(e.target.value)} required={required} placeholder={placeholder} />
    </label>
  );
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="block text-slate-300 text-sm font-medium mb-1.5">{label}</span>
      <textarea className="input min-h-[100px] resize-y" value={value} onChange={e => onChange(e.target.value)} />
    </label>
  );
}
