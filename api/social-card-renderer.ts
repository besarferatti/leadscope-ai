import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import satori from 'satori';

export type SocialCardPlatform = 'linkedin' | 'x' | 'tiktok';
export type SocialCardContent = { title: string; benefit: string; highlights: string[] };

type Font = { name: string; data: ArrayBuffer; weight: 400 | 600 | 700; style: 'normal' };
const require = createRequire(import.meta.url);
let fontsPromise: Promise<Font[]> | undefined;

async function loadFonts(): Promise<Font[]> {
  fontsPromise ??= Promise.all(([400, 600, 700] as const).map(async weight => {
    const path = require.resolve(`@fontsource/inter/files/inter-latin-${weight}-normal.woff`);
    const buffer = await readFile(path);
    return { name: 'Inter', data: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), weight, style: 'normal' };
  }));
  return fontsPromise;
}

const h = (type: string, props: Record<string, unknown>, ...children: unknown[]) => ({ type, props: { ...props, children } });
const words = (value: string) => value.trim().replace(/\s+/g, ' ').split(' ').filter(Boolean);
export function shorten(value: string, maximum: number): string {
  if (value.length <= maximum) return value;
  const result: string[] = [];
  for (const word of words(value)) { if (`${result.join(' ')} ${word}`.trim().length > maximum - 1) break; result.push(word); }
  return `${result.join(' ')}…`;
}

function text(value: string, style: Record<string, unknown>) { return h('div', { ...style, display: 'flex' }, value); }
function pill(value: string, compact = false) {
  return h('div', { display: 'flex', alignItems: 'center', border: '1px solid rgba(147,197,253,.34)', backgroundColor: 'rgba(15,23,42,.68)', borderRadius: compact ? 18 : 22, padding: compact ? '10px 14px' : '12px 16px', color: '#dbeafe', fontSize: compact ? 18 : 20, fontWeight: 600, lineHeight: 1.2 }, shorten(value, compact ? 38 : 45));
}

export async function renderSocialTextSvg(platform: SocialCardPlatform, content: SocialCardContent, width: number, height: number): Promise<Buffer> {
  const title = shorten(content.title, platform === 'tiktok' ? 88 : 96);
  const benefit = shorten(content.benefit, platform === 'tiktok' ? 145 : 150);
  const highlights = content.highlights.slice(0, 3).map(item => shorten(item, platform === 'tiktok' ? 56 : 44));
  const isTikTok = platform === 'tiktok';
  const isX = platform === 'x';
  const left = isTikTok ? 72 : isX ? 112 : 80;
  const titleSize = isTikTok ? 72 : isX ? 76 : 56;
  const titleWidth = isTikTok ? 880 : isX ? 720 : 560;
  const tree = isTikTok
    ? h('div', { width, height, display: 'flex', flexDirection: 'column', padding: '84px 72px 290px', fontFamily: 'Inter', color: '#fff' },
      h('div', { display: 'flex', width: 292, padding: '10px 14px', borderRadius: 18, backgroundColor: '#2563eb', fontSize: 18, fontWeight: 700, letterSpacing: 1.2 }, 'NEW IN LEADSCOPE AI'),
      text(title, { marginTop: 34, width: titleWidth, fontSize: titleSize, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2.5 }),
      text(benefit, { marginTop: 26, width: 850, color: '#cbd5e1', fontSize: 29, lineHeight: 1.35 }),
      h('div', { display: 'flex', flexDirection: 'column', gap: 16, marginTop: 46, width: 840 }, ...highlights.map((item, index) => h('div', { display: 'flex', alignItems: 'center', padding: '17px 20px', borderRadius: 20, backgroundColor: 'rgba(15,23,42,.75)', border: '1px solid rgba(147,197,253,.28)' }, h('div', { display: 'flex', width: 30, height: 30, borderRadius: 15, backgroundColor: index === 1 ? '#7c3aed' : '#2563eb', marginRight: 16 }), text(item, { fontSize: 24, fontWeight: 600, lineHeight: 1.25, color: '#e0e7ff' }))),
      h('div', { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }, h('div', { display: 'flex', padding: '17px 25px', borderRadius: 15, backgroundColor: '#fff', color: '#0f172a', fontSize: 25, fontWeight: 700 }, 'Explore the update'), text('LeadScope AI  •  leadscope.pro', { fontSize: 21, fontWeight: 600, color: '#bfdbfe' }))
    )
    : h('div', { width, height, display: 'flex', flexDirection: 'column', padding: `${isX ? 66 : 54}px ${left}px`, fontFamily: 'Inter', color: '#fff' },
      h('div', { display: 'flex', width: 245, padding: '8px 12px', borderRadius: 16, backgroundColor: '#2563eb', fontSize: 15, fontWeight: 700, letterSpacing: 1.1 }, 'NEW IN LEADSCOPE AI'),
      text(title, { marginTop: isX ? 34 : 28, width: titleWidth, fontSize: titleSize, fontWeight: 700, lineHeight: 1.06, letterSpacing: -2 }),
      text(benefit, { marginTop: 20, width: isX ? 700 : 530, color: '#cbd5e1', fontSize: isX ? 27 : 22, lineHeight: 1.35 }),
      h('div', { display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: isX ? 28 : 22, width: titleWidth }, ...highlights.map(item => pill(item, !isX))),
      h('div', { display: 'flex', alignItems: 'center', marginTop: 'auto', justifyContent: 'space-between', width: isX ? 730 : 560 }, h('div', { display: 'flex', padding: isX ? '15px 22px' : '12px 18px', borderRadius: 14, backgroundColor: '#fff', color: '#0f172a', fontSize: isX ? 23 : 18, fontWeight: 700 }, 'Explore the update'), text(isX ? 'LeadScope AI  •  leadscope.pro' : 'LeadScope AI     leadscope.pro', { fontSize: isX ? 18 : 15, fontWeight: 600, color: '#bfdbfe' }))
    );
  const svg = await satori(tree, { width, height, fonts: await loadFonts() });
  return Buffer.from(svg);
}

export function socialCardChrome(platform: SocialCardPlatform, width: number, height: number): Buffer {
  const frame = platform === 'tiktok'
    ? `<rect x="52" y="1040" width="976" height="560" rx="38" fill="rgba(8,15,39,.46)" stroke="rgba(147,197,253,.38)" stroke-width="2"/><rect x="70" y="1058" width="940" height="524" rx="28" fill="none" stroke="rgba(96,165,250,.22)"/>`
    : platform === 'x'
      ? `<rect x="940" y="70" width="590" height="760" rx="34" fill="rgba(8,15,39,.34)" stroke="rgba(147,197,253,.42)" stroke-width="2"/><rect x="960" y="90" width="550" height="720" rx="25" fill="none" stroke="rgba(196,181,253,.25)"/>`
      : `<rect x="720" y="54" width="424" height="519" rx="28" fill="rgba(8,15,39,.34)" stroke="rgba(147,197,253,.42)" stroke-width="2"/><rect x="736" y="70" width="392" height="487" rx="22" fill="none" stroke="rgba(196,181,253,.25)"/>`;
  return Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="shade" x1="0" x2="1"><stop stop-color="#020617" stop-opacity=".96"/><stop offset=".52" stop-color="#081535" stop-opacity=".7"/><stop offset="1" stop-color="#020617" stop-opacity=".2"/></linearGradient><radialGradient id="glow"><stop stop-color="#3b82f6" stop-opacity=".36"/><stop offset="1" stop-color="#7c3aed" stop-opacity="0"/></radialGradient></defs><rect width="100%" height="100%" fill="url(#shade)"/><ellipse cx="${platform === 'tiktok' ? 550 : width * .77}" cy="${platform === 'tiktok' ? 1370 : height * .5}" rx="${platform === 'tiktok' ? 600 : 440}" ry="${platform === 'tiktok' ? 540 : 420}" fill="url(#glow)"/>${frame}<rect x="24" y="24" width="${width - 48}" height="${height - 48}" rx="28" fill="none" stroke="rgba(148,163,184,.19)" stroke-width="2"/></svg>`);
}
