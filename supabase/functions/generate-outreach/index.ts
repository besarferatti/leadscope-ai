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
type SenderIdentity = { name: string; position: string; agencyName: string; agencyWebsite: string; email: string; phone: string };
type Lead = { id: string; user_id: string; business_name: string; industry: string; location: string; website: string; google_rating: number | null; reviews_count: number };
type Audit = { website_score: number; seo_score: number; conversion_score: number; main_issues: string[]; recommended_offer: string; personalization_angle: string };
type OutreachPayload = { subject: string; body: string };

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
    sender.email,
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
    [/\[Your Email Address\]/gi, sender.email],
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
  if (limit !== -1 && profile.messages_used_this_month >= limit) return "You've reached your monthly outreach message limit. Upgrade your plan to generate more personalized messages.";
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

    const body = await req.json() as { lead_id?: string; channel?: "email" | "dm"; language?: string; tone?: string };
    const { lead_id, channel, language, tone } = body;
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
      email: compact(typedProfile.email) || compact(user.email),
      phone: "",
    };
    console.log("Outreach sender settings loaded", {
      hasName: Boolean(sender.name),
      hasAgencyName: Boolean(sender.agencyName),
      hasWebsite: Boolean(sender.agencyWebsite),
      hasEmail: Boolean(sender.email),
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
    const auditContext = typedAudit ? `Website audit: website score ${typedAudit.website_score}/100, SEO score ${typedAudit.seo_score}/100, conversion score ${typedAudit.conversion_score}/100. Main issues: ${typedAudit.main_issues.join(", ")}. Recommended offer: ${typedAudit.recommended_offer}. Personalization angle: ${typedAudit.personalization_angle}.` : "";
    const senderContext = `Sender information for the signature:
Name: ${sender.name || "missing"}
Position: ${sender.position || "missing"}
Agency name: ${sender.agencyName || "missing"}
Agency website: ${sender.agencyWebsite || "missing"}
Phone: ${sender.phone || "missing"}
Email: ${sender.email || "missing"}`;
    const prompt = `You are a ${tone.toLowerCase()} outreach specialist for a digital marketing agency. Write a highly personalized cold ${channel} in ${language} for this prospect.

Business: ${typedLead.business_name}
Industry: ${typedLead.industry}
Location: ${typedLead.location}
Website: ${typedLead.website || "no website"}
Google Rating: ${typedLead.google_rating ?? "unknown"} (${typedLead.reviews_count} reviews)
${auditContext}

${senderContext}

Use the sender information in the signature. Do not use placeholder text. Do not write [Your Name], [Your Agency's Name], [Your Agency Name], [Your Position], [Your Phone Number], or [Your Email Address]. If a sender field is missing, omit that line instead of using a placeholder.

${channel === "email" ? "Write a cold email with a compelling subject line." : "Write a short DM (max 5 sentences)."}

Return raw JSON only (no markdown):
{
  "subject": "<subject line${channel === "dm" ? " (use empty string for DM)" : ""}>",
  "body": "<${channel === "email" ? "full email body with greeting, value proposition, soft CTA, and sign-off using only available sender information" : "short DM message ending with a sign-off using only available sender information"}>"
}`;
    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiApiKey}` }, body: JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "user", content: prompt }], temperature: 0.8, max_tokens: 800 }) });
    if (!openaiRes.ok) { const errData = await openaiRes.json().catch(() => ({})); return errorResponse((errData as { error?: { message?: string } }).error?.message ?? `OpenAI error (${openaiRes.status})`, 502); }
    const completion = await openaiRes.json() as { choices: Array<{ message: { content: string } }> };
    const parsed = JSON.parse(cleanJson(completion.choices[0]?.message?.content ?? "")) as OutreachPayload;
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
