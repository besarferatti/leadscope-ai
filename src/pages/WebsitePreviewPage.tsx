import { useEffect, useState } from 'react';
import { ArrowRight, CalendarCheck, CheckCircle2, Clock, Loader2, MapPin, Menu, Quote, ShieldCheck, Sparkles, Star } from 'lucide-react';
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
  industry_style: 'Premium local business visuals, polished cards, warm customer-focused design',
  hero_visual_title: `${preview.industry || 'Business'} experience`,
  hero_visual_description: 'A refined visual direction with modern placeholders for customer moments, service details, and trusted local expertise.',
  image_keywords: [preview.industry, preview.location].filter(Boolean),
  gallery_cards: [
    { title: 'Welcoming Experience', description: 'A polished first impression that helps visitors picture becoming a customer.' },
    { title: 'Trusted Local Team', description: 'Warm visual blocks for people, spaces, and service moments.' },
    { title: 'Quality in Detail', description: 'Premium placeholders that highlight care, process, and results.' },
  ],
});

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

  const visualTheme = preview.visual_theme || fallbackVisualTheme(preview);
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
  const galleryCards = visualTheme.gallery_cards?.length ? visualTheme.gallery_cards : fallbackVisualTheme(preview).gallery_cards;

  return (
    <main className="min-h-screen bg-white text-slate-950">
      <header className="sticky top-0 z-20 border-b border-white/70 bg-white/85 backdrop-blur-xl">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <a href="#home" className="text-lg font-black tracking-tight text-slate-950">{preview.business_name}</a>
          <div className="hidden items-center gap-8 text-sm font-semibold text-slate-600 md:flex">
            <a href="#services" className="hover:text-slate-950">Services</a>
            <a href="#experience" className="hover:text-slate-950">Experience</a>
            <a href="#trust" className="hover:text-slate-950">Reviews</a>
            <a href="#contact" className="hover:text-slate-950">Contact</a>
          </div>
          <a href="#contact" className="hidden rounded-full bg-slate-950 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-slate-950/10 hover:bg-slate-800 sm:inline-flex">{preview.cta_text || 'Get in touch'}</a>
          <Menu className="h-5 w-5 text-slate-500 md:hidden" />
        </nav>
      </header>

      <section id="home" className={`relative overflow-hidden bg-gradient-to-br ${gradientByIndustry(preview.industry)}`}>
        <div className="absolute left-1/2 top-0 h-80 w-80 -translate-x-1/2 rounded-full bg-white/70 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl gap-12 px-6 py-20 lg:grid-cols-[1fr_0.95fr] lg:items-center lg:py-28">
          <div>
            <div className="mb-6 flex flex-wrap gap-3">
              {preview.location && <p className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm"><MapPin className="h-4 w-4" /> {preview.location}</p>}
              {preview.industry && <p className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm"><Sparkles className="h-4 w-4" /> {preview.industry}</p>}
            </div>
            <h1 className="max-w-4xl text-5xl font-black leading-[0.95] tracking-tight text-slate-950 sm:text-7xl">{preview.hero_headline}</h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-600 sm:text-xl">{preview.subheadline}</p>
            <div className="mt-9 flex flex-wrap gap-3">
              <a href="#contact" className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-7 py-3.5 text-sm font-bold text-white shadow-xl shadow-slate-950/15 transition-colors hover:bg-slate-800">{preview.cta_text || 'Request a consultation'} <ArrowRight className="h-4 w-4" /></a>
              <a href="#services" className="rounded-full border border-slate-300 bg-white/70 px-7 py-3.5 text-sm font-bold text-slate-800 transition-colors hover:bg-white">Explore services</a>
            </div>
          </div>

          <div className="rounded-[2.25rem] border border-white/80 bg-white/70 p-4 shadow-2xl shadow-slate-900/10 backdrop-blur">
            <div className="overflow-hidden rounded-[1.75rem] bg-slate-950 text-white">
              <div className="relative min-h-80 p-7">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(255,255,255,0.24),transparent_16rem),radial-gradient(circle_at_75%_80%,rgba(96,165,250,0.35),transparent_18rem)]" />
                <div className="relative flex h-full min-h-72 flex-col justify-between">
                  <div>
                    <p className="inline-flex rounded-full bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-white/75">Signature atmosphere</p>
                    <h2 className="mt-5 text-3xl font-black tracking-tight">{visualTheme.hero_visual_title}</h2>
                    <p className="mt-4 max-w-md leading-7 text-slate-300">{visualTheme.hero_visual_description}</p>
                  </div>
                  <div className="mt-8 grid grid-cols-3 gap-3">
                    {(visualTheme.image_keywords || []).slice(0, 3).map((keyword) => (
                      <div key={keyword} className="rounded-2xl border border-white/10 bg-white/10 p-3 text-xs font-bold text-white/80">{keyword}</div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="services" className="mx-auto max-w-7xl px-6 py-16 sm:py-24">
        <div className="mb-12 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div className="max-w-2xl">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">Services</p>
            <h2 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">Designed around what customers need most</h2>
          </div>
          <p className="max-w-md leading-7 text-slate-600">Clear service options, polished presentation, and a smooth path from interest to action.</p>
        </div>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {services.slice(0, 4).map((service, index) => (
            <article key={service.title} className="group rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-900/10">
              <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-sm font-black text-white">0{index + 1}</div>
              <h3 className="text-xl font-black tracking-tight">{service.title}</h3>
              <p className="mt-4 text-sm leading-7 text-slate-600">{service.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="experience" className="border-y border-slate-200 bg-slate-50">
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
          <div className="grid gap-5 sm:grid-cols-3">
            {galleryCards.slice(0, 3).map((card) => (
              <div key={card.title} className="min-h-72 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="h-28 rounded-[1.4rem] bg-gradient-to-br from-slate-900 via-slate-700 to-slate-400" />
                <h3 className="mt-5 text-lg font-black">{card.title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">{card.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="trust" className="mx-auto max-w-7xl px-6 py-16 sm:py-24">
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

      <section className="bg-slate-950 text-white">
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

      <section id="contact" className="mx-auto max-w-7xl px-6 py-16 sm:py-24">
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

      <footer className="border-t border-slate-200 bg-white px-6 py-8 text-center text-sm text-slate-500">
        © {new Date().getFullYear()} {preview.business_name}. All rights reserved.
      </footer>
    </main>
  );
}
