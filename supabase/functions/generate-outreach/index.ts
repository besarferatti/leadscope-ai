import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function errorResponse(message: string, status = 400) { return jsonResponse({ error: message }, status); }
function isAdmin(profile: { role?: string } | null) { return profile?.role === "admin"; }
function messageLimit(plan: string | null | undefined) {
  switch (plan) {
    case "starter": return 100;
    case "pro": return 500;
    case "agency": return 2000;
    case "enterprise": return -1;
    case "admin_unlimited": return -1;
    case "free_trial":
    default: return 25;
  }
}

async function callOpenAI(prompt: string) {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new Error("OpenAI is not configured on the server.");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "user", content: prompt }], temperature: 0.8, max_tokens: 800 }),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error((errData as { error?: { message?: string } }).error?.message ?? `OpenAI error (${res.status})`);
  }
  const data = await res.json() as { choices: Array<{ message: { content: string } }> };
  const content = data.choices[0]?.message?.content ?? "";
  return JSON.parse(content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim()) as { subject: string; body: string };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return errorResponse("Missing Authorization header", 401);
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return errorResponse("Unauthorized", 401);

    const body = await req.json() as { lead_id?: string; channel?: "email" | "dm"; language?: string; tone?: string };
    const leadId = body.lead_id;
    if (!leadId) return errorResponse("lead_id is required");
    const channel = body.channel ?? "email";
    const language = body.language ?? "English";
    const tone = body.tone ?? "Professional";

    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("role,current_plan,messages_used_this_month,is_active")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError || !profile) return errorResponse("Unable to load account profile", 500);
    if (!profile.is_active) return errorResponse("Your account is inactive. Please contact support.", 403);
    if (!isAdmin(profile)) {
      const limit = messageLimit(profile.current_plan);
      if (limit !== -1 && (profile.messages_used_this_month ?? 0) >= limit) {
        return errorResponse("You've reached your monthly outreach message limit. Upgrade your plan to generate more personalized messages.", 402);
      }
    }

    const { data: lead, error: leadError } = await supabase.from("leads").select("*").eq("id", leadId).eq("user_id", user.id).maybeSingle();
    if (leadError || !lead) return errorResponse("Lead not found", 404);
    const { data: audit } = await supabase.from("lead_audits").select("*").eq("lead_id", leadId).order("created_at", { ascending: false }).limit(1).maybeSingle();

    const auditContext = audit
      ? `Website audit: website score ${audit.website_score}/100, SEO score ${audit.seo_score}/100, conversion score ${audit.conversion_score}/100. Main issues: ${audit.main_issues.join(", ")}. Recommended offer: ${audit.recommended_offer}. Personalization angle: ${audit.personalization_angle}.`
      : "";
    const prompt = `You are a ${tone.toLowerCase()} outreach specialist for a digital marketing agency. Write a highly personalized cold ${channel} in ${language} for this prospect.

Business: ${lead.business_name}
Industry: ${lead.industry}
Location: ${lead.location}
Website: ${lead.website || "no website"}
Google Rating: ${lead.google_rating ?? "unknown"} (${lead.reviews_count} reviews)
${auditContext}

${channel === "email" ? "Write a cold email with a compelling subject line." : "Write a short DM (max 5 sentences)."}

Return raw JSON only (no markdown):
{
  "subject": "<subject line${channel === "dm" ? " (use empty string for DM)" : ""}>",
  "body": "<${channel === "email" ? "full email body with greeting, value proposition, soft CTA, and sign-off" : "short DM message"}>"
}`;

    const parsed = await callOpenAI(prompt);
    const { data: inserted, error: insertError } = await supabase
      .from("outreach_messages")
      .insert({ lead_id: leadId, channel, language, tone, subject: parsed.subject, body: parsed.body })
      .select("*")
      .maybeSingle();
    if (insertError) return errorResponse(`Failed to save message: ${insertError.message}`, 500);

    await supabase.from("leads").update({ status: "Message Generated" }).eq("id", leadId).eq("user_id", user.id);
    if (!isAdmin(profile)) {
      await supabase
        .from("user_profiles")
        .update({ messages_used_this_month: (profile.messages_used_this_month ?? 0) + 1, updated_at: new Date().toISOString() })
        .eq("id", user.id);
    }
    return jsonResponse({ message: inserted });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate message.";
    return errorResponse(message, 500);
  }
});
