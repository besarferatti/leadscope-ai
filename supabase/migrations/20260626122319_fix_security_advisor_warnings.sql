-- Fix 1 & 2: SECURITY DEFINER functions need SET search_path = ''
CREATE OR REPLACE FUNCTION is_admin_user()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.user_profiles (
    id, email, full_name, role, current_plan, subscription_status,
    trial_started_at, trial_ends_at, is_active, must_change_password
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'user', 'free_trial', 'trialing',
    now(), now() + interval '7 days',
    true, false
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Fix 3: Merge duplicate SELECT policies into one
DROP POLICY IF EXISTS "select_own_profile" ON public.user_profiles;
DROP POLICY IF EXISTS "admin_select_all_profiles" ON public.user_profiles;
CREATE POLICY "select_profiles" ON public.user_profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id OR is_admin_user());

-- Fix 4: Remove the overly-permissive service INSERT policy (trigger is SECURITY DEFINER, bypasses RLS anyway)
DROP POLICY IF EXISTS "service_insert_profile" ON public.user_profiles;

-- Fix 5: Merge duplicate UPDATE policies into one
DROP POLICY IF EXISTS "update_own_profile" ON public.user_profiles;
DROP POLICY IF EXISTS "admin_update_all_profiles" ON public.user_profiles;
CREATE POLICY "update_profiles" ON public.user_profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id OR is_admin_user())
  WITH CHECK (auth.uid() = id OR is_admin_user());
