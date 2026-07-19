import { ArrowLeft, Check, Crosshair, Sparkles } from 'lucide-react';
import { SEO } from '../components/SEO';
import { productUpdates } from '../data/productUpdates';

interface Props {
  onBack: () => void;
  onGetStarted: () => void;
  onLogin: () => void;
  onDocumentation: () => void;
}

export function UpdatesPage({ onBack, onGetStarted, onLogin, onDocumentation }: Props) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <SEO
        title="LeadScope AI Product Updates - New Features and Improvements"
        description="See the latest LeadScope AI product updates, including email outreach, SMTP sending, website preview links, shareable audit reports, saved leads, and SEO opportunity tools."
        canonicalPath="/updates"
      />

      <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <button onClick={onBack} className="flex items-center gap-2.5 text-lg font-bold text-white">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-600"><Crosshair className="h-4 w-4" /></span>
            LeadScope <span className="text-blue-400">AI</span>
          </button>
          <div className="flex items-center gap-3">
            <button onClick={onLogin} className="btn-secondary py-2 text-sm">Sign In</button>
            <button onClick={onGetStarted} className="btn-primary py-2 text-sm">Get Started</button>
          </div>
        </div>
      </header>

      <main>
        <section className="border-b border-slate-800 bg-gradient-to-b from-blue-950/30 to-slate-950">
          <div className="mx-auto max-w-5xl px-6 py-20 sm:py-24">
            <div className="mx-auto max-w-3xl text-center">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-500/25 bg-blue-500/10 px-3 py-1.5 text-sm font-medium text-blue-300"><Sparkles className="h-4 w-4" /> Product updates</div>
              <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">Product Updates</h1>
              <p className="mt-5 text-lg text-slate-300 sm:text-xl">See what is new in LeadScope AI.</p>
              <p className="mx-auto mt-7 max-w-2xl rounded-xl border border-slate-800 bg-slate-900/70 px-5 py-4 text-sm leading-relaxed text-slate-400">LeadScope AI updates are published manually when major features are completed and ready for users.</p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-6 py-14 sm:py-16">
          <div className="mb-8 flex items-center gap-4"><div className="h-px flex-1 bg-slate-800" /><h2 className="text-lg font-semibold text-white">July 2026</h2><div className="h-px flex-1 bg-slate-800" /></div>
          <div className="relative space-y-5 border-l border-slate-800 pl-6 sm:pl-8">
            {productUpdates.map((update, index) => (
              <article key={update.title} className="relative rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-sm sm:p-6">
                <span className="absolute -left-[34px] top-7 h-3 w-3 rounded-full border-2 border-slate-950 bg-blue-400 sm:-left-[42px]" aria-hidden="true" />
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-white">{update.title}</h3>
                    <p className="mt-2 leading-relaxed text-slate-400">{update.description}</p>
                  </div>
                  <span className="badge w-fit shrink-0 bg-emerald-500/10 text-emerald-300">{index < 2 ? 'New' : 'Completed'}</span>
                </div>
                <ul className="mt-5 grid gap-2.5 sm:grid-cols-2">
                  {update.highlights.map(highlight => <li key={highlight} className="flex gap-2.5 text-sm leading-relaxed text-slate-300"><Check className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />{highlight}</li>)}
                </ul>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-800 py-8">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-6 text-sm sm:flex-row">
          <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-blue-400"><ArrowLeft className="h-4 w-4" /> Back to home</button>
          <div className="flex items-center gap-4"><button onClick={onDocumentation} className="text-slate-500 hover:text-blue-400">Documentation</button><span className="text-slate-600">© {new Date().getFullYear()} LeadScope AI.</span></div>
        </div>
      </footer>
    </div>
  );
}
