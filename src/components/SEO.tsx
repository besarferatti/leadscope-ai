import { useEffect } from 'react';

interface SEOProps {
  title?: string;
  description?: string;
  canonicalPath?: string;
  noindex?: boolean;
  structuredData?: Record<string, unknown>;
}

const SITE_URL = 'https://www.leadscope.pro';
const DEFAULT_TITLE = 'LeadScope AI - AI Lead Generation for Agencies and Freelancers';
const DEFAULT_DESCRIPTION = 'Find local business leads, run AI website audits, generate outreach messages, and create client-ready website preview links with LeadScope AI.';

function setMeta(name: string, content: string, property = false) {
  const selector = property ? `meta[property="${name}"]` : `meta[name="${name}"]`;
  let element = document.head.querySelector<HTMLMetaElement>(selector);

  if (!element) {
    element = document.createElement('meta');
    if (property) element.setAttribute('property', name);
    else element.name = name;
    document.head.appendChild(element);
  }

  element.content = content;
}

export function SEO({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  canonicalPath = '/',
  noindex = false,
  structuredData,
}: SEOProps) {
  useEffect(() => {
    document.title = title;
    setMeta('description', description);
    setMeta('robots', noindex ? 'noindex, nofollow' : 'index, follow');
    setMeta('og:title', title, true);
    setMeta('og:description', description, true);
    setMeta('og:url', `${SITE_URL}${canonicalPath}`, true);
    setMeta('twitter:title', title);
    setMeta('twitter:description', description);

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = `${SITE_URL}${canonicalPath}`;
  }, [canonicalPath, description, noindex, title]);

  if (!structuredData) return null;

  return (
    <script type="application/ld+json">
      {JSON.stringify(structuredData)}
    </script>
  );
}
