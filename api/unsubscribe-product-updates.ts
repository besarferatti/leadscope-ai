import { createClient } from '@supabase/supabase-js';

type ApiRequest = { method?: string; body?: unknown };
type ApiResponse = {
  status: (statusCode: number) => ApiResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
};

type RequestBody = { token?: unknown };

function respond(res: ApiResponse, status: number, body: unknown) {
  return res.status(status).json(body);
}

export const config = { runtime: 'nodejs' };

export default async function handler(req: ApiRequest, res: ApiResponse) {
  res.setHeader('Allow', 'POST');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') return respond(res, 405, { error: 'Method not allowed.' });

  const request = (req.body ?? {}) as RequestBody;
  const token = typeof request.token === 'string' ? request.token.trim() : '';
  if (!token || token.length > 256) {
    return respond(res, 404, { error: 'Invalid or expired unsubscribe link.' });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return respond(res, 500, { error: 'Unable to process your unsubscribe request.' });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from('user_email_preferences')
    .update({ product_updates_enabled: false, unsubscribed_at: now, updated_at: now })
    .eq('unsubscribe_token', token)
    .select('id');

  if (error) return respond(res, 500, { error: 'Unable to process your unsubscribe request.' });
  if (!data?.length) return respond(res, 404, { error: 'Invalid or expired unsubscribe link.' });

  return respond(res, 200, { success: true });
}
