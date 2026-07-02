import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type PlanId = "free_trial" | "starter" | "pro" | "agency" | "enterprise" | "admin_unlimited";
type UserProfile = { id: string; role: "admin" | "user"; current_plan: PlanId; trial_ends_at: string; audits_used_this_month: number; is_active: boolean };
type Lead = { id: string; user_id: string; business_name: string; industry: string; location: string; website: string; google_rating: number | null; reviews_count: number };
type AuditPayload = { website_score: number; seo_score: number; conversion_score: number; lead_score: number; main_issues: string[]; recommended_offer: string; personalization_angle: string; summary: string };
type WebsiteSignals = {
  fetchStatus: "not_provided" | "success" | "failed";
  url: string;
  finalUrl?: string;
  failureReason?: string;
  titleText: string;
  titleExists: boolean;
  titleLength: number;
  metaDescriptionText: string;
  metaDescriptionExists: boolean;
  metaDescriptionLength: number;
  h1Count: number;
  firstH1Text: string;
  h2Count: number;
  mobileViewportExists: boolean;
  canonicalExists: boolean;
  openGraphTitleExists: boolean;
  openGraphDescriptionExists: boolean;
  usesHttps: boolean;
  detectedCtaWords: string[];
  outdatedSignals: {
    oldCopyrightYear: number | null;
    tableBasedLayout: boolean;
    missingViewport: boolean;
    veryShortBodyText: boolean;
  };
};

const auditLimits: Record<PlanId, number> = { free_trial: 25, starter: 100, pro: 500, agency: 2000, enterprise: -1, admin_unlimited: -1 };

function jsonResponse(data: unknown, status = 200) { return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
function errorResponse(message: string, status = 400) { return jsonResponse({ error: message }, status); }
function isAdmin(profile: UserProfile) { return profile.role === "admin"; }
function cleanJson(content: string) { return content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim(); }
function normalizeWebsiteUrl(rawUrl: string): URL | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(candidate);
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}
function emptyWebsiteSignals(url = "", status: WebsiteSignals["fetchStatus"] = "not_provided", failureReason?: string): WebsiteSignals {
  return {
    fetchStatus: status,
    url,
    failureReason,
    titleText: "",
    titleExists: false,
    titleLength: 0,
    metaDescriptionText: "",
    metaDescriptionExists: false,
    metaDescriptionLength: 0,
    h1Count: 0,
    firstH1Text: "",
    h2Count: 0,
    mobileViewportExists: false,
    canonicalExists: false,
    openGraphTitleExists: false,
    openGraphDescriptionExists: false,
    usesHttps: normalizeWebsiteUrl(url)?.protocol === "https:",
    detectedCtaWords: [],
    outdatedSignals: { oldCopyrightYear: null, tableBasedLayout: false, missingViewport: false, veryShortBodyText: false },
  };
}
function decodeHtmlEntities(value: string) {
  const entities: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  return value.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code))).replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16))).replace(/&([a-z]+);/gi, (match, entity) => entities[entity.toLowerCase()] ?? match);
}
function cleanText(value: string) { return decodeHtmlEntities(value.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim(); }
function getMetaContent(html: string, attribute: "name" | "property", value: string) {
  const pattern = new RegExp(`<meta\\b(?=[^>]*\\b${attribute}=["']${value}["'])(?=[^>]*\\bcontent=["']([^"']*)["'])[^>]*>`, "i");
  return cleanText(html.match(pattern)?.[1] ?? "");
}
function extractWebsiteSignals(html: string, url: URL, finalUrl?: string): WebsiteSignals {
  const titleText = cleanText(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
  const metaDescriptionText = getMetaContent(html, "name", "description");
  const h1Matches = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)];
  const h2Count = [...html.matchAll(/<h2\b[^>]*>/gi)].length;
  const lowerHtml = html.toLowerCase();
  const bodyText = cleanText(html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? html);
  const detectedCtaWords = ["contact", "call", "book", "schedule", "appointment", "get quote", "request quote", "estimate", "free consultation", "order now", "buy now"].filter((word) => lowerHtml.includes(word));
  const currentYear = new Date().getUTCFullYear();
  const oldCopyrightYear = [...html.matchAll(/(?:©|&copy;|copyright)[^0-9]{0,30}((?:19|20)\d{2})/gi)].map((match) => Number(match[1])).filter((year) => currentYear - year > 4).sort((a, b) => a - b)[0] ?? null;
  const mobileViewportExists = /<meta\b(?=[^>]*\bname=["']viewport["'])[^>]*>/i.test(html);
  return {
    fetchStatus: "success",
    url: url.toString(),
    finalUrl,
    titleText,
    titleExists: titleText.length > 0,
    titleLength: titleText.length,
    metaDescriptionText,
    metaDescriptionExists: metaDescriptionText.length > 0,
    metaDescriptionLength: metaDescriptionText.length,
    h1Count: h1Matches.length,
    firstH1Text: cleanText(h1Matches[0]?.[1] ?? ""),
    h2Count,
    mobileViewportExists,
    canonicalExists: /<link\b(?=[^>]*\brel=["']canonical["'])[^>]*>/i.test(html),
    openGraphTitleExists: getMetaContent(html, "property", "og:title").length > 0,
    openGraphDescriptionExists: getMetaContent(html, "property", "og:description").length > 0,
    usesHttps: url.protocol === "https:",
    detectedCtaWords,
    outdatedSignals: { oldCopyrightYear, tableBasedLayout: /<table\b/i.test(html), missingViewport: !mobileViewportExists, veryShortBodyText: bodyText.length > 0 && bodyText.length < 500 },
  };
}
async function fetchWebsiteSignals(rawUrl: string): Promise<WebsiteSignals> {
  const url = normalizeWebsiteUrl(rawUrl);
  if (!url) return emptyWebsiteSignals(rawUrl, "failed", "Website URL is missing or is not a valid HTTP/HTTPS URL.");
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: "text/html,application/xhtml+xml" }, redirect: "follow" });
    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    if (!response.ok) return emptyWebsiteSignals(url.toString(), "failed", `Website returned HTTP ${response.status}.`);
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) return emptyWebsiteSignals(url.toString(), "failed", "Website response was not HTML.");
    const html = (await response.text()).slice(0, 60000);
    return extractWebsiteSignals(html, url, response.url);
  } catch (err: unknown) {
    const failureReason = err instanceof DOMException && err.name === "AbortError" ? "Website fetch timed out." : "Website HTML could not be fetched.";
    return emptyWebsiteSignals(url.toString(), "failed", failureReason);
  } finally {
    clearTimeout(timeoutId);
  }
}
function enforceAuditLimit(profile: UserProfile): string | null {
  if (isAdmin(profile)) return null;
  if (!profile.is_active) return "Your account is inactive. Please contact support.";
  if (profile.current_plan === "free_trial" && new Date(profile.trial_ends_at) < new Date()) return "Your free trial has ended. Upgrade your plan to continue using LeadScope AI.";
  const limit = auditLimits[profile.current_plan] ?? auditLimits.free_trial;
  if (limit !== -1 && profile.audits_used_this_month >= limit) return "You've reached your monthly AI audit limit. Upgrade your plan to analyze more websites.";
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return errorResponse("Missing Authorization Bearer token", 401);
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY")?.trim();
    if (!openaiApiKey) return errorResponse("OpenAI API key is not configured on the server.", 500);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return errorResponse("Unauthorized", 401);

    const { lead_id } = await req.json() as { lead_id?: string };
    if (!lead_id) return errorResponse("lead_id is required");

    const { data: profile, error: profileError } = await serviceClient.from("user_profiles").select("id, role, current_plan, trial_ends_at, audits_used_this_month, is_active").eq("id", user.id).maybeSingle();
    if (profileError || !profile) return errorResponse("User profile not found", 404);
    const typedProfile = profile as UserProfile;

    const { data: lead, error: leadError } = await serviceClient.from("leads").select("id, user_id, business_name, industry, location, website, google_rating, reviews_count").eq("id", lead_id).maybeSingle();
    if (leadError || !lead) return errorResponse("Lead not found", 404);
    const typedLead = lead as Lead;
    if (!isAdmin(typedProfile) && typedLead.user_id !== user.id) return errorResponse("Forbidden", 403);

    const limitError = enforceAuditLimit(typedProfile);
    if (limitError) return errorResponse(limitError, 403);

    const websiteSignals = typedLead.website ? await fetchWebsiteSignals(typedLead.website) : emptyWebsiteSignals("", "not_provided", "No website URL was provided.");
    const websiteSignalNote = websiteSignals.fetchStatus === "success"
      ? "Real website HTML was fetched successfully. Use these extracted signals as evidence for technical SEO and conversion observations."
      : `Website HTML could not be fetched (${websiteSignals.failureReason ?? "unknown reason"}). Generate the audit using the business info and do not invent technical website issues.`;

    const prompt = `You are a digital marketing expert auditing a local business website for an agency doing outreach to local businesses. Analyze this business and generate a realistic website audit.\n\nBusiness: ${typedLead.business_name}\nIndustry: ${typedLead.industry}\nLocation: ${typedLead.location}\nWebsite: ${typedLead.website || "no website"}\nGoogle Rating: ${typedLead.google_rating ?? "unknown"} (${typedLead.reviews_count} reviews)\n\nWebsite HTML signal note: ${websiteSignalNote}\nExtracted website signals:\n${JSON.stringify(websiteSignals, null, 2)}\n\nInstructions:\n- Use the real extracted website signals when available.\n- Make main_issues specific, practical, and useful for agency outreach.\n- Mention issues like missing H1, weak/missing meta description, no clear CTA, missing mobile viewport, weak title, or outdated structure only when supported by the extracted signals.\n- Do not invent technical issues if website signals are unavailable.\n- Keep the JSON keys and value types exactly as requested.\n\nReturn a JSON object (no markdown, just raw JSON) with this exact structure:\n{\n  "website_score": <0-100 integer>,\n  "seo_score": <0-100 integer>,\n  "conversion_score": <0-100 integer>,\n  "lead_score": <0-100 integer>,\n  "main_issues": ["issue 1", "issue 2", "issue 3", "issue 4"],\n  "recommended_offer": "<specific service you should pitch to this business>",\n  "personalization_angle": "<unique angle to use when reaching out>",\n  "summary": "<2-3 sentence summary of why this is a good or bad lead>"\n}`;
    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiApiKey}` }, body: JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "user", content: prompt }], temperature: 0.7, max_tokens: 700 }) });
    if (!openaiRes.ok) { const errData = await openaiRes.json().catch(() => ({})); return errorResponse((errData as { error?: { message?: string } }).error?.message ?? `OpenAI error (${openaiRes.status})`, 502); }
    const completion = await openaiRes.json() as { choices: Array<{ message: { content: string } }> };
    const parsed = JSON.parse(cleanJson(completion.choices[0]?.message?.content ?? "")) as AuditPayload;
    const auditValues = { lead_id, website_score: parsed.website_score, seo_score: parsed.seo_score, conversion_score: parsed.conversion_score, main_issues: parsed.main_issues, recommended_offer: parsed.recommended_offer, personalization_angle: parsed.personalization_angle, summary: parsed.summary };
    const { data: existingAudit } = await serviceClient.from("lead_audits").select("id").eq("lead_id", lead_id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    const auditWrite = existingAudit ? await serviceClient.from("lead_audits").update(auditValues).eq("id", existingAudit.id).select("*").single() : await serviceClient.from("lead_audits").insert(auditValues).select("*").single();
    if (auditWrite.error) return errorResponse(`Failed to save audit: ${auditWrite.error.message}`, 500);
    const { error: leadUpdateError } = await serviceClient.from("leads").update({ lead_score: parsed.lead_score, status: "Audited" }).eq("id", lead_id);
    if (leadUpdateError) return errorResponse(`Failed to update lead: ${leadUpdateError.message}`, 500);
    if (!isAdmin(typedProfile)) {
      const { error: usageError } = await serviceClient.from("user_profiles").update({ audits_used_this_month: typedProfile.audits_used_this_month + 1, updated_at: new Date().toISOString() }).eq("id", user.id);
      if (usageError) return errorResponse(`Failed to update usage: ${usageError.message}`, 500);
    }
    return jsonResponse({ audit: auditWrite.data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to analyze lead.";
    return errorResponse(message, 500);
  }
});
