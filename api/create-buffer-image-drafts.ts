import { buffer, errorResponse, getBufferOrganizationsAndChannels, isTooLarge, platformForService, requireAdmin, safeText, type ApiRequest, type ApiResponse, type Platform } from './social-media-helpers';

type Post = { platform?: unknown; channelId?: unknown; caption?: unknown; title?: unknown; imageUrl?: unknown };
const MAX = { linkedin: 3000, x: 280, tiktok: 2200 } as const;

export const config = { runtime: 'nodejs' };
export default async function handler(req: ApiRequest, res: ApiResponse) {
  res.setHeader('Allow', 'POST');
  if (req.method !== 'POST') return errorResponse(res, 'Method not allowed.', 405);
  if (isTooLarge(req)) return errorResponse(res, 'Request body is too large.', 413);
  const auth = await requireAdmin(req, res); if (!auth) return;
  const posts = (req.body as { posts?: unknown })?.posts;
  if (!Array.isArray(posts) || !posts.length || posts.length > 3) return errorResponse(res, 'Select one to three social posts.');
  const origin = new URL(auth.url).host;
  let allowed: Map<string, Platform>;
  try {
    const channels = await getBufferOrganizationsAndChannels();
    allowed = new Map(channels.flatMap(channel => {
      const platform = platformForService(channel.service);
      return platform ? [[channel.id, platform] as [string, Platform]] : [];
    }));
  } catch (error) { return errorResponse(res, error instanceof Error ? error.message : 'Unable to validate Buffer channels.', 502); }
  const results = await Promise.all(posts.map(async raw => {
    const post = raw as Post; const platform = safeText(post.platform, 20) as Platform; const channelId = safeText(post.channelId, 200); const caption = safeText(post.caption, 3000); const title = safeText(post.title, 100); const imageUrl = safeText(post.imageUrl, 2000);
    try {
      if (!['linkedin', 'x', 'tiktok'].includes(platform) || !channelId || !caption || caption.length > MAX[platform]) throw new Error('Invalid post content.');
      if (allowed.get(channelId) !== platform) throw new Error('The selected Buffer channel does not match this platform.');
      const url = new URL(imageUrl); if (url.protocol !== 'https:' || url.host !== origin || !url.pathname.includes('/storage/v1/object/public/social-media-assets/')) throw new Error('Image URL must be a generated LeadScope Storage image.');
      const data = await buffer(`mutation CreateImageDraft($input: CreatePostInput!) { createPost(input: $input) { ... on PostActionSuccess { post { id } } ... on MutationError { message } } }`, {
        input: {
          channelId,
          text: caption,
          schedulingType: 'automatic',
          mode: 'addToQueue',
          saveToDraft: true,
          assets: [{ image: { url: imageUrl } }],
          ...(platform === 'tiktok' && title ? { metadata: { tiktok: { title } } } : {}),
        },
      });
      const result = data.createPost as { post?: { id?: string }; message?: unknown } | undefined;
      if (result && typeof result.message === 'string') throw new Error('Buffer could not create this draft.');
      const id = result?.post?.id;
      if (!id) throw new Error('Buffer did not return a draft ID.');
      return { platform, success: true, bufferPostId: id };
    } catch (error) { return { platform: platform || 'unknown', success: false, error: error instanceof Error ? error.message : 'Unable to create Buffer draft.' }; }
  }));
  return res.status(200).json({ results });
}
