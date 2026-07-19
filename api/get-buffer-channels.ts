import { errorResponse, getBufferOrganizationsAndChannels, platformForService, requireAdmin, type ApiRequest, type ApiResponse } from './social-media-helpers';

export const config = { runtime: 'nodejs' };
export default async function handler(req: ApiRequest, res: ApiResponse) {
  res.setHeader('Allow', 'GET');
  if (req.method !== 'GET') return errorResponse(res, 'Method not allowed.', 405);
  if (!await requireAdmin(req, res)) return;
  try {
    const bufferChannels = await getBufferOrganizationsAndChannels();
    const channels = bufferChannels.flatMap(channel => {
      const platform = platformForService(channel.service);
      return platform ? [{ id: channel.id, platform, service: channel.service, displayName: channel.displayName || channel.name || channel.service, avatar: channel.avatar, organization: channel.organization }] : [];
    });
    return res.status(200).json({ channels });
  } catch (error) { return errorResponse(res, error instanceof Error ? error.message : 'Unable to load Buffer channels.', 502); }
}
