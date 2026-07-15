import { useEffect, useState } from 'react';
import { Loader2, MapPin, Menu, Phone, ShieldCheck, Star } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { WebsitePreviewData } from '../types';

interface Props { token: string }

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
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading preview...</div>;
  }

  if (error || !preview) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6"><div className="max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 text-center"><h1 className="text-xl font-semibold text-white mb-2">Preview unavailable</h1><p className="text-slate-400 text-sm">{error || 'This preview could not be loaded.'}</p></div></div>;
  }

  const services = preview.services?.length ? preview.services : [
    { title: 'Professional Service', description: `Helpful, reliable support for customers in ${preview.location || 'the local area'}.` },
    { title: 'Personalized Guidance', description: 'Clear recommendations and friendly service from first contact through follow-up.' },
    { title: 'Local Expertise', description: 'A practical understanding of what customers nearby need most.' },
  ];
  const trustItems = preview.why_choose_us?.length ? preview.why_choose_us : [
    'Friendly, responsive communication',
    'Experienced local team',
    'Quality-focused service from start to finish',
  ];

  return (
    <main className="min-h-screen bg-white text-slate-950">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <a href="#home" className="text-lg font-black tracking-tight text-slate-950">{preview.business_name}</a>
          <div className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex">
            <a href="#services" className="hover:text-blue-600">Services</a>
            <a href="#about" className="hover:text-blue-600">About</a>
            <a href="#why-us" className="hover:text-blue-600">Why Us</a>
            <a href="#contact" className="hover:text-blue-600">Contact</a>
          </div>
          <a href="#contact" className="hidden rounded-full bg-blue-600 px-5 py-2 text-sm font-bold text-white shadow-sm hover:bg-blue-700 sm:inline-flex">Get in touch</a>
          <Menu className="h-5 w-5 text-slate-500 md:hidden" />
        </nav>
      </header>

      <section id="home" className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(96,165,250,0.32),transparent_34rem)]" />
        <div className="relative mx-auto grid max-w-6xl gap-12 px-6 py-20 lg:grid-cols-[1.08fr_0.92fr] lg:items-center lg:py-28">
          <div>
            {preview.location && <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm text-blue-100"><MapPin className="h-4 w-4" /> Serving {preview.location}</p>}
            <h1 className="text-4xl font-black leading-tight tracking-tight sm:text-6xl">{preview.hero_headline}</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">{preview.subheadline}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#contact" className="rounded-full bg-blue-500 px-7 py-3 text-sm font-bold text-white shadow-lg shadow-blue-500/25 transition-colors hover:bg-blue-400">{preview.cta_text || 'Request a consultation'}</a>
              <a href="#services" className="rounded-full border border-white/20 px-7 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10">Explore services</a>
            </div>
          </div>
          <div className="rounded-[2rem] border border-white/15 bg-white/10 p-6 shadow-2xl backdrop-blur">
            <div className="rounded-[1.5rem] bg-white p-6 text-slate-950">
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-blue-600">Welcome</p>
              <h2 className="mt-3 text-2xl font-black">Quality service built around your needs</h2>
              <p className="mt-4 leading-7 text-slate-600">{preview.about_intro}</p>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {['Responsive', 'Trusted', 'Local'].map((item) => (
                  <div key={item} className="rounded-2xl bg-slate-50 p-4 text-center text-sm font-bold text-slate-700">{item}</div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="services" className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
        <div className="mb-10 max-w-2xl">
          <p className="text-sm font-bold uppercase tracking-wider text-blue-600">Services</p>
          <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">How we can help</h2>
          <p className="mt-4 leading-7 text-slate-600">Straightforward services, clear communication, and a client-first experience from the first conversation.</p>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {services.map((service) => <article key={service.title} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"><h3 className="text-lg font-black">{service.title}</h3><p className="mt-3 text-sm leading-7 text-slate-600">{service.description}</p></article>)}
        </div>
      </section>

      <section id="about" className="border-y border-slate-200 bg-slate-50">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-16 sm:py-20 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-sm font-bold uppercase tracking-wider text-blue-600">About</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Meet {preview.business_name}</h2>
            <p className="mt-5 leading-8 text-slate-600">{preview.about_intro}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl bg-white p-6 shadow-sm"><ShieldCheck className="h-7 w-7 text-blue-600" /><h3 className="mt-4 font-black">Dependable support</h3><p className="mt-2 text-sm leading-6 text-slate-600">Helpful guidance and careful follow-through at every step.</p></div>
            <div className="rounded-3xl bg-white p-6 shadow-sm"><Phone className="h-7 w-7 text-blue-600" /><h3 className="mt-4 font-black">Easy to reach</h3><p className="mt-2 text-sm leading-6 text-slate-600">Simple next steps for new and returning customers.</p></div>
          </div>
        </div>
      </section>

      <section id="why-us" className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div><p className="text-sm font-bold uppercase tracking-wider text-blue-600">Why choose us</p><h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">A better experience for every customer</h2></div>
          <div className="grid gap-3">
            {trustItems.map((item) => <div key={item} className="rounded-2xl border border-slate-200 bg-white p-5 font-semibold text-slate-700 shadow-sm">{item}</div>)}
          </div>
        </div>
      </section>

      <section className="bg-blue-600 text-white">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="grid gap-5 md:grid-cols-3">
            {[1, 2, 3].map((item) => <div key={item} className="rounded-3xl bg-white/10 p-6"><Star className="h-5 w-5 fill-white" /><p className="mt-4 text-sm leading-7 text-blue-50">“Professional, responsive, and easy to work with. The team made the entire process clear from start to finish.”</p><p className="mt-4 text-sm font-bold">Local customer</p></div>)}
          </div>
        </div>
      </section>

      <section id="contact" className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
        <div className="rounded-[2rem] bg-slate-950 p-8 text-white sm:p-12 lg:grid lg:grid-cols-2 lg:gap-10 lg:items-center">
          <div><p className="text-sm font-bold uppercase tracking-wider text-blue-300">Contact</p><h2 className="mt-3 text-3xl font-black tracking-tight">{preview.contact?.headline || `Contact ${preview.business_name}`}</h2><p className="mt-4 leading-7 text-slate-300">{preview.contact?.body || 'Reach out today to ask a question or schedule a conversation.'}</p></div>
          <div className="mt-8 rounded-3xl border border-white/15 bg-white/10 p-6 lg:mt-0">
            {preview.contact?.location && <p className="text-slate-200"><span className="text-slate-400">Location:</span> {preview.contact.location}</p>}
            {preview.contact?.website && <p className="mt-3 text-slate-200"><span className="text-slate-400">Website:</span> {preview.contact.website.replace(/^https?:\/\//, '')}</p>}
            <a href="#home" className="mt-6 inline-flex rounded-full bg-white px-5 py-2.5 text-sm font-bold text-slate-950 hover:bg-blue-50">Back to top</a>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-slate-50 px-6 py-8 text-center text-sm text-slate-500">
        © {new Date().getFullYear()} {preview.business_name}. All rights reserved.
      </footer>
    </main>
  );
}
