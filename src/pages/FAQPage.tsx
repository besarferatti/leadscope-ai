import { ChevronLeft, Crosshair, Plus } from 'lucide-react';
import { SEO } from '../components/SEO';

interface Props {
  onBack: () => void;
  onGetStarted: () => void;
  onLogin: () => void;
}

const faqs = [
  ['What is LeadScope AI?', 'LeadScope AI is a lead generation and sales intelligence platform built for agencies, freelancers, web designers, and SEO teams. It helps users find local businesses, audit their online presence, generate outreach messages, and create client-ready website preview links.'],
  ['Who is LeadScope AI built for?', 'LeadScope AI is built for digital agencies, freelancers, web designers, SEO specialists, marketing consultants, and local service providers who want to find better prospects and turn audits into sales conversations.'],
  ['What can I do with LeadScope AI?', 'You can search for local businesses, filter leads by website status, save leads, run AI website audits, generate SEO and content opportunities, create outreach messages, share public audit reports, and generate AI website preview links.'],
  ['Can I find businesses without websites?', 'Yes. LeadScope AI includes website status targeting so users can search for businesses with no website, social-only profiles, or existing websites.'],
  ['What are AI website audits?', 'AI website audits review a prospect\'s online presence and provide website, SEO, and conversion scores. They also identify main issues, recommend an offer, and suggest a personalization angle for outreach.'],
  ['What are SEO & Content Opportunities?', 'The SEO & Content Opportunity Pack turns an audit into practical recommendations, including primary, local, service, and long-tail keywords; metadata and H1 suggestions; service-page, blog, and Google Business post ideas; homepage copy direction; and a recommended service.'],
  ['Can I share audit reports with clients?', 'Yes. LeadScope AI supports public audit share links. Reports can be shared without requiring the client to log in.'],
  ['What are multilingual audit reports?', 'Public audit reports can be shared in English, Albanian, and Macedonian, so agencies can present findings in a language that is appropriate for the prospect.'],
  ['What are AI Website Preview Links?', 'AI Website Preview Links turn a business audit into a visual website concept that can be shared with a prospect. They use industry-specific layout and copy, business-specific visuals, and dynamic variations that can be regenerated.'],
  ['Can I generate outreach messages?', 'Yes. LeadScope AI generates personalized email and direct-message drafts using lead data, audit issues, SEO opportunities, and your agency settings—without placeholder sender information.'],
  ['What are Saved Leads?', 'Saved Leads lets you keep the highest-potential prospects from a search in one place, so your team can return to the audit, report, preview, and outreach work when it is time to pitch.'],
  ['Is there a free trial?', 'Yes. LeadScope AI includes a free trial so users can test core features with usage limits before upgrading.'],
  ['Can agencies use LeadScope AI for client outreach?', 'Yes. LeadScope AI is designed to help agencies find prospects, understand their needs, and present better offers through audits, SEO insights, outreach messages, and website preview links.'],
  ['Do I need technical skills to use LeadScope AI?', 'No. LeadScope AI is designed for agencies and freelancers who want practical lead generation and sales assets without manually researching every business.'],
] as const;

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map(([name, text]) => ({
    '@type': 'Question',
    name,
    acceptedAnswer: { '@type': 'Answer', text },
  })),
};

export function FAQPage({ onBack, onGetStarted, onLogin }: Props) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <SEO
        title="Frequently Asked Questions | LeadScope AI"
        description="Answers to common questions about LeadScope AI for agencies and freelancers."
        canonicalPath="/faq"
        structuredData={faqSchema}
      />
      <header className="border-b border-slate-800/60 bg-slate-950/90 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <button onClick={onBack} className="flex items-center gap-2.5 text-white font-bold text-lg">
            <span className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center"><Crosshair className="w-4 h-4 text-white" /></span>
            LeadScope <span className="text-blue-400">AI</span>
          </button>
          <div className="flex items-center gap-3">
            <button onClick={onLogin} className="btn-secondary text-sm py-2">Sign In</button>
            <button onClick={onGetStarted} className="btn-primary text-sm py-2">Get Started</button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-20 sm:py-24">
        <div className="text-center mb-14">
          <p className="text-blue-400 font-medium text-sm uppercase tracking-[0.2em] mb-4">LeadScope AI</p>
          <h1 className="text-4xl sm:text-5xl font-bold text-white tracking-tight mb-5">Frequently Asked Questions</h1>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">Everything agencies and freelancers need to know about LeadScope AI.</p>
        </div>
        <div className="space-y-4">
          {faqs.map(([question, answer]) => (
            <details key={question} className="group rounded-xl border border-slate-800 bg-slate-900/70 px-6 py-5 open:border-blue-500/40">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-lg font-semibold text-white">
                {question}
                <Plus className="w-5 h-5 flex-shrink-0 text-blue-400 transition-transform group-open:rotate-45" />
              </summary>
              <p className="pt-4 pr-8 text-sm leading-relaxed text-slate-400">{answer}</p>
            </details>
          ))}
        </div>
      </main>
      <footer className="border-t border-slate-800 py-8">
        <div className="max-w-4xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm">
          <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-blue-400 transition-colors"><ChevronLeft className="w-4 h-4" /> Back to home</button>
          <span className="text-slate-600">© {new Date().getFullYear()} LeadScope AI. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}
