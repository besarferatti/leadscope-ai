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


type WebsiteStatus = "has_website" | "no_website" | "social_only";
type WebsiteStatusFilter = "all" | WebsiteStatus;

const WEBSITE_STATUS_FILTERS = new Set<WebsiteStatusFilter>([
  "all",
  "has_website",
  "no_website",
  "social_only",
]);

const SOCIAL_ONLY_WEBSITE_HOSTS = [
  "instagram.com",
  "facebook.com",
  "fb.com",
  "tiktok.com",
  "linkedin.com",
  "linktr.ee",
  "beacons.ai",
  "business.site",
  "maps.app.goo.gl",
];

const SOCIAL_ONLY_WEBSITE_PATHS = [
  "google.com/maps",
  "maps.app.goo.gl",
];

function getWebsiteHost(website: string) {
  const normalized = website.trim().replace(/^mailto:/i, "");
  try {
    return new URL(normalized.match(/^https?:\/\//i) ? normalized : `https://${normalized}`)
      .hostname
      .toLowerCase()
      .replace(/^www\./, "");
  } catch {
    return "";
  }
}

function getWebsiteStatus(website?: string | null): WebsiteStatus {
  const trimmedWebsite = website?.trim();

  if (!trimmedWebsite) return "no_website";

  const lowerWebsite = trimmedWebsite.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "");
  const host = getWebsiteHost(trimmedWebsite);

  if (
    SOCIAL_ONLY_WEBSITE_PATHS.some((path) => lowerWebsite.includes(path))
    || SOCIAL_ONLY_WEBSITE_HOSTS.some((socialHost) => host === socialHost || host.endsWith(`.${socialHost}`))
  ) {
    return "social_only";
  }

  return "has_website";
}

function normalizeWebsiteStatusFilter(value?: string | null): WebsiteStatusFilter {
  const normalized = normalizeKey(value) as WebsiteStatusFilter;
  return WEBSITE_STATUS_FILTERS.has(normalized) ? normalized : "all";
}

function matchesWebsiteStatusFilter(status: WebsiteStatus, filter: WebsiteStatusFilter) {
  return filter === "all" || status === filter;
}

function normalizeKey(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

function normalizePhone(value?: string | null) {
  return (value ?? "").replace(/\D/g, "");
}

function getGoogleCategory(place: { primaryTypeDisplayName?: { text?: string } | string }) {
  return typeof place.primaryTypeDisplayName === "string"
    ? place.primaryTypeDisplayName.trim()
    : place.primaryTypeDisplayName?.text?.trim() || "";
}

function normalizeCategoryText(value?: string | null) {
  return normalizeKey(value).replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

function isBroadCategory(category?: string | null) {
  const normalized = normalizeCategoryText(category);
  return new Set([
    "services",
    "service",
    "local services",
    "professional services",
    "business service",
    "business services",
    "local business",
    "establishment",
    "point of interest",
    "contractor",
    "general contractor",
    "construction",
    "construction company",
    "store",
    "company",
    "consultant",
    "repair service",
    "service establishment",
    "organization",
  ]).has(normalized);
}

function isSpecificCategory(category?: string | null) {
  return Boolean(normalizeCategoryText(category)) && !isBroadCategory(category);
}

function cleanSelectedNiche(niche?: string | null) {
  return (niche ?? "").trim().replace(/\s+/g, " ");
}

function prettifyGoogleType(type?: string | null) {
  return normalizeCategoryText(type).replace(/\b\w/g, (char) => char.toUpperCase());
}

function isBroadFallbackIndustry(industry?: string | null) {
  const normalized = normalizeCategoryText(industry);
  return !normalized
    || normalized === "unknown"
    || isBroadCategory(industry);
}

function isMoreSpecificIndustry(industry: string, existingIndustry?: string | null) {
  const normalizedIndustry = normalizeKey(industry);
  return Boolean(normalizedIndustry)
    && normalizedIndustry !== normalizeKey(existingIndustry)
    && !isBroadFallbackIndustry(industry)
    && isBroadFallbackIndustry(existingIndustry);
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

    const body = await req.json() as { search_id: string; niche: string; location: string; website_status_filter?: string };
    const { search_id, niche, location } = body;
    const websiteStatusFilter = normalizeWebsiteStatusFilter(body.website_status_filter);

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
        primaryTypeDisplayName?: { text?: string; languageCode?: string } | string;
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

      return jsonResponse({
        inserted: 0,
        updated: 0,
        skipped: 0,
        filtered_out_by_website_status: 0,
        message: "No leads found for this search query.",
      });
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
              primaryTypeDisplayName?: { text?: string; languageCode?: string } | string;
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
      .select("id, business_name, industry, address, website, phone, google_maps_url")
      .eq("user_id", user.id);

    type ExistingLead = {
      id: string;
      business_name?: string;
      industry?: string;
      address?: string;
      website?: string;
      phone?: string;
      google_maps_url?: string;
    };

    const existingLeadsList = (existingLeads ?? []) as ExistingLead[];

    const existingByWebsite = new Map(
      existingLeadsList
        .map((l) => [normalizeKey(l.website), l] as const)
        .filter(([website]) => Boolean(website))
    );

    const existingByGoogleMapsUrl = new Map(
      existingLeadsList
        .map((l) => [normalizeKey(l.google_maps_url), l] as const)
        .filter(([googleMapsUrl]) => Boolean(googleMapsUrl))
    );

    const existingByNamePhone = new Map(
      existingLeadsList
        .map((l) => [`${normalizeKey(l.business_name)}_${normalizePhone(l.phone)}`, l] as const)
        .filter(([namePhone]) => !namePhone.endsWith("_"))
    );

    const existingByNameAddress = new Map(
      existingLeadsList
        .map((l) => [`${normalizeKey(l.business_name)}_${normalizeKey(l.address)}`, l] as const)
        .filter(([nameAddress]) => !nameAddress.endsWith("_"))
    );

    const toInsert = [];
    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    let filtered_out_by_website_status = 0;

    for (const place of detailedResults) {
      const leadWebsite = ((place as { website?: string }).website ?? "").trim();
      const website = normalizeKey(leadWebsite);
      const websiteStatus = getWebsiteStatus(leadWebsite);

      if (!matchesWebsiteStatusFilter(websiteStatus, websiteStatusFilter)) {
        filtered_out_by_website_status++;
        continue;
      }

      const address = (place.formatted_address ?? "").trim();
      const mapsUrl = place.place_id
        ? `https://www.google.com/maps/place/?q=place_id:${place.place_id}`
        : "";
      const phone = (place as { international_phone_number?: string; formatted_phone_number?: string })
        .international_phone_number
        ?? (place as { formatted_phone_number?: string }).formatted_phone_number
        ?? "";
      const namePhone = `${normalizeKey(place.name)}_${normalizePhone(phone)}`;
      const nameAddr = `${normalizeKey(place.name)}_${normalizeKey(address)}`;

      const types = place.types ?? [];
      const googlePrimaryType = (place as { primaryType?: string }).primaryType;
      const googlePrimaryTypeDisplayName = (place as { primaryTypeDisplayName?: { text?: string } | string })
        .primaryTypeDisplayName;
      const googleCategory = getGoogleCategory({ primaryTypeDisplayName: googlePrimaryTypeDisplayName });
      const selectedCategory = cleanSelectedNiche(niche);
      const primaryTypeCategory = prettifyGoogleType(googlePrimaryType);
      const firstTypeCategory = prettifyGoogleType(types[0]);

      let industry = "";

      if (isSpecificCategory(googleCategory)) {
        industry = googleCategory;
      } else if (isSpecificCategory(selectedCategory)) {
        industry = selectedCategory;
      } else if (isSpecificCategory(primaryTypeCategory)) {
        industry = primaryTypeCategory;
      } else if (isSpecificCategory(firstTypeCategory)) {
        industry = firstTypeCategory;
      } else {
        industry = googleCategory || selectedCategory || primaryTypeCategory || firstTypeCategory || "Unknown";
      }

      const existingLead = (mapsUrl && existingByGoogleMapsUrl.get(normalizeKey(mapsUrl)))
        || (website && existingByWebsite.get(website))
        || (!namePhone.endsWith("_") && existingByNamePhone.get(namePhone))
        || (!nameAddr.endsWith("_") && existingByNameAddress.get(nameAddr));
      const existingIndustry = existingLead?.industry;

      console.log("Lead industry resolution", {
        businessName: place.name,
        selectedNiche: niche,
        googleCategory,
        selectedCategory,
        googlePrimaryType: place.primaryType,
        googlePrimaryTypeDisplayName,
        googleTypes: place.types,
        resolvedIndustry: industry,
        googleCategoryWasBroad: isBroadCategory(googleCategory),
        selectedCategoryWasSpecific: isSpecificCategory(selectedCategory),
        action: existingLead ? "update-existing" : "insert-new",
      });

      if (existingLead) {
        if (isMoreSpecificIndustry(industry, existingIndustry)) {
          const { error: updateError } = await supabase
            .from("leads")
            .update({ industry })
            .eq("id", existingLead.id)
            .eq("user_id", user.id);

          if (updateError) {
            return errorResponse(`Failed to update lead industry: ${updateError.message}`, 500);
          }

          existingLead.industry = industry;
          updated++;
        } else {
          skipped++;
        }
        continue;
      }

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

      const pendingLead = {
        id: "",
        business_name: place.name,
        industry,
        address,
        website: leadWebsite,
        phone,
        google_maps_url: mapsUrl,
      };

      if (website) existingByWebsite.set(website, pendingLead);
      if (mapsUrl) existingByGoogleMapsUrl.set(normalizeKey(mapsUrl), pendingLead);
      if (!namePhone.endsWith("_")) existingByNamePhone.set(namePhone, pendingLead);
      if (!nameAddr.endsWith("_")) existingByNameAddress.set(nameAddr, pendingLead);
    }

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

    return jsonResponse({ inserted, updated, skipped, filtered_out_by_website_status });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Something went wrong while searching.";
    return errorResponse(message, 500);
  }
});
