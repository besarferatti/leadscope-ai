import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type SupportedLanguage = "en" | "sq" | "mk";
type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
type SharedAuditReport = {
  business_name: string;
  website: string;
  location: string;
  lead_score: number | null;
  website_score: number;
  seo_score: number;
  conversion_score: number;
  main_issues: string[];
  recommended_offer: string;
  personalization_angle: string;
  summary: string;
  seo_content_pack?: Record<string, JsonValue> | null;
  shared_at: string | null;
};

const supportedLanguages: SupportedLanguage[] = ["en", "sq", "mk"];
const languageNames: Record<SupportedLanguage, string> = { en: "English", sq: "standard Albanian", mk: "Macedonian Cyrillic" };

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function errorResponse(message: string, status = 400) { return jsonResponse({ error: message }, status); }
function cleanJson(content: string) { return content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim(); }

function sanitizePublicReport(report: SharedAuditReport): SharedAuditReport {
  const seoContentPack = report.seo_content_pack ? { ...report.seo_content_pack } : null;
  if (seoContentPack) delete seoContentPack.suggested_pricing;

  return {
    business_name: report.business_name,
    website: report.website,
    location: report.location,
    lead_score: report.lead_score,
    website_score: report.website_score,
    seo_score: report.seo_score,
    conversion_score: report.conversion_score,
    main_issues: report.main_issues ?? [],
    recommended_offer: report.recommended_offer,
    personalization_angle: report.personalization_angle,
    summary: report.summary,
    seo_content_pack: seoContentPack,
    shared_at: report.shared_at,
  };
}

async function translateReport(report: SharedAuditReport, language: SupportedLanguage, openaiApiKey: string): Promise<SharedAuditReport> {
  const prompt = `Translate this public website audit report into ${languageNames[language]}.

Rules:
- Return raw JSON only, with exactly the same keys and structure.
- Translate human-readable text naturally.
- Keep numeric scores and null values unchanged.
- Keep URLs unchanged.
- Do not add suggested_pricing or any pricing fields.

JSON:
${JSON.stringify(report)}`;

  const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiApiKey}` },
    body: JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "user", content: prompt }], temperature: 0.2, max_tokens: 3000 }),
  });

  if (!openaiRes.ok) {
    const errData = await openaiRes.json().catch(() => ({}));
    throw new Error((errData as { error?: { message?: string } }).error?.message ?? `OpenAI error (${openaiRes.status})`);
  }

  const completion = await openaiRes.json() as { choices: Array<{ message: { content: string } }> };
  return sanitizePublicReport(JSON.parse(cleanJson(completion.choices[0]?.message?.content ?? "{}")) as SharedAuditReport);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  try {
    const body = await req.json() as { token?: string; language?: string };
    const token = body.token?.trim();
    const language = body.language as SupportedLanguage | undefined;

    if (!token) return errorResponse("token is required");
    if (!language || !supportedLanguages.includes(language)) return errorResponse("language must be one of en, sq, or mk");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")?.trim();
    if (!supabaseUrl || !supabaseAnonKey) return errorResponse("Supabase environment variables are not configured.", 500);
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

    const { data, error } = await supabaseClient.rpc("get_shared_audit_report", { token });
    const sharedReport = Array.isArray(data) ? data[0] : data;
    if (error) return errorResponse(error.message, 500);
    if (!sharedReport) return errorResponse("Report not found", 404);

    const publicReport = sanitizePublicReport(sharedReport as SharedAuditReport);
    if (language === "en") return jsonResponse({ report: publicReport });

    const openaiApiKey = Deno.env.get("OPENAI_API_KEY")?.trim();
    if (!openaiApiKey) return errorResponse("OpenAI API key is not configured on the server.", 500);

    const translatedReport = await translateReport(publicReport, language, openaiApiKey);
    return jsonResponse({ report: translatedReport });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to translate shared audit report.";
    return errorResponse(message, 500);
  }
});
