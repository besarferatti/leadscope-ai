import { productUpdates } from '../src/data/productUpdates';
import { errorResponse, isTooLarge, PLATFORMS, requireAdmin, safeText, type ApiRequest, type ApiResponse, type Platform } from './social-media-helpers';

type Captions = Record<Platform, { caption: string; title?: string }>;
const UPDATE_URL = 'https://www.leadscope.pro/updates';
const slug = (title: string) => title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const escapeSvg = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[character]!));
const wrap = (value: string, limit: number, lines: number) => { const words = value.split(/\s+/); const result: string[] = ['']; for (const word of words) { const current = result[result.length - 1]; if (`${current} ${word}`.trim().length > limit && result.length < lines) result.push(word); else result[result.length - 1] = `${current} ${word}`.trim(); } return result.slice(0, lines); };

function overlay(title: string, benefit: string, width: number, height: number) {
  const margin = Math.round(width * 0.075), titleSize = Math.round(width * 0.055), benefitSize = Math.round(width * 0.026);
  const titleLines = wrap(title, width > 1300 ? 31 : 25, 3), benefitLines = wrap(benefit, width > 1300 ? 58 : 42, 2);
  const titleY = Math.round(height * 0.48);
  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="rgba(2,6,23,.48)"/><rect x="${margin}" y="${margin}" width="${Math.round(width * .3)}" height="34" rx="17" fill="#2563eb"/><text x="${margin + 16}" y="${margin + 22}" fill="white" font-family="Arial, sans-serif" font-size="15" font-weight="700" letter-spacing="1.3">NEW IN LEADSCOPE AI</text><g fill="white" font-family="Arial, sans-serif" font-weight="700">${titleLines.map((line, i) => `<text x="${margin}" y="${titleY + i * titleSize * 1.15}" font-size="${titleSize}">${escapeSvg(line)}</text>`).join('')}</g><g fill="#cbd5e1" font-family="Arial, sans-serif">${benefitLines.map((line, i) => `<text x="${margin}" y="${titleY + titleLines.length * titleSize * 1.25 + 34 + i * benefitSize * 1.35}" font-size="${benefitSize}">${escapeSvg(line)}</text>`).join('')}</g><text x="${margin}" y="${height - margin - 26}" fill="white" font-family="Arial, sans-serif" font-size="${Math.round(width * .026)}" font-weight="700">LeadScope AI</text><text x="${width - margin}" y="${height - margin - 26}" text-anchor="end" fill="#bfdbfe" font-family="Arial, sans-serif" font-size="${Math.round(width * .022)}">leadscope.pro</text></svg>`;
}
async function captions(update: typeof productUpdates[number]): Promise<Captions> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OpenAI is not configured. Add OPENAI_API_KEY in Vercel.');
  const prompt = `Create JSON only with linkedin, x and tiktok. Product update title: ${update.title}. Description: ${update.description}. Highlights: ${update.highlights.join(' ')}. Every caption must include ${UPDATE_URL}. LinkedIn: professional 500-1000 characters, customer benefit, CTA, few relevant hashtags. X: concise under 280 characters including URL and max 3 hashtags. TikTok: short PHOTO post caption with strong hook, CTA, hashtags; never mention video. TikTok also needs a short title.`;
  const response = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'gpt-4o-mini', response_format: { type: 'json_object' }, messages: [{ role: 'user', content: prompt }] }) });
  if (!response.ok) throw new Error('Caption generation failed. Please try again.');
  const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const parsed = JSON.parse(payload.choices?.[0]?.message?.content || '{}') as Record<string, { caption?: unknown; title?: unknown }>;
  return Object.fromEntries(PLATFORMS.map(platform => [platform, { caption: safeText(parsed[platform]?.caption, platform === 'x' ? 280 : 1800), ...(platform === 'tiktok' ? { title: safeText(parsed[platform]?.title, 100) } : {}) }])) as Captions;
}
async function artwork(update: typeof productUpdates[number], portrait: boolean) {
  const key = process.env.OPENAI_API_KEY!;
  const size = portrait ? '1024x1536' : '1536x1024';
  const prompt = `Modern premium B2B SaaS artwork for ${update.description}. Dark navy background, blue and purple highlights, abstract lead generation analytics outreach and AI concepts, clean composition with generous negative space for a headline overlay. No text, no letters, no logos, no watermarks, no fake dashboard labels, no brand names. Avoid humanoid robots, generic handshakes, random binary code, and crypto-style visuals.`;
  const response = await fetch('https://api.openai.com/v1/images/generations', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2', prompt, size, quality: 'medium', output_format: 'png' }) });
  if (!response.ok) throw new Error('AI artwork generation was rejected or timed out. Please try again.');
  const payload = await response.json() as { data?: Array<{ b64_json?: string }> };
  const base64 = payload.data?.[0]?.b64_json;
  if (!base64) throw new Error('AI artwork generation did not return an image.');
  return Buffer.from(base64, 'base64');
}

export const config = { runtime: 'nodejs', maxDuration: 60 };
export default async function handler(req: ApiRequest, res: ApiResponse) {
  res.setHeader('Allow', 'POST');
  if (req.method !== 'POST') return errorResponse(res, 'Method not allowed.', 405);
  if (isTooLarge(req)) return errorResponse(res, 'Request body is too large.', 413);
  if (!await requireAdmin(req, res)) return;
  const body = (req.body || {}) as { updateId?: unknown; platforms?: unknown; regeneratePlatform?: unknown; regenerateCaption?: unknown };
  const updateId = safeText(body.updateId, 100); const requested = Array.isArray(body.platforms) ? body.platforms.filter((value): value is Platform => typeof value === 'string' && (PLATFORMS as readonly string[]).includes(value)) : [];
  const regenerate = typeof body.regeneratePlatform === 'string' && (PLATFORMS as readonly string[]).includes(body.regeneratePlatform) ? body.regeneratePlatform as Platform : null;
  if (!updateId || !requested.length || requested.length > 3) return errorResponse(res, 'Choose a published update and at least one supported platform.');
  const update = productUpdates.find(item => slug(item.title) === updateId);
  if (!update) return errorResponse(res, 'Product update not found.', 404);
  try {
    const allCaptions = await captions(update);
    const targets = regenerate ? [regenerate] : [...new Set(requested)];
    if (body.regenerateCaption === true) return res.status(200).json(Object.fromEntries(targets.map(platform => [platform, allCaptions[platform]])));
    const needLandscape = targets.some(platform => platform === 'linkedin' || platform === 'x');
    const [landscape, portrait] = await Promise.all([needLandscape ? artwork(update, false) : Promise.resolve(null), targets.includes('tiktok') ? artwork(update, true) : Promise.resolve(null)]);
    const sharp = (await import('sharp')).default;
    const auth = await requireAdmin(req, res); if (!auth) return;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const result: Record<string, unknown> = {};
    for (const platform of targets) {
      const dimensions = platform === 'linkedin' ? [1200, 627] : platform === 'x' ? [1600, 900] : [1080, 1920];
      const source = platform === 'tiktok' ? portrait : landscape;
      if (!source) throw new Error('AI artwork generation failed.');
      const file = await sharp(source).resize(dimensions[0], dimensions[1], { fit: 'cover', position: 'centre' }).composite([{ input: Buffer.from(overlay(update.title, update.description, dimensions[0], dimensions[1])) }]).jpeg({ quality: 85 }).toBuffer();
      if (file.length > 10 * 1024 * 1024) throw new Error('Generated image is too large to upload.');
      const path = `product-updates/${updateId}/${timestamp}/${platform}.jpg`;
      const { error } = await auth.supabase.storage.from('social-media-assets').upload(path, file, { contentType: 'image/jpeg', upsert: false });
      if (error) throw new Error('Unable to upload branded images. Please try again.');
      const { data } = auth.supabase.storage.from('social-media-assets').getPublicUrl(path);
      result[platform] = { ...allCaptions[platform], imageUrl: data.publicUrl, width: dimensions[0], height: dimensions[1] };
    }
    return res.status(200).json(result);
  } catch (error) { return errorResponse(res, error instanceof Error ? error.message : 'Unable to generate the social package.', 502); }
}
