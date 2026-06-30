import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(message: string, status = 400) {
  return jsonResponse({ error: message }, status);
}

function isAdmin(profile: { role?: string } | null) {
  return profile?.role === "admin";
}

function auditLimit(plan: string | null | undefined) {
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
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 700,
    }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const message = (errData as { error?: { message?: string } }).error?.message ?? `OpenAI error (${res.status})`;
    throw new Error(message);
  }

  const data = await res.json() as { choices: Array<{ message: { content: string } }> };
  const content = data.choices[0]?.message?.content ?? "";
  const cleaned = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  return JSON.parse(cleaned) as {
    website_score: number;
    seo_score: number;
    conversion_score: number;
    lead_score: number;
    main_issues: string[];
    recommended_offer: string;
    personalization_angle: string;
    summary: string;
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return errorResponse("Missing Authorization header", 401);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return errorResponse("Unauthorized", 401);

    const { lead_id } = await req.json() as { lead_id?: string };
    if (!lead_id) return errorResponse("lead_id is required");

    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("role,current_plan,audits_used_this_month,is_active")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError || !profile) return errorResponse("Unable to load account profile", 500);
    if (!profile.is_active) return errorResponse("Your account is inactive. Please contact support.", 403);

    if (!isAdmin(profile)) {
      const limit = auditLimit(profile.current_plan);
      if (limit !== -1 && (profile.audits_used_this_month ?? 0) >= limit) {
        return errorResponse("You've reached your monthly AI audit limit. Upgrade your plan to analyze more websites.", 402);
      }
    }

    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("*")
      .eq("id", lead_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (leadError || !lead) return errorResponse("Lead not found", 404);

    const prompt = `You are a digital marketing expert auditing a local business website. Analyze this business and generate a realistic website audit.

Business: ${lead.business_name}
Industry: ${lead.industry}
Location: ${lead.location}
Website: ${lead.website || "no website"}
Google Rating: ${lead.google_rating ?? "unknown"} (${lead.reviews_count} reviews)

Return a JSON object (no markdown, just raw JSON) with this exact structure:
{
  "website_score": <0-100 integer>,
  "seo_score": <0-100 integer>,
  "conversion_score": <0-100 integer>,
  "lead_score": <0-100 integer>,
  "main_issues": ["issue 1", "issue 2", "issue 3", "issue 4"],
  "recommended_offer": "<specific service you should pitch to this business>",
  "personalization_angle": "<unique angle to use when reaching out>",
  "summary": "<2-3 sentence summary of why this is a good or bad lead>"
}`;

    const parsed = await callOpenAI(prompt);

    const { data: existingAudit } = await supabase
      .from("lead_audits")
      .select("id")
      .eq("lead_id", lead_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const auditPayload = {
      lead_id,
      website_score: parsed.website_score,
      seo_score: parsed.seo_score,
      conversion_score: parsed.conversion_score,
      main_issues: parsed.main_issues,
      recommended_offer: parsed.recommended_offer,
      personalization_angle: parsed.personalization_angle,
      summary: parsed.summary,
    };

    if (existingAudit?.id) {
      const { error } = await supabase.from("lead_audits").update(auditPayload).eq("id", existingAudit.id);
      if (error) return errorResponse(`Failed to save audit: ${error.message}`, 500);
    } else {
      const { error } = await supabase.from("lead_audits").insert(auditPayload);
      if (error) return errorResponse(`Failed to save audit: ${error.message}`, 500);
    }

    await supabase.from("leads").update({ lead_score: parsed.lead_score, status: "Audited" }).eq("id", lead_id).eq("user_id", user.id);

    if (!isAdmin(profile)) {
      await supabase
        .from("user_profiles")
        .update({ audits_used_this_month: (profile.audits_used_this_month ?? 0) + 1, updated_at: new Date().toISOString() })
        .eq("id", user.id);
    }

    return jsonResponse({ audit: auditPayload, lead_score: parsed.lead_score });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to analyze website.";
    return errorResponse(message, 500);
  }
});
