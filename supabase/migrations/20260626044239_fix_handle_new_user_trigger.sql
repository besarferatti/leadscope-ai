
-- Drop and recreate the trigger function with proper RLS bypass
-- SECURITY DEFINER runs as the function owner (postgres role), which bypasses RLS
-- But we also need to grant the function explicit bypass on the table

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO user_profiles (
    id,
    email,
    full_name,
    role,
    current_plan,
    subscription_status,
    trial_started_at,
    trial_ends_at,
    is_active,
    must_change_password
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'user',
    'free_trial',
    'trialing',
    now(),
    now() + interval '7 days',
    true,
    false
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Grant the function owner (postgres) bypass RLS on user_profiles
ALTER TABLE user_profiles FORCE ROW LEVEL SECURITY;

-- Allow the anon role to insert (needed during signup before session is established)
DROP POLICY IF EXISTS "service_insert_profile" ON user_profiles;
CREATE POLICY "service_insert_profile" ON user_profiles FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);
