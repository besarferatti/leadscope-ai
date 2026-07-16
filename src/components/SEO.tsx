import { useEffect } from 'react';

interface SEOProps {
  title?: string;
  description?: string;
  ogTitle?: string;
  ogDescription?: string;
  canonicalPath?: string;
  noindex?: boolean;
  structuredData?: Record<string, unknown>;
}

const SITE_URL = 'https://www.leadscope.pro';
const DEFAULT_TITLE = 'LeadScope AI - Lead Generation, AI Audits, and Website Preview Links for Agencies';
const DEFAULT_DESCRIPTION = 'Find local business leads, audit websites, generate SEO opportunities, create shareable audit reports, preview website concepts, and send better outreach with LeadScope AI.';

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
  ogTitle = title,
  ogDescription = description,
  canonicalPath = '/',
  noindex = false,
  structuredData,
}: SEOProps) {
  useEffect(() => {
    document.title = title;
    setMeta('description', description);
    setMeta('robots', noindex ? 'noindex, nofollow' : 'index, follow');
    setMeta('og:title', ogTitle, true);
    setMeta('og:description', ogDescription, true);
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
  }, [canonicalPath, description, noindex, ogDescription, ogTitle, title]);

  if (!structuredData) return null;

  return (
    <script type="application/ld+json">
      {JSON.stringify(structuredData)}
    </script>
  );
}
