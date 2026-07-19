-- Reuse the existing public.leads.email column for the discovered address.
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS email_source_url text,
  ADD COLUMN IF NOT EXISTS email_source_type text,
  ADD COLUMN IF NOT EXISTS email_confidence integer,
  ADD COLUMN IF NOT EXISTS email_status text,
  ADD COLUMN IF NOT EXISTS email_found_at timestamptz,
  ADD COLUMN IF NOT EXISTS email_candidates jsonb;

ALTER TABLE public.leads
  DROP CONSTRAINT IF EXISTS leads_email_confidence_range;

ALTER TABLE public.leads
  ADD CONSTRAINT leads_email_confidence_range
  CHECK (email_confidence IS NULL OR (email_confidence >= 0 AND email_confidence <= 100));

NOTIFY pgrst, 'reload schema';
