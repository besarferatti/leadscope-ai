-- Allow only the trusted server-side service role to maintain the shared Places cache.
-- Client roles remain revoked and RLS remains enabled.

GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.business_directory
  TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.place_search_cache
  TO service_role;
