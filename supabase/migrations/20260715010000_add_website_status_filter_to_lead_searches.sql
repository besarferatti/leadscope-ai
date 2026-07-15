ALTER TABLE lead_searches
ADD COLUMN IF NOT EXISTS website_status_filter text NOT NULL DEFAULT 'all';

ALTER TABLE lead_searches
DROP CONSTRAINT IF EXISTS lead_searches_website_status_filter_check;

ALTER TABLE lead_searches
ADD CONSTRAINT lead_searches_website_status_filter_check
CHECK (website_status_filter IN ('all', 'has_website', 'no_website', 'social_only'));
