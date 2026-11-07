import { BrandLogo } from '../components/BrandLogo';
import { SEO } from '../components/SEO';

const privacySections = [
  {
    title: 'Who we are',
    text: 'Lead Scope LLC operates LeadScope AI, a service for finding business prospects, auditing websites, generating reports and previews, and preparing and sending outreach. For questions about this policy or your personal data, use the support email below.',
  },
  {
    title: 'Information we collect',
    text: 'We process your name, email address, account ID, authentication and session information, support messages, subscription and usage records, and information about how you use the service. When you use the workspace, we process the searches, saved leads, audit inputs, generated content, outreach records, and email-sending settings needed to provide those features. Business lead data may come from business listings, public websites, or information submitted by a customer. It can include business contact details that identify an individual.',
  },
  {
    title: 'Sign in with Google',
    text: 'If you choose Continue with Google, Google and our authentication provider, Supabase, use basic identity information to sign you in. This can include your Google account identifier, email address, and basic profile information such as your name and profile picture. Supabase stores the linked identity and associated account information. LeadScope uses your account ID, name, and email to create or identify your account and maintain your sign-in session. This connection does not request access to Gmail, Google Drive, or Google Calendar. Google sign-in data is used for account authentication and account management. We do not sell it or use it for advertising.',
  },
  {
    title: 'How we use information',
    text: 'We use information to provide and secure the service, manage accounts, deliver features you request, process subscriptions, respond to support requests, measure and improve the service, and comply with legal obligations. Where applicable, we process data to perform our agreement with you, meet legal obligations, pursue legitimate interests such as preventing abuse and maintaining the service, or rely on consent where required.',
  },
  {
    title: 'Service providers and sharing',
    text: 'Supabase provides authentication and data storage. Stripe processes payments and provides subscription information to LeadScope. Google Places provides business search results, Google Analytics helps measure site usage, and OpenAI processes inputs for AI features you choose to use. Your configured email provider processes messages you choose to send. We may also share information when legally required or to protect the service and its users. Public audit and preview links can be viewed by anyone who has the link, so review their contents before sharing them.',
  },
  {
    title: 'Cookies and browser storage',
    text: 'We use browser storage for features such as maintaining sign-in sessions and remembering settings. Google Analytics may use cookies or similar technologies to measure site usage. Your browser settings let you manage cookies and local storage.',
  },
  {
    title: 'Retention and security',
    text: 'We keep information for as long as needed to provide the service and for purposes such as recordkeeping, resolving disputes, security, and meeting legal obligations. Retention depends on the type of information and why it was collected. We use access controls to protect account and workspace data.',
  },
  {
    title: 'Your choices and rights',
    text: 'You can update account details in Settings and manage Google permissions in your Google Account. To ask for access, correction, deletion, a copy of your data, or to object to or restrict processing, contact us below. The rights available depend on applicable law. Where processing relies on consent, you may withdraw it. You may also have the right to complain to your local data protection authority.',
  },
];

const termsSections = [
  {
    title: 'Using LeadScope AI',
    text: 'These terms are an agreement between you and Lead Scope LLC, the operator of LeadScope AI. They apply to lead discovery, saved leads, website audits, reports, previews, and outreach tools. By using the service, you agree to these terms. If you use the service for an organization, you must have authority to act for it.',
  },
  {
    title: 'Your account',
    text: 'Provide accurate account information, keep your credentials secure, and tell us if you suspect unauthorized access. You are responsible for how you and anyone you authorize use your account.',
  },
  {
    title: 'Trials, subscriptions, and cancellation',
    text: 'Your plan, price, billing interval, and included usage are shown when you select a plan or check out. Paid subscriptions renew at the disclosed interval unless canceled. You can manage or cancel a subscription through Settings → Billing. Cancel before the next renewal to avoid the next recurring charge. Any refund or cancellation rights required by applicable law apply.',
  },
  {
    title: 'Acceptable use',
    text: 'Use the service lawfully and respect the rights of businesses and individuals. Do not send spam or deceptive messages, impersonate others, access accounts or data without authorization, or bypass service limits or security controls. You are responsible for the lawful collection and use of lead data, for any required consent and opt-out mechanisms, and for complying with applicable privacy and marketing rules.',
  },
  {
    title: 'Your content and shared links',
    text: 'You retain any rights you have in the content you submit. You allow LeadScope to process that content as needed to provide the features you use. You must have the rights needed to submit or share it. Anyone with a public audit or preview link may be able to view it, so review the contents before sharing.',
  },
  {
    title: 'Business data and AI output',
    text: 'Business listings, website analyses, and AI-generated material can be incomplete, inaccurate, or out of date. Review the material and verify contact details before relying on it, publishing it, or sending outreach. External providers and integrations may have their own terms.',
  },
  {
    title: 'Changes, suspension, and ending use',
    text: 'We may update the service or these terms. We will provide notice of material changes where required by law. We may suspend access to address misuse, security threats, or violations of these terms. You may stop using the service at any time. To stop future recurring charges, cancel an active paid subscription in Billing.',
  },
  {
    title: 'Rights under applicable law',
    text: 'Nothing in these terms limits any rights or remedies that cannot be limited by applicable law.',
  },
];

export function LegalPage({ kind }: { kind: 'privacy' | 'terms' }) {
  const isPrivacy = kind === 'privacy';
  const title = isPrivacy ? 'Privacy Policy' : 'Terms of Service';
  const sections = isPrivacy ? privacySections : termsSections;
  const otherPage = isPrivacy ? { href: '/terms', label: 'Terms of Service' } : { href: '/privacy', label: 'Privacy Policy' };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-300">
      <SEO title={`${title} | LeadScope AI`} description={`Read the LeadScope AI ${title.toLowerCase()}.`} canonicalPath={`/${kind}`} />
      <header className="border-b border-slate-800">
        <nav aria-label="Legal pages" className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-4 px-6 py-5">
          <a href="/" aria-label="LeadScope AI home"><BrandLogo className="h-8 w-auto" /></a>
          <a href={otherPage.href} className="text-sm text-blue-300 hover:underline">{otherPage.label}</a>
        </nav>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="mb-9 text-4xl font-bold text-white">{title}</h1>
        <div className="space-y-8 leading-relaxed">
          {sections.map(section => (
            <section key={section.title}>
              <h2 className="mb-2 text-xl font-semibold text-white">{section.title}</h2>
              <p>{section.text}</p>
            </section>
          ))}
          <section>
            <h2 className="mb-2 text-xl font-semibold text-white">Contact</h2>
            <p>Email <a href="mailto:support@leadscope.pro" className="text-blue-300 underline">support@leadscope.pro</a> for questions or requests.</p>
          </section>
        </div>
      </main>
    </div>
  );
}
