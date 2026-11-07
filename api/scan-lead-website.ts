import { createHmac, timingSafeEqual } from 'node:crypto';
import { fetchPublicHtml, validatePublicWebsite } from '../supabase/functions/_shared/public-website.js';
import { readWebsiteEvidence } from '../supabase/functions/analyze-lead/website-evidence.js';

type Request = { method?: string; headers: Record<string, string | string[] | undefined>; body?: unknown };
type Response = { status: (code: number) => Response; json: (body: unknown) => void; setHeader: (key: string, value: string) => void };

export default async function handler(req: Request, res: Response) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });

  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const signature = req.headers['x-scan-signature'];
  const { url, timestamp } = (req.body ?? {}) as { url?: unknown; timestamp?: unknown };
  if (!key || typeof signature !== 'string' || !/^[a-f0-9]{64}$/.test(signature) ||
      typeof url !== 'string' || url.length > 2048 || typeof timestamp !== 'number' ||
      !Number.isSafeInteger(timestamp) || Math.abs(Date.now() - timestamp) > 60_000) {
    return res.status(401).json({ error: 'Unauthorized scanner request.' });
  }

  const expected = createHmac('sha256', key).update(JSON.stringify(['lead-website-scan-v1', timestamp, url])).digest();
  if (!timingSafeEqual(expected, Buffer.from(signature, 'hex'))) {
    return res.status(401).json({ error: 'Unauthorized scanner request.' });
  }

  let page: URL;
  try {
    page = new URL(url);
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
    const status = message.match(/^Website returned HTTP (\d{3})\.$/)?.[1];
    const reason = signal.aborted ? 'The website took too long to respond.'
      : status ? `The website returned HTTP ${status}.`
      : message === 'Website response was not HTML.' ? 'The address did not return an HTML page.'
      : 'The website HTML could not be read.';
    const unsafeRedirect = /not public|Unsupported website URL|Invalid website redirect/.test(message);
    const browserUrl = !unsafeRedirect && !page.search ? page.origin + page.pathname : undefined;
    return res.status(200).json({ reason, browserUrl });
  }
}
