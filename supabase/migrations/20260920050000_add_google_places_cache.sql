-- Shared Google Places cache used only by trusted server-side functions.
-- Search results expire in the application after 30 days and are refreshed from Google.

CREATE TABLE IF NOT EXISTS public.business_directory (
  google_place_id text PRIMARY KEY,
  business_name text NOT NULL,
  formatted_address text NOT NULL DEFAULT '',
  latitude double precision,
  longitude double precision,
  rating numeric(3,1),
  reviews_count integer NOT NULL DEFAULT 0,
  types text[] NOT NULL DEFAULT '{}',
  primary_type text NOT NULL DEFAULT '',
  primary_type_display_name text NOT NULL DEFAULT '',
  website text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  refreshed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.place_search_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  niche_normalized text NOT NULL,
  location_normalized text NOT NULL,
  place_ids text[] NOT NULL DEFAULT '{}',
  refreshed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (niche_normalized, location_normalized)
);

CREATE INDEX IF NOT EXISTS idx_place_search_cache_lookup
  ON public.place_search_cache (niche_normalized, location_normalized, refreshed_at DESC);

ALTER TABLE public.business_directory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.place_search_cache ENABLE ROW LEVEL SECURITY;

-- No client policies by design. The service-role Edge Function is the only reader/writer.
REVOKE ALL ON TABLE public.business_directory FROM anon, authenticated;
REVOKE ALL ON TABLE public.place_search_cache FROM anon, authenticated;
