import { ArrowRight, BookOpen, ChevronLeft, CheckCircle2, Crosshair, Mail, Search, Sparkles } from 'lucide-react';
import { SEO } from '../components/SEO';

interface Props {
  onBack: () => void;
  onGetStarted: () => void;
  onLogin: () => void;
}

const sections = [
  {
    title: 'Lead Discovery',
    icon: Search,
    items: ['Search local businesses by location and niche', 'Google Places-based lead discovery', 'Business category detection', 'Website status targeting', 'No website, social-only, and has website filters'],
  },
  {
    title: 'Saved Leads',
    icon: BookOpen,
    items: ['Save important leads', 'Filter saved and unsaved leads', 'Build a focused prospecting list'],
  },
  {
    title: 'AI Website Audits',
    icon: Sparkles,
    items: ['Website, SEO, and conversion scores', 'Main issues and recommended offer', 'Personalization angle', 'Summary for outreach'],
  },
  {
    title: 'SEO & Content Opportunity Pack',
    icon: Sparkles,
    items: ['Suggested, local, service, and long-tail keywords', 'Meta title, meta description, and H1 suggestion', 'Service page, blog, and Google Business post ideas', 'Homepage copy and recommended service'],
  },
  {
    title: 'Shareable Audit Reports',
    icon: BookOpen,
    items: ['Public audit links', 'No login required for prospects', 'Multilingual reports', 'Internal pricing hidden from public reports'],
  },
  {
    title: 'AI Website Preview Links',
    icon: Sparkles,
    items: ['Generate client-ready website preview concepts', 'Industry-specific layout and copy', 'Business-specific visuals and dynamic variations', 'Regenerate a preview and share its public link'],
  },
  {
    title: 'Outreach Messages',
    icon: Mail,
    items: ['Generate personalized outreach', 'Edit the subject and body before sending', 'Copy a message for another channel', 'Use lead data, audit issues, SEO insights, and agency information'],
  },
  {
    title: 'Email Sending / SMTP',
    icon: Mail,
    items: ['Connect your SMTP settings', 'Send a test email', 'Send edited outreach emails from Lead Detail', 'Emails are sent manually after review', 'SMTP passwords are stored encrypted'],
  },
  {
    title: 'Email Outreach History',
    icon: Mail,
    items: ['Use the global Email Outreach page to track sent emails', 'View recipient, subject, lead, status, provider, and sent date', 'Review email history for a specific lead in Lead Detail'],
  },
  {
    title: 'Plans and usage limits',
    icon: CheckCircle2,
    items: ['The Free Trial includes limited usage', 'Paid plans unlock higher limits', 'Choose a plan that fits your prospecting workflow'],
  },
] as const;

const workflow = [
  'Find local business leads', 'Filter by website status', 'Save the best opportunities', 'Run AI website audits', 'Generate SEO and content opportunities',
  'Create shareable audit reports', 'Generate AI website preview links', 'Edit outreach messages', 'Send outreach emails', 'Track sent emails',
];

export function DocumentationPage({ onBack, onGetStarted, onLogin }: Props) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <SEO
        title="LeadScope AI Documentation - Learn How LeadScope AI Works"
        description="Learn how to use LeadScope AI for lead discovery, AI audits, website previews, outreach messages, SMTP email sending, and email outreach tracking."
        canonicalPath="/docs"
      />
      <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <button onClick={onBack} className="flex items-center gap-2.5 text-white font-bold text-lg">
            <span className="w-8 h-8 rounded-lg bg-blue-600 grid place-items-center"><Crosshair className="w-4 h-4" /></span>
            LeadScope <span className="text-blue-400">AI</span>
          </button>
          <div className="flex items-center gap-3">
            <button onClick={onLogin} className="btn-secondary text-sm py-2">Sign In</button>
            <button onClick={onGetStarted} className="btn-primary text-sm py-2">Get Started</button>
          </div>
        </div>
      </header>

      <main>
        <section className="border-b border-slate-800 bg-gradient-to-b from-blue-950/30 to-slate-950">
          <div className="max-w-5xl mx-auto px-6 py-20 sm:py-24 text-center">
            <p className="text-blue-400 font-medium text-sm uppercase tracking-[0.2em] mb-4">Documentation</p>
            <h1 className="text-4xl sm:text-5xl font-bold text-white tracking-tight">LeadScope AI Documentation</h1>
            <p className="text-lg sm:text-xl text-slate-400 leading-relaxed max-w-3xl mx-auto mt-6">Learn how to use LeadScope AI to find leads, audit businesses, create client-ready reports, generate website previews, send outreach emails, and track your outreach activity.</p>
          </div>
        </section>

        <section className="max-w-5xl mx-auto px-6 py-16">
          <div className="max-w-3xl">
            <p className="text-blue-400 font-medium text-sm uppercase tracking-[0.2em] mb-3">Overview</p>
            <h2 className="text-3xl font-bold text-white">Turn local opportunities into better pitches.</h2>
            <p className="mt-5 text-slate-400 leading-relaxed">LeadScope AI is a lead generation and sales intelligence platform built for agencies, freelancers, web designers, SEO specialists, and marketing teams. It helps users find local business leads, understand their online presence, generate client-ready audit reports, create website preview concepts, and send better outreach.</p>
          </div>
        </section>

        <section className="border-y border-slate-800 bg-slate-900/40">
          <div className="max-w-5xl mx-auto px-6 py-16">
            <p className="text-blue-400 font-medium text-sm uppercase tracking-[0.2em] mb-3">Lead-to-pitch workflow</p>
            <h2 className="text-3xl font-bold text-white mb-8">A simple workflow from discovery to follow-up.</h2>
            <ol className="grid sm:grid-cols-2 gap-3">
              {workflow.map((step, index) => <li key={step} className="flex items-center gap-4 rounded-xl border border-slate-800 bg-slate-950/70 p-4"><span className="w-8 h-8 shrink-0 rounded-lg bg-blue-500/15 text-blue-400 grid place-items-center text-sm font-bold">{index + 1}</span><span className="text-sm font-medium text-slate-200">{step}</span></li>)}
            </ol>
          </div>
        </section>

        <section className="max-w-5xl mx-auto px-6 py-16">
          <div className="grid md:grid-cols-2 gap-5">
            {sections.map(({ title, icon: Icon, items }) => (
              <article key={title} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
                <div className="w-10 h-10 rounded-xl bg-blue-500/15 text-blue-400 grid place-items-center mb-5"><Icon className="w-5 h-5" /></div>
                <h2 className="text-xl font-semibold text-white">{title}</h2>
                <ul className="mt-4 space-y-3">{items.map(item => <li key={item} className="flex gap-2.5 text-sm leading-relaxed text-slate-400"><CheckCircle2 className="w-4 h-4 shrink-0 text-blue-400 mt-0.5" />{item}</li>)}</ul>
              </article>
            ))}
          </div>
        </section>

        <section className="max-w-5xl mx-auto px-6 pb-20">
          <div className="rounded-2xl border border-slate-700 bg-slate-900 p-8 sm:p-10 text-center">
            <h2 className="text-2xl font-bold text-white">Need help getting started?</h2>
            <p className="max-w-2xl mx-auto mt-3 text-slate-400">Contact the LeadScope AI team for help, or check the FAQ page for answers to common questions.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center mt-7"><button onClick={onGetStarted} className="btn-primary px-5 py-2.5">Start Free Trial <ArrowRight className="w-4 h-4" /></button><button onClick={onBack} className="btn-secondary px-5 py-2.5">Back to home</button></div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-800 py-8"><div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm"><button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-blue-400"><ChevronLeft className="w-4 h-4" /> Back to home</button><span className="text-slate-600">© {new Date().getFullYear()} LeadScope AI. All rights reserved.</span></div></footer>
    </div>
  );
}
