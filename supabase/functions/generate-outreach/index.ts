import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type PlanId = "free_trial" | "starter" | "pro" | "agency" | "enterprise" | "admin_unlimited";
type UserProfile = { id: string; email: string; full_name: string; role: "admin" | "user"; current_plan: PlanId; trial_ends_at: string; messages_used_this_month: number; is_active: boolean };
type UserSettings = { id: string; agency_name: string | null; agency_website: string | null };
type SenderIdentity = { name: string; position: string; agencyName: string; agencyWebsite: string; phone: string };
type Lead = { id: string; user_id: string; business_name: string; industry: string; location: string; website: string; google_rating: number | null; reviews_count: number };
type Audit = { website_score: number; seo_score: number; conversion_score: number; main_issues: string[]; recommended_offer: string; personalization_angle: string };
type OutreachPayload = { subject: string; body: string };
type OutreachStyle = "natural_helpful" | "direct_concise" | "founder_to_founder";

const messageLimits: Record<PlanId, number> = { free_trial: 25, starter: 100, pro: 500, agency: 2000, enterprise: -1, admin_unlimited: -1 };

function jsonResponse(data: unknown, status = 200) { return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
function errorResponse(message: string, status = 400) { return jsonResponse({ error: message }, status); }
function isAdmin(profile: UserProfile) { return profile.role === "admin"; }
function cleanJson(content: string) { return content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim(); }
function compact(value: unknown) { return typeof value === "string" ? value.trim() : ""; }
function buildSignature(sender: SenderIdentity) {
  const signatureLines = [
    "Best regards,",
    sender.name,
    sender.position,
    sender.agencyName,
    sender.agencyWebsite,
    sender.phone,
  ].filter(Boolean);
  return signatureLines.join("\n");
}
function removePlaceholderLines(message: string) {
  return message
    .split("\n")
    .filter((line) => !/^\s*(?:best regards,?\s*)?(?:\[Your (?:Name|Agency(?:'s)? Name|Position|Phone Number|Email Address)\])\s*$/i.test(line))
    .join("\n");
}
function applySenderIdentity(message: string, sender: SenderIdentity, ensureSignature = true) {
  const replacements: Array<[RegExp, string]> = [
    [/\[Your Name\]/gi, sender.name],
    [/\[Your Agency's Name\]/gi, sender.agencyName],
    [/\[Your Agency Name\]/gi, sender.agencyName],
    [/\[Your Position\]/gi, sender.position],
    [/\[Your Phone Number\]/gi, sender.phone],
    [/\[Your Email Address\]/gi, ""],
  ];
  let cleaned = message;
  for (const [pattern, value] of replacements) {
    cleaned = value ? cleaned.replace(pattern, value) : cleaned.replace(pattern, "");
  }
  cleaned = removePlaceholderLines(cleaned)
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const signature = buildSignature(sender);
  if (!ensureSignature || !signature) return cleaned;

  const signOffIndex = cleaned.search(/(?:^|\n)\s*(Best regards|Regards|Sincerely|Thanks|Thank you),?\s*$/im);
  if (signOffIndex >= 0) {
    cleaned = cleaned.slice(0, signOffIndex).trim();
  }

  return `${cleaned}\n\n${signature}`.trim();
}
function enforceMessageLimit(profile: UserProfile): string | null {
  if (isAdmin(profile)) return null;
  if (!profile.is_active) return "Your account is inactive. Please contact support.";
  if (profile.current_plan === "free_trial" && new Date(profile.trial_ends_at) < new Date()) return "Your free trial has ended. Upgrade your plan to continue using LeadScope AI.";
  const limit = messageLimits[profile.current_plan] ?? messageLimits.free_trial;
  if (limit !== -1 && profile.messages_used_this_month >= limit) return profile.current_plan === "free_trial" ? "You’ve reached your free trial limit of 25 outreach messages. Upgrade to continue." : "You've reached your monthly outreach message limit. Upgrade your plan to generate more personalized messages.";
  return null;
}

const bannedOpenings = [
  "i came across your website",
  "i was browsing your website",
  "i hope this email finds you well",
  "i noticed your business",
];

function styleInstructions(style: OutreachStyle) {
  if (style === "direct_concise") return "Be direct and economical. Lead with the concrete observation, explain one business consequence, then ask one short question. Avoid warm-up language.";
  if (style === "founder_to_founder") return "Write peer-to-peer, like one business owner sharing a useful observation with another. Be candid, calm, and practical; never sound like a salesperson or pretend you know them personally.";
  return "Sound warm, observant, and helpful. Connect one real observation to a practical improvement without pressure or exaggerated praise.";
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

    const body = await req.json() as { lead_id?: string; channel?: "email" | "dm"; language?: string; tone?: string; style?: OutreachStyle };
    const { lead_id, channel, language, tone } = body;
    const style: OutreachStyle = ["natural_helpful", "direct_concise", "founder_to_founder"].includes(body.style ?? "") ? body.style! : "natural_helpful";
    if (!lead_id || !channel || !language || !tone) return errorResponse("lead_id, channel, language, and tone are required");
    if (channel !== "email" && channel !== "dm") return errorResponse("channel must be either email or dm");

    const { data: profile, error: profileError } = await serviceClient.from("user_profiles").select("id, email, full_name, role, current_plan, trial_ends_at, messages_used_this_month, is_active").eq("id", user.id).maybeSingle();
    if (profileError || !profile) return errorResponse("User profile not found", 404);
    const typedProfile = profile as UserProfile;

    const { data: settings } = await serviceClient.from("user_settings").select("id, agency_name, agency_website").eq("id", user.id).maybeSingle();
    const typedSettings = settings as UserSettings | null;
    const sender: SenderIdentity = {
      name: compact(typedProfile.full_name),
      position: "",
      agencyName: compact(typedSettings?.agency_name),
      agencyWebsite: compact(typedSettings?.agency_website),
      phone: "",
    };
    console.log("Outreach sender settings loaded", {
      hasName: Boolean(sender.name),
      hasAgencyName: Boolean(sender.agencyName),
      hasWebsite: Boolean(sender.agencyWebsite),
      hasPhone: Boolean(sender.phone),
    });

    const { data: lead, error: leadError } = await serviceClient.from("leads").select("id, user_id, business_name, industry, location, website, google_rating, reviews_count").eq("id", lead_id).maybeSingle();
    if (leadError || !lead) return errorResponse("Lead not found", 404);
    const typedLead = lead as Lead;
    if (!isAdmin(typedProfile) && typedLead.user_id !== user.id) return errorResponse("Forbidden", 403);

    const limitError = enforceMessageLimit(typedProfile);
    if (limitError) return errorResponse(limitError, 403);

    const { data: audit } = await serviceClient.from("lead_audits").select("website_score, seo_score, conversion_score, main_issues, recommended_offer, personalization_angle").eq("lead_id", lead_id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    const typedAudit = audit as Audit | null;
    const auditContext = typedAudit ? `Verified audit evidence: website score ${typedAudit.website_score}/100, SEO score ${typedAudit.seo_score}/100, conversion score ${typedAudit.conversion_score}/100. Main issues: ${typedAudit.main_issues.join(", ")}. Recommended offer: ${typedAudit.recommended_offer}. Personalization angle: ${typedAudit.personalization_angle}.` : "No website audit is available. Do not imply that you visited, reviewed, browsed, or analyzed the website.";
    const senderContext = `Sender information for the signature:
Name: ${sender.name || "missing"}
Position: ${sender.position || "missing"}
Agency name: ${sender.agencyName || "missing"}
Agency website: ${sender.agencyWebsite || "missing"}
Phone: ${sender.phone || "missing"}`;
    const prompt = `You write concise, genuinely human cold outreach for a digital agency. Write a ${tone.toLowerCase()} ${channel} in ${language} for this prospect.

Prospect:
- Business: ${typedLead.business_name}
- Industry: ${typedLead.industry}
- Location: ${typedLead.location}
- Website: ${typedLead.website || "no website"}
- Google rating: ${typedLead.google_rating ?? "unknown"} (${typedLead.reviews_count} reviews)
${auditContext}

${senderContext}

Rules:
- Style: ${styleInstructions(style)}
- Sound like a real person, never like an AI-generated sales template.
- Use only facts supplied above. Never invent a technical problem, result, relationship, compliment, or claim.
- Build the message around ONE specific, high-confidence observation. Prefer, in order: a supported audit issue; no website; a supported missing CTA/booking/contact path; a local SEO opportunity. Use rating/review count only when it naturally supports the point.
- If no audit exists, use only directory facts such as business type, location, website availability, rating, and review count. Never pretend the website was reviewed.
- Do not dump audit findings, scores, technical checklists, pricing, deliverables, or a full proposal.
- Focus on the business outcome, not technical jargon.
- Never open with or use: "I came across your website", "I was browsing your website", "I hope this email finds you well", or "I noticed your business".
- Do not use fake compliments, generic praise, or phrases such as "impressive online presence".
- Open directly with the concrete observation or the context in which the business was found. Vary sentence structure naturally.
- Use one clear offer and ONE low-friction CTA.
- Do not promise results.
- Use the sender information in the signature. Never use placeholders. Omit missing sender fields.
- No markdown, bold text, numbered lists, or bullet lists in the message.

${channel === "email"
  ? "Email requirements: 70-120 words before the signature, 3-5 short paragraphs, subject line of 3-7 words, and exactly one question."
  : "DM requirements: 35-65 words before the sign-off, maximum 4 short sentences, empty subject, and exactly one question."}

Return raw JSON only (no markdown):
{
  "subject": "<${channel === "dm" ? "empty string" : "short specific subject"}>",
  "body": "<concise personalized message and sign-off using only available sender information>"
}`;
    async function generate(extraInstruction = "") {
      const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiApiKey}` }, body: JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "user", content: `${prompt}${extraInstruction}` }], temperature: 0.65, max_tokens: 450, response_format: { type: "json_object" } }) });
      if (!openaiRes.ok) { const errData = await openaiRes.json().catch(() => ({})); throw new Error((errData as { error?: { message?: string } }).error?.message ?? `OpenAI error (${openaiRes.status})`); }
      const completion = await openaiRes.json() as { choices: Array<{ message: { content: string } }> };
      return JSON.parse(cleanJson(completion.choices[0]?.message?.content ?? "")) as OutreachPayload;
    }
    let parsed = await generate();
    if (bannedOpenings.some(opening => (parsed.body ?? "").toLowerCase().includes(opening))) {
      parsed = await generate("\nYour previous draft used a banned generic phrase. Rewrite with a specific, evidence-based opening and obey every banned-phrase rule.");
    }
    const sanitizedBody = applySenderIdentity(parsed.body ?? "", sender);
    const sanitizedSubject = applySenderIdentity(parsed.subject ?? "", sender, false).replace(/\n+/g, " ").trim();
    const { data: message, error: insertError } = await serviceClient.from("outreach_messages").insert({ lead_id, channel, language, tone, subject: sanitizedSubject, body: sanitizedBody }).select("*").single();
    if (insertError) return errorResponse(`Failed to save outreach message: ${insertError.message}`, 500);
    const { error: leadUpdateError } = await serviceClient.from("leads").update({ status: "Message Generated" }).eq("id", lead_id);
    if (leadUpdateError) return errorResponse(`Failed to update lead: ${leadUpdateError.message}`, 500);
    if (!isAdmin(typedProfile)) {
      const { error: usageError } = await serviceClient.from("user_profiles").update({ messages_used_this_month: typedProfile.messages_used_this_month + 1, updated_at: new Date().toISOString() }).eq("id", user.id);
      if (usageError) return errorResponse(`Failed to update usage: ${usageError.message}`, 500);
    }
    return jsonResponse({ message });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to generate outreach message.";
    return errorResponse(message, 500);
  }
});
