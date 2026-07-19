export interface ProductUpdate {
  title: string;
  description: string;
  detailedDescription?: string;
  category?: string;
  date?: string;
  highlights: string[];
}

// Product updates are intentionally curated and published manually.
export const productUpdates: ProductUpdate[] = [
  {
    title: 'Lead Email Finder',
    description: 'Find public business emails directly from a lead’s website.',
    detailedDescription: 'LeadScope AI can now search a lead’s website for publicly available business email addresses. The system checks the homepage and relevant pages such as Contact, About, Team, Support, and Impressum, then ranks the available email candidates and saves the strongest result.',
    category: 'Lead Discovery',
    date: '2026-07-19',
    highlights: [
      'Find business emails directly from Lead Detail.',
      'Searches mailto links, visible website text, and structured website data.',
      'Checks relevant internal pages such as Contact, About, Team, and Support.',
      'Saves the email source and confidence score.',
      'Shows all discovered email candidates.',
      'Marks discovered emails as Unverified before outreach.',
      'Protects users from unsafe or private network URLs during website scanning.',
      'Does not automatically send an email after discovery.',
    ],
  },
  {
    title: 'Email Outreach',
    description: 'Track outreach emails sent from LeadScope AI in one central place.',
    highlights: [
      'Added a global Email Outreach page.',
      'View sent outreach emails across all leads.',
      'See recipient, sender, subject, lead, status, provider, and sent date.',
      'Open individual email details when needed.',
    ],
  },
  {
    title: 'SMTP Email Sending',
    description: 'Send manually reviewed outreach emails from your connected email account.',
    highlights: [
      'Added SMTP email settings.',
      'Added SMTP test email support.',
      'Added manual Send Email action from Lead Detail.',
      'Emails are sent only after user review.',
      'SMTP passwords are stored securely.',
    ],
  },
  {
    title: 'Editable Outreach Messages',
    description: 'Review and customize generated outreach before using it.',
    highlights: [
      'Edit generated outreach subject and body.',
      'Save changes before copying or sending.',
      'Use the latest edited message for email outreach.',
    ],
  },
  {
    title: 'Sent Emails on Lead Detail',
    description: 'Track outreach history for each individual lead.',
    highlights: [
      'Added sent email history inside Lead Detail.',
      'View sent emails for a specific lead.',
      'Expand email body when needed.',
      'See sent or failed status.',
    ],
  },
  {
    title: 'AI Website Preview Links',
    description: 'Create shareable website preview concepts for prospects.',
    highlights: [
      'Generate website preview concepts for leads.',
      'Share public preview links with prospects.',
      'Regenerate previews when needed.',
      'Preview content adapts to the business category.',
    ],
  },
  {
    title: 'Shareable Audit Reports',
    description: 'Send client-ready audit reports with public links.',
    highlights: [
      'Added public audit report links.',
      'Prospects can view reports without logging in.',
      'Internal pricing guidance is hidden from public reports.',
      'Reports can be shared directly with prospects.',
    ],
  },
  {
    title: 'Multilingual Audit Reports',
    description: 'Share audit reports in multiple languages.',
    highlights: [
      'Added public report support for English.',
      'Added Albanian report support.',
      'Added Macedonian report support.',
    ],
  },
  {
    title: 'SEO & Content Opportunity Pack',
    description: 'Turn audits into actionable SEO and content ideas.',
    highlights: [
      'Added keyword suggestions.',
      'Added meta title, meta description, and H1 suggestions.',
      'Added service page and blog post ideas.',
      'Added Google Business post ideas.',
      'Added homepage copy suggestions.',
      'Added recommended service guidance.',
    ],
  },
  {
    title: 'Saved Leads',
    description: 'Build a focused prospect list inside LeadScope AI.',
    highlights: [
      'Save important leads.',
      'Unsave leads when needed.',
      'Filter saved and unsaved leads.',
      'Keep your best opportunities organized.',
    ],
  },
  {
    title: 'Website Status Targeting',
    description: 'Find prospects based on their current online presence.',
    highlights: [
      'Filter leads by all websites.',
      'Filter leads with real websites.',
      'Find businesses with no website.',
      'Find businesses using social-only pages.',
    ],
  },
  {
    title: 'Improved Lead Categorization',
    description: 'LeadScope AI now handles business categories more accurately.',
    highlights: [
      'Improved category detection.',
      'Preserves more specific business categories.',
      'Reduces broad generic labels when better category data is available.',
    ],
  },
  {
    title: 'AI Website Audits',
    description: 'Analyze a business website and turn insights into outreach angles.',
    highlights: [
      'Added website score.',
      'Added SEO score.',
      'Added conversion score.',
      'Added main issues and recommendations.',
      'Added personalization angle for outreach.',
    ],
  },
  {
    title: 'Lead Discovery',
    description: 'Search for local business leads by location and niche.',
    highlights: [
      'Search businesses by city and niche.',
      'Discover local prospects.',
      'Review lead details inside the dashboard.',
      'Use audits, previews, and outreach tools after finding leads.',
    ],
  },
];
