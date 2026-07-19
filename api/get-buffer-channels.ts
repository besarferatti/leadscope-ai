import { buffer, errorResponse, platformForService, requireAdmin, type ApiRequest, type ApiResponse } from './social-media-helpers';

export const config = { runtime: 'nodejs' };
export default async function handler(req: ApiRequest, res: ApiResponse) {
  res.setHeader('Allow', 'GET');
  if (req.method !== 'GET') return errorResponse(res, 'Method not allowed.', 405);
  if (!await requireAdmin(req, res)) return;
  try {
    // Buffer's current GraphQL organization/channel connection query.
    const data = await buffer(`query SocialChannels { account { organizations { id name channels { id service name avatar } } } }`);
    const organizations = ((data.account as { organizations?: unknown[] } | undefined)?.organizations || []) as Array<{ id?: string; name?: string; channels?: Array<{ id?: string; service?: string; name?: string; avatar?: string }> }>;
    const channels = organizations.flatMap(org => (org.channels || []).flatMap(channel => {
      const platform = platformForService(channel.service);
      return platform && channel.id ? [{ id: channel.id, platform, service: String(channel.service), displayName: channel.name || channel.service, avatar: channel.avatar || null, organization: { id: org.id || '', name: org.name || '' } }] : [];
    }));
    return res.status(200).json({ channels });
  } catch (error) { return errorResponse(res, error instanceof Error ? error.message : 'Unable to load Buffer channels.', 502); }
}
