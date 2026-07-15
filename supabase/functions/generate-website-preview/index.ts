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
    suggested_keywords?: { primary?: string[]; local?: string[]; service?: string[]; long_tail?: string[] };
    recommended_service?: { service_name?: string; why_sell_this?: string; deliverables?: string[] };
    service_page_ideas?: string[];
    blog_post_ideas?: string[];
    google_business_posts?: string[];
  } | null;
};

type VisualTheme = {
  industry_style: string;
  hero_visual_title: string;
  hero_visual_description: string;
  image_keywords: string[];
  gallery_cards: Array<{ title: string; description: string }>;
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
  visual_theme: VisualTheme;
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

function asGalleryCards(value: unknown, fallback: VisualTheme["gallery_cards"]) {
  if (!Array.isArray(value)) return fallback;
  const cards = value
    .filter((item): item is Record<string, unknown> => item !== null && typeof item === "object" && !Array.isArray(item))
    .map((item) => ({ title: asString(item.title), description: asString(item.description) }))
    .filter((item) => item.title || item.description);
  return cards.length > 0 ? cards.slice(0, 4) : fallback;
}
function asVisualTheme(value: unknown, fallback: VisualTheme): VisualTheme {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return fallback;
  const theme = value as Record<string, unknown>;
  return {
    industry_style: asString(theme.industry_style, fallback.industry_style),
    hero_visual_title: asString(theme.hero_visual_title, fallback.hero_visual_title),
    hero_visual_description: asString(theme.hero_visual_description, fallback.hero_visual_description),
    image_keywords: asStringArray(theme.image_keywords, fallback.image_keywords).slice(0, 8),
    gallery_cards: asGalleryCards(theme.gallery_cards, fallback.gallery_cards),
  };
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
    visual_theme: asVisualTheme(candidate.visual_theme, fallback.visual_theme),
  };
}

function matchesIndustry(industry: string, words: string[]) {
  const normalized = industry.toLowerCase();
  return words.some((word) => normalized.includes(word));
}

function getIndustryWebsiteContent(industry: string, location: string) {
  const place = location ? ` in ${location}` : "";
  if (matchesIndustry(industry, ["dental", "dentist", "orthodont", "clinic"])) {
    return {
      services: [
        { title: "General Dentistry", description: "Comprehensive exams, fillings, and everyday care for healthy, confident smiles." },
        { title: "Cosmetic Dentistry", description: "Modern whitening, bonding, and smile-enhancing treatments tailored to each patient." },
        { title: "Preventive Care", description: "Cleanings, screenings, and guidance designed to protect long-term oral health." },
        { title: "Emergency Dental Care", description: "Prompt support for urgent tooth pain, broken teeth, and unexpected dental concerns." },
      ],
      cta: "Book an Appointment",
      style: "Clean clinic interior, smiling patient, bright modern healthcare look",
      gallery: [
        { title: "Calm Treatment Rooms", description: "Bright, comfortable spaces designed to help patients feel at ease." },
        { title: "Patient-First Care", description: "Clear explanations and supportive guidance before every treatment." },
        { title: "Modern Smile Services", description: "Preventive and cosmetic options presented with a polished clinical feel." },
      ],
      hero: `Comfortable dental care for healthier smiles${place}`,
    };
  }
  if (matchesIndustry(industry, ["restaurant", "cafe", "coffee", "food", "bar", "bistro"])) {
    return { services: [
      { title: "Signature Menu", description: "Guest-favorite dishes crafted with flavor, presentation, and consistency in mind." },
      { title: "Fresh Daily Specials", description: "Seasonal plates and rotating features that give guests a reason to return." },
      { title: "Private Events", description: "Welcoming dining experiences for celebrations, team meals, and special occasions." },
      { title: "Takeaway & Reservations", description: "Easy options for planning ahead, dining in, or enjoying favorites at home." },
    ], cta: "Reserve a Table", style: "Warm dining atmosphere, food photography, elegant menu cards", gallery: [
      { title: "Signature Plates", description: "Rich food-focused cards that showcase the menu experience." },
      { title: "Warm Dining Room", description: "Inviting interiors that make visitors picture their next meal." },
      { title: "Seasonal Features", description: "Elegant blocks for specials, events, and fresh daily highlights." },
    ], hero: `Memorable dining and fresh flavors${place}` };
  }
  if (matchesIndustry(industry, ["construction", "contractor", "remodel", "renovation", "builder", "roofing", "plumb", "electric"])) {
    return { services: [
      { title: "Residential Construction", description: "Well-managed builds with clear communication from planning through completion." },
      { title: "Renovations & Remodeling", description: "Thoughtful updates that improve comfort, function, and long-term property value." },
      { title: "Repairs & Maintenance", description: "Reliable fixes and upkeep handled with practical expertise and care." },
      { title: "Project Planning", description: "Straightforward scopes, timelines, and recommendations before work begins." },
    ], cta: "Request a Free Quote", style: "Modern project photos, tools, before/after project blocks", gallery: [
      { title: "Finished Projects", description: "Portfolio-style cards for completed work and craftsmanship details." },
      { title: "Before & After", description: "Visual blocks that make transformations easy to understand." },
      { title: "On-Site Precision", description: "Clean, professional project imagery with tools and materials." },
    ], hero: `Quality projects built with care${place}` };
  }
  if (matchesIndustry(industry, ["salon", "beauty", "spa", "hair", "barber", "nail", "esthetic"])) {
    return { services: [
      { title: "Hair Styling", description: "Cuts, color, and styling designed around each guest’s look and lifestyle." },
      { title: "Beauty Treatments", description: "Polished services that help clients feel refreshed, confident, and cared for." },
      { title: "Bridal & Event Looks", description: "Special-occasion styling with a refined, photo-ready finish." },
      { title: "Personalized Consultations", description: "Friendly recommendations that make every visit feel tailored and relaxed." },
    ], cta: "Book Your Visit", style: "Elegant salon, beauty closeups, soft luxury design", gallery: [
      { title: "Soft Luxury Studio", description: "Elegant interiors and beauty details with a premium editorial feel." },
      { title: "Signature Looks", description: "Cards for transformations, styling inspiration, and client-ready finishes." },
      { title: "Personal Consultations", description: "Warm visual prompts for one-on-one beauty guidance." },
    ], hero: `Polished beauty experiences made personal${place}` };
  }
  if (matchesIndustry(industry, ["auto", "mechanic", "vehicle", "car", "repair", "garage", "tire"])) {
    return { services: [
      { title: "Vehicle Diagnostics", description: "Clear answers for warning lights, performance concerns, and drivability issues." },
      { title: "Oil & Maintenance", description: "Routine service that helps vehicles stay reliable mile after mile." },
      { title: "Brake Repair", description: "Inspection and repair support for safer stopping and smoother driving." },
      { title: "Engine Service", description: "Practical mechanical care for complex issues and preventative repairs." },
    ], cta: "Schedule Service", style: "Modern garage, clean automotive cards, mechanical detail visuals", gallery: [
      { title: "Clean Service Bays", description: "Modern garage-inspired blocks that communicate precision and care." },
      { title: "Diagnostic Detail", description: "Mechanical closeups for inspections, repairs, and maintenance checks." },
      { title: "Ready for the Road", description: "Customer-friendly visuals focused on safety and reliability." },
    ], hero: `Reliable auto care that keeps you moving${place}` };
  }
  return {
    services: [
      { title: "Professional Services", description: "Reliable support tailored to the needs of local customers and clients." },
      { title: "Personalized Support", description: "Helpful guidance and clear next steps from first conversation to follow-up." },
      { title: "Local Expertise", description: "A practical understanding of the community and the service experience customers expect." },
      { title: "Customer Care", description: "Responsive communication and dependable service built around long-term trust." },
    ],
    cta: "Request a Consultation",
    style: "Premium local business visuals, polished cards, warm customer-focused design",
    gallery: [
      { title: "Welcoming Experience", description: "Premium visual cards that introduce the customer journey." },
      { title: "Trusted Local Team", description: "Professional placeholders for people, spaces, and service moments." },
      { title: "Quality in Detail", description: "Refined blocks that highlight care, process, and results." },
    ],
    hero: `Professional service with a personal touch${place}`,
  };
}

function fallbackPreview(lead: Lead, audit: Audit | null): WebsitePreviewData {
  const industryContent = getIndustryWebsiteContent(lead.industry || "", lead.location);
  const homepage = audit?.seo_content_pack?.homepage_copy;
  const homepageHeadline = homepage?.headline && !/seo|audit|leadscope|agency|package|optimization/i.test(homepage.headline) ? homepage.headline : industryContent.hero;
  const homepageSubheadline = homepage?.subheadline && !/seo|audit|leadscope|agency|package|optimization/i.test(homepage.subheadline) ? homepage.subheadline : `Welcome to ${lead.business_name}, a modern ${lead.industry || "local business"} experience built around trust, clarity, and customer care${lead.location ? ` in ${lead.location}` : ""}.`;
  return {
    business_name: lead.business_name,
    industry: lead.industry,
    location: lead.location,
    website: lead.website,
    meta_title: `${lead.business_name}${lead.location ? ` | ${lead.location}` : ""}`,
    hero_headline: homepageHeadline,
    subheadline: homepageSubheadline,
    cta_text: homepage?.cta && !/seo|audit|package|optimization/i.test(homepage.cta) ? homepage.cta : industryContent.cta,
    services: industryContent.services,
    why_choose_us: ["Friendly, customer-first communication", "Modern service experience", "Trusted local team", "Clear next steps from first contact"],
    about_intro: `${lead.business_name} helps customers feel confident from the first visit with attentive service, thoughtful recommendations, and a polished experience tailored to ${lead.industry || "local"} needs${lead.location ? ` in ${lead.location}` : ""}.`,
    contact: { headline: `Ready to get started with ${lead.business_name}?`, body: `Reach out today to ask a question or ${industryContent.cta.toLowerCase()}.`, website: lead.website, location: lead.location },
    visual_theme: {
      industry_style: industryContent.style,
      hero_visual_title: `${lead.industry || "Business"} experience`,
      hero_visual_description: industryContent.style,
      image_keywords: [lead.industry, lead.location, ...industryContent.services.map((service) => service.title)].filter(Boolean).slice(0, 8),
      gallery_cards: industryContent.gallery,
    },
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
      const prompt = `Create a modern, premium, client-facing one-page website preview for the business itself. This must feel like the lead's real public website concept, not a report or agency pitch. Do not include pricing, internal IDs, account data, billing data, API keys, admin data, or private strategy.

Business public inputs:
- business_name: ${typedLead.business_name}
- industry: ${typedLead.industry}
- location: ${typedLead.location}
- website: ${typedLead.website || "none"}

Hidden improvement context. Use this only to improve the customer-facing website concept; never expose audit, SEO, agency, strategy, package, or optimization language directly:
- audit summary: ${typedAudit?.summary || "none"}
- main issues: ${(typedAudit?.main_issues || []).join(", ") || "none"}
- homepage copy: ${JSON.stringify(typedAudit?.seo_content_pack?.homepage_copy || {})}
- suggested keywords: ${JSON.stringify(typedAudit?.seo_content_pack?.suggested_keywords || {})}
- service page ideas: ${(typedAudit?.seo_content_pack?.service_page_ideas || []).join(" | ") || "none"}
- blog/service ideas: ${(typedAudit?.seo_content_pack?.blog_post_ideas || []).join(" | ") || "none"}
- Google Business ideas: ${(typedAudit?.seo_content_pack?.google_business_posts || []).join(" | ") || "none"}
- internal agency recommended service to ignore as public service: ${typedAudit?.seo_content_pack?.recommended_service?.service_name || typedAudit?.recommended_offer || "none"}

Hard rules:
- Create services that the business sells to its own customers, specific to its industry.
- Do NOT create SEO services, SEO packages, technical SEO audit sections, content optimization services, a local SEO angle, audit language, LeadScope language, a meta title suggestion section, an AI website preview label, or internal agency pitch content.
- If the hidden context says weak CTA, write a stronger public CTA.
- If it mentions missing service pages, create better customer-facing service sections.
- If homepage headline/subheadline fits the business website, adapt it; otherwise write new customer-facing copy.
- If keyword suggestions fit naturally, use them in public headings/copy without mentioning keywords or SEO.
- Do not expose suggested_pricing or internal SEO strategy.

Return raw JSON only with this exact safe public shape and no extra keys: ${JSON.stringify(previewData)}`;
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
