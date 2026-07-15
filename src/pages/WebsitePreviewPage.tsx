import { useEffect, useState } from 'react';
import { ArrowRight, Building2, CalendarCheck, Car, ChefHat, CheckCircle2, Clock, Coffee, Gem, Gauge, Hammer, HardHat, HeartPulse, Loader2, MapPin, Menu, Phone, Quote, Scissors, ShieldCheck, Sparkles, Star, Stethoscope, Utensils, Wrench, Briefcase } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { WebsitePreviewData } from '../types';

interface Props { token: string }

const gradientByIndustry = (industry = '') => {
  const value = industry.toLowerCase();
  if (/dental|dentist|clinic|health/.test(value)) return 'from-cyan-50 via-white to-blue-100';
  if (/restaurant|cafe|food|bar|bistro/.test(value)) return 'from-amber-50 via-white to-orange-100';
  if (/construction|contractor|remodel|builder|roof|plumb|electric/.test(value)) return 'from-stone-100 via-white to-amber-100';
  if (/salon|beauty|spa|hair|barber|nail/.test(value)) return 'from-rose-50 via-white to-fuchsia-100';
  if (/auto|mechanic|vehicle|car|repair|garage|tire/.test(value)) return 'from-slate-100 via-white to-blue-100';
  return 'from-slate-50 via-white to-blue-100';
};

const fallbackVisualTheme = (preview: WebsitePreviewData) => ({
  design_variant_id: 'professional-clean',
  layout_variant: 'professional' as const,
  color_theme: 'slate-blue',
  hero_style: 'split' as const,
  section_order: ['services', 'experience', 'trust', 'cta'],
  card_style: 'rounded' as const,
  visual_density: 'balanced' as const,
  accent_style: 'soft' as const,
  image_style: 'clean' as const,
  industry_style: 'Premium local business visuals, polished cards, warm customer-focused design',
  hero_visual_title: `${preview.industry || 'Business'} experience`,
  hero_visual_description: 'A refined visual direction with modern placeholders for customer moments, service details, and trusted local expertise.',
  image_keywords: [preview.industry, preview.location].filter(Boolean),
  gallery_cards: [
    { title: 'Welcoming Experience', description: 'A polished first impression that helps visitors picture becoming a customer.' },
    { title: 'Trusted Local Team', description: 'Warm visual blocks for people, spaces, and service moments.' },
    { title: 'Quality in Detail', description: 'Premium placeholders that highlight care, process, and results.' },
  ],
  image_sections: [
    { title: 'Welcoming Experience', description: 'A polished first impression that helps visitors picture becoming a customer.', image_alt: 'Welcoming business experience visual block', visual_type: 'hero' as const },
    { title: 'Trusted Local Team', description: 'Warm visual blocks for people, spaces, and service moments.', image_alt: 'Trusted local team visual block', visual_type: 'gallery' as const },
    { title: 'Quality in Detail', description: 'Premium placeholders that highlight care, process, and results.', image_alt: 'Quality service detail visual block', visual_type: 'service' as const },
  ],
});

type VisualTheme = NonNullable<WebsitePreviewData['visual_theme']>;
type PreviewIcon = typeof Sparkles;

function getIndustryKey(preview: Pick<WebsitePreviewData, 'industry' | 'visual_theme'>) {
  const value = `${preview.visual_theme?.layout_variant || ''} ${preview.industry || ''}`.toLowerCase();
  if (/medical|dental|dentist|clinic|health/.test(value)) return 'medical';
  if (/construction|contractor|remodel|builder|roof|plumb|electric/.test(value)) return 'construction';
  if (/restaurant|cafe|coffee|food|bar|bistro|chef|dining/.test(value)) return 'restaurant';
  if (/beauty|salon|spa|hair|barber|nail|cosmetic/.test(value)) return 'beauty';
  if (/auto|mechanic|vehicle|car|repair|garage|tire/.test(value)) return 'auto';
  return 'professional';
}

function getIndustryIcon(preview: WebsitePreviewData): PreviewIcon {
  const key = getIndustryKey(preview);
  if (key === 'medical') return /dental|dentist/i.test(preview.industry || '') ? Stethoscope : HeartPulse;
  if (key === 'construction') return /builder|building|contractor/i.test(preview.industry || '') ? Building2 : HardHat;
  if (key === 'restaurant') return /coffee|cafe/i.test(preview.industry || '') ? Coffee : ChefHat;
  if (key === 'beauty') return /hair|barber/i.test(preview.industry || '') ? Scissors : Gem;
  if (key === 'auto') return /diagnostic|performance/i.test(preview.industry || '') ? Gauge : Car;
  return Briefcase;
}

function getServiceIcon(preview: WebsitePreviewData, serviceTitle = ''): PreviewIcon {
  const title = serviceTitle.toLowerCase();
  if (/emergency|call|contact|reservation|book|appoint/.test(title)) return Phone;
  if (/cosmetic|beauty|polish|detail|shine|premium/.test(title)) return Sparkles;
  if (/protect|safe|trust|prevent|general|care/.test(title)) return ShieldCheck;
  if (/renovat|build|plan|project|design/.test(title)) return /plan|project|design/.test(title) ? Building2 : Hammer;
  if (/repair|fix|brake|maintenance|service/.test(title)) return Wrench;
  if (/menu|food|dish|dining/.test(title)) return Utensils;
  if (/event|review|featured|signature/.test(title)) return Star;
  if (/hair|cut|style/.test(title)) return Scissors;
  if (/bridal|luxury|jewel/.test(title)) return Gem;
  if (/diagnostic|engine|inspection|gauge/.test(title)) return Gauge;
  return getIndustryIcon(preview);
}

function getVisualGradient(visualTheme: VisualTheme) {
  const key = visualTheme.layout_variant || visualTheme.color_theme || 'professional';
  if (/medical/.test(key)) return 'from-cyan-200 via-blue-100 to-white';
  if (/construction/.test(key)) return 'from-slate-950 via-stone-800 to-amber-500';
  if (/restaurant/.test(key)) return 'from-amber-200 via-orange-100 to-rose-100';
  if (/beauty/.test(key)) return 'from-rose-200 via-pink-100 to-amber-50';
  if (/auto/.test(key)) return 'from-slate-900 via-blue-900 to-cyan-600';
  return getVisualBlockStyle(visualTheme);
}

function getImageCardStyle(visualTheme: VisualTheme) {
  const key = visualTheme.layout_variant || visualTheme.color_theme || 'professional';
  if (/construction|auto/.test(key)) return 'border-white/10 bg-slate-950 text-white shadow-slate-950/25';
  if (/restaurant/.test(key)) return 'border-amber-200 bg-amber-50 text-stone-950 shadow-amber-900/10';
  if (/beauty/.test(key)) return 'border-rose-100 bg-rose-50 text-slate-950 shadow-rose-900/10';
  if (/medical/.test(key)) return 'border-blue-100 bg-white text-slate-950 shadow-blue-900/10';
  return 'border-slate-200 bg-white text-slate-950 shadow-slate-900/10';
}

function getGalleryIcon(visualTheme: VisualTheme): PreviewIcon {
  const key = visualTheme.layout_variant || visualTheme.color_theme || 'professional';
  if (/medical/.test(key)) return HeartPulse;
  if (/construction/.test(key)) return HardHat;
  if (/restaurant/.test(key)) return Utensils;
  if (/beauty/.test(key)) return Sparkles;
  if (/auto/.test(key)) return Gauge;
  return Star;
}

function isValidImageUrl(url?: string) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}


function getThemeClasses(visualTheme: VisualTheme) {
  const theme = visualTheme.color_theme || visualTheme.layout_variant || 'professional';
  if (/dark|black|charcoal|industrial/.test(theme)) return { page: 'bg-slate-950 text-white', header: 'border-white/10 bg-slate-950/85 text-white', hero: 'from-slate-950 via-slate-900 to-amber-950', accent: 'bg-amber-500 text-slate-950', muted: 'text-slate-300', panel: 'bg-white/10 border-white/10' };
  if (/rose|pastel|beauty/.test(theme)) return { page: 'bg-rose-50 text-slate-950', header: 'border-rose-100 bg-rose-50/85', hero: 'from-rose-100 via-white to-fuchsia-100', accent: 'bg-rose-600 text-white', muted: 'text-slate-600', panel: 'bg-white/75 border-rose-100' };
  if (/amber|cafe|warm|restaurant|cream/.test(theme)) return { page: 'bg-amber-50 text-stone-950', header: 'border-amber-100 bg-amber-50/85', hero: 'from-amber-100 via-orange-50 to-stone-100', accent: 'bg-amber-700 text-white', muted: 'text-stone-600', panel: 'bg-white/75 border-amber-100' };
  if (/blue|medical|auto|navy/.test(theme)) return { page: 'bg-blue-50 text-slate-950', header: 'border-blue-100 bg-white/85', hero: 'from-blue-100 via-white to-cyan-100', accent: 'bg-blue-700 text-white', muted: 'text-slate-600', panel: 'bg-white/80 border-blue-100' };
  return { page: 'bg-white text-slate-950', header: 'border-slate-200 bg-white/85', hero: 'from-slate-50 via-white to-blue-100', accent: 'bg-slate-950 text-white', muted: 'text-slate-600', panel: 'bg-white/80 border-slate-200' };
}

function getCardClasses(visualTheme: VisualTheme) {
  const base = 'transition-all hover:-translate-y-1';
  switch (visualTheme.card_style) {
    case 'sharp': return `${base} rounded-none border border-slate-900/20 bg-white p-6 shadow-none`;
    case 'glass': return `${base} rounded-[2rem] border border-white/40 bg-white/50 p-6 shadow-xl shadow-slate-900/5 backdrop-blur`;
    case 'editorial': return `${base} rounded-sm border-l-4 border-slate-950 bg-white p-7 shadow-sm`;
    case 'bordered': return `${base} rounded-2xl border-2 border-slate-200 bg-white p-6 shadow-none`;
    case 'shadow': return `${base} rounded-[1.5rem] border border-transparent bg-white p-6 shadow-2xl shadow-slate-900/15`;
    default: return `${base} rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm`;
  }
}

function getHeroLayout(visualTheme: VisualTheme) {
  if (visualTheme.hero_style === 'bold') return 'lg:grid-cols-1 text-center';
  if (visualTheme.hero_style === 'gallery' || visualTheme.hero_style === 'magazine') return 'lg:grid-cols-[0.75fr_1.25fr]';
  if (visualTheme.hero_style === 'minimal') return 'lg:grid-cols-[1.2fr_0.8fr]';
  if (visualTheme.hero_style === 'editorial') return 'lg:grid-cols-[0.9fr_1.1fr]';
  return 'lg:grid-cols-[1fr_0.95fr]';
}

function getSectionOrder(visualTheme: VisualTheme) {
  const safe = ['services', 'experience', 'trust', 'cta'];
  const chosen = (visualTheme.section_order || []).filter((item) => safe.includes(item));
  return [...chosen, ...safe.filter((item) => !chosen.includes(item))];
}

function getVisualBlockStyle(visualTheme: VisualTheme) {
  if (visualTheme.image_style === 'luxury') return 'from-stone-950 via-rose-900 to-amber-700';
  if (visualTheme.image_style === 'project') return 'from-stone-900 via-zinc-700 to-amber-500';
  if (visualTheme.image_style === 'gallery') return 'from-fuchsia-700 via-orange-400 to-amber-200';
  if (visualTheme.image_style === 'cinematic') return 'from-slate-950 via-blue-950 to-cyan-700';
  if (visualTheme.image_style === 'editorial') return 'from-slate-800 via-stone-500 to-rose-200';
  return 'from-slate-900 via-slate-700 to-slate-400';
}

export function WebsitePreviewPage({ token }: Props) {
  const [preview, setPreview] = useState<WebsitePreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadPreview() {
      setLoading(true);
      const { data, error: rpcError } = await supabase.rpc('get_public_website_preview', { token });
      if (rpcError) setError(rpcError.message);
      else if (!data?.[0]) setError('Preview link not found.');
      else {
        setPreview(data[0].preview_data as WebsitePreviewData);
      }
      setLoading(false);
    }
    loadPreview();
  }, [token]);

  if (loading) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading...</div>;
  }

  if (error || !preview) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6"><div className="max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 text-center"><h1 className="text-xl font-semibold text-white mb-2">Page unavailable</h1><p className="text-slate-400 text-sm">{error || 'This page could not be loaded.'}</p></div></div>;
  }

  const visualTheme = (preview.visual_theme || fallbackVisualTheme(preview)) as VisualTheme;
  const services = preview.services?.length ? preview.services : [
    { title: 'Professional Services', description: `Reliable support for customers in ${preview.location || 'the local area'}.` },
    { title: 'Personalized Support', description: 'Helpful guidance and clear next steps from the first conversation.' },
    { title: 'Local Expertise', description: 'A practical understanding of what nearby customers need most.' },
  ];
  const trustItems = preview.why_choose_us?.length ? preview.why_choose_us : [
    'Friendly, responsive communication',
    'Experienced local team',
    'Quality-focused service from start to finish',
  ];
  const galleryCards = visualTheme.gallery_cards?.length ? visualTheme.gallery_cards : fallbackVisualTheme(preview).gallery_cards as VisualTheme['gallery_cards'];
  const themeClasses = getThemeClasses(visualTheme);
  const cardClasses = getCardClasses(visualTheme);
  const sectionOrder = getSectionOrder(visualTheme);
  const sectionRank = (name: string) => sectionOrder.indexOf(name);
  const visualBlockStyle = getVisualBlockStyle(visualTheme);
  const visualGradient = getVisualGradient(visualTheme);
  const imageCardStyle = getImageCardStyle(visualTheme);
  const IndustryIcon = getIndustryIcon(preview);
  const GalleryIcon = getGalleryIcon(visualTheme);
  const imageSections: NonNullable<VisualTheme['image_sections']> = visualTheme.image_sections?.length ? visualTheme.image_sections : galleryCards.map((card, index) => ({ ...card, image_alt: card.image_alt || card.title, visual_type: index === 0 ? 'hero' : 'gallery' }));

  return (
    <main className={`flex min-h-screen flex-col ${themeClasses.page}`}>
      <header className={`sticky top-0 z-20 border-b backdrop-blur-xl ${themeClasses.header}`}>
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <a href="#home" className="text-lg font-black tracking-tight text-slate-950">{preview.business_name}</a>
          <div className="hidden items-center gap-8 text-sm font-semibold text-slate-600 md:flex">
            <a href="#services" className="hover:text-slate-950">Services</a>
            <a href="#experience" className="hover:text-slate-950">Experience</a>
            <a href="#trust" className="hover:text-slate-950">Reviews</a>
            <a href="#contact" className="hover:text-slate-950">Contact</a>
          </div>
          <a href="#contact" className={`hidden rounded-full px-5 py-2.5 text-sm font-bold shadow-lg shadow-slate-950/10 sm:inline-flex ${themeClasses.accent}`}>{preview.cta_text || 'Get in touch'}</a>
          <Menu className="h-5 w-5 text-slate-500 md:hidden" />
        </nav>
      </header>

      <section id="home" className={`relative overflow-hidden bg-gradient-to-br ${themeClasses.hero || gradientByIndustry(preview.industry)}`}>
        <div className="absolute left-1/2 top-0 h-80 w-80 -translate-x-1/2 rounded-full bg-white/70 blur-3xl" />
        <div className={`relative mx-auto grid max-w-7xl gap-12 px-6 py-20 lg:items-center lg:py-28 ${getHeroLayout(visualTheme)}`}>
          <div>
            <div className="mb-6 flex flex-wrap gap-3">
              {preview.location && <p className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm"><MapPin className="h-4 w-4" /> {preview.location}</p>}
              {preview.industry && <p className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm"><Sparkles className="h-4 w-4" /> {preview.industry}</p>}
            </div>
            <h1 className="max-w-4xl text-5xl font-black leading-[0.95] tracking-tight text-slate-950 sm:text-7xl">{preview.hero_headline}</h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-600 sm:text-xl">{preview.subheadline}</p>
            <div className="mt-9 flex flex-wrap gap-3">
              <a href="#contact" className={`inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-sm font-bold shadow-xl shadow-slate-950/15 transition-colors ${themeClasses.accent}`}>{preview.cta_text || 'Request a consultation'} <ArrowRight className="h-4 w-4" /></a>
              <a href="#services" className="rounded-full border border-slate-300 bg-white/70 px-7 py-3.5 text-sm font-bold text-slate-800 transition-colors hover:bg-white">Explore services</a>
            </div>
          </div>

          <div className={`relative rounded-[2.25rem] border p-4 shadow-2xl shadow-slate-900/10 backdrop-blur ${themeClasses.panel}`}>
            <div className={`relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br ${visualGradient} text-white`}>
              {isValidImageUrl(visualTheme.image_sections?.[0]?.image_url) && (
                <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${visualTheme.image_sections?.[0]?.image_url})` }} />
              )}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(255,255,255,0.42),transparent_13rem),radial-gradient(circle_at_78%_72%,rgba(255,255,255,0.22),transparent_16rem)]" />
              <div className="absolute -right-14 -top-14 h-44 w-44 rounded-full border border-white/30 bg-white/10" />
              <div className="absolute bottom-8 right-8 h-24 w-24 rounded-[2rem] border border-white/20 bg-white/10 rotate-6" />
              <div className="relative min-h-[28rem] p-7 sm:p-9">
                <div className="flex items-start justify-between gap-4">
                  <div className="rounded-[1.5rem] border border-white/20 bg-white/20 p-4 shadow-2xl backdrop-blur">
                    <IndustryIcon className="h-10 w-10" />
                  </div>
                  <div className="rounded-2xl border border-white/20 bg-white/20 px-4 py-3 text-right text-xs font-black uppercase tracking-[0.2em] backdrop-blur">Premium visual</div>
                </div>
                <div className="mt-20 max-w-lg">
                  <p className="inline-flex rounded-full bg-black/20 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-white/85 backdrop-blur">{visualTheme.industry_style || 'Signature atmosphere'}</p>
                  <h2 className="mt-5 text-4xl font-black tracking-tight sm:text-5xl">{visualTheme.hero_visual_title}</h2>
                  <p className="mt-4 leading-7 text-white/85">{visualTheme.hero_visual_description}</p>
                </div>
                <div className="mt-9 grid gap-3 sm:grid-cols-3">
                  {(visualTheme.image_keywords || [preview.industry, preview.location].filter(Boolean)).slice(0, 3).map((keyword) => (
                    <div key={keyword} className="rounded-2xl border border-white/20 bg-white/20 p-4 text-sm font-bold text-white backdrop-blur">{keyword}</div>
                  ))}
                </div>
                <div className="absolute bottom-5 left-5 hidden rounded-2xl border border-white/20 bg-white/90 p-4 text-slate-950 shadow-2xl sm:block">
                  <div className="flex items-center gap-3"><ShieldCheck className="h-5 w-5" /><span className="text-sm font-black">Trusted local experience</span></div>
                </div>
                <div className="absolute right-5 top-28 hidden rounded-2xl border border-white/20 bg-slate-950/60 p-4 shadow-2xl backdrop-blur sm:block">
                  <div className="flex items-center gap-3"><Star className="h-5 w-5 fill-white" /><span className="text-sm font-black">Customer-ready design</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="services" style={{ order: sectionRank('services') }} className="mx-auto max-w-7xl px-6 py-16 sm:py-24">
        <div className="mb-12 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div className="max-w-2xl">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">Services</p>
            <h2 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">Designed around what customers need most</h2>
          </div>
          <p className="max-w-md leading-7 text-slate-600">Clear service options, polished presentation, and a smooth path from interest to action.</p>
        </div>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {services.slice(0, 4).map((service, index) => {
            const ServiceIcon = getServiceIcon(preview, service.title);
            return (
              <article key={service.title} className={`group ${cardClasses}`}>
                <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg shadow-slate-950/15"><ServiceIcon className="h-6 w-6" /></div>
                <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-slate-400">Service 0{index + 1}</p>
                <h3 className="text-xl font-black tracking-tight">{service.title}</h3>
                <p className="mt-4 text-sm leading-7 text-slate-600">{service.description}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section id="experience" style={{ order: sectionRank('experience') }} className="border-y border-slate-200 bg-slate-50">
        <div className="mx-auto grid max-w-7xl gap-12 px-6 py-16 sm:py-24 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">Experience</p>
            <h2 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">A polished first impression for every visitor</h2>
            <p className="mt-6 leading-8 text-slate-600">{preview.about_intro}</p>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <div className="rounded-3xl bg-white p-5 shadow-sm"><CalendarCheck className="h-6 w-6 text-slate-950" /><p className="mt-3 text-sm font-bold">Simple next steps</p></div>
              <div className="rounded-3xl bg-white p-5 shadow-sm"><Clock className="h-6 w-6 text-slate-950" /><p className="mt-3 text-sm font-bold">Responsive service</p></div>
            </div>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {imageSections.slice(0, 4).map((card, index) => {
              const cardImageUrl = 'image_url' in card && isValidImageUrl(card.image_url) ? card.image_url : undefined;
              return (
                <div key={`${card.title}-${index}`} aria-label={card.image_alt || card.title} className={`min-h-80 rounded-[2rem] border p-5 shadow-xl ${imageCardStyle}`}>
                  <div className={`relative h-36 overflow-hidden rounded-[1.4rem] bg-gradient-to-br ${visualBlockStyle}`} style={cardImageUrl ? { backgroundImage: `url(${cardImageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}>
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.45),transparent_7rem)]" />
                    <div className="absolute bottom-4 left-4 rounded-2xl bg-white/85 p-3 text-slate-950 shadow-lg backdrop-blur"><GalleryIcon className="h-6 w-6" /></div>
                    <div className="absolute right-4 top-4 rounded-full bg-black/20 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-white backdrop-blur">{card.visual_type || 'gallery'}</div>
                  </div>
                  <h3 className="mt-5 text-lg font-black">{card.title}</h3>
                  <p className="mt-3 text-sm leading-6 opacity-75">{card.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="trust" style={{ order: sectionRank('trust') }} className="mx-auto max-w-7xl px-6 py-16 sm:py-24">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">Why customers choose us</p>
            <h2 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">Trust built into every detail</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {trustItems.slice(0, 4).map((item) => <div key={item} className="rounded-3xl border border-slate-200 bg-white p-5 font-bold text-slate-700 shadow-sm"><CheckCircle2 className="mb-4 h-6 w-6 text-slate-950" />{item}</div>)}
          </div>
        </div>
      </section>

      <section style={{ order: sectionRank('trust') + 0.5 }} className="bg-slate-950 text-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-6 py-16 md:grid-cols-[0.8fr_1.2fr] md:items-center">
          <div>
            <Quote className="h-10 w-10 text-white/40" />
            <h2 className="mt-5 text-3xl font-black tracking-tight">A confident, customer-ready experience</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {["Professional", "Responsive", "Trusted"].map((item) => <div key={item} className="rounded-3xl bg-white/10 p-6"><Star className="h-5 w-5 fill-white" /><p className="mt-5 text-sm leading-7 text-slate-300">{item} service with clear communication and thoughtful care from start to finish.</p></div>)}
          </div>
        </div>
      </section>

      <section id="contact" style={{ order: sectionRank('cta') }} className="mx-auto max-w-7xl px-6 py-16 sm:py-24">
        <div className="overflow-hidden rounded-[2.25rem] bg-gradient-to-br from-slate-950 to-slate-800 text-white shadow-2xl shadow-slate-900/15 lg:grid lg:grid-cols-[1fr_0.75fr]">
          <div className="p-8 sm:p-12">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-slate-400">Get started</p>
            <h2 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">{preview.contact?.headline || `Contact ${preview.business_name}`}</h2>
            <p className="mt-5 max-w-2xl leading-8 text-slate-300">{preview.contact?.body || 'Reach out today to ask a question or schedule a conversation.'}</p>
            <a href={preview.website || '#home'} className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-black text-slate-950 hover:bg-slate-100">{preview.cta_text || 'Get in touch'} <ArrowRight className="h-4 w-4" /></a>
          </div>
          <div className="border-t border-white/10 bg-white/10 p-8 sm:p-12 lg:border-l lg:border-t-0">
            <ShieldCheck className="h-9 w-9 text-white" />
            <h3 className="mt-5 text-2xl font-black">{preview.business_name}</h3>
            {preview.contact?.location && <p className="mt-5 text-slate-300"><span className="text-slate-500">Location:</span> {preview.contact.location}</p>}
            {preview.contact?.website && <p className="mt-3 break-words text-slate-300"><span className="text-slate-500">Website:</span> {preview.contact.website.replace(/^https?:\/\//, '')}</p>}
          </div>
        </div>
      </section>

      <footer style={{ order: 10 }} className="border-t border-slate-200 bg-white px-6 py-8 text-center text-sm text-slate-500">
        © {new Date().getFullYear()} {preview.business_name}. All rights reserved.
      </footer>
    </main>
  );
}
