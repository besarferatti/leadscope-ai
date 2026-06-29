/*
# Create user_settings table

Stores per-user settings including API keys and agency profile.

## New Tables
- `user_settings`
  - id (uuid PK, defaults to auth.uid() so each user has exactly one row)
  - openai_api_key (text, encrypted client-side or stored as-is)
  - google_places_api_key (text)
  - agency_name (text)
  - agency_website (text)
  - default_language (text)
  - default_tone (text)
  - updated_at (timestamptz)

## Security
- RLS enabled. Each authenticated user can only read/write their own settings row.
- Upsert-friendly: INSERT or UPDATE with user_id = auth.uid().
*/

CREATE TABLE IF NOT EXISTS user_settings (
  id uuid PRIMARY KEY DEFAULT auth.uid(),
  openai_api_key text NOT NULL DEFAULT '',
  google_places_api_key text NOT NULL DEFAULT '',
  agency_name text NOT NULL DEFAULT '',
  agency_website text NOT NULL DEFAULT '',
  default_language text NOT NULL DEFAULT 'English',
  default_tone text NOT NULL DEFAULT 'Professional',
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_settings" ON user_settings;
CREATE POLICY "select_own_settings" ON user_settings FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "insert_own_settings" ON user_settings;
CREATE POLICY "insert_own_settings" ON user_settings FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_settings" ON user_settings;
CREATE POLICY "update_own_settings" ON user_settings FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "delete_own_settings" ON user_settings;
CREATE POLICY "delete_own_settings" ON user_settings FOR DELETE
  TO authenticated USING (auth.uid() = id);
