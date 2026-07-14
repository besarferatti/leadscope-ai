import { useEffect, useState } from 'react';
import { AlertCircle, BarChart3, FileText, Globe, Lightbulb, MapPin, Megaphone, Search, Shield } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { SharedAuditReport } from '../types';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { getScoreBg, getScoreColor } from '../lib/utils';

interface Props {
  token: string;
}

function ScoreCard({ label, score, icon: Icon }: { label: string; score: number; icon: typeof Globe }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-slate-500" />
        <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <div className="flex items-end gap-2 mb-3">
        <span className={`text-4xl font-black ${getScoreColor(score)}`}>{score}</span>
        <span className="text-slate-400 text-sm mb-1">/100</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${getScoreBg(score)} rounded-full`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

function ListCard({ title, items }: { title: string; items?: string[] }) {
  if (!items?.length) return null;

  return (
    <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
      <div className="flex items-center gap-2 mb-3">
        <FileText className="w-4 h-4 text-blue-600" />
        <h3 className="text-slate-900 text-sm font-semibold uppercase tracking-wider">{title}</h3>
      </div>
      <ul className="space-y-2">
        {items.map(item => <li key={item} className="text-slate-700 text-sm leading-relaxed">• {item}</li>)}
      </ul>
    </div>
  );
}

export function SharedAuditReportPage({ token }: Props) {
  const [report, setReport] = useState<SharedAuditReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function loadReport() {
      setLoading(true);
      setNotFound(false);

      const { data, error } = await supabase.rpc('get_shared_audit_report', { token });
      const sharedReport = Array.isArray(data) ? data[0] : data;

      if (error || !sharedReport) {
        setReport(null);
        setNotFound(true);
      } else {
        setReport(sharedReport as SharedAuditReport);
      }

      setLoading(false);
    }

    loadReport();
  }, [token]);

  if (loading) return <LoadingSpinner message="Loading shared report..." />;

  if (notFound || !report) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl bg-white border border-slate-200 p-8 text-center shadow-sm">
          <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Report not found</h1>
          <p className="text-slate-600 text-sm">This audit report link is invalid or no longer available.</p>
        </div>
      </div>
    );
  }

  const seoPack = report.seo_content_pack;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <main className="max-w-5xl mx-auto px-4 py-8 sm:py-12 space-y-8">
        <header className="rounded-3xl bg-slate-950 text-white p-6 sm:p-8 shadow-xl">
          <p className="text-blue-300 text-sm font-semibold uppercase tracking-widest mb-3">Client-ready audit report</p>
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
            <div>
              <h1 className="text-3xl sm:text-4xl font-black mb-3">{report.business_name}</h1>
              <div className="flex flex-wrap gap-4 text-sm text-slate-300">
                {report.website && <a href={report.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-blue-300 transition-colors"><Globe className="w-4 h-4" />{report.website.replace(/^https?:\/\//, '')}</a>}
                {report.location && <span className="flex items-center gap-2"><MapPin className="w-4 h-4" />{report.location}</span>}
              </div>
            </div>
            {report.lead_score !== null && (
              <div className="rounded-2xl bg-white/10 border border-white/10 p-4 min-w-36">
                <p className="text-slate-300 text-xs uppercase tracking-wider mb-1">Lead score</p>
                <p className="text-3xl font-black text-white">{report.lead_score}<span className="text-slate-400 text-base">/100</span></p>
              </div>
            )}
          </div>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ScoreCard label="Website" score={report.website_score} icon={Globe} />
          <ScoreCard label="SEO" score={report.seo_score} icon={BarChart3} />
          <ScoreCard label="Conversion" score={report.conversion_score} icon={Megaphone} />
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {report.main_issues?.length > 0 && (
            <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <AlertCircle className="w-5 h-5 text-amber-500" />
                <h2 className="font-bold text-slate-900">Main issues</h2>
              </div>
              <ul className="space-y-3">
                {report.main_issues.map((issue, i) => <li key={issue} className="flex gap-3 text-slate-700 text-sm"><span className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold flex-shrink-0">{i + 1}</span>{issue}</li>)}
              </ul>
            </div>
          )}

          <div className="space-y-5">
            {report.recommended_offer && (
              <div className="rounded-2xl bg-blue-50 border border-blue-100 p-5">
                <div className="flex items-center gap-2 mb-2"><Shield className="w-5 h-5 text-blue-600" /><h2 className="font-bold text-blue-950">Recommended offer</h2></div>
                <p className="text-blue-950/80 text-sm leading-relaxed">{report.recommended_offer}</p>
              </div>
            )}
            {report.personalization_angle && (
              <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-5">
                <div className="flex items-center gap-2 mb-2"><Lightbulb className="w-5 h-5 text-emerald-600" /><h2 className="font-bold text-emerald-950">Personalization angle</h2></div>
                <p className="text-emerald-950/80 text-sm leading-relaxed">{report.personalization_angle}</p>
              </div>
            )}
          </div>
        </section>

        {report.summary && (
          <section className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm">
            <h2 className="font-bold text-slate-900 mb-2">Summary</h2>
            <p className="text-slate-700 text-sm leading-relaxed">{report.summary}</p>
          </section>
        )}

        {seoPack && (
          <section className="rounded-2xl bg-white border border-slate-200 p-5 sm:p-6 shadow-sm space-y-5">
            <div className="flex items-center gap-2">
              <Search className="w-5 h-5 text-purple-600" />
              <h2 className="text-xl font-bold text-slate-900">SEO & Content Opportunities</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {([
                ['Primary', seoPack.suggested_keywords?.primary],
                ['Local', seoPack.suggested_keywords?.local],
                ['Service', seoPack.suggested_keywords?.service],
                ['Long-tail', seoPack.suggested_keywords?.long_tail],
              ] as const).map(([label, keywords]) => keywords?.length ? (
                <div key={label} className="rounded-xl bg-purple-50 border border-purple-100 p-4">
                  <p className="text-purple-950 text-xs font-semibold uppercase tracking-wider mb-2">{label} keywords</p>
                  <div className="flex flex-wrap gap-2">{keywords.map(keyword => <span key={keyword} className="px-2 py-1 rounded-md bg-white text-purple-900 text-xs border border-purple-100">{keyword}</span>)}</div>
                </div>
              ) : null)}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {seoPack.meta_title && <div className="rounded-xl bg-slate-50 border border-slate-200 p-4"><p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Meta title</p><p className="text-slate-800 text-sm">{seoPack.meta_title}</p></div>}
              {seoPack.meta_description && <div className="rounded-xl bg-slate-50 border border-slate-200 p-4"><p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Meta description</p><p className="text-slate-800 text-sm">{seoPack.meta_description}</p></div>}
              {seoPack.h1_suggestion && <div className="rounded-xl bg-slate-50 border border-slate-200 p-4"><p className="text-slate-500 text-xs uppercase tracking-wider mb-1">H1 suggestion</p><p className="text-slate-800 text-sm">{seoPack.h1_suggestion}</p></div>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <ListCard title="Service page ideas" items={seoPack.service_page_ideas} />
              <ListCard title="Blog post ideas" items={seoPack.blog_post_ideas} />
              <ListCard title="Google Business Profile posts" items={seoPack.google_business_posts} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {seoPack.homepage_copy && (
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
                  <p className="text-slate-500 text-xs uppercase tracking-wider mb-2">Homepage copy</p>
                  <p className="text-slate-900 text-sm font-semibold">{seoPack.homepage_copy.headline}</p>
                  <p className="text-slate-700 text-sm mt-1">{seoPack.homepage_copy.subheadline}</p>
                  <p className="text-blue-700 text-sm mt-2 font-medium">CTA: {seoPack.homepage_copy.cta}</p>
                </div>
              )}
              {seoPack.recommended_service && (
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
                  <p className="text-slate-500 text-xs uppercase tracking-wider mb-2">Recommended service</p>
                  <p className="text-slate-900 text-sm font-semibold">{seoPack.recommended_service.service_name}</p>
                  <p className="text-slate-700 text-sm mt-1">{seoPack.recommended_service.why_sell_this}</p>
                  <ul className="mt-2 space-y-1">{(seoPack.recommended_service.deliverables ?? []).map(item => <li key={item} className="text-slate-700 text-sm">• {item}</li>)}</ul>
                </div>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
