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

    const apiKey = Deno.env.get("GOOGLE_PLACES_API_KEY")?.trim();

    if (!apiKey) {
      return errorResponse("Google Places API key is not configured on the server.", 500);
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
        primaryType?: string;
        primaryTypeDisplayName?: { text?: string; languageCode?: string };
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
          const newDetailsUrl = `https://places.googleapis.com/v1/places/${place.place_id}`;
          const newDetailsRes = await fetch(newDetailsUrl, {
            headers: {
              "X-Goog-Api-Key": apiKey,
              "X-Goog-FieldMask": "primaryType,primaryTypeDisplayName,types,websiteUri,nationalPhoneNumber,internationalPhoneNumber",
            },
          });

          if (newDetailsRes.ok) {
            const newDetails = await newDetailsRes.json() as {
              primaryType?: string;
              primaryTypeDisplayName?: { text?: string; languageCode?: string };
              types?: string[];
              websiteUri?: string;
              nationalPhoneNumber?: string;
              internationalPhoneNumber?: string;
            };

            place = {
              ...place,
              primaryType: newDetails.primaryType,
              primaryTypeDisplayName: newDetails.primaryTypeDisplayName,
              types: newDetails.types ?? place.types,
              website: newDetails.websiteUri ?? place.website,
              formatted_phone_number: newDetails.nationalPhoneNumber ?? place.formatted_phone_number,
              international_phone_number: newDetails.internationalPhoneNumber ?? place.international_phone_number,
            };
          }
        } catch {
          // Fall back to legacy details below.
        }

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

      const types = place.types ?? [];
      const googlePrimaryType = (place as { primaryType?: string }).primaryType;
      const googlePrimaryTypeDisplayName = (place as { primaryTypeDisplayName?: { text?: string } })
        .primaryTypeDisplayName?.text;
      const leadWebsite = ((place as { website?: string }).website ?? "").trim();
      const industry = determineLeadIndustry({
        businessName: place.name,
        selectedNiche: niche,
        googlePrimaryType,
        googlePrimaryTypeDisplayName,
        googleTypes: types,
        website: leadWebsite,
      });

      console.log("Lead industry classification", {
        businessName: place.name,
        selectedNiche: niche,
        googlePrimaryType,
        googlePrimaryTypeDisplayName,
        googleTypes: types,
        normalizedIndustry: industry,
      });

      // Build Google Maps URL from place_id
      const mapsUrl = place.place_id
        ? `https://www.google.com/maps/place/?q=place_id:${place.place_id}`
        : "";

      const phone = (place as { international_phone_number?: string; formatted_phone_number?: string })
        .international_phone_number
        ?? (place as { formatted_phone_number?: string }).formatted_phone_number
        ?? "";

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

    let inserted = 0;
    if (toInsert.length > 0) {
      const { error: insertError } = await supabase.from("leads").insert(toInsert);
      if (insertError) {
        return errorResponse(`Failed to save leads: ${insertError.message}`, 500);
      }
      inserted = toInsert.length;
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

type IndustryClassificationInput = {
  businessName: string;
  selectedNiche: string;
  googlePrimaryType?: string;
  googlePrimaryTypeDisplayName?: string;
  googleTypes: string[];
  website?: string;
};

const BROAD_CONSTRUCTION_TYPES = new Set(["contractor", "general_contractor", "construction", "construction_company"]);

function determineLeadIndustry({
  businessName,
  selectedNiche,
  googlePrimaryType,
  googlePrimaryTypeDisplayName,
  googleTypes,
  website,
}: IndustryClassificationInput): string {
  const selectedIndustry = normalizeLeadIndustry(selectedNiche);

  // Prefer Google's human-readable primary category when it is specific. If it is broad
  // construction/contractor language, preserve a more specific selected search niche.
  const displayIndustry = normalizeLeadIndustry(googlePrimaryTypeDisplayName);
  if (displayIndustry && displayIndustry !== "Construction Services") {
    return displayIndustry;
  }

  if (selectedIndustry) return selectedIndustry;
  if (displayIndustry) return displayIndustry;

  const primaryTypeIndustry = normalizeLeadIndustry(googlePrimaryType);
  if (primaryTypeIndustry) return primaryTypeIndustry;

  for (const type of googleTypes) {
    const typeIndustry = normalizeLeadIndustry(type);
    if (typeIndustry) return typeIndustry;
  }

  const keywordFallback = normalizeLeadIndustry(`${businessName} ${website ?? ""}`);
  if (keywordFallback) return keywordFallback;

  const nicheWord = selectedNiche.trim().split(/\s+/)[0] ?? "";
  return nicheWord ? nicheWord.charAt(0).toUpperCase() + nicheWord.slice(1).toLowerCase() : "Other";
}

function isSpecificTradeIndustry(industry?: string): boolean {
  return industry === "HVAC Services"
    || industry === "Electrical Services"
    || industry === "Plumbing Services"
    || industry === "Roofing Services";
}

function normalizeLeadIndustry(input?: string): string | undefined {
  if (!input) return undefined;
  const value = input.toLowerCase().replace(/[_-]+/g, " ").trim();
  if (!value) return undefined;

  // Specific trades must be checked before construction so labels like
  // "HVAC contractor" do not collapse into generic construction.
  if (matchesAny(value, ["hvac", "heating", "cooling", "air conditioning", "air conditioner", "furnace", "ac repair", "ventilation", "climate control"])) {
    return "HVAC Services";
  }
  if (matchesAny(value, ["electrician", "electrical", "wiring", "panel", "lighting", "breaker", "electrical installation service"])) {
    return "Electrical Services";
  }
  if (matchesAny(value, ["plumbing", "plumber", "pipe", "drain", "leak", "water heater", "plumbing service"])) {
    return "Plumbing Services";
  }
  if (matchesAny(value, ["roofing", "roofer", "roof", "gutter", "roofing contractor"])) {
    return "Roofing Services";
  }
  if (matchesAny(value, ["construction", "general contractor", "contractor", "builder", "renovation", "remodel", "concrete", "masonry", "construction company"])) {
    return "Construction Services";
  }

  const typeMap: Record<string, string> = {
    dentist: "Dental Clinic",
    dental: "Dental Clinic",
    "dental clinic": "Dental Clinic",
    doctor: "Medical",
    hospital: "Medical",
    health: "Medical",
    lawyer: "Legal",
    "real estate agency": "Real Estate",
    restaurant: "Restaurant",
    food: "Restaurant",
    gym: "Fitness",
    "beauty salon": "Beauty Salon",
    spa: "Beauty Salon",
    "hair care": "Beauty Salon",
    "car dealer": "Auto Repair",
    "car repair": "Auto Repair",
    "auto repair": "Auto Repair",
    school: "Education",
    university: "Education",
    accounting: "Accounting",
    "insurance agency": "Insurance",
    photographer: "Photography",
    "clothing store": "Retail",
    store: "Retail",
    florist: "Retail",
    "home goods store": "Retail",
    "pet store": "Retail",
    supermarket: "Retail",
    pharmacy: "Medical",
    physiotherapist: "Medical",
    "veterinary care": "Medical",
    "travel agency": "Events",
    "event venue": "Events",
    "moving company": "Moving",
    cleaning: "Cleaning",
  };

  if (BROAD_CONSTRUCTION_TYPES.has(value)) return "Construction Services";
  return typeMap[value];
}

function matchesAny(value: string, keywords: string[]): boolean {
  return keywords.some((keyword) => value.includes(keyword));
}
