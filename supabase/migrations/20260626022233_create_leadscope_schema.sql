/*
# LeadScope AI — Initial Schema

## Summary
Creates the full data model for the LeadScope AI application.

## New Tables

### lead_searches
Stores each lead search campaign a user creates.
- id (uuid PK)
- user_id (uuid, owner, defaults to auth.uid())
- niche (text) — e.g. "Dentists", "Plumbers"
- location (text) — city/region
- service_offer (text) — what the agency offers
- language (text) — outreach language
- status (text) — 'pending' | 'running' | 'completed'
- created_at (timestamptz)

### leads
Individual business leads linked to a search.
- id (uuid PK)
- user_id (uuid, owner)
- lead_search_id (uuid FK → lead_searches)
- business_name (text)
- industry (text)
- location (text)
- address (text)
- website (text)
- phone (text)
- email (text)
- google_rating (numeric)
- reviews_count (int)
- google_maps_url (text)
- lead_score (int, 0-100)
- status (text) — New | Audited | Message Generated | Contacted | Interested | Not Interested | Closed
- created_at (timestamptz)

### lead_audits
Website audit results for a lead.
- id (uuid PK)
- lead_id (uuid FK → leads)
- website_score (int)
- seo_score (int)
- conversion_score (int)
- main_issues (text[])
- recommended_offer (text)
- personalization_angle (text)
- summary (text)
- created_at (timestamptz)

### outreach_messages
AI-generated outreach messages for a lead.
- id (uuid PK)
- lead_id (uuid FK → leads)
- channel (text) — 'email' | 'dm'
- language (text)
- tone (text)
- subject (text)
- body (text)
- created_at (timestamptz)

## Security
- RLS enabled on all 4 tables.
- 4 separate per-verb policies per table, all scoped TO authenticated with auth.uid() ownership.
*/

-- lead_searches
CREATE TABLE IF NOT EXISTS lead_searches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  niche text NOT NULL,
  location text NOT NULL,
  service_offer text NOT NULL DEFAULT '',
  language text NOT NULL DEFAULT 'English',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE lead_searches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_searches" ON lead_searches;
CREATE POLICY "select_own_searches" ON lead_searches FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_searches" ON lead_searches;
CREATE POLICY "insert_own_searches" ON lead_searches FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_searches" ON lead_searches;
CREATE POLICY "update_own_searches" ON lead_searches FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_searches" ON lead_searches;
CREATE POLICY "delete_own_searches" ON lead_searches FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- leads
CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_search_id uuid REFERENCES lead_searches(id) ON DELETE SET NULL,
  business_name text NOT NULL,
  industry text NOT NULL DEFAULT '',
  location text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  website text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  google_rating numeric(3,1),
  reviews_count int DEFAULT 0,
  google_maps_url text NOT NULL DEFAULT '',
  lead_score int DEFAULT 0 CHECK (lead_score >= 0 AND lead_score <= 100),
  status text NOT NULL DEFAULT 'New',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_leads" ON leads;
CREATE POLICY "select_own_leads" ON leads FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_leads" ON leads;
CREATE POLICY "insert_own_leads" ON leads FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_leads" ON leads;
CREATE POLICY "update_own_leads" ON leads FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_leads" ON leads;
CREATE POLICY "delete_own_leads" ON leads FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- lead_audits
CREATE TABLE IF NOT EXISTS lead_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  website_score int DEFAULT 0,
  seo_score int DEFAULT 0,
  conversion_score int DEFAULT 0,
  main_issues text[] DEFAULT '{}',
  recommended_offer text DEFAULT '',
  personalization_angle text DEFAULT '',
  summary text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE lead_audits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_audits" ON lead_audits;
CREATE POLICY "select_own_audits" ON lead_audits FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM leads WHERE leads.id = lead_audits.lead_id AND leads.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_audits" ON lead_audits;
CREATE POLICY "insert_own_audits" ON lead_audits FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM leads WHERE leads.id = lead_audits.lead_id AND leads.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "update_own_audits" ON lead_audits;
CREATE POLICY "update_own_audits" ON lead_audits FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM leads WHERE leads.id = lead_audits.lead_id AND leads.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM leads WHERE leads.id = lead_audits.lead_id AND leads.user_id = auth.uid()));

DROP POLICY IF EXISTS "delete_own_audits" ON lead_audits;
CREATE POLICY "delete_own_audits" ON lead_audits FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM leads WHERE leads.id = lead_audits.lead_id AND leads.user_id = auth.uid())
  );

-- outreach_messages
CREATE TABLE IF NOT EXISTS outreach_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  channel text NOT NULL DEFAULT 'email',
  language text NOT NULL DEFAULT 'English',
  tone text NOT NULL DEFAULT 'professional',
  subject text DEFAULT '',
  body text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE outreach_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_messages" ON outreach_messages;
CREATE POLICY "select_own_messages" ON outreach_messages FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM leads WHERE leads.id = outreach_messages.lead_id AND leads.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_messages" ON outreach_messages;
CREATE POLICY "insert_own_messages" ON outreach_messages FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM leads WHERE leads.id = outreach_messages.lead_id AND leads.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "update_own_messages" ON outreach_messages;
CREATE POLICY "update_own_messages" ON outreach_messages FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM leads WHERE leads.id = outreach_messages.lead_id AND leads.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM leads WHERE leads.id = outreach_messages.lead_id AND leads.user_id = auth.uid()));

DROP POLICY IF EXISTS "delete_own_messages" ON outreach_messages;
CREATE POLICY "delete_own_messages" ON outreach_messages FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM leads WHERE leads.id = outreach_messages.lead_id AND leads.user_id = auth.uid())
  );

-- indexes for common queries
CREATE INDEX IF NOT EXISTS idx_leads_user_id ON leads(user_id);
CREATE INDEX IF NOT EXISTS idx_leads_lead_search_id ON leads(lead_search_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_lead_searches_user_id ON lead_searches(user_id);
CREATE INDEX IF NOT EXISTS idx_lead_audits_lead_id ON lead_audits(lead_id);
CREATE INDEX IF NOT EXISTS idx_outreach_messages_lead_id ON outreach_messages(lead_id);
