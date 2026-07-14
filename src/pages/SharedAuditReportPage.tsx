import { useEffect, useState } from 'react';
import { AlertCircle, BarChart3, FileText, Globe, Languages, Lightbulb, MapPin, Megaphone, Search, Shield } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { SharedAuditReport } from '../types';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { getScoreBg, getScoreColor } from '../lib/utils';

interface Props {
  token: string;
}

type PublicReportLanguage = 'en' | 'sq' | 'mk';

const languageOptions: Array<{ code: PublicReportLanguage; label: string }> = [
  { code: 'en', label: 'English' },
  { code: 'sq', label: 'Shqip' },
  { code: 'mk', label: 'Македонски' },
];

const copy = {
  en: { loading: 'Loading shared report...', notFoundTitle: 'Report not found', notFoundBody: 'This audit report link is invalid or no longer available.', eyebrow: 'Client-ready audit report', leadScore: 'Lead score', website: 'Website', seo: 'SEO', conversion: 'Conversion', mainIssues: 'Main issues', recommendedOffer: 'Recommended offer', personalizationAngle: 'Personalization angle', summary: 'Summary', seoTitle: 'SEO & Content Opportunities', primary: 'Primary', local: 'Local', service: 'Service', longTail: 'Long-tail', keywords: 'keywords', metaTitle: 'Meta title', metaDescription: 'Meta description', h1Suggestion: 'H1 suggestion', servicePageIdeas: 'Service page ideas', blogPostIdeas: 'Blog post ideas', gbpPosts: 'Google Business Profile posts', homepageCopy: 'Homepage copy', cta: 'CTA', recommendedService: 'Recommended service' },
  sq: { loading: 'Duke ngarkuar raportin e ndarë...', notFoundTitle: 'Raporti nuk u gjet', notFoundBody: 'Kjo lidhje e raportit të auditimit është e pavlefshme ose nuk është më e disponueshme.', eyebrow: 'Raport auditimi gati për klientin', leadScore: 'Rezultati i lead-it', website: 'Faqja web', seo: 'SEO', conversion: 'Konvertimi', mainIssues: 'Problemet kryesore', recommendedOffer: 'Oferta e rekomanduar', personalizationAngle: 'Këndi i personalizimit', summary: 'Përmbledhje', seoTitle: 'Mundësi SEO & Përmbajtjeje', primary: 'Kryesore', local: 'Lokale', service: 'Shërbimi', longTail: 'Long-tail', keywords: 'fjalë kyçe', metaTitle: 'Titulli meta', metaDescription: 'Përshkrimi meta', h1Suggestion: 'Sugjerimi H1', servicePageIdeas: 'Ide për faqe shërbimi', blogPostIdeas: 'Ide për blog', gbpPosts: 'Postime për Google Business Profile', homepageCopy: 'Tekst për faqen kryesore', cta: 'Thirrje për veprim', recommendedService: 'Shërbimi i rekomanduar' },
  mk: { loading: 'Се вчитува споделениот извештај...', notFoundTitle: 'Извештајот не е пронајден', notFoundBody: 'Овој линк за извештајот од аудитот е неважечки или повеќе не е достапен.', eyebrow: 'Извештај за аудит подготвен за клиент', leadScore: 'Оценка на лид', website: 'Веб-страница', seo: 'SEO', conversion: 'Конверзија', mainIssues: 'Главни проблеми', recommendedOffer: 'Препорачана понуда', personalizationAngle: 'Агол на персонализација', summary: 'Резиме', seoTitle: 'SEO и содржински можности', primary: 'Примарни', local: 'Локални', service: 'Услужни', longTail: 'Долга опашка', keywords: 'клучни зборови', metaTitle: 'Мета наслов', metaDescription: 'Мета опис', h1Suggestion: 'H1 предлог', servicePageIdeas: 'Идеи за страници за услуги', blogPostIdeas: 'Идеи за блог објави', gbpPosts: 'Објави за Google Business Profile', homepageCopy: 'Текст за почетна страница', cta: 'CTA', recommendedService: 'Препорачана услуга' },
} satisfies Record<PublicReportLanguage, Record<string, string>>;

function getLanguageFromUrl(): PublicReportLanguage {
  const lang = new URLSearchParams(window.location.search).get('lang');
  return lang === 'sq' || lang === 'mk' ? lang : 'en';
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
  const [language, setLanguage] = useState<PublicReportLanguage>(() => getLanguageFromUrl());
  const t = copy[language];

  useEffect(() => {
    async function loadReport() {
      setLoading(true);
      setNotFound(false);

      const { data, error } = await supabase.functions.invoke('translate-shared-audit-report', {
        body: { token, language },
      });
      const sharedReport = data?.report;

      if (error || !sharedReport) {
        setReport(null);
        setNotFound(true);
      } else {
        setReport(sharedReport as SharedAuditReport);
      }

      setLoading(false);
    }

    loadReport();
  }, [token, language]);

  if (loading) return <LoadingSpinner message={t.loading} />;

  if (notFound || !report) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl bg-white border border-slate-200 p-8 text-center shadow-sm">
          <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-900 mb-2">{t.notFoundTitle}</h1>
          <p className="text-slate-600 text-sm">{t.notFoundBody}</p>
        </div>
      </div>
    );
  }

  const seoPack = report.seo_content_pack;

  function handleLanguageChange(nextLanguage: PublicReportLanguage) {
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set('lang', nextLanguage);
    window.history.replaceState(null, '', nextUrl);
    setLanguage(nextLanguage);
  }


  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <main className="max-w-5xl mx-auto px-4 py-8 sm:py-12 space-y-8">
        <header className="rounded-3xl bg-slate-950 text-white p-6 sm:p-8 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
            <p className="text-blue-300 text-sm font-semibold uppercase tracking-widest">{t.eyebrow}</p>
            <label className="flex items-center gap-2 text-xs text-slate-300">
              <Languages className="w-4 h-4" />
              <select
                value={language}
                onChange={event => handleLanguageChange(event.target.value as PublicReportLanguage)}
                className="rounded-lg border border-white/10 bg-slate-900 px-2 py-1 text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                {languageOptions.map(option => <option key={option.code} value={option.code}>{option.label}</option>)}
              </select>
            </label>
          </div>
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
                <p className="text-slate-300 text-xs uppercase tracking-wider mb-1">{t.leadScore}</p>
                <p className="text-3xl font-black text-white">{report.lead_score}<span className="text-slate-400 text-base">/100</span></p>
              </div>
            )}
          </div>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ScoreCard label={t.website} score={report.website_score} icon={Globe} />
          <ScoreCard label={t.seo} score={report.seo_score} icon={BarChart3} />
          <ScoreCard label={t.conversion} score={report.conversion_score} icon={Megaphone} />
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {report.main_issues?.length > 0 && (
            <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <AlertCircle className="w-5 h-5 text-amber-500" />
                <h2 className="font-bold text-slate-900">{t.mainIssues}</h2>
              </div>
              <ul className="space-y-3">
                {report.main_issues.map((issue, i) => <li key={issue} className="flex gap-3 text-slate-700 text-sm"><span className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold flex-shrink-0">{i + 1}</span>{issue}</li>)}
              </ul>
            </div>
          )}

          <div className="space-y-5">
            {report.recommended_offer && (
              <div className="rounded-2xl bg-blue-50 border border-blue-100 p-5">
                <div className="flex items-center gap-2 mb-2"><Shield className="w-5 h-5 text-blue-600" /><h2 className="font-bold text-blue-950">{t.recommendedOffer}</h2></div>
                <p className="text-blue-950/80 text-sm leading-relaxed">{report.recommended_offer}</p>
              </div>
            )}
            {report.personalization_angle && (
              <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-5">
                <div className="flex items-center gap-2 mb-2"><Lightbulb className="w-5 h-5 text-emerald-600" /><h2 className="font-bold text-emerald-950">{t.personalizationAngle}</h2></div>
                <p className="text-emerald-950/80 text-sm leading-relaxed">{report.personalization_angle}</p>
              </div>
            )}
          </div>
        </section>

        {report.summary && (
          <section className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm">
            <h2 className="font-bold text-slate-900 mb-2">{t.summary}</h2>
            <p className="text-slate-700 text-sm leading-relaxed">{report.summary}</p>
          </section>
        )}

        {seoPack && (
          <section className="rounded-2xl bg-white border border-slate-200 p-5 sm:p-6 shadow-sm space-y-5">
            <div className="flex items-center gap-2">
              <Search className="w-5 h-5 text-purple-600" />
              <h2 className="text-xl font-bold text-slate-900">{t.seoTitle}</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {([
                [t.primary, seoPack.suggested_keywords?.primary],
                [t.local, seoPack.suggested_keywords?.local],
                [t.service, seoPack.suggested_keywords?.service],
                [t.longTail, seoPack.suggested_keywords?.long_tail],
              ] as const).map(([label, keywords]) => keywords?.length ? (
                <div key={label} className="rounded-xl bg-purple-50 border border-purple-100 p-4">
                  <p className="text-purple-950 text-xs font-semibold uppercase tracking-wider mb-2">{label} {t.keywords}</p>
                  <div className="flex flex-wrap gap-2">{keywords.map(keyword => <span key={keyword} className="px-2 py-1 rounded-md bg-white text-purple-900 text-xs border border-purple-100">{keyword}</span>)}</div>
                </div>
              ) : null)}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {seoPack.meta_title && <div className="rounded-xl bg-slate-50 border border-slate-200 p-4"><p className="text-slate-500 text-xs uppercase tracking-wider mb-1">{t.metaTitle}</p><p className="text-slate-800 text-sm">{seoPack.meta_title}</p></div>}
              {seoPack.meta_description && <div className="rounded-xl bg-slate-50 border border-slate-200 p-4"><p className="text-slate-500 text-xs uppercase tracking-wider mb-1">{t.metaDescription}</p><p className="text-slate-800 text-sm">{seoPack.meta_description}</p></div>}
              {seoPack.h1_suggestion && <div className="rounded-xl bg-slate-50 border border-slate-200 p-4"><p className="text-slate-500 text-xs uppercase tracking-wider mb-1">{t.h1Suggestion}</p><p className="text-slate-800 text-sm">{seoPack.h1_suggestion}</p></div>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <ListCard title={t.servicePageIdeas} items={seoPack.service_page_ideas} />
              <ListCard title={t.blogPostIdeas} items={seoPack.blog_post_ideas} />
              <ListCard title={t.gbpPosts} items={seoPack.google_business_posts} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {seoPack.homepage_copy && (
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
                  <p className="text-slate-500 text-xs uppercase tracking-wider mb-2">{t.homepageCopy}</p>
                  <p className="text-slate-900 text-sm font-semibold">{seoPack.homepage_copy.headline}</p>
                  <p className="text-slate-700 text-sm mt-1">{seoPack.homepage_copy.subheadline}</p>
                  <p className="text-blue-700 text-sm mt-2 font-medium">{t.cta}: {seoPack.homepage_copy.cta}</p>
                </div>
              )}
              {seoPack.recommended_service && (
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
                  <p className="text-slate-500 text-xs uppercase tracking-wider mb-2">{t.recommendedService}</p>
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
