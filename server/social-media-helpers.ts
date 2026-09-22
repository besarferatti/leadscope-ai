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

type BufferGraphqlError = { message?: string };
type BufferResponse = { data?: unknown; errors?: BufferGraphqlError[] };

export type BufferOrganization = { id: string; name: string };
export type BufferChannel = {
  id: string;
  name: string;
  displayName: string;
  service: string;
  avatar: string | null;
  organization: BufferOrganization;
};

function bufferOperation(query: string) {
  return query.match(/\b(?:query|mutation)\s+(\w+)/)?.[1] || 'unnamed operation';
}

export async function buffer(query: string, variables?: Record<string, unknown>) {
  const key = process.env.BUFFER_API_KEY;
  if (!key) throw new Error('Buffer is not configured.');
  const operation = bufferOperation(query);
  let response: Response;
  try {
    response = await fetch('https://api.buffer.com', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ query, variables }) });
  } catch {
    console.error(`[Buffer] ${operation} request failed.`);
    throw new Error('Buffer is unavailable.');
  }
  if (!response.ok) {
    console.error(`[Buffer] ${operation} failed with HTTP ${response.status}.`);
    throw new Error(response.status === 401 || response.status === 403 ? 'Buffer authorization failed.' : 'Buffer is unavailable.');
  }
  let body: BufferResponse;
  try {
    body = await response.json() as BufferResponse;
  } catch {
    console.error(`[Buffer] ${operation} returned an invalid JSON response.`);
    throw new Error('Buffer is unavailable.');
  }
  if (body.errors?.length) {
    console.error(`[Buffer] ${operation} returned ${body.errors.length} GraphQL error(s).`);
    throw new Error('Buffer could not complete this request.');
  }
  return body.data as Record<string, unknown>;
}

const organizationsQuery = `query GetOrganizations { account { organizations { id name } } }`;
const channelsQuery = `query GetChannels($organizationId: OrganizationId!) { channels(input: { organizationId: $organizationId }) { id name displayName service avatar } }`;

export async function getBufferOrganizationsAndChannels(): Promise<BufferChannel[]> {
  const data = await buffer(organizationsQuery);
  const organizations = ((data.account as { organizations?: unknown[] } | undefined)?.organizations || []) as Array<{ id?: unknown; name?: unknown }>;
  const validOrganizations = organizations.flatMap(organization => {
    const id = typeof organization.id === 'string' ? organization.id : '';
    return id ? [{ id, name: typeof organization.name === 'string' ? organization.name : '' }] : [];
  });
  const channelGroups = await Promise.all(validOrganizations.map(async organization => {
    const result = await buffer(channelsQuery, { organizationId: organization.id });
    const channels = (result.channels || []) as Array<{ id?: unknown; name?: unknown; displayName?: unknown; service?: unknown; avatar?: unknown }>;
    return channels.flatMap(channel => {
      const id = typeof channel.id === 'string' ? channel.id : '';
      const service = typeof channel.service === 'string' ? channel.service : '';
      return id && service ? [{
        id,
        name: typeof channel.name === 'string' ? channel.name : '',
        displayName: typeof channel.displayName === 'string' ? channel.displayName : '',
        service,
        avatar: typeof channel.avatar === 'string' ? channel.avatar : null,
        organization,
      }] : [];
    });
  }));
  return [...new Map(channelGroups.flat().map(channel => [channel.id, channel])).values()];
}

export function platformForService(service: unknown): Platform | null {
  const value = String(service || '').trim().toLowerCase().replace(/[._-]+/g, ' ').replace(/\s+/g, ' ');
  if (value === 'linkedin' || value === 'linkedin page') return 'linkedin';
  if (value === 'twitter' || value === 'x') return 'x';
  if (value === 'tiktok') return 'tiktok';
  return null;
}

export function safeText(value: unknown, max: number) { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }
export function isTooLarge(req: ApiRequest, limit = 50_000) {
  const raw = req.headers['content-length'] || req.headers['Content-Length'];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return Number(value || 0) > limit;
}
