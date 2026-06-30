import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
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

function leadLimit(plan: string | null | undefined) {
  switch (plan) {
    case "starter": return 500;
    case "pro": return 2500;
    case "agency": return 10000;
    case "enterprise": return -1;
    case "admin_unlimited": return -1;
    case "free_trial":
    default: return 50;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // Auth: verify the calling user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return errorResponse("Missing Authorization header", 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Validate JWT and get user
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return errorResponse("Unauthorized", 401);

    const body = await req.json() as { search_id: string; niche: string; location: string };
    const { search_id, niche, location } = body;

    if (!search_id || !niche || !location) {
      return errorResponse("search_id, niche, and location are required");
    }

    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("role,current_plan,leads_used_this_month,is_active")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return errorResponse("Unable to load account profile", 500);
    }
    if (!profile.is_active) {
      return errorResponse("Your account is inactive. Please contact support.", 403);
    }
    if (!isAdmin(profile)) {
      const limit = leadLimit(profile.current_plan);
      if (limit !== -1 && (profile.leads_used_this_month ?? 0) >= limit) {
        return errorResponse("You've reached your monthly lead limit. Upgrade your plan to continue generating more leads.", 402);
      }
    }

    const apiKey = Deno.env.get("GOOGLE_PLACES_API_KEY")?.trim();

    if (!apiKey) {
      return errorResponse("Google Places is not configured on the server.", 500);
    }

    // Call Google Places Text Search API
    const query = encodeURIComponent(`${niche} in ${location}`);
    const placesUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&key=${apiKey}`;

    const placesRes = await fetch(placesUrl);

    if (!placesRes.ok) {
      return errorResponse(`Google Places request failed (HTTP ${placesRes.status})`, 502);
    }

    const placesData = await placesRes.json() as {
      status: string;
      error_message?: string;
      results?: Array<{
        name: string;
        formatted_address?: string;
        geometry?: { location: { lat: number; lng: number } };
        rating?: number;
        user_ratings_total?: number;
        place_id?: string;
        types?: string[];
        website?: string;
        international_phone_number?: string;
        formatted_phone_number?: string;
      }>;
    };

    // Map Google Places API status to friendly errors
    if (placesData.status === "REQUEST_DENIED") {
      const msg = placesData.error_message ?? "";
      if (msg.includes("not activated") || msg.includes("not enabled")) {
        return errorResponse("Google Places API is not enabled. Enable it in Google Cloud Console.", 422);
      }
      if (msg.includes("billing") || msg.includes("payment")) {
        return errorResponse("Google billing is not active. Enable billing in Google Cloud Console.", 422);
      }
      return errorResponse(`Google Places API key is invalid or rejected: ${msg}`, 422);
    }

    if (placesData.status === "OVER_QUERY_LIMIT") {
      return errorResponse("Google Places API quota exceeded. Check your billing or limits.", 429);
    }

    if (placesData.status === "INVALID_REQUEST") {
      return errorResponse("Invalid request to Google Places API. Check your search query.", 422);
    }

    if (placesData.status !== "OK" && placesData.status !== "ZERO_RESULTS") {
      return errorResponse(`Google Places error: ${placesData.status}${placesData.error_message ? " — " + placesData.error_message : ""}`, 502);
    }

    const results = placesData.results ?? [];

    if (results.length === 0) {
      // Update search status to completed even if no results
      await supabase
        .from("lead_searches")
        .update({ status: "completed" })
        .eq("id", search_id)
        .eq("user_id", user.id);

      return jsonResponse({ inserted: 0, skipped: 0, message: "No leads found for this search query." });
    }

    // For each place, fetch details to get website & phone (Places Text Search doesn't include them)
    // We'll do details fetches in parallel (up to 20 results)
    const topResults = results.slice(0, 20);

    const detailedResults = await Promise.all(
      topResults.map(async (place) => {
        if (!place.place_id) return place;
        try {
          const detailUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=name,formatted_address,formatted_phone_number,international_phone_number,website,rating,user_ratings_total,url,types&key=${apiKey}`;
          const detailRes = await fetch(detailUrl);
          if (!detailRes.ok) return place;
          const detailData = await detailRes.json() as { status: string; result?: typeof place };
          if (detailData.status === "OK" && detailData.result) {
            return { ...place, ...detailData.result };
          }
        } catch {
          // fall through to original place data
        }
        return place;
      })
    );

    // Fetch existing leads for this user to check duplicates
    const { data: existingLeads } = await supabase
      .from("leads")
      .select("business_name, address, website")
      .eq("user_id", user.id);

    const existingWebsites = new Set(
      (existingLeads ?? [])
        .map((l: { website?: string }) => l.website?.trim().toLowerCase())
        .filter(Boolean)
    );

    const existingNameAddress = new Set(
      (existingLeads ?? [])
        .map((l: { business_name?: string; address?: string }) =>
          `${l.business_name?.toLowerCase()}_${l.address?.toLowerCase()}`
        )
    );

    const toInsert = [];
    let skipped = 0;

    for (const place of detailedResults) {
      const website = ((place as { website?: string }).website ?? "").trim().toLowerCase();
      const address = (place.formatted_address ?? "").trim();
      const nameAddr = `${place.name.toLowerCase()}_${address.toLowerCase()}`;

      // Duplicate check: by website OR name+address
      if (website && existingWebsites.has(website)) { skipped++; continue; }
      if (existingNameAddress.has(nameAddr)) { skipped++; continue; }

      // Derive a best-guess industry from place types
      const types = place.types ?? [];
      const industry = deriveIndustry(types, niche);

      // Build Google Maps URL from place_id
      const mapsUrl = place.place_id
        ? `https://www.google.com/maps/place/?q=place_id:${place.place_id}`
        : "";

      const phone = (place as { international_phone_number?: string; formatted_phone_number?: string })
        .international_phone_number
        ?? (place as { formatted_phone_number?: string }).formatted_phone_number
        ?? "";

      const leadWebsite = ((place as { website?: string }).website ?? "").trim();

      toInsert.push({
        user_id: user.id,
        lead_search_id: search_id,
        business_name: place.name,
        industry,
        location,
        address,
        website: leadWebsite,
        phone,
        email: "",
        google_rating: place.rating ?? null,
        reviews_count: place.user_ratings_total ?? 0,
        google_maps_url: mapsUrl,
        lead_score: 0,
        status: "New",
      });

      // Track to avoid duplicate within this batch
      if (leadWebsite) existingWebsites.add(leadWebsite.toLowerCase());
      existingNameAddress.add(nameAddr);
    }

    const allowedToInsert = isAdmin(profile)
      ? toInsert
      : toInsert.slice(0, Math.max(0, leadLimit(profile.current_plan) - (profile.leads_used_this_month ?? 0)));
    skipped += toInsert.length - allowedToInsert.length;

    let inserted = 0;
    if (allowedToInsert.length > 0) {
      const { error: insertError } = await supabase.from("leads").insert(allowedToInsert);
      if (insertError) {
        return errorResponse(`Failed to save leads: ${insertError.message}`, 500);
      }
      inserted = allowedToInsert.length;
    }

    if (inserted > 0 && !isAdmin(profile)) {
      await supabase
        .from("user_profiles")
        .update({ leads_used_this_month: (profile.leads_used_this_month ?? 0) + inserted, updated_at: new Date().toISOString() })
        .eq("id", user.id);
    }

    // Update search status to completed
    await supabase
      .from("lead_searches")
      .update({ status: "completed" })
      .eq("id", search_id)
      .eq("user_id", user.id);

    return jsonResponse({ inserted, skipped });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Something went wrong while searching.";
    return errorResponse(message, 500);
  }
});

function deriveIndustry(types: string[], niche: string): string {
  // Map common Google Places types to friendly industry names
  const typeMap: Record<string, string> = {
    dentist: "Dental",
    doctor: "Medical",
    hospital: "Medical",
    health: "Medical",
    lawyer: "Legal",
    real_estate_agency: "Real Estate",
    restaurant: "Restaurant",
    food: "Restaurant",
    gym: "Fitness",
    beauty_salon: "Beauty & Spa",
    spa: "Beauty & Spa",
    hair_care: "Beauty & Spa",
    car_dealer: "Automotive",
    car_repair: "Automotive",
    general_contractor: "Construction",
    plumber: "Plumbing",
    electrician: "Plumbing",
    locksmith: "Construction",
    school: "Education",
    university: "Education",
    accounting: "Accounting",
    insurance_agency: "Insurance",
    photographer: "Photography",
    clothing_store: "Retail",
    store: "Retail",
    florist: "Retail",
    home_goods_store: "Retail",
    pet_store: "Retail",
    supermarket: "Retail",
    pharmacy: "Medical",
    physiotherapist: "Medical",
    veterinary_care: "Medical",
    travel_agency: "Events",
    event_venue: "Events",
    moving_company: "Cleaning",
    cleaning: "Cleaning",
  };

  for (const type of types) {
    const match = typeMap[type];
    if (match) return match;
  }

  // Fall back to capitalised niche keyword
  const nicheWord = niche.trim().split(/\s+/)[0];
  return nicheWord.charAt(0).toUpperCase() + nicheWord.slice(1).toLowerCase();
}
