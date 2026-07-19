import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { createClient } from '@supabase/supabase-js';

type ApiRequest = { method?: string; headers: { authorization?: string | string[]; Authorization?: string | string[] }; body?: unknown };
type ApiResponse = { status: (statusCode: number) => ApiResponse; json: (body: unknown) => void; setHeader: (name: string, value: string) => void };
type FindEmailBody = { leadId?: unknown };
type SourceType = 'website_mailto' | 'website_text' | 'website_jsonld';
type Candidate = { email: string; source_url: string; source_type: SourceType; score: number };
type LeadRecord = { id: string; user_id: string; website: string | null; email: string | null; email_source_type: string | null };

const PAGE_TIMEOUT_MS = 8_000;
const MAX_HTML_BYTES = 1_000_000;
const MAX_INTERNAL_PAGES = 5;
const ALLOWED_PORTS = new Set(['', '80', '443']);
const PRIORITY_LINK = /contact(?:-us)?|about(?:-us)?|team|staff|support|impressum|legal/i;
const LEGAL_LINK = /privacy|legal|impressum|terms/i;
const FREE_EMAIL_DOMAINS = new Set(['gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'live.com', 'yahoo.com', 'icloud.com', 'aol.com', 'proton.me', 'protonmail.com']);
const GENERIC_INBOXES = /^(contact|info|hello|sales|office|support)$/i;
const UNWANTED_LOCAL = /^(no-?reply|do-?not-?reply|abuse|privacy|webmaster)$/i;
const EMAIL_PATTERN = /[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+/gi;

function respond(res: ApiResponse, status: number, body: Record<string, unknown>) { return res.status(status).json(body); }
function invalidWebsite(res: ApiResponse, message: string) { return respond(res, 422, { status: 'invalid_website', error: message }); }

function isBlockedIp(address: string): boolean {
  const version = isIP(address);
  if (version === 4) {
    const [a, b] = address.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 0) ||
      (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19)) ||
      (a === 198 && b === 51) || (a === 203 && b === 0) || a >= 240;
  }
  if (version === 6) {
    const value = address.toLowerCase();
    return value === '::' || value === '::1' || value.startsWith('fe80:') ||
      /^f[cd]/.test(value) || value.startsWith('::ffff:127.') || value.startsWith('::ffff:10.') ||
      value.startsWith('::ffff:192.168.') || /^::ffff:172\.(1[6-9]|2\d|3[01])\./.test(value);
  }
  return true;
}

async function validateUrl(raw: string, expectedDomain?: string): Promise<URL> {
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error('The website URL is invalid.'); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only HTTP and HTTPS website URLs are allowed.');
  if (url.username || url.password) throw new Error('Website URLs with credentials are not allowed.');
  if (!ALLOWED_PORTS.has(url.port)) throw new Error('This website uses an unsupported port.');
  const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost')) throw new Error('Local website addresses are not allowed.');
  if (expectedDomain && hostname !== expectedDomain && !hostname.endsWith(`.${expectedDomain}`) && !expectedDomain.endsWith(`.${hostname}`)) throw new Error('Only same-domain pages may be crawled.');
  if (isIP(hostname)) {
    if (isBlockedIp(hostname)) throw new Error('This website address is not publicly reachable.');
  } else {
    let addresses: { address: string }[];
    try { addresses = await lookup(hostname, { all: true, verbatim: true }); } catch { throw new Error('The website hostname could not be resolved.'); }
    if (!addresses.length || addresses.some(({ address }) => isBlockedIp(address))) throw new Error('This website address is not publicly reachable.');
  }
  url.hostname = hostname;
  url.hash = '';
  return url;
}

async function fetchHtml(initialUrl: URL, siteDomain: string): Promise<{ url: URL; html: string }> {
  let url = initialUrl;
  for (let redirects = 0; redirects <= 5; redirects += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PAGE_TIMEOUT_MS);
    let response: Response;
    try { response = await fetch(url, { redirect: 'manual', signal: controller.signal, headers: { Accept: 'text/html,application/xhtml+xml' } }); }
    finally { clearTimeout(timer); }
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) throw new Error('The website returned an invalid redirect.');
      url = await validateUrl(new URL(location, url).toString(), siteDomain);
      continue;
    }
    if (!response.ok) throw new Error(`The website returned HTTP ${response.status}.`);
    if (!response.headers.get('content-type')?.toLowerCase().includes('text/html')) throw new Error('The website did not return an HTML page.');
    const length = Number(response.headers.get('content-length') ?? '0');
    if (length > MAX_HTML_BYTES) throw new Error('The website page is too large to scan.');
    if (!response.body) throw new Error('The website returned an empty page.');
    const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let total = 0;
    while (true) { const { done, value } = await reader.read(); if (done) break; total += value.byteLength; if (total > MAX_HTML_BYTES) { await reader.cancel(); throw new Error('The website page is too large to scan.'); } chunks.push(value); }
    return { url, html: new TextDecoder().decode(Buffer.concat(chunks)) };
  }
  throw new Error('The website redirected too many times.');
}

function normalizeEmail(value: string): string | null {
  const email = value.toLowerCase().trim().replace(/^[\s<>()[\]{},;:'"`]+|[\s<>()[\]{},;:'"`.]+$/g, '');
  if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(email)) return null;
  const [local, domain] = email.split('@');
  if (!local || !domain || UNWANTED_LOCAL.test(local) || domain === 'example.com' || domain.endsWith('.example.com') || /(^|[._-])test([._-]|$)/.test(local)) return null;
  return email;
}

function decodeHtml(value: string) {
  return value.replace(/&(?:amp|#38);/gi, '&').replace(/&(?:quot|#34);/gi, '"').replace(/&#(?:39|x27);/gi, "'").replace(/&lt;/gi, '<').replace(/&gt;/gi, '>');
}

function visibleText(html: string) {
  return decodeHtml(html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--([\s\S]*?)-->/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ');
}

function extractEmails(html: string, pageUrl: URL): Omit<Candidate, 'score'>[] {
  const found = new Map<string, Omit<Candidate, 'score'>>();
  const add = (raw: string, sourceType: SourceType) => { const email = normalizeEmail(decodeHtml(raw)); if (email && !found.has(email)) found.set(email, { email, source_url: pageUrl.toString(), source_type: sourceType }); };
  for (const match of html.matchAll(/<a\b[^>]*\bhref\s*=\s*(["'])(.*?)\1[^>]*>/gi)) if (/^mailto:/i.test(decodeHtml(match[2]))) add(decodeHtml(match[2]).replace(/^mailto:/i, '').split('?')[0], 'website_mailto');
  const text = visibleText(html).replace(/([a-z0-9._%+-]+)\s*(?:\[|[(])\s*at\s*(?:\]|[)])\s*([a-z0-9.-]+)\s*(?:\[|[(])\s*dot\s*(?:\]|[)])\s*([a-z]{2,})/gi, '$1@$2.$3');
  for (const match of text.matchAll(EMAIL_PATTERN)) add(match[0], 'website_text');
  for (const script of html.matchAll(/<script\b[^>]*type\s*=\s*(["'])application\/ld\+json\1[^>]*>([\s\S]*?)<\/script>/gi)) {
    try { const visit = (value: unknown): void => { if (Array.isArray(value)) value.forEach(visit); else if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) { if (key.toLowerCase() === 'email' && typeof child === 'string') add(child, 'website_jsonld'); else visit(child); } }; visit(JSON.parse(script[2])); } catch { /* Invalid JSON-LD is ignored. */ }
  }
  return [...found.values()];
}

function priorityLinks(html: string, pageUrl: URL, domain: string) {
  const links: URL[] = [];
  for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const href = match[1].match(/\bhref\s*=\s*(["'])(.*?)\1/i)?.[2];
    if (!href || !PRIORITY_LINK.test(`${href} ${visibleText(match[2])}`)) continue;
    try { const url = new URL(decodeHtml(href), pageUrl); url.hash = ''; if (url.hostname.replace(/^www\./, '') === domain) links.push(url); } catch { /* Invalid links are ignored. */ }
  }
  return links;
}

function scoreCandidate(candidate: Omit<Candidate, 'score'>, websiteDomain: string): Candidate {
  const [local, domain] = candidate.email.split('@'); let score = 35;
  if (domain === websiteDomain || domain.endsWith(`.${websiteDomain}`)) score += 35;
  else if (FREE_EMAIL_DOMAINS.has(domain)) score -= 15;
  if (candidate.source_type === 'website_mailto') score += 20;
  else if (candidate.source_type === 'website_jsonld') score += 12;
  if (/contact/i.test(candidate.source_url)) score += 15;
  if (LEGAL_LINK.test(candidate.source_url)) score -= 12;
  if (GENERIC_INBOXES.test(local)) score += 10;
  return { ...candidate, score: Math.max(0, Math.min(100, score)) };
}

export const config = { runtime: 'nodejs' };
export default async function handler(req: ApiRequest, res: ApiResponse) {
  res.setHeader('Allow', 'POST');
  if (req.method !== 'POST') return respond(res, 405, { error: 'Method not allowed.' });
  const rawAuth = req.headers.authorization || req.headers.Authorization; const auth = Array.isArray(rawAuth) ? rawAuth[0] : rawAuth;
  if (!auth?.toLowerCase().startsWith('bearer ')) return respond(res, 401, { error: 'Unauthorized.' });
  const token = auth.replace(/^Bearer\s+/i, '').trim(); if (!token) return respond(res, 401, { error: 'Unauthorized.' });
  const requestBody = (req.body ?? {}) as FindEmailBody;
  const leadId = typeof requestBody.leadId === 'string' ? requestBody.leadId.trim() : '';
  if (!leadId) return respond(res, 400, { error: 'leadId is required.' });
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL; const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return respond(res, 500, { error: 'Email discovery is not configured.' });
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error: userError } = await admin.auth.getUser(token);
  if (userError || !user) return respond(res, 401, { error: 'Unauthorized.' });
  const { data: lead, error: leadError } = await admin.from('leads').select('id, user_id, website, email, email_source_type').eq('id', leadId).eq('user_id', user.id).maybeSingle<LeadRecord>();
  if (leadError || !lead) return respond(res, 404, { error: 'Lead not found.' });
  if (!lead.website?.trim()) return respond(res, 200, { status: 'no_website', message: 'No website available.' });
  try {
    const start = await validateUrl(lead.website); const domain = start.hostname.replace(/^www\./, '');
    const queue = [start]; const visited = new Set<string>(); const candidates = new Map<string, Candidate>();
    while (queue.length && visited.size <= MAX_INTERNAL_PAGES) {
      const next = queue.shift()!; if (visited.has(next.toString())) continue; visited.add(next.toString());
      const page = await fetchHtml(next, domain); for (const extracted of extractEmails(page.html, page.url)) { const candidate = scoreCandidate(extracted, domain); const current = candidates.get(candidate.email); if (!current || candidate.score > current.score) candidates.set(candidate.email, candidate); }
      const best = [...candidates.values()].sort((a, b) => b.score - a.score)[0]; if (best && best.score >= 85 && best.email.split('@')[1] === domain) break;
      if (visited.size <= MAX_INTERNAL_PAGES) for (const candidateUrl of priorityLinks(page.html, page.url, domain)) { if (queue.length >= MAX_INTERNAL_PAGES + 1) break; if (!visited.has(candidateUrl.toString()) && !queue.some(queued => queued.toString() === candidateUrl.toString())) queue.push(candidateUrl); }
    }
    const ranked = [...candidates.values()].sort((a, b) => b.score - a.score || a.email.localeCompare(b.email)); const now = new Date().toISOString();
    if (!ranked.length) { const { error: updateError } = await admin.from('leads').update({ email_status: 'not_found', email_found_at: now, email_candidates: [] }).eq('id', lead.id).eq('user_id', user.id); if (updateError) throw new Error('Unable to save the email discovery result.'); return respond(res, 200, { status: 'not_found', message: 'No public business email was found.' }); }
    const best = ranked[0]; const update: Record<string, unknown> = { email_source_url: best.source_url, email_source_type: best.source_type, email_confidence: best.score, email_status: 'unverified', email_found_at: now, email_candidates: ranked.map(({ email, source_url, source_type, score }) => ({ email, source_url, source_type, confidence: score })) };
    if (!lead.email || lead.email_source_type) update.email = best.email;
    const { error: updateError } = await admin.from('leads').update(update).eq('id', lead.id).eq('user_id', user.id);
    if (updateError) throw new Error('Unable to save the email discovery result.');
    return respond(res, 200, { status: 'found', email: update.email ?? lead.email, confidence: best.score, sourceUrl: best.source_url, sourceType: best.source_type, emailStatus: 'unverified', candidates: update.email_candidates });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error.';
    if (/aborted|timeout/i.test(message)) return respond(res, 504, { status: 'timeout', error: 'The website took too long to respond.' });
    if (/invalid|allowed|unsupported|reachable|resolved|credentials|same-domain/i.test(message)) return invalidWebsite(res, message);
    return respond(res, 500, { status: 'error', error: 'Unable to search this website for an email.' });
  }
}
