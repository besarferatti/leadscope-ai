import {
  Crosshair, Search, MessageSquare, Download, BarChart3,
  ArrowRight, CheckCircle, Zap, Target, Globe,
} from 'lucide-react';

interface Props {
  onGetStarted: () => void;
  onLogin: () => void;
  onPricing?: () => void;
}

const features = [
  {
    icon: Search,
    title: 'Smart Lead Discovery',
    desc: 'Find local businesses by niche and location. Import leads manually or via CSV.',
  },
  {
    icon: BarChart3,
    title: 'AI Lead Scoring',
    desc: 'Every lead gets an AI-generated score based on website quality, reviews, and growth potential.',
  },
  {
    icon: Globe,
    title: 'Website Audit',
    desc: 'Instantly analyze any business website for SEO, conversion issues, and opportunities.',
  },
  {
    icon: MessageSquare,
    title: 'Personalized Outreach',
    desc: 'Generate tailored email and DM templates in multiple languages and tones with one click.',
  },
  {
    icon: Target,
    title: 'Lead Pipeline',
    desc: 'Track every lead through your pipeline with customizable status stages.',
  },
  {
    icon: Download,
    title: 'Export Anytime',
    desc: 'Export your entire lead list as CSV to use in any CRM or email tool.',
  },
];

const stats = [
  { value: '10x', label: 'Faster prospecting' },
  { value: '94%', label: 'More personalized outreach' },
  { value: '3 min', label: 'From search to pitch' },
];

export function LandingPage({ onGetStarted, onLogin, onPricing }: Props) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Nav */}
      <header className="border-b border-slate-800/60 sticky top-0 z-30 bg-slate-950/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <Crosshair className="w-4 h-4 text-white" />
            </div>
            <span className="text-white font-bold text-lg">LeadScope <span className="text-blue-400">AI</span></span>
          </div>
          <div className="flex items-center gap-3">
            {onPricing && (
              <button onClick={onPricing} className="text-slate-400 hover:text-slate-200 text-sm transition-colors">
                Pricing
              </button>
            )}
            <button
              onClick={onLogin}
              className="btn-secondary text-sm py-2"
            >
              Sign In
            </button>
            <button
              onClick={onGetStarted}
              className="btn-primary text-sm py-2"
            >
              Get Started
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 via-transparent to-slate-950 pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/5 rounded-full blur-3xl pointer-events-none" />
        <div className="max-w-7xl mx-auto px-6 pt-24 pb-20 text-center relative">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-600/10 border border-blue-500/20 text-blue-400 text-sm font-medium mb-8">
            <Zap className="w-3.5 h-3.5" />
            AI-Powered Lead Intelligence
          </div>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white leading-[1.1] tracking-tight mb-6">
            Find. Analyze. <br />
            <span className="text-blue-400">Close.</span>
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed mb-10">
            LeadScope AI helps web design, SEO, and marketing agencies discover hot local business leads, audit their websites, and generate personalized outreach — in minutes.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button
              onClick={onGetStarted}
              className="btn-primary text-base px-8 py-3 rounded-xl shadow-lg shadow-blue-600/20"
            >
              Start Finding Leads
              <ArrowRight className="w-5 h-5" />
            </button>
            <button
              onClick={onLogin}
              className="btn-secondary text-base px-8 py-3 rounded-xl"
            >
              Sign In to Dashboard
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-8 max-w-lg mx-auto mt-16 pt-16 border-t border-slate-800">
            {stats.map(s => (
              <div key={s.label} className="text-center">
                <div className="text-3xl font-bold text-white mb-1">{s.value}</div>
                <div className="text-slate-500 text-sm">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-white mb-4">Everything you need to land clients</h2>
          <p className="text-slate-400 max-w-xl mx-auto">
            From lead discovery to personalized pitches — one streamlined workflow for agency growth.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map(f => (
            <div key={f.title} className="card p-6 hover:border-slate-700 transition-all duration-200 group">
              <div className="w-10 h-10 rounded-lg bg-blue-600/15 flex items-center justify-center mb-4 group-hover:bg-blue-600/25 transition-colors">
                <f.icon className="w-5 h-5 text-blue-400" />
              </div>
              <h3 className="text-white font-semibold mb-2">{f.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-7xl mx-auto px-6 py-20 border-t border-slate-800">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-white mb-4">How it works</h2>
          <p className="text-slate-400">Three steps from cold list to warm conversation.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { step: '01', title: 'Create a Lead Search', desc: 'Enter a niche, location, and your service offer. Add leads manually or import from CSV.' },
            { step: '02', title: 'Analyze & Score', desc: 'Run an AI audit on any website to uncover SEO issues, conversion gaps, and lead score.' },
            { step: '03', title: 'Generate & Send', desc: 'Get a tailored outreach email or DM in your preferred language and tone — ready to send.' },
          ].map(item => (
            <div key={item.step} className="relative">
              <div className="text-6xl font-black text-slate-800 mb-4">{item.step}</div>
              <h3 className="text-white font-semibold text-lg mb-2">{item.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="card p-12 text-center bg-gradient-to-br from-blue-600/10 to-slate-900 border-blue-500/20">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to fill your pipeline?</h2>
          <p className="text-slate-400 mb-8 max-w-md mx-auto">
            Start finding qualified leads in minutes. No credit card required.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {['Find hot leads faster', 'AI website audits', 'Personalized messages', 'CSV export'].map(b => (
              <div key={b} className="flex items-center gap-2 text-slate-300 text-sm">
                <CheckCircle className="w-4 h-4 text-blue-400 flex-shrink-0" />
                {b}
              </div>
            ))}
          </div>
          <button
            onClick={onGetStarted}
            className="btn-primary text-base px-10 py-3 rounded-xl mt-8 shadow-lg shadow-blue-600/20"
          >
            Get Started Free
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-8">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center">
              <Crosshair className="w-3 h-3 text-white" />
            </div>
            <span className="text-slate-400 text-sm font-medium">LeadScope AI</span>
          </div>
          <p className="text-slate-600 text-sm">© {new Date().getFullYear()} LeadScope AI. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
