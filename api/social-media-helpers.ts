import { createClient } from '@supabase/supabase-js';

export const PLATFORMS = ['linkedin', 'x', 'tiktok'] as const;
export type Platform = typeof PLATFORMS[number];
export type ApiRequest = { method?: string; headers: { authorization?: string | string[]; Authorization?: string | string[] }; body?: unknown };
export type ApiResponse = { status: (statusCode: number) => ApiResponse; json: (body: unknown) => void; setHeader: (name: string, value: string) => void };
export const errorResponse = (res: ApiResponse, error: string, status = 400) => res.status(status).json({ error });

export function accessToken(req: ApiRequest) {
  const raw = req.headers.authorization || req.headers.Authorization;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || '';
}

export async function requireAdmin(req: ApiRequest, res: ApiResponse) {
  const token = accessToken(req);
  if (!token) { errorResponse(res, 'Unauthorized.', 401); return null; }
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) { errorResponse(res, 'Social media is not configured.', 500); return null; }
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) { errorResponse(res, 'Your session has expired. Please sign in again.', 401); return null; }
  const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).maybeSingle();
  if (profile?.role !== 'admin') { errorResponse(res, 'Admin access required.', 403); return null; }
  return { supabase, url };
}

export async function buffer(query: string, variables?: Record<string, unknown>) {
  const key = process.env.BUFFER_API_KEY;
  if (!key) throw new Error('Buffer is not configured. Add BUFFER_API_KEY in Vercel.');
  const response = await fetch('https://api.buffer.com/graphql', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ query, variables }) });
  if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? 'Buffer authorization failed.' : 'Buffer is unavailable.');
  const body = await response.json() as { data?: unknown; errors?: Array<{ message?: string }> };
  if (body.errors?.length) throw new Error('Buffer could not complete this request.');
  return body.data as Record<string, unknown>;
}

export function platformForService(service: unknown): Platform | null {
  const value = String(service || '').toLowerCase();
  if (value.includes('linkedin')) return 'linkedin';
  if (value === 'x' || value.includes('twitter')) return 'x';
  if (value.includes('tiktok')) return 'tiktok';
  return null;
}

export function safeText(value: unknown, max: number) { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }
export function isTooLarge(req: ApiRequest, limit = 50_000) {
  const raw = req.headers['content-length'] || req.headers['Content-Length'];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return Number(value || 0) > limit;
}
