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
type PlanId = "free_trial" | "starter" | "pro" | "agency" | "enterprise" | "admin_unlimited";
type UserProfile = { id: string; role: "admin" | "user"; current_plan: PlanId; trial_ends_at: string; is_active: boolean };
const FREE_TRIAL_LEAD_SEARCH_LIMIT = 30;
const FREE_TRIAL_SAVED_LEAD_LIMIT = 100;

type GooglePlace = {
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
};

type TextSearchPage = {
  results: GooglePlace[];
  nextPageToken?: string;
};

const GOOGLE_PLACES_PAGE_SIZE = 20;
const DEFAULT_MAX_PAGES = 3;
const DEFAULT_MAX_RESULTS_SCANNED = 60;

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

    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("id, role, current_plan, trial_ends_at, is_active")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError || !profile) return errorResponse("User profile not found", 404);
    const typedProfile = profile as UserProfile;
    const isAdmin = typedProfile.role === "admin";
    if (!typedProfile.is_active && !isAdmin) return errorResponse("Your account is inactive. Please contact support.", 403);
    if (!isAdmin && typedProfile.current_plan === "free_trial" && new Date(typedProfile.trial_ends_at) < new Date()) {
      return errorResponse("Your free trial has ended. Upgrade your plan to continue using LeadScope AI.", 403);
    }
    if (!isAdmin && typedProfile.current_plan === "free_trial") {
      const { count: searchCount, error: searchCountError } = await supabase
        .from("lead_searches")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);
      if (searchCountError) return errorResponse(`Failed to check lead search limit: ${searchCountError.message}`, 500);
      if ((searchCount ?? 0) > FREE_TRIAL_LEAD_SEARCH_LIMIT) {
        return errorResponse("You’ve reached your free trial limit of 30 lead searches. Upgrade to continue.", 403);
      }
    }

    const apiKey = Deno.env.get("GOOGLE_PLACES_API_KEY")?.trim();

    if (!apiKey) {
      return errorResponse("Google Places API key is not configured on the server.", 500);
    }

    const maxPages = DEFAULT_MAX_PAGES;
    const maxResultsScanned = DEFAULT_MAX_RESULTS_SCANNED;

    async function fetchPlacesPage(pageToken?: string): Promise<TextSearchPage> {
      const fields = [
        "places.id",
        "places.displayName",
        "places.formattedAddress",
        "places.location",
        "places.rating",
        "places.userRatingCount",
        "places.types",
        "places.primaryType",
        "places.primaryTypeDisplayName",
        "places.websiteUri",
        "places.nationalPhoneNumber",
        "places.internationalPhoneNumber",
        "nextPageToken",
      ].join(",");

      const placesRes = await fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": fields,
        },
        body: JSON.stringify({
          textQuery: `${niche} in ${location}`,
          pageSize: GOOGLE_PLACES_PAGE_SIZE,
          ...(pageToken ? { pageToken } : {}),
        }),
      });

      if (!placesRes.ok) {
        let googleMessage = "";
        try {
          const errorData = await placesRes.json() as { error?: { message?: string; status?: string } };
          googleMessage = errorData.error?.message ?? errorData.error?.status ?? "";
        } catch {
          // Use the generic HTTP error below.
        }

        if (placesRes.status === 403) {
          if (googleMessage.includes("not activated") || googleMessage.includes("not enabled")) {
            throw new Error("Google Places API is not enabled. Enable it in Google Cloud Console.");
          }
          if (googleMessage.includes("billing") || googleMessage.includes("payment")) {
            throw new Error("Google billing is not active. Enable billing in Google Cloud Console.");
          }
          throw new Error(`Google Places API key is invalid or rejected${googleMessage ? `: ${googleMessage}` : "."}`);
        }

        if (placesRes.status === 429) {
          throw new Error("Google Places API quota exceeded. Check your billing or limits.");
        }

        throw new Error(`Google Places request failed (HTTP ${placesRes.status})${googleMessage ? `: ${googleMessage}` : ""}`);
      }

      const placesData = await placesRes.json() as {
        places?: Array<{
          id?: string;
          displayName?: { text?: string; languageCode?: string } | string;
          formattedAddress?: string;
          location?: { latitude: number; longitude: number };
          rating?: number;
          userRatingCount?: number;
          types?: string[];
          primaryType?: string;
          primaryTypeDisplayName?: { text?: string; languageCode?: string } | string;
          websiteUri?: string;
          nationalPhoneNumber?: string;
          internationalPhoneNumber?: string;
        }>;
        nextPageToken?: string;
      };

      return {
        results: (placesData.places ?? []).map((place) => ({
          name: typeof place.displayName === "string" ? place.displayName : place.displayName?.text ?? "",
          formatted_address: place.formattedAddress,
          geometry: place.location
            ? { location: { lat: place.location.latitude, lng: place.location.longitude } }
            : undefined,
          rating: place.rating,
          user_ratings_total: place.userRatingCount,
          place_id: place.id,
          types: place.types,
          primaryType: place.primaryType,
          primaryTypeDisplayName: place.primaryTypeDisplayName,
          website: place.websiteUri,
          formatted_phone_number: place.nationalPhoneNumber,
          international_phone_number: place.internationalPhoneNumber,
        })).filter((place) => Boolean(place.name)),
        nextPageToken: placesData.nextPageToken,
      };
    }

    async function fetchPlaceDetails(place: GooglePlace): Promise<GooglePlace> {
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
            primaryType: newDetails.primaryType ?? place.primaryType,
            primaryTypeDisplayName: newDetails.primaryTypeDisplayName ?? place.primaryTypeDisplayName,
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
        const detailData = await detailRes.json() as { status: string; result?: GooglePlace };
        if (detailData.status === "OK" && detailData.result) {
          return { ...place, ...detailData.result };
        }
      } catch {
        // fall through to original place data
      }

      return place;
    }

    const detailedResults: GooglePlace[] = [];
    let pageToken: string | undefined;
    let pages_fetched = 0;
    let scanned = 0;
    let matched_website_status = 0;
    let filtered_out_by_website_status = 0;

    while (pages_fetched < maxPages && scanned < maxResultsScanned) {
      const page = await fetchPlacesPage(pageToken);
      pages_fetched++;

      const remainingScanSlots = maxResultsScanned - scanned;
      const pageResults = page.results.slice(0, remainingScanSlots);
      scanned += pageResults.length;

      const detailedPageResults = await Promise.all(pageResults.map(fetchPlaceDetails));

      for (const place of detailedPageResults) {
        const leadWebsite = (place.website ?? "").trim();
        const websiteStatus = getWebsiteStatus(leadWebsite);

        if (matchesWebsiteStatusFilter(websiteStatus, websiteStatusFilter)) {
          matched_website_status++;
          detailedResults.push(place);
        } else {
          filtered_out_by_website_status++;
        }
      }

      if (!page.nextPageToken || scanned >= maxResultsScanned) {
        break;
      }

      pageToken = page.nextPageToken;
    }

    if (scanned === 0) {
      // Update search status to completed even if no results
      await supabase
        .from("lead_searches")
        .update({ status: "completed" })
        .eq("id", search_id)
        .eq("user_id", user.id);

      return jsonResponse({
        inserted: 0,
        updated: 0,
        skipped_duplicates: 0,
        skipped_due_to_saved_lead_limit: 0,
        filtered_out_by_website_status: 0,
        pages_fetched,
        scanned,
        matched_website_status,
        message: "No leads found for this search query.",
      });
    }

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
    let skipped_duplicates = 0;
    let skipped_due_to_saved_lead_limit = 0;
    const savedLeadLimit = !isAdmin && typedProfile.current_plan === "free_trial" ? FREE_TRIAL_SAVED_LEAD_LIMIT : -1;
    let remainingSavedLeadSlots = savedLeadLimit === -1 ? Number.POSITIVE_INFINITY : Math.max(0, savedLeadLimit - existingLeadsList.length);
    for (const place of detailedResults) {
      const leadWebsite = (place.website ?? "").trim();
      const website = normalizeKey(leadWebsite);

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
          skipped_duplicates++;
        }
        continue;
      }

      if (remainingSavedLeadSlots <= 0) {
        skipped_due_to_saved_lead_limit++;
        continue;
      }
      remainingSavedLeadSlots--;

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

    return jsonResponse({
      inserted,
      updated,
      skipped_duplicates,
      skipped_due_to_saved_lead_limit,
      filtered_out_by_website_status,
      pages_fetched,
      scanned,
      matched_website_status,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Something went wrong while searching.";
    return errorResponse(message, 500);
  }
});
