import { ArrowRight, Check, FileText, Globe2, Mail, Search, Sparkles, Target, UserRoundCheck } from 'lucide-react';
import { SEO } from '../components/SEO';
import { BrandLogo } from '../components/BrandLogo';

interface Props {
  onGetStarted: () => void;
  onLogin: () => void;
  onPricing?: () => void;
  onAffiliate?: () => void;
  onFAQ?: () => void;
  onDocumentation?: () => void;
  onUpdates?: () => void;
}

const softwareApplicationSchema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'LeadScope AI',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  description: 'Lead generation, AI audit, SEO opportunity, and website preview workflow for agencies and freelancers.',
  offers: ['Free Trial', 'Starter', 'Pro', 'Agency', 'Enterprise'].map(name => ({ '@type': 'Offer', name })),
};

const workflow = [
  'Find local business leads', 'Filter by website status', 'Save the best opportunities', 'Run AI website audits',
  'Generate SEO & content opportunities', 'Create shareable audit reports', 'Generate AI website preview links', 'Send personalized outreach',
];

const opportunityItems = [
  'Primary, local, service, and long-tail keywords', 'Meta title, meta description, and H1 suggestion',
  'Service page, blog post, and Google Business post ideas', 'Homepage copy direction and recommended service',
];

function SectionHeading({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return <div className="max-w-2xl mb-10">
    <p className="text-blue-400 text-sm font-semibold uppercase tracking-[0.16em] mb-3">{eyebrow}</p>
    <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-white mb-4">{title}</h2>
    <p className="text-slate-400 leading-relaxed text-lg">{children}</p>
  </div>;
}

function CheckList({ items }: { items: string[] }) {
  return <ul className="space-y-3">
    {items.map(item => <li key={item} className="flex gap-3 text-sm text-slate-300 leading-relaxed">
      <Check className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />{item}
    </li>)}
  </ul>;
}

export function LandingPage({ onGetStarted, onLogin, onPricing, onAffiliate, onFAQ, onDocumentation, onUpdates }: Props) {
  const scrollToFeatures = () => document.getElementById('workflow')?.scrollIntoView({ behavior: 'smooth' });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 overflow-hidden">
      <SEO
        title="LeadScope AI - Lead Generation, AI Audits, and Website Preview Links for Agencies"
        description="Find local business leads, audit websites, generate SEO opportunities, create shareable audit reports, preview website concepts, and send better outreach with LeadScope AI."
        ogTitle="LeadScope AI - Turn Leads Into Client-Ready Pitches"
        ogDescription="LeadScope AI helps agencies and freelancers find local leads, audit websites, generate SEO insights, create shareable reports, and build AI website preview links."
        structuredData={softwareApplicationSchema}
      />
      <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center"><BrandLogo /></div>
          <nav className="hidden md:flex items-center gap-6 text-sm text-slate-400">
            <button onClick={scrollToFeatures} className="hover:text-white">Features</button>
            {onPricing && <button onClick={onPricing} className="hover:text-white">Pricing</button>}
            {onFAQ && <button onClick={onFAQ} className="hover:text-white">FAQ</button>}{onDocumentation && <button onClick={onDocumentation} className="hover:text-white">Documentation</button>}
          </nav>
          <div className="flex items-center gap-3"><button onClick={onLogin} className="text-slate-300 hover:text-white text-sm">Sign In</button><button onClick={onGetStarted} className="btn-primary text-sm py-2">Start Free Trial</button></div>
        </div>
      </header>

      <main>
        <section className="relative border-b border-slate-800/80 luxury-grid">
          <div className="absolute -right-48 -top-52 w-[44rem] h-[44rem] luxury-orb animate-glow-drift pointer-events-none" />
          <div className="max-w-7xl mx-auto px-6 py-20 lg:py-32 grid lg:grid-cols-[1.05fr_.95fr] gap-14 items-center relative">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-300 mb-7"><Target className="w-3.5 h-3.5 text-blue-400" /> Built for agencies and freelancers</div>
              <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl font-bold text-white tracking-tight leading-[.98]">Turn local business leads into <span className="text-blue-400">client-ready</span> pitches.</h1>
              <p className="text-xl leading-relaxed text-slate-400 mt-6 max-w-2xl">Find prospects, audit their online presence, generate SEO insights, create shareable reports, and show clients what a better website could look like.</p>
              <div className="flex flex-col sm:flex-row gap-3 mt-9"><button onClick={onGetStarted} className="btn-primary px-6 py-3 text-base rounded-xl">Start Free Trial <ArrowRight className="w-5 h-5" /></button><button onClick={scrollToFeatures} className="btn-secondary px-6 py-3 text-base rounded-xl">View Features</button></div>
              <p className="mt-5 text-sm text-slate-500">A practical lead-to-pitch workflow for web design, SEO, and marketing teams.</p>
            </div>
            <div className="rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl shadow-black/40 p-5 sm:p-6 animate-float-soft">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4"><div><p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Prospect workspace</p><p className="text-white font-semibold mt-1">Cedar Dental Clinic</p></div><span className="text-xs font-medium rounded-full bg-amber-400/10 text-amber-300 px-2.5 py-1">Website needs work</span></div>
              <div className="grid grid-cols-3 gap-3 py-5"><div className="rounded-xl bg-slate-950 border border-slate-800 p-3"><p className="text-xs text-slate-500">Website</p><p className="text-xl font-bold text-amber-300 mt-1">48</p></div><div className="rounded-xl bg-slate-950 border border-slate-800 p-3"><p className="text-xs text-slate-500">SEO</p><p className="text-xl font-bold text-orange-300 mt-1">41</p></div><div className="rounded-xl bg-slate-950 border border-slate-800 p-3"><p className="text-xs text-slate-500">Conversion</p><p className="text-xl font-bold text-red-300 mt-1">36</p></div></div>
              <div className="rounded-xl border border-blue-500/25 bg-blue-500/5 p-4"><div className="flex gap-3"><Sparkles className="w-5 h-5 text-blue-400 shrink-0" /><div><p className="text-sm font-semibold text-white">Recommended pitch</p><p className="text-sm text-slate-400 mt-1">Local SEO foundation, a clearer booking path, and a modern service-page structure.</p></div></div></div>
              <div className="grid sm:grid-cols-2 gap-3 mt-4"><button className="rounded-lg bg-blue-600 px-3 py-2.5 text-sm font-medium text-white">Create public audit</button><button className="rounded-lg border border-slate-700 px-3 py-2.5 text-sm font-medium text-slate-300">Generate website preview</button></div>
            </div>
          </div>
        </section>

        <section id="workflow" className="max-w-7xl mx-auto px-6 py-20">
          <div className="text-center max-w-2xl mx-auto mb-12"><p className="text-blue-400 text-sm font-semibold uppercase tracking-[0.16em] mb-3">One connected process</p><h2 className="font-display text-3xl sm:text-4xl font-bold text-white">From lead search to client pitch</h2></div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">{workflow.map((step, index) => <div key={step} className="card p-5 relative"><span className="text-xs font-semibold text-blue-400">{String(index + 1).padStart(2, '0')}</span><p className="text-white font-medium mt-7 leading-snug">{step}</p></div>)}</div>
        </section>

        <section className="border-y border-slate-800 bg-slate-900/40"><div className="max-w-7xl mx-auto px-6 py-20 grid lg:grid-cols-2 gap-12 items-center"><div><SectionHeading eyebrow="Lead discovery" title="Find better local business leads">Search Google Places by exact business category and location, then focus your time on prospects that match the services you sell.</SectionHeading><CheckList items={['Google Places lead search for targeted local prospecting', 'Exact categories and locations instead of broad, generic lists', 'Website status filters: no website, social-only, or has website', 'Saved Leads to keep the best opportunities ready for follow-up']} /></div><div className="card p-6"><div className="flex items-center gap-3 mb-6"><span className="w-10 h-10 rounded-lg bg-blue-500/10 grid place-items-center"><Search className="w-5 h-5 text-blue-400" /></span><div><p className="text-white font-semibold">Plumbers in Skopje</p><p className="text-sm text-slate-500">Google Places search</p></div></div><div className="flex flex-wrap gap-2 mb-5">{['No website', 'Social-only', 'Has website'].map((filter, i) => <span key={filter} className={`rounded-full px-3 py-1.5 text-xs ${i === 0 ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}>{filter}</span>)}</div><div className="space-y-3">{['AquaFix Plumbing', 'Rapid Drain Services', 'City Pipe Solutions'].map((lead, i) => <div className="flex justify-between rounded-lg border border-slate-800 bg-slate-950 px-4 py-3" key={lead}><span className="text-sm text-slate-200">{lead}</span><span className="text-xs text-slate-500">{i === 1 ? 'Social-only' : 'No website'}</span></div>)}</div></div></div></section>

        <section className="max-w-7xl mx-auto px-6 py-20 grid lg:grid-cols-2 gap-12 items-center"><div className="order-2 lg:order-1 card p-6"><div className="flex justify-between items-center border-b border-slate-800 pb-4"><span className="text-white font-semibold">AI website audit</span><span className="text-sm text-blue-400">Audit complete</span></div><div className="grid sm:grid-cols-3 gap-3 py-5">{[['Website score', '48'], ['SEO score', '41'], ['Conversion score', '36']].map(([label, score]) => <div key={label} className="rounded-xl bg-slate-950 border border-slate-800 p-4"><p className="text-xs text-slate-500">{label}</p><p className="text-2xl font-bold text-white mt-2">{score}<span className="text-sm text-slate-500">/100</span></p></div>)}</div><div className="space-y-2 text-sm"><p className="text-slate-300"><span className="text-slate-500">Main issue:</span> unclear primary service and weak booking path</p><p className="text-slate-300"><span className="text-slate-500">Offer:</span> conversion-focused website and local SEO setup</p><p className="text-slate-300"><span className="text-slate-500">Personalization:</span> reference their high review count and missing service detail</p></div></div><div className="order-1 lg:order-2"><SectionHeading eyebrow="AI website audits" title="Understand what each business needs">Turn a prospect's public website into a concise, useful diagnosis before you reach out.</SectionHeading><CheckList items={['Website, SEO, and conversion scores', 'Main issues that give you an honest reason to contact them', 'A recommended offer based on the gaps found', 'A personalization angle for a more relevant first message']} /></div></section>

        <section className="border-y border-slate-800 bg-slate-900/40"><div className="max-w-7xl mx-auto px-6 py-20 grid lg:grid-cols-2 gap-12 items-center"><div><SectionHeading eyebrow="SEO & Content Opportunity Pack" title="Turn audits into actionable SEO opportunities">Give your team a concrete SEO and content plan to discuss with each prospect—not a vague list of problems.</SectionHeading><CheckList items={opportunityItems} /></div><div className="card p-6"><div className="flex items-center gap-3 mb-5"><FileText className="w-5 h-5 text-blue-400" /><p className="font-semibold text-white">Opportunity pack</p></div><div className="grid gap-3">{['Primary keyword: emergency plumber Skopje', 'New service page: drain cleaning', 'Blog idea: What to do before a plumber arrives', 'Google Business post: same-day callouts'].map(item => <div key={item} className="rounded-lg bg-slate-950 border border-slate-800 p-3 text-sm text-slate-300">{item}</div>)}</div></div></div></section>

        <section className="max-w-7xl mx-auto px-6 py-20 grid lg:grid-cols-2 gap-12 items-center"><div className="card p-6"><div className="flex items-center justify-between mb-5"><div className="flex items-center gap-3"><Globe2 className="w-5 h-5 text-blue-400" /><span className="font-semibold text-white">Public audit report</span></div><span className="text-xs rounded-full bg-emerald-500/10 text-emerald-300 px-2 py-1">Live link</span></div><div className="rounded-lg bg-slate-950 border border-slate-800 p-4"><p className="text-xs text-slate-500">Share with a prospect</p><p className="text-sm text-blue-300 truncate mt-1">leadscope.pro/audit/share/cedar-dental</p></div><div className="flex gap-2 mt-4">{['English', 'Shqip', 'Македонски'].map(language => <span key={language} className="text-xs text-slate-300 border border-slate-700 rounded-md px-2.5 py-1.5">{language}</span>)}</div><p className="mt-5 text-sm text-slate-500">Internal pricing stays private.</p></div><div><SectionHeading eyebrow="Shareable audit links" title="Send client-ready audit reports">Give prospects a report they can open without creating an account, while keeping your internal pricing out of the public view.</SectionHeading><CheckList items={['Public audit links with no prospect login required', 'English, Albanian, and Macedonian report versions', 'A polished audit asset for your sales conversation', 'Internal pricing hidden from public reports']} /></div></section>

        <section className="border-y border-slate-800 bg-slate-900/40"><div className="max-w-7xl mx-auto px-6 py-20 grid lg:grid-cols-2 gap-12 items-center"><div><SectionHeading eyebrow="AI Website Preview Links" title="Show prospects what a better website could look like">Move beyond a written recommendation. Create a visual concept a prospect can open, review, and discuss with your team.</SectionHeading><CheckList items={['AI-generated website preview concepts', 'Industry-specific layout and copy', 'Business-specific visuals and images', 'Dynamic preview variations, public links, and regeneration']} /></div><div className="card p-5"><div className="rounded-xl overflow-hidden border border-slate-700 bg-slate-950"><div className="h-8 bg-slate-800 flex items-center gap-1.5 px-3"><span className="w-2 h-2 rounded-full bg-slate-600" /><span className="w-2 h-2 rounded-full bg-slate-600" /><span className="w-2 h-2 rounded-full bg-slate-600" /></div><div className="p-5"><p className="text-xs text-blue-400 font-semibold">CEDAR DENTAL</p><h3 className="text-2xl font-bold text-white mt-2">Confident care for every smile.</h3><p className="text-sm text-slate-400 mt-3">A business-specific website concept with clearer services and appointments.</p><div className="grid grid-cols-3 gap-2 mt-5">{['Services', 'Reviews', 'Book now'].map(item => <div className="h-14 rounded-lg bg-slate-800 text-xs text-slate-400 grid place-items-center" key={item}>{item}</div>)}</div></div></div><div className="flex items-center justify-between mt-4 text-sm"><span className="text-slate-400">Preview variation 2 of 3</span><button className="text-blue-400 font-medium">Regenerate</button></div></div></div></section>

        <section className="max-w-7xl mx-auto px-6 py-20 grid lg:grid-cols-2 gap-12 items-center"><div className="card p-6 order-2 lg:order-1"><div className="flex items-center gap-3 mb-5"><Mail className="w-5 h-5 text-blue-400" /><span className="font-semibold text-white">Personalized outreach</span></div><p className="text-sm text-slate-300 leading-relaxed rounded-lg border border-slate-800 bg-slate-950 p-4">Hi Cedar Dental team, I noticed your practice has strong reviews, but patients have to work to find the services and booking options on your website. I put together a short audit with a few quick wins for local search and conversions.</p><div className="flex gap-2 mt-4"><span className="text-xs rounded bg-slate-800 px-2.5 py-1.5 text-slate-300">Email</span><span className="text-xs rounded bg-slate-800 px-2.5 py-1.5 text-slate-300">Direct message</span></div></div><div className="order-1 lg:order-2"><SectionHeading eyebrow="Outreach generation" title="Generate personalized outreach faster">Use the work you have already done to write a stronger first message with context—not placeholder sender details.</SectionHeading><CheckList items={['Email and DM generation', 'Uses lead data, audit issues, SEO opportunities, and agency settings', 'No placeholder sender information', 'Better pitch context for each prospect']} /></div></section>

        <section className="max-w-7xl mx-auto px-6 pb-20"><div className="rounded-2xl border border-slate-700 bg-slate-900 p-8 sm:p-12 text-center"><UserRoundCheck className="w-8 h-8 text-blue-400 mx-auto mb-5" /><h2 className="font-display text-3xl font-bold text-white">Build a better lead-to-pitch process.</h2><p className="text-slate-400 max-w-xl mx-auto mt-4">Find local opportunities, produce useful sales assets, and give every prospect a clear next step.</p><div className="flex flex-col sm:flex-row justify-center gap-3 mt-8"><button onClick={onGetStarted} className="btn-primary px-6 py-3 text-base rounded-xl">Start Free Trial <ArrowRight className="w-5 h-5" /></button>{onPricing && <button onClick={onPricing} className="btn-secondary px-6 py-3 text-base rounded-xl">View pricing</button>}</div><p className="mt-6 text-sm text-slate-500">Questions before you start? {onFAQ && <button onClick={onFAQ} className="text-blue-400 hover:text-blue-300">Read the FAQ.</button>}</p></div></section>
      </main>

      <footer className="border-t border-slate-800 py-8"><div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4"><BrandLogo className="h-6 w-auto object-contain" /><div className="flex flex-wrap items-center justify-center gap-4 text-sm">{onFAQ && <button onClick={onFAQ} className="text-slate-500 hover:text-blue-400">FAQ</button>}{onDocumentation && <button onClick={onDocumentation} className="text-slate-500 hover:text-blue-400">Documentation</button>}{onUpdates && <a href="/updates" onClick={event => { event.preventDefault(); onUpdates(); }} className="text-slate-500 hover:text-blue-400">Product Updates</a>}{onAffiliate && <button onClick={onAffiliate} className="text-slate-500 hover:text-blue-400">Affiliate Program</button>}<span className="text-slate-600">© {new Date().getFullYear()} LeadScope AI.</span></div></div></footer>
    </div>
  );
}
