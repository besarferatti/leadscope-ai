-- Apply to a disposable/staging database first. Production requires authorization.
BEGIN;

-- An inactive administrator must not retain elevated database access.
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'admin' AND is_active
  );
$$;
REVOKE ALL ON FUNCTION public.is_admin_user() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin_user() TO authenticated, service_role;

-- RLS controls rows, not which columns the owner can change.
-- Keep existing admin management and server-side Stripe writes working.
CREATE OR REPLACE FUNCTION public.guard_profile_authorization()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF current_user IN ('postgres', 'service_role') THEN RETURN NEW; END IF;
  IF public.is_admin_user() THEN RETURN NEW; END IF;
  IF ROW(NEW.id, NEW.email, NEW.role, NEW.current_plan, NEW.billing_cycle,
         NEW.subscription_status, NEW.trial_started_at, NEW.trial_ends_at,
         NEW.is_active, NEW.created_at)
     IS DISTINCT FROM
     ROW(OLD.id, OLD.email, OLD.role, OLD.current_plan, OLD.billing_cycle,
         OLD.subscription_status, OLD.trial_started_at, OLD.trial_ends_at,
         OLD.is_active, OLD.created_at) THEN
    RAISE EXCEPTION 'Profile authorization fields are managed by the server'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_profile_authorization() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS guard_profile_authorization ON public.user_profiles;
CREATE TRIGGER guard_profile_authorization BEFORE UPDATE ON public.user_profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_profile_authorization();

-- No client-supplied role, plan, or trial dates during missing-profile recovery.
DROP POLICY IF EXISTS insert_own_profile ON public.user_profiles;
REVOKE INSERT ON public.user_profiles FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION public.ensure_user_profile()
RETURNS public.user_profiles LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  caller_id uuid := auth.uid();
  result public.user_profiles;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.user_profiles (id, email, full_name, trial_started_at, trial_ends_at)
  SELECT id, COALESCE(email, ''), COALESCE(raw_user_meta_data->>'full_name', ''),
         created_at, created_at + interval '7 days'
  FROM auth.users WHERE id = caller_id
  ON CONFLICT (id) DO NOTHING;
  SELECT * INTO result FROM public.user_profiles WHERE id = caller_id;
  IF result.id IS NULL THEN
    RAISE EXCEPTION 'Authenticated user not found' USING ERRCODE = '42501';
  END IF;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.ensure_user_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_user_profile() TO authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
COMMIT;
