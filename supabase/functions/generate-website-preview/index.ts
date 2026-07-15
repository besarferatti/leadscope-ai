import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type UserProfile = { id: string; role: "admin" | "user" };
type Lead = { id: string; user_id: string; business_name: string; industry: string; location: string; website: string };
type Audit = {
  summary: string | null;
  main_issues: string[] | null;
  recommended_offer: string | null;
  seo_content_pack?: {
    meta_title?: string;
    homepage_copy?: { headline?: string; subheadline?: string; cta?: string };
    recommended_service?: { service_name?: string; why_sell_this?: string; deliverables?: string[] };
    google_business_posts?: string[];
  } | null;
};

type WebsitePreviewData = {
  business_name: string;
  industry: string;
  location: string;
  website: string;
  meta_title: string;
  hero_headline: string;
  subheadline: string;
  cta_text: string;
  services: Array<{ title: string; description: string }>;
  why_choose_us: string[];
  about_intro: string;
  contact: { headline: string; body: string; website: string; location: string };
  local_seo_angle?: string;
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function errorResponse(message: string, status = 400) { return jsonResponse({ error: message }, status); }
function cleanJson(content: string) { return content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim(); }
function createPreviewToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}
function asStringArray(value: unknown, fallback: string[] = []) {
  if (!Array.isArray(value)) return fallback;
  return value.filter((item): item is string => typeof item === "string");
}
function asServices(value: unknown, fallback: WebsitePreviewData["services"]) {
  if (!Array.isArray(value)) return fallback;
  const services = value
    .filter((item): item is Record<string, unknown> => item !== null && typeof item === "object" && !Array.isArray(item))
    .map((item) => ({ title: asString(item.title), description: asString(item.description) }))
    .filter((item) => item.title || item.description);
  return services.length > 0 ? services : fallback;
}
function asContact(value: unknown, fallback: WebsitePreviewData["contact"]) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return fallback;
  const contact = value as Record<string, unknown>;
  return {
    headline: asString(contact.headline, fallback.headline),
    body: asString(contact.body, fallback.body),
    website: asString(contact.website, fallback.website),
    location: asString(contact.location, fallback.location),
  };
}
function sanitizePreviewData(value: unknown, fallback: WebsitePreviewData): WebsitePreviewData {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return fallback;
  const candidate = value as Record<string, unknown>;
  return {
    business_name: asString(candidate.business_name, fallback.business_name),
    industry: asString(candidate.industry, fallback.industry),
    location: asString(candidate.location, fallback.location),
    website: asString(candidate.website, fallback.website),
    meta_title: asString(candidate.meta_title, fallback.meta_title),
    hero_headline: asString(candidate.hero_headline, fallback.hero_headline),
    subheadline: asString(candidate.subheadline, fallback.subheadline),
    cta_text: asString(candidate.cta_text, fallback.cta_text),
    services: asServices(candidate.services, fallback.services),
    why_choose_us: asStringArray(candidate.why_choose_us, fallback.why_choose_us),
    about_intro: asString(candidate.about_intro, fallback.about_intro),
    contact: asContact(candidate.contact, fallback.contact),
    local_seo_angle: asString(candidate.local_seo_angle, fallback.local_seo_angle),
  };
}

function fallbackPreview(lead: Lead, audit: Audit | null): WebsitePreviewData {
  const homepage = audit?.seo_content_pack?.homepage_copy;
  const service = audit?.seo_content_pack?.recommended_service;
  const primaryService = service?.service_name || audit?.recommended_offer || `${lead.industry || "Local"} Services`;
  return {
    business_name: lead.business_name,
    industry: lead.industry,
    location: lead.location,
    website: lead.website,
    meta_title: audit?.seo_content_pack?.meta_title || `${lead.business_name} | ${lead.industry || "Local Services"}${lead.location ? ` in ${lead.location}` : ""}`,
    hero_headline: homepage?.headline || `Modern ${lead.industry || "local"} solutions for ${lead.business_name}`,
    subheadline: homepage?.subheadline || `A polished one-page website concept built to help ${lead.business_name} earn trust, highlight services, and turn visitors into leads${lead.location ? ` in ${lead.location}` : ""}.`,
    cta_text: homepage?.cta || "Request a Free Quote",
    services: [
      { title: primaryService, description: service?.why_sell_this || "Showcase the core service customers are most likely to search for and request." },
      ...(service?.deliverables || []).slice(0, 2).map((item) => ({ title: item, description: "Presented as a clear, conversion-focused service benefit for visitors." })),
    ],
    why_choose_us: ["Clear calls to action", "Local search friendly content", "Simple trust-building page structure"],
    about_intro: audit?.summary || `${lead.business_name} can use this page to explain its expertise, service area, and customer-first approach in a concise way.`,
    contact: { headline: `Contact ${lead.business_name}`, body: "Ready to learn more? Use the website or local listing details to request service information.", website: lead.website, location: lead.location },
    local_seo_angle: lead.location ? `Position the page around ${lead.industry || "services"} in ${lead.location} and support it with Google Business updates.` : "Support the page with Google Business updates and service-area keywords.",
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return errorResponse("Missing Authorization Bearer token", 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return errorResponse("Unauthorized", 401);

    const { lead_id } = await req.json() as { lead_id?: string };
    if (!lead_id) return errorResponse("lead_id is required");

    const { data: profile, error: profileError } = await serviceClient.from("user_profiles").select("id, role").eq("id", user.id).maybeSingle();
    if (profileError || !profile) return errorResponse("User profile not found", 404);

    const { data: lead, error: leadError } = await serviceClient.from("leads").select("id, user_id, business_name, industry, location, website").eq("id", lead_id).maybeSingle();
    if (leadError || !lead) return errorResponse("Lead not found", 404);
    const typedLead = lead as Lead;
    if ((profile as UserProfile).role !== "admin" && typedLead.user_id !== user.id) return errorResponse("Forbidden", 403);

    const { data: audit } = await serviceClient.from("lead_audits").select("summary, main_issues, recommended_offer, seo_content_pack").eq("lead_id", lead_id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    const typedAudit = audit as Audit | null;
    let previewData = fallbackPreview(typedLead, typedAudit);

    const openaiApiKey = Deno.env.get("OPENAI_API_KEY")?.trim();
    if (openaiApiKey) {
      const prompt = `Create a concise one-page website preview JSON for this local business. Do not include pricing, internal IDs, account data, billing data, API keys, or admin data.\n\nBusiness: ${typedLead.business_name}\nIndustry: ${typedLead.industry}\nLocation: ${typedLead.location}\nWebsite: ${typedLead.website || "none"}\nAudit summary: ${typedAudit?.summary || "none"}\nMain issues: ${(typedAudit?.main_issues || []).join(", ") || "none"}\nRecommended service/offer: ${typedAudit?.seo_content_pack?.recommended_service?.service_name || typedAudit?.recommended_offer || "none"}\nHomepage copy: ${JSON.stringify(typedAudit?.seo_content_pack?.homepage_copy || {})}\nGoogle Business/local SEO ideas: ${(typedAudit?.seo_content_pack?.google_business_posts || []).join(" | ") || "none"}\n\nReturn raw JSON only with this shape: ${JSON.stringify(previewData)}`;
      const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiApiKey}` },
        body: JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "user", content: prompt }], temperature: 0.7, max_tokens: 1200 }),
      });
      if (openaiRes.ok) {
        const completion = await openaiRes.json() as { choices: Array<{ message: { content: string } }> };
        try {
          const aiPreview = JSON.parse(cleanJson(completion.choices[0]?.message?.content ?? "{}"));
          previewData = sanitizePreviewData({ ...previewData, ...aiPreview }, previewData);
        } catch {
          // Keep the deterministic fallback rather than failing to create the preview.
        }
      }
    }

    previewData = sanitizePreviewData(previewData, fallbackPreview(typedLead, typedAudit));

    const preview_token = createPreviewToken();
    const { data: saved, error: insertError } = await serviceClient.from("website_previews").insert({ lead_id, user_id: user.id, preview_token, preview_data: previewData }).select("preview_token, preview_data, created_at").single();
    if (insertError) return errorResponse(`Failed to save website preview: ${insertError.message}`, 500);
    return jsonResponse({ preview: saved });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to generate website preview.";
    return errorResponse(message, 500);
  }
});
