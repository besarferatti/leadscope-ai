import { createClient } from '@supabase/supabase-js';

type ApiRequest = { method?: string; headers: { authorization?: string | string[]; Authorization?: string | string[] } };
type ApiResponse = { status: (statusCode: number) => ApiResponse; json: (body: unknown) => void; setHeader: (name: string, value: string) => void };
type Job = { id: string; user_id: string; lead_id: string; attempts: number; max_attempts: number };

export const config = { runtime: 'nodejs', maxDuration: 60 };

export default async function handler(req: ApiRequest, res: ApiResponse) {
  res.setHeader('Allow', 'GET');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed.' });
  const rawAuth = req.headers.authorization || req.headers.Authorization;
  const auth = Array.isArray(rawAuth) ? rawAuth[0] : rawAuth;
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) return res.status(401).json({ error: 'Unauthorized.' });
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return res.status(500).json({ error: 'Queue is not configured.' });
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data } = await admin.from('email_discovery_jobs').select('id, user_id, lead_id, attempts, max_attempts')
    .eq('status', 'queued').lte('next_attempt_at', new Date().toISOString()).order('created_at').limit(3);
  const jobs = (data ?? []) as Job[];
  const baseUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '';
  if (!baseUrl) return res.status(500).json({ error: 'Application URL is not configured.' });
  let completed = 0; let failed = 0;

  for (const job of jobs) {
    const { data: claimed } = await admin.from('email_discovery_jobs').update({ status: 'running', attempts: job.attempts + 1, updated_at: new Date().toISOString() })
      .eq('id', job.id).eq('status', 'queued').select('id').maybeSingle();
    if (!claimed) continue;
    try {
      const response = await fetch(`${baseUrl}/api/find-lead-email`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cronSecret}` },
        body: JSON.stringify({ leadId: job.lead_id, userId: job.user_id }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || `Discovery failed (${response.status})`);
      await admin.from('email_discovery_jobs').update({ status: 'completed', completed_at: new Date().toISOString(), updated_at: new Date().toISOString(), last_error: null }).eq('id', job.id);
      completed += 1;
    } catch (error) {
      const attempts = job.attempts + 1; const retry = attempts < job.max_attempts;
      await admin.from('email_discovery_jobs').update({
        status: retry ? 'queued' : 'failed', next_attempt_at: new Date(Date.now() + attempts * 15 * 60_000).toISOString(),
        last_error: error instanceof Error ? error.message.slice(0, 500) : 'Unknown error', updated_at: new Date().toISOString(),
      }).eq('id', job.id);
      failed += 1;
    }
  }
  return res.status(200).json({ processed: jobs.length, completed, failed });
}
