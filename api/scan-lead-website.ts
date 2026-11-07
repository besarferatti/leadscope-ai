import { createClient } from '@supabase/supabase-js';
import { fetchPublicHtml, validatePublicWebsite } from '../supabase/functions/_shared/public-website.js';
import { readWebsiteEvidence } from '../supabase/functions/analyze-lead/website-evidence.js';

type Request = { method?: string; headers: Record<string, string | string[] | undefined>; body?: unknown };
type Response = { status: (code: number) => Response; json: (body: unknown) => void; setHeader: (key: string, value: string) => void };

export default async function handler(req: Request, res: Response) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });

  const auth = req.headers.authorization;
  const token = typeof auth === 'string' ? /^Bearer\s+(\S+)$/i.exec(auth)?.[1] : undefined;
  if (!token) return res.status(401).json({ error: 'Unauthorized scanner request.' });
  const { leadId } = (req.body ?? {}) as { leadId?: unknown };
  if (typeof leadId !== 'string' || !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(leadId)) {
    return res.status(400).json({ error: 'A valid lead ID is required.' });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !key) return res.status(503).json({ error: 'Scanner authorization is not configured.' });
  const admin = createClient(supabaseUrl, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Scanner session could not be verified.' });
  const { data: profile, error: profileError } = await admin.from('user_profiles').select('role,is_active').eq('id', user.id).maybeSingle();
  if (profileError) return res.status(503).json({ error: 'Scanner could not check account access.' });
  if (!profile?.is_active) return res.status(403).json({ error: 'An active account is required.' });

  const leadQuery = admin.from('leads').select('website').eq('id', leadId);
  if (profile.role !== 'admin') leadQuery.eq('user_id', user.id);
  const { data: lead, error: leadError } = await leadQuery.maybeSingle();
  if (leadError) return res.status(503).json({ error: 'Scanner could not read the lead.' });
  if (!lead) return res.status(404).json({ error: 'Lead not found.' });

  const rawUrl = lead.website?.trim();
  if (!rawUrl) return res.status(200).json({ reason: 'No website URL was provided.' });
  let page: URL;
  try {
    page = new URL(/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`);
    await validatePublicWebsite(page, AbortSignal.timeout(2_000));
  } catch {
    return res.status(200).json({ reason: 'The website address could not be verified as public.' });
  }

  const signal = AbortSignal.timeout(6_000);
  try {
    const { html, url, truncated } = await fetchPublicHtml(page, signal, { maxBytes: 256_000 });
    const evidence = readWebsiteEvidence(html, url, truncated);
    const final = new URL(url);
    const browserUrl = final.search ? undefined : final.origin + final.pathname;
    return res.status(200).json({ evidence, browserUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const code = error instanceof Error && 'code' in error ? error.code : undefined;
    const status = message.match(/^Website returned HTTP (\d{3})\.$/)?.[1];
    const reason = signal.aborted ? 'The website took too long to respond.'
      : code === 'CERT_HAS_EXPIRED' ? 'The website HTTPS certificate has expired.'
      : code === 'ERR_TLS_CERT_ALTNAME_INVALID' || code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' ||
        code === 'DEPTH_ZERO_SELF_SIGNED_CERT' || code === 'SELF_SIGNED_CERT_IN_CHAIN'
        ? 'The website HTTPS certificate could not be verified.'
      : code === 'ENOTFOUND' || code === 'EAI_AGAIN' ? 'The website domain could not be resolved.'
      : code === 'ECONNREFUSED' || code === 'ECONNRESET' ? 'The website closed or refused the connection.'
      : status ? `The website returned HTTP ${status}.`
      : message === 'Website response was not HTML.' ? 'The address did not return an HTML page.'
      : 'The website HTML could not be read.';
    const unsafeRedirect = /not public|Unsupported website URL|Invalid website redirect/.test(message);
    const browserUrl = !unsafeRedirect && !page.search ? page.origin + page.pathname : undefined;
    return res.status(200).json({ reason, browserUrl });
  }
}
