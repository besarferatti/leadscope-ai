type ObservedPage = {
  status: "complete" | "partial";
  url: string;
  https: boolean;
  title: string;
  description: string;
  headings: string[];
  viewport: boolean;
  canonical: boolean;
  robots: string;
};

export type WebsiteEvidence = ObservedPage | { status: "unavailable"; reason: string };

export function unavailableEvidence(reason: string): WebsiteEvidence {
  return { status: "unavailable", reason };
}

function text(value: string) {
  const entities: Record<string, string> = { amp: "&", quot: '"', apos: "'", nbsp: " ", lt: "<", gt: ">" };
  return value.replace(/<[^>]*>/g, " ").replace(/&([a-z]+);/gi, (match, name) => entities[name.toLowerCase()] ?? match)
    .replace(/\s+/g, " ").trim().slice(0, 400);
}

function attributes(tag: string) {
  const values = new Map<string, string>();
  for (const match of tag.matchAll(/([^\s"'<>/=]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>]+))/g)) {
    const name = match[1].toLowerCase();
    if (!values.has(name)) values.set(name, match[2] ?? match[3] ?? match[4]);
  }
  return values;
}

export function readWebsiteEvidence(html: string, finalUrl: string, truncated: boolean): WebsiteEvidence {
  if (!html.trim()) return unavailableEvidence("The website returned empty HTML.");
  const markup = html.replace(/<!--[\s\S]*?(?:-->|$)|<(script|style|template)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi, "");
  const meta = [...markup.matchAll(/<meta\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi)].map(([tag]) => attributes(tag));
  const metaTag = (name: string) => meta.find((tag) => tag.get("name")?.trim().toLowerCase() === name);
  const url = new URL(finalUrl);
  return {
    status: truncated ? "partial" : "complete",
    url: url.origin + url.pathname,
    https: url.protocol === "https:",
    title: text(markup.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i)?.[1] ?? ""),
    description: text(metaTag("description")?.get("content") ?? ""),
    headings: [...markup.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1\s*>/gi)].slice(0, 5).map((match) => text(match[1])),
    viewport: !!metaTag("viewport")?.get("content")?.trim(),
    canonical: [...markup.matchAll(/<link\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi)].some(([tag]) => {
      const attrs = attributes(tag);
      return attrs.get("rel")?.toLowerCase().split(/\s+/).includes("canonical") && !!attrs.get("href")?.trim();
    }),
    robots: text(metaTag("robots")?.get("content") ?? ""),
  };
}

export function verifiedIssues(evidence: WebsiteEvidence): string[] {
  if (evidence.status === "unavailable") return [];
  const issues: string[] = [];
  if (!evidence.https) issues.push("The final page URL was served over HTTP.");
  if (/\bnoindex\b/i.test(evidence.robots)) issues.push("The downloaded HTML contains a robots meta tag with noindex.");
  if (evidence.status === "partial") return issues;
  if (!evidence.title) issues.push("No non-empty title was detected in the downloaded HTML.");
  if (!evidence.description) issues.push("No non-empty meta description was detected in the downloaded HTML.");
  if (!evidence.headings.some(Boolean)) issues.push("No non-empty H1 was detected in the downloaded HTML.");
  if (!evidence.viewport) issues.push("No viewport declaration was detected in the downloaded HTML.");
  return issues;
}
