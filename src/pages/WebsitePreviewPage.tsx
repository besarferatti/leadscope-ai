import { useEffect, useState } from 'react';
import { ExternalLink, Loader2, MapPin, Search, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { WebsitePreviewData } from '../types';

interface Props { token: string }

function getExternalUrl(url?: string) {
  if (!url) return '';
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

export function WebsitePreviewPage({ token }: Props) {
  const [preview, setPreview] = useState<WebsitePreviewData | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
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
        setCreatedAt(data[0].created_at);
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

  return (
    <main className="min-h-screen bg-white text-slate-950">
      <section className="relative overflow-hidden bg-slate-950 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.35),transparent_34rem)]" />
        <div className="relative mx-auto max-w-6xl px-6 py-6 flex items-center justify-between">
          <div className="font-bold tracking-tight">{preview.business_name}</div>
          {preview.location && <div className="hidden sm:flex items-center gap-1.5 text-sm text-slate-300"><MapPin className="w-4 h-4" /> {preview.location}</div>}
        </div>
        <div className="relative mx-auto max-w-6xl px-6 py-20 sm:py-28 grid lg:grid-cols-[1.15fr_0.85fr] gap-10 items-center">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-blue-400/30 bg-blue-400/10 px-3 py-1 text-sm text-blue-100 mb-6"><Sparkles className="w-4 h-4" /> AI website preview</p>
            <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-tight">{preview.hero_headline}</h1>
            <p className="mt-6 text-lg text-slate-300 leading-8 max-w-2xl">{preview.subheadline}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#contact" className="rounded-xl bg-blue-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-500/25 hover:bg-blue-400 transition-colors">{preview.cta_text}</a>
              {preview.website && <a href={getExternalUrl(preview.website)} target="_blank" rel="noopener noreferrer" className="rounded-xl border border-white/15 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors inline-flex items-center gap-2">Current website <ExternalLink className="w-4 h-4" /></a>}
            </div>
          </div>
          <div className="rounded-3xl bg-white/10 border border-white/15 p-5 shadow-2xl backdrop-blur">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400 mb-3">SEO title suggestion</p>
            <p className="text-xl font-bold">{preview.meta_title}</p>
            {preview.local_seo_angle && <div className="mt-5 rounded-2xl bg-emerald-400/10 border border-emerald-300/20 p-4"><p className="flex items-center gap-2 text-emerald-200 font-semibold text-sm mb-1"><Search className="w-4 h-4" /> Local SEO angle</p><p className="text-slate-300 text-sm leading-6">{preview.local_seo_angle}</p></div>}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16 grid md:grid-cols-3 gap-5">
        {(preview.services || []).map((service) => <div key={service.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="font-bold text-lg mb-2">{service.title}</h2><p className="text-slate-600 leading-7 text-sm">{service.description}</p></div>)}
      </section>

      <section className="bg-slate-50 border-y border-slate-200"><div className="mx-auto max-w-6xl px-6 py-16 grid lg:grid-cols-2 gap-10"><div><p className="text-sm font-bold text-blue-600 uppercase tracking-wider mb-3">About</p><h2 className="text-3xl font-black mb-4">A clearer first impression for {preview.business_name}</h2><p className="text-slate-600 leading-8">{preview.about_intro}</p></div><div><p className="text-sm font-bold text-blue-600 uppercase tracking-wider mb-3">Why choose us</p><div className="space-y-3">{(preview.why_choose_us || []).map((item) => <div key={item} className="rounded-xl bg-white border border-slate-200 p-4 font-medium text-slate-700">{item}</div>)}</div></div></div></section>

      <section id="contact" className="mx-auto max-w-6xl px-6 py-16"><div className="rounded-3xl bg-slate-950 text-white p-8 sm:p-12 grid lg:grid-cols-2 gap-8 items-center"><div><p className="text-sm font-bold text-blue-300 uppercase tracking-wider mb-3">Contact</p><h2 className="text-3xl font-black mb-4">{preview.contact?.headline || `Contact ${preview.business_name}`}</h2><p className="text-slate-300 leading-7">{preview.contact?.body}</p></div><div className="rounded-2xl bg-white/10 border border-white/15 p-6 space-y-3 text-slate-200">{preview.contact?.location && <p><span className="text-slate-400">Location:</span> {preview.contact.location}</p>}{preview.contact?.website && <p><span className="text-slate-400">Website:</span> {preview.contact.website.replace(/^https?:\/\//, '')}</p>}<p className="text-xs text-slate-500 pt-3">Read-only preview generated{createdAt ? ` on ${new Date(createdAt).toLocaleDateString()}` : ''}.</p></div></div></section>
    </main>
  );
}
