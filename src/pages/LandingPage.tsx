import { ArrowRight, BarChart3, Check, ChevronRight, Mail, Search, ShieldCheck, Sparkles, Target, UsersRound } from 'lucide-react';
import { SEO } from '../components/SEO';
import { BrandLogo } from '../components/BrandLogo';

interface Props {
  onGetStarted: () => void; onLogin: () => void; onPricing?: () => void;
  onAffiliate?: () => void; onFAQ?: () => void; onDocumentation?: () => void; onUpdates?: () => void;
}

const softwareApplicationSchema = {
  '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'LeadScope AI',
  applicationCategory: 'BusinessApplication', operatingSystem: 'Web',
  description: 'A lead discovery, qualification, audit, and outreach workspace for agencies and freelancers.',
  offers: ['Free Trial', 'Starter', 'Pro', 'Agency', 'Enterprise'].map(name => ({ '@type': 'Offer', name })),
};

const workflow = [
  { number: '01', label: 'Discover', text: 'Search local businesses by niche, city, and website status.', icon: Search },
  { number: '02', label: 'Qualify', text: 'Prioritize the businesses most likely to need your service.', icon: Target },
  { number: '03', label: 'Build the case', text: 'Find contact details and turn website gaps into a clear offer.', icon: BarChart3 },
  { number: '04', label: 'Start conversations', text: 'Launch relevant outreach with control over every message.', icon: Mail },
];

const capabilities = [
  { icon: Search, title: 'Lead intelligence', text: 'Focused local search, website-status filtering, saved lists, and verified contact discovery.' },
  { icon: BarChart3, title: 'Sales-ready evidence', text: 'Website audits, SEO opportunities, and shareable reports built around a real business.' },
  { icon: Mail, title: 'Controlled outreach', text: 'Personalized campaigns with approvals, daily limits, suppression, and transparent delivery.' },
];

export function LandingPage({ onGetStarted, onLogin, onPricing, onAffiliate, onFAQ, onDocumentation, onUpdates }: Props) {
  const scrollToProduct = () => document.getElementById('product')?.scrollIntoView({ behavior: 'smooth' });
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 overflow-hidden">
      <SEO title="LeadScope AI - Lead intelligence and outreach for agencies" description="Find local businesses, qualify opportunities, build client-ready evidence, and run controlled outreach from one workspace." ogTitle="LeadScope AI - From local lead to relevant pitch" ogDescription="A practical prospecting workspace for agencies and freelancers." structuredData={softwareApplicationSchema} />

      <header className="sticky top-0 z-30 border-b border-slate-800 bg-[#080d13]/95 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-5 sm:px-6 h-[72px] flex items-center justify-between">
          <BrandLogo className="h-11 sm:h-12 w-auto object-contain" />
          <nav className="hidden md:flex items-center gap-7 text-sm text-slate-400">
            <button onClick={scrollToProduct} className="hover:text-white transition-colors">Product</button>
            {onPricing && <button onClick={onPricing} className="hover:text-white transition-colors">Pricing</button>}
            {onFAQ && <button onClick={onFAQ} className="hover:text-white transition-colors">FAQ</button>}
            {onDocumentation && <button onClick={onDocumentation} className="hover:text-white transition-colors">Docs</button>}
          </nav>
          <div className="flex items-center gap-3"><button onClick={onLogin} className="text-slate-300 hover:text-white text-sm font-medium">Sign in</button><button onClick={onGetStarted} className="btn-primary py-2.5">Start free</button></div>
        </div>
      </header>

      <main>
        <section className="relative border-b border-slate-800">
          <div className="absolute inset-0 landing-grid pointer-events-none" />
          <div className="max-w-7xl mx-auto px-5 sm:px-6 pt-20 pb-16 lg:pt-28 lg:pb-24 relative">
            <div className="grid lg:grid-cols-[.92fr_1.08fr] gap-14 lg:gap-16 items-center">
              <div>
                <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[.15em] text-slate-400 mb-6"><span className="w-2 h-2 rounded-full bg-blue-400" /> Prospecting workspace for service businesses</div>
                <h1 className="text-5xl sm:text-6xl lg:text-[4.35rem] font-semibold text-white tracking-[-.045em] leading-[1.02]">Find the right lead.<br />Make the right case.</h1>
                <p className="text-lg sm:text-xl leading-relaxed text-slate-400 mt-6 max-w-xl">LeadScope turns local business data into qualified opportunities, client-ready evidence, and relevant outreach—without juggling five different tools.</p>
                <div className="flex flex-col sm:flex-row gap-3 mt-9"><button onClick={onGetStarted} className="btn-primary px-6 py-3 text-base">Start free <ArrowRight className="w-4 h-4" /></button><button onClick={scrollToProduct} className="btn-secondary px-6 py-3 text-base">See the workflow</button></div>
                <div className="flex flex-wrap gap-x-5 gap-y-2 mt-7 text-xs text-slate-500"><span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-blue-400" /> No credit card</span><span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-blue-400" /> Human approval built in</span><span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-blue-400" /> English, Albanian & Macedonian</span></div>
              </div>

              <div className="rounded-2xl border border-slate-700/80 bg-[#0d151f] shadow-2xl shadow-black/40 overflow-hidden">
                <div className="h-11 border-b border-slate-800 flex items-center justify-between px-4"><div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-red-400/70" /><span className="w-2 h-2 rounded-full bg-amber-400/70" /><span className="w-2 h-2 rounded-full bg-emerald-400/70" /></div><span className="text-[10px] uppercase tracking-[.16em] text-slate-600">Lead workspace</span></div>
                <div className="grid sm:grid-cols-[170px_1fr] min-h-[410px]">
                  <div className="hidden sm:block border-r border-slate-800 p-4 space-y-2">{['Overview', 'Leads', 'Audits', 'Campaign'].map((item, index) => <div key={item} className={`rounded-md px-3 py-2 text-xs ${index === 1 ? 'bg-slate-800 text-white' : 'text-slate-500'}`}>{item}</div>)}</div>
                  <div className="p-5 sm:p-6">
                    <div className="flex items-start justify-between gap-4"><div><p className="text-xs text-slate-500">Opportunity review</p><h2 className="text-lg font-semibold text-white mt-1">Cedar Dental Clinic</h2><p className="text-xs text-slate-500 mt-1">Dental practice · New York</p></div><span className="rounded-md bg-amber-400/10 text-amber-300 border border-amber-400/15 px-2 py-1 text-[11px]">High opportunity</span></div>
                    <div className="grid grid-cols-3 gap-2 mt-6">{[['Website', '48'], ['SEO', '41'], ['Conversion', '36']].map(([label, value]) => <div key={label} className="rounded-lg bg-slate-950 border border-slate-800 p-3"><p className="text-[10px] text-slate-500">{label}</p><p className="text-xl font-semibold text-white mt-1">{value}</p></div>)}</div>
                    <div className="mt-4 rounded-lg bg-slate-950 border border-slate-800 p-4"><p className="text-xs font-medium text-slate-300">Why this lead is worth contacting</p><p className="text-xs leading-relaxed text-slate-500 mt-2">Strong public reviews, but the website hides key services and makes booking difficult on mobile.</p></div>
                    <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-blue-500/20 bg-blue-500/5 p-3"><div><p className="text-xs font-medium text-white">Email verified</p><p className="text-[11px] text-slate-500 mt-1">Ready for campaign review</p></div><button className="text-xs text-blue-300 font-medium">Open lead <ChevronRight className="w-3 h-3 inline" /></button></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="product" className="max-w-7xl mx-auto px-5 sm:px-6 py-20 lg:py-24">
          <div className="max-w-2xl"><p className="text-xs uppercase tracking-[.16em] font-semibold text-blue-400">One working system</p><h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white mt-3">A clear path from search to conversation.</h2><p className="text-slate-400 text-lg leading-relaxed mt-4">Every step keeps the context from the one before it, so your pitch is based on evidence—not a generic template.</p></div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-px bg-slate-800 border border-slate-800 rounded-xl overflow-hidden mt-12">{workflow.map(step => <div key={step.label} className="bg-[#0d151f] p-6 min-h-[220px]"><div className="flex items-center justify-between"><step.icon className="w-5 h-5 text-blue-400" /><span className="text-xs text-slate-600">{step.number}</span></div><h3 className="text-white font-semibold mt-12">{step.label}</h3><p className="text-sm text-slate-500 leading-relaxed mt-3">{step.text}</p></div>)}</div>
        </section>

        <section className="border-y border-slate-800 bg-[#0a1017]"><div className="max-w-7xl mx-auto px-5 sm:px-6 py-20 lg:py-24 grid lg:grid-cols-[.8fr_1.2fr] gap-14 items-start"><div><p className="text-xs uppercase tracking-[.16em] font-semibold text-blue-400">Built for real prospecting</p><h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white mt-3">Less busywork.<br />More useful context.</h2><p className="text-slate-400 leading-relaxed mt-5">LeadScope does not replace your judgment. It organizes the research, evidence, and follow-up so you can make better decisions faster.</p></div><div className="grid sm:grid-cols-3 gap-4">{capabilities.map(item => <article key={item.title} className="rounded-xl border border-slate-800 bg-slate-900 p-5"><item.icon className="w-5 h-5 text-blue-400" /><h3 className="font-semibold text-white mt-8">{item.title}</h3><p className="text-sm text-slate-500 leading-relaxed mt-3">{item.text}</p></article>)}</div></div></section>

        <section className="max-w-7xl mx-auto px-5 sm:px-6 py-20 lg:py-24"><div className="grid lg:grid-cols-2 gap-12 items-center"><div className="rounded-xl border border-slate-800 bg-slate-900 p-5 sm:p-6"><div className="flex items-center justify-between border-b border-slate-800 pb-4"><div className="flex items-center gap-2"><UsersRound className="w-4 h-4 text-blue-400" /><span className="text-sm font-medium text-white">Campaign review</span></div><span className="text-[11px] text-slate-500">12 qualified leads</span></div><div className="space-y-3 mt-5">{[['Cedar Dental Clinic', 'Email verified', 'Review'], ['Northside Orthodontics', 'Audit ready', 'Prepare'], ['Bright Smile Studio', 'Queued', 'Waiting']].map(([name, status, action], index) => <div key={name} className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950 p-3"><span className={`w-2 h-2 rounded-full ${index === 0 ? 'bg-emerald-400' : index === 1 ? 'bg-amber-400' : 'bg-slate-600'}`} /><div className="flex-1 min-w-0"><p className="text-sm text-slate-200 truncate">{name}</p><p className="text-[11px] text-slate-500 mt-0.5">{status}</p></div><span className="text-xs text-slate-400">{action}</span></div>)}</div><div className="mt-5 flex items-center gap-2 text-xs text-slate-500"><ShieldCheck className="w-4 h-4 text-blue-400" /> Nothing sends before your approval.</div></div><div><p className="text-xs uppercase tracking-[.16em] font-semibold text-blue-400">Control stays with you</p><h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white mt-3">Automation without losing the human decision.</h2><p className="text-slate-400 text-lg leading-relaxed mt-5">Approve messages, set daily limits, suppress contacts, and stop follow-ups when a lead responds. The workflow scales; your reputation stays protected.</p><div className="grid sm:grid-cols-2 gap-3 mt-7 text-sm text-slate-300">{['Message approval', 'Daily sending limits', 'Verified email rules', 'Suppression protection'].map(item => <div key={item} className="flex items-center gap-2"><Check className="w-4 h-4 text-blue-400" />{item}</div>)}</div></div></div></section>

        <section className="max-w-7xl mx-auto px-5 sm:px-6 pb-20"><div className="rounded-2xl border border-slate-700 bg-slate-900 p-8 sm:p-12 flex flex-col lg:flex-row lg:items-center justify-between gap-8"><div><div className="flex items-center gap-2 text-xs uppercase tracking-[.14em] text-blue-400 font-semibold"><Sparkles className="w-4 h-4" /> Start with a focused search</div><h2 className="text-3xl font-semibold text-white mt-4">Build a prospecting process you can trust.</h2><p className="text-slate-400 mt-3">Find better opportunities and approach them with a reason worth reading.</p></div><button onClick={onGetStarted} className="btn-primary px-6 py-3 text-base shrink-0">Start free <ArrowRight className="w-4 h-4" /></button></div></section>
      </main>

      <footer className="border-t border-slate-800 py-9"><div className="max-w-7xl mx-auto px-5 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-5"><div className="flex items-center gap-4"><BrandLogo className="h-9 w-auto object-contain" /><span className="hidden sm:block w-px h-5 bg-slate-800" /><span className="text-xs text-slate-600">Prospecting with evidence.</span></div><div className="flex flex-wrap items-center justify-center gap-4 text-sm">{onFAQ && <button onClick={onFAQ} className="text-slate-500 hover:text-white">FAQ</button>}{onDocumentation && <button onClick={onDocumentation} className="text-slate-500 hover:text-white">Documentation</button>}{onUpdates && <a href="/updates" onClick={event => { event.preventDefault(); onUpdates(); }} className="text-slate-500 hover:text-white">Updates</a>}{onAffiliate && <button onClick={onAffiliate} className="text-slate-500 hover:text-white">Affiliates</button>}<span className="text-slate-600">© {new Date().getFullYear()}</span></div></div></footer>
    </div>
  );
}
