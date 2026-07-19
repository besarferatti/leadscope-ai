import { productUpdates } from '../src/data/productUpdates.js';
import { errorResponse, isTooLarge, PLATFORMS, requireAdmin, safeText, type ApiRequest, type ApiResponse, type Platform } from './social-media-helpers.js';

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
type CaptionObject = { caption?: unknown; title?: unknown };

type CaptionResponse = Partial<Record<Platform, unknown>>;

export function captionValue(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (value && typeof value === 'object') { const caption = (value as CaptionObject).caption; if (typeof caption === 'string') return caption.trim(); }
  return '';
}

function tiktokTitle(value: unknown): string {
  if (value && typeof value === 'object') { const title = (value as CaptionObject).title; if (typeof title === 'string') return title.trim(); }
  return '';
}

export function parseCaptions(value: unknown): Captions {
  const parsed = value && typeof value === 'object' ? value as CaptionResponse : {};
  return Object.fromEntries(PLATFORMS.map(platform => {
    const platformValue = parsed[platform];
    return [platform, {
      caption: captionValue(platformValue),
      ...(platform === 'tiktok' ? { title: tiktokTitle(platformValue) } : {}),
    }];
  })) as Captions;
}

function validateCaptions(captionSet: Captions, requested: Platform[]) {
  for (const platform of requested) {
    const caption = captionSet[platform].caption;
    if (!caption || (platform === 'tiktok' && !captionSet.tiktok.title)) throw new Error('Caption generation returned incomplete content. Please try again.');
    const maximum = platform === 'linkedin' ? 3000 : platform === 'x' ? 280 : 2200;
    if (caption.length > maximum) throw new Error(`${platform === 'x' ? 'X' : platform === 'tiktok' ? 'TikTok' : 'LinkedIn'} caption exceeded its character limit. Please try again.`);
  }
  if (requested.includes('tiktok') && captionSet.tiktok.title!.length > 100) throw new Error('TikTok title exceeded its character limit. Please try again.');
}

async function captions(update: typeof productUpdates[number], requested: Platform[]): Promise<Captions> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OpenAI is not configured. Add OPENAI_API_KEY in Vercel.');
  const prompt = `Generate social-media captions for this LeadScope AI product update. Title: ${update.title}. Description: ${update.description}. Highlights: ${update.highlights.join(' ')}.

Return only the exact JSON object required by the response schema: use lowercase keys linkedin, x, and tiktok; every platform value must be an object; every platform object must contain a caption string; tiktok must also contain a title string. Do not include markdown, code fences, or explanatory text.

All captions must include ${UPDATE_URL}. LinkedIn: 500 to 1,000 characters, professional B2B SaaS tone, clear customer benefit, CTA, and at most 4 relevant hashtags. X: 280 characters maximum total including the URL, clear benefit, and at most 3 hashtags. TikTok: a photo-post caption with a strong short hook, simple CTA, URL, and relevant hashtags; never mention video. Its title must be a short photo-post title.`;
  const response = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'gpt-4o-mini', response_format: { type: 'json_schema', json_schema: { name: 'social_media_captions', strict: true, schema: { type: 'object', additionalProperties: false, properties: { linkedin: { type: 'object', additionalProperties: false, properties: { caption: { type: 'string' } }, required: ['caption'] }, x: { type: 'object', additionalProperties: false, properties: { caption: { type: 'string' } }, required: ['caption'] }, tiktok: { type: 'object', additionalProperties: false, properties: { caption: { type: 'string' }, title: { type: 'string' } }, required: ['caption', 'title'] } }, required: ['linkedin', 'x', 'tiktok'] } } }, messages: [{ role: 'user', content: prompt }] }) });
  if (!response.ok) throw new Error('Caption generation failed. Please try again.');
  const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  let parsed: unknown;
  try { parsed = JSON.parse(payload.choices?.[0]?.message?.content || '{}'); } catch { throw new Error('Caption generation returned invalid content. Please try again.'); }
  const generated = parseCaptions(parsed);
  validateCaptions(generated, requested);
  return generated;
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
  const auth = await requireAdmin(req, res);
  if (!auth) return;
  const body = (req.body || {}) as { updateId?: unknown; platforms?: unknown; regeneratePlatform?: unknown; regenerateCaption?: unknown };
  const updateId = safeText(body.updateId, 100); const requested = Array.isArray(body.platforms) ? body.platforms.filter((value): value is Platform => typeof value === 'string' && (PLATFORMS as readonly string[]).includes(value)) : [];
  const regenerate = typeof body.regeneratePlatform === 'string' && (PLATFORMS as readonly string[]).includes(body.regeneratePlatform) ? body.regeneratePlatform as Platform : null;
  if (!updateId || !requested.length || requested.length > 3 || (regenerate && !requested.includes(regenerate))) return errorResponse(res, 'Choose a published update and at least one supported platform.');
  const update = productUpdates.find(item => slug(item.title) === updateId);
  if (!update) return errorResponse(res, 'Product update not found.', 404);
  try {
    const targets = regenerate ? [regenerate] : [...new Set(requested)];
    const allCaptions = await captions(update, targets);
    if (body.regenerateCaption === true) return res.status(200).json(Object.fromEntries(targets.map(platform => [platform, allCaptions[platform]])));
    const needLandscape = targets.some(platform => platform === 'linkedin' || platform === 'x');
    const [landscape, portrait] = await Promise.all([needLandscape ? artwork(update, false) : Promise.resolve(null), targets.includes('tiktok') ? artwork(update, true) : Promise.resolve(null)]);
    const sharp = (await import('sharp')).default;
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
