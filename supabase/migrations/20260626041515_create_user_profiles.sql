
-- Create user_profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL DEFAULT '',
  full_name text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  current_plan text NOT NULL DEFAULT 'free_trial',
  billing_cycle text NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'yearly')),
  subscription_status text NOT NULL DEFAULT 'trialing',
  trial_started_at timestamptz DEFAULT now(),
  trial_ends_at timestamptz DEFAULT (now() + interval '7 days'),
  leads_used_this_month int NOT NULL DEFAULT 0,
  audits_used_this_month int NOT NULL DEFAULT 0,
  messages_used_this_month int NOT NULL DEFAULT 0,
  usage_cycle_started_at timestamptz DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  must_change_password boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Users can read/update their own profile
CREATE POLICY "select_own_profile" ON user_profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

CREATE POLICY "insert_own_profile" ON user_profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

CREATE POLICY "update_own_profile" ON user_profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Admins can read all profiles
CREATE POLICY "admin_select_all_profiles" ON user_profiles FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  );

-- Admins can update all profiles
CREATE POLICY "admin_update_all_profiles" ON user_profiles FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  );

-- Admins can delete profiles
CREATE POLICY "admin_delete_profiles" ON user_profiles FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  );

-- Function to auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO user_profiles (id, email, full_name, role, current_plan, subscription_status, trial_started_at, trial_ends_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'user',
    'free_trial',
    'trialing',
    now(),
    now() + interval '7 days'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
