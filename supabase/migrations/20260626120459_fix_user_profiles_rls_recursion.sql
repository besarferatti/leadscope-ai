-- Create a security definer function to check admin status without triggering RLS
CREATE OR REPLACE FUNCTION is_admin_user()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- Drop the recursive admin policies
DROP POLICY IF EXISTS "admin_select_all_profiles" ON user_profiles;
DROP POLICY IF EXISTS "admin_update_all_profiles" ON user_profiles;
DROP POLICY IF EXISTS "admin_delete_profiles" ON user_profiles;

-- Re-create them using the security definer function (no recursion)
CREATE POLICY "admin_select_all_profiles" ON user_profiles
  FOR SELECT TO authenticated
  USING (is_admin_user());

CREATE POLICY "admin_update_all_profiles" ON user_profiles
  FOR UPDATE TO authenticated
  USING (is_admin_user())
  WITH CHECK (is_admin_user());

CREATE POLICY "admin_delete_profiles" ON user_profiles
  FOR DELETE TO authenticated
  USING (is_admin_user());
